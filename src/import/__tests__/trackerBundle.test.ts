// Build-out item 2.1b: the tracker bundle converter, on a fictional bundle for Sam
// (fixtures/tracker-bundle-sam.json: invented foods, times and numbers).
//
// Expected values are worked out by hand from the fixture, not from the code under test:
// - 19 meals on 5 dates (Mon 2026-10-12 to Fri 2026-10-16); 5 sleep records, dated 10-12, 10-13,
//   10-15, 10-16 and 10-17. Wed 2026-10-14 has no sleep record, so it joins Tue 2026-10-13.
// - 10-16's bed time (2026-10-14 23:00) is the same as 10-15's and before 10-15's wake (06:45):
//   wake 07:30 minus 7.5 hours asleep gives 2026-10-16 00:00, after 10-15's wake, so it is used.
// - Untagged: 3000109 (no tag), 3000117 (tag cut off by the truncation), 3000111 (code
//   FRUITBOWL, not one the tracker lists). Truncated: 3000112 (tag mid-text) and 3000117.
// - acc: 3000103 SCALE acc 99 -> 0.01, below the floor 0.2 x hypot(0.07, 0.03) = 0.015232, so
//   the floor applies; 3000113 LABEL acc 100 -> not usable, HowSure's figure applies.
// - Mon 10-12's span: wake 07:00 to the next bed 23:45, 1,005 minutes. Breakfast at 15% =
//   150.75 min -> 09:30; Lunch at 45% = 452.25 min -> 14:30; the Shake between Lunch and Dinner
//   at 58.75% = 590.4 min -> 16:50; Dinner at 72.5% = 728.6 min -> 19:10 (rounded to 5 minutes).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { combineDay, estimateMeal } from '../../kernel/estimate'
import { mealsForDay, wakingDayStart } from '../../kernel/sleepday'
import type { Meal } from '../../kernel/types'
import { logDocSchema, SCHEMA_VERSION } from '../../store/schema'
import {
  convertTrackerBundle,
  errorFromAcc,
  isCalendarDate,
  isTruncated,
  isoAtOffset,
  looksLikeTrackerBundle,
  parseTrackerText,
  placeInSpan,
  shortMealName,
  spanPositions,
  toNum,
  trackerCode,
  trackerMealInfo,
  TRACKER_SOURCES,
  type TrackerReport,
} from '../trackerBundle'

const BUNDLE_TEXT = readFileSync(fileURLToPath(new URL('../../../fixtures/tracker-bundle-sam.json', import.meta.url)), 'utf8')
const bundle = () => JSON.parse(BUNDLE_TEXT) as Record<string, unknown> & { meals: { id: string; data: Record<string, unknown> }[]; sleep: { id: string; updatedAt?: string; data: Record<string, unknown> }[]; weighins: { id: string; data: Record<string, unknown> }[] }

function convert(json: unknown = bundle()) {
  const res = convertTrackerBundle(json)
  if (!res.ok) throw new Error(`refused: ${res.problem} ${res.detail}`)
  return res
}

function mealById(meals: Meal[], rawId: string): Meal {
  const m = meals.find((x) => x.id === `tracker-${rawId}`)
  if (!m) throw new Error(`no meal ${rawId}`)
  return m
}

