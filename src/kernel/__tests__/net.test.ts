// src/kernel/net.ts beyond golden G6 (golden-later.test.ts): unknown entries, several burn
// sources, a typed 0, and the waking day a workout belongs to. Fictional inputs only.
import { describe, expect, it } from 'vitest'
import { combineDay } from '../estimate'
import { BURN_SOURCE_IDS, combine, combineBurned, daySd, estimateWorkout, isKnownWorkout, normalRange } from '../net'
import { wakingDays, workoutsForDay } from '../sleepday'
import { SOURCES } from '../sources'
import type { BurnSourceId, SleepRecord, Workout } from '../types'
import { expectEPercent, expectRange, meal } from './helpers'

let seq = 0
function workout(source: BurnSourceId | null, kcal: number | null, over: Partial<Workout> = {}): Workout {
  seq += 1
  return { id: `w${seq}`, name: `workout ${seq}`, startedAt: '2026-10-21T17:00:00-04:00', minutes: 30, kcal, source, ...over }
}

describe('the burn sources', () => {
  it('are the three Tier 2 rows of the sources table, each an assumption with its typical error', () => {
    expect(BURN_SOURCE_IDS).toEqual(['burn_device', 'burn_machine', 'burn_guess'])
    expect(BURN_SOURCE_IDS.map((id) => SOURCES[id].typicalError)).toEqual([0.4, 0.3, 0.5])
    for (const id of BURN_SOURCE_IDS) expect(SOURCES[id].basis.kind).toBe('assumption')
  })
})

describe('estimateWorkout', () => {
  it('a 300 kcal rough guess: e 50%, score 50, likely 178–504, very likely 136–664', () => {
    const est = estimateWorkout(workout('burn_guess', 300))!
    expect(est.e).toBe(0.5)
    expect(est.sd).toBe(150)
    expect(est.score).toBe(50)
    // 1.5^1.2816 = 1.6810 and 1.5^1.96 = 2.2140 (worked by hand).
    expectRange(est.likely, 178, 504)
    expectRange(est.veryLikely, 136, 664)
  })

  it('unknown calories, or no source picked, give no estimate', () => {
    expect(estimateWorkout(workout('burn_device', null))).toBeNull()
    expect(estimateWorkout(workout(null, null))).toBeNull()
    expect(isKnownWorkout(workout(null, null))).toBe(false)
  })
})

describe('combineBurned', () => {
  it('with no workouts: empty, nothing known, no score or ranges', () => {
    const b = combineBurned([])
    expect(b).toMatchObject({ status: 'empty', knownTotal: 0, workoutCount: 0, sd: 0, e: null, score: null, likely: null })
  })

  it('same-source spreads add straight; different sources combine as the root of the sum of squares', () => {
    const b = combineBurned([workout('burn_device', 200), workout('burn_device', 100), workout('burn_machine', 400)])
    // Device: 0.4 * 300 = 120. Machine: 0.3 * 400 = 120. sqrt(120^2 + 120^2) = 169.71.
    expect(b.groups.map((g) => g.source)).toEqual(['burn_device', 'burn_machine'])
    expect(b.groups[0].sd).toBeCloseTo(120, 9)
    expect(b.sd).toBeCloseTo(Math.SQRT2 * 120, 9)
    expect(b.knownTotal).toBe(700)
    expectEPercent(b.e, 24.24)
    expect(b.score).toBe(76)
  })

  it('a workout with unknown calories is listed, never counted as 0', () => {
    const unknown = workout('burn_guess', null)
    const b = combineBurned([workout('burn_device', 300), unknown])
    expect(b.status).toBe('partial')
    expect(b.knownTotal).toBe(300)
    expect(b.unknownWorkoutIds).toEqual([unknown.id])
    expect(combineBurned([unknown]).status).toBe('all-unknown')
  })

  it('a typed 0 is known: burned 0 kcal, with no score or range to divide by', () => {
    const b = combineBurned([workout('burn_guess', 0)])
    expect(b).toMatchObject({ status: 'complete', knownTotal: 0, e: null, score: null, likely: null })
  })
})

