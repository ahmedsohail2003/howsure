// Per-meal and per-day estimates (spec.md > Maths Core: Estimates, Ranges and the Day).
// Same-source spreads add straight; source groups combine as the root of the sum of squares.
// Pure: no React, no storage, no clock reads.

import { SOURCES, bestMealSource } from './sources'
import type {
  Contribution,
  DayEstimate,
  Improvement,
  ItemEstimate,
  KnownMeal,
  MacroKey,
  MealLookup,
  MacroTotal,
  Meal,
  MealSourceId,
  Range,
} from './types'

export const Z80 = 1.2816
export const Z95 = 1.96

const TIE_EPS = 1e-12

/** Round half up, the same as Python's math.floor(x + 0.5). */
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5)
}

/** clamp(round-half-up(100 * (1 - e)), 0, 100) */
export function scoreFromE(e: number): number {
  const s = roundHalfUp(100 * (1 - e))
  return Math.min(100, Math.max(0, s))
}

/** Lognormal range [x / (1+e)^z, x * (1+e)^z], unrounded (display with Math.round). */
export function rangeFromE(x: number, e: number, z: number): Range {
  const f = Math.pow(1 + e, z)
  return { lo: x / f, hi: x * f }
}

/**
 * A meal's typical error as a fraction. A looked-up label with an estimated
 * portion combines the lookup's error with Description's in quadrature
 * (spec.md > Sources Table, looked-up amounts): sqrt(0.12^2 + 0.41^2) = 42.72%.
 */
export function mealError(meal: { source: MealSourceId | null; lookup?: MealLookup }): number {
  // A meal with no source picked has no typical error; the day's maths only sees known meals.
  if (meal.source === null) throw new Error('mealError: the meal has no source picked')
  const base = SOURCES[meal.source].typicalError
  if (meal.source === 'label_lookup' && meal.lookup?.amount?.kind === 'portion') {
    const d = SOURCES.description.typicalError
    return Math.sqrt(base * base + d * d)
  }
  return base
}

/**
 * Known calories and a picked source: the meals the day's maths counts. A meal with blank
 * calories (and so possibly no source) is unknown: it is listed under Missing information and
 * gets no invented uncertainty (prd.md > Days With Unknown Calories).
 */
export function isKnownMeal(meal: Meal): meal is KnownMeal {
  return meal.kcal !== null && meal.source !== null
}

/** null when the meal's calories are unknown. */
export function estimateMeal(meal: Meal): ItemEstimate | null {
  if (!isKnownMeal(meal)) return null
  const x = meal.kcal
  const e = mealError(meal)
  return {
    e,
    sd: x * e,
    score: scoreFromE(e),
    likely: rangeFromE(x, e, Z80),
    veryLikely: rangeFromE(x, e, Z95),
  }
}

