// Build-out item 2.4: everything the weight screens show for one viewed waking day, worked out once
// from the kernel (src/kernel/weight.ts), so the dashboard, the weight details and every look show
// the same numbers. Looks only choose how to draw them. Pure: no React, no storage.
//
// - The day's weigh-ins: those taken in the viewed waking day (the meals' rule).
// - "As of": now on the current day; on an earlier day, the moment that day ended (just before the
//   next wake), so an earlier day shows the latest weigh-in, the average, the trend and the chart as
//   they stood then, and the details say which day that is (asOfDay). Only the details' list of
//   every weigh-in runs past it. When that day ran on for days (no sleep logged in between), the
//   moment it ended is named (ranOnTo), so "the end of Wed Oct 21" never stands for Oct 31. The
//   provisional day (before the log's first wake) ends at that wake, and that moment is named too
//   (ranOnTo, with provisional true), never "the end of" the wake's date.
// - Weights are shown in the log's unit preference (settings.weightUnit), else the unit of the
//   latest weigh-in that has one, else kg.

import { nextWakeAfter, wakesOf, wakingDayStart } from '../kernel/sleepday'
import type { SleepRecord, WeighIn, WeightUnit } from '../kernel/types'
import {
  AVERAGE_DAYS,
  averageLine,
  averageOver,
  fromKg,
  sortedWeighIns,
  trendRate,
  weighInsForDay,
  weighInsWithin,
  type WeightAverage,
  type WeightTrend,
} from '../kernel/weight'
import type { LogDoc } from '../store/log'
import { copy } from './copy'
import { toLocalInput } from './editMeal'
import { fmtWeekdayDate, fmtWeekdayDateTime, fmtTime } from './format'

/** The chart's window, in days up to "as of". */
export const CHART_DAYS = 30

export interface WeightView {
  unit: WeightUnit
  /** The viewed day's weigh-ins up to asOf, oldest first. */
  day: WeighIn[]
  /** The latest of them, or null: "No weigh-in today". */
  latest: WeighIn | null
  /** The moment the latest weigh-in, the average, the trend and the chart are worked out at. */
  asOf: string
  /** The viewed day's date ("Tue Oct 20") when it is an earlier day; null on the current day. */
  asOfDay: string | null
  /** When an earlier day ran on past the morning after it started (no sleep logged in between), the
   *  moment it ended, the next wake ("Sat Oct 31, 7:00 AM"); for the provisional day (before the
   *  log's first wake, viewed once that wake has passed), the first wake; otherwise null. */
  ranOnTo: string | null
  /** True when the viewed day is the provisional day before the log's first wake, and it has ended. */
  provisional: boolean
  /** The newest weigh-in at or before asOf: the details' "Latest". */
  latestAsOf: WeighIn | null
  average: WeightAverage | null
  trend: WeightTrend
  /** Every weigh-in, newest first (the details list). */
  all: WeighIn[]
  /** The details chart, or null when the 30 days up to asOf hold fewer than 2 weigh-ins. */
  chart: WeightChart | null
  /** The same chart laid out `width` units wide, so it can be drawn at the width it is shown at
   *  (its labels then stay one size at every screen width). */
  chartAt: (width: number) => WeightChart | null
  /** The chart's title: "Last 30 days", or "30 days to the end of Tue Oct 20" on an earlier day. */
  chartTitle: string
}

export interface ChartPoint {
  id: string
  x: number
  y: number
}

export interface WeightChart {
  width: number
  height: number
  /** The plot area inside the axis labels. */
  plot: { left: number; right: number; top: number; bottom: number }
  points: ChartPoint[]
  /** The 7-day average as of each weigh-in, as an SVG polyline's points ("x,y x,y"). */
  line: string
  /** True when the line's first points also count weigh-ins from just before the window, which are
   *  not drawn as dots (so the caption can say why the line may start away from every dot). */
  lineCountsEarlier: boolean
  /** Axis labels, already formatted: the top and bottom of the weight scale with its unit, the first and last day. */
  yTop: string
  yBottom: string
  xStart: string
  xEnd: string
}

/** The unit weights are shown in. */
export function weightUnitOf(doc: Pick<LogDoc, 'settings' | 'weighIns'>): WeightUnit {
  const pref = doc.settings?.weightUnit
  if (pref === 'kg' || pref === 'lb') return pref
  const withUnit = sortedWeighIns(doc.weighIns ?? []).filter((w) => w.unit !== undefined)
  return withUnit[withUnit.length - 1]?.unit ?? 'kg'
}