describe('reading values the tracker’s way', () => {
  it('reads numbers with thousands commas, a lone decimal comma, and unknowns', () => {
    expect(toNum(12)).toBe(12)
    expect(toNum(0)).toBe(0)
    expect(toNum('2,348')).toBe(2348)
    expect(toNum('3,20,000')).toBe(320000)
    expect(toNum('11,4')).toBe(11.4)
    expect(toNum('12,5')).toBe(12.5)
    expect(toNum(' 7.25 ')).toBe(7.25)
    for (const v of ['', '?', null, undefined, 'about 5', '-3', -3, Number.NaN, {}]) expect(toNum(v)).toBeNull()
  })

  it('finds the tag anywhere in the text and takes it out of the description', () => {
    expect(parseTrackerText('Toast [wp1;src=TEXT;acc=62]')).toEqual({ tag: { src: 'TEXT', acc: '62' }, description: 'Toast' })
    expect(parseTrackerText('Soup [wp1; src = LABEL ;acc=90;;bad; =x;na=5] + roll')).toEqual({
      tag: { src: 'LABEL', acc: '90', na: '5' },
      description: 'Soup + roll',
    })
    expect(parseTrackerText('  Rice and beans  ')).toEqual({ tag: null, description: 'Rice and beans' })
    // A value can't hold "]", so a cut-off tag is not a tag.
    expect(parseTrackerText('Salad [wp1;src=LAB').tag).toBeNull()
  })

  it('counts an unusable or unlisted src as UNTAGGED', () => {
    expect(trackerCode(null)).toBe('UNTAGGED')
    expect(trackerCode({ acc: '80' })).toBe('UNTAGGED')
    expect(trackerCode({ src: 'label' })).toBe('UNTAGGED')
    expect(trackerCode({ src: 'FRUITBOWL' })).toBe('UNTAGGED')
    expect(trackerCode({ src: 'CHAIN_BYO' })).toBe('CHAIN_BYO')
  })

  it('takes the typical error from acc with the tracker’s floor, and only for 0 < acc < 100', () => {
    expect(errorFromAcc('PHOTO_CTX', '68')).toEqual({ e: 0.32, floored: false })
    expect(errorFromAcc('LABEL', 91)).toEqual({ e: 0.09, floored: false })
    const floor = errorFromAcc('SCALE', '99')
    expect(floor?.floored).toBe(true)
    expect(floor?.e).toBeCloseTo(0.2 * Math.hypot(0.07, 0.03), 12)
    for (const acc of ['100', '0', '-5', '', '?', undefined, 'high']) expect(errorFromAcc('LABEL', acc)).toBeNull()
  })

  it('names a meal from its first clause, and falls back to its type, then to the name it is given', () => {
    expect(shortMealName('Greek yogurt 200 g with honey (label)', 'Breakfast', 'Meal')).toBe('Greek yogurt')
    expect(shortMealName('Pumpkin barley stew ~380 g (photo of the cafe board) + oat bun x1', 'Lunch', 'Meal')).toBe('Pumpkin barley stew')
    expect(shortMealName('Protein shake, 1 scoop in water', 'Shake', 'Meal')).toBe('Protein shake')
    expect(shortMealName('A very long description of a meal that keeps on going without a break', undefined, 'Meal')).toBe(
      'A very long description of a meal that…',
    )
    expect(shortMealName('', 'Post-Workout', 'Meal')).toBe('Post-Workout')
    expect(shortMealName('', undefined, 'Meal')).toBe('Meal')
  })

  it('flags text the tracker stored cut short', () => {
    expect(isTruncated('Salad with…')).toBe(true)
    expect(isTruncated('Salad with...')).toBe(false)
  })

  it('places Breakfast, Lunch and Dinner in their parts of the day and spreads the rest', () => {
    expect(spanPositions(['Breakfast', 'Lunch', 'Dinner'])).toEqual([0.15, 0.45, 0.725])
    expect(spanPositions(['Snack'])[0]).toBeCloseTo(0.5, 12)
    const [b, snack, d] = spanPositions(['Breakfast', 'Snack', 'Dinner'])
    expect([b, d]).toEqual([0.15, 0.725])
    expect(snack).toBeCloseTo((0.15 + 0.725) / 2, 12)
    // Id order wins over the type: a Breakfast after a Dinner never goes back before it.
    expect(spanPositions(['Dinner', 'Breakfast'])).toEqual([0.725, 0.725])
  })

  it('writes a moment at a given offset', () => {
    expect(isoAtOffset(Date.parse('2026-10-12T13:30:00Z'), -240)).toBe('2026-10-12T09:30:00-04:00')
    expect(isoAtOffset(Date.parse('2026-10-12T13:30:00Z'), 330)).toBe('2026-10-12T19:00:00+05:30')
  })
})

