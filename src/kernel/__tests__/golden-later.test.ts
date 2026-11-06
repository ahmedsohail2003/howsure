// Golden cases G6 (net calories), G7 (plates), G9 (runs) and G10 (week summary). G6's kernel,
// src/kernel/net.ts, came with slice 10 (build-out item 2.5a) and G10's, src/kernel/week.ts, with
// slice 8 (build-out item 2.7); both are asserted below. The others' kernels are not built yet, so
// their values wait in fixtures/golden.json, written by
// `python3 scripts/golden.py --write` from spec.md > Maths Core (fictional inputs only).
//
// What runs now: the stored values are checked against the numbers spec.md prints (computed in
// Python on 2026-10-26, typed in here by hand), and the day maths inside them against the shipped
// estimate kernel. What waits: each kernel's own assertions, listed as `it.todo` with the slice
// and build-out item that brings the kernel. When a kernel lands, replace its todo with real
// tests that read the same fixture (devpost/checklist.md > Revisions).
import { describe, expect, it } from 'vitest'
import golden from '../../../fixtures/golden.json'
import { combineDay } from '../estimate'
import { combine, combineBurned } from '../net'
import { daysIndependentE, summarise } from '../week'
import { copy } from '../../ui/copy'
import type { BurnSourceId, MealSourceId, Workout } from '../types'
import { expectEPercent, expectRange, meal } from './helpers'

const { G6, G7, G9, G10, tolerance } = golden

/** Within +-1 kcal, the spec's tolerance on range ends. */
function expectEnds(got: number[], lo: number, hi: number) {
  expect(got).toHaveLength(2)
  expect(Math.abs(got[0] - lo), `lo ${got[0]} vs ${lo}`).toBeLessThanOrEqual(1)
  expect(Math.abs(got[1] - hi), `hi ${got[1]} vs ${hi}`).toBeLessThanOrEqual(1)
}

describe('fixtures/golden.json', () => {
  it("uses the spec's tolerances", () => {
    expect(tolerance).toEqual({ rangeEndKcal: 1, ePercentagePoints: 0.01 })
  })
})

describe('G6: net calories (spec.md > Maths Core: Net Calories)', () => {
  const x = G6.expected

  it('eaten 1800 (sd 828) - burned 300 (device, e .40, sd 120)', () => {
    expect(x.eaten.total).toBe(1800)
    expect(x.eaten.sd).toBeCloseTo(828, 6)
    expect(x.burned.total).toBe(300)
    expect(x.burned.sd).toBeCloseTo(120, 6)
    expect(G6.input.burned.map((w) => w.source)).toEqual(['burn_device'])
  })

  it('net 1500, sd 836.7, likely 428–2572, very likely −140–3140', () => {
    expect(x.net.total).toBe(1500)
    expect(Math.abs(x.net.sd - 836.7)).toBeLessThanOrEqual(0.05)
    expectEnds(x.net.likely, 428, 2572)
    expectEnds(x.net.veryLikely, -140, 3140)
  })

  it('net has no estimate score', () => {
    expect(x.net.score).toBeNull()
  })

  it("burned's own score: e 40% gives 60 (round(100 · (1 − 0.40)))", () => {
    expect(x.burned.ePercent).toBeCloseTo(40, 9)
    expect(x.burned.score).toBe(60)
    // Lognormal like a day, worked by hand: 1.4^1.2816 = 1.5391 and 1.4^1.96 = 1.9338, so
    // 300 / 1.5391 = 194.9, 300 · 1.5391 = 461.7, 300 / 1.9338 = 155.1, 300 · 1.9338 = 580.1.
    expectEnds(x.burned.likely, 195, 462)
    expectEnds(x.burned.veryLikely, 155, 580)
  })

  it("the eaten side agrees with today's day kernel", () => {
    const day = combineDay(
      G6.input.eaten.map((m) => meal(m.source as MealSourceId, m.kcal, { id: m.id, eatenAt: m.eatenAt })),
    )
    expect(day.knownTotal).toBe(x.eaten.total)
    expect(day.groups.map((g) => g.sd)).toEqual([expect.closeTo(x.eaten.sd, 6)])
  })

  // Slice 10 (build-out item 2.5a): src/kernel/net.ts, read against the same fixture.
  describe('net.combine() (src/kernel/net.ts)', () => {
    const eaten = combineDay(
      G6.input.eaten.map((m) => meal(m.source as MealSourceId, m.kcal, { id: m.id, eatenAt: m.eatenAt })),
    )
    const workouts: Workout[] = G6.input.burned.map((w) => ({
      id: w.id,
      name: w.name,
      startedAt: w.at,
      minutes: null,
      kcal: w.kcal,
      source: w.source as BurnSourceId,
    }))
    const burned = combineBurned(workouts)
    const result = combine(eaten, burned)

    it('eaten: 1800 kcal with sd 828', () => {
      expect(result.eaten.knownTotal).toBe(x.eaten.total)
      expect(result.eatenSd).toBeCloseTo(x.eaten.sd, 6)
    })

    it("burned: 300 kcal, sd 120, e 40%, score 60, and lognormal ranges like a day's", () => {
      expect(burned.status).toBe('complete')
      expect(burned.knownTotal).toBe(x.burned.total)
      expect(burned.sd).toBeCloseTo(x.burned.sd, 6)
      expectEPercent(burned.e, x.burned.ePercent)
      expect(burned.score).toBe(x.burned.score)
      expectEnds([Math.round(burned.likely!.lo), Math.round(burned.likely!.hi)], x.burned.likely[0], x.burned.likely[1])
      expectEnds(
        [Math.round(burned.veryLikely!.lo), Math.round(burned.veryLikely!.hi)],
        x.burned.veryLikely[0],
        x.burned.veryLikely[1],
      )
      expect(burned.groups).toEqual([{ source: 'burn_device', sd: expect.closeTo(120, 6), workoutIds: ['g6-walk'] }])
    })

    it('net: 1500, sd 836.65, normal ranges likely 428–2572 and very likely −140–3140', () => {
      const net = result.net!
      expect(net).not.toBeNull()
      expect(net.total).toBe(x.net.total)
      expect(net.sd).toBeCloseTo(x.net.sd, 3)
      expectEnds([Math.round(net.likely.lo), Math.round(net.likely.hi)], x.net.likely[0], x.net.likely[1])
      expectEnds([Math.round(net.veryLikely.lo), Math.round(net.veryLikely.hi)], x.net.veryLikely[0], x.net.veryLikely[1])
      // Normal, so symmetric about net, and allowed below 0.
      expect(net.total - net.likely.lo).toBeCloseTo(net.likely.hi - net.total, 9)
      expect(net.veryLikely.lo).toBeLessThan(0)
      expect(net.knownOnly).toBe(false)
    })

    it('net has no estimate score, and the score under the headline stays the eaten one', () => {
      expect(result.net!.score).toBe(x.net.score)
      expect(result.eaten.score).toBe(eaten.score)
      expect(result.eaten).toBe(eaten)
    })
  })
})

