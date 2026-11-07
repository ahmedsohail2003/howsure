// Build-out item 2.8 (checklist slice 18; prd.md > 3-Day Timeline): the timeline's model
// (timelineView.ts). Expected values are worked out by hand from fixtures/demo-week.json, the
// fictional Sam's week (the tests run in America/Toronto):
//   - Mon Oct 19 woke 1:15 PM (Brisk walk 6:30 PM), slept from an unlogged time to Tue 1:05 PM;
//   - Tue Oct 20 woke 1:05 PM, went to sleep Wed 4:35 AM, woke Wed 1:20 PM (8 h 45 min, 525 min);
//   - Wed Oct 21 woke 1:20 PM, with the after-midnight snack at Thu 12:40 AM; the demo's now is
//     Thu 1:30 AM. With the 16 h preset, Wednesday's expected sleep is Thu 5:20 AM.
// The longest day drawn is Tuesday, 24 h 15 min from wake to wake, so the shared scale is 25 h.
import { describe, expect, it } from 'vitest'
import { demoDoc, demoStartIso } from '../../kernel/__tests__/helpers'
import { wakingDayStart } from '../../kernel/sleepday'
import type { SleepRecord } from '../../kernel/types'
import { emptyLog, type LogDoc } from '../../store/log'
import { dayNav } from '../days'
import {
  buildTimelineView,
  fmtDayLength,
  fmtSleepLength,
  timelineNav,
  timelineWindow,
  usualDayChoices,
  withUsualHours,
  type TimelineEntry,
  type TimelineSpan,
  type TimelineView,
} from '../timelineView'

const MON = '2026-10-19T13:15:00-04:00'
const TUE = '2026-10-20T13:05:00-04:00'
const WED = '2026-10-21T13:20:00-04:00'
const H = 3_600_000

/** The timeline ending at `anchor` (by default the current day, as App opens it from today). */
function build(doc: LogDoc = demoDoc, span: TimelineSpan = 3, now = demoStartIso, anchor?: string | null, demo = true): TimelineView {
  const nav = dayNav(doc, anchor === undefined ? wakingDayStart(doc.sleeps, now) : anchor, now)
  return buildTimelineView(doc, nav, now, span, demo)
}

/** A short reading of each entry, to compare whole days at once. */
function read(e: TimelineEntry): string {
  switch (e.kind) {
    case 'wake':
      return `wake ${e.at}`
    case 'meal':
      return `meal ${e.meal.name}`
    case 'workout':
      return `workout ${e.workout.name}`
    case 'weighIn':
      return `weighIn ${e.weighIn.kg}`
    case 'expected':
      return `expected ${e.at}`
    case 'now':
      return `now ${e.at}`
    case 'asleep':
      return `asleep ${e.at}`
    case 'sleep':
      return `sleep ${e.at} to ${e.wake}`
    default:
      return e.kind
  }
}

const day = (t: TimelineView, dayStart: string | null) => {
  const d = t.days.find((x) => x.dayStart === dayStart)
  if (!d) throw new Error(`no day ${dayStart}`)
  return d
}
const entry = (t: TimelineView, dayStart: string | null, kind: TimelineEntry['kind']) => day(t, dayStart).entries.find((e) => e.kind === kind)

