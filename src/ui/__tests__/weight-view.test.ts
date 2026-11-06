// Build-out item 2.4: what the weight screens show (weightView.ts) and what the Log weight sheet
// saves (weighInEdit.ts). The person is the fictional Sam; every weigh-in is made up. Expected
// words are written by hand from copy.ts. Time zone: Toronto (tests/vitest.setup.ts).
import { describe, expect, it } from 'vitest'
import golden from '../../../fixtures/golden-weight.json'
import type { SleepRecord, WeighIn, WeightUnit } from '../../kernel/types'
import { toKg } from '../../kernel/weight'
import { emptyLog, type LogDoc } from '../../store/log'
import { bodyValueInRange } from '../balanceView'
import { dayNav } from '../days'
import {
  checkWeighIn,
  draftFor,
  showsSavedWeight,
  unitToRemember,
  weightInputText,
  withDraftUnit,
  withoutWeighIn,
  withWeighIn,
  withWeightUnit,
  type WeighInDraft,
} from '../weighInEdit'
import { averageText, buildWeightView, fmtWeighInWhen, fmtWeight, trendParts, weightAsOf, weightUnitOf } from '../weightView'

const NBSP = ' '

const SAM: WeighIn[] = golden.weighIns.map((w) => ({ id: w.id, at: w.at, kg: toKg(w.value, w.unit as WeightUnit), unit: w.unit as WeightUnit }))

// Sam woke on Mon 19th, Tue 20th and Wed 21st; no weigh-in on the Tuesday.
const SLEEPS: SleepRecord[] = [
  { id: 's1', sleepStart: '2026-10-18T23:00:00-04:00', wake: '2026-10-19T06:30:00-04:00' },
  { id: 's2', sleepStart: '2026-10-19T23:10:00-04:00', wake: '2026-10-20T07:00:00-04:00' },
  { id: 's3', sleepStart: '2026-10-20T23:20:00-04:00', wake: '2026-10-21T06:50:00-04:00' },
]
const MON = '2026-10-19T06:30:00-04:00'
const TUE = '2026-10-20T07:00:00-04:00'
const WED = '2026-10-21T06:50:00-04:00'
const NOW = golden.cases[0].asOf // Wed 21st, 8 PM

function samLog(over: Partial<LogDoc> = {}): LogDoc {
  return { ...emptyLog(), sleeps: SLEEPS, weighIns: SAM, ...over }
}

describe('the unit weights are shown in', () => {
  it('is the preference when there is one', () => {
    expect(weightUnitOf({ settings: { weightUnit: 'lb' }, weighIns: [] })).toBe('lb')
  })

  it('else the unit of the latest weigh-in that has one, else kg', () => {
    expect(weightUnitOf({ weighIns: SAM })).toBe('kg')
    expect(weightUnitOf({ weighIns: SAM.slice(0, 6) })).toBe('lb')
    expect(weightUnitOf({ weighIns: [{ id: 'old', at: MON, kg: 70 }] })).toBe('kg')
    expect(weightUnitOf({})).toBe('kg')
  })
})

describe('as of when', () => {
  it('now on the current day', () => {
    expect(weightAsOf(SLEEPS, WED, NOW)).toBe(NOW)
  })

  it('just before the next wake on an earlier day', () => {
    expect(Date.parse(weightAsOf(SLEEPS, TUE, NOW))).toBe(Date.parse(WED) - 1)
    expect(Date.parse(weightAsOf(SLEEPS, null, NOW))).toBe(Date.parse(MON) - 1)
  })
})

