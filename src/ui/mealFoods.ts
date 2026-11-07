// Build-out item 2.9: the foods stored on a meal (meals.foods, spec.md > Data Model), and its
// lookup (meals.lookup), as the meal details list them. Both were saved before (the demo's meals
// list their foods; a saved barcode lookup keeps how much was eaten) but shown nowhere. A food here
// is a part of the meal with its amount: it has no calories or macros of its own, so the meal's
// totals stay the ones it was saved with, from its own source. Pure: no React.

import type { Meal, MealFood, MealLookup, MealSourceId } from '../kernel/types'
import { copy } from './copy'
import { fmtAmount, fmtDatedWhen } from './format'
import { mealSourceLabel } from './mealLabels'

export interface FoodRow {
  name: string
  /** "6 oz", "120 g", "1 serving", "2 servings". */
  amount: string
  /** "fiber 2.5 g per 100 g", when the food carries it. */
  fiber: string | null
}

export function foodAmount(f: MealFood): string {
  const n = fmtAmount(f.amount)
  return f.unit === 'serving' ? copy.foods.servings(n) : copy.foods.amount(n, f.unit)
}

export function foodRows(meal: Meal): FoodRow[] {
  return (meal.foods ?? []).map((f) => ({
    name: f.name,
    amount: foodAmount(f),
    fiber: typeof f.fiberPer100 === 'number' ? copy.foods.fiber(fmtAmount(f.fiberPer100)) : null,
  }))
}

/**
 * The lookup's parts in words: "Barcode lookup", "saved result", "whole package", then when it was
 * fetched ("fetched Tue Oct 20", with the year when it is not the meal's). Shown joined by " · ".
 */
export function lookupParts(lookup: MealLookup, mealAt: string): string[] {
  const parts: string[] = [copy.foods.lookupKind[lookup.kind]]
  if (lookup.saved) parts.push(copy.foods.lookupSaved)
  const grams = lookup.amount.grams
  const amount = copy.foods.lookupAmount[lookup.amount.kind]
  parts.push(typeof grams === 'number' ? `${amount} (${copy.foods.lookupGrams(fmtAmount(grams))})` : amount)
  if (lookup.fetchedAt && !Number.isNaN(Date.parse(lookup.fetchedAt))) parts.push(copy.foods.lookupFetched(fmtDatedWhen(lookup.fetchedAt, mealAt, false)))
  return parts
}

/** The source whose values a lookup gives: a barcode lookup a looked-up label, a food search a database entry. */
const LOOKUP_SOURCE: Record<MealLookup['kind'], MealSourceId> = { barcode: 'label_lookup', foodSearch: 'food_db' }

export interface LookupView {
  parts: string[]
  credit: string | null
  /**
   * Null while the meal's values come from the lookup. An edit keeps the stored lookup when "How do
   * you know?" changes, so once the meal's source is another one this says the lookup is not used
   * now, and from what the values come instead: the details never claim a lookup the meal no longer uses.
   */
  unused: string | null
}

export function lookupView(meal: Pick<Meal, 'lookup' | 'source' | 'eatenAt'>): LookupView | null {
  const { lookup } = meal
  if (!lookup) return null
  const unused =
    meal.source === LOOKUP_SOURCE[lookup.kind]
      ? null
      : meal.source === null
        ? copy.foods.lookupUnusedNoSource
        : // Imported data can pair a lookup with the other lookup's source (a food search on a
          // looked-up label): say the two do not match, rather than "not from this lookup" beside
          // a source that is itself looked up.
          meal.source === LOOKUP_SOURCE.barcode || meal.source === LOOKUP_SOURCE.foodSearch
          ? copy.foods.lookupMismatch(mealSourceLabel(meal.source), copy.foods.lookupKindLower[lookup.kind])
          : copy.foods.lookupUnused(mealSourceLabel(meal.source))
  return { parts: lookupParts(lookup, meal.eatenAt), credit: lookup.credit ? copy.foods.lookupCredit(lookup.credit) : null, unused }
}
