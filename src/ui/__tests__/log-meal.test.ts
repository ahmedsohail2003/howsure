// Slice 3: Log a meal, Meal details, Edit and Delete, and days with unknown calories.
// prd.md > Logging a Meal, > Calorie Input Rules, > Days With Unknown Calories,
// > Meal Details, Edit and Delete, > States and Boundaries. Expected day values come from
// spec.md's formulas, computed separately in Python (not from this code).
import { describe, expect, it } from 'vitest'
import { estimateMeal, isKnownMeal } from '../../kernel/estimate'
import { wakingDayStart } from '../../kernel/sleepday'
import type { Meal, SleepRecord } from '../../kernel/types'
import { demoDoc, demoStartIso } from '../../kernel/__tests__/helpers'
import { emptyLog, type LogDoc } from '../../store/log'
import { buildDayView } from '../dayView'
import {
  blankMeal,
  checkDraft,
  defaultMealTime,
  draftFromMeal,
  newMealId,
  withMeal,
  withoutMeal,
  type MealDraft,
} from '../editMeal'

const round = (r: { lo: number; hi: number } | null) => (r ? [Math.round(r.lo), Math.round(r.hi)] : null)

function summary(doc: LogDoc, at: string) {
  const v = buildDayView(doc, at)
  return {
    status: v.day.status,
    total: v.day.knownTotal,
    score: v.day.score,
    likely: round(v.day.likely),
    veryLikely: round(v.day.veryLikely),
    biggest: v.biggest?.name ?? null,
    unknown: v.day.unknownMealIds.length,
    ranked: v.day.contributions.length,
  }
}

const WED_START = '2026-10-21T13:20:00-04:00'
const AT = demoStartIso // Thu 2026-10-22 01:30, still on Wednesday's waking day
const blank = blankMeal('new-1', '2026-10-22T01:30:00-04:00')
const fresh = draftFromMeal(blank)

function draft(over: Partial<MealDraft>): MealDraft {
  return { ...fresh, ...over }
}

describe('a new meal starts blank, never 0, with no source picked', () => {
  it('the blank meal and its draft', () => {
    expect(blank).toEqual({
      id: 'new-1',
      name: '',
      eatenAt: '2026-10-22T01:30:00-04:00',
      source: null,
      kcal: null,
      protein: null,
      carbs: null,
      fat: null,
    })
    expect(fresh).toEqual({
      name: '',
      source: null,
      kcal: '',
      eatenAtLocal: '2026-10-22T01:30',
      protein: '',
      carbs: '',
      fat: '',
      note: '',
    })
  })

  it('new ids are unique', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newMealId()))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^meal-/)
  })

  it('an untouched sheet cannot be saved: the meal needs a name', () => {
    const c = checkDraft(fresh, blank)
    expect(c.meal).toBeNull()
    expect(Object.keys(c.errors)).toEqual(['name'])
  })
})

describe('Calorie Input Rules in a new meal', () => {
  it('blank calories save as unknown, and with calories blank the source can stay empty', () => {
    const c = checkDraft(draft({ name: 'Leftover soup' }), blank)
    expect(c.errors).toEqual({})
    expect(c.meal).toEqual({ ...blank, name: 'Leftover soup' })
    expect(c.meal?.kcal).toBeNull()
    expect(c.meal?.source).toBeNull()
    expect(isKnownMeal(c.meal as Meal)).toBe(false)
    expect(estimateMeal(c.meal as Meal)).toBeNull()
  })

  it('calories without a source keep Save blocked with the hint', () => {
    const c = checkDraft(draft({ name: 'Toast', kcal: '150' }), blank)
    expect(c.meal).toBeNull()
    expect(c.errors).toEqual({ source: 'Pick how you know, so HowSure can say how sure.' })
  })

  it('with a source picked it saves, and blank protein, carbs and fat are unknown, never 0', () => {
    const c = checkDraft(draft({ name: 'Toast', kcal: '150', source: 'label' }), blank)
    expect(c.meal).toEqual({ ...blank, name: 'Toast', kcal: 150, source: 'label' })
    expect(c.meal).toMatchObject({ protein: null, carbs: null, fat: null })
  })

  it('a typed 0 is a real zero, distinct from blank', () => {
    expect(checkDraft(draft({ name: 'Black coffee', kcal: '0', source: 'label' }), blank).meal?.kcal).toBe(0)
    expect(checkDraft(draft({ name: 'Black coffee', kcal: '0', source: 'label', protein: '0' }), blank).meal?.protein).toBe(0)
  })

  it('"abc" and "-50" block Save with the inline message; the other fields are untouched', () => {
    for (const kcal of ['abc', '-50']) {
      const d = draft({ name: 'Toast', kcal, source: 'label', eatenAtLocal: '2026-10-21T19:00' })
      const before = structuredClone(d)
      const c = checkDraft(d, blank)
      expect(c.meal).toBeNull()
      expect(c.errors).toEqual({ kcal: 'Use digits, e.g. 1501 or 13.9' })
      expect(d).toEqual(before)
    }
  })

  it('"1,501" and "13,9" read as 1501 and 13.9', () => {
    const c = checkDraft(draft({ name: 'Big plate', kcal: '1,501', source: 'menu', fat: '13,9' }), blank)
    expect(c.meal).toMatchObject({ kcal: 1501, fat: 13.9 })
  })

  it('an unchanged date and time keeps the blank meal’s own time', () => {
    expect(checkDraft(draft({ name: 'Toast' }), blank).meal?.eatenAt).toBe(blank.eatenAt)
    expect(checkDraft(draft({ name: 'Toast', eatenAtLocal: '2026-10-20T18:00' }), blank).meal?.eatenAt).toBe(
      '2026-10-20T18:00:00-04:00',
    )
  })
})

