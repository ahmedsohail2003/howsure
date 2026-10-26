// The Log a meal sheet's form state, its validation, and the before/after preview
// (prd.md > Logging a Meal, > Calorie Input Rules, > Improve That Entry; spec.md > The Core
// Journey Through the System, steps 4-5). New meals (slice 3) use the same draft and checks.
// The preview runs the same buildDayView() the dashboard uses, on a *copy* of the log with
// the edited meal swapped in. Save puts that same copy in place of the original, so the
// preview and the dashboard after Save always match. Pure: no React, no storage.

import { toLocalIso } from '../clock'
import { parseAmount } from '../kernel/parse'
import { nextWakeAfter, wakingDayStart } from '../kernel/sleepday'
import type { Meal, MealSourceId, Parsed, SleepRecord } from '../kernel/types'
import type { LogDoc } from '../store/log'
import { copy } from './copy'
import { buildDayView, type DayView } from './dayView'

export interface MealDraft {
  name: string
  source: MealSourceId | null // "How do you know?" has no default for a new meal
  kcal: string
  eatenAtLocal: string // a datetime-local value, "YYYY-MM-DDTHH:MM", in local time
  protein: string
  carbs: string
  fat: string
  note: string
}

export type DraftField = 'name' | 'source' | 'kcal' | 'eatenAt' | 'protein' | 'carbs' | 'fat'

export interface DraftCheck {
  /** The meal Save would store, or null while something blocks Save. */
  meal: Meal | null
  /** Inline errors by field. Everything typed is kept; only Save is blocked. */
  errors: Partial<Record<DraftField, string>>
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** An ISO string as a datetime-local value in local time ("2026-10-21T17:30"). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** A datetime-local value as a local-offset ISO string, or null when it isn't a date and time. */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null
  const ms = new Date(value).getTime() // no offset: read as local time
  return Number.isNaN(ms) ? null : toLocalIso(ms)
}

function amountText(v: number | null): string {
  return v === null ? '' : String(v)
}

/** The sheet's starting values for an existing meal: its current values, nothing changed. */
export function draftFromMeal(meal: Meal): MealDraft {
  return {
    name: meal.name,
    source: meal.source,
    kcal: amountText(meal.kcal),
    eatenAtLocal: toLocalInput(meal.eatenAt),
    protein: amountText(meal.protein),
    carbs: amountText(meal.carbs),
    fat: amountText(meal.fat),
    note: meal.note ?? '',
  }
}

function valueOf(p: Parsed): number | null {
  return p.kind === 'value' ? p.value : null
}

