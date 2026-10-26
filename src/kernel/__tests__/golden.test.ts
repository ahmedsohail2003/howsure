// Golden values from spec.md > Maths Core: Estimates, Ranges and the Day, computed
// independently by scripts/golden.py. Tolerance: +-1 kcal on range ends after
// Math.round, +-0.01 percentage points on e. Scores match exactly.
import { describe, expect, it } from 'vitest'
import { applySource, combineDay, estimateMeal, improve, scoreFromE } from '../estimate'
import { circularMeanMinutes, mealsForDay, nightStats, wakingDayStart } from '../sleepday'
import type { Meal } from '../types'
import { demoDoc, demoStartIso, expectEPercent, expectRange, meal } from './helpers'

describe('G1: one label meal, 500 kcal', () => {
  const m = meal('label', 500)
  const day = combineDay([m])

  it('e 10%, score 90, likely 443–565, very likely 415–603', () => {
    expectEPercent(day.e, 10)
    expect(day.score).toBe(90)
    expectRange(day.likely, 443, 565)
    expectRange(day.veryLikely, 415, 603)
  })

  it('improve suggests weighed: e 8%, score 92, likely 453–552, very likely 430–581', () => {
    const imp = improve([m], m.id)
    expect(imp).not.toBeNull()
    expect(imp!.to).toBe('weighed')
    expect(imp!.newMealE).toBeCloseTo(0.08, 12)
    expect(imp!.newDayScore).toBe(92)
    const after = combineDay(applySource([m], m.id, imp!.to))
    expectEPercent(after.e, 8)
    expect(after.score).toBe(92)
    expectRange(after.likely, 453, 552)
    expectRange(after.veryLikely, 430, 581)
  })
})

describe('G2: three photo meals, 600 kcal each (one source)', () => {
  // ids deliberately out of time order, so the eatenAt tie-break is what decides
  const meals = [
    meal('photo', 600, { id: 'b', eatenAt: '2026-10-21T18:00:00-04:00' }),
    meal('photo', 600, { id: 'c', eatenAt: '2026-10-21T08:00:00-04:00' }),
    meal('photo', 600, { id: 'a', eatenAt: '2026-10-21T12:00:00-04:00' }),
  ]
  const day = combineDay(meals)

  it('total 1800, e 46.00%, score 54, likely 1108–2924, very likely 857–3779', () => {
    expect(day.knownTotal).toBe(1800)
    expectEPercent(day.e, 46)
    expect(day.score).toBe(54)
    expectRange(day.likely, 1108, 2924)
    expectRange(day.veryLikely, 857, 3779)
  })

  it('same-source spreads add straight: one group, sd 828', () => {
    expect(day.groups).toHaveLength(1)
    expect(day.groups[0].sd).toBeCloseTo(828, 9)
  })

  it('the tie-break names the earliest meal', () => {
    expect(day.biggestMealId).toBe('c')
    expect(day.contributions.map((c) => c.mealId)).toEqual(['c', 'a', 'b'])
  })
})

describe('G3: photo, description and menu, 600 kcal each', () => {
  const day = combineDay([meal('photo', 600), meal('description', 600), meal('menu', 600)])
  it('e 21.70%, score 78, likely 1399–2315, very likely 1225–2645', () => {
    expectEPercent(day.e, 21.7)
    expect(day.score).toBe(78)
    expectRange(day.likely, 1399, 2315)
    expectRange(day.veryLikely, 1225, 2645)
  })
})