function timeOf(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

/** Biggest share first; ties go to larger kcal, then earlier eatenAt, then lower id. */
function compareContributions(
  a: { share: number; kcal: number; at: number; id: string },
  b: { share: number; kcal: number; at: number; id: string },
): number {
  if (Math.abs(a.share - b.share) > TIE_EPS) return b.share - a.share
  if (a.kcal !== b.kcal) return b.kcal - a.kcal
  if (a.at !== b.at) return a.at - b.at
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function combineDay(meals: Meal[]): DayEstimate {
  const known = meals.filter(isKnownMeal)
  const unknownMealIds = meals.filter((m) => !isKnownMeal(m)).map((m) => m.id)

  const status: DayEstimate['status'] =
    meals.length === 0
      ? 'empty'
      : known.length === 0
        ? 'all-unknown'
        : unknownMealIds.length > 0
          ? 'partial'
          : 'complete'

  const knownTotal = known.reduce((s, m) => s + m.kcal, 0)

  // 1. Group known meals by source; spreads add straight within a group.
  const bySource = new Map<MealSourceId, { sd: number; mealIds: string[] }>()
  const sdOf = new Map<string, number>()
  for (const m of known) {
    const sd = m.kcal * mealError(m)
    sdOf.set(m.id, sd)
    const g = bySource.get(m.source) ?? { sd: 0, mealIds: [] }
    g.sd += sd
    g.mealIds.push(m.id)
    bySource.set(m.source, g)
  }
  const order = Object.keys(SOURCES)
  const groups = [...bySource.entries()]
    .map(([source, g]) => ({ source, sd: g.sd, mealIds: g.mealIds }))
    .sort((a, b) =>
      Math.abs(a.sd - b.sd) > TIE_EPS ? b.sd - a.sd : order.indexOf(a.source) - order.indexOf(b.source),
    )

  // 2. Combine groups as the root of the sum of squares.
  const sdDaySq = groups.reduce((s, g) => s + g.sd * g.sd, 0)
  const sdDay = Math.sqrt(sdDaySq)

  // 3. e_day = sd_day / X; "Not available yet" (null) when X is 0.
  let e: number | null = null
  let score: number | null = null
  let likely: Range | null = null
  let veryLikely: Range | null = null
  if (knownTotal > 0) {
    e = sdDay / knownTotal
    score = scoreFromE(e)
    likely = rangeFromE(knownTotal, e, Z80)
    veryLikely = rangeFromE(knownTotal, e, Z95)
  }

  // Shares of sd_day^2: a group's sd_g^2 split in proportion to each meal's sd_i.
  let contributions: Contribution[] = []
  if (sdDaySq > 0) {
    const ranked = known.map((m) => {
      const g = bySource.get(m.source)!
      const sdI = sdOf.get(m.id)!
      const share = g.sd > 0 ? (g.sd * sdI) / sdDaySq : 0
      return { m, sdI, share }
    })
    ranked.sort((a, b) =>
      compareContributions(
        { share: a.share, kcal: a.m.kcal, at: timeOf(a.m.eatenAt), id: a.m.id },
        { share: b.share, kcal: b.m.kcal, at: timeOf(b.m.eatenAt), id: b.m.id },
      ),
    )
    contributions = ranked.map(({ m, sdI, share }) => ({
      mealId: m.id,
      source: m.source,
      sd: sdI,
      share,
    }))
  }

  return {
    status,
    knownTotal,
    mealCount: meals.length,
    unknownMealIds,
    e,
    score,
    likely,
    veryLikely,
    groups,
    contributions,
    biggestMealId: contributions.length > 0 ? contributions[0].mealId : null,
  }
}

/**
 * The source improve() would suggest for a meal, or null when none is better. A meal with no
 * source picked has no typical error to beat, so nothing is suggested (its calories come first).
 */
export function suggestedSource(meal: Pick<Meal, 'source' | 'lookup'>): MealSourceId | null {
  if (meal.source === null) return null
  const current = mealError(meal)
  if (SOURCES.label.typicalError < current) return 'label'
  const best = bestMealSource()
  if (SOURCES[best].typicalError < current) return best
  return null
}

/** The day's meals with one meal switched to another source (same calories). */
export function applySource(meals: Meal[], mealId: string, to: MealSourceId): Meal[] {
  return meals.map((m) => (m.id === mealId ? { ...m, source: to } : m))
}

/**
 * "What would improve it": label if its error is lower than the meal's,
 * otherwise bestSource if lower, otherwise null. Computed, never hard-coded.
 */
export function improve(meals: Meal[], mealId: string): Improvement | null {
  const meal = meals.find((m) => m.id === mealId)
  if (!meal) return null
  const to = suggestedSource(meal)
  if (to === null) return null
  return {
    mealId,
    to,
    newMealE: SOURCES[to].typicalError,
    newDayScore: combineDay(applySource(meals, mealId, to)).score,
  }
}

const MACROS: readonly MacroKey[] = ['protein', 'carbs', 'fat']

/** Known totals per macro. A blank (null) is counted as missing, never as 0. */
export function macroTotals(meals: Meal[]): Record<MacroKey, MacroTotal> {
  const out = {} as Record<MacroKey, MacroTotal>
  for (const k of MACROS) {
    let known = 0
    let missing = 0
    for (const m of meals) {
      const v = m[k]
      if (v === null || v === undefined) missing += 1
      else known += v
    }
    out[k] = { known, missing, allUnknown: meals.length > 0 && missing === meals.length }
  }
  return out
}
