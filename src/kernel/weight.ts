// Weight (spec.md > Other Tier 3 Pieces: weight.ts; prd.md > Weight Log; build-out item 2.4).
// - Units: weights are stored in kg. A pound is exactly 0.45359237 kg (the international pound).
// - Days: a weigh-in belongs to the waking day it was taken in, by the meals' rule (sleepday.ts).
// - The 7-day average: the mean of the weigh-ins in the 7 days up to a moment, (asOf - 7 d, asOf].
//   Its label always says how many weigh-ins it holds.
// - The trend: the slope of a least-squares line through the weigh-ins of the last 21 days
//   (weight against time), given per week. Shown only with at least 6 weigh-ins in that window,
//   spread over at least 4 days first to last (6 weigh-ins in one morning would read normal
//   day-to-day noise as a steep weekly rate). 4, not 5 or 7: someone who weighs in each morning
//   gets the trend from the 6th weigh-in even when the times drift (6 mornings in a row span a
//   little under 5 days). Otherwise it says what it still needs. It describes the past, not a
//   prediction.
// Golden values for both come from scripts/golden.py (fixtures/golden-weight.json), worked out
// separately from this code. Pure: no React, no storage, no clock reads ("asOf" is passed in).

import { inWakingDay } from './sleepday'
import type { SleepRecord, WeighIn, WeightUnit } from './types'

/** kg in one pound, exactly (the international yard and pound agreement, 1959). */
export const LB_TO_KG = 0.45359237

/** The window of the average, in days. */
export const AVERAGE_DAYS = 7
/** The window of the trend line, in days, and the fewest weigh-ins it is drawn from. */
export const TREND_DAYS = 21
export const TREND_MIN = 6
/** The fewest days the trend's weigh-ins must span, first to last (daily weigh-ins qualify from the 6th). */
export const TREND_SPAN_DAYS = 4

const DAY_MS = 86_400_000

/** A weight typed in `unit`, in kg. */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * LB_TO_KG : value
}

/** A weight in kg, in `unit`. */
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg / LB_TO_KG : kg
}

function ms(iso: string): number {
  return Date.parse(iso)
}

/** Weigh-ins with a usable time and weight, oldest first. */
export function sortedWeighIns(weighIns: readonly WeighIn[]): WeighIn[] {
  return weighIns
    .filter((w) => !Number.isNaN(ms(w.at)) && Number.isFinite(w.kg) && w.kg > 0)
    .sort((a, b) => ms(a.at) - ms(b.at))
}

/** The weigh-ins taken in the waking day starting at dayStart (null: the provisional day), oldest first. */
export function weighInsForDay(weighIns: readonly WeighIn[], sleeps: SleepRecord[], dayStart: string | null): WeighIn[] {
  return inWakingDay(sortedWeighIns(weighIns), (w) => w.at, sleeps, dayStart)
}

/** The weigh-ins in (asOf - days, asOf], oldest first. */
export function weighInsWithin(weighIns: readonly WeighIn[], asOf: string, days: number): WeighIn[] {
  const end = ms(asOf)
  const start = end - days * DAY_MS
  return sortedWeighIns(weighIns).filter((w) => ms(w.at) > start && ms(w.at) <= end)
}

export interface WeightAverage {
  kg: number
  /** How many weigh-ins the average holds: the "5" in "average of 5 weigh-ins". */
  count: number
}

/** The mean of the weigh-ins in the `days` up to asOf; null when there are none. */
export function averageOver(weighIns: readonly WeighIn[], asOf: string, days: number = AVERAGE_DAYS): WeightAverage | null {
  const within = weighInsWithin(weighIns, asOf, days)
  if (within.length === 0) return null
  return { kg: within.reduce((sum, w) => sum + w.kg, 0) / within.length, count: within.length }
}

export type WeightTrend =
  /** kgPerWeek: the line's slope; negative is going down. */
  | { status: 'ok'; kgPerWeek: number; count: number }
  /** Too few weigh-ins in the window: `needed` more would show it. */
  | { status: 'needMore'; count: number; needed: number }
  /** Enough weigh-ins, but first to last they span under TREND_SPAN_DAYS (spanDays, as a fraction). */
  | { status: 'needSpan'; count: number; spanDays: number }

/**
 * The least-squares slope of weight (kg) against time (days) through the weigh-ins of the last
 * `days` up to asOf, times 7. Needs at least `min` weigh-ins spanning at least `spanDays` days.
 */
export function trendRate(
  weighIns: readonly WeighIn[],
  asOf: string,
  days: number = TREND_DAYS,
  min: number = TREND_MIN,
  minSpanDays: number = TREND_SPAN_DAYS,
): WeightTrend {
  const within = weighInsWithin(weighIns, asOf, days)
  const count = within.length
  if (count < min) return { status: 'needMore', count, needed: min - count }
  const t0 = ms(within[0].at)
  const spanDays = (ms(within[count - 1].at) - t0) / DAY_MS
  // Weigh-ins all at one moment (an import can bring them) have a span of 0 and land here too, so
  // no line is ever fitted through a single moment.
  if (spanDays < minSpanDays) return { status: 'needSpan', count, spanDays }
  const xs = within.map((w) => (ms(w.at) - t0) / DAY_MS)
  const ys = within.map((w) => w.kg)
  const mx = xs.reduce((a, b) => a + b, 0) / count
  const my = ys.reduce((a, b) => a + b, 0) / count
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < count; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
  }
  return { status: 'ok', kgPerWeek: (sxy / sxx) * 7, count }
}

export interface AveragePoint {
  id: string
  at: string
  kg: number
  count: number
}

/**
 * The 7-day average as of each weigh-in, oldest first: the chart's trend line. One pass with a
 * sliding window over the sorted list: each point is the mean of the weigh-ins in (at - days, at],
 * the same window as averageOver, where every weigh-in at the same moment as this one counts too.
 */
export function averageLine(weighIns: readonly WeighIn[], days: number = AVERAGE_DAYS): AveragePoint[] {
  const sorted = sortedWeighIns(weighIns)
  const times = sorted.map((w) => ms(w.at))
  const out: AveragePoint[] = []
  let lo = 0 // the first weigh-in inside the window
  let hi = 0 // one past the last weigh-in at or before this moment
  let sum = 0
  for (let i = 0; i < sorted.length; i++) {
    const end = times[i]
    while (hi < sorted.length && times[hi] <= end) sum += sorted[hi++].kg
    while (times[lo] <= end - days * DAY_MS) sum -= sorted[lo++].kg
    const count = hi - lo
    out.push({ id: sorted[i].id, at: sorted[i].at, kg: sum / count, count })
  }
  return out
}