describe('the fictional bundle for Sam', () => {
  const { doc, report } = convert()

  it('is told apart by its shape, and the result passes the log check', () => {
    expect(looksLikeTrackerBundle(bundle())).toBe(true)
    expect(looksLikeTrackerBundle({ version: 1, kind: 'mine' })).toBe(false)
    expect(logDocSchema.safeParse({ version: SCHEMA_VERSION, ...doc }).success).toBe(true)
    expect(doc.kind).toBe('mine')
    expect(doc.profile).toEqual({ name: '', kind: 'guest', targets: { kcal: 2300, protein: 140 } })
  })

  it('reports what it did, for the preview', () => {
    expect(report).toEqual<TrackerReport>({
      meals: 19,
      nights: 5,
      days: 5,
      first: '2026-10-12',
      last: '2026-10-17',
      untagged: 3,
      truncated: 2,
      approximateTimes: 19,
      ownErrors: 16,
      joined: [{ date: '2026-10-14', joinedTo: '2026-10-13' }],
      bedDerived: ['2026-10-16'],
      bedSkipped: [],
      lateWakeDates: [],
      afterExportDates: [],
      skippedMeals: 0,
      unreadableMeals: 0,
      skippedNights: 0,
      repeatedWakes: 0,
      repeatedDates: 0,
      weighins: 2,
      weighinsApproximate: 1,
      weighinsSkipped: 0,
      pending: 1,
      syncSkipped: true,
      targets: { kcal: 2300, protein: 140 },
    })
  })

  it('maps every source code to its HowSure kind', () => {
    const kinds = Object.fromEntries(Object.entries(TRACKER_SOURCES).map(([code, s]) => [code, s.kind]))
    expect(kinds).toEqual({
      SCALE: 'weighed',
      LABEL: 'label',
      CHAIN: 'menu',
      CHAIN_BYO: 'menu',
      NONCHAIN: 'food_db',
      PHOTO_CTX: 'photo',
      PHOTO: 'photo',
      TEXT: 'description',
      GUESS: 'description',
      UNTAGGED: 'description',
    })
    const seen: Record<string, string | null> = {}
    for (const [id, code] of [
      ['3000103', 'SCALE'],
      ['3000101', 'LABEL'],
      ['3000107', 'CHAIN'],
      ['3000104', 'CHAIN_BYO'],
      ['3000106', 'NONCHAIN'],
      ['3000102', 'PHOTO_CTX'],
      ['3000110', 'PHOTO'],
      ['3000105', 'TEXT'],
      ['3000108', 'GUESS'],
      ['3000109', 'UNTAGGED'],
    ] as const) {
      const m = mealById(doc.meals, id)
      expect(trackerMealInfo(m)?.code, id).toBe(code)
      seen[code] = m.source
    }
    expect(seen).toEqual(kinds)
  })

  it('keeps macros as stored: 0 is a known 0 and a missing one is unknown', () => {
    const coffee = mealById(doc.meals, '3000114')
    expect([coffee.kcal, coffee.protein, coffee.carbs, coffee.fat]).toEqual([0, 0, 0, 0])
    const sandwich = mealById(doc.meals, '3000115')
    expect([sandwich.kcal, sandwich.protein, sandwich.carbs, sandwich.fat]).toEqual([530, 31, 48, null])
    // kcal is never worked out from the macros: 4 x 38 + 4 x 92 + 9 x 26 = 754, but 780 is stored.
    expect(mealById(doc.meals, '3000104').kcal).toBe(780)
    // Every meal's macros, as in the file.
    for (const r of bundle().meals) {
      const m = mealById(doc.meals, r.id)
      for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) expect(m[k], `${r.id} ${k}`).toBe(r.data[k] ?? null)
    }
  })

  it('a meal with no tag counts as Description with no source recorded and no tag fields', () => {
    const m = mealById(doc.meals, '3000109')
    expect(m.source).toBe('description')
    expect(m.typicalError).toBeUndefined()
    expect(m.note).toBe('Rice and beans with salsa')
    expect(m.imported).toMatchObject({ from: 'tracker', id: '3000109', code: 'UNTAGGED', untagged: true })
    expect(m.imported?.tag).toBeUndefined()
    expect(trackerMealInfo(m)).toMatchObject({ code: 'UNTAGGED', written: null, untagged: true })
  })

  it('a tag in the middle of a text cut short is read and removed, and the meal is flagged', () => {
    const m = mealById(doc.meals, '3000112')
    expect(m.name).toBe('Baked gnocchi with tomato and basil')
    expect(m.source).toBe('photo')
    expect(m.typicalError).toBeCloseTo(0.29, 12)
    expect(m.note).not.toContain('[wp1')
    expect(m.note?.startsWith('Baked gnocchi with tomato and basil ~350 g (photo, dish on the menu) then a side salad')).toBe(true)
    expect(m.note?.endsWith('…')).toBe(true)
    expect(m.imported).toMatchObject({ truncated: true, code: 'PHOTO_CTX' })
    expect(m.imported?.tag).toEqual({ src: 'PHOTO_CTX', acc: '71', na: '720', sug: '9', fib: '6.5', sat: '4.2', nv: '1:55,3:30,4:15', ik: '0' })
    // The text whose tag was cut off reads as untagged, and is flagged too.
    expect(mealById(doc.meals, '3000117').imported).toMatchObject({ truncated: true, untagged: true })
  })

  it('keeps unknown tag keys and an unlisted code as written', () => {
    const apple = mealById(doc.meals, '3000111')
    expect(apple.imported?.tag).toEqual({ src: 'FRUITBOWL', acc: '88', fib: '4.4', zz: '5', nv: '1:100', ik: '0' })
    expect(trackerMealInfo(apple)).toMatchObject({ code: 'UNTAGGED', written: 'FRUITBOWL' })
    // An unlisted code is counted with UNTAGGED's figures: acc 88 is above its floor.
    expect(apple.typicalError).toBeCloseTo(0.12, 12)
  })

  it('keeps every field of the original record, its id and version', () => {
    const bar = mealById(doc.meals, '3000119')
    expect(bar.imported).toMatchObject({ id: '3000119', version: 2, updatedAt: '2026-10-17T21:00:00.1234Z' })
    expect(bar.imported?.data).toEqual(bundle().meals.find((r) => r.id === '3000119')?.data)
    const recovery = mealById(doc.meals, '3000116')
    expect(recovery.imported?.tag).toMatchObject({ na: '1,50', sug: '12,5', fib: '?', fl: 'NSS+COL', nss: 'suc8,ack40' })
  })

  it('uses the tracker’s acc for the meal’s typical error, with its floor', () => {
    expect(mealById(doc.meals, '3000101').typicalError).toBeCloseTo(0.09, 12)
    expect(estimateMeal(mealById(doc.meals, '3000101'))?.score).toBe(91)
    const shake = mealById(doc.meals, '3000103')
    expect(shake.typicalError).toBeCloseTo(0.015232, 6)
    expect(shake.imported?.errorFloored).toBe(true)
    expect(estimateMeal(shake)?.score).toBe(98)
    // acc=100 is not usable: HowSure's figure for a typed label (10%) applies.
    const oats = mealById(doc.meals, '3000113')
    expect(oats.typicalError).toBeUndefined()
    expect(estimateMeal(oats)?.e).toBe(0.1)
  })

  it('marks every time approximate and places Monday’s meals in its waking span', () => {
    expect(doc.meals.every((m) => m.timeApproximate === true)).toBe(true)
    const monday = ['3000101', '3000102', '3000103', '3000104'].map((id) => mealById(doc.meals, id).eatenAt)
    expect(monday).toEqual([
      '2026-10-12T09:30:00-04:00',
      '2026-10-12T14:30:00-04:00',
      '2026-10-12T16:50:00-04:00',
      '2026-10-12T19:10:00-04:00',
    ])
  })

  it('keeps every meal on its own date’s waking day, or the day it joins, in id order', () => {
    const wakeOf = new Map(doc.sleeps.map((s) => [(s.imported?.data as { date: string }).date, s.wake]))
    for (const m of doc.meals) {
      const info = trackerMealInfo(m)
      const day = info?.joinedTo ?? info?.date
      expect(wakingDayStart(doc.sleeps, m.eatenAt), m.id).toBe(wakeOf.get(day as string))
    }
    for (const s of doc.sleeps) {
      const ids = mealsForDay(doc.meals, doc.sleeps, s.wake).map((m) => Number(m.id.replace('tracker-', '')))
      expect(ids).toEqual([...ids].sort((a, b) => a - b))
    }
  })

  it('a joined date whose next night starts that same evening keeps its meals before that bed time', () => {
    // Thursday's night now starts at 7:00 PM on Wednesday, the joined date: a dinner placed by its
    // type alone would fall after it, on Thursday's waking day.
    const b = bundle()
    const thu = b.sleep.find((r) => r.id === '2026-10-15') as { data: Record<string, unknown> }
    thu.data = { ...thu.data, bed: '2026-10-14T19:00:00-04:00', hours: 11 }
    const res = convert(b)
    expect(res.report.bedDerived).not.toContain('2026-10-15')
    const wed = ['3000110', '3000111', '3000112'].map((id) => mealById(res.doc.meals, id))
    for (const m of wed) {
      expect(Date.parse(m.eatenAt)).toBeLessThan(Date.parse('2026-10-14T19:00:00-04:00'))
      expect(wakingDayStart(res.doc.sleeps, m.eatenAt)).toBe('2026-10-13T07:15:00-04:00')
    }
  })

  it('a date with no sleep record joins the day before, on its own calendar date, after that day’s meals', () => {
    const wed = ['3000110', '3000111', '3000112'].map((id) => mealById(doc.meals, id))
    for (const m of wed) {
      expect(m.eatenAt.slice(0, 10)).toBe('2026-10-14')
      expect(m.imported?.joinedTo).toBe('2026-10-13')
    }
    const tue = mealsForDay(doc.meals, doc.sleeps, '2026-10-13T07:15:00-04:00')
    expect(tue.map((m) => m.id)).toEqual(['3000105', '3000106', '3000107', '3000108', '3000109', '3000110', '3000111', '3000112'].map((id) => `tracker-${id}`))
    // The joined day's total is the sum of both dates: 410 + 690 + 340 + 200 + 640 and 560 + 95 + 690.
    expect(combineDay(tue).knownTotal).toBe(2280 + 1345)
    // Every date's total is kept.
    const byDate = new Map<string, number>()
    for (const m of doc.meals) {
      const d = trackerMealInfo(m)?.date as string
      byDate.set(d, (byDate.get(d) ?? 0) + (m.kcal ?? 0))
    }
    expect(Object.fromEntries(byDate)).toEqual({
      '2026-10-12': 1680,
      '2026-10-13': 2280,
      '2026-10-14': 1345,
      '2026-10-15': 1940,
      '2026-10-16': 760,
    })
  })

  it('one sleep per wake date, with the overlapping bed time worked out from the record and flagged', () => {
    expect(doc.sleeps.map((s) => [s.id, s.sleepStart, s.wake])).toEqual([
      ['tracker-sleep-2026-10-12', '2026-10-11T23:30:00-04:00', '2026-10-12T07:00:00-04:00'],
      ['tracker-sleep-2026-10-13', '2026-10-12T23:45:00-04:00', '2026-10-13T07:15:00-04:00'],
      ['tracker-sleep-2026-10-15', '2026-10-14T23:00:00-04:00', '2026-10-15T06:45:00-04:00'],
      ['tracker-sleep-2026-10-16', '2026-10-16T00:00:00-04:00', '2026-10-16T07:30:00-04:00'],
      ['tracker-sleep-2026-10-17', '2026-10-16T23:10:00-04:00', '2026-10-17T08:00:00-04:00'],
    ])
    const fri = doc.sleeps[3]
    expect(fri.imported).toMatchObject({ from: 'tracker', id: '2026-10-16', version: 2, bedDerived: 'wake minus hours' })
    expect((fri.imported?.data as { bed: string }).bed).toBe('2026-10-14T23:00:00-04:00')
  })

  it('leaves an overlapping bed time out when the record can’t give one, and says so', () => {
    const b = bundle()
    // Hours asleep longer than the time since the night before's wake: no bed time fits.
    const fri = b.sleep.find((s) => s.id === '2026-10-16') as { data: Record<string, unknown> }
    fri.data.hours = 30
    const res = convert(b)
    expect(res.report.bedSkipped).toEqual(['2026-10-16'])
    expect(res.report.bedDerived).toEqual([])
    const s = res.doc.sleeps.find((x) => x.id === 'tracker-sleep-2026-10-16')
    expect(s?.sleepStart).toBeNull()
    expect(s?.imported?.bedSkipped).toBe('overlaps the night before')
  })

  it('turns the weigh-ins into the weight log: exact lb to kg, body fat kept, the recorded time or one placed and marked', () => {
    expect(doc.weighIns).toEqual([
      // Its record has a time: 7:20 AM on its own date.
      {
        id: 'weighin-tracker-2026-10-12',
        at: '2026-10-12T07:20:00-04:00',
        kg: 158.4 * 0.45359237,
        unit: 'lb',
        bodyFatPct: 21.5,
        imported: bundle().weighins[0].data,
      },
      // No time: one minute after that date's 7:30 AM wake, so it sits in the waking day it was filed on.
      {
        id: 'weighin-tracker-2026-10-16',
        at: '2026-10-16T07:31:00-04:00',
        kg: 157.9 * 0.45359237,
        unit: 'lb',
        timeApproximate: true,
        imported: bundle().weighins[1].data,
      },
    ])
    expect(doc.settings).toEqual({ weightUnit: 'lb' })
    expect(wakingDayStart(doc.sleeps, doc.weighIns?.[1].at ?? '')).toBe('2026-10-16T07:30:00-04:00')
    // Nothing is kept twice: the weigh-ins live in the weight log only.
    expect('weighins' in (doc.imported as object)).toBe(false)
  })

  it('places an untimed weigh-in on a date with no wake at noon, and leaves out one with no weight, reported', () => {
    const b = bundle()
    b.weighins.push({ id: '2026-10-14', data: { date: '2026-10-14', lb: 158 } }, { id: '2026-10-15', data: { date: '2026-10-15', bf: 21 } })
    const res = convert(b)
    expect(res.doc.weighIns?.find((w) => w.id === 'weighin-tracker-2026-10-14')).toMatchObject({ at: '2026-10-14T12:00:00-04:00', timeApproximate: true })
    expect(res.doc.weighIns).toHaveLength(3)
    expect(res.report).toMatchObject({ weighins: 3, weighinsApproximate: 2, weighinsSkipped: 1 })
  })

  it('a bundle with no weigh-ins adds none and leaves the weight unit unset', () => {
    const b = bundle()
    b.weighins = []
    const res = convert(b)
    expect('weighIns' in res.doc).toBe(false)
    expect('settings' in res.doc).toBe(false)
    expect(res.report).toMatchObject({ weighins: 0, weighinsApproximate: 0, weighinsSkipped: 0 })
  })

  it('keeps the targets document, and skips pending plates and sync notes', () => {
    const imported = doc.imported as Record<string, unknown>
    expect(imported.from).toBe('tracker')
    expect((imported.targets as { id: string }).id).toBe('targets')
    expect(JSON.stringify(doc)).not.toContain('Plate photo, not eaten yet')
    expect(JSON.stringify(doc)).not.toContain('sleep-read')
  })

  it('orders meals within a day by numeric id, whatever order the file lists them in', () => {
    const b = bundle()
    b.meals.reverse()
    expect(convert(b).doc.meals.map((m) => [m.id, m.eatenAt])).toEqual(doc.meals.map((m) => [m.id, m.eatenAt]))
  })

  it('a meal with no calories stays unknown, never 0, and a date with no meals adds no day', () => {
    const b = bundle()
    delete b.meals[0].data.kcal
    const m = mealById(convert(b).doc.meals, '3000101')
    expect(m.kcal).toBeNull()
    expect(estimateMeal(m)).toBeNull()
  })

  it('a meal with no usable date is left out and counted', () => {
    const b = bundle()
    b.meals[0].data.date = 'Monday'
    const res = convert(b)
    expect(res.report.skippedMeals).toBe(1)
    expect(res.doc.meals).toHaveLength(18)
  })

  it('a date that is not on the calendar (month 13, 30 February) is left out too, never rolled into a later month', () => {
    for (const date of ['2026-13-45', '2026-02-30', '2026-10-00']) {
      const b = bundle()
      b.meals[0].data.date = date
      const res = convert(b)
      expect(res.report.skippedMeals, date).toBe(1)
      expect(res.doc.meals, date).toHaveLength(18)
      expect(res.report.last, date).toBe('2026-10-17')
    }
    expect(isCalendarDate('2028-02-29')).toBe(true)
    expect(isCalendarDate('2026-02-29')).toBe(false)
  })

  it('a date before the first wake is placed on its own date, before that wake', () => {
    const b = bundle()
    b.meals.push({ id: '2999999', data: { id: '2999999', date: '2026-10-10', type: 'Lunch', kcal: 300, protein: 10, carbs: 40, fat: 9, text: 'Bagel', saved: '2026-10-10T13:00:00-04:00' } } as never)
    const res = convert(b)
    expect(res.report.joined[0]).toEqual({ date: '2026-10-10', joinedTo: null })
    const bagel = mealById(res.doc.meals, '2999999')
    expect(bagel.eatenAt.slice(0, 10)).toBe('2026-10-10')
    expect(wakingDayStart(res.doc.sleeps, bagel.eatenAt)).toBeNull()
  })

  it('refuses other shapes and other versions with a reason', () => {
    expect(convertTrackerBundle({ ...bundle(), formatVersion: 2 })).toMatchObject({ ok: false, problem: 'trackerVersion' })
    expect(convertTrackerBundle({ format: 'tracker-bundle', formatVersion: 1, meals: 'none', sleep: [] })).toMatchObject({
      ok: false,
      problem: 'trackerUnreadable',
    })
    expect(convertTrackerBundle({ format: 'tracker-bundle', formatVersion: 1 })).toMatchObject({ ok: false, problem: 'trackerUnreadable' })
    expect(convertTrackerBundle([])).toMatchObject({ ok: false, problem: 'trackerUnreadable' })
  })
})