describe('the window: 3 waking days, or 4 with the day before', () => {
  it('3 days: Mon, Tue and Wed, oldest first, ending at the current day', () => {
    const t = build()
    expect(t.days.map((d) => d.dayStart)).toEqual([MON, TUE, WED])
    expect(t.days.map((d) => d.name)).toEqual(['Mon Oct 19', 'Tue Oct 20', 'Wed Oct 21'])
    expect(t.days.map((d) => d.current)).toEqual([false, false, true])
    expect(t.window).toBe('The 3 waking days to Wed Oct 21')
  })

  it('4 days adds the day before: Sun Oct 18', () => {
    const t = build(demoDoc, 4)
    expect(t.days.map((d) => d.dayStart)).toEqual(['2026-10-18T13:30:00-04:00', MON, TUE, WED])
    expect(t.window).toBe('The 4 waking days to Wed Oct 21')
  })

  it('ends at the day it was opened on: from Tue, the days are Sun, Mon and Tue, none of them current', () => {
    const t = build(demoDoc, 3, demoStartIso, TUE)
    expect(t.days.map((d) => d.dayStart)).toEqual(['2026-10-18T13:30:00-04:00', MON, TUE])
    expect(t.days.some((d) => d.current)).toBe(false)
    expect(t.days.every((d) => d.drawing?.now === null)).toBe(true)
  })

  it('fewer days only at the start of a log, and the window says so', () => {
    const doc: LogDoc = {
      ...emptyLog(),
      sleeps: [
        { id: 's1', sleepStart: '2026-10-20T23:00:00-04:00', wake: '2026-10-21T07:00:00-04:00' },
        { id: 's2', sleepStart: '2026-10-21T23:30:00-04:00', wake: '2026-10-22T07:10:00-04:00' },
      ],
    }
    const t = build(doc, 4, '2026-10-22T09:00:00-04:00', undefined, false)
    expect(t.days.map((d) => d.dayStart)).toEqual(['2026-10-21T07:00:00-04:00', '2026-10-22T07:10:00-04:00'])
    expect(t.window).toBe('The 2 waking days to Thu Oct 22, from the start of your log')
  })

  it('timelineWindow slices the list of days the same way', () => {
    const nav = dayNav(demoDoc, null, demoStartIso)
    expect(timelineWindow(nav, 3)).toEqual(nav.days.slice(-3))
    expect(timelineWindow(nav, 4)).toEqual(nav.days.slice(-4))
  })
})

