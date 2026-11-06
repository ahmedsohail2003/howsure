// Build-out item 2.4: the tracker's weigh-in records become HowSure weigh-ins. Every record here is
// invented for the fictional Sam, in the shape the tracker's export uses. Time zone: Toronto
// (tests/vitest.setup.ts).
import { describe, expect, it } from 'vitest'
import { fromKg } from '../../kernel/weight'
import { logDocSchema } from '../../store/schema'
import { withoutWeighIn, withWeighIn } from '../../ui/weighInEdit'
import { APPROX_AFTER_WAKE_MIN, APPROX_HOUR, weighInsFromTracker } from '../trackerWeighIns'

const RECORDS = [
  { id: '2026-10-03', data: { date: '2026-10-03', lb: 171.4, bf: 22.8, saved: '2026-10-05T13:40:00-04:00' }, updatedAt: '2026-10-05T17:40:00.1234Z', version: 1 },
  { id: '2026-10-01', data: { date: '2026-10-01', lb: 172, time: '6:48 AM', saved: '2026-10-01T09:00:00-04:00' }, updatedAt: '2026-10-01T13:00:00.12Z', version: 2 },
  { id: '2026-10-02', data: { date: '2026-10-02', lb: 171.8, time: '12:05 PM', bf: 22.9, saved: '2026-10-02T13:00:00-04:00' } },
]