/** The moment an earlier day ended (just before the next wake), or now for the current day. */
export function weightAsOf(sleeps: SleepRecord[], dayStart: string | null, nowIso: string): string {
  if (wakingDayStart(sleeps, nowIso) === dayStart) return nowIso
  const end = dayStart === null ? (wakesOf(sleeps)[0] ?? null) : nextWakeAfter(sleeps, dayStart)
  if (end === null) return nowIso
  const endMs = Math.min(Date.parse(end) - 1, Date.parse(nowIso))
  return new Date(endMs).toISOString()
}

export function buildWeightView(doc: LogDoc, dayStart: string | null, nowIso: string): WeightView {
  const weighIns = doc.weighIns ?? []
  const unit = weightUnitOf(doc)
  const asOf = weightAsOf(doc.sleeps, dayStart, nowIso)
  // Only weigh-ins up to "as of", like the average, the trend and the details' Latest: one timed
  // later than now on the current day (an import can bring one) waits until its time.
  const day = weighInsForDay(weighIns, doc.sleeps, dayStart).filter((w) => Date.parse(w.at) <= Date.parse(asOf))
  const current = wakingDayStart(doc.sleeps, nowIso) === dayStart
  const asOfDay = current ? null : fmtWeekdayDate(dayStart ?? asOf)
  const nextWake = current || dayStart === null ? null : nextWakeAfter(doc.sleeps, dayStart)
  // The provisional day ended at the first wake: name that moment, as the day's real end.
  const provisional = !current && dayStart === null
  const firstWake = provisional ? (wakesOf(doc.sleeps)[0] ?? null) : null
  const ranOnTo =
    firstWake !== null
      ? fmtWeekdayDateTime(firstWake)
      : nextWake !== null && dayStart !== null && calendarDaysBetween(dayStart, asOf) > 1
        ? fmtWeekdayDateTime(nextWake)
        : null
  const sorted = sortedWeighIns(weighIns)
  const upTo = sorted.filter((w) => Date.parse(w.at) <= Date.parse(asOf))
  const endLabel = ranOnTo !== null ? fmtWeekdayDate(asOf) : (asOfDay ?? fmtWeekdayDate(asOf))
  const chartAt = (width: number) => buildChart(sorted, asOf, unit, endLabel, width)
  return {
    unit,
    day,
    latest: day[day.length - 1] ?? null,
    asOf,
    asOfDay,
    ranOnTo,
    provisional: provisional && ranOnTo !== null,
    latestAsOf: upTo[upTo.length - 1] ?? null,
    average: averageOver(weighIns, asOf),
    trend: trendRate(weighIns, asOf),
    all: [...sorted].reverse(),
    chart: chartAt(CHART_WIDTH),
    chartAt,
    chartTitle:
      asOfDay === null ? copy.weight.chartTitle : ranOnTo !== null ? copy.weight.chartTitleToWhen(ranOnTo) : copy.weight.chartTitleTo(asOfDay),
  }
}

/** Local calendar dates from a to b: 1 from a Wednesday to the Thursday after it. */
function calendarDaysBetween(a: string, b: string): number {
  const date = (iso: string) => Date.parse(`${toLocalInput(iso).slice(0, 10)}T12:00:00Z`)
  return Math.round((date(b) - date(a)) / 86_400_000)
}

// ---------- words and numbers ----------

const oneDecimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: true })

/** A weight in kg as a number in `unit`, to one decimal: "78.4". */
export function fmtWeightNumber(kg: number, unit: WeightUnit): string {
  return oneDecimal.format(fromKg(kg, unit))
}

/** "78.4 kg". */
export function fmtWeight(kg: number, unit: WeightUnit): string {
  return copy.weight.value(fmtWeightNumber(kg, unit), copy.weight.unitName[unit])
}

/** "Thu Oct 22, 7:10 AM", or "Thu Oct 22, time not recorded" for an imported weigh-in with no time. */
export function fmtWeighInWhen(w: WeighIn): string {
  return copy.weight.when(fmtWeekdayDate(w.at), w.timeApproximate ? copy.weight.approxTime : fmtTime(w.at))
}

/** A trend that is shown, in words: "down 0.5 kg a week", "about level, under 0.1 kg a week". */
function rateText(trend: Extract<WeightTrend, { status: 'ok' }>, unit: WeightUnit): string {
  const perWeek = fromKg(trend.kgPerWeek, unit)
  const shown = oneDecimal.format(Math.abs(perWeek))
  const name = copy.weight.unitName[unit]
  if (shown === '0.0') return copy.weight.trendLevel(name)
  return perWeek < 0 ? copy.weight.trendDown(shown, name) : copy.weight.trendUp(shown, name)
}

