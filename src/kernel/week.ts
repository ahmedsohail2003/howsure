// The week summary (spec.md > Maths Core: Week Summary; prd.md > Week View; checklist slice 8,
// build-out item 2.7). Covers the waking days ending at the viewed day, up to seven.
//
// - A day's calories are `logged` (every meal known), `incomplete` (some meal unknown: its known
//   meals only) or `notLogged` (no meals). Unknown is never 0: an incomplete day is left out of
//   an average and counted, never treated as 0.
// - The calorie average is over complete days only. Every meal across those N days is grouped by
//   source, spreads add straight within a source and sources combine as the root of the sum of
//   squares (sd_total). Then avg = X_total / N, sd_avg = sd_total / N, e_avg = sd_avg / avg, and
//   the ranges take the day's lognormal shape. Photo bias doesn't "average out" across the week;
//   treating days as independent would understate the spread (golden G10 tells them apart).
// - Burned in workouts uses the same rule over the days whose workouts are all known; a day with
//   meals and no workouts counts 0 burned (as net and the balance count it), a day with nothing
//   logged is left out.
// - Net (eaten − burned) and the estimated deficit or surplus have normal ranges, like a day's.
//   Their spreads use the same grouping across the week, and the balance's everyday-burn spreads
//   add straight across days, because one equation for one person leans the same way every day.
// - Averages of things counted per day (macros, workout minutes, a day's Estimate score) leave out
//   any day where a value is unknown and say how many were left out.
// - Sleep: the night before each day (the record whose wake starts it). Length, sleep time and
//   wake time are averaged over complete nights only, the times as circular means (sleepday.ts),
//   like the dashboard's 7-night average, so 23:50 and 00:10 average to 00:00, not noon.
// Pure: no React, no storage, no clock reads.

import { isKnownMeal, mealError, rangeFromE, scoreFromE, combineDay, Z80, Z95 } from './estimate'
import { combineBurned, isKnownWorkout, normalRange, workoutError } from './net'
import { circularMeanMinutes, minutesOfDay, nightOf } from './sleepday'
import type { KnownMeal, KnownWorkout, MacroKey, Meal, Night, Range, SleepRecord, Workout } from './types'

/** How many waking days a week holds. */
export const WEEK_DAYS = 7

export type WeekDayStatus = 'logged' | 'incomplete' | 'notLogged'

/** One waking day's entries, as the week reads them. */
export interface WeekDayInput {
  meals: Meal[]
  workouts: Workout[]
}

/** A day's calories by its meals: every one known, some unknown, or none logged. */
export function weekDayStatus(meals: Meal[]): WeekDayStatus {
  if (meals.length === 0) return 'notLogged'
  return meals.every(isKnownMeal) ? 'logged' : 'incomplete'
}

/** A day with anything logged on it that the week's food and workout rows read (a meal or a workout). */
export function isLoggedDay(d: WeekDayInput): boolean {
  return d.meals.length > 0 || d.workouts.length > 0
}

/** Same-source spreads added straight, the source groups combined as the root of the sum of squares. */
export function groupedSd<T>(items: readonly T[], sourceOf: (item: T) => string, sdOf: (item: T) => number): number {
  const bySource = new Map<string, number>()
  for (const it of items) bySource.set(sourceOf(it), (bySource.get(sourceOf(it)) ?? 0) + sdOf(it))
  let sq = 0
  for (const sd of bySource.values()) sq += sd * sd
  return Math.sqrt(sq)
}

/** The spread of known meals taken together: grouped by source across every day given. */
export function mealsSd(meals: readonly KnownMeal[]): number {
  return groupedSd(meals, (m) => m.source, (m) => m.kcal * mealError(m))
}

/** The spread of known workouts taken together: grouped by burn source across every day given. */
export function workoutsSd(workouts: readonly KnownWorkout[]): number {
  return groupedSd(workouts, (w) => w.source, (w) => w.kcal * workoutError(w))
}

/** How a week average counts its days: the "5" and the "(1 incomplete left out)". */
export interface DayCounts {
  /** Days that count toward the average. */
  counted: number
  /** Days with something logged but a value unknown: left out and counted in the label. */
  leftOut: number
  /** Days with nothing logged for this value. */
  notLogged: number
}

/** A lognormal average like the day's (calories eaten, burned): never below 0. */
export interface LognormalAverage extends DayCounts {
  /** The known total over the counted days. */
  total: number
  /** total / counted, or null when no day counts. */
  average: number | null
  /** sd_total / counted. */
  sd: number | null
  /** sd / average; null when the average is 0 or there is none. */
  e: number | null
  score: number | null
  likely: Range | null
  veryLikely: Range | null
}

