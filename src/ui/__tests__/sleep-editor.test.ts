// Build-out item 2.2 (checklist slice 6): the sleep and wake editor's logic, sleepEdit.ts. The
// order check (each problem next to its field), the move computation (what changes day, from
// which day to which day), the missed night that splits a day joined because its night had no
// record, deleting a night, and the dates a typed time lands on.
//
// The log is the fictional Sam's, shaped like an imported log with a missing night: tests run in
// America/Toronto (tests/vitest.setup.ts), EST (-05:00) in November 2026. Expected values are
// worked out by hand from the times below, not read from the code under test:
//   n1  Mon 11-02 23:30  to  Tue 11-03 07:00
//   (no record for the night before Wednesday)
//   n3  Wed 11-04 23:10  to  Thu 11-05 07:20
//   Tue's day runs from Tue 07:00 until Thu 07:20, so it holds Tuesday's and Wednesday's meals.
import { describe, expect, it } from 'vitest'
import type { Meal, SleepRecord } from '../../kernel/types'
import type { LogDoc } from '../../store/log'
import {
  ambiguityTip,
  checkNight,
  dayLabel,
  deleteIntroText,
  demoMaxDate,
  moveGroupTitle,
  deleteNight,
  draftForMissed,
  draftForRecord,
  lengthText,
  missedWakeDate,
  nightSinceMissing,
  movesBetween,
  readBack,
  readWhen,
  tidyTime,
  withAutoSleepDate,
  type NightDraft,
} from '../sleepEdit'
import { headEdit, lastNightLabel } from '../SleepSection'
import { togetherPieces } from '../KeepTogether'
import { buildSleepView, nightRangeText } from '../sleepView'

const NOW = '2026-11-05T10:00:00-05:00'

function mealAt(id: string, name: string, eatenAt: string, kcal: number | null): Meal {
  return { id, name, eatenAt, source: kcal === null ? null : 'label', kcal, protein: null, carbs: null, fat: null }
}

const N1: SleepRecord = { id: 'n1', sleepStart: '2026-11-02T23:30:00-05:00', wake: '2026-11-03T07:00:00-05:00' }
const N3: SleepRecord = { id: 'n3', sleepStart: '2026-11-04T23:10:00-05:00', wake: '2026-11-05T07:20:00-05:00' }

const DOC: LogDoc = {
  kind: 'mine',
  profile: { name: '', kind: 'guest' },
  meals: [
    mealAt('m1', 'Porridge', '2026-11-03T08:00:00-05:00', 300),
    mealAt('m2', 'Bean chili', '2026-11-03T19:00:00-05:00', 600),
    mealAt('m3', 'Rye toast', '2026-11-04T08:30:00-05:00', 220),
    mealAt('m4', 'Lentil salad', '2026-11-04T13:00:00-05:00', null),
    mealAt('m5', 'Tea with milk', '2026-11-05T07:45:00-05:00', 40),
    mealAt('m6', 'Yogurt', '2026-11-05T08:30:00-05:00', 150),
  ],
  sleeps: [N1, N3],
  workouts: [{ id: 'w1', name: 'Bike ride', startedAt: '2026-11-04T17:00:00-05:00', minutes: 40, kcal: 300, source: 'burn_device' }],
  plates: [],
}

function draft(sleepDate: string, sleepTime: string, wakeDate: string, wakeTime: string): NightDraft {
  return { sleep: { date: sleepDate, time: sleepTime }, wake: { date: wakeDate, time: wakeTime }, sleepDateAuto: false }
}

