// fixtures/demo-week.json against spec.md > Demo Fixture (the fictional person "Sam").
import { describe, expect, it } from 'vitest'
import { wallToLocalIso } from '../../clock'
import { combineDay } from '../estimate'
import { mealsForDay } from '../sleepday'
import { MEAL_SOURCE_IDS } from '../sources'
import { demo, demoDoc, demoStartIso } from './helpers'

// spec.md > Clock > Time zones: fixture times are wall-clock strings with no offset
// (e.g. "2026-10-21T13:20:00"), read as local time and converted on demo start.
const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/
const LOCAL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/
const local = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

/** Every time in a fixture-shaped document, in a fixed order. */
function timesOf(doc: { meals: { eatenAt: string }[]; sleeps: { sleepStart: string | null; wake: string | null }[] }) {
  return [
    ...doc.meals.map((m) => m.eatenAt),
    ...doc.sleeps.flatMap((s) => [s.sleepStart, s.wake]).filter((t): t is string => t !== null),
  ]
}

describe('demo-week.json', () => {
  it('is labelled fictional, for Sam with the fixed gamer tag and targets', () => {
    expect(demo.label).toBe('Sample person — fictional')
    expect(demo.person).toEqual({
      name: 'Sam',
      gamerTag: 'CalmLentil#3108',
      kind: 'demo',
      fictional: true,
      targets: { kcal: 2400, protein: 130 },
    })
  })

  it('starts the demo clock at Thu 2026-10-22 01:30 local', () => {
    expect(demo.clock.start).toBe('2026-10-22T01:30:00')
    const d = new Date(demo.clock.start)
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getDay(), d.getHours(), d.getMinutes()]).toEqual([
      2026, 10, 22, 4, 1, 30,
    ])
    expect(demoStartIso).toBe('2026-10-22T01:30:00-04:00') // converted, in the pinned America/Toronto
  })

  it('every time is a wall-clock string with no offset (spec.md > Clock)', () => {
    const times = [demo.clock.start, ...timesOf(demo), ...demo.workouts.map((w) => w.startedAt)]
    expect(times.length).toBe(1 + demo.meals.length + (7 + 6) + demo.workouts.length) // 7 wakes, 6 sleep starts
    for (const t of times) expect(t).toMatch(WALL_CLOCK)
  })

  it('demo start converts every time to a local-offset ISO string with the same wall-clock reading', () => {
    const raw = [...timesOf(demo), ...demo.workouts.map((w) => w.startedAt)]
    const workouts = demoDoc.workouts as { startedAt: string }[]
    const converted = [...timesOf(demoDoc), ...workouts.map((w) => w.startedAt)]
    expect(converted).toHaveLength(raw.length)
    converted.forEach((iso, i) => {
      expect(iso).toMatch(LOCAL_ISO)
      expect(iso.slice(0, 19)).toBe(raw[i])
      expect(Date.parse(iso)).toBe(new Date(raw[i]).getTime())
    })
    // In the pinned America/Toronto (EDT in October 2026) the offset is -04:00.
    for (const iso of converted) expect(iso.endsWith('-04:00')).toBe(true)
  })

  it('has seven sleep records: wakes 13:00–13:30, sleep starts 04:00–05:00, one with no sleep start', () => {
    expect(demo.sleeps).toHaveLength(7)
    for (const s of demo.sleeps) {
      expect(local(s.wake!)).toBeGreaterThanOrEqual(13 * 60)
      expect(local(s.wake!)).toBeLessThanOrEqual(13 * 60 + 30)
      if (s.sleepStart !== null) {
        expect(local(s.sleepStart)).toBeGreaterThanOrEqual(4 * 60)
        expect(local(s.sleepStart)).toBeLessThanOrEqual(5 * 60)
        expect(Date.parse(s.wake!)).toBeGreaterThan(Date.parse(s.sleepStart))
      }
    }
    const missing = demo.sleeps.filter((s) => s.sleepStart === null)
    expect(missing).toHaveLength(1)
    expect(missing[0].wake).toBe('2026-10-20T13:05:00')
    const wed = demo.sleeps.find((s) => s.wake === '2026-10-21T13:20:00')!
    expect(wed.sleepStart).toBe('2026-10-21T04:35:00')
  })

  it('sleep records are in time order and never overlap', () => {
    for (let i = 1; i < demo.sleeps.length; i++) {
      const prevWake = Date.parse(demo.sleeps[i - 1].wake!)
      const cur = demo.sleeps[i]
      expect(Date.parse(cur.wake!)).toBeGreaterThan(prevWake)
      if (cur.sleepStart) expect(Date.parse(cur.sleepStart)).toBeGreaterThan(prevWake)
    }
  })

  it('covers seven waking days Thu 2026-10-15 to Wed 2026-10-21 with the stated shapes (as loaded)', () => {
    const days = demoDoc.sleeps.map((s) => ({ wake: s.wake!, meals: mealsForDay(demoDoc.meals, demoDoc.sleeps, s.wake!) }))
    expect(days.map((d) => d.wake.slice(0, 10))).toEqual([
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
    ])
    // every meal sits in one of those days, before that day's next sleep start
    expect(days.reduce((n, d) => n + d.meals.length, 0)).toBe(demoDoc.meals.length)
    for (let i = 0; i < days.length - 1; i++) {
      const nextSleep = demoDoc.sleeps[i + 1].sleepStart
      if (nextSleep) for (const m of days[i].meals) expect(Date.parse(m.eatenAt)).toBeLessThan(Date.parse(nextSleep))
    }

    const byDate = Object.fromEntries(days.map((d) => [d.wake.slice(0, 10), d.meals]))
    expect(byDate['2026-10-17']).toEqual([]) // Saturday: nothing logged
    expect(combineDay(byDate['2026-10-17']).status).toBe('empty')

    const fri = combineDay(byDate['2026-10-16']) // Friday: one unknown-calorie meal
    expect(fri.status).toBe('partial')
    expect(fri.unknownMealIds).toHaveLength(1)

    for (const date of ['2026-10-15', '2026-10-18', '2026-10-19', '2026-10-20']) {
      expect(byDate[date].length).toBeGreaterThanOrEqual(2)
      expect(byDate[date].length).toBeLessThanOrEqual(4)
      expect(combineDay(byDate[date]).status).toBe('complete')
    }
    expect(byDate['2026-10-21']).toHaveLength(5)
  })

  it("Wednesday's meals match the spec table", () => {
    // The app picks Wednesday from the converted demo; the table compares the fixture as stored.
    const wedIds = mealsForDay(demoDoc.meals, demoDoc.sleeps, wallToLocalIso('2026-10-21T13:20:00')).map((m) => m.id)
    const wed = wedIds.map((id) => demo.meals.find((m) => m.id === id)!)
    expect(
      wed.map((m) => [m.eatenAt, m.name, m.source, m.kcal, m.protein, m.carbs, m.fat, (m.foods ?? []).map((f) => f.name)]),
    ).toEqual([
      ['2026-10-21T13:50:00', 'Kefir with oats and blueberries', 'label', 410, 20, 62, 9, ['kefir', 'rolled oats', 'blueberries']],
      ['2026-10-21T17:30:00', 'Pasta bake (ready meal)', 'photo', 760, 34, 84, 30, []],
      ['2026-10-21T21:10:00', 'Chicken, rice and broccoli', 'weighed', 480, 44, 50, 10, ['chicken breast', 'white rice', 'broccoli']],
      ['2026-10-21T23:15:00', 'Lentil soup from the café', 'menu', 330, 18, 46, 8, ['lentils', 'onion', 'carrot']],
      ['2026-10-22T00:40:00', 'Apple and peanut butter', 'description', 300, 8, 30, 17, ['apple', 'peanut butter']],
    ])
    expect(wed[0].foods![0]).toEqual({ name: 'kefir', amount: 6, unit: 'oz' })
    expect(wed[1].note).toBe('Label on the box (whole package): 860 kcal, protein 42 g, carbs 96 g, fat 33 g.')
  })

  it("Monday has the brisk walk; Tuesday has the saved barcode lookup (whole package)", () => {
    expect(demo.workouts).toEqual([
      {
        id: 'workout-1019',
        name: 'Brisk walk',
        startedAt: '2026-10-19T18:30:00',
        minutes: 45,
        kcal: 210,
        source: 'burn_device',
      },
    ])
    const tue = mealsForDay(demoDoc.meals, demoDoc.sleeps, wallToLocalIso('2026-10-20T13:05:00'))
    const lookups = tue.filter((m) => m.source === 'label_lookup')
    expect(lookups).toHaveLength(1)
    expect(lookups[0].lookup?.kind).toBe('barcode')
    expect(lookups[0].lookup?.amount.kind).toBe('package')
  })

  it('has the Blue dinner plate, 212 g', () => {
    expect(demo.plates).toEqual([{ id: 'plate-blue', name: 'Blue dinner plate', grams: 212 }])
  })

  it('earlier days mix sources, and most meals list foods', () => {
    const earlier = demo.meals.filter((m) => !m.id.startsWith('wed-'))
    expect(new Set(earlier.map((m) => m.source)).size).toBeGreaterThanOrEqual(5)
    const withFoods = demo.meals.filter((m) => (m.foods ?? []).length > 0).length
    expect(withFoods / demo.meals.length).toBeGreaterThan(0.5)
  })

  it('every meal has a valid shape: unique id, meal source, calories a number or null (never a blank string)', () => {
    const ids = new Set<string>()
    for (const m of demo.meals) {
      expect(ids.has(m.id)).toBe(false)
      ids.add(m.id)
      expect(MEAL_SOURCE_IDS).toContain(m.source)
      for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) {
        expect(m[k] === null || (typeof m[k] === 'number' && m[k]! >= 0)).toBe(true)
      }
    }
  })
})
