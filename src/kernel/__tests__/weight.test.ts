// Build-out item 2.4: the weight kernel against the golden values scripts/golden.py works out on
// its own (fixtures/golden-weight.json), the unit conversion, and which waking day a weigh-in is in.
// The person is the fictional Sam; every weigh-in is made up.
import { describe, expect, it } from 'vitest'
import golden from '../../../fixtures/golden-weight.json'
import type { SleepRecord, WeighIn, WeightUnit } from '../types'
import {
  averageLine,
  averageOver,
  fromKg,
  LB_TO_KG,
  sortedWeighIns,
  toKg,
  trendRate,
  weighInsForDay,
  weighInsWithin,
} from '../weight'

/** A golden trend: 'ok' with the rate, 'needMore' with how many more are needed (or 'needSpan'). */
interface GoldenTrend {
  status: 'ok' | 'needMore' | 'needSpan'
  count: number
  kgPerWeek?: number
  lbPerWeek?: number
  ids?: string[]
  needed?: number
}

/** Sam's golden weigh-ins as the app stores them: kg worked out here from what was typed. */
const SAM: WeighIn[] = golden.weighIns.map((w) => ({
  id: w.id,
  at: w.at,
  kg: toKg(w.value, w.unit as WeightUnit),
  unit: w.unit as WeightUnit,
}))

describe('units: 1 lb is exactly 0.45359237 kg', () => {
  it('uses the exact factor, the same one the golden script uses', () => {
    expect(LB_TO_KG).toBe(0.45359237)
    expect(golden.lbToKg).toBe(LB_TO_KG)
  })

  it.each(golden.conversions)('$lb lb is $kg kg', ({ lb, kg }) => {
    expect(toKg(lb, 'lb')).toBeCloseTo(kg, 9)
    expect(fromKg(toKg(lb, 'lb'), 'lb')).toBeCloseTo(lb, 9)
  })

  it('kg stays kg', () => {
    expect(toKg(72.4, 'kg')).toBe(72.4)
    expect(fromKg(72.4, 'kg')).toBe(72.4)
  })

  it('matches the stored kg of every golden weigh-in', () => {
    for (const [i, w] of golden.weighIns.entries()) expect(SAM[i].kg).toBeCloseTo(w.kg, 9)
  })
})