/**
 * The trend's value and its note: "down 0.5 kg a week" / "from 9 weigh-ins in 21 days";
 * "4 more weigh-ins needed" / "shown from 6 weigh-ins in 21 days, over at least 4 days"; or, with enough weigh-ins over
 * too few days, "needs weigh-ins spread over 4 days" / "these 6 span under 3 days". `ok` is false unless the
 * value is a rate: a status sentence is then drawn in normal weight, never as a number.
 */
export function trendParts(trend: WeightTrend, unit: WeightUnit): { value: string; note: string; ok: boolean } {
  if (trend.status === 'needMore') return { value: copy.weight.trendNeedsMore(trend.needed), note: copy.weight.trendRule, ok: false }
  if (trend.status === 'needSpan')
    return { value: copy.weight.trendNeedsSpan, note: copy.weight.trendSpanNote(trend.count, trend.spanDays), ok: false }
  return { value: rateText(trend, unit), note: copy.weight.trendFrom(trend.count), ok: true }
}

/**
 * The 7-day average in words: "78.9 kg", with "average of 4 weigh-ins" as its note. With none in
 * the window, a status sentence instead (`ok` false): "No weigh-ins in the last 7 days" on the
 * current day, "... in the 7 days to the end of that day" on an earlier one, or, when that day ran
 * on for days, "... in the 7 days to Sat Oct 31, 7:00 AM, when that day ended" (ranOnTo).
 */
export function averageText(
  average: WeightAverage | null,
  unit: WeightUnit,
  current: boolean,
  ranOnTo: string | null = null,
): { value: string; note: string; ok: boolean } {
  if (average === null) {
    const value = current ? copy.weight.averageNone : ranOnTo !== null ? copy.weight.averageNoneTo(ranOnTo) : copy.weight.averageNoneThen
    return { value, note: '', ok: false }
  }
  return { value: fmtWeight(average.kg, unit), note: copy.weight.averageOf(average.count), ok: true }
}

// ---------- the chart ----------

/** The chart's default width (its viewBox units); the details redraw it at the width it is shown at. */
export const CHART_WIDTH = 320
const H = 150
const PLOT_LEFT = 62
const PLOT_RIGHT_GAP = 8

function buildChart(
  weighIns: readonly WeighIn[],
  asOf: string,
  unit: WeightUnit,
  endLabel: string,
  width: number,
): WeightChart | null {
  const W = Math.max(CHART_WIDTH / 2, Math.round(width))
  const PLOT = { left: PLOT_LEFT, right: W - PLOT_RIGHT_GAP, top: 10, bottom: 124 }
  const inWindow = weighInsWithin(weighIns, asOf, CHART_DAYS)
  if (inWindow.length < 2) return null
  const ids = new Set(inWindow.map((w) => w.id))
  // The average as of each weigh-in counts the ones before the window too.
  const avgIn = averageLine(weighIns).filter((p) => ids.has(p.id))
  const values = [...inWindow.map((w) => fromKg(w.kg, unit)), ...avgIn.map((p) => fromKg(p.kg, unit))]
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  // At least one unit of height, centred, so a flat run doesn't fill the chart with noise.
  if (hi - lo < 1) {
    const mid = (hi + lo) / 2
    lo = mid - 0.5
    hi = mid + 0.5
  }
  const pad = (hi - lo) * 0.1
  // Never below 0: a weight scale has no negative end, however far apart two weigh-ins are.
  lo = Math.max(0, lo - pad)
  hi += pad
  const end = Date.parse(asOf)
  const start = end - CHART_DAYS * 86_400_000
  const x = (iso: string) => PLOT.left + ((Date.parse(iso) - start) / (end - start)) * (PLOT.right - PLOT.left)
  const y = (kg: number) => PLOT.bottom - ((fromKg(kg, unit) - lo) / (hi - lo)) * (PLOT.bottom - PLOT.top)
  const r = (n: number) => Math.round(n * 10) / 10
  return {
    width: W,
    height: H,
    plot: PLOT,
    points: inWindow.map((w) => ({ id: w.id, x: r(x(w.at)), y: r(y(w.kg)) })),
    line: avgIn.map((p) => `${r(x(p.at))},${r(y(p.kg))}`).join(' '),
    lineCountsEarlier: weighIns.some((w) => {
      const t = Date.parse(w.at)
      return t <= start && t > Date.parse(inWindow[0].at) - AVERAGE_DAYS * 86_400_000
    }),
    yTop: copy.weight.value(oneDecimal.format(hi), copy.weight.unitName[unit]),
    yBottom: copy.weight.value(oneDecimal.format(lo), copy.weight.unitName[unit]),
    xStart: fmtWeekdayDate(new Date(start).toISOString()),
    xEnd: endLabel,
  }
}