describe('each day in time order, with its wake and its expected-sleep marker', () => {
  it('Wednesday (today): the wake, five meals, now, then expected sleep at Thu 5:20 AM', () => {
    const t = build()
    expect(day(t, WED).entries.map(read)).toEqual([
      `wake ${WED}`,
      'meal Kefir with oats and blueberries',
      'meal Pasta bake (ready meal)',
      'meal Chicken, rice and broccoli',
      'meal Lentil soup from the café',
      'meal Apple and peanut butter',
      `now ${demoStartIso}`,
      'expected 2026-10-22T05:20:00-04:00',
    ])
  })

  it('Tuesday (closed): its meals, expected sleep at Wed 5:05 AM, and the night that ended it after', () => {
    const t = build()
    expect(day(t, TUE).entries.map(read)).toEqual([
      `wake ${TUE}`,
      'meal Bagel with cream cheese',
      'meal Granola bar',
      'meal Veggie pizza',
      'meal Hummus and crackers',
      'sleep 2026-10-21T04:35:00-04:00 to 2026-10-21T13:20:00-04:00',
      'expected 2026-10-21T05:05:00-04:00',
    ])
    const sleep = entry(t, TUE, 'sleep')
    expect(sleep?.kind === 'sleep' && sleep.minutes).toBe(525)
    // The night before Tuesday has no sleep start: not logged, never 0.
    const wake = entry(t, TUE, 'wake')
    expect(wake?.kind === 'wake' && wake.sleptMinutes).toBeNull()
  })

  it('Monday: the workout among the meals, and a closing night whose sleep start was not logged comes last', () => {
    const t = build()
    const reads = day(t, MON).entries.map(read)
    expect(reads).toContain('workout Brisk walk')
    expect(reads.indexOf('workout Brisk walk')).toBe(reads.indexOf('meal Chicken wrap') + 1)
    expect(reads[reads.length - 1]).toBe(`sleep null to ${TUE}`)
    expect(day(t, MON).drawing?.sleep).toBeNull()
  })

  it('Monday’s night with no sleep start is drawn as its own stretch, never as time awake: from the last meal to the closing wake', () => {
    const d = day(build(), MON).drawing!
    // The last thing logged awake is the 9:45 PM meal (the walk ended at 7:15 PM): 8 h 30 min after the 1:15 PM wake.
    expect(d.unlogged).toEqual({ from: expect.closeTo(8.5 / 25, 10), to: expect.closeTo((23 + 50 / 60) / 25, 10) })
    // The closing wake is marked, and the note sits at the end of the stretch.
    expect(d.closingWake).toBeCloseTo((23 + 50 / 60) / 25, 10)
    expect(d.note).toEqual({ x: d.unlogged!.to, align: 'end' })
    // The recorded time awake stops where the stretch starts; the logged end is still the closing wake.
    expect(d.logged).toBeCloseTo((23 + 50 / 60) / 25, 10)
  })

  it('a night with no sleep start and nothing logged after the wake starts its stretch at the wake; a known night has no stretch', () => {
    const doc: LogDoc = {
      ...emptyLog(),
      sleeps: [
        { id: 's1', sleepStart: '2026-10-19T23:00:00-04:00', wake: '2026-10-20T07:00:00-04:00' },
        { id: 's2', sleepStart: null, wake: '2026-10-21T08:00:00-04:00' },
      ],
    }
    const t = build(doc, 3, '2026-10-21T09:00:00-04:00', undefined, false)
    const tue = day(t, '2026-10-20T07:00:00-04:00').drawing!
    expect(tue.unlogged).toEqual({ from: 0, to: expect.closeTo(25 / 25, 10) })
    expect(tue.note?.align).toBe('end')
    const wed = day(build(), WED).drawing!
    expect(wed.unlogged).toBeNull()
    expect(wed.closingWake).toBeNull()
    expect(day(build(), TUE).drawing!.unlogged).toBeNull()
  })

  it('every day drawn has a wake mark at 0 and its expected-sleep mark 16 h along the 25 h scale', () => {
    const t = build(demoDoc, 4)
    expect(t.scaleHours).toBe(25)
    for (const d of t.days) {
      expect(entry(t, d.dayStart, 'wake')?.x).toBe(0)
      const ex = entry(t, d.dayStart, 'expected')
      expect(ex?.kind === 'expected' && Date.parse(ex.at) - Date.parse(d.dayStart as string)).toBe(16 * H)
      expect(d.drawing?.expected).toBeCloseTo(16 / 25, 10)
      expect(ex?.x).toBeCloseTo(16 / 25, 10)
    }
  })

  it('a usual day length of 15 h moves every marker an hour earlier, and the view says it is saved', () => {
    const doc = { ...demoDoc, profile: { ...demoDoc.profile, usualDayHours: 15 } }
    const t = build(doc)
    expect(t.usualHours).toBe(15)
    expect(t.usualSaved).toBe(true)
    expect(read(entry(t, WED, 'expected') as TimelineEntry)).toBe('expected 2026-10-22T04:20:00-04:00')
    expect(day(t, WED).drawing?.expected).toBeCloseTo(15 / 25, 10)
    // With nothing saved, the 16 h preset is in use and the view says so.
    expect(build().usualSaved).toBe(false)
    expect(build().usualHours).toBe(16)
  })
})

