// The Night look's timeline of one waking day (build-out item 1.5.2c): the points it draws, in
// order. It starts at the wake ("Woke up", with last night's length), lists each meal at its time,
// and ends with now (the current day, awake), the sleep start of a night with no wake yet (the
// current day, asleep), or the sleep start of the night that closed an earlier day. Points are
// spaced by order, not to scale, so a long day stays readable and nothing overlaps.
//
// Everything here is read from the shared view-models (dayView.ts, sleepView.ts), so the numbers
// are the ones every look shows. Pure: no React.
//
// Build-out item 2.5a: the day's workouts sit among the meals at their start times.
//
// Seam for the 3-day and 4-day timeline (build-out item 2.8): that view draws this list once per
// waking day, side by side; nothing here assumes a single day on screen.

import type { Meal, Workout } from '../kernel/types'
import type { DayView } from './dayView'
import { onLaterDate } from './format'
import { staleWakeDays } from './wakeSet'
import type { SleepView } from './sleepView'

// Build-out item 2.2: the wake, asleep and sleep points carry the record they show (`recordId`),
// so tapping one opens that night in the sleep and wake editor.
export type TimelinePoint =
  | { kind: 'wake'; at: string; sleptMinutes: number | null; recordId: string | null }
  /** The provisional day: no wake is recorded before it. */
  | { kind: 'noWake' }
  /** `laterDate`: eaten after midnight, on a later calendar date than the wake. */
  | { kind: 'meal'; meal: Meal; laterDate: boolean; biggest: boolean }
  /** Build-out item 2.5a: a workout at its start time, among the meals. */
  | { kind: 'workout'; workout: Workout; laterDate: boolean }
  /** No meals logged yet on this day. */
  | { kind: 'empty' }
  /**
   * `laterDate`: the wake is more than a day before now (an imported log, or nights not added yet;
   * build-out item 2.1b), so now's time carries its weekday.
   */
  | { kind: 'now'; at: string; laterDate: boolean }
  | { kind: 'asleep'; since: string; laterDate: boolean; recordId: string }
  /** `at` null: the sleep start of the night that closed the day was not logged. */
  | { kind: 'sleep'; at: string | null; laterDate: boolean; recordId: string }

export function timelinePoints(view: DayView, sleep: SleepView, nowIso: string): TimelinePoint[] {
  const { dayStart } = view
  const points: TimelinePoint[] = [
    dayStart === null
      ? { kind: 'noWake' }
      : { kind: 'wake', at: dayStart, sleptMinutes: sleep.lastNight?.minutes ?? null, recordId: sleep.dayRecordId },
  ]
  if (view.meals.length === 0) points.push({ kind: 'empty' })
  // Meals and workouts in time order; at the same minute a meal comes first.
  const items: (TimelinePoint & { kind: 'meal' | 'workout' })[] = [
    ...view.meals.map((meal) => ({
      kind: 'meal' as const,
      meal,
      laterDate: onLaterDate(meal.eatenAt, dayStart),
      biggest: meal.id === view.biggest?.id,
    })),
    ...view.workouts.map((workout) => ({ kind: 'workout' as const, workout, laterDate: onLaterDate(workout.startedAt, dayStart) })),
  ]
  const at = (p: (typeof items)[number]) => Date.parse(p.kind === 'meal' ? p.meal.eatenAt : p.workout.startedAt)
  items.sort((a, b) => at(a) - at(b) || (a.kind === b.kind ? 0 : a.kind === 'meal' ? -1 : 1))
  points.push(...items)
  const end = sleep.dayEnd
  // Stale or not is decided once, by the rule the header uses (wakeSet.ts > staleWakeDays).
  if (end.kind === 'awake') points.push({ kind: 'now', at: nowIso, laterDate: staleWakeDays(dayStart, nowIso, sleep.status) !== null })
  else if (end.kind === 'asleep') {
    points.push({ kind: 'asleep', since: end.since, laterDate: onLaterDate(end.since, dayStart), recordId: end.recordId })
  } else {
    const laterDate = end.sleepStart !== null && onLaterDate(end.sleepStart, dayStart)
    points.push({ kind: 'sleep', at: end.sleepStart, laterDate, recordId: end.recordId })
  }
  return points
}