function lognormal(counts: DayCounts, total: number, sdTotal: number): LognormalAverage {
  const n = counts.counted
  if (n === 0) return { ...counts, total, average: null, sd: null, e: null, score: null, likely: null, veryLikely: null }
  const average = total / n
  const sd = sdTotal / n
  if (average <= 0) return { ...counts, total, average, sd, e: null, score: null, likely: null, veryLikely: null }
  const e = sd / average
  return { ...counts, total, average, sd, e, score: scoreFromE(e), likely: rangeFromE(average, e, Z80), veryLikely: rangeFromE(average, e, Z95) }
}

/**
 * The calorie average (spec.md > Week Summary, golden G10): complete days only, the week's meals
 * grouped by source, avg = X_total / N and sd_avg = sd_total / N, with the day's lognormal ranges.
 */
export function calorieAverage(days: readonly Meal[][]): LognormalAverage {
  const complete = days.filter((m) => weekDayStatus(m) === 'logged')
  const counts: DayCounts = {
    counted: complete.length,
    leftOut: days.filter((m) => weekDayStatus(m) === 'incomplete').length,
    notLogged: days.filter((m) => weekDayStatus(m) === 'notLogged').length,
  }
  const meals = complete.flat().filter(isKnownMeal)
  return lognormal(counts, meals.reduce((s, m) => s + m.kcal, 0), mealsSd(meals))
}

/**
 * The days-independent spread, for comparison only (golden G10): each day's own spread, the days
 * combined as if their errors were unrelated. The week never uses it; it would understate the spread.
 */
export function daysIndependentE(days: readonly Meal[][]): number | null {
  const complete = days.filter((m) => weekDayStatus(m) === 'logged')
  if (complete.length === 0) return null
  const total = complete.flat().filter(isKnownMeal).reduce((s, m) => s + m.kcal, 0)
  if (total <= 0) return null
  const sq = complete.reduce((s, m) => s + mealsSd(m.filter(isKnownMeal)) ** 2, 0)
  return Math.sqrt(sq) / total
}

/** A plain mean of per-day values, with its counts. */
export interface MeanAverage extends DayCounts {
  average: number | null
}

function mean(values: number[], counts: DayCounts): MeanAverage {
  return { ...counts, average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null }
}

/**
 * A macro's average (spec.md > Week Summary): a day counts when every meal has that macro; a day
 * with any meal missing it is left out and counted; a day with no meals is not logged.
 */
export function macroAverage(days: readonly Meal[][], key: MacroKey): MeanAverage {
  const values: number[] = []
  let leftOut = 0
  let notLogged = 0
  for (const meals of days) {
    if (meals.length === 0) notLogged += 1
    else if (meals.some((m) => m[key] === null || m[key] === undefined)) leftOut += 1
    else values.push(meals.reduce((s, m) => s + (m[key] as number), 0))
  }
  return mean(values, { counted: values.length, leftOut, notLogged })
}

/** A score average's counts: `leftOut` splits into incomplete days and complete days with no score. */
export interface ScoreAverage extends MeanAverage {
  /** Days left out because a value was unknown (an unknown meal or workout). */
  incomplete: number
  /** Complete days left out because there was nothing above 0 kcal to score. */
  unscored: number
}

/**
 * The average of the days' Estimate scores: complete days with known calories above 0 count (a
 * day's score covers all of its meals only then). An incomplete day is left out and counted; so
 * is a complete day with no calories above 0, which has no score (counted apart, as `unscored`).
 */
export function scoreAverage(days: readonly Meal[][]): ScoreAverage {
  const values: number[] = []
  let incomplete = 0
  let unscored = 0
  let notLogged = 0
  for (const meals of days) {
    const status = weekDayStatus(meals)
    const score = status === 'logged' ? combineDay(meals).score : null
    if (status === 'notLogged') notLogged += 1
    else if (status === 'incomplete') incomplete += 1
    else if (score === null) unscored += 1
    else values.push(score)
  }
  return { ...mean(values, { counted: values.length, leftOut: incomplete + unscored, notLogged }), incomplete, unscored }
}

/**
 * The average of the days' burned Estimate scores (the score beside burned in the workout list):
 * days whose workouts all have known calories above 0 count. A day with a workout of unknown
 * calories is left out (`incomplete`); a day with known workouts of 0 kcal has no score
 * (`unscored`). A day with no workouts has nothing to score: it is in neither count (`notLogged`).
 */
