// estimate.ts behaviour beyond the golden table: statuses, "Not available yet",
// shares and tie-breaks, the improve rule, the looked-up-amount rule, and macro totals.
import { describe, expect, it } from 'vitest'
import {
  Z80,
  Z95,
  combineDay,
  estimateMeal,
  improve,
  macroTotals,
  mealError,
  rangeFromE,
  scoreFromE,
  suggestedSource,
} from '../estimate'
import { MEAL_SOURCE_IDS } from '../sources'
import type { MealSourceId } from '../types'
import { meal } from './helpers'

describe('constants and helpers', () => {
  it('z values', () => {
    expect(Z80).toBe(1.2816)
    expect(Z95).toBe(1.96)
  })

  it('score rounds half up and clamps to 0..100', () => {
    expect(scoreFromE(0.1)).toBe(90)
    expect(scoreFromE(0.165)).toBe(Math.floor(100 * (1 - 0.165) + 0.5))
    expect(scoreFromE(0.125)).toBe(88) // 87.5 rounds up
    expect(scoreFromE(0)).toBe(100)
    expect(scoreFromE(1.7)).toBe(0)
  })

  it('ranges are lognormal and never below 0', () => {
    const r = rangeFromE(1000, 0.46, Z95)
    expect(r.lo).toBeGreaterThan(0)
    expect(r.lo * r.hi).toBeCloseTo(1000 * 1000, 6)
    expect(rangeFromE(0, 0.46, Z80)).toEqual({ lo: 0, hi: 0 })
  })
})

describe('estimateMeal', () => {
  it('is null when calories are unknown', () => {
    expect(estimateMeal(meal('photo', null))).toBeNull()
  })

  it('a photo estimate has wider ranges than a label of the same calories', () => {
    const p = estimateMeal(meal('photo', 600))!
    const l = estimateMeal(meal('label', 600))!
    expect(p.likely.hi - p.likely.lo).toBeGreaterThan(l.likely.hi - l.likely.lo)
    expect(p.veryLikely.hi - p.veryLikely.lo).toBeGreaterThan(p.likely.hi - p.likely.lo)
    expect(p.score).toBe(54)
    expect(l.score).toBe(90)
  })

  it('a looked-up label uses 12% for a whole package and 42.72% for an estimated portion', () => {
    const pkg = meal('label_lookup', 200, { lookup: { kind: 'barcode', amount: { kind: 'package' } } })
    const portion = meal('label_lookup', 200, { lookup: { kind: 'barcode', amount: { kind: 'portion', grams: 80 } } })
    expect(mealError(pkg)).toBeCloseTo(0.12, 12)
    expect(mealError(portion) * 100).toBeCloseTo(42.72, 2)
    expect(combineDay([portion]).groups[0].source).toBe('label_lookup')
  })
})

describe('combineDay statuses', () => {
  it('empty: no meals', () => {
    const d = combineDay([])
    expect(d.status).toBe('empty')
    expect(d.mealCount).toBe(0)
    expect(d.e).toBeNull()
    expect(d.score).toBeNull()
    expect(d.likely).toBeNull()
    expect(d.veryLikely).toBeNull()
    expect(d.biggestMealId).toBeNull()
  })

  it('all-unknown: "Not available yet" (nulls), meals still counted, never 0 kcal pretended', () => {
    const a = meal('photo', null)
    const b = meal('description', null)
    const d = combineDay([a, b])
    expect(d.status).toBe('all-unknown')
    expect(d.mealCount).toBe(2)
    expect(d.unknownMealIds).toEqual([a.id, b.id])
    expect(d.e).toBeNull()
    expect(d.score).toBeNull()
    expect(d.likely).toBeNull()
    expect(d.contributions).toEqual([])
    expect(d.biggestMealId).toBeNull()
  })

  it('partial: known meals only, unknown meals get no contribution', () => {
    const known = meal('label', 500)
    const unknown = meal('photo', null)
    const d = combineDay([known, unknown])
    expect(d.status).toBe('partial')
    expect(d.knownTotal).toBe(500)
    expect(d.unknownMealIds).toEqual([unknown.id])
    expect(d.score).toBe(90)
    expect(d.contributions.map((c) => c.mealId)).toEqual([known.id])
    expect(d.biggestMealId).toBe(known.id)
  })

  it('complete with a typed 0 kcal meal: the 0 is known, not unknown', () => {
    const d = combineDay([meal('label', 500), meal('label', 0)])
    expect(d.status).toBe('complete')
    expect(d.unknownMealIds).toEqual([])
  })

  it('a known total of 0 kcal is "Not available yet" with no division by zero', () => {
    const d = combineDay([meal('label', 0)])
    expect(d.status).toBe('complete')
    expect(d.knownTotal).toBe(0)
    expect(d.e).toBeNull()
    expect(d.score).toBeNull()
    expect(d.likely).toBeNull()
    expect(d.biggestMealId).toBeNull()
  })
})