describe('G4: 1000 kcal photo + 3 × 100 kcal label', () => {
  const photo = meal('photo', 1000)
  const meals = [photo, meal('label', 100), meal('label', 100), meal('label', 100)]
  const day = combineDay(meals)

  it('total 1300, e 35.46%, score 65, likely 881–1918, very likely 717–2357', () => {
    expect(day.knownTotal).toBe(1300)
    expectEPercent(day.e, 35.46)
    expect(day.score).toBe(65)
    expectRange(day.likely, 881, 1918)
    expectRange(day.veryLikely, 717, 2357)
  })

  it('the biggest contributor is the photo meal', () => {
    expect(day.biggestMealId).toBe(photo.id)
  })

  it('G4b: after improving the photo meal to label, e 10.00%, score 90, likely 1151–1469, very likely 1078–1567', () => {
    const imp = improve(meals, photo.id)
    expect(imp!.to).toBe('label')
    expect(imp!.newDayScore).toBe(90)
    const after = combineDay(applySource(meals, photo.id, 'label'))
    expectEPercent(after.e, 10)
    expect(after.score).toBe(90)
    expectRange(after.likely, 1151, 1469)
    expectRange(after.veryLikely, 1078, 1567)
  })
})

describe('G5: three photo meals if treated as independent (documentation only)', () => {
  it('independent gives e 26.56%, score 73; the method keeps 46.00%, score 54', () => {
    const meals = [meal('photo', 600), meal('photo', 600), meal('photo', 600)]
    const sds = meals.map((m) => estimateMeal(m)!.sd)
    const eIndependent = Math.sqrt(sds.reduce((s, sd) => s + sd * sd, 0)) / 1800
    expectEPercent(eIndependent, 26.56)
    expect(scoreFromE(eIndependent)).toBe(73)
    const day = combineDay(meals)
    expectEPercent(day.e, 46)
    expect(day.score).toBe(54)
  })
})

// The demo as the app loads it (wall-clock fixture times converted to local-offset ISO,
// spec.md > Clock), read at the demo clock's first now, Thu 2026-10-22 01:30 local.
function demoWednesday(): Meal[] {
  const start = wakingDayStart(demoDoc.sleeps, demoStartIso)
  expect(start).toBe('2026-10-21T13:20:00-04:00') // Wed 13:20 local, in the pinned America/Toronto
  return mealsForDay(demoDoc.meals, demoDoc.sleeps, start)
}

describe("G11: the demo's Wednesday, before Improve", () => {
  const wed = demoWednesday()
  const day = combineDay(wed)
  const nameOf = (id: string | null) => wed.find((m) => m.id === id)?.name

  it('reads the five Wednesday meals from fixtures/demo-week.json', () => {
    expect(wed.map((m) => m.name)).toEqual([
      'Kefir with oats and blueberries',
      'Pasta bake (ready meal)',
      'Chicken, rice and broccoli',
      'Lentil soup from the café',
      'Apple and peanut butter',
    ])
  })

  it('total 2280, e 16.72%, score 83, likely 1870–2780, very likely 1684–3087', () => {
    expect(day.status).toBe('complete')
    expect(day.knownTotal).toBe(2280)
    expectEPercent(day.e, 16.72)
    expect(day.score).toBe(83)
    expectRange(day.likely, 1870, 2780)
    expectRange(day.veryLikely, 1684, 3087)
  })

  it('biggest contributor "Pasta bake (ready meal)"; Improve suggests label', () => {
    expect(nameOf(day.biggestMealId)).toBe('Pasta bake (ready meal)')
    const imp = improve(wed, day.biggestMealId!)
    expect(imp!.to).toBe('label')
    expect(imp!.newMealE).toBeCloseTo(0.1, 12)
  })
})

describe('G11b: G11 after re-logging the pasta bake from its note (label, 860 kcal)', () => {
  const wed = demoWednesday()
  const pasta = wed.find((m) => m.name === 'Pasta bake (ready meal)')!
  const kcalFromNote = Number(/(\d+)\s*kcal/.exec(pasta.note ?? '')![1])
  const improved = wed.map((m) =>
    m.id === pasta.id ? { ...m, source: 'label' as const, kcal: kcalFromNote, protein: 42, carbs: 96, fat: 33 } : m,
  )
  const day = combineDay(improved)
  const biggest = improved.find((m) => m.id === day.biggestMealId)

  it('the note says 860 kcal', () => {
    expect(kcalFromNote).toBe(860)
  })

  it('total 2380, e 8.14%, score 92, likely 2153–2631, very likely 2042–2775', () => {
    expect(day.knownTotal).toBe(2380)
    expectEPercent(day.e, 8.14)
    expect(day.score).toBe(92)
    expectRange(day.likely, 2153, 2631)
    expectRange(day.veryLikely, 2042, 2775)
  })

  it('biggest contributor is now "Apple and peanut butter" (description)', () => {
    expect(biggest?.name).toBe('Apple and peanut butter')
    expect(biggest?.source).toBe('description')
  })
})