describe('edge cases the fix round asked about', () => {
  const meal = (id: string, date: string, extra: Record<string, unknown> = {}) =>
    ({ id, data: { id, date, type: 'Snack', kcal: 100, protein: 5, carbs: 10, fat: 3, text: `Rice cake ${id}`, ...extra } }) as never

  it('gives a repeated record id its own meal id, so Edit and Delete reach one meal', () => {
    const b = bundle()
    b.meals.push(meal('3000101', '2026-10-12'))
    const ids = convert(b).doc.meals.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('tracker-3000101')
    expect(ids).toContain('tracker-3000101-2')
  })

  it('packs meals closer in a very short span so none lands inside the next sleep', () => {
    const from = Date.parse('2026-10-12T23:30:00-04:00')
    const to = Date.parse('2026-10-13T00:00:00-04:00')
    const times = placeInSpan(from, to, Array.from({ length: 40 }, () => 'Snack'))
    expect(times).toHaveLength(40)
    for (let i = 0; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(from)
      expect(times[i]).toBeLessThan(to)
      if (i > 0) expect(times[i]).toBeGreaterThan(times[i - 1])
    }
  })

  it('places 40 meals on a date woken at 23:30 before the next bed time at midnight', () => {
    const b = bundle()
    b.sleep = [
      { id: '2026-10-12', data: { date: '2026-10-12', bed: '2026-10-11T23:00:00-04:00', wake: '2026-10-12T23:30:00-04:00', hours: 8 } },
      { id: '2026-10-13', data: { date: '2026-10-13', bed: '2026-10-13T00:00:00-04:00', wake: '2026-10-13T08:00:00-04:00', hours: 8 } },
    ]
    b.meals = Array.from({ length: 40 }, (_, i) => meal(String(4000000 + i), '2026-10-12'))
    const res = convert(b)
    const bed = Date.parse('2026-10-13T00:00:00-04:00')
    for (const m of res.doc.meals) expect(Date.parse(m.eatenAt)).toBeLessThan(bed)
    expect(res.doc.meals.every((m) => wakingDayStart(res.doc.sleeps, m.eatenAt) === '2026-10-12T23:30:00-04:00')).toBe(true)
  })

  it('places no meal after the export, nor after the now it is given', () => {
    const b = bundle()
    // Saturday's wake at 08:00 has no next night; two meals that day, exported at 10:00.
    b.exportedAt = '2026-10-17T10:00:00-04:00'
    b.meals.push(meal('3000201', '2026-10-17', { type: 'Breakfast' }), meal('3000202', '2026-10-17', { type: 'Dinner' }))
    const sat = convert(b).doc.meals.filter((m) => m.id === 'tracker-3000201' || m.id === 'tracker-3000202')
    expect(sat).toHaveLength(2)
    for (const m of sat) expect(Date.parse(m.eatenAt)).toBeLessThanOrEqual(Date.parse('2026-10-17T10:00:00-04:00'))
    expect(Date.parse(sat[0].eatenAt)).toBeGreaterThanOrEqual(Date.parse('2026-10-17T08:00:00-04:00'))

    delete b.exportedAt
    const res = convertTrackerBundle(b, { nowIso: '2026-10-17T09:00:00-04:00' })
    if (!res.ok) throw new Error('should convert')
    for (const id of ['tracker-3000201', 'tracker-3000202']) {
      const m = res.doc.meals.find((x) => x.id === id)
      expect(Date.parse(m!.eatenAt)).toBeLessThanOrEqual(Date.parse('2026-10-17T09:00:00-04:00'))
    }
  })

  it('lists a date whose late wake puts meals after midnight', () => {
    const b = bundle()
    const sat = b.sleep.find((s) => s.id === '2026-10-17') as { data: Record<string, unknown> }
    sat.data.wake = '2026-10-17T21:30:00-04:00'
    b.exportedAt = '2026-10-18T20:00:00-04:00'
    b.meals.push(meal('3000201', '2026-10-17', { type: 'Lunch' }), meal('3000202', '2026-10-17', { type: 'Dinner' }))
    const res = convert(b)
    expect(res.report.lateWakeDates).toEqual(['2026-10-17'])
    expect(convert().report.lateWakeDates).toEqual([])
  })

  it('tells a meal with no date from one with a field of the wrong kind', () => {
    const b = bundle()
    b.meals[0].data.type = 3
    b.meals[1].data.kcal = { value: 500 }
    delete b.meals[2].data.date
    const res = convert(b)
    expect(res.report.unreadableMeals).toBe(2)
    expect(res.report.skippedMeals).toBe(1)
    expect(res.doc.meals).toHaveLength(16)
  })

  it('tells a night with no usable wake time from a repeated wake time', () => {
    const b = bundle()
    // Filed under a later date, but with Saturday's wake time: one night can't be two records.
    b.sleep.push({ id: '2026-10-19', data: { date: '2026-10-19', bed: '2026-10-16T23:00:00-04:00', wake: '2026-10-17T08:00:00-04:00', hours: 8 } })
    b.sleep.push({ id: '2026-10-18', data: { date: '2026-10-18', wake: '2026-10-18T08:00:00' } })
    const res = convert(b)
    expect(res.report.repeatedWakes).toBe(1)
    expect(res.report.skippedNights).toBe(1)
    expect(res.report.repeatedDates).toBe(0)
    expect(res.report.nights).toBe(5)
  })

  it('keeps one night per wake date: the record written last, reporting the other', () => {
    const b = bundle()
    // A second record for Saturday 17 Oct with a different wake, written after the first.
    b.sleep.push({
      id: '2026-10-17b',
      updatedAt: '2026-10-18T09:00:00-04:00',
      data: { date: '2026-10-17', bed: '2026-10-16T23:40:00-04:00', wake: '2026-10-17T08:30:00-04:00', hours: 8 },
    })
    const res = convert(b)
    expect(res.report.repeatedDates).toBe(1)
    expect(res.report.nights).toBe(5)
    const sat = res.doc.sleeps.filter((x) => x.wake?.startsWith('2026-10-17'))
    expect(sat.map((x) => x.wake)).toEqual(['2026-10-17T08:30:00-04:00'])
    // Written earlier than the one already there: the one already there is kept.
    const c = bundle()
    c.sleep.push({ id: '2026-10-17b', updatedAt: '2000-01-01T00:00:00Z', data: { date: '2026-10-17', wake: '2026-10-17T08:30:00-04:00' } })
    const kept = convert(c).doc.sleeps.filter((x) => x.wake?.startsWith('2026-10-17'))
    expect(kept.map((x) => x.wake)).toEqual(['2026-10-17T08:00:00-04:00'])
  })

  it('keeps a meal dated after the export on its own date, and names the date in the report', () => {
    const b = bundle()
    // Sunday 18 Oct has no night and comes after the export (Sat 17 Oct).
    b.meals.push({ id: '3000199', data: { date: '2026-10-18', type: 'lunch', kcal: 400, text: 'Tomato soup [wp1;src=TEXT;acc=70]' } })
    const res = convert(b)
    expect(res.report.afterExportDates).toEqual(['2026-10-18'])
    const soup = res.doc.meals.find((m) => m.id === 'tracker-3000199')
    expect(soup?.eatenAt.slice(0, 10)).toBe('2026-10-18')
    expect(convert().report.afterExportDates).toEqual([])
  })

  it('says when a bed time is not before its own wake', () => {
    const b = bundle()
    const fri = b.sleep.find((s) => s.id === '2026-10-16') as { data: Record<string, unknown> }
    fri.data.bed = '2026-10-16T08:00:00-04:00'
    fri.data.hours = 30
    const s = convert(b).doc.sleeps.find((x) => x.id === 'tracker-sleep-2026-10-16')
    expect(s?.sleepStart).toBeNull()
    expect(s?.imported?.bedSkipped).toBe('not before its wake')
  })

  it('names a meal with no words by the name it is given, else by its record id', () => {
    const b = bundle()
    b.meals[0].data.text = ''
    delete b.meals[0].data.type
    expect(mealById(convert(b).doc.meals, '3000101').name).toBe('#3000101')
    const res = convertTrackerBundle(b, { mealFallbackName: 'Meal' })
    if (!res.ok) throw new Error('should convert')
    expect(mealById(res.doc.meals, '3000101').name).toBe('Meal')
  })
})
