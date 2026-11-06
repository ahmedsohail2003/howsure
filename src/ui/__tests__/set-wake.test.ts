// Build-out item 2.1: Set wake time and its regroup preview (src/ui/wakeSet.ts). Times are in
// America/Toronto (tests/vitest.setup.ts); after the clock change on Sun 2026-11-01 the offset is
// -05:00. Sam's provisional day, worked out by hand:
//   Wed 22:30 Oat bar, Thu 00:45 Toast, Thu 08:10 Yogurt, Thu 09:40 Banana; now Thu 10:00.
//   - wake Thu 07:00: Yogurt and Banana move into Thursday's day; Oat bar and Toast stay before it;
//   - wake Wed 07:00 (yesterday): all four move; none stay;
//   - wake Thu 09:00: only Banana moves; three stay;
//   - wake Thu 11:00: later than now, so nothing is saved.
// Each list's calories (known meals only, as the headline counts them): Yogurt 150 + Banana 105
// = 255 kcal; Oat bar 190 + Toast 240 = 430 kcal; all four = 685 kcal.
import { describe, expect, it } from 'vitest'
import { demoDoc, meal } from '../../kernel/__tests__/helpers'
import { sleepStatus } from '../../kernel/sleepday'
import { emptyLog, type LogDoc } from '../../store/log'
import { buildDayViewFor } from '../dayView'
import { dayNav } from '../days'
import { canSetWake, defaultWakeDay, defaultWakeLabel, regroupForWake, regroupTotal, wakeDates, wakeIso } from '../wakeSet'

const NOW = '2026-11-05T10:00:00-05:00'
const oatBar = meal('label', 190, { id: 'a', name: 'Oat bar', eatenAt: '2026-11-04T22:30:00-05:00' })
const toast = meal('description', 240, { id: 'b', name: 'Toast', eatenAt: '2026-11-05T00:45:00-05:00' })
const yogurt = meal('label', 150, { id: 'c', name: 'Yogurt', eatenAt: '2026-11-05T08:10:00-05:00' })
const banana = meal('description', 105, { id: 'd', name: 'Banana', eatenAt: '2026-11-05T09:40:00-05:00' })
// Stored out of time order on purpose: the preview lists each group in time order.
const MEALS = [banana, oatBar, yogurt, toast]
const names = (ms: { name: string }[]) => ms.map((m) => m.name)

describe('the day choices and the default', () => {
  it('counts today and yesterday from the log’s now, across a month, a year and a clock change', () => {
    expect(wakeDates(NOW)).toEqual({ today: '2026-11-05', yesterday: '2026-11-04' })
    // Sun 2026-11-01 is the day the clocks go back: yesterday is still Sat 2026-10-31.
    expect(wakeDates('2026-11-01T10:00:00-05:00')).toEqual({ today: '2026-11-01', yesterday: '2026-10-31' })
    expect(wakeDates('2027-01-01T08:00:00-05:00')).toEqual({ today: '2027-01-01', yesterday: '2026-12-31' })
  })

  it('starts on today once 7:00 AM has passed, otherwise on yesterday', () => {
    expect(defaultWakeDay('2026-11-05T07:00:00-05:00')).toBe('today')
    expect(defaultWakeDay(NOW)).toBe('today')
    expect(defaultWakeDay('2026-11-05T06:59:00-05:00')).toBe('yesterday')
    expect(defaultWakeDay('2026-11-05T00:20:00-05:00')).toBe('yesterday')
  })

  it('turns the picked day and time into a local-offset time', () => {
    expect(wakeIso(NOW, 'today', '07:00')).toBe('2026-11-05T07:00:00-05:00')
    expect(wakeIso(NOW, 'yesterday', '23:15')).toBe('2026-11-04T23:15:00-05:00')
    // Yesterday was before the clock change, so its offset is -04:00.
    expect(wakeIso('2026-11-01T10:00:00-05:00', 'yesterday', '07:00')).toBe('2026-10-31T07:00:00-04:00')
    expect(wakeIso(NOW, 'today', '')).toBeNull()
    expect(wakeIso(NOW, 'today', 'seven')).toBeNull()
    expect(wakeIso(NOW, 'today', '25:00')).toBeNull()
    // Build-out item 2.2: shorthand, read as in the sleep and wake editor.
    expect(wakeIso(NOW, 'today', '7')).toBe('2026-11-05T07:00:00-05:00')
    expect(wakeIso(NOW, 'yesterday', '11:15 pm')).toBe('2026-11-04T23:15:00-05:00')
  })
})

describe('when Set wake time is offered', () => {
  it('only while there is no wake time and nobody is asleep', () => {
    expect(canSetWake([], sleepStatus([]))).toBe(true)
    const asleep = [{ id: 's', sleepStart: '2026-11-05T01:00:00-05:00', wake: null }]
    expect(canSetWake(asleep, sleepStatus(asleep))).toBe(false)
    const woke = [{ id: 's', sleepStart: null, wake: '2026-11-05T07:00:00-05:00' }]
    expect(canSetWake(woke, sleepStatus(woke))).toBe(false)
    expect(canSetWake(demoDoc.sleeps, sleepStatus(demoDoc.sleeps))).toBe(false)
  })
})

