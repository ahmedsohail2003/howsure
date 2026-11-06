// sleepday.ts, slice 4 (spec.md > Maths Core: Waking Days and Sleep): nightStats(), sleepStatus(),
// wakingDays(), movedMeals() and validateSleep(). G8 (the circular-mean wake time) is in golden.test.ts.
// Night lengths for the demo, worked out by hand from fixtures/demo-week.json:
// 530, 515, 530, 525, 550 and 525 minutes; the record ending with Tue's wake has no sleep start.
import { describe, expect, it } from 'vitest'
import { movedBy, movedMeals, nightStats, sleepStatus, validateSleep, wakingDays } from '../sleepday'
import type { SleepRecord } from '../types'
import { demoDoc, demoStartIso, meal } from './helpers'

const NEW_SLEEP = '2026-10-22T04:40:00-04:00'
const NEW_WAKE = '2026-10-22T13:10:00-04:00'

describe('nightStats', () => {
  it('the demo: 6 of 7 nights, Tue "not logged", average 529.17 min (3175 / 6)', () => {
    const s = nightStats(demoDoc.sleeps)
    expect(s.total).toBe(7)
    expect(s.complete).toBe(6)
    expect(s.nights.map((n) => n.minutes)).toEqual([530, 515, 530, 525, 550, null, 525])
    expect(s.avgMinutes).toBeCloseTo(3175 / 6, 6)
  })

  it('a missing sleep start is "not logged" (null), never 0, and left out of the average', () => {
    const s = nightStats(demoDoc.sleeps)
    expect(s.nights.find((n) => n.id === 'sleep-1020')?.minutes).toBeNull()
    expect(s.nights.some((n) => n.minutes === 0)).toBe(false)
  })

  it('leaves out a sleep still in progress, then counts it once it has a wake', () => {
    const asleep: SleepRecord[] = [...demoDoc.sleeps, { id: 'now', sleepStart: NEW_SLEEP, wake: null }]
    const s = nightStats(asleep)
    expect(s.total).toBe(7)
    expect(s.nights.map((n) => n.id)).not.toContain('now')

    const woke: SleepRecord[] = [...demoDoc.sleeps, { id: 'now', sleepStart: NEW_SLEEP, wake: NEW_WAKE }]
    const w = nightStats(woke)
    // The window moves on: sleep-1015 drops out and the new 510-minute night comes in. Still 6 of 7.
    expect(w.nights.map((n) => n.minutes)).toEqual([515, 530, 525, 550, null, 525, 510])
    expect(w.complete).toBe(6)
    expect(w.avgMinutes).toBeCloseTo(3155 / 6, 6)
  })

  it('no records: no nights and no average', () => {
    expect(nightStats([])).toMatchObject({ total: 0, complete: 0, avgMinutes: null, avgWakeMinutes: null, wakeVaries: false })
  })
})

describe('sleepStatus', () => {
  it('awake in the demo and with no records; asleep after going to sleep', () => {
    expect(sleepStatus(demoDoc.sleeps).kind).toBe('awake')
    expect(sleepStatus([]).kind).toBe('awake')
    expect(sleepStatus([...demoDoc.sleeps, { id: 'n', sleepStart: NEW_SLEEP, wake: null }])).toEqual({
      kind: 'asleep',
      since: NEW_SLEEP,
      recordId: 'n',
    })
  })
})

describe('wakingDays', () => {
  it('the demo: seven days, Thu to Wed, and no provisional day (no meal before the first wake)', () => {
    const days = wakingDays(demoDoc.meals, demoDoc.sleeps, demoStartIso)
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-10-15T13:10:00-04:00')
    expect(days[6]).toBe('2026-10-21T13:20:00-04:00')
  })

  it('the provisional day comes first when a meal is before the first wake, or there is no wake', () => {
    const early = meal('description', 200, { eatenAt: '2026-10-14T22:00:00-04:00' })
    expect(wakingDays([early, ...demoDoc.meals], demoDoc.sleeps)[0]).toBeNull()
    expect(wakingDays([], [])).toEqual([null])
  })

  it('leaves out wakes after upTo', () => {
    expect(wakingDays(demoDoc.meals, demoDoc.sleeps, '2026-10-20T12:00:00-04:00').at(-1)).toBe('2026-10-19T13:15:00-04:00')
  })
})

describe('movedMeals', () => {
  it('lists only the meals that cross a moved wake', () => {
    const after = demoDoc.sleeps.map((r) => (r.id === 'sleep-1021' ? { ...r, wake: '2026-10-21T18:00:00-04:00' } : r))
    // The kefir (13:50) and the pasta bake (17:30) fall before the new 18:00 wake, so they move to Tuesday.
    expect(movedMeals(demoDoc.meals, demoDoc.sleeps, after).map((m) => m.id)).toEqual(['wed-1', 'wed-2'])
  })

  it('a new wake moves only the meals timed after it to the new day', () => {
    const toast = meal('label', 150, { eatenAt: '2026-10-22T13:30:00-04:00' })
    const meals = [...demoDoc.meals, toast]
    const before: SleepRecord[] = [...demoDoc.sleeps, { id: 'n', sleepStart: NEW_SLEEP, wake: null }]
    const after: SleepRecord[] = [...demoDoc.sleeps, { id: 'n', sleepStart: NEW_SLEEP, wake: NEW_WAKE }]
    expect(movedMeals(meals, before, after).map((m) => m.id)).toEqual([toast.id])
  })

  it('no change, no moved meals', () => {
    expect(movedMeals(demoDoc.meals, demoDoc.sleeps, demoDoc.sleeps)).toEqual([])
  })
})