describe('the weight view for a day', () => {
  it('the current day: its weigh-in, the 7-day average and the trend, as the golden values', () => {
    const v = buildWeightView(samLog(), WED, NOW)
    expect(v.day.map((w) => w.id)).toEqual(['w10'])
    expect(v.latest?.id).toBe('w10')
    expect(v.average?.count).toBe(golden.cases[0].average?.count)
    expect(v.average?.kg).toBeCloseTo(golden.cases[0].average?.kg ?? 0, 9)
    expect(v.trend).toMatchObject({ status: 'ok', count: 9 })
    expect(v.all.map((w) => w.id)).toEqual(SAM.map((w) => w.id).reverse())
    expect(fmtWeight(v.latest?.kg ?? 0, v.unit)).toBe(`78.6${NBSP}kg`)
    expect(trendParts(v.trend, 'kg')).toEqual({ value: 'down 0.5 kg a week', note: 'from 9 weigh-ins in 21 days', ok: true })
    expect(trendParts(v.trend, 'lb').value).toBe('down 1.1 lb a week')
    // The current day: no "as of" line, and Latest is the newest weigh-in.
    expect(v.asOfDay).toBeNull()
    expect(v.latestAsOf?.id).toBe('w10')
    expect(v.chartTitle).toBe('Last 30 days')
  })

  it('an earlier day with no weigh-in has none, and shows the average and trend as they stood then', () => {
    const v = buildWeightView(samLog(), TUE, NOW)
    expect(v.latest).toBeNull()
    // Up to just before Wednesday's 6:50 wake: w06 (Wed 14th, 7:30) to w09 are in the 7 days.
    expect(v.average?.count).toBe(4)
    expect(v.trend).toMatchObject({ status: 'ok', count: 8 })
  })

  it('an earlier day: Latest, the average, the trend and the chart all stand at the end of that day, and say so', () => {
    const v = buildWeightView(samLog(), TUE, NOW)
    expect(v.asOfDay).toBe('Tue Oct 20')
    // Wednesday's w10 came after Tuesday ended: Latest is Monday's w09, and nothing counts w10.
    expect(v.latestAsOf?.id).toBe('w09')
    expect(v.average?.count).toBe(4)
    expect(v.chart?.points.map((p) => p.id)).not.toContain('w10')
    expect(v.chart?.points.at(-1)?.id).toBe('w09')
    expect(v.chart?.xEnd).toBe('Tue Oct 20')
    expect(v.chartTitle).toBe('30 days to the end of Tue Oct 20')
    // The list of every weigh-in still runs to the newest.
    expect(v.all[0].id).toBe('w10')
  })

  it('an earlier day before any weigh-in has no Latest', () => {
    const v = buildWeightView(samLog({ weighIns: SAM.slice(9) }), TUE, NOW)
    expect(v.latestAsOf).toBeNull()
    expect(v.average).toBeNull()
    expect(v.all).toHaveLength(1)
  })

  it('the chart can be laid out at the width it is drawn at, with the same points', () => {
    const v = buildWeightView(samLog(), WED, NOW)
    const wide = v.chartAt(480)
    expect(wide?.width).toBe(480)
    expect(wide?.plot.right).toBe(472)
    expect(wide?.points.map((p) => p.id)).toEqual(v.chart?.points.map((p) => p.id))
    expect(wide?.points.map((p) => p.y)).toEqual(v.chart?.points.map((p) => p.y))
  })

  it('Monday holds Monday morning’s weigh-in; the day before the first wake holds the rest', () => {
    expect(buildWeightView(samLog(), MON, NOW).day.map((w) => w.id)).toEqual(['w09'])
    expect(buildWeightView(samLog(), null, NOW).day).toHaveLength(8)
  })

  it('with few weigh-ins, says how many more the trend needs', () => {
    const v = buildWeightView(samLog({ weighIns: SAM.slice(8) }), WED, NOW)
    expect(v.trend).toEqual({ status: 'needMore', count: 2, needed: 4 })
    // "weigh-ins" with a word joiner (U+2060) after the hyphen, so it never splits there.
    expect(trendParts(v.trend, 'kg')).toEqual({ value: '4 more weigh-ins needed', note: 'shown from 6 weigh-\u2060ins in 21 days, over at least 4 days', ok: false })
    const one = buildWeightView(samLog({ weighIns: SAM.slice(5) }), WED, NOW)
    expect(trendParts(one.trend, 'kg').value).toBe('1 more weigh-in needed')
    expect(trendParts(buildWeightView(samLog(), WED, NOW).trend, 'kg')).toEqual({
      value: 'down 0.5 kg a week',
      note: 'from 9 weigh-ins in 21 days',
      ok: true,
    })
  })

  it('a weigh-in timed later than now on the current day waits: not the day figure, not counted yet', () => {
    // As an import can bring: Wed 21st at 9 PM, with now at 8 PM. The day shows w10 (7:35 AM),
    // as the details' Latest and the average do, until 9 PM comes.
    const later: WeighIn = { id: 'later', at: '2026-10-21T21:00:00-04:00', kg: 77, unit: 'kg' }
    const v = buildWeightView(samLog({ weighIns: [...SAM, later] }), WED, NOW)
    expect(v.day.map((w) => w.id)).toEqual(['w10'])
    expect(v.latest?.id).toBe('w10')
    expect(v.latestAsOf?.id).toBe('w10')
    expect(v.average?.count).toBe(golden.cases[0].average?.count)
    // It is in the list of every weigh-in, and counts once its time has come.
    expect(v.all[0].id).toBe('later')
    const after = buildWeightView(samLog({ weighIns: [...SAM, later] }), WED, '2026-10-21T21:30:00-04:00')
    expect(after.latest?.id).toBe('later')
    expect(after.day.map((w) => w.id)).toEqual(['w10', 'later'])
  })

  it('a log with no weigh-ins: none on the day, no average, 6 needed, no chart', () => {
    const v = buildWeightView(emptyLog(), null, NOW)
    expect(v).toMatchObject({ unit: 'kg', day: [], latest: null, average: null, all: [], chart: null })
    expect(v.trend).toEqual({ status: 'needMore', count: 0, needed: 6 })
  })

  it('says "about level" when the slope rounds to 0.0 in the unit shown', () => {
    const rate = (kgPerWeek: number, unit: 'kg' | 'lb') => trendParts({ status: 'ok', kgPerWeek, count: 6 }, unit).value
    expect(rate(0.04, 'kg')).toBe('about level, under 0.1 kg a week')
    expect(rate(0.04, 'lb')).toBe('up 0.1 lb a week')
    expect(rate(-0.02, 'lb')).toBe('about level, under 0.1 lb a week')
  })

  it('6 weigh-ins over too few days: a status sentence, never a rate or a "1 more needed"', () => {
    const at = (d: number, h: number) => new Date(Date.parse('2026-10-19T07:00:00-04:00') + d * 86_400_000 + h * 3_600_000).toISOString()
    const burst: WeighIn[] = [0, 1, 2, 3, 4, 5].map((i) => ({ id: `b${i}`, at: at(Math.floor(i / 2), (i % 2) * 12), kg: 80 + (i % 2) }))
    const v = buildWeightView(samLog({ weighIns: burst }), WED, NOW)
    expect(v.trend).toMatchObject({ status: 'needSpan', count: 6 })
    // First to last: 2 days 12 h, so "under 3 days", never a rounded-down "2 days".
    expect(trendParts(v.trend, 'kg')).toEqual({ value: 'needs weigh-\u2060ins spread over 4 days', note: 'these 6 span under 3 days', ok: false })
    const sameMoment = burst.map((w) => ({ ...w, at: '2026-10-21T07:00:00-04:00' }))
    expect(trendParts(buildWeightView(samLog({ weighIns: sameMoment }), WED, NOW).trend, 'kg').note).toBe('these 6 all have the same time')
    // 11 PM one evening to 7 AM the next morning: two dates, 8 hours.
    const overnight: WeighIn[] = [0, 1, 2, 3, 4, 5].map((i) => ({ id: `o${i}`, at: at(1, 16 + i * 1.6), kg: 80 }))
    expect(trendParts(buildWeightView(samLog({ weighIns: overnight }), WED, NOW).trend, 'kg').note).toBe('these 6 span under 1 day')
    const threeDays: WeighIn[] = [0, 0.5, 1, 1.5, 2, 3].map((d, i) => ({ id: `t${i}`, at: at(d - 1, 0), kg: 80 }))
    expect(trendParts(buildWeightView(samLog({ weighIns: threeDays }), WED, NOW).trend, 'kg').note).toBe('these 6 span 3 days')
  })

  it('no weigh-ins in the last 7 days: a status sentence for today, another for an earlier day', () => {
    expect(averageText(null, 'kg', true)).toEqual({ value: 'No weigh-\u2060ins in the last 7 days', note: '', ok: false })
    expect(averageText(null, 'kg', false)).toEqual({ value: 'No weigh-\u2060ins in the 7 days to the end of that day', note: '', ok: false })
    expect(averageText({ kg: 78.95, count: 4 }, 'kg', true)).toEqual({ value: `79.0${NBSP}kg`, note: 'average of 4 weigh-ins', ok: true })
    // Sam's weigh-ins with the clock 10 days after the last one: none in the 7 days, the trend still from 21.
    const later = '2026-10-31T20:00:00-04:00'
    const v = buildWeightView(samLog(), WED, later)
    expect(v.average).toBeNull()
    expect(averageText(v.average, v.unit, v.asOfDay === null).value).toBe('No weigh-\u2060ins in the last 7 days')
  })
})

