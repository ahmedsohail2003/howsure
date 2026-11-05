// Build-out item 2.3: repeat a usual meal. "Recent" is the last distinct meals logged, newest
// first; "Saved" is the meals saved as usual (LogDoc.savedMeals). Tapping one logs a fresh meal
// with its own id and time and the same name, source and values, optionally at another amount
// (kernel/portion.ts). Both lists and every number on them come from here, once, for every look.
// Pure: no React, no storage, no clock reads.

import { estimateMeal } from '../kernel/estimate'
import { parseAmount } from '../kernel/parse'
import { isFactor, scaleAmounts } from '../kernel/portion'
import { getSource } from '../kernel/sources'
import type { Meal, Range } from '../kernel/types'
import type { LogDoc, SavedMeal } from '../store/log'
import { copy } from './copy'

/** How many recent meals the sheet offers. */
export const RECENT_LIMIT = 5

/** The quick amounts beside the typed multiplier. */
export const AMOUNT_PRESETS = [0.5, 1, 1.5, 2] as const

/** What a repeat copies from a logged or saved meal: everything but its id and time. */
export type MealValues = Pick<Meal, 'name' | 'source' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'note' | 'foods' | 'lookup'>

/**
 * The values a repeat copies, as a fresh copy. Only these keys: anything else a meal carries (an
 * import's original record, say) belongs to that one entry and is not repeated.
 */
export function valuesOf(m: Meal | SavedMeal): MealValues {
  const v: MealValues = {
    name: m.name,
    source: m.source,
    kcal: m.kcal,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
  }
  if (m.note !== undefined) v.note = m.note
  if (m.foods !== undefined) v.foods = structuredClone(m.foods)
  if (m.lookup !== undefined) v.lookup = structuredClone(m.lookup)
  return v
}

/** A name as compared: trimmed, spaces collapsed, case ignored. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
}

/**
 * Two meals are the same repeat when their name and every value that reaches a number match:
 * calories, macros, source and a looked-up amount's kind (which changes the typical error).
 */
export function repeatKey(m: MealValues): string {
  return JSON.stringify([nameKey(m.name), valuesKey(m)])
}

/**
 * The values part of repeatKey, without the name: whether a meal still holds the values a saved
 * meal was saved with (it may have been edited since, or saved under another name).
 */
export function valuesKey(m: MealValues): string {
  return JSON.stringify([m.source, m.kcal, m.protein, m.carbs, m.fat, m.lookup?.amount.kind ?? null])
}

/** True when `meal` is the one `s` was saved from and still holds the values it was saved with. */
function savedFrom(s: SavedMeal, meal: Meal): boolean {
  return s.fromMealId === meal.id && valuesKey(s) === valuesKey(meal)
}

