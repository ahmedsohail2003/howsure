// The Night look's timeline of one waking day (build-out item 1.5.2c): the points it draws, in
// order. It starts at the wake ("Woke up", with last night's length), lists each meal at its time,
// and ends with now (the current day, awake), the sleep start of a night with no wake yet (the
// current day, asleep), or the sleep start of the night that closed an earlier day. Points are
// spaced by order, not to scale, so a long day stays readable and nothing overlaps.
//
// Everything here is read from the shared view-models (dayView.ts, sleepView.ts), so the numbers
// are the ones every look shows. Pure: no React.
//
// Seam for the 3-day and 4-day timeline (build-out item 2.8): that view draws this list once per
// waking day, side by side; nothing here assumes a single day on screen.

import type { Meal } from '../kernel/types'
import type { DayView } from './dayView'
import { onLaterDate } from './format'
import type { SleepView } from './sleepView'

export type TimelinePoint =
  | { kind: 'wake'; at: string; sleptMinutes: number | null }
  /** The provisional day: no wake is recorded before it. */
  | { kind: 'noWake' }
  /** `laterDate`: eaten after midnight, on a later calendar date than the wake. */
  | { kind: 'meal'; meal: Meal; laterDate: boolean; biggest: boolean }
  /** No meals logged yet on this day. */
  | { kind: 'empty' }
  | { kind: 'now'; at: string }
  | { kind: 'asleep'; since: string; laterDate: boolean }
  /** `at` null: the sleep start of the night that closed the day was not logged. */
  | { kind: 'sleep'; at: string | null; laterDate: boolean }

export function timelinePoints(view: DayView, sleep: SleepView, nowIso: string): TimelinePoint[] {
  const { dayStart } = view
  const points: TimelinePoint[] = [
    dayStart === null ? { kind: 'noWake' } : { kind: 'wake', at: dayStart, sleptMinutes: sleep.lastNight?.minutes ?? null },
  ]
  if (view.meals.length === 0) points.push({ kind: 'empty' })
  for (const meal of view.meals) {
    points.push({ kind: 'meal', meal, laterDate: onLaterDate(meal.eatenAt, dayStart), biggest: meal.id === view.biggest?.id })
  }
  const end = sleep.dayEnd
  if (end.kind === 'awake') points.push({ kind: 'now', at: nowIso })
  else if (end.kind === 'asleep') points.push({ kind: 'asleep', since: end.since, laterDate: onLaterDate(end.since, dayStart) })
  else points.push({ kind: 'sleep', at: end.sleepStart, laterDate: end.sleepStart !== null && onLaterDate(end.sleepStart, dayStart) })
  return points
}
