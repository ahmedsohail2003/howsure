// Build-out item 2.9: a macro's detail, opened from the macro row in every look (Journal's row,
// Panel's tiles, the macros under Night's chip). What it shows is worked out here once:
// - the day's known total, or "unknown" when no meal has a value, never 0; a day with no meals says
//   no meals are logged (never "0 g", and nothing to compare with the target);
// - how many meals have no value, and that the total is then a floor ("at least");
// - that there is no range yet (ranges cover calories only, spec.md > Maths Core: Sources Table);
// - the target, with the share only when it means something (a known total; "at least" while
//   some meals have no value);
// - each meal's own value with its time and how you know it, and its share of the known total.
// Pure: no React, no storage.

import { macroTotals } from '../kernel/estimate'
import type { MacroKey, MacroTotal, Meal } from '../kernel/types'
import type { Profile } from '../store/log'
import { copy } from './copy'
import { fmtAmount, fmtInt, fmtSharePct } from './format'
import { mealSourceLabel, mealTimeLabel } from './mealLabels'
import { ringFill } from './targetRing'

export const MACRO_ORDER: readonly MacroKey[] = ['protein', 'carbs', 'fat']

export interface MacroMealRow {
  mealId: string
  name: string
  /** "1:50 PM · Nutrition label": when, and how you know it. */
  meta: string
  grams: number | null
  /** "20 g", or "no value". */
  valueText: string
  /** Its share of the known total ("16%"), or null with no value or a 0 g total. */
  shareText: string | null
  label: string
}

export interface MacroView {
  key: MacroKey
  name: string
  total: MacroTotal
  /** True when the day has no meals: nothing is logged, so there is no total (never "0 g"). */
  noMeals: boolean
  /** "124 g", "unknown" when no meal has a value, or "No meals logged" on a day with none. */
  valueText: string
  /** "Shown on the dashboard as 37 g, rounded to the gram." when the dashboard's whole grams differ; else null. */
  roundedText: string | null
  /** True when the total adds up every meal (none is missing a value). */
  complete: boolean
  /** The line under the total: what is missing and what that means; null when nothing is. */
  missingText: string | null
  rangeText: string
  unknownsText: string
  target: number | undefined
  /** "130 g" (under "Daily target"), or "No protein target set." */
  targetText: string
  /** The total against the target, or null when there is no target. */
  targetShareText: string | null
  rows: MacroMealRow[]
}

/** The detail for one macro on one waking day (the day's meals, in the order the day lists them). */
export function buildMacroView(meals: Meal[], key: MacroKey, targets: Profile['targets'] | undefined, dayStart: string | null): MacroView {
  const total = macroTotals(meals)[key]
  const noMeals = meals.length === 0
  const name = copy.macros[key]
  const lower = name.toLowerCase()
  // To a tenth, as the meals' own values are entered (37.4 g); the dashboard row rounds to whole
  // grams, so the sheet says so when the two differ.
  const known = fmtAmount(Math.round(total.known * 10) / 10)
  const whole = fmtInt(total.known)
  const roundedText = noMeals || total.allUnknown || whole === known ? null : copy.macroDetail.rounded(copy.units.gramsValue(whole))
  const valueText = noMeals ? copy.macroDetail.noMeals : total.allUnknown ? copy.macros.unknown : copy.units.gramsValue(known)
  const complete = !noMeals && !total.allUnknown && total.missing === 0
  const missingText = noMeals
    ? null
    : total.allUnknown
    ? copy.macroDetail.allUnknown(lower)
    : total.missing > 0
      ? copy.macroDetail.missingLine(total.missing, lower, copy.units.gramsValue(known))
      : null
  const target = targets?.[key]
  const fill = noMeals || total.allUnknown ? null : ringFill(total.known, target)
  const targetShareText =
    target === undefined
      ? null
      : noMeals
        ? copy.macroDetail.targetNoMeals
        : total.allUnknown
          ? copy.macroDetail.targetUnknown
          : fill === null
            ? null
            : complete
              ? copy.macroDetail.targetShare(fmtInt(fill.pct))
              : copy.macroDetail.targetShareKnownOnly(fmtInt(fill.pct))
  const rows = meals.map((m): MacroMealRow => {
    const grams = m[key]
    const meta = copy.meals.meta(mealTimeLabel(m, dayStart), mealSourceLabel(m.source))
    const valueText = grams === null ? copy.macroDetail.noValue : copy.units.gramsValue(fmtAmount(grams))
    const pct = grams === null || !(total.known > 0) ? null : fmtSharePct(grams / total.known)
    return {
      mealId: m.id,
      name: m.name,
      meta,
      grams,
      valueText,
      shareText: pct === null ? null : copy.macroDetail.share(pct),
      label: copy.macroDetail.rowLabel(m.name, meta, pct === null ? valueText : `${valueText}, ${copy.macroDetail.shareSpoken(pct)}`),
    }
  })
  return {
    key,
    name,
    total,
    noMeals,
    valueText,
    roundedText,
    complete,
    missingText,
    rangeText: copy.macroDetail.noRange,
    unknownsText: copy.macroDetail.unknownsHow(lower),
    target,
    targetText: target === undefined ? copy.macroDetail.noTarget(lower) : copy.macroDetail.target(fmtAmount(target)),
    targetShareText,
    rows,
  }
}

/** The macro on the dashboard: its shown value and the accessible name of the button that opens it. */
export function macroOpenLabel(key: MacroKey, total: MacroTotal): string {
  const value = total.allUnknown ? copy.macros.unknown : copy.units.gramsValue(fmtInt(total.known))
  const missing = !total.allUnknown && total.missing > 0 ? `, ${copy.macros.missing(total.missing)}` : ''
  return copy.macroDetail.openLabel(copy.macros[key], `${value}${missing}`)
}