export function burnedScoreAverage(days: readonly Workout[][]): ScoreAverage {
  const values: number[] = []
  let incomplete = 0
  let unscored = 0
  let notLogged = 0
  for (const workouts of days) {
    if (workouts.length === 0) notLogged += 1
    else if (!workoutsKnown(workouts)) incomplete += 1
    else {
      const score = combineBurned(workouts).score
      if (score === null) unscored += 1
      else values.push(score)
    }
  }
  return { ...mean(values, { counted: values.length, leftOut: incomplete + unscored, notLogged }), incomplete, unscored }
}

/** Workouts all known (or none): the day's burned is known. */
function workoutsKnown(workouts: readonly Workout[]): boolean {
  return workouts.every(isKnownWorkout)
}

/**
 * Burned in workouts, per day on average: days with anything logged whose workouts all have known
 * calories count (no workouts counts 0); a day with a workout of unknown calories is left out and
 * counted. Lognormal like a day's burned, grouped by burn source across the week.
 */
export function burnedAverage(days: readonly WeekDayInput[]): LognormalAverage {
  const counted = days.filter((d) => isLoggedDay(d) && workoutsKnown(d.workouts))
  const counts: DayCounts = {
    counted: counted.length,
    leftOut: days.filter((d) => isLoggedDay(d) && !workoutsKnown(d.workouts)).length,
    notLogged: days.filter((d) => !isLoggedDay(d)).length,
  }
  const workouts = counted.flatMap((d) => d.workouts).filter(isKnownWorkout)
  return lognormal(counts, workouts.reduce((s, w) => s + w.kcal, 0), workoutsSd(workouts))
}

/** An average that can run below 0 (net, the deficit or surplus), with normal ranges. */
export interface SignedAverage extends DayCounts {
  total: number
  average: number | null
  sd: number | null
  likely: Range | null
  veryLikely: Range | null
}

function normal(counts: DayCounts, total: number, sdTotal: number): SignedAverage {
  const n = counts.counted
  if (n === 0) return { ...counts, total, average: null, sd: null, likely: null, veryLikely: null }
  const average = total / n
  const sd = sdTotal / n
  return { ...counts, total, average, sd, likely: normalRange(average, sd, Z80), veryLikely: normalRange(average, sd, Z95) }
}

/** A day whose net is known: every meal known (at least one) and every workout known (or none). */
export function netKnown(d: WeekDayInput): boolean {
  return weekDayStatus(d.meals) === 'logged' && workoutsKnown(d.workouts)
}

/**
 * Net calories, per day on average: eaten − burned over the days where both are known (a day with
 * no workouts burns 0 in workouts). A day with an unknown meal or workout, or with workouts but
 * no meals, is left out and counted. sd = √(sd_meals² + sd_workouts²) / N, each side grouped by
 * source across the week; normal ranges.
 */
export function netAverage(days: readonly WeekDayInput[]): SignedAverage {
  const counted = days.filter(netKnown)
  const counts: DayCounts = {
    counted: counted.length,
    leftOut: days.filter((d) => isLoggedDay(d) && !netKnown(d)).length,
    notLogged: days.filter((d) => !isLoggedDay(d)).length,
  }
  const meals = counted.flatMap((d) => d.meals).filter(isKnownMeal)
  const workouts = counted.flatMap((d) => d.workouts).filter(isKnownWorkout)
  const total = meals.reduce((s, m) => s + m.kcal, 0) - workouts.reduce((s, w) => s + w.kcal, 0)
  return normal(counts, total, Math.sqrt(mealsSd(meals) ** 2 + workoutsSd(workouts) ** 2))
}

/** One day's estimated deficit or surplus, as the week adds it up (energy.ts estimateBalance). */
export interface BalanceDay {
  /** The day's known meals and workouts. */
  meals: KnownMeal[]
  workouts: KnownWorkout[]
  /** Everyday burn over the hours counted, and its spread. */
  everyday: number
  everydaySd: number
}

/**
 * The estimated deficit or surplus, per day on average, over the days that have one with every
 * entry known (null: none that day, or `leftOut` when its meals or workouts were partly unknown).
 * Balance = Σ eaten − Σ (everyday + workouts), over N days. The spread groups meals and workouts by
 * source across the week, and adds the everyday-burn spreads straight, since the same equation for
 * the same person leans the same way every day: sd = √(sd_meals² + sd_workouts² + (Σ sd_everyday)²) / N.
 */
