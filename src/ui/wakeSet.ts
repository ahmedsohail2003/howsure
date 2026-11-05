// **Set wake time** (prd.md > Sleep and Waking Days, the provisional day; build-out item 2.1):
// in a log with no wake time yet, the header offers it. The person picks today or yesterday and
// a time; the wake is saved as a record whose sleep start is "not logged" (the same record
// **I woke up** saves when no sleep was open). Before it is saved, the regroup preview shows which
// meals move into the day the new wake starts, and which stay before it in the provisional day
// (spec.md > movedMeals powers it). Nothing disappears: every meal is in one of the two lists.
// Pure: no React, no storage, no clock reads (now is passed in).

import { combineDay } from '../kernel/estimate'
import { mealsForDay, wakesOf } from '../kernel/sleepday'
import type { Meal, SleepProblem, SleepRecord, SleepStatus } from '../kernel/types'
import { fromLocalInput } from './editMeal'
import { fmtClockMinutes, sleepSave } from './sleepView'

export type WakeDay = 'today' | 'yesterday'

/** The default wake time: 7:00 AM, on today's date once it has passed, otherwise yesterday's. */
export const DEFAULT_WAKE_TIME = '07:00'

/** DEFAULT_WAKE_TIME as the sheet shows it ("7:00 AM"). */
export function defaultWakeLabel(): string {
  const [h, m] = DEFAULT_WAKE_TIME.split(':').map(Number)
  return fmtClockMinutes(h * 60 + m)
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
  const [h, m] = DEFAULT_WAKE_TIME.split(':').map(Number)
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m ? 'today' : 'yesterday'
}

/** The picked day and time ("07:30") as a local-offset ISO string, or null when the time isn't one. */
export function wakeIso(nowIso: string, day: WakeDay, time: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null
  return fromLocalInput(`${wakeDates(nowIso)[day]}T${time}`)
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
    }
  | { ok: false; problem: SleepProblem }

/**
 * What saving `wake` as the first wake time would do. A time later than `nowIso` is rejected
 * (your own log), as are times that clash with a recorded sleep. On success `moving` and
 * `staying` together hold every meal that was in the provisional day.
 */
export function regroupForWake(
  meals: Meal[],
  sleeps: SleepRecord[],
  wake: string | null,
  nowIso: string,
  id?: string,
): Regroup {
  const res = sleepSave(sleeps, meals, 'wake', wake, nowIso, id)
  if (!res.ok) return res
  const moving = res.moved
  const staying = mealsForDay(meals, res.sleeps, null)
  return { ok: true, sleeps: res.sleeps, wake: res.record.wake as string, moving, staying }
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
