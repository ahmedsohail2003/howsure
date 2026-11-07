// A meal's time and source in words, shared by the meal list, the Night timeline, the meal details
// and the macro detail (build-out item 2.9). Pure: no React.

import { getSource } from '../kernel/sources'
import type { Meal, MealSourceId } from '../kernel/types'
import { copy } from './copy'
import { fmtTime, fmtWeekdayTime, onLaterDate } from './format'

/**
 * The meal's time, with its weekday when it falls on a later calendar date than the day's wake,
 * and "about" before a time HowSure placed rather than one that was recorded (build-out item 2.1b).
 */
export function mealTimeLabel(meal: Meal, dayStart: string | null): string {
  const time = onLaterDate(meal.eatenAt, dayStart) ? fmtWeekdayTime(meal.eatenAt) : fmtTime(meal.eatenAt)
  return meal.timeApproximate ? copy.trackerImport.timeAbout(time) : time
}

/** The source's label, or "source not picked" for a meal saved with blank calories and no source. */
export function mealSourceLabel(source: MealSourceId | null): string {
  return source === null ? copy.meals.sourceNotPicked : getSource(source).label
}