describe('reading a typed date and time', () => {
  it('"8" on 2026-11-05 is Thu 8:00 AM, shown back with AM and a way to get the evening', () => {
    const r = readWhen({ date: '2026-11-05', time: '8' })
    expect(r).toEqual({ kind: 'value', iso: '2026-11-05T08:00:00-05:00', minutes: 480, ambiguous: true })
    expect(readBack(r)).toBe('Reads as Thu 8:00 AM. Type pm for the evening.')
    expect(readBack(readWhen({ date: '2026-11-05', time: '8 pm' }))).toBe('Reads as Thu 8:00 PM.')
    // A bare 12 reads as noon; the way to midnight is am.
    expect(readBack(readWhen({ date: '2026-11-05', time: '12' }))).toBe('Reads as Thu 12:00 PM. Type am for midnight.')
  })

  it('blank is empty; a bad time or a missing date is an error in plain words', () => {
    expect(readWhen({ date: '2026-11-05', time: '' })).toEqual({ kind: 'empty' })
    expect(readWhen({ date: '2026-11-05', time: '8:75' })).toEqual({ kind: 'error', message: 'Type a time like 8, 8am, 8:15 pm or 20:30.' })
    expect(readWhen({ date: '', time: '8' })).toEqual({ kind: 'error', message: 'Pick a date.' })
  })

  it('a date before 2000 is refused at its own field, so a typed year like 0001 never makes a broken time', () => {
    const before = { kind: 'error', message: 'Pick a date in 2000 or later.' }
    expect(readWhen({ date: '0001-01-01', time: '8' })).toEqual(before)
    expect(readWhen({ date: '0999-06-01', time: '8' })).toEqual(before)
    expect(readWhen({ date: '1999-12-31', time: '8' })).toEqual(before)
    expect(readWhen({ date: '2000-01-01', time: '8' })).toEqual({ kind: 'value', iso: '2000-01-01T08:00:00-05:00', minutes: 480, ambiguous: true })
    // The bad date was the sleep date: the message sits under the sleep field, not the wake.
    const c = checkNight(DOC, { kind: 'edit', recordId: 'n3' }, draft('0001-01-01', '11 pm', '2026-11-05', '7:20 am'), NOW)
    expect(c.errors).toEqual({ sleep: 'Pick a date in 2000 or later.' })
    expect(c.save).toBeNull()
  })

  it('the am or pm tip after a bare hour: pm for 1 to 11, am for 12 (noon), none otherwise', () => {
    expect(ambiguityTip({ minutes: 60, ambiguous: true })).toBe('Type pm for the evening.')
    expect(ambiguityTip({ minutes: 660, ambiguous: true })).toBe('Type pm for the evening.')
    expect(ambiguityTip({ minutes: 720, ambiguous: true })).toBe('Type am for midnight.')
    expect(ambiguityTip({ minutes: 480, ambiguous: false })).toBeNull()
  })

  it('tidies a time once it loses focus, and leaves text that is not a time as typed', () => {
    expect(tidyTime('8')).toBe('8:00 AM')
    expect(tidyTime('20:30')).toBe('8:30 PM')
    expect(tidyTime('1145pm')).toBe('11:45 PM')
    expect(tidyTime('eight')).toBe('eight')
  })
})

