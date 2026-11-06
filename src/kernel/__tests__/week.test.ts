// The week summary (src/kernel/week.ts; build-out item 2.7, checklist slice 8). Golden G10 is in
// golden-later.test.ts; these are hand-worked cases, with fictional entries, for the rules around
// it: unknown days left out and counted (never 0), each average's spread, and the sleep averages.
import { describe, expect, it } from 'vitest'
import {
  balanceAverage,
  burnedAverage,
  burnedScoreAverage,
  calorieAverage,
  macroAverage,
  minutesAverage,
  netAverage,
  nightBefore,
  scoreAverage,
  summarise,
  weekDayStatus,
  weekSleep,
} from '../week'
import type { BurnSourceId, KnownMeal, KnownWorkout, Meal, Night, SleepRecord, Workout } from '../types'
import { meal } from './helpers'

function workout(source: BurnSourceId | null, kcal: number | null, minutes: number | null = 30): Workout {
  return { id: `w-${Math.random().toString(36).slice(2, 8)}`, name: 'Walk', startedAt: '2026-10-21T18:00:00-04:00', minutes, kcal, source }
}

const label = (kcal: number, over: Partial<Meal> = {}) => meal('label', kcal, { protein: 20, carbs: 40, fat: 10, ...over })

describe('weekDayStatus: logged, incomplete or not logged', () => {
  it('no meals is not logged, an unknown meal is incomplete, all known is logged', () => {
    expect(weekDayStatus([])).toBe('notLogged')
    expect(weekDayStatus([label(500), meal('photo', null)])).toBe('incomplete')
    expect(weekDayStatus([meal('photo', null)])).toBe('incomplete')
    expect(weekDayStatus([label(500)])).toBe('logged')
  })
})

describe('calorieAverage: complete days only, never counting unknown as 0', () => {
  it('leaves out an incomplete day and a day not logged, and counts them', () => {
    // 500 (label) and 700 (label) are complete; 400 + unknown is incomplete; one day is empty.
    const avg = calorieAverage([[label(500)], [label(400), meal('photo', null)], [], [label(700)]])
    expect(avg).toMatchObject({ counted: 2, leftOut: 1, notLogged: 1, total: 1200, average: 600 })
    // Same source, so the spreads add straight: 50 + 70 = 120 over 2 days = 60, e = 10%.
    expect(avg.sd).toBeCloseTo(60, 9)
    expect(avg.e).toBeCloseTo(0.1, 9)
    expect(avg.score).toBe(90)
  })

  it('a day of only unknown meals is incomplete, not 0 kcal: the average stays the complete days’', () => {
    const avg = calorieAverage([[label(800)], [meal('photo', null), meal('menu', null)]])
    expect(avg).toMatchObject({ counted: 1, leftOut: 1, average: 800 })
  })

  it('with no complete day there is no average (not 0)', () => {
    const avg = calorieAverage([[label(400), meal('photo', null)], []])
    expect(avg).toMatchObject({ counted: 0, leftOut: 1, notLogged: 1, average: null, likely: null, veryLikely: null })
  })

  it('different sources combine as the root of the sum of squares across days', () => {
    // Day 1: weighed 1000 (sd 80); day 2: photo 1000 (sd 460). sd_total = √(80² + 460²) = 466.9.
    const avg = calorieAverage([[meal('weighed', 1000)], [meal('photo', 1000)]])
    expect(avg.sd).toBeCloseTo(Math.sqrt(80 ** 2 + 460 ** 2) / 2, 9)
    expect(avg.average).toBe(1000)
  })
})

describe('macroAverage: a day with a meal missing that macro is left out, never 0', () => {
  it('counts days where every meal has it', () => {
    const days = [[label(500, { protein: 30 }), label(300, { protein: 10 })], [label(400, { protein: null }), label(300, { protein: 25 })], [], [label(600, { protein: 50 })]]
    expect(macroAverage(days, 'protein')).toEqual({ counted: 2, leftOut: 1, notLogged: 1, average: 45 })
  })

  it('a day where no meal has it is left out too', () => {
    expect(macroAverage([[label(500, { fat: null })]], 'fat')).toEqual({ counted: 0, leftOut: 1, notLogged: 0, average: null })
  })
})

