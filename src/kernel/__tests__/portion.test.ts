// Build-out item 2.3: a repeat at another amount (kernel/portion.ts). Expected values are worked
// out by hand from spec.md's formulas: sd = x * e, likely = [x / (1+e)^1.2816, x * (1+e)^1.2816].
import { describe, expect, it } from 'vitest'
import { combineDay, estimateMeal, Z80 } from '../estimate'
import { isFactor, MAX_FACTOR, MIN_FACTOR, scaleAmounts } from '../portion'
import type { Meal } from '../types'

const PORRIDGE: Meal = {
  id: 'p1',
  name: 'Porridge with banana',
  eatenAt: '2026-10-16T13:45:00-04:00',
  source: 'weighed',
  kcal: 380,
  protein: 12,
  carbs: 66,
  fat: 7,
  foods: [
    { name: 'Oats', amount: 50, unit: 'g' },
    { name: 'Banana', amount: 1, unit: 'serving' },
  ],
}

describe('scaleAmounts', () => {
  it('x1 returns an equal copy, never the same object', () => {
    const out = scaleAmounts(PORRIDGE, 1)
    expect(out).toStrictEqual(PORRIDGE)
    expect(out).not.toBe(PORRIDGE)
    expect(out.foods).not.toBe(PORRIDGE.foods)
  })

  it('scales calories, macros and food amounts, and keeps the source, name and time', () => {
    const out = scaleAmounts(PORRIDGE, 1.5)
    expect(out).toMatchObject({ kcal: 570, protein: 18, carbs: 99, fat: 10.5, source: 'weighed', name: PORRIDGE.name })
    expect(out.eatenAt).toBe(PORRIDGE.eatenAt)
    expect(out.foods).toEqual([
      { name: 'Oats', amount: 75, unit: 'g' },
      { name: 'Banana', amount: 1.5, unit: 'serving' },
    ])
    expect(scaleAmounts(PORRIDGE, 0.5)).toMatchObject({ kcal: 190, protein: 6, carbs: 33, fat: 3.5 })
  })

  it('rounds to one decimal, so float noise never reaches the log', () => {
    expect(scaleAmounts({ ...PORRIDGE, kcal: 333, fat: 0.1 }, 3)).toMatchObject({ kcal: 999, fat: 0.3 })
    expect(scaleAmounts({ ...PORRIDGE, kcal: 333 }, 1.25).kcal).toBe(416.3)
  })

  it('keeps unknown as unknown (null), never 0', () => {
    const out = scaleAmounts({ ...PORRIDGE, kcal: null, source: null, protein: null, carbs: 20, fat: null }, 2)
    expect(out).toMatchObject({ kcal: null, protein: null, carbs: 40, fat: null, source: null })
  })

  it('scales a looked-up amount in grams, and leaves an unknown one alone', () => {
    const bar: Meal = {
      ...PORRIDGE,
      foods: undefined,
      source: 'label_lookup',
      kcal: 190,
      lookup: { kind: 'barcode', amount: { kind: 'package', grams: 40 } },
    }
    expect(scaleAmounts(bar, 2).lookup).toEqual({ kind: 'barcode', amount: { kind: 'package', grams: 80 } })
    const unknownGrams = { ...bar, lookup: { kind: 'barcode' as const, amount: { kind: 'portion' as const, grams: null } } }
    expect(scaleAmounts(unknownGrams, 2).lookup).toEqual(unknownGrams.lookup)
  })

  it('refuses a multiplier of 0, below a tenth, above the limit or not a number', () => {
    for (const f of [0, 0.001, 0.05, MIN_FACTOR - 0.001, -1, MAX_FACTOR + 0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isFactor(f)).toBe(false)
      expect(() => scaleAmounts(PORRIDGE, f)).toThrow(RangeError)
    }
    expect(isFactor(0.1)).toBe(true)
    expect(isFactor(MIN_FACTOR)).toBe(true)
    expect(isFactor(MAX_FACTOR)).toBe(true)
  })
})

describe('the uncertainty scales with the amount, through the kernel', () => {
  it('keeps the typical error as the same fraction, and scales the spread and both ranges', () => {
    const one = estimateMeal(PORRIDGE)!
    const two = estimateMeal(scaleAmounts(PORRIDGE, 2))!
    expect(two.e).toBe(one.e)
    expect(two.score).toBe(one.score)
    expect(two.sd).toBeCloseTo(2 * one.sd, 9)
    expect(two.likely.lo).toBeCloseTo(2 * one.likely.lo, 9)
    expect(two.likely.hi).toBeCloseTo(2 * one.likely.hi, 9)
    expect(two.veryLikely.hi).toBeCloseTo(2 * one.veryLikely.hi, 9)
    // By hand: 760 kcal weighed (8%): likely 760 / 1.08^1.2816 to 760 * 1.08^1.2816.
    expect(two.likely.lo).toBeCloseTo(760 / 1.08 ** Z80, 9)
    expect(Math.round(two.likely.lo)).toBe(689)
    expect(Math.round(two.likely.hi)).toBe(839)
  })

  it('a looked-up label with an estimated portion keeps its combined error at any amount', () => {
    const bar: Meal = { ...PORRIDGE, source: 'label_lookup', kcal: 190, lookup: { kind: 'barcode', amount: { kind: 'portion' } } }
    expect(estimateMeal(scaleAmounts(bar, 1.5))!.e).toBeCloseTo(Math.sqrt(0.12 ** 2 + 0.41 ** 2), 12)
  })

  it('one meal at x2 counts the same in the day as logging it twice (same-source spreads add)', () => {
    const twice = combineDay([PORRIDGE, { ...PORRIDGE, id: 'p2' }])
    const double = combineDay([{ ...scaleAmounts(PORRIDGE, 2), id: 'p3' }])
    expect(double.knownTotal).toBe(twice.knownTotal)
    expect(double.e).toBeCloseTo(twice.e!, 12)
    expect(double.likely!.lo).toBeCloseTo(twice.likely!.lo, 9)
    expect(double.likely!.hi).toBeCloseTo(twice.likely!.hi, 9)
  })
})