describe('the dates a night lands on', () => {
  it('a recorded night opens on its own dates and times', () => {
    expect(draftForRecord(N3, NOW)).toEqual(draft('2026-11-04', '11:10 PM', '2026-11-05', '7:20 AM'))
  })

  it('a missed night: the sleep date follows the wake (the day before, unless the sleep time is earlier in the day)', () => {
    const d = draftForMissed('2026-11-04')
    expect(d).toEqual({ sleep: { date: '2026-11-03', time: '' }, wake: { date: '2026-11-04', time: '' }, sleepDateAuto: true })
    // Asleep 11:45 PM, up 7:40 AM: the sleep is on Tue 11-03.
    const late = withAutoSleepDate({ ...d, sleep: { ...d.sleep, time: '11:45 pm' }, wake: { ...d.wake, time: '7:40' } })
    expect(late.sleep.date).toBe('2026-11-03')
    // Asleep 1:30 AM, up 8 AM: the same date as the wake.
    const early = withAutoSleepDate({ ...d, sleep: { ...d.sleep, time: '1:30' }, wake: { ...d.wake, time: '8' } })
    expect(early.sleep.date).toBe('2026-11-04')
    // Once a sleep date is chosen it stays.
    expect(withAutoSleepDate({ ...early, sleepDateAuto: false, sleep: { date: '2026-11-01', time: '1:30' } }).sleep.date).toBe('2026-11-01')
  })

  it('Add a missed night starts the day after the viewed day’s wake, never after today', () => {
    // Viewing Tue's day (woke Tue 11-03): Wed 11-04 has no wake recorded.
    expect(missedWakeDate(DOC.sleeps, N1.wake, NOW)).toBe('2026-11-04')
    // With nothing recorded, today (Thu 11-05) is free for the current and the provisional day.
    expect(missedWakeDate([], N3.wake, NOW)).toBe('2026-11-05')
    expect(missedWakeDate([], null, NOW)).toBe('2026-11-05')
  })

  it('when that date already has a wake, it starts on the nearest gap instead', () => {
    // Viewing today (Thu 11-05, woke 7:20 AM): today has a wake, so the gap on Wed 11-04 is used.
    expect(missedWakeDate(DOC.sleeps, N3.wake, NOW)).toBe('2026-11-04')
    expect(missedWakeDate(DOC.sleeps, null, NOW)).toBe('2026-11-04')
    // Wakes on Sun 11-01, Mon 11-02 and Wed 11-04: gaps on Sat 10-31 (before the earliest wake), Tue
    // 11-03 and Thu 11-05 (today). Viewing Sun's day, Mon is taken; the nearest gap is Tue 11-03
    // (1 day away; Sat is 2 days away).
    const wakesOn = (...dates: string[]) =>
      dates.map((d, i) => ({ id: `w${i}`, sleepStart: null, wake: `${d}T07:00:00-05:00` }) as SleepRecord)
    const log = wakesOn('2026-11-01', '2026-11-02', '2026-11-04')
    expect(missedWakeDate(log, '2026-11-01T07:00:00-05:00', NOW)).toBe('2026-11-03')
    // Viewing Wed's day: Thu 11-05 (today) has no wake, so it is the first choice.
    expect(missedWakeDate(log, '2026-11-04T07:00:00-05:00', NOW)).toBe('2026-11-05')
    // Every day from Tue to Thu has a wake: no gap between them, so the day before the earliest
    // wake, Mon 11-02, never the taken Thu 11-05. Viewing Tue's day (first choice Wed, taken) too.
    const full = wakesOn('2026-11-03', '2026-11-04', '2026-11-05')
    expect(missedWakeDate(full, '2026-11-05T07:00:00-05:00', NOW)).toBe('2026-11-02')
    expect(missedWakeDate(full, '2026-11-03T07:00:00-05:00', NOW)).toBe('2026-11-02')
  })

  it('a daytime sleep on the obvious date: the nearest gap, not one weeks earlier', () => {
    // Wakes on Mon 10-05 (a gap after it on Tue 10-06), Mon 11-02 7:00 AM (the viewed day), a daytime
    // sleep ending Tue 11-03 3:00 PM, and Thu 11-05. First choice Tue 11-03 is taken; the gaps are
    // Tue 10-06 (28 days earlier) and Wed 11-04 (1 day later), so Wed 11-04.
    const log: SleepRecord[] = [
      { id: 'a', sleepStart: null, wake: '2026-10-05T07:00:00-04:00' },
      { id: 'b', sleepStart: null, wake: '2026-11-02T07:00:00-05:00' },
      { id: 'c', sleepStart: '2026-11-03T11:00:00-05:00', wake: '2026-11-03T15:00:00-05:00' },
      { id: 'd', sleepStart: null, wake: '2026-11-05T07:00:00-05:00' },
    ]
    expect(missedWakeDate(log, '2026-11-02T07:00:00-05:00', NOW)).toBe('2026-11-04')
    // At equal distance the later gap wins: gaps Mon 11-02 and Wed 11-04 around a taken Tue 11-03.
    const even: SleepRecord[] = [
      { id: 'a', sleepStart: null, wake: '2026-11-01T07:00:00-05:00' },
      { id: 'b', sleepStart: null, wake: '2026-11-03T07:00:00-05:00' },
      { id: 'c', sleepStart: null, wake: '2026-11-05T07:00:00-05:00' },
    ]
    expect(missedWakeDate(even, '2026-11-02T07:00:00-05:00', NOW)).toBe('2026-11-04')
  })

  it('shows the night’s length: Wed 11:10 PM to Thu 7:20 AM is 8 h 10 min', () => {
    expect(lengthText(draftForRecord(N3, NOW))).toBe('8 h 10 min of sleep.')
    expect(lengthText(draft('2026-11-04', '', '2026-11-05', '7:20 am'))).toBeNull()
  })

  it('a night over 16 hours adds a line to check AM and PM: a bare 11 for the sleep is 11:00 AM', () => {
    // Wed 11:00 AM to Thu 7:00 AM is 20 h.
    expect(lengthText(draft('2026-11-04', '11', '2026-11-05', '7'))).toBe(
      '20 h 0 min of sleep. That is a long night. Check AM and PM on both times.',
    )
    // Exactly 16 h (Wed 3:00 PM to Thu 7:00 AM) is not over it.
    expect(lengthText(draft('2026-11-04', '15:00', '2026-11-05', '7'))).toBe('16 h 0 min of sleep.')
  })
})