describe('saving, editing and deleting change the day from the real calculation', () => {
  const before = structuredClone(demoDoc)

  it('the demo Wednesday starts at G11', () => {
    expect(summary(demoDoc, AT)).toEqual({
      status: 'complete',
      total: 2280,
      score: 83,
      likely: [1870, 2780],
      veryLikely: [1684, 3087],
      biggest: 'Pasta bake (ready meal)',
      unknown: 0,
      ranked: 5,
    })
  })

  it('logging a 900 kcal photo-estimate ramen adds it and makes it the biggest contributor', () => {
    const ramen: Meal = { ...blank, id: 'ramen', name: 'Late-night ramen', source: 'photo', kcal: 900 }
    const next = withMeal(demoDoc, ramen)
    expect(next.meals).toHaveLength(demoDoc.meals.length + 1)
    expect(next.meals.at(-1)).toEqual(ramen)
    expect(summary(next, AT)).toEqual({
      status: 'complete',
      total: 3180,
      score: 76,
      likely: [2402, 4210],
      veryLikely: [2070, 4885],
      biggest: 'Late-night ramen',
      unknown: 0,
      ranked: 6,
    })
  })

  it("editing the pasta bake's calories to 900 replaces it in place", () => {
    const pasta = demoDoc.meals.find((m) => m.name === 'Pasta bake (ready meal)') as Meal
    const next = withMeal(demoDoc, { ...pasta, kcal: 900 })
    expect(next.meals).toHaveLength(demoDoc.meals.length)
    expect(next.meals.findIndex((m) => m.id === pasta.id)).toBe(demoDoc.meals.findIndex((m) => m.id === pasta.id))
    expect(summary(next, AT)).toMatchObject({ total: 2420, score: 82, likely: [1953, 2999], veryLikely: [1743, 3360] })
  })

  it('deleting the pasta bake removes it from the list and from every total', () => {
    const pasta = demoDoc.meals.find((m) => m.name === 'Pasta bake (ready meal)') as Meal
    const next = withoutMeal(demoDoc, pasta.id)
    expect(next.meals.some((m) => m.id === pasta.id)).toBe(false)
    expect(summary(next, AT)).toEqual({
      status: 'complete',
      total: 1520,
      score: 90,
      likely: [1345, 1717],
      veryLikely: [1261, 1832],
      biggest: 'Apple and peanut butter',
      unknown: 0,
      ranked: 4,
    })
    const v = buildDayView(next, AT)
    expect(v.macros.protein.known).toBe(124 - 34)
    expect(v.macros.carbs.known).toBe(272 - 84)
    expect(v.macros.fat.known).toBe(74 - 30)
  })

  it('a 0 kcal meal shows 0 and does not make the day incomplete', () => {
    const coffee: Meal = { ...blank, id: 'coffee', name: 'Black coffee', source: 'label', kcal: 0 }
    const s = summary(withMeal(demoDoc, coffee), AT)
    expect(s).toEqual({ ...summary(demoDoc, AT), ranked: 6 })
    expect(s.status).toBe('complete')
  })

  it('the log itself is never changed', () => {
    expect(demoDoc).toEqual(before)
  })
})

