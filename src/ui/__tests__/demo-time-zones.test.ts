// spec.md > Clock > Time zones: the fixture's times are wall-clock strings read as local time,
// so the demo opens on Sam's Wednesday wherever it runs (prd.md > First Open: the current
// waking day crosses midnight and includes an after-midnight snack). With a fixed "-04:00"
// in the fixture, Los Angeles opened on "Wed · awake since 10:20 AM" and Tokyo on
// "Thu · awake since 2:20 AM" (slice 1 verifier, round 1).
import { afterEach, describe, expect, it } from 'vitest'
import { nowIso, startDemoClock } from '../../clock'
import { demoLog } from '../../store/log'
import { copy } from '../copy'
import { buildDayView } from '../dayView'
import { fmtTime, fmtWeekday, fmtWeekdayTime } from '../format'

const PINNED = process.env.TZ

// Minutes behind UTC (Date#getTimezoneOffset) on 2026-10-21, to prove the zone switch took effect.
const ZONES: [string, number][] = [
  ['America/Toronto', 240],
  ['America/Los_Angeles', 420],
  ['Pacific/Honolulu', 600],
  ['Europe/London', -60],
  ['Asia/Kolkata', -330],
  ['Asia/Tokyo', -540],
  ['Australia/Sydney', -660],
]

afterEach(() => {
  process.env.TZ = PINNED
})

describe.each(ZONES)('the demo in %s', (zone, offset) => {
  it("opens on Sam's Wednesday: awake since Wed 1:20 PM, the Thu 12:40 AM snack included, 2,280 kcal", () => {
    process.env.TZ = zone
    expect(new Date('2026-10-21T12:00:00Z').getTimezoneOffset()).toBe(offset)

    const { doc, clockStartMs } = demoLog()
    // Any real time works: the demo clock starts at the fixture's own moment.
    const realNow = Date.UTC(2026, 9, 26, 12)
    startDemoClock(clockStartMs, realNow)
    const at = nowIso('demo', realNow)
    expect(fmtWeekdayTime(at)).toBe('Thu 1:30 AM')

    const view = buildDayView(doc, at)
    expect(view.dayStart).not.toBeNull()
    expect(copy.header.awakeSince(fmtWeekday(view.dayStart!), fmtTime(view.dayStart!))).toBe(
      'Wed · awake since 1:20 PM',
    )
    expect(view.meals.map((m) => [m.name, fmtWeekdayTime(m.eatenAt)])).toEqual([
      ['Kefir with oats and blueberries', 'Wed 1:50 PM'],
      ['Pasta bake (ready meal)', 'Wed 5:30 PM'],
      ['Chicken, rice and broccoli', 'Wed 9:10 PM'],
      ['Lentil soup from the café', 'Wed 11:15 PM'],
      ['Apple and peanut butter', 'Thu 12:40 AM'],
    ])
    expect(view.day.knownTotal).toBe(2280)
    expect(view.day.score).toBe(83)
    expect(view.biggest?.name).toBe('Pasta bake (ready meal)')
  })
})