describe('the order check', () => {
  const edit3 = { kind: 'edit', recordId: 'n3' } as const

  it('a wake before its sleep start: on the wake field, keeping nothing', () => {
    const c = checkNight(DOC, edit3, draft('2026-11-04', '11:10 PM', '2026-11-04', '10 pm'), NOW)
    expect(c.save).toBeNull()
    expect(c.errors).toEqual({
      wake: 'Waking up has to come after going to sleep (Wed 11:10 PM). Nothing was saved; change the time and try again.',
    })
  })

  it('a sleep start before the previous night’s wake: on the sleep field', () => {
    const c = checkNight(DOC, edit3, draft('2026-11-03', '6 am', '2026-11-05', '7:20 AM'), NOW)
    expect(c.errors).toEqual({
      sleep: 'Going to sleep has to come after the last wake time (Tue Nov 3, 7:00 AM). Nothing was saved; change the time and try again.',
    })
  })

  it('a new night that runs into a recorded one names it, on the wake field', () => {
    // Wed 10 PM to Thu 6 AM runs into n3, which starts at Wed 11:10 PM.
    const c = checkNight(DOC, { kind: 'add', wakeDate: '2026-11-05' }, draft('2026-11-04', '22:00', '2026-11-05', '6'), NOW)
    expect(c.errors).toEqual({ wake: 'That overlaps another recorded night (Wed Nov 4, 11:10 PM to Thu 7:20 AM). Nothing was saved.' })
  })

  it('a new night that starts inside a recorded one: on the sleep field', () => {
    // Thu 1 AM to Thu 9 AM starts inside n3 (Wed 11:10 PM to Thu 7:20 AM).
    const c = checkNight(DOC, { kind: 'add', wakeDate: '2026-11-05' }, draft('2026-11-05', '1am', '2026-11-05', '9am'), NOW)
    expect(c.errors).toEqual({
      sleep: 'Going to sleep has to come after the last wake time (Thu Nov 5, 7:20 AM). Nothing was saved; change the time and try again.',
    })
  })

  it('a wake time in the future (your own log, now Thu 10:00 AM): on the wake field', () => {
    const c = checkNight(DOC, edit3, draft('2026-11-04', '11:10 PM', '2026-11-05', '11 am'), NOW)
    expect(c.errors).toEqual({ wake: 'That time is later than now. Pick a time up to now.' })
    // The demo has no such limit (its clock moves forward instead).
    expect(checkNight(DOC, edit3, draft('2026-11-04', '11:10 PM', '2026-11-05', '11 am'), null).save).not.toBeNull()
  })

  it('only the latest night may be missing its wake time', () => {
    const c = checkNight(DOC, { kind: 'edit', recordId: 'n1' }, draft('2026-11-02', '11:30 PM', '2026-11-03', ''), NOW)
    expect(c.errors).toEqual({
      wake: 'A later night is already recorded (Wed Nov 4, 11:10 PM to Thu 7:20 AM), so this one needs a wake time. Nothing was saved.',
    })
  })

  it('both times blank, or a time that is not a time, says so next to the field', () => {
    expect(checkNight(DOC, edit3, draft('2026-11-04', '', '2026-11-05', ''), NOW).errors).toEqual({
      wake: 'Type a wake time, a sleep time, or both.',
    })
    expect(checkNight(DOC, edit3, draft('2026-11-04', '25', '2026-11-05', '7:20 AM'), NOW).errors).toEqual({
      sleep: 'Type a time like 8, 8am, 8:15 pm or 20:30.',
    })
  })

  it('an untouched night saves as it was, with nothing moving', () => {
    const c = checkNight(DOC, edit3, draftForRecord(N3, NOW), NOW)
    expect(c.errors).toEqual({})
    expect(c.save?.record).toEqual(N3)
    expect(c.save?.sleeps).toEqual(DOC.sleeps)
    expect(c.save?.moves).toEqual([])
  })
})