describe('G7: weigh minus the plate (spec.md > Maths Core: Plates and Gamer Tags)', () => {
  it('612 g reading − 212 g plate = 400 g × 165 kcal/100 g = 660 kcal', () => {
    expect(G7.input).toMatchObject({ readingG: 612, plateG: 212, kcalPer100: 165 })
    expect(G7.expected).toEqual({ foodGrams: 400, kcal: 660 })
  })

  it('a reading at or below the plate is an error', () => {
    expect(G7.errorCases.length).toBeGreaterThanOrEqual(2)
    expect(G7.errorCases.some((c) => c.readingG === c.plateG)).toBe(true)
    expect(G7.errorCases.some((c) => c.readingG < c.plateG)).toBe(true)
    for (const c of G7.errorCases) expect(c.expected).toHaveProperty('error')
  })

  it.todo('plates.ts weighs minus the plate and refuses a reading at or below it — waits for src/kernel/plates.ts (slice 11, build-out item 3.4)')
})

describe('G9: runs (spec.md > Other Tier 3 Pieces)', () => {
  it('5 km in 30 min is 6:00/km', () => {
    expect(G9.pace[0]).toEqual({ distanceKm: 5, durationMin: 30, secondsPerKm: 360, text: '6:00/km' })
  })

  it('10 km in 52.5 min is 5:15/km (3150 s / 10 = 315 s)', () => {
    expect(G9.pace[1]).toEqual({ distanceKm: 10, durationMin: 52.5, secondsPerKm: 315, text: '5:15/km' })
  })

  it('distance golden: a made-up route on the equator, haversine with R = 6371 km', () => {
    const d = G9.distance
    expect(d.earthRadiusKm).toBe(6371)
    expect(d.trackpoints.every((p) => Math.abs(p.lat) <= 0.05 && Math.abs(p.lon) <= 0.05)).toBe(true)
    // By hand: along the equator, 0.01° of longitude is 6371 · 0.01 · π / 180 = 1.111949 km, and
    // 0.01° of latitude is the same length.
    const step = (6371 * 0.01 * Math.PI) / 180
    expect(d.expected.legsKm[0]).toBeCloseTo(step, 5)
    expect(d.expected.legsKm[1]).toBeCloseTo(step, 5)
    // The diagonal leg is close to √2 steps (cos 0.01° and cos 0.02° are within 1e-7 of 1).
    expect(Math.abs(d.expected.legsKm[2] - Math.SQRT2 * step)).toBeLessThan(d.toleranceKm)
    expect(d.expected.totalKm).toBeCloseTo(d.expected.legsKm.reduce((s, v) => s + v, 0), 5)
  })

  it.todo('runs.ts gives these paces and distances within 1 m — waits for src/kernel/runs.ts (slice 28, build-out item 5.3)')
})