describe('contributions', () => {
  it('shares split each group by its spreads and sum to 1', () => {
    const d = combineDay([meal('photo', 1000), meal('label', 100), meal('label', 300), meal('menu', 200)])
    const sum = d.contributions.reduce((s, c) => s + c.share, 0)
    expect(sum).toBeCloseTo(1, 12)
    const sdDaySq = d.groups.reduce((s, g) => s + g.sd * g.sd, 0)
    const label = d.groups.find((g) => g.source === 'label')!
    const l300 = d.contributions.find((c) => c.sd === 30)!
    expect(l300.share).toBeCloseTo((label.sd * 30) / sdDaySq, 12)
    for (let i = 1; i < d.contributions.length; i++) {
      expect(d.contributions[i - 1].share).toBeGreaterThanOrEqual(d.contributions[i].share)
    }
  })

  it('groups are biggest first and list their meals', () => {
    const p = meal('photo', 500)
    const l = meal('label', 300)
    const d = combineDay([l, p])
    expect(d.groups.map((g) => g.source)).toEqual(['photo', 'label'])
    expect(d.groups[0].mealIds).toEqual([p.id])
  })

  it('equal shares: the larger kcal wins', () => {
    // photo 100 kcal (sd 46) and weighed 575 kcal (sd 46) in separate groups
    const small = meal('photo', 100, { eatenAt: '2026-10-21T08:00:00-04:00' })
    const big = meal('weighed', 575, { eatenAt: '2026-10-21T20:00:00-04:00' })
    expect(combineDay([small, big]).biggestMealId).toBe(big.id)
  })

  it('equal shares and kcal at the same time: the lower id wins', () => {
    const at = '2026-10-21T12:00:00-04:00'
    const d = combineDay([meal('menu', 300, { id: 'zz', eatenAt: at }), meal('menu', 300, { id: 'aa', eatenAt: at })])
    expect(d.biggestMealId).toBe('aa')
  })
})

describe('improve rule (computed from sources.ts)', () => {
  const expected: Record<MealSourceId, MealSourceId | null> = {
    photo: 'label',
    description: 'label',
    menu: 'label',
    food_db: 'label',
    label_lookup: 'label',
    label: 'weighed',
    weighed: null,
  }
  it.each(MEAL_SOURCE_IDS.map((s) => [s, expected[s]] as const))('%s -> %s', (source, to) => {
    expect(suggestedSource({ source })).toBe(to)
    const m = meal(source, 400)
    const imp = improve([m], m.id)
    if (to === null) expect(imp).toBeNull()
    else {
      expect(imp!.to).toBe(to)
      expect(imp!.mealId).toBe(m.id)
    }
  })

  it('an unknown meal id gives null', () => {
    expect(improve([meal('photo', 300)], 'nope')).toBeNull()
  })

  it('a meal with unknown calories can still be pointed at a better source; the day score is unchanged', () => {
    const known = meal('label', 500)
    const unknown = meal('photo', null)
    const imp = improve([known, unknown], unknown.id)
    expect(imp!.to).toBe('label')
    expect(imp!.newDayScore).toBe(combineDay([known, unknown]).score)
  })
})

describe('macroTotals: blank is unknown, never 0', () => {
  it('sums known values and counts blanks as missing', () => {
    const t = macroTotals([
      meal('label', 400, { protein: 20, carbs: 50, fat: null }),
      meal('photo', 600, { protein: null, carbs: 70, fat: null }),
      meal('menu', 300, { protein: 15, carbs: null, fat: null }),
    ])
    expect(t.protein).toEqual({ known: 35, missing: 1, allUnknown: false })
    expect(t.carbs).toEqual({ known: 120, missing: 1, allUnknown: false })
    expect(t.fat).toEqual({ known: 0, missing: 3, allUnknown: true })
  })

  it('a typed 0 is known, not missing', () => {
    const t = macroTotals([meal('label', 100, { protein: 0, carbs: 0, fat: 0 })])
    expect(t.protein).toEqual({ known: 0, missing: 0, allUnknown: false })
  })

  it('a day with meals and no values for a macro is allUnknown (shown as "unknown")', () => {
    const t = macroTotals([meal('photo', 500), meal('photo', null)])
    for (const k of ['protein', 'carbs', 'fat'] as const) {
      expect(t[k].allUnknown).toBe(true)
      expect(t[k].missing).toBe(2)
    }
  })

  it('an empty day is not allUnknown', () => {
    const t = macroTotals([])
    expect(t.protein).toEqual({ known: 0, missing: 0, allUnknown: false })
  })
})
