// A meal's time and source in words, shared by the meal list, the Night timeline, the meal details
// and the macro detail (build-out item 2.9). Pure: no React.

import { getSource } from '../kernel/sources'
import type { Meal, MealSourceId } from '../kernel/types'
import { copy } from './copy'
import { fmtTime, fmtWeekdayTime, onLaterDate } from './format'

/** The meal's time, with its weekday when it falls on a later calendar date than the day's wake. */
export function mealTimeLabel(meal: Meal, dayStart: string | null): string {
  if (onLaterDate(meal.eatenAt, dayStart)) return fmtWeekdayTime(meal.eatenAt)
  return fmtTime(meal.eatenAt)
}

/** The source's label, or "source not picked" for a meal saved with blank calories and no source. */
export function mealSourceLabel(source: MealSourceId | null): string {
  return source === null ? copy.meals.sourceNotPicked : getSource(source).label
}