describe('validateSleep', () => {
  const asleep: SleepRecord[] = [...demoDoc.sleeps, { id: 'n', sleepStart: NEW_SLEEP, wake: null }]

  it('a wake after its sleep start is fine', () => {
    expect(validateSleep(asleep, { id: 'n', sleepStart: NEW_SLEEP, wake: NEW_WAKE })).toBeNull()
  })

  it('a wake at or before its sleep start is rejected', () => {
    expect(validateSleep(asleep, { id: 'n', sleepStart: NEW_SLEEP, wake: '2026-10-22T04:00:00-04:00' })).toEqual({
      kind: 'wake-before-sleep',
      sleepStart: NEW_SLEEP,
    })
    expect(validateSleep(asleep, { id: 'n', sleepStart: NEW_SLEEP, wake: NEW_SLEEP })?.kind).toBe('wake-before-sleep')
  })

  it("a sleep start before the previous record's wake is rejected", () => {
    expect(validateSleep(demoDoc.sleeps, { id: 'x', sleepStart: '2026-10-21T12:00:00-04:00', wake: null })).toEqual({
      kind: 'sleep-before-previous-wake',
      wake: '2026-10-21T13:20:00-04:00',
    })
  })

  it('a record that runs into a later one overlaps', () => {
    const r = { id: 'sleep-1019', sleepStart: '2026-10-19T04:05:00-04:00', wake: '2026-10-20T14:00:00-04:00' }
    expect(validateSleep(demoDoc.sleeps, r)?.kind).toBe('overlap')
  })

  it('in your own log, a time later than now is rejected', () => {
    const latest = '2026-10-22T01:30:00-04:00'
    expect(validateSleep(demoDoc.sleeps, { id: 'x', sleepStart: NEW_SLEEP, wake: null }, latest)).toEqual({ kind: 'future' })
    expect(validateSleep(demoDoc.sleeps, { id: 'x', sleepStart: '2026-10-22T01:00:00-04:00', wake: null }, latest)).toBeNull()
  })

  it('a record with no times is not a time', () => {
    expect(validateSleep([], { id: 'x', sleepStart: null, wake: null })).toEqual({ kind: 'not-a-time' })
  })
})

// Build-out item 2.2: the order check names what a night runs into, leaves no room after a sleep
// still going on, and asks for a wake time when later nights exist; movedBy() checks any dated entry.
describe('validateSleep, build-out item 2.2', () => {
  const asleep: SleepRecord[] = [...demoDoc.sleeps, { id: 'n', sleepStart: NEW_SLEEP, wake: null }]
  const wed = demoDoc.sleeps.find((r) => r.id === 'sleep-1021') as SleepRecord

  it('an overlap names the night it runs into', () => {
    // Wed's night is 04:35 to 13:20; a new night from Wed 05:00 to Wed 09:00 sits inside it.
    const inside = { id: 'x', sleepStart: '2026-10-21T05:00:00-04:00', wake: '2026-10-21T09:00:00-04:00' }
    expect(validateSleep(demoDoc.sleeps, inside)).toEqual({ kind: 'sleep-before-previous-wake', wake: wed.wake })
    // With no sleep start, a wake inside Wed's night overlaps it.
    expect(validateSleep(demoDoc.sleeps, { id: 'x', sleepStart: null, wake: '2026-10-21T09:00:00-04:00' })).toEqual({
      kind: 'overlap',
      other: wed,
    })
    // From Tue 23:00 to Wed 05:00 runs into Wed's night (which starts at 04:35).
    const into = { id: 'x', sleepStart: '2026-10-20T23:00:00-04:00', wake: '2026-10-21T05:00:00-04:00' }
    expect(validateSleep(demoDoc.sleeps, into)).toEqual({ kind: 'overlap', other: wed })
  })

  it('a sleep still going on leaves no room for a night after it began', () => {
    // Asleep since Thu 04:40: a night from Thu 06:00 to Thu 09:00 can't be added.
    const after = { id: 'x', sleepStart: '2026-10-22T06:00:00-04:00', wake: '2026-10-22T09:00:00-04:00' }
    expect(validateSleep(asleep, after)).toEqual({ kind: 'overlap', other: asleep[asleep.length - 1] })
    // Waking from that sleep (the same record) is fine.
    expect(validateSleep(asleep, { id: 'n', sleepStart: NEW_SLEEP, wake: '2026-10-22T09:00:00-04:00' })).toBeNull()
  })

  it('a night with no wake needs one when a later night is recorded', () => {
    // Taking the wake off Mon's night (sleep-1019) leaves later nights after a sleep with no end.
    const mon = demoDoc.sleeps.find((r) => r.id === 'sleep-1019') as SleepRecord
    const later = demoDoc.sleeps.find((r) => r.id === 'sleep-1020') as SleepRecord
    expect(validateSleep(demoDoc.sleeps, { ...mon, wake: null })).toEqual({ kind: 'needs-wake', other: later })
  })
})

describe('movedBy', () => {
  it('checks any dated entry, by the time it gives', () => {
    const after = demoDoc.sleeps.map((r) => (r.id === 'sleep-1021' ? { ...r, wake: '2026-10-21T18:00:00-04:00' } : r))
    const entries = [
      { id: 'walk', at: '2026-10-21T17:00:00-04:00' }, // before the new 18:00 wake: moves to Tuesday
      { id: 'swim', at: '2026-10-21T19:00:00-04:00' }, // after it: stays on Wednesday
    ]
    expect(movedBy(entries, (e) => e.at, demoDoc.sleeps, after).map((e) => e.id)).toEqual(['walk'])
  })
})
