// Moving between waking days (prd.md > Previous Days): the list of days for previous/next, the
// date picker's mapping from a calendar date to a waking day, and a time inside a viewed day for
// code that takes an "at". Pure: no React, no storage.

import { toLocalIso } from '../clock'
import { mealsForDay, wakingDays, wakingDayStart } from '../kernel/sleepday'
import type { LogDoc } from '../store/log'
import { fromLocalInput, toLocalInput } from './editMeal'

/**
 * A time inside the waking day `dayStart`, for code that takes an "at" (the edit preview): now on
 * the current day, the day's own wake on an earlier day, and just before the first wake for the
 * provisional day when wakes exist.
 */
export function anchorFor(doc: LogDoc, dayStart: string | null, nowIso: string): string {
  if (wakingDayStart(doc.sleeps, nowIso) === dayStart) return nowIso
  if (dayStart !== null) return dayStart
  const first = wakingDays([], doc.sleeps)[0]
  return first ? toLocalIso(Date.parse(first) - 1000) : nowIso
}

/** previous/next (prd.md > Previous Days): every waking day up to the current one, and where the viewed one sits. */
export interface DayNav {
  days: (string | null)[]
  index: number
  current: string | null
}

export function dayNav(doc: LogDoc, viewed: string | null, nowIso: string): DayNav {
  const current = wakingDayStart(doc.sleeps, nowIso)
  // A workout or weigh-in (item 2.4) before the first wake keeps the provisional day in the list,
  // as a meal does.
  const timed = [
    ...doc.meals,
    ...doc.workouts.map((w) => ({ eatenAt: w.startedAt })),
    ...(doc.weighIns ?? []).map((w) => ({ eatenAt: w.at })),
  ]
  const days = wakingDays(timed, doc.sleeps, nowIso)
  if (!days.includes(current)) days.push(current)
  const index = days.indexOf(viewed)
  return { days, index: index === -1 ? days.indexOf(current) : index, current }
}

/** "YYYY-MM-DD" of a waking day for the date picker: its wake's date, or for the provisional day its first meal's (else now's). */
export function dateOfDay(doc: LogDoc, dayStart: string | null, nowIso: string): string {
  const first = dayStart === null ? mealsForDay(doc.meals, doc.sleeps, null)[0]?.eatenAt : undefined
  return toLocalInput(dayStart ?? first ?? nowIso).slice(0, 10)
}

/**
 * The date picker: the waking day that is running at the end of the picked date (so a date with a
 * wake on it opens that day), never past the current day, and the first day for an earlier date.
 */
export function dayForDate(doc: LogDoc, date: string, nowIso: string): string | null {
  const nav = dayNav(doc, null, nowIso)
  const end = fromLocalInput(`${date}T23:59`)
  if (end === null) return nav.current
  if (Date.parse(end) >= Date.parse(nowIso)) return nav.current
  const start = wakingDayStart(doc.sleeps, end)
  return nav.days.includes(start) ? start : (nav.days[0] ?? null)
}

/**
 * Build-out item 2.1b: the waking day that holds the log's latest meal, offered on an empty day
 * when that day is more than one day back (an imported log whose latest nights hold no meals, or
 * days with nothing logged), so the meals are one tap away. Undefined when the viewed day has
 * meals, the log has none, or the latest meal's day is the viewed one, the day just before it (an
 * ordinary morning shouldn't point at yesterday) or any later day (on an earlier day the link would
 * name a meal logged after the day on screen). `at` names the day: its wake, or the meal's
 * own time for the day before the first wake.
 */
export function latestMealElsewhere(
  doc: LogDoc,
  days: (string | null)[],
  viewed: string | null,
  viewedEmpty: boolean,
): { day: string | null; at: string } | undefined {
  if (!viewedEmpty || doc.meals.length === 0) return undefined
  let latest = doc.meals[0]
  for (const m of doc.meals) if (Date.parse(m.eatenAt) > Date.parse(latest.eatenAt)) latest = m
  const day = wakingDayStart(doc.sleeps, latest.eatenAt)
  const at = days.indexOf(day)
  const here = days.indexOf(viewed)
  // Only a day before the viewed one: on an earlier day, a later meal is not "the last meal logged"
  // as of that day.
  if (at === -1 || here === -1 || here - at <= 1) return undefined
  return { day, at: day ?? latest.eatenAt }
}