export function balanceAverage(days: readonly (BalanceDay | 'leftOut' | null)[]): SignedAverage {
  const counted = days.filter((d): d is BalanceDay => d !== null && d !== 'leftOut')
  const counts: DayCounts = {
    counted: counted.length,
    leftOut: days.filter((d) => d === 'leftOut').length,
    notLogged: days.filter((d) => d === null).length,
  }
  const meals = counted.flatMap((d) => d.meals)
  const workouts = counted.flatMap((d) => d.workouts)
  const everyday = counted.reduce((s, d) => s + d.everyday, 0)
  const everydaySd = counted.reduce((s, d) => s + d.everydaySd, 0)
  const total = meals.reduce((s, m) => s + m.kcal, 0) - everyday - workouts.reduce((s, w) => s + w.kcal, 0)
  return normal(counts, total, Math.sqrt(mealsSd(meals) ** 2 + workoutsSd(workouts) ** 2 + everydaySd ** 2))
}

/**
 * Workout time per day on average: days with anything logged whose workouts all have a known
 * duration count (no workouts counts 0 minutes); a workout of unknown duration leaves its day out.
 */
export function minutesAverage(days: readonly WeekDayInput[]): MeanAverage {
  const values: number[] = []
  let leftOut = 0
  let notLogged = 0
  for (const d of days) {
    if (!isLoggedDay(d)) notLogged += 1
    else if (d.workouts.some((w) => w.minutes === null)) leftOut += 1
    else values.push(d.workouts.reduce((s, w) => s + (w.minutes as number), 0))
  }
  return mean(values, { counted: values.length, leftOut, notLogged })
}

/**
 * The night before a waking day: the record whose wake starts it, as nightStats reads a night
 * (sleepday.ts nightOf: null minutes, "not logged", when its sleep start is missing). Null for the
 * provisional day, which no wake starts, and for a day whose night is not in the log.
 */
export function nightBefore(sleeps: readonly SleepRecord[], dayStart: string | null): Night | null {
  if (dayStart === null) return null
  const r = sleeps.find((s) => s.wake === dayStart)
  return r ? nightOf(r) : null
}

export interface WeekSleep {
  /** Nights with a length, and the days in the week (the "6 of 7 nights"). */
  complete: number
  total: number
  avgMinutes: number | null
  /** Circular means over complete nights, 0..1439; null with none, or too spread out to average. */
  avgWakeMinutes: number | null
  wakeVaries: boolean
  avgSleepMinutes: number | null
  sleepVaries: boolean
}

/** The week's sleep from the night before each day (null: no night, as before the first wake). */
export function weekSleep(nights: readonly (Night | null)[]): WeekSleep {
  const complete = nights.filter((n): n is Night & { minutes: number; sleepStart: string; wake: string } => n !== null && n.minutes !== null)
  const lengths = complete.map((n) => n.minutes)
  const wakes = complete.map((n) => minutesOfDay(n.wake))
  const starts = complete.map((n) => minutesOfDay(n.sleepStart))
  const avgWake = circularMeanMinutes(wakes)
  const avgSleep = circularMeanMinutes(starts)
  return {
    complete: complete.length,
    total: nights.length,
    avgMinutes: lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null,
    avgWakeMinutes: avgWake,
    wakeVaries: wakes.length > 0 && avgWake === null,
    avgSleepMinutes: avgSleep,
    sleepVaries: starts.length > 0 && avgSleep === null,
  }
}

/**
 * summarise(): the week's calories (with each day's status), macros, scores, burned (and its
 * score), net and workout time, from the days oldest first. Net is always given (no day counts
 * when the week has no meals). Sleep, weight and the deficit or surplus are worked out by their own
 * functions above, since they read the sleep records, weigh-ins and body details.
 */
export interface WeekSummary {
  statuses: WeekDayStatus[]
  calories: LognormalAverage
  score: ScoreAverage
  macros: Record<MacroKey, MeanAverage>
  burned: LognormalAverage
  burnedScore: ScoreAverage
  net: SignedAverage
  minutes: MeanAverage
}

export function summarise(days: readonly WeekDayInput[]): WeekSummary {
  const meals = days.map((d) => d.meals)
  return {
    statuses: meals.map(weekDayStatus),
    calories: calorieAverage(meals),
    score: scoreAverage(meals),
    macros: { protein: macroAverage(meals, 'protein'), carbs: macroAverage(meals, 'carbs'), fat: macroAverage(meals, 'fat') },
    burned: burnedAverage(days),
    burnedScore: burnedScoreAverage(days.map((d) => d.workouts)),
    net: netAverage(days),
    minutes: minutesAverage(days),
  }
}

/** The mean of some numbers (weights, body fat), or null with none. */
export function meanOf(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null
}