describe('what moves', () => {
  it('"I woke at 8": Thu’s wake from 7:20 to 8:00 moves the 7:45 tea back to Tue’s day (no Wed night is recorded)', () => {
    const c = checkNight(DOC, { kind: 'edit', recordId: 'n3' }, draft('2026-11-04', '11:10 PM', '2026-11-05', '8'), NOW)
    expect(c.save?.record).toEqual({ ...N3, wake: '2026-11-05T08:00:00-05:00' })
    expect(c.save?.moves).toEqual([
      {
        from: N3.wake,
        to: N1.wake,
        entries: [{ kind: 'meal', id: 'm5', name: 'Tea with milk', at: '2026-11-05T07:45:00-05:00', kcal: 40 }],
      },
    ])
    expect(dayLabel(N3.wake)).toBe('Thu’s day (woke 7:20 AM)')
    expect(dayLabel(N1.wake)).toBe('Tue’s day (woke 7:00 AM)')
    expect(dayLabel(null)).toBe('the day with no wake time')
  })

  it('a move heading names the days by weekday, and adds dates when both share a weekday', () => {
    expect(moveGroupTitle({ from: N3.wake, to: N1.wake })).toBe('From Thu’s day (woke 7:20 AM) to Tue’s day (woke 7:00 AM)')
    // Tue Nov 3 and Tue Nov 10 (a week apart in an imported log): the weekday alone would repeat.
    expect(moveGroupTitle({ from: '2026-11-10T07:10:00-05:00', to: N1.wake })).toBe(
      'From Tue Nov 10’s day (woke 7:10 AM) to Tue Nov 3’s day (woke 7:00 AM)',
    )
    expect(moveGroupTitle({ from: N3.wake, to: null })).toBe('From Thu’s day (woke 7:20 AM) to the day with no wake time')
  })

  it('a wake moved only a little, past no entry, moves nothing', () => {
    const c = checkNight(DOC, { kind: 'edit', recordId: 'n3' }, draft('2026-11-04', '11:10 PM', '2026-11-05', '7:30'), NOW)
    expect(c.save?.moves).toEqual([])
  })

  it('editing only a sleep time moves nothing (days run from wake to wake)', () => {
    const c = checkNight(DOC, { kind: 'edit', recordId: 'n3' }, draft('2026-11-04', '10:40 pm', '2026-11-05', '7:20 AM'), NOW)
    expect(c.save?.record.sleepStart).toBe('2026-11-04T22:40:00-05:00')
    expect(c.save?.moves).toEqual([])
  })

  it('the missed night splits the joined day: Wednesday’s meals and the bike ride move to the new Wed day', () => {
    // Asleep Tue 11:45 PM, up Wed 7:40 AM. Bean chili (Tue 7 PM) stays on Tue's day; Rye toast
    // (Wed 8:30 AM), the bike ride (Wed 5 PM) and Lentil salad (Wed 1 PM) move to the new day.
    const missed = withAutoSleepDate({ ...draftForMissed('2026-11-04'), sleep: { date: '', time: '11:45 pm' }, wake: { date: '2026-11-04', time: '7:40' } })
    const c = checkNight(DOC, { kind: 'add', wakeDate: '2026-11-04' }, missed, NOW, 'n2')
    expect(c.errors).toEqual({})
    expect(c.save?.record).toEqual({ id: 'n2', sleepStart: '2026-11-03T23:45:00-05:00', wake: '2026-11-04T07:40:00-05:00' })
    expect(c.save?.sleeps).toEqual([N1, N3, c.save?.record])
    expect(c.save?.moves).toEqual([
      {
        from: N1.wake,
        to: '2026-11-04T07:40:00-05:00',
        entries: [
          { kind: 'meal', id: 'm3', name: 'Rye toast', at: '2026-11-04T08:30:00-05:00', kcal: 220 },
          { kind: 'meal', id: 'm4', name: 'Lentil salad', at: '2026-11-04T13:00:00-05:00', kcal: null },
          { kind: 'workout', id: 'w1', name: 'Bike ride', at: '2026-11-04T17:00:00-05:00', kcal: null },
        ],
      },
    ])
  })

  it('deleting a night joins its day to the one before: Thursday’s entries move to Tue’s day', () => {
    const d = deleteNight(DOC, 'n3')
    expect(d.sleeps).toEqual([N1])
    expect(d.moves).toEqual([
      {
        from: N3.wake,
        to: N1.wake,
        entries: [
          { kind: 'meal', id: 'm5', name: 'Tea with milk', at: '2026-11-05T07:45:00-05:00', kcal: 40 },
          { kind: 'meal', id: 'm6', name: 'Yogurt', at: '2026-11-05T08:30:00-05:00', kcal: 150 },
        ],
      },
    ])
    // Deleting the first night sends its day's entries to the day with no wake time.
    expect(deleteNight(DOC, 'n1').moves.map((g) => [g.from, g.to, g.entries.length])).toEqual([[N1.wake, null, 5]])
  })

  it('no change, nothing listed', () => {
    expect(movesBetween(DOC, DOC.sleeps, DOC.sleeps)).toEqual([])
  })
})