describe('G12: weighed meal 700 kcal + label meal 150 kcal', () => {
  const weighed = meal('weighed', 700)
  const meals = [weighed, meal('label', 150)]
  const day = combineDay(meals)

  it('e 6.82%, score 93, likely 781–925, very likely 747–967', () => {
    expectEPercent(day.e, 6.82)
    expect(day.score).toBe(93)
    expectRange(day.likely, 781, 925)
    expectRange(day.veryLikely, 747, 967)
  })

  it('the biggest contributor is the weighed meal, so improve is null', () => {
    expect(day.biggestMealId).toBe(weighed.id)
    expect(improve(meals, weighed.id)).toBeNull()
  })
})

// spec.md > Maths Core: Waking Days and Sleep > Golden values (circular-mean wake time).
// Raw values computed separately in Python (math.atan2): 13:10 and 13:30 give -640.0000000000001
// minutes, 799.99... after wrapping, so round, never floor.
describe('G8: average wake time as a circular mean', () => {
  const hm = (h: number, m: number) => h * 60 + m

  it('23:50 and 00:10 average to 00:00, not noon', () => {
    expect(circularMeanMinutes([hm(23, 50), hm(0, 10)])).toBe(0)
  })

  it('13:10 and 13:30 average to 13:20 (rounded, not floored to 13:19)', () => {
    expect(circularMeanMinutes([hm(13, 10), hm(13, 30)])).toBe(hm(13, 20))
  })

  it('G8c: 23:30 and 23:50 average to 23:40', () => {
    expect(circularMeanMinutes([hm(23, 30), hm(23, 50)])).toBe(hm(23, 40))
  })

  it('G8d: 06:00 and 18:00 have no average (resultant length 0)', () => {
    expect(circularMeanMinutes([hm(6, 0), hm(18, 0)])).toBeNull()
    const stats = nightStats([
      { id: 'a', sleepStart: '2026-10-20T22:00:00-04:00', wake: '2026-10-21T06:00:00-04:00' },
      { id: 'b', sleepStart: '2026-10-21T09:00:00-04:00', wake: '2026-10-21T18:00:00-04:00' },
    ])
    expect(stats.avgWakeMinutes).toBeNull()
    expect(stats.wakeVaries).toBe(true)
  })

  it('the demo, six complete nights: average wake 13:17 (Python: -643.33 min, wrapped 796.67, rounded 797)', () => {
    expect(nightStats(demoDoc.sleeps).avgWakeMinutes).toBe(hm(13, 17))
  })
})

describe('Demo: the snack on Wednesday', () => {
  it('the snack at Thu 00:40 belongs to the Wednesday day (wake Wed 13:20), with the afternoon meals', () => {
    const snack = demoDoc.meals.find((m) => m.name === 'Apple and peanut butter')!
    expect(wakingDayStart(demoDoc.sleeps, snack.eatenAt)).toBe('2026-10-21T13:20:00-04:00')
    const wed = mealsForDay(demoDoc.meals, demoDoc.sleeps, '2026-10-21T13:20:00-04:00')
    expect(wed.map((m) => m.name)).toContain('Apple and peanut butter')
    expect(wed.map((m) => m.name)).toContain('Kefir with oats and blueberries')
    expect(wakingDayStart(demoDoc.sleeps, demoStartIso)).toBe('2026-10-21T13:20:00-04:00')
  })
})
