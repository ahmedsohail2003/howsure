// The sleep and wake editor's logic (build-out item 2.2; checklist slice 6; prd.md > Editing Sleep
// and Wake Times; spec.md > Maths Core: Waking Days and Sleep > Validation, movedMeals).
//   - A time is typed as people say it ("8", "8am", "8:15 pm", "20:30"), read by the kernel's
//     parseClockTime(), and shown back with AM or PM and its weekday. Each time has its own date,
//     so an overnight sleep is unambiguous.
//   - The order check is the kernel's validateSleep(); each problem is put next to the field it is
//     about, in plain words.
//   - Before an edit, a new night or a deletion changes which waking day an entry (a meal, or any
//     other dated entry: a workout or a weigh-in) belongs to, movesBetween() lists what moves, from
//     which day to which day. Nothing moves, nothing is listed.
// Pure: no React, no storage, no clock reads (now is passed in).

import { parseClockTime } from '../kernel/parse'
import { movedBy, validateSleep, wakingDayStart } from '../kernel/sleepday'
import type { SleepProblem, SleepRecord } from '../kernel/types'
import { sortedWeighIns } from '../kernel/weight'
import type { LogDoc } from '../store/log'
import { copy } from './copy'
import { fromLocalInput, toLocalInput } from './editMeal'
import { fmtTime, fmtWeekday, fmtWeekdayDate, fmtWeekdayDateTime, fmtWeekdayTime } from './format'
import { fmtClockMinutes, fmtDuration, newSleepId, nightGoneBySince, nightRangeText, problemText } from './sleepView'
import { fmtWeight, weightUnitOf } from './weightView'

/** One time as typed: a date field ("2026-11-05") and a time field ("8", "8:00 AM"). */
export interface WhenDraft {
  date: string
  time: string
}

export type WhenRead =
  | { kind: 'empty' }
  | { kind: 'value'; iso: string; minutes: number; ambiguous: boolean }
  | { kind: 'error'; message: string }

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** The earliest date a night can have: the date fields start here, and an earlier one is refused. */
export const MIN_NIGHT_DATE = '2000-01-01'

/**
 * Reads one date and time. A blank time is empty, whatever the date says. `maxDate` (the demo
 * only: a day after its clock) refuses a later date at its own field, so a mistyped year cannot
 * move the demo's clock decades ahead. Your own log needs none: a time after now is refused there.
 */
export function readWhen(d: WhenDraft, maxDate: string | null = null): WhenRead {
  const t = parseClockTime(d.time)
  if (t.kind === 'empty') return { kind: 'empty' }
  if (t.kind === 'error') return { kind: 'error', message: copy.sleepEditor.errors.time }
  // A typed year before 2000 ("0001") would make a broken time; it is refused at its own field.
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date < MIN_NIGHT_DATE) {
    return { kind: 'error', message: copy.sleepEditor.errors.dateRange }
  }
  if (maxDate !== null && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date > maxDate) {
    return { kind: 'error', message: copy.sleepEditor.errors.demoDateLimit(fmtWeekdayDate(`${maxDate}T12:00:00`)) }
  }
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d.date)
    ? fromLocalInput(`${d.date}T${pad(Math.floor(t.minutes / 60))}:${pad(t.minutes % 60)}`)
    : null
  if (iso === null) return { kind: 'error', message: copy.sleepEditor.errors.date }
  return { kind: 'value', iso, minutes: t.minutes, ambiguous: t.ambiguous }
}

/** The time field's text tidied once it loses focus: "8" becomes "8:00 AM"; anything else is kept as typed. */
export function tidyTime(text: string): string {
  const t = parseClockTime(text)
  return t.kind === 'value' ? fmtClockMinutes(t.minutes) : text
}

/**
 * How to type the other half of the day after a bare hour from 1 to 12 (read on the 24-hour clock):
 * "12" is noon, so the tip is am for midnight; "1" to "11" are morning, so the tip is pm. Null when
 * the time was not a bare hour. The editor, I woke up and Set wake time all use it.
 */