describe('tracker weigh-ins', () => {
  const { weighIns, skipped } = weighInsFromTracker(RECORDS)

  it('reads every record, oldest first, with nothing skipped', () => {
    expect(skipped).toEqual([])
    expect(weighIns.map((w) => w.id)).toEqual([
      'weighin-tracker-2026-10-01',
      'weighin-tracker-2026-10-02',
      'weighin-tracker-2026-10-03',
    ])
  })

  it('converts lb with the exact factor and keeps lb as the unit it was entered in', () => {
    const w = weighIns[2]
    expect(w.kg).toBe(171.4 * 0.45359237)
    expect(w.kg).toBeCloseTo(77.745732218, 9)
    expect(w.unit).toBe('lb')
    expect(fromKg(w.kg, 'lb')).toBeCloseTo(171.4, 9)
  })

  it('takes the time from the record when it has one, on its own date', () => {
    expect(weighIns[0].at).toBe('2026-10-01T06:48:00-04:00')
    expect(weighIns[0].timeApproximate).toBeUndefined()
    // 12:05 PM is just after noon, not just after midnight.
    expect(weighIns[1].at).toBe('2026-10-02T12:05:00-04:00')
  })

  it('with no time, places it at noon on its calendar date and marks it approximate', () => {
    expect(APPROX_HOUR).toBe(12)
    expect(weighIns[2].at).toBe('2026-10-03T12:00:00-04:00')
    expect(weighIns[2].timeApproximate).toBe(true)
  })

  it('with no time but a wake recorded on its date, places it one minute after that wake, in that waking day', () => {
    expect(APPROX_AFTER_WAKE_MIN).toBe(1)
    // Sam woke at 1:20 PM on the 3rd (a late wake), and twice on the 4th (a nap): the first counts.
    const wakes = ['2026-10-03T13:20:00-04:00', '2026-10-04T15:00:00-04:00', '2026-10-04T07:05:00-04:00', 'not a time']
    const { weighIns: placed } = weighInsFromTracker(
      [...RECORDS, { data: { date: '2026-10-04', lb: 171 } }, { data: { date: '2026-10-05', lb: 170.8 } }],
      wakes,
    )
    const byDate = new Map(placed.map((w) => [(w.imported as { date: string }).date, w]))
    expect(byDate.get('2026-10-03')?.at).toBe('2026-10-03T13:21:00-04:00')
    expect(byDate.get('2026-10-03')?.timeApproximate).toBe(true)
    expect(byDate.get('2026-10-04')?.at).toBe('2026-10-04T07:06:00-04:00')
    // No wake on the 5th: noon. A recorded time is kept whatever the wakes say.
    expect(byDate.get('2026-10-05')?.at).toBe('2026-10-05T12:00:00-04:00')
    expect(byDate.get('2026-10-01')?.at).toBe('2026-10-01T06:48:00-04:00')
    // A wake just before midnight belongs to its own date, not the next.
    const [late] = weighInsFromTracker([{ data: { date: '2026-10-06', lb: 170 } }], ['2026-10-05T23:30:00-04:00']).weighIns
    expect(late.at).toBe('2026-10-06T12:00:00-04:00')
  })

  it('keeps body fat when it is a percentage, and every original field under imported', () => {
    expect(weighIns[2].bodyFatPct).toBe(22.8)
    expect(weighIns[0].bodyFatPct).toBeUndefined()
    expect(weighIns[2].imported).toEqual(RECORDS[0].data)
    expect(weighIns[0].imported).toEqual(RECORDS[1].data)
  })

  it('makes weigh-ins a saved log accepts', () => {
    const doc = { version: 1, kind: 'mine', profile: { name: '', kind: 'guest' }, meals: [], sleeps: [], workouts: [], plates: [], weighIns }
    expect(logDocSchema.safeParse(doc).success).toBe(true)
  })

  it('uses the offset of the date itself across the clock change', () => {
    const [w] = weighInsFromTracker([{ data: { date: '2026-11-02', lb: 170 } }]).weighIns
    expect(w.at).toBe('2026-11-02T12:00:00-05:00')
  })

  it('reads a bare record, a numeric string, and ignores a time the tracker would not accept', () => {
    const [w] = weighInsFromTracker([{ date: '2026-10-04', lb: '170.6', time: '06:48' }]).weighIns
    expect(w.kg).toBe(170.6 * 0.45359237)
    expect(w.at).toBe('2026-10-04T12:00:00-04:00')
    expect(w.timeApproximate).toBe(true)
  })

  it('drops body fat that is not a percentage, keeping it in the original record', () => {
    const [w] = weighInsFromTracker([{ data: { date: '2026-10-04', lb: 170, bf: 0 } }, { data: { date: '2026-10-05', lb: 170, bf: 140 } }]).weighIns
    expect(w.bodyFatPct).toBeUndefined()
    expect(w.imported).toEqual({ date: '2026-10-04', lb: 170, bf: 0 })
  })

  it('skips a record with no real date or no weight, and says which', () => {
    const res = weighInsFromTracker([
      { id: 'x', data: { date: '2026-13-40', lb: 170 } },
      { data: { lb: 170 } },
      { data: { date: '2026-10-06' } },
      { data: { date: '2026-10-07', lb: 0 } },
      { data: { date: '2026-10-08', lb: '?' } },
      null,
    ])
    expect(res.weighIns).toEqual([])
    expect(res.skipped).toEqual([
      { id: '2026-13-40', reason: 'noDate' },
      { id: '#2', reason: 'noDate' },
      { id: '2026-10-06', reason: 'noWeight' },
      { id: '2026-10-07', reason: 'noWeight' },
      { id: '2026-10-08', reason: 'noWeight' },
      { id: '#6', reason: 'noDate' },
    ])
  })

  it('gives two records on the same date their own ids, so editing or deleting one leaves the other', () => {
    const { weighIns: two } = weighInsFromTracker([
      { data: { date: '2026-10-04', lb: 171.2, time: '6:40 AM' } },
      { data: { date: '2026-10-04', lb: 170.6, time: '9:15 PM' } },
      { data: { date: '2026-10-04', lb: 170.9 } },
    ])
    expect(two.map((w) => w.id)).toEqual(['weighin-tracker-2026-10-04', 'weighin-tracker-2026-10-04-3', 'weighin-tracker-2026-10-04-2'])
    expect(new Set(two.map((w) => w.id)).size).toBe(3)
    const doc = logDocSchema.parse({ version: 1, kind: 'mine', profile: { name: '', kind: 'guest' }, meals: [], sleeps: [], workouts: [], plates: [], weighIns: two })
    const edited = withWeighIn(doc, { ...two[0], note: 'After a run' })
    expect(edited.weighIns?.filter((w) => w.note === 'After a run')).toHaveLength(1)
    expect(withoutWeighIn(doc, two[0].id).weighIns).toHaveLength(2)
  })
})