describe('G10: the week summary (spec.md > Maths Core: Week Summary)', () => {
  const x = G10.expected

  it('the complete days are G4 and G3, and the third day has an unknown meal', () => {
    const [mon, tue, wed] = G10.input.days
    expect(mon.meals).toEqual([
      { source: 'photo', kcal: 1000 },
      { source: 'label', kcal: 100 },
      { source: 'label', kcal: 100 },
      { source: 'label', kcal: 100 },
    ])
    expect(tue.meals).toEqual([
      { source: 'photo', kcal: 600 },
      { source: 'description', kcal: 600 },
      { source: 'menu', kcal: 600 },
    ])
    expect(wed.meals.some((m) => m.kcal === null)).toBe(true)
    expect(x.days.map((d) => d.status)).toEqual(['logged', 'logged', 'incomplete'])
  })

  it('average 1550, sd 393.4, e 25.38%, likely 1160–2071, very likely 995–2415', () => {
    expect(x.average).toBe(1550)
    expect(Math.abs(x.sd - 393.4)).toBeLessThanOrEqual(0.05)
    expect(Math.abs(x.ePercent - 25.38)).toBeLessThanOrEqual(0.01)
    expectEnds(x.likely, 1160, 2071)
    expectEnds(x.veryLikely, 995, 2415)
  })

  it('is labelled "average of 2 complete days (1 incomplete left out)"', () => {
    expect(x.completeDays).toBe(2)
    expect(x.incompleteLeftOut).toBe(1)
    expect(x.label).toBe('average of 2 complete days (1 incomplete left out)')
  })

  it('differs from the days-independent method (e 19.49%), so a test can tell them apart', () => {
    expect(Math.abs(x.daysIndependentEPercent - 19.49)).toBeLessThanOrEqual(0.01)
    expect(x.ePercent - x.daysIndependentEPercent).toBeGreaterThan(5)
  })

  it("each complete day agrees with today's day kernel and the G3/G4 rows of the spec table", () => {
    const spec = [
      { e: 35.46, score: 65, likely: [881, 1918], very: [717, 2357] }, // G4
      { e: 21.7, score: 78, likely: [1399, 2315], very: [1225, 2645] }, // G3
    ]
    G10.input.days.slice(0, 2).forEach((d, i) => {
      const day = combineDay(d.meals.map((m) => meal(m.source as MealSourceId, m.kcal)))
      expectEPercent(day.e, spec[i].e)
      expect(day.score).toBe(spec[i].score)
      expectRange(day.likely, spec[i].likely[0], spec[i].likely[1])
      expectRange(day.veryLikely, spec[i].very[0], spec[i].very[1])
      expect(x.days[i].score).toBe(spec[i].score)
    })
  })

  it('the incomplete day shows its known meals only: 400 kcal', () => {
    expect(x.days[2]).toEqual({ name: 'Wed', status: 'incomplete', knownTotal: 400 })
  })

  // Slice 8 (build-out item 2.7): src/kernel/week.ts, read against the same fixture.
  describe('week.summarise() (src/kernel/week.ts)', () => {
    const days = [
      ...G10.input.days.map((d) => ({
        meals: d.meals.map((m) => meal(m.source as MealSourceId, m.kcal)),
        workouts: [] as Workout[],
      })),
      // The rest of the week, not logged.
      ...Array.from({ length: G10.input.notLoggedDays }, () => ({ meals: [], workouts: [] as Workout[] })),
    ]
    const week = summarise(days)
    const c = week.calories

    it('each day: Mon and Tue logged, Wed incomplete (its known meals only, 400 kcal), the rest not logged', () => {
      expect(week.statuses).toEqual(['logged', 'logged', 'incomplete', 'notLogged', 'notLogged', 'notLogged', 'notLogged'])
      const wed = combineDay(days[2].meals)
      expect(wed.knownTotal).toBe(x.days[2].knownTotal)
    })

    it('average 1550, sd 393.4, e 25.38%, score 75, likely 1160–2071, very likely 995–2415', () => {
      expect(c.average).toBe(x.average)
      expect(Math.abs((c.sd as number) - x.sd)).toBeLessThanOrEqual(0.05)
      expectEPercent(c.e, x.ePercent)
      expect(c.score).toBe(x.score)
      expectEnds([Math.round(c.likely!.lo), Math.round(c.likely!.hi)], x.likely[0], x.likely[1])
      expectEnds([Math.round(c.veryLikely!.lo), Math.round(c.veryLikely!.hi)], x.veryLikely[0], x.veryLikely[1])
    })

    it('is labelled "average of 2 complete days (1 incomplete left out)", with the 4 days not logged counted apart', () => {
      expect(c).toMatchObject({ counted: x.completeDays, leftOut: x.incompleteLeftOut, notLogged: G10.input.notLoggedDays })
      expect(copy.week.completeDays(c.counted, c.leftOut)).toBe(x.label)
    })

    it('groups by source across the week, not days-independent (19.49%), so the two methods differ', () => {
      expectEPercent(daysIndependentE(days.map((d) => d.meals)), x.daysIndependentEPercent)
      expect((c.e as number) * 100 - x.daysIndependentEPercent).toBeGreaterThan(5)
    })
  })
})