export function ambiguityTip(t: { minutes: number; ambiguous: boolean }): string | null {
  if (!t.ambiguous) return null
  return t.minutes >= 720 ? copy.sleepEditor.typeAm : copy.sleepEditor.typePm
}

/** How a time was read, under its field: "Reads as Thu 8:00 AM." plus how to type the other half of the day. */
export function readBack(r: WhenRead): string | null {
  if (r.kind !== 'value') return null
  const base = copy.sleepEditor.readsAs(fmtWeekdayTime(r.iso))
  const tip = ambiguityTip(r)
  return tip === null ? base : `${base} ${tip}`
}

/** A stored time as the two fields show it. */
export function whenFromIso(iso: string): WhenDraft {
  return { date: toLocalInput(iso).slice(0, 10), time: fmtTime(iso) }
}

/** The demo's latest date for a night: the day after its clock (its clock moves forward to a later time). */
export function demoMaxDate(nowIso: string): string {
  return shiftDate(toLocalInput(nowIso).slice(0, 10), 1)
}

/** "2026-11-05" moved by whole calendar days. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const c = new Date(y, m - 1, d + days, 12)
  return `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}`
}

/**
 * A night as typed. While `sleepDateAuto` is true (a blank or new sleep time), the sleep date
 * follows the wake: the wake's date when the sleep time is earlier in the day than the wake time
 * (asleep at 1 AM, up at 8 AM), otherwise the day before (asleep at 11 PM, up at 7 AM). Choosing
 * a sleep date turns that off.
 */
export interface NightDraft {
  sleep: WhenDraft
  wake: WhenDraft
  sleepDateAuto: boolean
}

/** The draft with its sleep date following the wake, when that is on. */
export function withAutoSleepDate(d: NightDraft): NightDraft {
  if (!d.sleepDateAuto || !/^\d{4}-\d{2}-\d{2}$/.test(d.wake.date)) return d
  const s = parseClockTime(d.sleep.time)
  const w = parseClockTime(d.wake.time)
  const sameDay = s.kind === 'value' && w.kind === 'value' && s.minutes < w.minutes
  const date = sameDay ? d.wake.date : shiftDate(d.wake.date, -1)
  return date === d.sleep.date ? d : { ...d, sleep: { ...d.sleep, date } }
}

/** What the editor opens on: one recorded night, or a new (missed) night. */
export type EditTarget = { kind: 'edit'; recordId: string } | { kind: 'add'; wakeDate: string }

/** The draft for a recorded night: its own dates and times; a missing end is blank. */
export function draftForRecord(r: SleepRecord, nowIso: string): NightDraft {
  const wake = r.wake !== null ? whenFromIso(r.wake) : { date: toLocalInput(nowIso).slice(0, 10), time: '' }
  if (r.sleepStart !== null) return { sleep: whenFromIso(r.sleepStart), wake, sleepDateAuto: false }
  return withAutoSleepDate({ sleep: { date: '', time: '' }, wake, sleepDateAuto: true })
}

/** The draft for a missed night waking on `wakeDate`: both times blank, the sleep date following. */
export function draftForMissed(wakeDate: string): NightDraft {
  return withAutoSleepDate({ sleep: { date: '', time: '' }, wake: { date: wakeDate, time: '' }, sleepDateAuto: true })
}

/**
 * Where "Add a missed night" starts: a wake date that has no recorded wake yet, so the first Save
 * does not run into a night already there.
 *   - First choice: the day after the viewed day's wake (the night that would split a day that ran
 *     on because its night had no record), but never after today. The provisional day starts on
 *     today.
 *   - When a recorded wake is already on that date (a daytime sleep can take it): the nearest gap,
 *     earlier or later, up to today, a gap being the day after a wake whose next recorded wake is
 *     two or more calendar days later, or the day before the earliest recorded wake (nothing is
 *     recorded before it, so that date is always free); at equal distance the later one.
 */