describe('naming a night in messages and the delete confirmation', () => {
  it('dates the night, so one weeks away in an imported log is clear', () => {
    expect(nightRangeText(N3)).toBe('Wed Nov 4, 11:10 PM to Thu 7:20 AM')
    // A wake a week or more after the sleep carries its own date too.
    expect(nightRangeText({ id: 'x', sleepStart: '2026-10-20T23:00:00-04:00', wake: '2026-10-28T07:00:00-04:00' })).toBe(
      'Tue Oct 20, 11:00 PM to Wed Oct 28, 7:00 AM',
    )
  })

  it('says which end is missing', () => {
    expect(nightRangeText({ id: 'x', sleepStart: null, wake: '2026-11-05T07:20:00-05:00' })).toBe(
      'sleep time not logged, woke Thu Nov 5, 7:20 AM',
    )
    expect(nightRangeText({ id: 'x', sleepStart: '2026-11-04T23:10:00-05:00', wake: null })).toBe(
      'asleep since Wed Nov 4, 11:10 PM, no wake time yet',
    )
  })

  it('the delete line fits the night, and never says whose log it is (the demo uses it too)', () => {
    expect(deleteIntroText(N3)).toBe('The night Wed Nov 4, 11:10 PM to Thu 7:20 AM will be removed.')
    expect(deleteIntroText({ id: 'x', sleepStart: '2026-11-04T23:10:00-05:00', wake: null })).toBe(
      'The sleep that started Wed Nov 4, 11:10 PM will be removed.',
    )
    expect(deleteIntroText({ id: 'x', sleepStart: null, wake: '2026-11-05T07:20:00-05:00' })).toBe(
      'The night that ended Thu Nov 5, 7:20 AM (sleep time not logged) will be removed.',
    )
  })
})

