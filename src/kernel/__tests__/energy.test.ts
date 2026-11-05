// Build-out item 2.5b: resting burn (Mifflin-St Jeor) and the estimated deficit or surplus
// (src/kernel/energy.ts; spec.md > Maths Core: Energy Balance). The golden values E1 and E2 come
// from scripts/golden.py, which re-implements the maths from the spec's words in Python and writes
// fixtures/golden-energy.json (fictional inputs only). Here the TypeScript kernel must give the
// same numbers, and the stored values must match the numbers spec.md prints.
import { describe, expect, it } from 'vitest'
import golden from '../../../fixtures/golden-energy.json'
import {
  ACTIVITY_FACTORS,
  estimateBalance,
  hoursBetween,
  RESTING_BASIS,
  RESTING_TYPICAL_ERROR,
  restingBurn,
  SEX_MIDPOINT,
  SEX_SPREAD_SD,
  yearsSince,
  type ActivityLevel,
  type BodySex,
} from '../energy'
import { combineBurned, daySd } from '../net'
import { combineDay } from '../estimate'
import type { BurnSourceId, MealSourceId, Workout } from '../types'
import { meal } from './helpers'

const near = (got: number, want: number, tol = 1) => expect(Math.abs(got - want), `${got} vs ${want}`).toBeLessThanOrEqual(tol)

describe('fixtures/golden-energy.json', () => {
  it('uses the kernel’s typical error and activity factors', () => {
    expect(golden.restingTypicalError).toBe(RESTING_TYPICAL_ERROR)
    expect(golden.factors).toEqual(ACTIVITY_FACTORS)
    expect(golden.tolerance).toEqual({ kcal: 1 })
  })

  it('holds the numbers spec.md prints', () => {
    expect(golden.E1.map((c) => c.expected.kcal)).toEqual([1359, 1730, 1552])
    expect(golden.E2.map((c) => [c.id, c.expected.rounded, c.expected.direction])).toEqual([
      ['E2a', -131, 'deficit'],
      ['E2b', 13, 'surplus'],
      ['E2c', -406, 'deficit'],
    ])
  })
})

describe('E1: resting burn, Mifflin-St Jeor', () => {
  for (const c of golden.E1) {
    const i = c.input
    it(`${i.kg} kg, ${i.cm} cm, ${i.age} years, ${i.sex}: ${c.expected.kcal} kcal a day`, () => {
      const r = restingBurn({ kg: i.kg, cm: i.cm, age: i.age, sex: i.sex as BodySex })
      expect(r.kcal).toBeCloseTo(c.expected.kcal, 9)
      expect(r.sexConstant).toBe(c.expected.sexConstant)
      expect(r.sexSd).toBeCloseTo(c.expected.sexSd, 3)
      expect(r.equationSd).toBeCloseTo(c.expected.equationSd, 3)
      expect(r.sd).toBeCloseTo(c.expected.sd, 3)
    })
  }

  it('by hand: 10 × 64 + 6.25 × 168 − 5 × 34 − 161 = 1,359, and the male constant is 166 more', () => {
    expect(restingBurn({ kg: 64, cm: 168, age: 34, sex: 'female' }).kcal).toBe(1359)
    expect(restingBurn({ kg: 64, cm: 168, age: 34, sex: 'male' }).kcal).toBe(1359 + 166)
  })

  it('prefer not to say: the midpoint −78 and a wider spread, never narrower than a stated sex', () => {
    expect(SEX_MIDPOINT).toBe(-78)
    expect(SEX_SPREAD_SD).toBeCloseTo(166 / Math.sqrt(12), 9)
    const unspecified = restingBurn({ kg: 64, cm: 168, age: 34, sex: 'unspecified' })
    expect(unspecified.kcal).toBe(1359 + 83)
    expect(unspecified.sd).toBeGreaterThan(unspecified.equationSd)
    expect(restingBurn({ kg: 64, cm: 168, age: 34, sex: 'female' }).sexSd).toBe(0)
  })

  it('cites its nearest study and stays an assumption', () => {
    expect(RESTING_BASIS.kind).toBe('assumption')
    expect(RESTING_BASIS.cite).toBe('Frankenfield et al. 2005, J Am Diet Assoc')
    expect(RESTING_BASIS.doi).toBe('10.1016/j.jada.2005.02.005')
  })
})

