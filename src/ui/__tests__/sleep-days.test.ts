// Slice 4, the screen-side helpers: the sleep buttons' save (sleepView.ts), the sleep section's
// numbers for a viewed day, and previous/next with the date picker (days.ts).
// Night lengths: Wed 04:35 to 13:20 is 525 min; the demo's six complete nights average 3175 / 6 min.
import { describe, expect, it } from 'vitest'
import { demoDoc, demoStartIso } from '../../kernel/__tests__/helpers'
import { emptyLog, type LogDoc } from '../../store/log'
import { buildDayViewFor } from '../dayView'
import { anchorFor, dateOfDay, dayForDate, dayNav } from '../days'
import { buildSleepView, fmtClockMinutes, fmtDuration, problemText, sleepSave } from '../sleepView'

const WED = '2026-10-21T13:20:00-04:00'
const TUE = '2026-10-20T13:05:00-04:00'
const doc: LogDoc = demoDoc

describe('the sleep buttons (sleepSave)', () => {
  it('demo: sleep at Thu 04:40, then wake at 13:10, makes a new, empty current day', () => {
    // The demo has no "later than now" limit (latest null): its clock moves forward instead.
    const slept = sleepSave(doc.sleeps, doc.meals, 'sleep', '2026-10-22T04:40:00-04:00', null, 'n')
    expect(slept.ok).toBe(true)
    if (!slept.ok) return
    expect(slept.record).toEqual({ id: 'n', sleepStart: '2026-10-22T04:40:00-04:00', wake: null })
    const woke = sleepSave(slept.sleeps, doc.meals, 'wake', '2026-10-22T13:10:00-04:00', null)
    expect(woke.ok).toBe(true)
    if (!woke.ok) return
    expect(woke.record).toEqual({ id: 'n', sleepStart: '2026-10-22T04:40:00-04:00', wake: '2026-10-22T13:10:00-04:00' })
    expect(woke.moved).toEqual([])
    const after = { ...doc, sleeps: woke.sleeps }
    const nav = dayNav(after, null, '2026-10-22T13:10:00-04:00')
    expect(nav.current).toBe('2026-10-22T13:10:00-04:00')
    expect(buildDayViewFor(after, nav.current).day.status).toBe('empty')
    // Wednesday, snack included, is still there one day back.
    expect(nav.days[nav.index - 1]).toBe(WED)
    expect(buildDayViewFor(after, WED).meals).toHaveLength(5)
  })

  it('your own log: a time later than now is rejected and nothing is saved', () => {
    const r = sleepSave(doc.sleeps, doc.meals, 'sleep', '2026-10-22T04:40:00-04:00', demoStartIso)
    expect(r).toEqual({ ok: false, problem: { kind: 'future' } })
    expect(problemText({ kind: 'future' })).toBe('That time is later than now. Pick a time up to now.')
  })

  it('a wake before its sleep start explains itself', () => {
    const slept = sleepSave(doc.sleeps, doc.meals, 'sleep', '2026-10-22T04:40:00-04:00', null, 'n')
    if (!slept.ok) throw new Error('expected ok')
    const r = sleepSave(slept.sleeps, doc.meals, 'wake', '2026-10-22T04:00:00-04:00', null)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(problemText(r.problem)).toContain('Waking up has to come after going to sleep (Thu 4:40 AM)')
  })

  it('a blank or broken date and time is not saved', () => {
    expect(sleepSave(doc.sleeps, doc.meals, 'sleep', null, null)).toEqual({ ok: false, problem: { kind: 'not-a-time' } })
  })
})

describe('the sleep section for a viewed day', () => {
  it('Wednesday: last night 8 h 45 min, 7-night average 8 h 49 min, 6 of 7 nights, awake', () => {
    const s = buildSleepView(doc.sleeps, WED)
    expect(s.status.kind).toBe('awake')
    expect(s.lastNight?.minutes).toBe(525)
    expect(fmtDuration(s.lastNight!.minutes!)).toBe('8 h 45 min')
    expect(fmtDuration(s.stats.avgMinutes!)).toBe('8 h 49 min')
    expect([s.stats.complete, s.stats.total]).toEqual([6, 7])
    expect(fmtClockMinutes(s.stats.avgWakeMinutes!)).toBe('1:17 PM')
  })

  it("Tuesday: the night before has no sleep start, so it is not logged (no number), and only Tuesday's nights count", () => {
    const s = buildSleepView(doc.sleeps, TUE)
    expect(s.lastNight).not.toBeNull()
    expect(s.lastNight?.minutes).toBeNull()
    expect([s.stats.complete, s.stats.total]).toEqual([5, 6])
  })

  it('the provisional day has no nights', () => {
    const s = buildSleepView([], null)
    expect(s.lastNight).toBeNull()
    expect(s.stats.total).toBe(0)
  })
})

describe('previous/next and the date picker', () => {
  it('opens on the current day (Wednesday) with Tuesday one back and nothing ahead', () => {
    const nav = dayNav(doc, null, demoStartIso)
    expect(nav.days[nav.index]).toBe(WED)
    expect(nav.index).toBe(nav.days.length - 1)
    expect(nav.days[nav.index - 1]).toBe(TUE)
  })

  it('a date opens the waking day that starts on it; later dates open today; earlier, the first day', () => {
    expect(dayForDate(doc, '2026-10-20', demoStartIso)).toBe(TUE)
    expect(dayForDate(doc, '2026-10-22', demoStartIso)).toBe(WED)
    expect(dayForDate(doc, '2026-10-01', demoStartIso)).toBe('2026-10-15T13:10:00-04:00')
    expect(dateOfDay(doc, TUE, demoStartIso)).toBe('2026-10-20')
  })

  it("an earlier day's edit preview is anchored inside that day, not at now", () => {
    expect(anchorFor(doc, TUE, demoStartIso)).toBe(TUE)
    expect(anchorFor(doc, WED, demoStartIso)).toBe(demoStartIso)
  })

  it('Start empty: just the provisional day', () => {
    const mine = emptyLog()
    const nav = dayNav(mine, null, '2026-10-26T12:00:00-04:00')
    expect(nav.days).toEqual([null])
    expect(nav.current).toBeNull()
  })
})