describe('the demo’s latest date', () => {
  it('is the day after its clock; a later date is refused at its own field and nothing is saved', () => {
    // Demo clock Thu Nov 5 10:00 AM: Fri Nov 6 is allowed (the clock moves forward to it), Sat Nov 7 is not.
    expect(demoMaxDate(NOW)).toBe('2026-11-06')
    const ok = checkNight(DOC, { kind: 'add', wakeDate: '2026-11-06' }, draft('2026-11-05', '11 pm', '2026-11-06', '7 am'), null, 'new', '2026-11-06')
    expect(ok.errors).toEqual({})
    expect(ok.save?.record.wake).toBe('2026-11-06T07:00:00-05:00')
    // A mistyped year (2062) for the wake.
    const far = checkNight(DOC, { kind: 'add', wakeDate: '2026-11-06' }, draft('2026-11-05', '11 pm', '2062-11-06', '7 am'), null, 'new', '2026-11-06')
    expect(far).toEqual({ errors: { wake: 'In the demo, pick a date up to Fri Nov 6.' }, save: null })
    // Without a limit (your own log, where a time after now is refused instead) the date itself passes readWhen.
    expect(readWhen({ date: '2062-11-06', time: '7 am' }).kind).toBe('value')
  })
})

describe('a night since the latest one may be missing', () => {
  it('only when a night has gone by since the latest wake (24 hours or more)', () => {
    // Now Thu 11-05 10:00 AM. n3 woke Thu 7:20 AM: today, so nothing is missing.
    expect(nightSinceMissing(DOC.sleeps, N3, NOW)).toBe(false)
    // Without n3, n1 (woke Tue) is the latest and Tue is before Thu.
    expect(nightSinceMissing([N1], N1, NOW)).toBe(true)
    // n1 is not the latest when n3 exists.
    expect(nightSinceMissing(DOC.sleeps, N1, NOW)).toBe(false)
    // A sleep still going on has no wake: the editor already offers its wake time.
    expect(nightSinceMissing([N1, { id: 'o', sleepStart: '2026-11-04T23:00:00-05:00', wake: null }], N1, NOW)).toBe(false)
    // Still up at Fri 1:30 AM after waking Thu 7:20 AM (n3): 18 h 10 min, no night gone by yet,
    // so no hint, while the sleep section still calls n3 "last night".
    expect(nightSinceMissing(DOC.sleeps, N3, '2026-11-06T01:30:00-05:00')).toBe(false)
    // 24 hours after that wake, a night has gone by unlogged.
    expect(nightSinceMissing(DOC.sleeps, N3, '2026-11-06T07:20:00-05:00')).toBe(true)
  })
})

describe('dates and times in the editor’s sentences stay whole when a line wraps', () => {
  it('finds every weekday-and-time, date, time and length, and nothing else', () => {
    // The delete confirmation for n3 and the overlap message: each time keeps its AM or PM.
    expect(togetherPieces(deleteIntroText(N3))).toEqual(['Wed Nov 4', '11:10 PM', 'Thu 7:20 AM'])
    expect(togetherPieces('Waking up has to come after going to sleep (Wed 11:30 PM). Nothing was saved.')).toEqual(['Wed 11:30 PM'])
    expect(togetherPieces('From Thu’s day (woke 7:20 AM) to Wed’s day (woke 7:10 AM)')).toEqual(['7:20 AM', '7:10 AM'])
    expect(togetherPieces('8 h 10 min of sleep.')).toEqual(['8 h 10 min'])
    expect(togetherPieces('Type a time like 8, 8am, 8:15 pm or 20:30.')).toEqual([])
  })
})