export function missedWakeDate(sleeps: SleepRecord[], dayStart: string | null, nowIso: string): string {
  const today = toLocalInput(nowIso).slice(0, 10)
  const next = dayStart === null ? today : shiftDate(toLocalInput(dayStart).slice(0, 10), 1)
  const first = next < today ? next : today
  const taken = new Set(sleeps.filter((r) => r.wake !== null).map((r) => toLocalInput(r.wake as string).slice(0, 10)))
  if (!taken.has(first)) return first
  const dates = [...taken].sort()
  const gaps: string[] = dates.length > 0 ? [shiftDate(dates[0], -1)] : []
  for (let i = 0; i < dates.length; i++) {
    const after = shiftDate(dates[i], 1)
    const following = dates[i + 1] ?? shiftDate(today, 1)
    if (after < following && after <= today) gaps.push(after)
  }
  let best: string | null = null
  for (const g of gaps) {
    const d = Math.abs(dayNumber(g) - dayNumber(first))
    if (best === null || d <= Math.abs(dayNumber(best) - dayNumber(first))) best = g
  }
  return best ?? first
}

/** "2026-11-05" as a whole day count, for distances between dates. */
function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/**
 * True when `r` is the latest recorded night and a night has gone by since its wake (24 hours or
 * more, nightGoneBySince): a night since then was probably not logged ("I woke at 8" with nothing
 * recorded for last night). The editor then points at Add a missed night. The sleep section's
 * head and row use the same test, so the editor never hints at a missed night while they still
 * call this night "last night".
 */
export function nightSinceMissing(sleeps: SleepRecord[], r: SleepRecord, nowIso: string): boolean {
  if (r.wake === null) return false
  const at = Date.parse(r.wake)
  const later = sleeps.some((x) => x.id !== r.id && [x.sleepStart, x.wake].some((t) => t !== null && Date.parse(t) > at))
  return !later && nightGoneBySince(r.wake, nowIso)
}

/* ---------------- what moves ---------------- */

/** An entry whose waking day would change. */
export interface MovedEntry {
  kind: 'meal' | 'workout' | 'weigh-in'
  id: string
  /** A meal's or workout's name; a weigh-in's weight ("78.6 kg"), in the unit weights are shown in. */
  name: string
  at: string
  /** A meal's calories (null when unknown); always null for a workout or a weigh-in. */
  kcal: number | null
}

/** Entries moving from one waking day to another, each day known by its wake (null: no wake time). */
export interface MoveGroup {
  from: string | null
  to: string | null
  entries: MovedEntry[]
}

/** The parts of a log whose entries have a date and time (`settings` picks the unit weigh-ins are named in). */
export type DatedLog = Pick<LogDoc, 'meals' | 'workouts'> & Partial<Pick<LogDoc, 'weighIns' | 'settings'>>

/** Every dated entry in the log: meals, workouts and weigh-ins. */
function datedEntries(doc: DatedLog): MovedEntry[] {
  const meals: MovedEntry[] = doc.meals.map((m) => ({ kind: 'meal', id: m.id, name: m.name, at: m.eatenAt, kcal: m.kcal }))
  return [...meals, ...workoutEntries(doc.workouts), ...weighInEntries(doc)]
}

/**
 * The log's weigh-ins as dated entries, each named by its weight in the unit weights are shown in
 * (weightView.ts > weightUnitOf). A weigh-in belongs to a waking day by the meals' rule, so a wake
 * moved past it moves it too (weighed at 7:30, wake corrected from 7:00 to 7:40).
 */
export function weighInEntries(doc: Partial<Pick<LogDoc, 'weighIns' | 'settings'>>): MovedEntry[] {
  const weighIns = sortedWeighIns(doc.weighIns ?? [])
  if (weighIns.length === 0) return []
  const unit = weightUnitOf({ settings: doc.settings, weighIns })
  return weighIns.map((w) => ({ kind: 'weigh-in', id: w.id, name: fmtWeight(w.kg, unit), at: w.at, kcal: null }))
}