describe('the regroup preview (regroupForWake)', () => {
  it('wake Thu 07:00: Yogurt and Banana move in; Oat bar and Toast stay before it', () => {
    const r = regroupForWake(MEALS, [], '2026-11-05T07:00:00-05:00', NOW, 'w')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.wake).toBe('2026-11-05T07:00:00-05:00')
    expect(r.sleeps).toEqual([{ id: 'w', sleepStart: null, wake: '2026-11-05T07:00:00-05:00' }])
    expect(names(r.moving)).toEqual(['Yogurt', 'Banana'])
    expect(names(r.staying)).toEqual(['Oat bar', 'Toast'])
  })

  it('wake yesterday at 07:00: all four move in, none stay', () => {
    const r = regroupForWake(MEALS, [], '2026-11-04T07:00:00-05:00', NOW)
    expect(r.ok && names(r.moving)).toEqual(['Oat bar', 'Toast', 'Yogurt', 'Banana'])
    expect(r.ok && r.staying).toEqual([])
  })

  it('wake Thu 09:00: only Banana moves; a meal at exactly the wake time would join the new day', () => {
    const r = regroupForWake(MEALS, [], '2026-11-05T09:00:00-05:00', NOW)
    expect(r.ok && names(r.moving)).toEqual(['Banana'])
    expect(r.ok && names(r.staying)).toEqual(['Oat bar', 'Toast', 'Yogurt'])
    const atWake = regroupForWake(MEALS, [], '2026-11-05T08:10:00-05:00', NOW)
    expect(atWake.ok && names(atWake.moving)).toEqual(['Yogurt', 'Banana'])
  })

  it('a time later than now saves nothing', () => {
    expect(regroupForWake(MEALS, [], '2026-11-05T11:00:00-05:00', NOW)).toEqual({ ok: false, problem: { kind: 'future' } })
    expect(regroupForWake(MEALS, [], null, NOW)).toEqual({ ok: false, problem: { kind: 'not-a-time' } })
  })

  it('lists workouts too: wake Thu 07:00 moves the Thu 07:30 stretch in and keeps the Wed 18:00 run before it', () => {
    // Build-out item 2.2: the same entries the editor's move warning lists.
    const run = { id: 'r', name: 'Evening run', startedAt: '2026-11-04T18:00:00-05:00', minutes: 30, kcal: 280, source: 'burn_device' as const }
    const stretch = { id: 's', name: 'Stretching', startedAt: '2026-11-05T07:30:00-05:00', minutes: 15, kcal: null, source: null }
    const r = regroupForWake(MEALS, [], '2026-11-05T07:00:00-05:00', NOW, 'w', [stretch, run])
    if (!r.ok) throw new Error('expected ok')
    expect(r.movingWorkouts).toEqual([{ kind: 'workout', id: 's', name: 'Stretching', at: '2026-11-05T07:30:00-05:00', kcal: null }])
    expect(r.stayingWorkouts).toEqual([{ kind: 'workout', id: 'r', name: 'Evening run', at: '2026-11-04T18:00:00-05:00', kcal: null }])
    // The meals are as before; workouts never count in a list's calories.
    expect(names(r.moving)).toEqual(['Yogurt', 'Banana'])
    expect(regroupTotal(r.moving)).toEqual({ kcal: 255, unknown: 0 })
    // Without workouts passed, the lists hold none.
    const plain = regroupForWake(MEALS, [], '2026-11-05T07:00:00-05:00', NOW)
    expect(plain.ok && [plain.movingWorkouts, plain.stayingWorkouts]).toEqual([[], []])
  })

  it('with no meals there is nothing to move', () => {
    const r = regroupForWake([], [], '2026-11-05T07:00:00-05:00', NOW)
    expect(r.ok && [r.moving, r.staying]).toEqual([[], []])
  })

  it('after saving, every meal is still in the log: two in Thursday’s day, two one day back', () => {
    const r = regroupForWake(MEALS, [], '2026-11-05T07:00:00-05:00', NOW, 'w')
    if (!r.ok) throw new Error('expected ok')
    const doc: LogDoc = { ...emptyLog(), meals: MEALS, sleeps: r.sleeps }
    const nav = dayNav(doc, null, NOW)
    expect(nav.days).toEqual([null, '2026-11-05T07:00:00-05:00'])
    expect(nav.current).toBe('2026-11-05T07:00:00-05:00')
    expect(names(buildDayViewFor(doc, nav.current).meals)).toEqual(['Yogurt', 'Banana'])
    expect(names(buildDayViewFor(doc, null).meals)).toEqual(['Oat bar', 'Toast'])
    // 150 + 105 kcal on the new day.
    expect(buildDayViewFor(doc, nav.current).day.knownTotal).toBe(255)
  })
})

describe('each list’s calories in the preview (regroupTotal)', () => {
  it('adds the known meals, as the headline does: 255 kcal today, 430 kcal earlier', () => {
    const r = regroupForWake(MEALS, [], '2026-11-05T07:00:00-05:00', NOW)
    if (!r.ok) throw new Error('expected ok')
    expect(regroupTotal(r.moving)).toEqual({ kcal: 255, unknown: 0 })
    expect(regroupTotal(r.staying)).toEqual({ kcal: 430, unknown: 0 })
    // Yesterday 07:00: all four in today's list, 190 + 240 + 150 + 105.
    const all = regroupForWake(MEALS, [], '2026-11-04T07:00:00-05:00', NOW)
    expect(all.ok && regroupTotal(all.moving)).toEqual({ kcal: 685, unknown: 0 })
  })

  it('leaves out meals with unknown calories and counts them; none known is unknown, never 0', () => {
    const mystery = meal('label', null, { id: 'e', name: 'Soup', eatenAt: '2026-11-05T09:50:00-05:00', source: null })
    // Yogurt 150 + Banana 105, with Soup left out.
    expect(regroupTotal([yogurt, banana, mystery])).toEqual({ kcal: 255, unknown: 1 })
    expect(regroupTotal([mystery])).toEqual({ kcal: null, unknown: 1 })
    expect(regroupTotal([])).toEqual({ kcal: null, unknown: 0 })
  })
})

describe('the time field’s default', () => {
  it('is shown as 7:00 AM', () => {
    expect(defaultWakeLabel()).toBe('7:00 AM')
  })
})