describe('the drawing, hour by hour', () => {
  it('Wednesday: the after-midnight snack sits after the midnight line, on Wednesday’s row', () => {
    const t = build()
    const d = day(t, WED).drawing!
    const snack = day(t, WED).entries.find((e) => e.kind === 'meal' && e.meal.name === 'Apple and peanut butter')!
    expect(d.midnights).toHaveLength(1)
    expect(d.midnights[0]).toBeCloseTo((10 + 40 / 60) / 25, 10)
    expect(snack.laterDate).toBe(true)
    expect(snack.x).toBeCloseTo((11 + 20 / 60) / 25, 10)
    expect(snack.x!).toBeGreaterThan(d.midnights[0])
    // Midnight is named by the new date's weekday; the other labels are clock hours every 6 h.
    expect(d.labels.map((l) => l.text)).toEqual(['6 PM', 'Thu'])
    expect(d.labels.find((l) => l.midnight)?.x).toBe(d.midnights[0])
    // Today: drawn up to now, with the expected sleep ahead; no sleep yet.
    expect(d.now).toBeCloseTo((12 + 10 / 60) / 25, 10)
    expect(d.logged).toBe(d.now)
    expect(d.end).toBeCloseTo(16 / 25, 10)
    expect(d.sleep).toBeNull()
    // The rest of today, from now to expected sleep, is the only time drawn as still ahead.
    expect(d.ahead).toEqual({ from: d.now, to: d.end })
  })

  it('…and before that night’s sleep block, once Sam goes to sleep at 1:55 AM', () => {
    const sleeps: SleepRecord[] = [...demoDoc.sleeps, { id: 'tonight', sleepStart: '2026-10-22T01:55:00-04:00', wake: null }]
    const t = build({ ...demoDoc, sleeps }, 3, '2026-10-22T02:15:00-04:00')
    const d = day(t, WED)
    const snack = d.entries.find((e) => e.kind === 'meal' && e.meal.name === 'Apple and peanut butter')!
    expect(d.drawing!.sleep).toEqual({
      from: expect.closeTo((12 + 35 / 60) / 25, 10),
      to: expect.closeTo((12 + 55 / 60) / 25, 10),
      minutes: 20,
      ongoing: true,
    })
    // Still going on: no closing wake yet; the note ends at now. Asleep, nothing is drawn as still ahead.
    expect(d.drawing!.closingWake).toBeNull()
    expect(d.drawing!.ahead).toBeNull()
    expect(d.drawing!.note).toEqual({ x: d.drawing!.sleep!.to, align: 'end' })
    expect(snack.x!).toBeGreaterThan(d.drawing!.midnights[0])
    expect(snack.x!).toBeLessThan(d.drawing!.sleep!.from)
    expect(d.entries.map((e) => e.kind).slice(-3)).toEqual(['meal', 'asleep', 'expected'])
  })

  it('Tuesday: the sleep block from Wed 4:35 AM to the next wake, with its length, and hour ticks', () => {
    const d = day(build(), TUE).drawing!
    expect(d.sleep).toEqual({
      from: expect.closeTo((15 + 30 / 60) / 25, 10),
      to: expect.closeTo((24 + 15 / 60) / 25, 10),
      minutes: 525,
      ongoing: false,
    })
    expect(d.logged).toBeCloseTo((24 + 15 / 60) / 25, 10)
    expect(d.closingWake).toBeCloseTo((24 + 15 / 60) / 25, 10)
    expect(d.unlogged).toBeNull()
    expect(d.now).toBeNull()
    // One tick per clock hour from 2 PM Tue to 1 PM Wed: 24 of them.
    expect(d.ticks).toHaveLength(24)
    expect(d.labels.map((l) => l.text)).toEqual(['6 PM', 'Wed', '6 AM', '12 PM'])
    // An earlier day has ended: nothing on it is drawn as still ahead.
    expect(d.ahead).toBeNull()
  })

  it('a day longer than 36 h widens the scale and thins the ticks and labels', () => {
    const doc: LogDoc = {
      ...emptyLog(),
      sleeps: [{ id: 's1', sleepStart: '2026-10-19T23:00:00-04:00', wake: '2026-10-20T07:00:00-04:00' }],
    }
    const t = build(doc, 3, '2026-10-22T09:00:00-04:00', undefined, false)
    expect(t.scaleHours).toBe(50)
    const d = t.days[0].drawing!
    expect(d.labels.map((l) => l.text)).toEqual(['12 PM', 'Wed', '12 PM', 'Thu'])
    expect(d.ticks.length).toBeLessThan(20)
  })
})

