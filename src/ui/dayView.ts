// Everything the dashboard and the explanation sheets read for one waking day,
// computed from the kernel in one place so every screen shows the same numbers.

import { combineDay, improve, macroTotals } from '../kernel/estimate'
import { mealsForDay, wakingDayStart } from '../kernel/sleepday'
import type { DayEstimate, Improvement, MacroKey, MacroTotal, Meal } from '../kernel/types'
import type { LogDoc } from '../store/log'

export interface DayView {
  /** The wake that started this waking day, or null for the provisional day ("Wake time not set"). */
  dayStart: string | null
  meals: Meal[]
  day: DayEstimate
  macros: Record<MacroKey, MacroTotal>
  biggest: Meal | null
  /** What would improve the biggest contributor, or null when it already uses the best source. */
  improvement: Improvement | null
}

/** The waking day that contains `atIso` (the active log's now, or a time inside a viewed day). */
export function buildDayView(doc: LogDoc, atIso: string): DayView {
  return buildDayViewFor(doc, wakingDayStart(doc.sleeps, atIso))
}

/** The waking day starting at `dayStart` (null = the provisional day). */
export function buildDayViewFor(doc: LogDoc, dayStart: string | null): DayView {
  const meals = mealsForDay(doc.meals, doc.sleeps, dayStart)
  const day = combineDay(meals)
  const biggest = day.biggestMealId ? (meals.find((m) => m.id === day.biggestMealId) ?? null) : null
  return {
    dayStart,
    meals,
    day,
    macros: macroTotals(meals),
    biggest,
    improvement: biggest ? improve(meals, biggest.id) : null,
  }
}