function timeOf(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

/**
 * The last distinct meals logged, newest first by their time (a tie goes to the one added later).
 * Left out, because a newer one or the Saved list already offers it: a meal that repeats a newer
 * one (same name and values); a meal that repeats a saved meal; and the meal a saved meal was saved
 * from, with any repeat of it, while it still holds the saved values (saved under a new name, it
 * would otherwise show twice). A meal edited since it was saved is a meal of its own again.
 */
export function recentMeals(meals: readonly Meal[], saved: readonly SavedMeal[] = [], limit = RECENT_LIMIT): Meal[] {
  const seen = new Set(saved.map((s) => repeatKey(s)))
  for (const s of saved) {
    const from = s.fromMealId === undefined ? undefined : meals.find((m) => savedFrom(s, m))
    if (from) seen.add(repeatKey(from))
  }
  const order = meals.map((m, i) => ({ m, i, t: timeOf(m.eatenAt) })).sort((a, b) => b.t - a.t || b.i - a.i)
  const out: Meal[] = []
  for (const { m } of order) {
    if (out.length >= limit) break
    const key = repeatKey(m)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(m)
  }
  return out
}

/** Saved meals in name order, so a usual meal is found where it was last time. */
export function savedInOrder(saved: readonly SavedMeal[] = []): SavedMeal[] {
  return [...saved].sort((a, b) => a.name.localeCompare(b.name, 'en-US', { sensitivity: 'base' }) || (a.id < b.id ? -1 : 1))
}

/**
 * The saved meal this meal was saved as ("Saved as a usual meal"): the one saved from it while the
 * meal still holds the values it was saved with, else one with its name and values (a repeat of a
 * saved meal at the usual amount). A meal edited since it was saved has no match, so its details
 * never claim the old values and offer Save as a usual meal again.
 */
export function savedMatch(meal: Meal, saved: readonly SavedMeal[] = []): SavedMeal | undefined {
  const key = repeatKey(meal)
  return saved.find((s) => savedFrom(s, meal)) ?? saved.find((s) => repeatKey(s) === key)
}

/**
 * A saved meal saved from this meal that no longer holds its values (the meal was edited since).
 * Its details say so, and saving again under that name updates it rather than adding a second one.
 */
export function savedEarlier(meal: Meal, saved: readonly SavedMeal[] = []): SavedMeal | undefined {
  if (savedMatch(meal, saved)) return undefined
  return saved.find((s) => s.fromMealId === meal.id)
}

/* ---------------- the amount ---------------- */

export type AmountChoice = { kind: 'preset'; factor: number } | { kind: 'other'; text: string }

export type FactorCheck = { ok: true; factor: number } | { ok: false; error: string | null }

/**
 * The multiplier the amount control holds. A preset is always fine; a typed one must be a number
 * from MIN_FACTOR to MAX_FACTOR ("1.25", "1,5", ".5"). Blank is no amount yet: no error, nothing
 * to log (the screen says to type one).
 */
export function checkFactor(choice: AmountChoice): FactorCheck {
  if (choice.kind === 'preset') return { ok: true, factor: choice.factor }
  // ".5" and ",5" read as 0.5; the shared amount parser wants a digit first.
  const p = parseAmount(choice.text.trim().replace(/^[.,]/, '0$&'))
  if (p.kind === 'unknown') return { ok: false, error: null }
  if (p.kind === 'error' || !isFactor(p.value)) return { ok: false, error: copy.quickLog.amountError }
  return { ok: true, factor: p.value }
}

/** A multiplier as shown: 0.5 -> "0.5", 1.25 -> "1.25", 2 -> "2" (MIN_FACTOR keeps it above "0"). */
export function fmtFactor(factor: number): string {
  return String(Math.round(factor * 100) / 100)
}

/* ---------------- the lists ---------------- */

export interface QuickItem {
  kind: 'recent' | 'saved'
  /** The logged meal's id (Recent) or the saved meal's id (Saved). */
  id: string
  /** What tapping it logs, already at the chosen amount. */
  values: MealValues
  /** The calories at the usual amount, for "×1.5 of 380 kcal"; null when unknown. */
  usualKcal: number | null
  /** The likely range at the chosen amount, from estimateMeal; null with unknown calories. */
  likely: Range | null
  /** The source's label, or null when it was not picked. */
  sourceLabel: string | null
}

function itemOf(kind: QuickItem['kind'], id: string, base: MealValues, factor: number): QuickItem {
  const values = scaleAmounts(base, factor)
  const est = estimateMeal({ ...values, id, eatenAt: '' })
  return {
    kind,
    id,
    values,
    usualKcal: base.kcal,
    likely: est ? est.likely : null,
    sourceLabel: values.source === null ? null : getSource(values.source).label,
  }
}

export interface QuickLists {
  recent: QuickItem[]
  saved: QuickItem[]
}

/** Recent and Saved for the top of Log a meal, at `factor` times the usual amount. */
export function quickLists(doc: Pick<LogDoc, 'meals' | 'savedMeals'>, factor: number): QuickLists {
  const saved = doc.savedMeals ?? []
  return {
    recent: recentMeals(doc.meals, saved).map((m) => itemOf('recent', m.id, valuesOf(m), factor)),
    saved: savedInOrder(saved).map((s) => itemOf('saved', s.id, valuesOf(s), factor)),
  }
}

/** The fresh meal a tap logs: its own id and time, the item's name, source and values. */
export function mealFromValues(values: MealValues, id: string, eatenAt: string): Meal {
  return { ...structuredClone(values), id, eatenAt }
}

/* ---------------- saving, renaming, deleting ---------------- */

/** The inline error for a saved meal's name, or null when it can be used. `exceptId` is the one being renamed. */
export function checkSavedName(name: string, saved: readonly SavedMeal[] = [], exceptId?: string): string | null {
  const trimmed = name.trim()
  if (trimmed === '') return copy.usualMeals.nameNeeded
  const key = nameKey(trimmed)
  const taken = saved.find((s) => s.id !== exceptId && nameKey(s.name) === key)
  return taken ? copy.usualMeals.nameTaken(taken.name) : null
}

/** A new saved meal's id: random, like a meal's. */
export function newSavedMealId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return `saved-${c.randomUUID()}`
  return `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** A saved meal from a logged one, under `name` (trimmed), noting which meal it came from. */
export function savedFromMeal(meal: Meal, name: string, id: string, savedAt: string): SavedMeal {
  return { ...valuesOf(meal), name: name.trim(), id, savedAt, fromMealId: meal.id }
}

/** The log with one more saved meal. The original log is never changed. */
export function withSavedMeal(doc: LogDoc, saved: SavedMeal): LogDoc {
  return { ...doc, savedMeals: [...(doc.savedMeals ?? []), saved] }
}

/**
 * The log with one saved meal given a logged meal's values now (and `next`'s name), in its place
 * in the list. Logged meals are left as they are.
 */
export function withSavedMealUpdated(doc: LogDoc, next: SavedMeal): LogDoc {
  return { ...doc, savedMeals: (doc.savedMeals ?? []).map((s) => (s.id === next.id ? next : s)) }
}

/** The log with one saved meal renamed. Logged meals are left as they are. */
export function withSavedMealRenamed(doc: LogDoc, id: string, name: string): LogDoc {
  return { ...doc, savedMeals: (doc.savedMeals ?? []).map((s) => (s.id === id ? { ...s, name: name.trim() } : s)) }
}

/** The log without one saved meal. Logged meals are left as they are. */
export function withoutSavedMeal(doc: LogDoc, id: string): LogDoc {
  return { ...doc, savedMeals: (doc.savedMeals ?? []).filter((s) => s.id !== id) }
}