describe('weigh-ins, gym sessions and the day before the first wake', () => {
  const own: LogDoc = {
    ...emptyLog(),
    meals: [
      { id: 'm0', name: 'Toast', eatenAt: '2026-10-19T21:00:00-04:00', source: 'label', kcal: 200, protein: null, carbs: null, fat: null },
      { id: 'm1', name: 'Soup', eatenAt: '2026-10-20T12:00:00-04:00', source: null, kcal: null, protein: null, carbs: null, fat: null },
    ],
    sleeps: [{ id: 's1', sleepStart: '2026-10-19T23:30:00-04:00', wake: '2026-10-20T07:00:00-04:00' }],
    workouts: [
      {
        id: 'g1', name: 'Pull', startedAt: '2026-10-20T18:00:00-04:00', minutes: 50, kcal: 220, source: 'burn_device',
        gym: { unit: 'kg', exercises: [{ name: 'Row', sets: [{ kind: 'working', weightKg: 40, reps: 10 }] }] },
      },
    ],
    weighIns: [
      { id: 'w1', at: '2026-10-20T07:10:00-04:00', kg: 70.2, unit: 'kg' },
      // Later than now: it waits until its time, as on the dashboard.
      { id: 'w2', at: '2026-10-20T23:00:00-04:00', kg: 70.0, unit: 'kg' },
    ],
  }
  const t = build(own, 3, '2026-10-20T20:00:00-04:00', undefined, false)

  it('lists a weigh-in and a gym session at their times, and leaves out a weigh-in later than now', () => {
    expect(day(t, '2026-10-20T07:00:00-04:00').entries.map(read)).toEqual([
      'wake 2026-10-20T07:00:00-04:00',
      'weighIn 70.2',
      'meal Soup',
      'workout Pull',
      'now 2026-10-20T20:00:00-04:00',
      'expected 2026-10-20T23:00:00-04:00',
    ])
  })

  it('places them on the drawing', () => {
    const d = day(t, '2026-10-20T07:00:00-04:00')
    const x = (kind: string) => d.entries.find((e) => e.kind === kind)?.x
    expect(x('weighIn')).toBeCloseTo(10 / 60 / 24, 10)
    expect(x('workout')).toBeCloseTo(11 / 24, 10)
  })

  it('a weigh-in with no recorded time is listed but never drawn at its placeholder time', () => {
    const doc: LogDoc = {
      ...own,
      weighIns: [{ id: 'w1', at: '2026-10-20T07:01:00-04:00', kg: 70.2, unit: 'kg', timeApproximate: true }],
    }
    const d = day(build(doc, 3, '2026-10-20T20:00:00-04:00', undefined, false), '2026-10-20T07:00:00-04:00')
    const w = d.entries.find((e) => e.kind === 'weighIn')!
    expect(w.x).toBeNull()
    expect(d.entries.filter((e) => e.kind !== 'weighIn').some((e) => e.kind === 'meal' && e.x !== null)).toBe(true)
  })

  it('marks too close together move to a lane above, then below, so none hides another', () => {
    const doc: LogDoc = {
      ...own,
      meals: [
        { id: 'a', name: 'A', eatenAt: '2026-10-20T12:30:00-04:00', source: null, kcal: null, protein: null, carbs: null, fat: null },
        { id: 'b', name: 'B', eatenAt: '2026-10-20T12:45:00-04:00', source: 'label', kcal: 100, protein: null, carbs: null, fat: null },
        { id: 'c', name: 'C', eatenAt: '2026-10-20T12:50:00-04:00', source: 'label', kcal: 100, protein: null, carbs: null, fat: null },
        { id: 'd', name: 'D', eatenAt: '2026-10-20T16:00:00-04:00', source: 'label', kcal: 100, protein: null, carbs: null, fat: null },
      ],
    }
    const d = day(build(doc, 3, '2026-10-20T20:00:00-04:00', undefined, false), '2026-10-20T07:00:00-04:00')
    const lane = (key: string) => d.entries.find((e) => e.key === key)!.lane
    expect([lane('meal-a'), lane('meal-b'), lane('meal-c'), lane('meal-d')]).toEqual([0, -1, 1, 0])
    // The weigh-in 10 minutes after the wake moves off the track, clear of the wake bar.
    expect(lane('weighIn-w1')).toBe(-1)
  })

  it('the day before the first wake time is listed, not drawn, with no expected sleep', () => {
    const before = day(t, null)
    expect(before.name).toBe('Before the first wake time')
    expect(before.drawing).toBeNull()
    expect(before.entries.map(read)).toEqual(['noWake', 'meal Toast', 'sleep 2026-10-19T23:30:00-04:00 to 2026-10-20T07:00:00-04:00'])
    expect(before.entries.every((e) => e.x === null)).toBe(true)
  })

  it('the window counts waking days only, and names the time before the first wake time apart', () => {
    expect(t.days.map((d) => d.dayStart)).toEqual([null, '2026-10-20T07:00:00-04:00'])
    expect(t.window).toBe('The 1 waking day to Tue\u00a0Oct\u00a020, and the time before your first wake time')
    const four = build(own, 4, '2026-10-20T20:00:00-04:00', undefined, true)
    expect(four.window).toBe('The 1 waking day to Tue\u00a0Oct\u00a020, and the time before Sam’s first wake time')
  })

  it('a wake row is keyed by its night, so editing the wake time keeps the row (and focus) in place', () => {
    const wake = day(t, '2026-10-20T07:00:00-04:00').entries.find((e) => e.kind === 'wake')!
    expect(wake.key).toBe('wake-s1')
  })
})