describe('combine (net)', () => {
  const eaten = combineDay([meal('label', 500)]) // sd 50

  it('net = eaten − burned, sd = √(sd_eaten² + sd_burned²), normal ranges', () => {
    const r = combine(eaten, combineBurned([workout('burn_guess', 300)])) // sd 150
    expect(r.eatenSd).toBeCloseTo(50, 9)
    expect(r.net!.total).toBe(200)
    expect(r.net!.sd).toBeCloseTo(Math.sqrt(50 ** 2 + 150 ** 2), 9)
    expect(r.net!.likely.lo).toBeCloseTo(200 - 1.2816 * r.net!.sd, 9)
    expect(r.net!.veryLikely.hi).toBeCloseTo(200 + 1.96 * r.net!.sd, 9)
    expect(r.net!.score).toBeNull()
  })

  it('can be below 0, and its ranges are not cut off at 0', () => {
    const r = combine(combineDay([meal('label', 200)]), combineBurned([workout('burn_machine', 500)]))
    expect(r.net!.total).toBe(-300)
    expect(r.net!.likely.hi).toBeLessThan(0)
  })

  it('is not available while either side has no known total', () => {
    expect(combine(eaten, combineBurned([workout('burn_device', null)])).net).toBeNull()
    expect(combine(combineDay([]), combineBurned([workout('burn_device', 300)])).net).toBeNull()
    expect(combine(combineDay([meal('photo', null)]), combineBurned([workout('burn_device', 300)])).net).toBeNull()
  })

  it('is "known entries only" when an unknown meal or workout is left out', () => {
    const partialEaten = combineDay([meal('label', 500), meal('photo', null)])
    const w = combineBurned([workout('burn_device', 300)])
    expect(combine(eaten, w).net!.knownOnly).toBe(false)
    expect(combine(partialEaten, w).net!.knownOnly).toBe(true)
    expect(combine(eaten, combineBurned([workout('burn_device', 300), workout('burn_guess', null)])).net!.knownOnly).toBe(true)
  })

  it('with burned 0 kcal, net is eaten with eaten’s spread', () => {
    const r = combine(eaten, combineBurned([workout('burn_guess', 0)]))
    expect(r.net!.total).toBe(500)
    expect(r.net!.sd).toBeCloseTo(daySd(eaten), 9)
  })

  it('normalRange is symmetric', () => {
    expect(normalRange(100, 10, 2)).toEqual({ lo: 80, hi: 120 })
  })
})

describe('workoutsForDay: a workout belongs to the waking day it started in', () => {
  const sleeps: SleepRecord[] = [
    { id: 's1', sleepStart: null, wake: '2026-10-21T07:00:00-04:00' },
    { id: 's2', sleepStart: '2026-10-21T23:30:00-04:00', wake: '2026-10-22T07:10:00-04:00' },
  ]
  const late = workout('burn_device', 200, { startedAt: '2026-10-21T23:00:00-04:00' })
  const early = workout('burn_device', 100, { startedAt: '2026-10-21T08:00:00-04:00' })
  const before = workout('burn_guess', 50, { startedAt: '2026-10-21T06:00:00-04:00' })
  const next = workout('burn_machine', 300, { startedAt: '2026-10-22T07:10:00-04:00' })

  it('in time order, from the wake up to (not including) the next wake', () => {
    expect(workoutsForDay([late, next, early, before], sleeps, '2026-10-21T07:00:00-04:00')).toEqual([early, late])
    expect(workoutsForDay([late, next, early], sleeps, '2026-10-22T07:10:00-04:00')).toEqual([next])
  })

  it('before the first wake, on the provisional day', () => {
    expect(workoutsForDay([late, before], sleeps, null)).toEqual([before])
    expect(wakingDays([{ eatenAt: before.startedAt }], sleeps)[0]).toBeNull()
  })
})