describe('Edit in the sleep section’s head names the night it opens', () => {
  // The sleep view for the waking day that starts at `dayStart`.
  const viewFor = (sleeps: SleepRecord[], dayStart: string) => buildSleepView(sleeps, dayStart)

  it('"Edit last night" only when no night has passed since its wake; otherwise by its day', () => {
    // Today Thu 11-05, the day started at Thu 7:20 AM (n3): last night.
    expect(headEdit(viewFor(DOC.sleeps, N3.wake as string), true, NOW)).toEqual({ recordId: 'n3', label: 'Edit last night' })
    // Today Thu, but the latest night woke Tue (nothing logged since): the current day started on
    // Tue, so "last night" would name a night two nights back. It says the day instead.
    expect(headEdit(viewFor([N1], N1.wake as string), true, NOW)).toEqual({ recordId: 'n1', label: 'Edit the night before Tue' })
    // An earlier day on screen: by its day, as before.
    expect(headEdit(viewFor(DOC.sleeps, N1.wake as string), false, NOW)).toEqual({ recordId: 'n1', label: 'Edit the night before Tue' })
  })

  it('the row under the head tells the same story: "Last night" only under the same test', () => {
    // Today Thu, the day started at Thu 7:20 AM (n3): last night.
    expect(lastNightLabel(viewFor(DOC.sleeps, N3.wake as string), true, NOW)).toBe('Last night')
    // Today Thu, nothing logged since Tue's wake: the row names that night by its day, as Edit does.
    expect(lastNightLabel(viewFor([N1], N1.wake as string), true, NOW)).toBe('Night before Tue')
    // An earlier day on screen keeps its own wording.
    expect(lastNightLabel(viewFor(DOC.sleeps, N1.wake as string), false, NOW)).toBe('Night before this day')
    // No night at all yet (the provisional day): "Last night" with "not logged" is true.
    expect(lastNightLabel(buildSleepView([], null), true, NOW)).toBe('Last night')
  })

  it('after midnight with no sleep since, the night just woken from is still "last night"', () => {
    // Woke Wed 7:10 AM (n2), still up at Thu 1:30 AM: 18 h 20 min later, no night has passed.
    const n2: SleepRecord = { id: 'n2', sleepStart: '2026-11-03T23:50:00-05:00', wake: '2026-11-04T07:10:00-05:00' }
    const lateNight = '2026-11-05T01:30:00-05:00'
    expect(lastNightLabel(viewFor([N1, n2], n2.wake as string), true, lateNight)).toBe('Last night')
    expect(headEdit(viewFor([N1, n2], n2.wake as string), true, lateNight)).toEqual({ recordId: 'n2', label: 'Edit last night' })
    // At Thu 10:00 AM, 26 h 50 min after that wake, a night has gone by unlogged: named by its day.
    expect(lastNightLabel(viewFor([N1, n2], n2.wake as string), true, NOW)).toBe('Night before Wed')
    expect(headEdit(viewFor([N1, n2], n2.wake as string), true, NOW)).toEqual({ recordId: 'n2', label: 'Edit the night before Wed' })
    // The edge: exactly 24 hours after the wake counts as a night gone by.
    expect(lastNightLabel(viewFor([N1, n2], n2.wake as string), true, '2026-11-05T07:10:00-05:00')).toBe('Night before Wed')
    expect(lastNightLabel(viewFor([N1, n2], n2.wake as string), true, '2026-11-05T07:09:00-05:00')).toBe('Last night')
  })
})