/**
 * The log's workouts with a readable start time, as dated entries. A workout's calories never
 * count in a move list's total (the lists show the word "workout" instead), so `kcal` is null.
 */
export function workoutEntries(list: DatedLog['workouts']): MovedEntry[] {
  return list
    .filter((w) => !Number.isNaN(Date.parse(w.startedAt)))
    .map((w) => ({ kind: 'workout', id: w.id, name: w.name, at: w.startedAt, kcal: null }))
}

/**
 * What changes waking day between two versions of the sleep records, grouped by where it comes
 * from and where it goes, in time order. Empty when nothing moves.
 */
export function movesBetween(doc: DatedLog, before: SleepRecord[], after: SleepRecord[]): MoveGroup[] {
  const groups: MoveGroup[] = []
  for (const e of movedBy(datedEntries(doc), (x) => x.at, before, after)) {
    const from = wakingDayStart(before, e.at)
    const to = wakingDayStart(after, e.at)
    let g = groups.find((x) => x.from === from && x.to === to)
    if (!g) {
      g = { from, to, entries: [] }
      groups.push(g)
    }
    g.entries.push(e)
  }
  return groups
}

/**
 * A waking day in words, by its wake: "Thu’s day (woke 8:00 AM)", or "the day with no wake time".
 * With `withDate`, the weekday carries its date ("Tue Nov 3’s day (woke 7:00 AM)").
 */
export function dayLabel(wake: string | null, withDate = false): string {
  if (wake === null) return copy.sleepEditor.dayNoWake
  return copy.sleepEditor.day(withDate ? fmtWeekdayDate(wake) : fmtWeekday(wake), fmtTime(wake))
}

/**
 * A move group's heading: "From Wed’s day (woke 7:10 AM) to Thu’s day (woke 6:30 AM)". When both
 * days fall on the same weekday (a gap of a week or more in an imported log), both carry their dates.
 */
export function moveGroupTitle(g: Pick<MoveGroup, 'from' | 'to'>): string {
  const withDate = g.from !== null && g.to !== null && fmtWeekday(g.from) === fmtWeekday(g.to)
  return copy.sleepEditor.movesGroup(dayLabel(g.from, withDate), dayLabel(g.to, withDate))
}

/* ---------------- the order check ---------------- */

export type NightField = 'sleep' | 'wake'

/** Which field a problem is about, so its message sits next to that field. */
export function fieldFor(p: SleepProblem, record: SleepRecord, latest: string | null): NightField {
  switch (p.kind) {
    case 'sleep-before-previous-wake':
      return 'sleep'
    case 'future':
      return record.wake !== null && latest !== null && Date.parse(record.wake) > Date.parse(latest) ? 'wake' : 'sleep'
    case 'overlap': {
      // Runs into a night that began at or before this one's start: the sleep time is the one to change.
      const otherStart = Date.parse(p.other.sleepStart ?? p.other.wake ?? '')
      const start = record.sleepStart !== null ? Date.parse(record.sleepStart) : null
      return start !== null && otherStart <= start ? 'sleep' : 'wake'
    }
    case 'wake-before-sleep':
    case 'needs-wake':
    case 'not-a-time':
      return 'wake'
  }
}

export interface NightSave {
  record: SleepRecord
  sleeps: SleepRecord[]
  moves: MoveGroup[]
}

export interface NightCheck {
  /** Plain-words problems by field. Everything typed is kept; only Save is blocked. */
  errors: Partial<Record<NightField, string>>
  /** What Save would store, or null while something blocks it. */
  save: NightSave | null
}

/**
 * Check a typed night: an edit of `target.recordId`, or a new night. `latest` is now in your own
 * log (a later time is refused); null in the demo, whose clock moves forward instead, up to
 * `maxDate` (demoMaxDate()).
 */