describe('scoreAverage: complete days’ Estimate scores', () => {
  it('weighed (92) and photo (54) average to 73; the incomplete day is left out', () => {
    const avg = scoreAverage([[meal('weighed', 500)], [meal('photo', 500)], [meal('weighed', 300), meal('photo', null)]])
    expect(avg).toEqual({ counted: 2, leftOut: 1, notLogged: 0, average: 73, incomplete: 1, unscored: 0 })
  })

  it('a complete day with nothing above 0 kcal has no score: left out, but counted apart from incomplete days', () => {
    const avg = scoreAverage([[meal('weighed', 500)], [label(0)], [label(0), label(0)], [meal('photo', null)], []])
    expect(avg).toEqual({ counted: 1, leftOut: 3, notLogged: 1, average: 92, incomplete: 1, unscored: 2 })
  })
})

describe('burnedScoreAverage: the days’ burned Estimate scores', () => {
  it('device (60) and device plus machine (sd √(40² + 30²) = 50 of 200: 75) average to 67.5; unknown and 0 kcal days are left out apart', () => {
    const avg = burnedScoreAverage([
      [workout('burn_device', 300)],
      [workout('burn_machine', 100), workout('burn_device', 100)],
      [],
      [workout('burn_device', 200), workout('burn_guess', null)],
      [workout('burn_guess', 0)],
    ])
    expect(avg).toEqual({ counted: 2, leftOut: 2, notLogged: 1, average: 67.5, incomplete: 1, unscored: 1 })
  })

  it('a week with no workouts has no average, and leaves nothing out', () => {
    expect(burnedScoreAverage([[], []])).toEqual({ counted: 0, leftOut: 0, notLogged: 2, average: null, incomplete: 0, unscored: 0 })
  })
})

describe('burnedAverage: logged days, no workouts count 0, an unknown workout leaves its day out', () => {
  it('two days of a 300 kcal device workout, one day with meals only, one unknown, one not logged', () => {
    const days = [
      { meals: [label(500)], workouts: [workout('burn_device', 300)] },
      { meals: [], workouts: [workout('burn_device', 300)] },
      { meals: [label(500)], workouts: [] },
      { meals: [label(500)], workouts: [workout('burn_guess', null)] },
      { meals: [], workouts: [] },
    ]
    const avg = burnedAverage(days)
    expect(avg).toMatchObject({ counted: 3, leftOut: 1, notLogged: 1, total: 600, average: 200 })
    // Same source across the week: 120 + 120 = 240, over 3 days = 80.
    expect(avg.sd).toBeCloseTo(80, 9)
    expect(avg.e).toBeCloseTo(0.4, 9)
  })
})

describe('netAverage: eaten minus burned where both are known', () => {
  it('normal ranges from both sides’ grouped spreads', () => {
    const days = [
      { meals: [label(2000)], workouts: [workout('burn_device', 500)] },
      { meals: [label(1800)], workouts: [] },
      { meals: [label(1500), meal('photo', null)], workouts: [] },
      { meals: [], workouts: [workout('burn_device', 200)] },
    ]
    const avg = netAverage(days)
    // Counted: 2000 − 500 and 1800 − 0. Left out: the unknown meal, and the day with no meals.
    expect(avg).toMatchObject({ counted: 2, leftOut: 2, notLogged: 0, total: 3300, average: 1650 })
    // Meals (label): 200 + 180 = 380. Workouts (device): 200. sd = √(380² + 200²) / 2.
    const sd = Math.sqrt(380 ** 2 + 200 ** 2) / 2
    expect(avg.sd).toBeCloseTo(sd, 9)
    expect(avg.likely!.lo).toBeCloseTo(1650 - 1.2816 * sd, 9)
    expect(avg.veryLikely!.hi).toBeCloseTo(1650 + 1.96 * sd, 9)
  })
})

describe('balanceAverage: everyday-burn spreads add straight across days', () => {
  it('two days of a 1000 kcal label meal against 1500 kcal everyday burn (sd 150)', () => {
    const day = { meals: [label(1000) as KnownMeal], workouts: [] as KnownWorkout[], everyday: 1500, everydaySd: 150 }
    const avg = balanceAverage([day, { ...day, meals: [label(1000) as KnownMeal] }, 'leftOut', null])
    expect(avg).toMatchObject({ counted: 2, leftOut: 1, notLogged: 1, total: -1000, average: -500 })
    // Meals: 100 + 100 = 200 (same source); everyday: 150 + 150 = 300 (one equation, straight).
    const sd = Math.sqrt(200 ** 2 + 300 ** 2) / 2
    expect(avg.sd).toBeCloseTo(sd, 9)
    // Treating the days' everyday burn as unrelated would give √(150² + 150²) = 212, too narrow.
    expect(avg.sd!).toBeGreaterThan(Math.sqrt(200 ** 2 + 150 ** 2 + 150 ** 2) / 2)
  })
})