describe('an earlier day that ran on for days', () => {
  // No sleep logged after Wed 21st until Sat 31st: Wednesday's waking day runs to Sat 7:00 AM.
  const later: SleepRecord[] = [...SLEEPS, { id: 's4', sleepStart: '2026-10-30T23:00:00-04:00', wake: '2026-10-31T07:00:00-04:00' }]
  const SAT_10AM = '2026-10-31T10:00:00-04:00'

  it('names the moment it ended, so "the end of Wed Oct 21" never stands for Oct 31', () => {
    const v = buildWeightView(samLog({ sleeps: later }), WED, SAT_10AM)
    expect(v.asOfDay).toBe('Wed Oct 21')
    expect(v.ranOnTo).toBe('Sat Oct 31, 7:00 AM')
    expect(v.latest?.id).toBe('w10')
    expect(v.average).toBeNull()
    expect(averageText(v.average, v.unit, false, v.ranOnTo).value).toBe('No weigh-\u2060ins in the 7 days to Sat Oct 31, 7:00 AM, when that day ended')
    expect(v.chartTitle).toBe('30 days to Sat Oct 31, 7:00 AM')
    expect(v.chart?.xEnd).toBe('Sat Oct 31')
  })

  it('an ordinary earlier day, ending the next morning, keeps "the end of that day"', () => {
    const v = buildWeightView(samLog(), TUE, NOW)
    expect(v.ranOnTo).toBeNull()
    expect(v.chartTitle).toBe('30 days to the end of Tue Oct 20')
    expect(averageText(null, v.unit, false, v.ranOnTo).value).toBe('No weigh-\u2060ins in the 7 days to the end of that day')
  })
})

