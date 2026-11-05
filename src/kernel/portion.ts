// A meal eaten in a different amount (build-out item 2.3: repeat a usual meal at x0.5, x1.5, x2
// or a typed multiplier). Calories, macros and the listed food amounts scale with the amount;
// the source does not change, so the meal's typical error stays the same fraction and its spread
// (sd = x * e) and both ranges scale with the calories, through estimateMeal as for any meal.
// Eating twice the amount from one source counts the same as logging that meal twice: same-source
// spreads add straight in combineDay. Unknown stays unknown (null), never 0.
// Pure: no React, no storage, no clock reads.

import type { MealFood, MealLookup } from './types'

/** The parts of a meal an amount change touches. Everything else is kept as it is. */
export interface ScalableAmounts {
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  foods?: MealFood[]
  lookup?: MealLookup
}

/** The largest multiplier accepted: past this, a new meal with its own values says more. */
export const MAX_FACTOR = 10

/**
 * The smallest multiplier accepted: a tenth of the usual amount. Below it the scaled calories round
 * to nothing on screen, and a new meal with its own values says more.
 */
export const MIN_FACTOR = 0.1

/** True for a multiplier from MIN_FACTOR to MAX_FACTOR. */
export function isFactor(factor: number): boolean {
  return Number.isFinite(factor) && factor >= MIN_FACTOR && factor <= MAX_FACTOR
}

/** A scaled amount rounded to one decimal, so 0.1 x 3 is stored as 0.3, not 0.30000000000000004. */
function scaled(v: number, factor: number): number {
  return Math.round(v * factor * 10) / 10
}

function scaleOrUnknown(v: number | null, factor: number): number | null {
  return v === null ? null : scaled(v, factor)
}

/**
 * A copy of the meal's values at `factor` times the amount. x1 returns an unchanged copy, so a
 * repeat at the usual amount stores exactly the values it was logged with. Throws on a factor that
 * isFactor() refuses: the screen never offers one.
 */
export function scaleAmounts<T extends ScalableAmounts>(meal: T, factor: number): T {
  if (!isFactor(factor)) throw new RangeError(`scaleAmounts: factor ${factor} is out of range`)
  const out = structuredClone(meal)
  if (factor === 1) return out
  out.kcal = scaleOrUnknown(meal.kcal, factor)
  out.protein = scaleOrUnknown(meal.protein, factor)
  out.carbs = scaleOrUnknown(meal.carbs, factor)
  out.fat = scaleOrUnknown(meal.fat, factor)
  if (out.foods) out.foods = out.foods.map((f) => ({ ...f, amount: scaled(f.amount, factor) }))
  const grams = out.lookup?.amount.grams
  if (out.lookup && typeof grams === 'number') {
    out.lookup = { ...out.lookup, amount: { ...out.lookup.amount, grams: scaled(grams, factor) } }
  }
  return out
}