describe('minutesAverage: workout time, no workouts count 0, unknown duration leaves the day out', () => {
  it('45 and 0 count; an unknown duration and an empty day do not', () => {
    const days = [
      { meals: [], workouts: [workout('burn_device', 300, 45)] },
      { meals: [label(500)], workouts: [] },
      { meals: [label(500)], workouts: [workout('burn_device', 300, null)] },
      { meals: [], workouts: [] },
    ]
    expect(minutesAverage(days)).toEqual({ counted: 2, leftOut: 1, notLogged: 1, average: 22.5 })
  })
})

describe('the week’s sleep', () => {
  const at = (s: string) => `${s}:00-04:00`
  it('nightBefore: the record whose wake starts the day; none for the provisional day', () => {
    const sleeps: SleepRecord[] = [
      { id: 'a', sleepStart: at('2026-10-20T23:00'), wake: at('2026-10-21T07:15') },
      { id: 'b', sleepStart: null, wake: at('2026-10-22T07:00') },
    ]
    expect(nightBefore(sleeps, at('2026-10-21T07:15'))).toEqual({ id: 'a', sleepStart: at('2026-10-20T23:00'), wake: at('2026-10-21T07:15'), minutes: 495 })
    expect(nightBefore(sleeps, at('2026-10-22T07:00'))?.minutes).toBeNull()
    expect(nightBefore(sleeps, null)).toBeNull()
  })

  it('wake times of 23:50 and 00:10 average to 00:00, not 12:00 (prd.md > Week View)', () => {
    const nights: Night[] = [
      { id: 'a', sleepStart: at('2026-10-20T16:00'), wake: at('2026-10-20T23:50'), minutes: 470 },
      { id: 'b', sleepStart: at('2026-10-21T16:30'), wake: at('2026-10-22T00:10'), minutes: 460 },
    ]
    const s = weekSleep(nights)
    expect(s.avgWakeMinutes).toBe(0)
    expect(s.avgSleepMinutes).toBe(16 * 60 + 15)
    expect(s.avgMinutes).toBe(465)
  })

  it('a night "not logged" and a day with no night are left out of every average and counted', () => {
    const nights: (Night | null)[] = [
      { id: 'a', sleepStart: at('2026-10-20T23:00'), wake: at('2026-10-21T07:00'), minutes: 480 },
      { id: 'b', sleepStart: null, wake: at('2026-10-22T09:00'), minutes: null },
      null,
    ]
    const s = weekSleep(nights)
    expect(s).toMatchObject({ complete: 1, total: 3, avgMinutes: 480, avgWakeMinutes: 7 * 60 })
  })

  it('times too spread out have no average (6:00 and 18:00), and say so', () => {
    const nights: Night[] = [
      { id: 'a', sleepStart: at('2026-10-20T22:00'), wake: at('2026-10-21T06:00'), minutes: 480 },
      { id: 'b', sleepStart: at('2026-10-22T10:00'), wake: at('2026-10-22T18:00'), minutes: 480 },
    ]
    const s = weekSleep(nights)
    expect(s.avgWakeMinutes).toBeNull()
    expect(s.wakeVaries).toBe(true)
    expect(s.avgSleepMinutes).toBeNull()
    expect(s.sleepVaries).toBe(true)
  })
})

describe('summarise()', () => {
  it('gives each day’s status and every per-day average at once', () => {
    const s = summarise([
      { meals: [label(500)], workouts: [] },
      { meals: [label(400), meal('photo', null)], workouts: [workout('burn_device', 100)] },
      { meals: [], workouts: [] },
    ])
    expect(s.statuses).toEqual(['logged', 'incomplete', 'notLogged'])
    expect(s.calories).toMatchObject({ counted: 1, leftOut: 1, notLogged: 1, average: 500 })
    expect(s.macros.protein).toMatchObject({ counted: 1, leftOut: 1, average: 20 })
    expect(s.burned).toMatchObject({ counted: 2, average: 50 })
    // One device workout of 100 kcal: score 60.
    expect(s.burnedScore).toMatchObject({ counted: 1, notLogged: 2, average: 60 })
    expect(s.net).toMatchObject({ counted: 1, leftOut: 1, average: 500 })
  })
})