describe('the provisional day, before the first wake in the log', () => {
  // Sam weighs in Tue 9 PM, sleeps, wakes Wed 7:00 AM and weighs in again at 7:30.
  const first: SleepRecord[] = [{ id: 'p1', sleepStart: '2026-10-20T23:00:00-04:00', wake: '2026-10-21T07:00:00-04:00' }]
  const two: WeighIn[] = [
    { id: 'tue', at: '2026-10-20T21:00:00-04:00', kg: 80, unit: 'kg' },
    { id: 'wed', at: '2026-10-21T07:30:00-04:00', kg: 79.5, unit: 'kg' },
  ]
  const WED_NOON = '2026-10-21T12:00:00-04:00'

  it('names the wake it ended at, never "the end of" the date of that wake', () => {
    const v = buildWeightView(samLog({ sleeps: first, weighIns: two }), null, WED_NOON)
    expect(v.provisional).toBe(true)
    expect(v.ranOnTo).toBe('Wed Oct 21, 7:00 AM')
    expect(v.latestAsOf?.id).toBe('tue')
    expect(v.day.map((w) => w.id)).toEqual(['tue'])
    expect(v.chartTitle).toBe('30 days to Wed Oct 21, 7:00 AM')
    expect(v.chartTitle).not.toContain('end of')
    expect(averageText(v.average, v.unit, false, v.ranOnTo).value).toBe('80.0 kg')
  })

  it('while it is still the current day, has no as-of line', () => {
    const v = buildWeightView(samLog({ sleeps: first, weighIns: two.slice(0, 1) }), null, '2026-10-20T22:00:00-04:00')
    expect(v.provisional).toBe(false)
    expect(v.asOfDay).toBeNull()
    expect(v.ranOnTo).toBeNull()
  })

  it('an ordinary earlier day is not provisional', () => {
    expect(buildWeightView(samLog(), TUE, NOW).provisional).toBe(false)
  })
})