describe('a log with no wake time yet', () => {
  it('shows its one day, listed and not drawn, and says no wake time is recorded yet', () => {
    const doc: LogDoc = {
      ...emptyLog(),
      meals: [{ id: 'm1', name: 'Toast', eatenAt: '2026-10-21T08:00:00-04:00', source: 'label', kcal: 200, protein: null, carbs: null, fat: null }],
    }
    const t = build(doc, 4, '2026-10-21T09:00:00-04:00', undefined, false)
    expect(t.anyWake).toBe(false)
    expect(t.days.map((d) => d.dayStart)).toEqual([null])
    expect(t.days[0].drawing).toBeNull()
    expect(t.days[0].entries.map(read)).toEqual(['noWake', 'meal Toast', 'now 2026-10-21T09:00:00-04:00'])
    expect(t.window).toBe('Your log so far: no wake time yet')
    expect(build().anyWake).toBe(true)
  })
})

describe('the usual day length setting', () => {
  it('writes lengths in hours and minutes', () => {
    expect(fmtDayLength(16)).toBe('16 h')
    expect(fmtDayLength(15.5)).toBe('15 h 30 min')
  })

  it('writes a sleep under an hour in minutes only: "40 min", never "0 h 40 min"', () => {
    expect(fmtSleepLength(40)).toBe('40 min')
    expect(fmtSleepLength(59.6)).toBe('1 h')
    expect(fmtSleepLength(525)).toBe('8 h 45 min')
  })

  it('writes a sleep on the hour in hours only: "2 h", never "2 h 0 min"', () => {
    expect(fmtSleepLength(120)).toBe('2 h')
    expect(fmtSleepLength(121)).toBe('2 h 1 min')
  })

  it('choosing the 16 h preset again removes the saved length, so the log is back on the preset', () => {
    const set = withUsualHours(demoDoc, 15)
    expect(set.profile.usualDayHours).toBe(15)
    expect(build(set).usualSaved).toBe(true)
    const back = withUsualHours(set, 16)
    expect('usualDayHours' in back.profile).toBe(false)
    expect(build(back).usualSaved).toBe(false)
    expect(back.profile).toEqual(demoDoc.profile)
    // The rest of the profile is kept.
    expect(withUsualHours({ ...demoDoc, profile: { ...demoDoc.profile, name: 'Sam' } }, 17).profile).toMatchObject({ name: 'Sam', usualDayHours: 17 })
  })

  it('offers every half hour from 6 to 23 h, and keeps a saved length that is not on that list', () => {
    const plain = usualDayChoices(16, 6, 23)
    expect(plain).toHaveLength(35)
    expect(plain[0]).toBe(6)
    expect(plain[plain.length - 1]).toBe(23)
    expect(usualDayChoices(16.25, 6, 23)).toContain(16.25)
  })
})

