// **Set wake time** (prd.md > Sleep and Waking Days, the provisional day; build-out item 2.1):
// in a log with no wake time yet, the header offers it. The person picks today or yesterday and
// a time; the wake is saved as a record whose sleep start is "not logged" (the same record
// **I woke up** saves when no sleep was open). Before it is saved, the regroup preview shows which
// meals move into the day the new wake starts, and which stay before it in the provisional day
// (spec.md > movedMeals powers it). Nothing disappears: every meal is in one of the two lists.
// Build-out item 2.2: workouts are listed too, the way the sleep and wake editor's move warning
// lists them (sleepEdit.ts > movesBetween), so all three ways of setting a wake agree.
// Pure: no React, no storage, no clock reads (now is passed in).

import { combineDay } from '../kernel/estimate'
import { parseClockTime } from '../kernel/parse'
import { mealsForDay, wakesOf, wakingDayStart } from '../kernel/sleepday'
import type { Meal, SleepProblem, SleepRecord, SleepStatus } from '../kernel/types'
import { fromLocalInput } from './editMeal'
import { movesBetween, workoutEntries, type DatedLog, type MovedEntry } from './sleepEdit'
import { fmtClockMinutes, sleepSave } from './sleepView'

export type WakeDay = 'today' | 'yesterday'

/** The default wake time: 7:00 AM, on today's date once it has passed, otherwise yesterday's. */
export const DEFAULT_WAKE_TIME = '07:00'

/** DEFAULT_WAKE_TIME in minutes after midnight (420). */
export function defaultWakeMinutes(): number {
  const [h, m] = DEFAULT_WAKE_TIME.split(':').map(Number)
  return h * 60 + m
}

/** DEFAULT_WAKE_TIME as the sheet shows it ("7:00 AM"). */
export function defaultWakeLabel(): string {
  return fmtClockMinutes(defaultWakeMinutes())
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today's and yesterday's local dates ("2026-11-05"), counted from the log's now. */
export function wakeDates(nowIso: string): Record<WakeDay, string> {
  const now = new Date(nowIso)
  // The local Date constructor steps back one calendar day, across a clock change too.
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12)
  return { today: dateInput(now), yesterday: dateInput(yesterday) }
}

/** Which day the sheet starts on: today when 7:00 AM has passed, otherwise yesterday. */
export function defaultWakeDay(nowIso: string): WakeDay {
  const now = new Date(nowIso)
  return now.getHours() * 60 + now.getMinutes() >= defaultWakeMinutes() ? 'today' : 'yesterday'
}

/**
 * The picked day and time as a local-offset ISO string, or null when the time isn't one. Build-out
 * item 2.2: the time is typed as people say it ("7", "7:30 am", "07:30", "19:30"), read by the
 * kernel's parseClockTime(), the same reading as the sleep and wake editor.
 */
export function wakeIso(nowIso: string, day: WakeDay, time: string): string | null {
  const t = parseClockTime(time)
  if (t.kind !== 'value') return null
  return fromLocalInput(`${wakeDates(nowIso)[day]}T${pad(Math.floor(t.minutes / 60))}:${pad(t.minutes % 60)}`)
}

/** True when the log has no wake time and nobody is asleep: the header then offers Set wake time. */
export function canSetWake(sleeps: SleepRecord[], status: SleepStatus): boolean {
  return wakesOf(sleeps).length === 0 && status.kind === 'awake'
}

export type Regroup =
  | {
      ok: true
      sleeps: SleepRecord[]
      wake: string
      /** Meals that move into the waking day the new wake starts, in time order. */
      moving: Meal[]
      /** Meals before the new wake: they stay in the provisional day ("Wake time not set"). */
      staying: Meal[]
      /** Workouts that move into the new waking day, in time order (sleepEdit.ts > movesBetween). */
      movingWorkouts: MovedEntry[]
      /** Workouts before the new wake, staying in the provisional day, in time order. */
      stayingWorkouts: MovedEntry[]
    }
  | { ok: false; problem: SleepProblem }

/**
 * What saving `wake` as the first wake time would do. A time later than `nowIso` is rejected
 * (your own log), as are times that clash with a recorded sleep. On success `moving` and
 * `staying` together hold every meal that was in the provisional day, and `movingWorkouts` and
 * `stayingWorkouts` every workout that was.
 */
export function regroupForWake(
  meals: Meal[],
  sleeps: SleepRecord[],
  wake: string | null,
  nowIso: string,
  id?: string,
  workouts: DatedLog['workouts'] = [],
): Regroup {
  const res = sleepSave(sleeps, meals, 'wake', wake, nowIso, id)
  if (!res.ok) return res
  const moving = res.moved
  const staying = mealsForDay(meals, res.sleeps, null)
  const byTime = (a: MovedEntry, b: MovedEntry) => Date.parse(a.at) - Date.parse(b.at)
  const movingWorkouts = movesBetween({ meals: [], workouts }, sleeps, res.sleeps)
    .flatMap((g) => g.entries)
    .sort(byTime)
  const stayingWorkouts = workoutEntries(workouts)
    .filter((w) => wakingDayStart(sleeps, w.at) === null && wakingDayStart(res.sleeps, w.at) === null)
    .sort(byTime)
  return { ok: true, sleeps: res.sleeps, wake: res.record.wake as string, moving, staying, movingWorkouts, stayingWorkouts }
}

/**
 * A regroup list's calories, counted as the dashboard's headline counts them (combineDay's known
 * total): `kcal` is null when no meal in the list has known calories, and `unknown` counts the
 * meals left out because their calories are unknown. Shown beside each list in the preview, so
 * the change to the day's headline is visible before saving.
 */
export function regroupTotal(meals: Meal[]): { kcal: number | null; unknown: number } {
  const day = combineDay(meals)
  const unknown = day.unknownMealIds.length
  return { kcal: meals.length - unknown > 0 ? day.knownTotal : null, unknown }
}