describe('the chart', () => {
  it('never labels its bottom end below 0, however far apart the weigh-ins are', () => {
    const far: WeighIn[] = [
      { id: 'a', at: '2026-10-20T08:00:00-04:00', kg: 1, unit: 'kg' },
      { id: 'b', at: '2026-10-21T08:00:00-04:00', kg: 499.9, unit: 'kg' },
    ]
    const c = buildWeightView(samLog({ weighIns: far }), WED, NOW).chart
    expect(c?.yBottom).toBe(`0.0${NBSP}kg`)
    for (const p of c?.points ?? []) expect(p.y).toBeLessThanOrEqual(c?.plot.bottom ?? 0)
  })

  it('says when the line also counts weigh-ins from just before the 30 days', () => {
    // Sam's 21 days fit inside the window: the line counts nothing from before it.
    expect(buildWeightView(samLog(), WED, NOW).chart?.lineCountsEarlier).toBe(false)
    // One weigh-in 31 days back and two inside, the first within 7 days of it.
    const edge: WeighIn[] = [
      { id: 'old', at: '2026-09-20T19:00:00-04:00', kg: 90, unit: 'kg' },
      { id: 'a', at: '2026-09-23T08:00:00-04:00', kg: 80, unit: 'kg' },
      { id: 'b', at: '2026-10-21T08:00:00-04:00', kg: 79, unit: 'kg' },
    ]
    const c = buildWeightView(samLog({ weighIns: edge }), WED, NOW).chart
    expect(c?.points.map((p) => p.id)).toEqual(['a', 'b'])
    expect(c?.lineCountsEarlier).toBe(true)
    // More than 7 days before the first dot: the line counts nothing from before the window.
    const far = [{ ...edge[0], at: '2026-09-10T08:00:00-04:00' }, edge[1], edge[2]]
    expect(buildWeightView(samLog({ weighIns: far }), WED, NOW).chart?.lineCountsEarlier).toBe(false)
  })

  it('draws every weigh-in of the last 30 days and the 7-day average through them', () => {
    const c = buildWeightView(samLog(), WED, NOW).chart
    expect(c).not.toBeNull()
    if (!c) return
    expect(c.points.map((p) => p.id)).toEqual(SAM.map((w) => w.id))
    expect(c.line.split(' ')).toHaveLength(SAM.length)
    for (const p of c.points) {
      expect(p.x).toBeGreaterThanOrEqual(c.plot.left)
      expect(p.x).toBeLessThanOrEqual(c.plot.right)
      expect(p.y).toBeGreaterThanOrEqual(c.plot.top)
      expect(p.y).toBeLessThanOrEqual(c.plot.bottom)
    }
    // The last point is the latest weigh-in, at the right edge's day; the lightest is lowest.
    const lowest = c.points.reduce((a, b) => (b.y > a.y ? b : a))
    expect(lowest.id).toBe('w10')
    expect(c.xEnd).toBe('Wed Oct 21')
    expect(c.xStart).toBe('Mon Sep 21')
  })

  it('needs 2 weigh-ins in the window', () => {
    expect(buildWeightView(samLog({ weighIns: SAM.slice(9) }), WED, NOW).chart).toBeNull()
  })
})

describe('words for a weigh-in', () => {
  it('shows lb as typed, to one decimal', () => {
    expect(fmtWeight(toKg(171.4, 'lb'), 'lb')).toBe(`171.4${NBSP}lb`)
    expect(fmtWeight(72.4, 'lb')).toBe(`159.6${NBSP}lb`)
  })

  it('names the date and time, or says the time was not recorded', () => {
    expect(fmtWeighInWhen(SAM[9])).toBe('Wed Oct 21, 7:35 AM')
    expect(fmtWeighInWhen({ ...SAM[9], timeApproximate: true })).toBe('Wed Oct 21, time not recorded')
  })
})

