// Everything the dashboard and the explanation sheets read for one waking day,
// computed from the kernel in one place so every screen shows the same numbers.
// Build-out item 2.5a (slice 10): the day's workouts, burned and net come from here too, so
// every look draws the same net, eaten and burned (headlineView.ts says what the headline shows).

import { combineDay, improve, macroTotals } from '../kernel/estimate'
import { combine, combineBurned, type BurnedEstimate, type NetEstimate } from '../kernel/net'
import { mealsForDay, wakingDayStart, workoutsForDay } from '../kernel/sleepday'
import type { DayEstimate, Improvement, MacroKey, MacroTotal, Meal, Workout } from '../kernel/types'
import type { LogDoc } from '../store/log'

export interface DayView {
  /** The wake that started this waking day, or null for the provisional day ("Wake time not set"). */
  dayStart: string | null
  meals: Meal[]
  /** Calories eaten: the meals' estimate (the day's score is this one's). */
  day: DayEstimate
  macros: Record<MacroKey, MacroTotal>
  biggest: Meal | null
  /** What would improve the biggest contributor, or null when it already uses the best source. */
  improvement: Improvement | null
  /** The workouts that started on this waking day, in time order (slice 10). */
  workouts: Workout[]
  /** Calories burned in those workouts, with burned's own score and ranges. */
  burned: BurnedEstimate
  /** Eaten's absolute spread (sd), for the net explanation. */
  eatenSd: number
  /** Eaten minus burned, or null until both have a known total. */
  net: NetEstimate | null
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
  const workouts = workoutsForDay(doc.workouts, doc.sleeps, dayStart)
  const { burned, eatenSd, net } = combine(day, combineBurned(workouts))
  return {
    dayStart,
    meals,
    day,
    macros: macroTotals(meals),
    biggest,
    improvement: biggest ? improve(meals, biggest.id) : null,
    workouts,
    burned,
    eatenSd,
    net,
  }
}