// Sam logs a 2-hour sleep from noon to 2 PM as a night: Monday has two waking days on one date.
describe('a day that ended before its expected sleep', () => {
  const MON_7 = '2026-10-19T07:00:00-04:00'
  const MON_2PM = '2026-10-19T14:00:00-04:00'
  const doc: LogDoc = {
    ...emptyLog(),
    meals: [{ id: 'm1', name: 'Porridge', eatenAt: '2026-10-19T08:00:00-04:00', source: 'label', kcal: 300, protein: null, carbs: null, fat: null }],
    sleeps: [
      { id: 's0', sleepStart: '2026-10-18T23:00:00-04:00', wake: MON_7 },
      { id: 's1', sleepStart: '2026-10-19T12:00:00-04:00', wake: MON_2PM },
    ],
  }
  const t = build(doc, 4, '2026-10-19T20:00:00-04:00', undefined, false)

  it('ends its track at the closing wake: no dotted "still ahead" track runs past it', () => {
    const d = day(t, MON_7).drawing!
    expect(t.scaleHours).toBe(24)
    expect(d.closingWake).toBeCloseTo(7 / 24, 10)
    expect(d.logged).toBeCloseTo(7 / 24, 10)
    expect(d.ahead).toBeNull()
    // The expected-sleep marker, after the closing wake, still stands on its own.
    expect(d.expected).toBeCloseTo(16 / 24, 10)
  })

  it('the day still going has its rest of today, from now to expected sleep', () => {
    const d = day(t, MON_2PM).drawing!
    expect(d.ahead).toEqual({ from: expect.closeTo(6 / 24, 10), to: expect.closeTo(16 / 24, 10) })
  })

  it('a day closed by a night with no logged sleep start has no dotted track either', () => {
    // Wake Mon 7:00, a night with no sleep start that ends at Mon 2:00 PM, expected sleep at 11:00 PM.
    const unlogged: LogDoc = { ...doc, sleeps: [doc.sleeps[0], { id: 's1', sleepStart: null, wake: MON_2PM }] }
    const u = build(unlogged, 4, '2026-10-19T20:00:00-04:00', undefined, false)
    const d = day(u, MON_7).drawing!
    expect(d.sleep).toBeNull()
    expect(d.unlogged).not.toBeNull()
    expect(d.expected).toBeCloseTo(16 / 24, 10)
    expect(d.ahead).toBeNull()
    expect(day(u, MON_2PM).drawing!.ahead).not.toBeNull()
  })

  it('today’s dotted track stops at expected sleep, even when an entry is timed after it', () => {
    // With an 8 h usual day, today’s expected sleep is 10 PM, and a meal is timed for 11:30 PM.
    const late: LogDoc = {
      ...doc,
      profile: { ...doc.profile, usualDayHours: 8 },
      meals: [...doc.meals, { id: 'm2', name: 'Late toast', eatenAt: '2026-10-19T23:30:00-04:00', source: 'label', kcal: 150, protein: null, carbs: null, fat: null }],
    }
    const l = build(late, 4, '2026-10-19T20:00:00-04:00', undefined, false)
    const d = day(l, MON_2PM).drawing!
    // Now is 6 h after the 2 PM wake; expected sleep 8 h after it, at 10 PM; the meal at 11:30 PM.
    expect(d.end).toBeGreaterThan(d.expected)
    expect(d.ahead).toEqual({ from: expect.closeTo(6 / l.scaleHours, 10), to: expect.closeTo(8 / l.scaleHours, 10) })
    // Awake past expected sleep: nothing is left up to it, so no dotted track.
    const past = build(late, 4, '2026-10-19T22:30:00-04:00', undefined, false)
    expect(day(past, MON_2PM).drawing!.ahead).toBeNull()
  })

  it('two waking days on one date each give their wake time in their names', () => {
    expect(t.days.map((d) => d.name)).toEqual(['Mon\u00a0Oct\u00a019, from 7:00\u00a0AM', 'Mon\u00a0Oct\u00a019, from 2:00\u00a0PM'])
    // A date held by one waking day keeps its plain name.
    expect(build().days.map((d) => d.name)).toEqual(['Mon\u00a0Oct\u00a019', 'Tue\u00a0Oct\u00a020', 'Wed\u00a0Oct\u00a021'])
  })
})

