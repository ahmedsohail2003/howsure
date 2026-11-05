// Build-out item 1.5.2c: the Night look's timeline of one waking day (nightTimeline.ts) and how a
// day ends (sleepView.ts > dayEndOf), read from the same view-models every look uses. The demo is
// the fictional Sam's week: Wednesday's wake is 1:20 PM after 8 h 45 min of sleep, with the
// after-midnight snack at Thu 12:40 AM, and the demo's now is Thu 1:30 AM.
import { describe, expect, it } from 'vitest'
import { demoDoc, demoStartIso } from '../../kernel/__tests__/helpers'
import type { SleepRecord } from '../../kernel/types'
import { emptyLog } from '../../store/log'
import { buildDayViewFor } from '../dayView'
import { fmtWeekdayFull, onLaterDate } from '../format'
import { timelinePoints, type TimelinePoint } from '../nightTimeline'
import { buildSleepView, dayEndOf } from '../sleepView'

const WED = '2026-10-21T13:20:00-04:00'
const TUE = '2026-10-20T13:05:00-04:00'

function points(sleeps: SleepRecord[], dayStart: string | null, now = demoStartIso, doc = demoDoc): TimelinePoint[] {
  const d = { ...doc, sleeps }
  return timelinePoints(buildDayViewFor(d, dayStart), buildSleepView(sleeps, dayStart), now)
}

/** A short reading of each point, to compare whole timelines at once. */
function read(p: TimelinePoint): string {
  switch (p.kind) {
    case 'wake':
      return `wake ${p.at} slept ${p.sleptMinutes}`
    case 'meal':
      return `meal ${p.meal.name}${p.laterDate ? ' (later date)' : ''}${p.biggest ? ' (biggest)' : ''}`
    case 'now':
      return `now ${p.at}`
    case 'asleep':
      return `asleep since ${p.since}${p.laterDate ? ' (later date)' : ''}`
    case 'sleep':
      return `sleep ${p.at}${p.laterDate ? ' (later date)' : ''}`
    default:
      return p.kind
  }
}

describe('the Night timeline of a waking day', () => {
  it("Sam's Wednesday, the current day: wake, five meals in time order, then now", () => {
    expect(points(demoDoc.sleeps, WED).map(read)).toEqual([
      `wake ${WED} slept 525`,
      'meal Kefir with oats and blueberries',
      'meal Pasta bake (ready meal) (biggest)',
      'meal Chicken, rice and broccoli',
      'meal Lentil soup from the café',
      'meal Apple and peanut butter (later date)',
      `now ${demoStartIso}`,
    ])
  })

  it("a meal after midnight is on a later date than the wake, and says it is still Wednesday's day", () => {
    expect(onLaterDate('2026-10-22T00:40:00-04:00', WED)).toBe(true)
    expect(onLaterDate('2026-10-21T23:15:00-04:00', WED)).toBe(false)
    expect(onLaterDate('2026-10-22T00:40:00-04:00', null)).toBe(false)
    expect(fmtWeekdayFull(WED)).toBe('Wednesday')
  })

  it('an earlier day ends with the sleep start of the night that closed it', () => {
    // Tuesday ran from 1:05 PM until Sam went to sleep at Wed 4:35 AM.
    const tue = points(demoDoc.sleeps, TUE).map(read)
    expect(tue[0]).toBe(`wake ${TUE} slept null`)
    expect(tue[tue.length - 1]).toBe('sleep 2026-10-21T04:35:00-04:00 (later date)')
    expect(tue).not.toContainEqual(expect.stringMatching(/^now/))
  })

  it('a closing night whose sleep start was not logged ends the day with "not logged" (null), never a made-up time', () => {
    // Monday was closed by the night with no sleep start logged (woke Tue 1:05 PM).
    const mon = '2026-10-19T13:15:00-04:00'
    expect(dayEndOf(demoDoc.sleeps, mon)).toEqual({ kind: 'closed', sleepStart: null })
    expect(points(demoDoc.sleeps, mon).map(read).pop()).toBe('sleep null')
  })

  it('the current day with Sam asleep ends with the sleep start, and no "now"', () => {
    const asleep: SleepRecord[] = [...demoDoc.sleeps, { id: 'n', sleepStart: '2026-10-22T04:40:00-04:00', wake: null }]
    expect(dayEndOf(asleep, WED)).toEqual({ kind: 'asleep', since: '2026-10-22T04:40:00-04:00' })
    expect(points(asleep, WED, '2026-10-22T05:00:00-04:00').map(read).pop()).toBe(
      'asleep since 2026-10-22T04:40:00-04:00 (later date)',
    )
  })

  it('an empty own log: no wake yet, no meals logged yet, then now', () => {
    const doc = emptyLog()
    const now = '2026-10-28T20:00:00-04:00'
    expect(timelinePoints(buildDayViewFor(doc, null), buildSleepView([], null), now).map(read)).toEqual([
      'noWake',
      'empty',
      `now ${now}`,
    ])
  })

  it('a new, empty day after waking: the wake, "No meals logged yet", then now', () => {
    const woke: SleepRecord[] = [...demoDoc.sleeps, { id: 'n', sleepStart: '2026-10-22T04:40:00-04:00', wake: '2026-10-22T13:10:00-04:00' }]
    const thu = '2026-10-22T13:10:00-04:00'
    expect(points(woke, thu, thu).map(read)).toEqual([`wake ${thu} slept 510`, 'empty', `now ${thu}`])
    // Wednesday is now an earlier day, closed by that night.
    expect(points(woke, WED).map(read).pop()).toBe('sleep 2026-10-22T04:40:00-04:00 (later date)')
  })

  it('a day with an unknown-calorie meal marks the biggest uncertainty among the known meals only', () => {
    // Friday 2026-10-16 has "Leftover curry" with calories unknown (the demo's incomplete day).
    const fri = demoDoc.sleeps.map((s) => s.wake).find((w) => w?.startsWith('2026-10-16')) as string
    const view = buildDayViewFor(demoDoc, fri)
    expect(view.day.status).toBe('partial')
    const meals = timelinePoints(view, buildSleepView(demoDoc.sleeps, fri), demoStartIso).filter((p) => p.kind === 'meal')
    const biggest = meals.filter((p) => p.kind === 'meal' && p.biggest)
    expect(biggest).toHaveLength(1)
    expect(biggest[0].kind === 'meal' && biggest[0].meal.kcal).not.toBeNull()
  })
})
