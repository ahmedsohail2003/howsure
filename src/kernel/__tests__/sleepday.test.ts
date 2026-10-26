// sleepday.ts, minimal for slice 1 (spec.md > Maths Core: Waking Days and Sleep).
import { describe, expect, it } from 'vitest'
import { mealsForDay, nextWakeAfter, wakingDayStart } from '../sleepday'
import type { SleepRecord } from '../types'
import { demoDoc, demoStartIso, meal } from './helpers'

describe('time zone pin (tests/vitest.setup.ts)', () => {
  it('runs in America/Toronto (EDT, UTC-4, in October 2026)', () => {
    expect(process.env.TZ).toBe('America/Toronto')
    expect(new Date('2026-10-21T13:20:00').getTimezoneOffset()).toBe(240)
    expect(new Date('2026-10-21T13:20:00-04:00').getHours()).toBe(13)
  })
})

// demoDoc is the demo as the app loads it: the fixture's wall-clock times converted to
// local-offset ISO strings (spec.md > Clock), so "-04:00" here comes from the Toronto pin.
describe('wakingDayStart', () => {
  it('the demo clock (Thu 01:30) is still on Wednesday: wake Wed 13:20', () => {
    expect(wakingDayStart(demoDoc.sleeps, demoStartIso)).toBe('2026-10-21T13:20:00-04:00')
  })

  it('the 00:40 snack belongs to Wednesday', () => {
    const snack = demoDoc.meals.find((m) => m.name === 'Apple and peanut butter')!
    expect(snack.eatenAt).toBe('2026-10-22T00:40:00-04:00')
    expect(wakingDayStart(demoDoc.sleeps, snack.eatenAt)).toBe('2026-10-21T13:20:00-04:00')
  })

  it('a wake time counts as the start of its own day (latest wake <= at)', () => {
    expect(wakingDayStart(demoDoc.sleeps, '2026-10-20T13:05:00-04:00')).toBe('2026-10-20T13:05:00-04:00')
    expect(wakingDayStart(demoDoc.sleeps, '2026-10-20T13:04:59-04:00')).toBe('2026-10-19T13:15:00-04:00')
  })

  it('null before the first wake, or with no wakes', () => {
    expect(wakingDayStart(demoDoc.sleeps, '2026-10-14T20:00:00-04:00')).toBeNull()
    expect(wakingDayStart([], '2026-10-21T20:00:00-04:00')).toBeNull()
    const asleep: SleepRecord[] = [{ id: 's', sleepStart: '2026-10-21T04:00:00-04:00', wake: null }]
    expect(wakingDayStart(asleep, '2026-10-21T20:00:00-04:00')).toBeNull()
  })

  it('does not depend on the order records are stored in', () => {
    const reversed = [...demoDoc.sleeps].reverse()
    expect(wakingDayStart(reversed, demoStartIso)).toBe('2026-10-21T13:20:00-04:00')
  })
})

describe('mealsForDay', () => {
  const day = (wake: string) => mealsForDay(demoDoc.meals, demoDoc.sleeps, wake).map((m) => m.id)

  it("Wednesday runs from Wed's wake to the next wake (none yet): five meals, snack included", () => {
    expect(day('2026-10-21T13:20:00-04:00')).toEqual(['wed-1', 'wed-2', 'wed-3', 'wed-4', 'wed-5'])
  })

  it("Tuesday stops before Wednesday's wake", () => {
    expect(day('2026-10-20T13:05:00-04:00')).toEqual(['tue-1', 'tue-2', 'tue-3', 'tue-4'])
  })

  it('Saturday is empty', () => {
    expect(day('2026-10-17T13:00:00-04:00')).toEqual([])
  })

  it('returns meals in time order', () => {
    const shuffled = [...demoDoc.meals].reverse()
    const ids = mealsForDay(shuffled, demoDoc.sleeps, '2026-10-21T13:20:00-04:00').map((m) => m.id)
    expect(ids).toEqual(['wed-1', 'wed-2', 'wed-3', 'wed-4', 'wed-5'])
  })

  it('null dayStart is the provisional day: meals before the first wake, or all when no wake', () => {
    const early = meal('description', 200, { eatenAt: '2026-10-14T22:00:00-04:00' })
    const meals = [early, ...demoDoc.meals]
    expect(mealsForDay(meals, demoDoc.sleeps, null).map((m) => m.id)).toEqual([early.id])
    expect(mealsForDay(meals, [], null)).toHaveLength(meals.length)
  })

  it('nextWakeAfter finds the following wake, or null on the latest day', () => {
    expect(nextWakeAfter(demoDoc.sleeps, '2026-10-20T13:05:00-04:00')).toBe('2026-10-21T13:20:00-04:00')
    expect(nextWakeAfter(demoDoc.sleeps, '2026-10-21T13:20:00-04:00')).toBeNull()
  })
})