export function checkNight(
  doc: LogDoc,
  target: EditTarget,
  draft: NightDraft,
  latest: string | null,
  newId: string = newSleepId(),
  maxDate: string | null = null,
): NightCheck {
  const errors: NightCheck['errors'] = {}
  const s = readWhen(draft.sleep, maxDate)
  const w = readWhen(draft.wake, maxDate)
  if (s.kind === 'error') errors.sleep = s.message
  if (w.kind === 'error') errors.wake = w.message
  if (s.kind === 'empty' && w.kind === 'empty') errors.wake = copy.sleepEditor.errors.noTimes
  if (errors.sleep || errors.wake) return { errors, save: null }

  const existing = target.kind === 'edit' ? doc.sleeps.find((r) => r.id === target.recordId) : undefined
  const record: SleepRecord = {
    ...(existing ?? { id: newId }),
    sleepStart: s.kind === 'value' ? s.iso : null,
    wake: w.kind === 'value' ? w.iso : null,
  }
  // An untouched time keeps its stored text (seconds and offset), so an unchanged night stays identical.
  if (existing && existing.sleepStart !== null && record.sleepStart !== null && sameMinute(existing.sleepStart, record.sleepStart)) {
    record.sleepStart = existing.sleepStart
  }
  if (existing && existing.wake !== null && record.wake !== null && sameMinute(existing.wake, record.wake)) {
    record.wake = existing.wake
  }
  const problem = validateSleep(doc.sleeps, record, latest)
  if (problem) return { errors: { [fieldFor(problem, record, latest)]: problemText(problem) }, save: null }
  const sleeps = existing ? doc.sleeps.map((r) => (r.id === record.id ? record : r)) : [...doc.sleeps, record]
  return { errors: {}, save: { record, sleeps, moves: movesBetween(doc, doc.sleeps, sleeps) } }
}

function sameMinute(a: string, b: string): boolean {
  return toLocalInput(a) === toLocalInput(b)
}

/** Deleting a night: the log without it, and what would change day. */
export function deleteNight(doc: LogDoc, recordId: string): { sleeps: SleepRecord[]; moves: MoveGroup[] } {
  const sleeps = doc.sleeps.filter((r) => r.id !== recordId)
  return { sleeps, moves: movesBetween(doc, doc.sleeps, sleeps) }
}

/** The delete confirmation's first line, fitting the night's shape (a sleep still going on, or no sleep time). */
export function deleteIntroText(r: SleepRecord): string {
  if (r.wake === null && r.sleepStart !== null) return copy.sleepEditor.deleteIntroOpen(fmtWeekdayDateTime(r.sleepStart))
  if (r.sleepStart === null && r.wake !== null) return copy.sleepEditor.deleteIntroNoSleep(fmtWeekdayDateTime(r.wake))
  return copy.sleepEditor.deleteIntro(nightRangeText(r))
}

/** Nights longer than this get a plain check-the-times line (saving is still allowed). */
export const LONG_NIGHT_MINUTES = 16 * 60

/**
 * The night's length under the fields, when both times read and the wake is after the sleep. Over
 * 16 hours it adds a line to check AM and PM: a bare "11" for the sleep reads as 11:00 AM.
 */
export function lengthText(draft: NightDraft): string | null {
  const s = readWhen(draft.sleep)
  const w = readWhen(draft.wake)
  if (s.kind !== 'value' || w.kind !== 'value') return null
  const min = Math.round((Date.parse(w.iso) - Date.parse(s.iso)) / 60_000)
  if (min <= 0) return null
  const length = copy.sleepEditor.length(fmtDuration(min))
  return min > LONG_NIGHT_MINUTES ? `${length} ${copy.sleepEditor.longNight}` : length
}

/** The latest time in a saved night, for the demo clock (a time past the demo's now moves it there). */
export function latestTime(r: SleepRecord): string | null {
  const times = [r.sleepStart, r.wake].filter((t): t is string => t !== null)
  return times.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
}