describe('Days With Unknown Calories (prd.md)', () => {
  const soup: Meal = { ...blank, id: 'soup', name: 'Leftover soup' }

  it('one unknown among known: known meals only, 1 unknown, ranked list has only the known meals', () => {
    expect(summary(withMeal(demoDoc, soup), AT)).toEqual({
      status: 'partial',
      total: 2280,
      score: 83,
      likely: [1870, 2780],
      veryLikely: [1684, 3087],
      biggest: 'Pasta bake (ready meal)',
      unknown: 1,
      ranked: 5,
    })
    const v = buildDayView(withMeal(demoDoc, soup), AT)
    expect(v.day.unknownMealIds).toEqual(['soup'])
    expect(v.day.contributions.some((c) => c.mealId === 'soup')).toBe(false)
  })

  it('every meal unknown: listed, counted, and nothing to compute ("Not available yet")', () => {
    const doc: LogDoc = {
      ...emptyLog(),
      meals: [
        { ...soup, eatenAt: '2026-10-26T12:00:00-04:00' },
        { ...soup, id: 'stew', name: 'Stew', source: 'description', eatenAt: '2026-10-26T18:00:00-04:00' },
      ],
    }
    expect(summary(doc, '2026-10-26T20:00:00-04:00')).toEqual({
      status: 'all-unknown',
      total: 0,
      score: null,
      likely: null,
      veryLikely: null,
      biggest: null,
      unknown: 2,
      ranked: 0,
    })
  })

  it('nothing logged is "empty", not "all unknown"', () => {
    expect(summary(emptyLog(), '2026-10-26T20:00:00-04:00')).toMatchObject({ status: 'empty', score: null, unknown: 0 })
  })

  it('a day of only 0 kcal meals is known (0 kcal) with no score or range to divide out', () => {
    const doc: LogDoc = {
      ...emptyLog(),
      meals: [{ ...blank, id: 'tea', name: 'Tea', source: 'label', kcal: 0, eatenAt: '2026-10-26T12:00:00-04:00' }],
    }
    expect(summary(doc, '2026-10-26T20:00:00-04:00')).toMatchObject({
      status: 'complete',
      total: 0,
      score: null,
      likely: null,
      unknown: 0,
    })
  })
})

describe('defaultMealTime: now, or the viewed waking day (prd.md > Logging a Meal)', () => {
  const sleeps = demoDoc.sleeps

  it('on the waking day that contains now, it is now, cut to the minute', () => {
    expect(defaultMealTime(sleeps, WED_START, AT)).toBe('2026-10-22T01:30:00-04:00')
    expect(defaultMealTime([], null, '2026-10-26T09:41:27-04:00')).toBe('2026-10-26T09:41:00-04:00')
  })

  it("logging from Tuesday at 01:30 lands on Tuesday's waking day, after midnight", () => {
    const tue = '2026-10-20T13:05:00-04:00'
    const t = defaultMealTime(sleeps, tue, AT)
    expect(t).toBe('2026-10-21T01:30:00-04:00')
    expect(wakingDayStart(sleeps, t)).toBe(tue)
  })

  it("logging from Tuesday at 20:00 keeps Tuesday's date", () => {
    const tue = '2026-10-20T13:05:00-04:00'
    const t = defaultMealTime(sleeps, tue, '2026-10-22T20:00:00-04:00')
    expect(t).toBe('2026-10-20T20:00:00-04:00')
    expect(wakingDayStart(sleeps, t)).toBe(tue)
  })

  it('every earlier demo day gets a time inside its own waking day', () => {
    for (const r of sleeps) {
      if (!r.wake || r.wake === WED_START) continue
      for (const now of [AT, '2026-10-22T14:45:00-04:00', '2026-10-22T23:59:00-04:00']) {
        expect(wakingDayStart(sleeps, defaultMealTime(sleeps, r.wake, now))).toBe(r.wake)
      }
    }
  })

  it('the provisional day (before the first wake) gets a time before that wake', () => {
    const t = defaultMealTime(sleeps, null, AT)
    expect(t).toBe('2026-10-15T01:30:00-04:00')
    expect(wakingDayStart(sleeps, t)).toBeNull()
    expect(wakingDayStart(sleeps, defaultMealTime(sleeps, null, '2026-10-22T20:00:00-04:00'))).toBeNull()
  })

  it("when now's clock time fits neither date, it falls back to the day's wake", () => {
    const short: SleepRecord[] = [
      { id: 'a', sleepStart: null, wake: '2026-10-10T13:00:00-04:00' },
      { id: 'b', sleepStart: '2026-10-11T04:00:00-04:00', wake: '2026-10-11T12:00:00-04:00' },
    ]
    expect(defaultMealTime(short, '2026-10-10T13:00:00-04:00', '2026-10-26T12:30:00-04:00')).toBe(
      '2026-10-10T13:00:00-04:00',
    )
  })
})