describe('the Log weight sheet', () => {
  const draft = (over: Partial<WeighInDraft>): WeighInDraft => ({ weight: '78.2', unit: 'kg', atLocal: '2026-10-21T19:30', bodyFat: '', note: '', ...over })

  it('a new weigh-in in kg', () => {
    const res = checkWeighIn(draft({}), null, 'weigh-new', NOW)
    expect(res.errors).toEqual({})
    expect(res.weighIn).toEqual({ id: 'weigh-new', at: '2026-10-21T19:30:00-04:00', kg: 78.2, unit: 'kg' })
  })

  it('in lb: stored in kg with the exact factor, keeping lb', () => {
    const res = checkWeighIn(draft({ weight: '172.4', unit: 'lb', bodyFat: '21.5', note: '  after the gym ' }), null, 'w', NOW)
    expect(res.weighIn).toEqual({ id: 'w', at: '2026-10-21T19:30:00-04:00', kg: 172.4 * 0.45359237, unit: 'lb', bodyFatPct: 21.5, note: 'after the gym' })
  })

  it('blank, letters, out of range, odd body fat, no time and a future time each block Save with their message', () => {
    expect(checkWeighIn(draft({ weight: '' }), null, 'w', NOW).errors).toEqual({ weight: 'Type your weight.' })
    expect(checkWeighIn(draft({ weight: 'abc' }), null, 'w', NOW).errors.weight).toBe('Use digits, e.g. 72.5')
    expect(checkWeighIn(draft({ bodyFat: 'abc' }), null, 'w', NOW).errors.bodyFat).toContain('above 0 and below 100')
    expect(checkWeighIn(draft({ weight: '0' }), null, 'w', NOW).errors.weight).toBe('Type a weight from 30 to 300 kg.')
    expect(checkWeighIn(draft({ weight: '1200', unit: 'lb' }), null, 'w', NOW).errors.weight).toBe('Type a weight from 66 to 660 lb.')
    expect(checkWeighIn(draft({ bodyFat: '0' }), null, 'w', NOW).errors.bodyFat).toContain('above 0 and below 100')
    expect(checkWeighIn(draft({ bodyFat: '100' }), null, 'w', NOW).errors.bodyFat).toContain('above 0 and below 100')
    expect(checkWeighIn(draft({ atLocal: '' }), null, 'w', NOW).errors.at).toBe('Pick a date and time.')
    expect(checkWeighIn(draft({ atLocal: '2026-10-21T20:01' }), null, 'w', NOW).errors.at).toBe(
      'That time is later than now. Pick a time up to now.',
    )
    for (const bad of ['', 'abc', '0']) expect(checkWeighIn(draft({ weight: bad }), null, 'w', NOW).weighIn).toBeNull()
  })

  it('takes the Body details range, so a slip like 8.5 for 85 is caught and every weigh-in can serve the estimate', () => {
    expect(checkWeighIn(draft({ weight: '8.5' }), null, 'w', NOW).errors.weight).toBe('Type a weight from 30 to 300 kg.')
    for (const [weight, unit] of [['30', 'kg'], ['300', 'kg'], ['66', 'lb'], ['660', 'lb']] as const) {
      const w = checkWeighIn(draft({ weight, unit }), null, 'w', NOW).weighIn
      expect(w, `${weight} ${unit}`).not.toBeNull()
      expect(bodyValueInRange('weight', w?.kg), `${weight} ${unit} reads as a Body details weight`).toBe(true)
    }
  })

  it('opening and saving an existing weigh-in changes nothing, even an lb weight and an approximate time', () => {
    const imported: WeighIn = { id: 'i', at: '2026-10-03T12:00:00-04:00', kg: 171.4 * 0.45359237, unit: 'lb', timeApproximate: true, bodyFatPct: 22.8, imported: { date: '2026-10-03', lb: 171.4 } }
    const d = draftFor(imported, NOW, 'kg')
    expect(d).toEqual({ weight: '171.4', unit: 'lb', atLocal: '2026-10-03T12:00', bodyFat: '22.8', note: '' })
    expect(checkWeighIn(d, imported, 'other', NOW).weighIn).toEqual(imported)
    // A weigh-in saved before units were kept shows in kg.
    const old: WeighIn = { id: 'weigh-mine-1', at: '2026-10-21T07:30:00-04:00', kg: 72.4 }
    expect(draftFor(old, NOW, 'lb').unit).toBe('lb')
    expect(draftFor(old, NOW, 'lb').weight).toBe(weightInputText(72.4, 'lb'))
  })

  it('a new time makes an approximate time a recorded one; a new weight is converted afresh', () => {
    const imported: WeighIn = { id: 'i', at: '2026-10-03T12:00:00-04:00', kg: 171.4 * 0.45359237, unit: 'lb', timeApproximate: true }
    const moved = checkWeighIn({ ...draftFor(imported, NOW, 'kg'), atLocal: '2026-10-03T06:45' }, imported, 'x', NOW).weighIn
    expect(moved).toEqual({ id: 'i', at: '2026-10-03T06:45:00-04:00', kg: imported.kg, unit: 'lb' })
    const reweighed = checkWeighIn({ ...draftFor(imported, NOW, 'kg'), weight: '171.2' }, imported, 'x', NOW).weighIn
    expect(reweighed?.kg).toBe(171.2 * 0.45359237)
    expect(reweighed?.timeApproximate).toBe(true)
  })

  it('switching the unit: a new weigh-in reads the number typed in the new unit', () => {
    const typed = draft({ weight: '172.4', unit: 'kg' })
    const lb = withDraftUnit(typed, 'lb', null)
    expect(lb).toEqual({ ...typed, unit: 'lb' })
    expect(checkWeighIn(lb, null, 'w', NOW).weighIn?.kg).toBe(172.4 * 0.45359237)
    expect(withDraftUnit(typed, 'kg', null)).toBe(typed)
  })

  it('switching the unit on an existing weigh-in converts the saved weight, and keeps its kg exactly', () => {
    const w: WeighIn = { id: 'i', at: '2026-10-15T07:25:00-04:00', kg: 171.4 * 0.45359237, unit: 'lb' }
    const d = draftFor(w, NOW, 'kg')
    expect(d.weight).toBe('171.4')
    const kg = withDraftUnit(d, 'kg', w)
    expect(kg).toEqual({ ...d, unit: 'kg', weight: '77.75' })
    // Never 171.4 kg: the stored weight is the same, and only its unit changes.
    expect(checkWeighIn(kg, w, 'x', NOW).weighIn).toEqual({ ...w, unit: 'kg' })
    // And back: the box shows 171.4 lb again, with the same kg.
    const back = withDraftUnit(kg, 'lb', w)
    expect(back.weight).toBe('171.4')
    expect(checkWeighIn(back, w, 'x', NOW).weighIn).toEqual(w)
    // A number typed over the saved one is read in the unit picked, as for a new weigh-in.
    const retyped = withDraftUnit({ ...d, weight: '78.0' }, 'kg', w)
    expect(retyped).toEqual({ ...d, weight: '78.0', unit: 'kg' })
    expect(checkWeighIn(retyped, w, 'x', NOW).weighIn?.kg).toBe(78)
  })

  it('the sheet’s unit hint follows the box: converts while it shows the saved weight, reads a typed number', () => {
    const w: WeighIn = { id: 'i', at: '2026-10-15T07:25:00-04:00', kg: 175 * 0.45359237, unit: 'lb' }
    const d = draftFor(w, NOW, 'kg')
    expect(showsSavedWeight(d, w)).toBe(true)
    expect(showsSavedWeight(withDraftUnit(d, 'kg', w), w)).toBe(true)
    // Typed over: the hint must no longer promise a conversion.
    expect(showsSavedWeight({ ...d, weight: '176' }, w)).toBe(false)
    expect(showsSavedWeight(draft({ weight: '175', unit: 'lb' }), null)).toBe(false)
  })

  it('a saved weight outside the range still saves while the box shows it, so its note or time can change', () => {
    // An imported weigh-in of 25 kg (the schema takes any weight above 0).
    const low: WeighIn = { id: 'low', at: '2026-10-15T07:25:00-04:00', kg: 25, unit: 'kg' }
    const noted = checkWeighIn({ ...draftFor(low, NOW, 'kg'), note: 'odd reading' }, low, 'x', NOW)
    expect(noted.errors).toEqual({})
    expect(noted.weighIn).toEqual({ ...low, note: 'odd reading' })
    // 66 lb is allowed; shown in kg it reads 29.94, under 30, and still saves with the same kg.
    const lb66: WeighIn = { id: 'l', at: '2026-10-15T07:25:00-04:00', kg: 66 * 0.45359237, unit: 'lb' }
    const asKg = withDraftUnit(draftFor(lb66, NOW, 'kg'), 'kg', lb66)
    expect(asKg.weight).toBe('29.94')
    expect(checkWeighIn(asKg, lb66, 'x', NOW).weighIn).toEqual({ ...lb66, unit: 'kg' })
    // A number typed over it is checked as usual.
    expect(checkWeighIn({ ...asKg, weight: '29.9' }, lb66, 'x', NOW).errors.weight).toBe('Type a weight from 30 to 300 kg.')
  })

  it('a time already in the past stays allowed when the weigh-in is edited later', () => {
    const w: WeighIn = { id: 'w', at: '2026-10-21T19:30:00-04:00', kg: 78 }
    expect(checkWeighIn(draftFor(w, NOW, 'kg'), w, 'x', '2026-10-21T19:00:00-04:00').weighIn).toEqual({ ...w, unit: 'kg' })
  })
})