/** A new meal's id: random, so two devices or two tabs never pick the same one. */
export function newMealId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return `meal-${c.randomUUID()}`
  return `meal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * The starting point for **Log a meal**: nothing filled in but the date and time. Calories and
 * macros are blank (unknown, never 0) and "How do you know?" has no default (prd.md > Logging a Meal).
 */
export function blankMeal(id: string, eatenAt: string): Meal {
  return { id, name: '', eatenAt, source: null, kcal: null, protein: null, carbs: null, fat: null }
}

/** An ISO time cut to the minute, as the datetime-local field shows it. */
function toMinute(iso: string): string {
  return fromLocalInput(toLocalInput(iso)) ?? iso
}

/**
 * The default date and time for a new meal (prd.md > Logging a Meal: "defaulting to now. Logging
 * from a previous day defaults to that day"). On the waking day that contains now, it is now.
 * On another waking day it keeps now's clock time, on the first calendar date from that day's
 * wake that falls inside the waking day (so 01:30 lands after midnight, as on the snack's day),
 * else the day's wake. Cut to the minute, like the field.
 */
export function defaultMealTime(sleeps: SleepRecord[], viewedDayStart: string | null, nowIso: string): string {
  const now = new Date(nowIso)
  if (Number.isNaN(now.getTime())) return nowIso
  if (wakingDayStart(sleeps, nowIso) === viewedDayStart) return toMinute(nowIso)

  const wakes = sleeps
    .map((r) => r.wake)
    .filter((w): w is string => typeof w === 'string' && !Number.isNaN(Date.parse(w)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))
  const from = viewedDayStart === null ? Number.NEGATIVE_INFINITY : Date.parse(viewedDayStart)
  const endIso = viewedDayStart === null ? (wakes[0] ?? null) : nextWakeAfter(sleeps, viewedDayStart)
  const to = endIso === null ? Number.POSITIVE_INFINITY : Date.parse(endIso)

  // The calendar dates to try: the wake's date, then the next one. The provisional day has no
  // wake, so it tries its end's date, then the day before.
  const anchor = new Date(viewedDayStart ?? endIso ?? nowIso)
  const offsets = viewedDayStart === null ? [0, -1] : [0, 1]
  for (const offset of offsets) {
    const c = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + offset, now.getHours(), now.getMinutes())
    const t = c.getTime()
    if (t >= from && t < to) return toLocalIso(t)
  }
  return toMinute(Number.isFinite(from) ? (viewedDayStart as string) : toLocalIso(to - 60_000))
}

/**
 * Check a draft against the original meal. Blank amounts are unknown (null), never 0;
 * "0" is a real zero. Letters or a minus sign are an inline error that blocks Save.
 * With calories entered, a source must be picked; with calories blank it can stay empty.
 */
export function checkDraft(draft: MealDraft, original: Meal): DraftCheck {
  const errors: DraftCheck['errors'] = {}
  const kcal = parseAmount(draft.kcal)
  const macros = {
    protein: parseAmount(draft.protein),
    carbs: parseAmount(draft.carbs),
    fat: parseAmount(draft.fat),
  }
  if (kcal.kind === 'error') errors.kcal = kcal.message
  for (const k of ['protein', 'carbs', 'fat'] as const) {
    const p = macros[k]
    if (p.kind === 'error') errors[k] = p.message
  }
  const name = draft.name.trim()
  if (name === '') errors.name = copy.logMeal.nameNeeded
  if (draft.source === null && kcal.kind === 'value') errors.source = copy.logMeal.pickSourceHint

  // Keep the stored time as it was unless the field was changed, so an untouched meal stays identical.
  const eatenAt =
    draft.eatenAtLocal === toLocalInput(original.eatenAt) ? original.eatenAt : fromLocalInput(draft.eatenAtLocal)
  if (eatenAt === null) errors.eatenAt = copy.logMeal.dateTimeNeeded

  if (Object.keys(errors).length > 0 || eatenAt === null) return { meal: null, errors }

  const note = draft.note.trim()
  const meal: Meal = {
    ...original,
    name,
    source: draft.source,
    kcal: valueOf(kcal),
    eatenAt,
    protein: valueOf(macros.protein),
    carbs: valueOf(macros.carbs),
    fat: valueOf(macros.fat),
  }
  if (note === '') delete meal.note
  else meal.note = note
  return { meal, errors }
}

/**
 * The log with one meal saved: replaced in place when its id is already there (Edit, Improve),
 * added at the end when it is new (Log a meal). The original log is never changed.
 */
export function withMeal(doc: LogDoc, meal: Meal): LogDoc {
  if (!doc.meals.some((m) => m.id === meal.id)) return { ...doc, meals: [...doc.meals, meal] }
  return { ...doc, meals: doc.meals.map((m) => (m.id === meal.id ? meal : m)) }
}

/** The log without one meal (Delete). Every total is recomputed from what is left. */
export function withoutMeal(doc: LogDoc, mealId: string): LogDoc {
  return { ...doc, meals: doc.meals.filter((m) => m.id !== mealId) }
}

export interface EditPreview {
  before: DayView
  after: DayView
  /** False when the edited time moves the meal onto another waking day. */
  stillOnThisDay: boolean
}

/** The viewed day before and after the edit, both from buildDayView(), the dashboard's own function. */
export function previewEdit(doc: LogDoc, atIso: string, edited: Meal): EditPreview {
  const before = buildDayView(doc, atIso)
  const after = buildDayView(withMeal(doc, edited), atIso)
  return { before, after, stillOnThisDay: after.meals.some((m) => m.id === edited.id) }
}