describe('the window in words, and on the narrowest phones', () => {
  it('gives a shorter wording only when the window says more than its days', () => {
    expect(build().windowShort).toBeNull()
    const own: LogDoc = {
      ...emptyLog(),
      meals: [{ id: 'm0', name: 'Toast', eatenAt: '2026-10-19T21:00:00-04:00', source: 'label', kcal: 200, protein: null, carbs: null, fat: null }],
      sleeps: [{ id: 's1', sleepStart: '2026-10-19T23:30:00-04:00', wake: '2026-10-20T07:00:00-04:00' }],
    }
    const t = build(own, 4, '2026-10-20T20:00:00-04:00', undefined, false)
    expect(t.window).toBe('The 1 waking day to Tue\u00a0Oct\u00a020, and the time before your first wake time')
    expect(t.windowShort).toBe('1 waking day to Tue\u00a0Oct\u00a020, and the time before it')
    expect(t.windowShort!.length).toBeLessThan(t.window.length - 20)
    const noBefore: LogDoc = { ...own, meals: [] }
    expect(build(noBefore, 3, '2026-10-20T20:00:00-04:00', undefined, false).windowShort).toBe(
      '1 waking day to Tue\u00a0Oct\u00a020, from the log’s start',
    )
  })
})

describe('the day the timeline ends at', () => {
  it('follows the current day with no anchor, and stays on its anchor day', () => {
    expect(timelineNav(demoDoc, null, demoStartIso).days[timelineNav(demoDoc, null, demoStartIso).index]).toBe(WED)
    const nav = timelineNav(demoDoc, { dayStart: TUE }, demoStartIso)
    expect(nav.days[nav.index]).toBe(TUE)
  })

  it('when its anchor day has gone (its wake removed), stays at that moment rather than jumping to today', () => {
    const sleeps = demoDoc.sleeps.filter((s) => s.wake !== TUE)
    const doc = { ...demoDoc, sleeps }
    const nav = timelineNav(doc, { dayStart: TUE }, demoStartIso)
    expect(nav.days).not.toContain(TUE)
    expect(nav.days[nav.index]).toBe(MON)
    expect(nav.days[nav.index]).not.toBe(nav.current)
  })
})

describe('the legend lists only the kinds of mark the drawing holds', () => {
  it('the demo to today: no weigh-ins, and an unknown meal only where one is drawn', () => {
    const t = build()
    expect(t.legend).toContain('now')
    expect(t.legend).toContain('ahead')
    expect(t.legend).toContain('unlogged')
    expect(t.legend).not.toContain('weighIn')
    expect(t.legend.slice(0, 2)).toEqual(['wake', 'expected'])
  })

  it('ending at an earlier day: no now and no rest of today', () => {
    const t = build(demoDoc, 3, demoStartIso, TUE)
    expect(t.legend).not.toContain('now')
    expect(t.legend).not.toContain('ahead')
    expect(t.legend).toContain('sleep')
  })

  it('nothing drawn (no wake time yet): no legend at all', () => {
    const doc: LogDoc = { ...emptyLog(), meals: [{ id: 'm1', name: 'Toast', eatenAt: '2026-10-21T08:00:00-04:00', source: 'label', kcal: 200, protein: null, carbs: null, fat: null }] }
    expect(build(doc, 3, '2026-10-21T20:00:00-04:00', undefined, false).legend).toEqual([])
  })
})