describe('E2: estimated deficit or surplus', () => {
  for (const c of golden.E2) {
    const i = c.input
    const x = c.expected
    it(`${c.id}: ${c.about}`, () => {
      // Through the day maths the dashboard uses: meals and workouts grouped by source.
      const meals = i.meals.map((m) => meal(m.source as MealSourceId, m.kcal, { id: m.id, name: m.name }))
      const day = combineDay(meals)
      const workouts: Workout[] = i.workouts.map((w) => ({
        id: w.id,
        name: w.name,
        startedAt: '2026-10-21T17:00:00-04:00',
        minutes: null,
        kcal: w.kcal,
        source: w.source as BurnSourceId,
      }))
      const burned = combineBurned(workouts)
      expect(day.knownTotal).toBe(x.eaten)
      expect(daySd(day)).toBeCloseTo(x.eatenSd, 3)
      expect(burned.knownTotal).toBe(x.workouts)
      expect(burned.sd).toBeCloseTo(x.workoutsSd, 3)

      const resting = restingBurn({ kg: i.body.kg, cm: i.body.cm, age: i.body.age, sex: i.body.sex as BodySex })
      const est = estimateBalance({
        eaten: day.knownTotal,
        eatenSd: daySd(day),
        workouts: burned.knownTotal,
        workoutsSd: burned.sd,
        resting,
        factor: ACTIVITY_FACTORS[i.activity as ActivityLevel],
        hours: i.hours,
      })
      expect(resting.kcal).toBeCloseTo(x.resting, 9)
      expect(est.everyday).toBeCloseTo(x.everyday, 3)
      expect(est.everydaySd).toBeCloseTo(x.everydaySd, 3)
      expect(est.burn).toBeCloseTo(x.burn, 3)
      expect(est.balance).toBeCloseTo(x.balance, 3)
      expect(est.sd).toBeCloseTo(x.sd, 3)
      expect(Math.round(est.balance)).toBe(x.rounded)
      near(est.likely.lo, x.likely[0])
      near(est.likely.hi, x.likely[1])
      near(est.veryLikely.lo, x.veryLikely[0])
      near(est.veryLikely.hi, x.veryLikely[1])
    })
  }

  it('counts burn per hour: half a day counts half of a whole day’s everyday burn', () => {
    const resting = restingBurn({ kg: 64, cm: 168, age: 34, sex: 'female' })
    const base = { eaten: 1000, eatenSd: 100, workouts: 0, workoutsSd: 0, resting, factor: 1.2 }
    const whole = estimateBalance({ ...base, hours: 24 })
    const half = estimateBalance({ ...base, hours: 12 })
    expect(half.everyday).toBeCloseTo(whole.everyday / 2, 9)
    expect(half.share).toBe(0.5)
    expect(estimateBalance({ ...base, hours: -3 }).everyday).toBe(0)
  })

  it('adds workouts once, on top of everyday activity', () => {
    const resting = restingBurn({ kg: 80, cm: 180, age: 40, sex: 'male' })
    const none = estimateBalance({ eaten: 2000, eatenSd: 0, workouts: 0, workoutsSd: 0, resting, factor: 1.2, hours: 24 })
    const run = estimateBalance({ eaten: 2000, eatenSd: 0, workouts: 300, workoutsSd: 150, resting, factor: 1.2, hours: 24 })
    expect(run.burn - none.burn).toBeCloseTo(300, 9)
    expect(run.sd).toBeGreaterThan(none.sd)
  })
})

describe('time helpers', () => {
  it('hours between two times, never below 0', () => {
    expect(hoursBetween('2026-10-21T07:00:00-04:00', '2026-10-21T22:00:00-04:00')).toBe(15)
    expect(hoursBetween('2026-10-21T22:00:00-04:00', '2026-10-21T07:00:00-04:00')).toBe(0)
  })

  it('whole years since an age was typed', () => {
    expect(yearsSince('2025-11-05', '2026-11-04T12:00:00')).toBe(0)
    expect(yearsSince('2025-11-05', '2026-11-05T12:00:00')).toBe(1)
    expect(yearsSince('2026-11-05', '2026-01-01T12:00:00')).toBe(0)
    expect(yearsSince('not a date', '2026-11-05T12:00:00')).toBe(0)
    // Back in time: a whole year before the age was typed reads a year younger.
    expect(yearsSince('2026-11-05', '2025-11-06T12:00:00')).toBe(0)
    expect(yearsSince('2026-11-05', '2025-11-05T12:00:00')).toBe(-1)
    expect(yearsSince('2026-11-05', '2024-03-01T12:00:00')).toBe(-2)
    expect(yearsSince('2024-02-29', '2025-02-28T12:00:00')).toBe(0)
    expect(yearsSince('2024-02-29', '2025-03-01T12:00:00')).toBe(1)
  })
})