describe('golden W1: the 7-day average and the 21-day trend', () => {
  it.each(golden.cases)('as of $asOf', (c) => {
    const avg = averageOver(SAM, c.asOf)
    if (c.average === null) {
      expect(avg).toBeNull()
    } else {
      expect(avg).not.toBeNull()
      expect(avg?.kg).toBeCloseTo(c.average.kg, 9)
      expect(avg?.count).toBe(c.average.count)
      expect(weighInsWithin(SAM, c.asOf, 7).map((w) => w.id)).toEqual(c.average.ids)
    }
    const trend = trendRate(SAM, c.asOf)
    const want = c.trend as GoldenTrend
    if (want.status === 'ok') {
      expect(trend.status).toBe('ok')
      if (trend.status !== 'ok') return
      expect(trend.count).toBe(want.count)
      expect(trend.kgPerWeek).toBeCloseTo(want.kgPerWeek as number, 9)
      expect(fromKg(trend.kgPerWeek, 'lb')).toBeCloseTo(want.lbPerWeek as number, 9)
      expect(weighInsWithin(SAM, c.asOf, 21).map((w) => w.id)).toEqual(want.ids)
    } else {
      expect(trend).toEqual({ status: 'needMore', count: want.count, needed: want.needed })
    }
  })

  it('the first case is a gentle fall of about half a kg a week from 9 weigh-ins', () => {
    const t = trendRate(SAM, golden.cases[0].asOf)
    expect(t).toMatchObject({ status: 'ok', count: 9 })
    if (t.status === 'ok') expect(t.kgPerWeek).toBeCloseTo(-0.5139, 4)
  })

  it('needs 6 weigh-ins: 5 in the window is not enough, and says 1 more', () => {
    const five = SAM.filter((w) => ['w06', 'w07', 'w08', 'w09', 'w10'].includes(w.id))
    expect(trendRate(five, golden.cases[0].asOf)).toEqual({ status: 'needMore', count: 5, needed: 1 })
  })

  it('weigh-ins all at one moment have no slope: they wait for the 4-day span, never a 1-more note', () => {
    const same = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, at: '2026-10-20T07:00:00-04:00', kg: 80 + i / 10 }))
    expect(trendRate(same, '2026-10-21T07:00:00-04:00')).toEqual({ status: 'needSpan', count: 7, spanDays: 0 })
  })

  it.each(golden.spanCases)('the span rule against the golden: $trend.status from $trend.count weigh-ins', (c) => {
    const pool: WeighIn[] = c.weighIns.map((w) => ({ id: w.id, at: w.at, kg: toKg(w.value, w.unit as WeightUnit) }))
    const trend = trendRate(pool, c.asOf)
    if (c.trend.status === 'needSpan') {
      expect(trend.status).toBe('needSpan')
      if (trend.status === 'needSpan') expect(trend.spanDays).toBeCloseTo(c.trend.spanDays as number, 9)
    } else {
      expect(trend.status).toBe('ok')
      if (trend.status === 'ok') expect(trend.kgPerWeek).toBeCloseTo(c.trend.kgPerWeek as number, 9)
    }
  })

  it('a span just under 4 days waits; exactly 4 days is enough', () => {
    const at = (d: number, h: number) => new Date(Date.parse('2026-10-14T07:00:00-04:00') + d * 86_400_000 + h * 3_600_000).toISOString()
    const pool = (lastDay: number) =>
      [0, 0.5, 1, 1.5, 2].map((d, i) => ({ id: `p${i}`, at: at(d, 0), kg: 80 - i / 10 })).concat({ id: 'p5', at: at(lastDay, 0), kg: 79.4 })
    expect(trendRate(pool(4), at(4, 1)).status).toBe('ok')
    const short = trendRate(pool(3.99), at(4, 1))
    expect(short.status).toBe('needSpan')
  })

  it('someone who weighs in every morning gets the trend from the 6th weigh-in, never a needs-span state', () => {
    // Mornings in a row with drifting times: 8:30 on the first, then earlier, so first to last is under 5 days.
    const day = (d: number, minutes: number) =>
      new Date(Date.parse('2026-10-14T00:00:00-04:00') + d * 86_400_000 + minutes * 60_000).toISOString()
    const times = [510, 420, 465, 410, 450, 400, 430]
    const pool = times.map((m, d) => ({ id: `m${d}`, at: day(d, m), kg: 80 - d / 10 }))
    const after = (n: number) => trendRate(pool.slice(0, n), day(n - 1, 600))
    expect(after(5)).toEqual({ status: 'needMore', count: 5, needed: 1 })
    expect(after(6)).toMatchObject({ status: 'ok', count: 6 })
    expect(after(7)).toMatchObject({ status: 'ok', count: 7 })
  })

  it('a weigh-in later than the moment asked about does not count', () => {
    const avg = averageOver(SAM, '2026-10-21T07:34:00-04:00')
    expect(avg?.count).toBe(3)
  })

  it('the chart line: the 7-day average as of each weigh-in, oldest first', () => {
    const line = averageLine(SAM)
    expect(line).toHaveLength(SAM.length)
    expect(line[0]).toEqual({ id: SAM[0].id, at: SAM[0].at, kg: SAM[0].kg, count: 1 })
    const last = line[line.length - 1]
    expect(last.count).toBe(golden.cases[0].average?.count)
    expect(last.kg).toBeCloseTo(golden.cases[0].average?.kg ?? 0, 9)
  })

  it('each point of the chart line is the 7-day average as of that weigh-in, two at one moment included', () => {
    const twin: WeighIn = { id: 'twin', at: SAM[5].at, kg: SAM[5].kg + 0.4 }
    const list = [...SAM, twin]
    for (const p of averageLine(list)) {
      const want = averageOver(list, p.at)
      expect(p.count).toBe(want?.count)
      expect(p.kg).toBeCloseTo(want?.kg ?? 0, 9)
    }
  })

  it('skips a weigh-in with no usable time or weight', () => {
    const bad: WeighIn[] = [
      { id: 'b1', at: 'not a time', kg: 80 },
      { id: 'b2', at: '2026-10-20T07:00:00-04:00', kg: 0 },
      { id: 'b3', at: '2026-10-20T07:00:00-04:00', kg: Number.NaN },
      { id: 'ok', at: '2026-10-20T07:00:00-04:00', kg: 80 },
    ]
    expect(sortedWeighIns(bad).map((w) => w.id)).toEqual(['ok'])
  })
})

describe('a weigh-in belongs to the waking day it was taken in', () => {
  // Sam woke at 6:50 on Tuesday and at 7:20 on Wednesday.
  const sleeps: SleepRecord[] = [
    { id: 's1', sleepStart: '2026-10-19T23:30:00-04:00', wake: '2026-10-20T06:50:00-04:00' },
    { id: 's2', sleepStart: '2026-10-20T23:55:00-04:00', wake: '2026-10-21T07:20:00-04:00' },
  ]
  const tue = '2026-10-20T06:50:00-04:00'
  const wed = '2026-10-21T07:20:00-04:00'
  const at = (id: string, iso: string): WeighIn => ({ id, at: iso, kg: 79 })
  const items = [
    at('before-first-wake', '2026-10-20T06:40:00-04:00'),
    at('at-the-wake', '2026-10-20T06:50:00-04:00'),
    at('tue-evening', '2026-10-20T21:00:00-04:00'),
    at('after-midnight', '2026-10-21T00:30:00-04:00'),
    at('wed-before-wake', '2026-10-21T07:10:00-04:00'),
    at('wed-morning', '2026-10-21T07:35:00-04:00'),
  ]

  it('before the first wake: the day with no wake time', () => {
    expect(weighInsForDay(items, sleeps, null).map((w) => w.id)).toEqual(['before-first-wake'])
  })

  it('from the wake to just before the next one, after midnight included, in time order', () => {
    expect(weighInsForDay([...items].reverse(), sleeps, tue).map((w) => w.id)).toEqual([
      'at-the-wake',
      'tue-evening',
      'after-midnight',
      'wed-before-wake',
    ])
  })

  it('the latest day runs on', () => {
    expect(weighInsForDay(items, sleeps, wed).map((w) => w.id)).toEqual(['wed-morning'])
  })

  it('with no wake at all, every weigh-in is in the one day', () => {
    expect(weighInsForDay(items, [], null)).toHaveLength(items.length)
  })
})