describe('saving into the log', () => {
  it('adds, replaces and removes by id, and sets the unit preference only when it changes', () => {
    const log = samLog()
    const w: WeighIn = { id: 'new', at: NOW, kg: 78.2, unit: 'kg' }
    const added = withWeighIn(log, w)
    expect(added.weighIns).toHaveLength(SAM.length + 1)
    expect(withWeighIn(added, { ...w, kg: 78.1 }).weighIns?.find((x) => x.id === 'new')?.kg).toBe(78.1)
    expect(withoutWeighIn(added, 'new').weighIns).toEqual(SAM)
    expect(withWeighIn(emptyLog(), w).weighIns).toEqual([w])
    expect(log.weighIns).toHaveLength(SAM.length)
    const lb = withWeightUnit(log, 'lb')
    expect(lb.settings).toEqual({ weightUnit: 'lb' })
    expect(withWeightUnit(lb, 'lb')).toBe(lb)
  })

  it('a new weigh-in sets the unit preference; an edit sets it only when its unit was changed', () => {
    const oldLb: WeighIn = { id: 'o', at: MON, kg: 78, unit: 'lb' }
    expect(unitToRemember({ id: 'n', at: NOW, kg: 78, unit: 'lb' }, null, 'kg')).toBe('lb')
    // Editing an lb weigh-in's note while weights are shown in kg leaves them in kg.
    expect(unitToRemember({ ...oldLb, note: 'Before breakfast' }, oldLb, 'kg')).toBeNull()
    expect(unitToRemember({ ...oldLb, unit: 'kg' }, oldLb, 'lb')).toBe('kg')
    // A weigh-in saved before units were kept opens in the preference: unchanged means none to set.
    const noUnit: WeighIn = { id: 'u', at: MON, kg: 78 }
    expect(unitToRemember({ ...noUnit, unit: 'kg' }, noUnit, 'kg')).toBeNull()
    expect(unitToRemember({ ...noUnit, unit: 'lb' }, noUnit, 'kg')).toBe('lb')
  })
})

describe('previous and next reach the day a weigh-in is in', () => {
  it('a weigh-in before the first wake opens the day with no wake time, as a meal there does', () => {
    expect(dayNav(samLog({ weighIns: [] }), WED, NOW).days).toEqual([MON, TUE, WED])
    expect(dayNav(samLog(), WED, NOW).days).toEqual([null, MON, TUE, WED])
  })
})
