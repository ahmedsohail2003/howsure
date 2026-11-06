// Build-out item 2.7 (checklist slice 8; prd.md > Week View): the week view's model (weekView.ts and
// weekStats.ts) and the stat registry (src/kernel/statRegistry.ts). Every stat has a week average:
//   - every number and list in the saved log, every value of a day's view and of the sleep averages,
//     is read by a registered stat or listed as not a stat, with a reason; adding a stat's data
//     without registering it fails here (shown with a made-up "steps" field below);
//   - every registered stat gives a week row (average, count, breakdown) for a week holding every
//     kind of entry.
// Then the demo's week, worked out by hand from fixtures/demo-week.json, and the rules for unknown
// days, the rolling window and the wake-time average. The people are the fictional Sam.
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { nightStats } from '../../kernel/sleepday'
import { NOT_STATS, STAT_IDS, STATS, type StatId } from '../../kernel/statRegistry'
import type { Meal, SleepRecord, WeighIn, Workout } from '../../kernel/types'
import { demoDoc, demoStartIso } from '../../kernel/__tests__/helpers'
import type { LogDoc } from '../../store/log'
import { logDocSchema } from '../../store/schema'
import { copy } from '../copy'
import { balanceView } from '../balanceView'
import { buildDayViewFor, type DayView } from '../dayView'
import { buildWeightView } from '../weightView'
import { dayNav } from '../days'
import { fmtClockMinutes } from '../sleepView'
import { buildWeekView, weekWindow, type WeekStatRow, type WeekView } from '../weekView'
import { chartNeedsDates, WEEK_ROWS } from '../weekStats'

// ---------- the registry covers everything ----------

type ZodNode = { _zod: { def: { type: string; shape?: Record<string, ZodNode>; element?: ZodNode; innerType?: ZodNode; in?: ZodNode } } }

/** Every number in a schema and every list, as paths: "meals[]", "meals[].kcal". */
function dataPaths(schema: unknown): string[] {
  const out: string[] = []
  const walk = (node: ZodNode, path: string) => {
    const d = node._zod.def
    switch (d.type) {
      case 'object':
        for (const [k, v] of Object.entries(d.shape ?? {})) walk(v, path ? `${path}.${k}` : k)
        return
      case 'array':
        out.push(`${path}[]`)
        walk(d.element as ZodNode, `${path}[]`)
        return
      case 'optional':
      case 'nullable':
      case 'default':
        walk(d.innerType as ZodNode, path)
        return
      case 'pipe':
        walk(d.in as ZodNode, path)
        return
      case 'number':
        out.push(path)
        return
      default:
        return
    }
  }
  walk(schema as ZodNode, '')
  return out
}

/** Every waking day of the demo week, so a value that is null on some days (net) is seen on one where it is not. */
const demoDays = (): DayView[] => demoDoc.sleeps.map((s) => buildDayViewFor(demoDoc, s.wake))

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * The day values every look draws from, and the sleep averages'. A day value that is an object
 * (the day's estimate, burned, net, the macros) is read one level in, so a figure inside it
 * ("DayView.burned.score") needs a stat of its own, not just its parent's.
 */
function dayValuePaths(days: Record<string, unknown>[] = demoDays() as unknown as Record<string, unknown>[]): string[] {
  const out = new Set<string>()
  for (const day of days)
    for (const [k, v] of Object.entries(day)) {
      if (isObject(v)) for (const sub of Object.keys(v)) out.add(`DayView.${k}.${sub}`)
      else if (v !== null || !days.some((d) => isObject(d[k]))) out.add(`DayView.${k}`)
    }
  return [...out, ...Object.keys(nightStats(demoDoc.sleeps)).map((k) => `NightStats.${k}`)]
}

/**
 * The numbers in a view-model, read one level into its objects ("WeightView.trend.kgPerWeek"),
 * across several states, so a figure that only some states have (a trend once it is ready) is seen.
 * Words and flags are how a figure is said, not figures.
 */
function figurePaths(prefix: string, views: unknown[]): string[] {
  const out = new Set<string>()
  for (const v of views)
    if (isObject(v))
      for (const [k, x] of Object.entries(v)) {
        if (typeof x === 'number') out.add(`${prefix}.${k}`)
        else if (isObject(x)) for (const [sk, sx] of Object.entries(x)) if (typeof sx === 'number') out.add(`${prefix}.${k}.${sk}`)
      }
  return [...out]
}

/** Sam's demo with body details and twelve daily weigh-ins (a trend that is ready), as the views read it. */
function figureDoc(): LogDoc {
  const weighIns: WeighIn[] = Array.from({ length: 12 }, (_, i) => ({
    id: `fw${i}`,
    at: `2026-10-${String(10 + i).padStart(2, '0')}T07:10:00-04:00`,
    kg: 72 - i * 0.1,
    unit: 'kg',
    bodyFatPct: 20,
  }))
  return { ...demoDoc, weighIns, profile: { ...demoDoc.profile, body: { age: 30, sex: 'female', heightCm: 165, weightKg: 70 } } }
}

/** The weight view's numbers and the balance view's, over every day of the demo, with few weigh-ins and with enough for a trend. */
function viewFigurePaths(): string[] {
  const docs = [figureDoc(), { ...figureDoc(), weighIns: figureDoc().weighIns?.slice(0, 2) }]
  const weights = docs.flatMap((doc) => doc.sleeps.map((s) => buildWeightView(doc, s.wake, demoStartIso)))
  const balances = docs.flatMap((doc) => doc.sleeps.map((s) => balanceView(doc, buildDayViewFor(doc, s.wake), demoStartIso, true)))
  return [...figurePaths('WeightView', weights), ...figurePaths('BalanceView', balances)]
}

const COVERED = new Set(STAT_IDS.flatMap((id) => STATS[id].covers))

/** Under a NOT_STATS entry: the entry itself, or a path below it ("savedMeals[]" covers "savedMeals[].kcal"). */
function exempt(path: string): boolean {
  return Object.keys(NOT_STATS).some((p) => path === p || path.startsWith(`${p}.`) || path.startsWith(`${p}[]`))
}

function uncovered(paths: string[]): string[] {
  return paths.filter((p) => !COVERED.has(p) && !exempt(p))
}

describe('the stat registry: every stat in the app has a week average', () => {
  const paths = [...dataPaths(logDocSchema), ...dayValuePaths(), ...viewFigurePaths()]

  it('reads the saved log and the day values (sanity: the walk finds what it should)', () => {
    expect(paths).toEqual(expect.arrayContaining(['meals[]', 'meals[].kcal', 'weighIns[].bodyFatPct', 'workouts[].gym.exercises[].sets[]', 'DayView.eatenSd']))
    expect(paths).toEqual(expect.arrayContaining(['DayView.day.score', 'DayView.burned.score', 'DayView.net.total', 'DayView.macros.protein']))
    expect(paths).toEqual(expect.arrayContaining(['NightStats.avgWakeMinutes', 'profile.body.heightCm', 'savedMeals[].kcal']))
    expect(paths).toEqual(expect.arrayContaining(['WeightView.average.kg', 'WeightView.trend.kgPerWeek', 'WeightView.trend.needed', 'BalanceView.est.balance', 'BalanceView.resting.kcal']))
  })

  it('every number and list in the saved log, and every day value, is read by a stat or listed as not a stat', () => {
    expect(uncovered(paths)).toEqual([])
  })

  it('a new kind of data without a registered stat fails this check (a made-up "steps" field)', () => {
    const withSteps = logDocSchema.extend({ steps: z.array(z.looseObject({ at: z.string(), count: z.number() })).optional() })
    expect(uncovered(dataPaths(withSteps))).toEqual(['steps[]', 'steps[].count'])
  })

  it('a new figure inside a day value without a stat fails too (a made-up fibre total beside the macros, a burned "confidence")', () => {
    const days = demoDays().map((d) => ({ ...d, macros: { ...d.macros, fibre: { known: 3, missing: 0, allUnknown: false } }, burned: { ...d.burned, confidence: 1 } }))
    expect(uncovered(dayValuePaths(days as unknown as Record<string, unknown>[]))).toEqual(['DayView.macros.fibre', 'DayView.burned.confidence'])
  })

  it('a figure worked out from existing data in the weight or balance view, without a stat, fails too (a made-up weekly rate, a protein share)', () => {
    const weights = [{ ...buildWeightView(figureDoc(), null, demoStartIso), ratePerMonth: 0.4 }]
    const balances = [{ kind: 'shown', est: { balance: -300, proteinShare: 0.2 } }]
    expect(uncovered([...figurePaths('WeightView', weights), ...figurePaths('BalanceView', balances)])).toEqual([
      'WeightView.ratePerMonth',
      'BalanceView.est.proteinShare',
    ])
  })

  it('burned’s Estimate score (shown beside burned in the workout list) is read by its own stat, with a week row', () => {
    expect(STATS.burnedScore.covers).toEqual(['DayView.burned.score'])
    expect(COVERED.has('DayView.burned.score')).toBe(true)
    expect(STATS.burned.covers).not.toContain('DayView.burned.score')
  })

  it('names no path that does not exist (a renamed field cannot leave a stale entry behind)', () => {
    for (const p of COVERED) expect(paths, `covers "${p}"`).toContain(p)
    for (const p of Object.keys(NOT_STATS)) {
      expect(
        paths.some((x) => x === p || x.startsWith(`${p}.`) || x.startsWith(`${p}[]`)),
        `NOT_STATS "${p}"`,
      ).toBe(true)
    }
  })

  it('every reason for "not a stat" is written out', () => {
    for (const [p, why] of Object.entries(NOT_STATS)) expect(why.split(' ').length, p).toBeGreaterThan(5)
  })

  it('every stat has a week row builder, a title and a group', () => {
    for (const id of STAT_IDS) {
      expect(typeof WEEK_ROWS[id], id).toBe('function')
      expect(copy.week.titles[id], id).toBeTruthy()
      expect(copy.week.groups[STATS[id].group], id).toBeTruthy()
    }
    expect(Object.keys(WEEK_ROWS).sort()).toEqual([...STAT_IDS].sort())
  })
})

// ---------- a week holding every kind of entry (fictional Sam) ----------

const iso = (s: string) => `${s}:00-04:00`
let n = 0
const id = (p: string) => `${p}-${++n}`

function m(at: string, source: Meal['source'], kcal: number | null, macros: [number | null, number | null, number | null] = [20, 50, 12]): Meal {
  return { id: id('meal'), name: 'Lentil bowl', eatenAt: iso(at), source, kcal, protein: macros[0], carbs: macros[1], fat: macros[2] }
}

function wo(at: string, kcal: number | null, minutes: number | null, gym = false): Workout {
  const w: Workout = { id: id('wo'), name: gym ? 'Push' : 'Bike ride', startedAt: iso(at), minutes, kcal, source: kcal === null ? null : 'burn_device' }
  if (gym)
    w.gym = {
      unit: 'kg',
      exercises: [
        { name: 'Bench press', sets: [{ kind: 'warmup', weightKg: 40, reps: 10 }, { kind: 'working', weightKg: 70, reps: 8 }, { kind: 'working', weightKg: 70, reps: 7 }] },
        { name: 'Dips', sets: [{ kind: 'working', weightKg: null, reps: 12 }] },
      ],
    }
  return w
}

/** Nine waking days, Tue Oct 13 to Wed Oct 21, each starting with a 7:00 AM wake. */
function samWeek(): LogDoc {
  const sleeps: SleepRecord[] = []
  for (let d = 13; d <= 21; d++) {
    const day = String(d).padStart(2, '0')
    const prev = String(d - 1).padStart(2, '0')
    sleeps.push({ id: `s${d}`, sleepStart: d === 17 ? null : iso(`2026-10-${prev}T23:00`), wake: iso(`2026-10-${day}T07:00`) })
  }
  const weighIns: WeighIn[] = [
    { id: 'w1', at: iso('2026-10-16T07:10'), kg: 72.4, unit: 'kg', bodyFatPct: 21 },
    { id: 'w2', at: iso('2026-10-18T07:10'), kg: 72.0, unit: 'kg' },
    { id: 'w3', at: iso('2026-10-20T07:10'), kg: 71.8, unit: 'kg', bodyFatPct: 20 },
    { id: 'w4', at: iso('2026-10-20T19:10'), kg: 72.2, unit: 'kg' },
  ]
  return {
    kind: 'mine',
    profile: { name: '', kind: 'guest', body: { age: 30, sex: 'female', heightCm: 165, weightKg: 70 } },
    meals: [
      m('2026-10-13T08:00', 'label', 600),
      m('2026-10-14T08:00', 'label', 700),
      m('2026-10-15T08:00', 'weighed', 500),
      m('2026-10-15T13:00', 'photo', 900),
      m('2026-10-16T08:00', 'label', 800, [30, null, 10]),
      m('2026-10-16T19:00', 'menu', null, [null, null, null]),
      // Sat Oct 17: nothing logged.
      m('2026-10-18T09:00', 'label', 1200),
      m('2026-10-19T09:00', 'weighed', 1500),
      m('2026-10-20T09:00', 'label', 1400),
      m('2026-10-21T09:00', 'label', 1000),
    ],
    sleeps,
    workouts: [wo('2026-10-15T18:00', 300, 40), wo('2026-10-19T18:00', 250, 60, true), wo('2026-10-20T18:00', null, null)],
    plates: [],
    settings: { weightUnit: 'kg' },
    weighIns,
  }
}

const SAM_NOW = iso('2026-10-21T20:00')

function weekOf(doc: LogDoc, now: string, viewed?: string | null): WeekView {
  const nav = dayNav(doc, viewed === undefined ? doc.sleeps[doc.sleeps.length - 1].wake : viewed, now)
  return buildWeekView(doc, nav, now)
}

const rowOf = (w: WeekView, id: StatId) => w.rows.find((r) => r.id === id) as WeekStatRow
/** Dates are kept whole with no-break spaces; read them as plain ones. */
const plain = (s: string) => s.replace(/\u00a0/g, ' ')
const names = (w: WeekView) => w.days.map((d) => plain(d.name))

describe('a week holding every kind of entry', () => {
  const week = weekOf(samWeek(), SAM_NOW)

  it('shows every registered stat, each with an average, a count and a day-by-day breakdown', () => {
    expect(week.rows.map((r) => r.id)).toEqual([...STAT_IDS])
    for (const r of week.rows) {
      expect(r.value, r.id).toBeTruthy()
      expect(r.ok, `${r.id} has a number`).toBe(true)
      expect(r.count, r.id).toBeTruthy()
      expect(r.label, r.id).toContain(r.title)
      expect(r.breakdown.days, r.id).toHaveLength(7)
      for (const d of r.breakdown.days) expect(d.status, `${r.id} ${d.day}`).toBeTruthy()
    }
  })

  it('covers the 7 waking days to the viewed one, oldest first, named by weekday and date', () => {
    expect(plain(week.window)).toBe('The 7 waking days to Wed Oct 21')
    expect(names(week)).toEqual(['Thu Oct 15', 'Fri Oct 16', 'Sat Oct 17', 'Sun Oct 18', 'Mon Oct 19', 'Tue Oct 20', 'Wed Oct 21'])
    expect(week.todayNote).toBe(copy.week.todayNote)
    expect(plain(rowOf(week, 'eaten').breakdown.days[6].day)).toBe('Wed Oct 21 (today, so far)')
  })

  it('groups the rows: food, workouts and balance, sleep, weight', () => {
    expect(week.groups.map((g) => [g.title, g.rows.map((r) => r.id)])).toEqual([
      ['Food', ['eaten', 'score', 'protein', 'carbs', 'fat']],
      ['Workouts and balance', ['net', 'burned', 'burnedScore', 'balance', 'workoutTime', 'gym']],
      ['Sleep', ['sleepLength', 'bedtime', 'wakeTime']],
      ['Weight', ['weight', 'bodyFat']],
    ])
  })

  it('calories: Fri (an unknown meal) and Sat (nothing logged) are left out and counted, never 0', () => {
    // Complete: Thu 1400, Sun 1200, Mon 1500, Tue 1400, Wed 1000 → 6500 / 5 = 1300.
    const r = rowOf(week, 'eaten')
    expect(r.value).toBe('1,300\u00a0kcal')
    // Wed is today, still going: counted with what is logged so far, and named apart in the count.
    expect(r.count).toBe('average of 4 complete days and today so far (1 incomplete left out)')
    const fri = r.breakdown.days[1]
    expect(fri).toMatchObject({ value: '800\u00a0kcal', state: 'leftOut', status: 'Left out: a meal with unknown calories', detail: 'Known meals only (incomplete)' })
    // Not logged says so once, in its status: no value, never 0.
    expect(r.breakdown.days[2]).toMatchObject({ value: '', ok: false, state: 'notLogged', status: 'Not logged' })
    expect(plain(r.breakdown.days[2].label)).toBe('Sat Oct 17: Not logged. Opens this day.')
    expect(r.breakdown.chart?.bars.map((b) => b.kind)).toEqual(['logged', 'incomplete', 'notLogged', 'logged', 'logged', 'logged', 'logged'])
    expect(r.breakdown.chart?.average).toBe(1300)
  })

  it('macros: a day with a meal missing that macro is left out (Fri carbs), not counted as 0', () => {
    // Carbs: Thu 100, Sun..Wed 50 each → 300 / 5 = 60. Fri has no carbs on either meal.
    expect(rowOf(week, 'carbs')).toMatchObject({ value: '60\u00a0g', count: 'average of 4 complete days and today so far (1 incomplete left out)' })
    expect(rowOf(week, 'carbs').breakdown.days[1]).toMatchObject({ value: 'unknown', state: 'leftOut', status: 'Left out: a meal without its carbs' })
    // Protein: Thu 40, Sun..Wed 20 each → 120 / 5 = 24. Fri has 30 g known but a meal without it.
    expect(rowOf(week, 'protein').value).toBe('24\u00a0g')
    expect(rowOf(week, 'protein').breakdown.days[1]).toMatchObject({ value: '30\u00a0g', state: 'leftOut', detail: 'Known meals only (incomplete)' })
  })

  it('burned and workout time: a workout with unknown calories or duration leaves Tue out; days with meals and no workouts count 0', () => {
    // Logged days: Thu, Fri, Sun, Mon, Tue, Wed (6). Tue's workout is unknown. Burned 300 + 250 over 5 = 110.
    expect(rowOf(week, 'burned')).toMatchObject({ value: '110\u00a0kcal', count: 'average of 4 complete days and today so far (1 incomplete left out)' })
    expect(rowOf(week, 'burned').breakdown.days[5]).toMatchObject({ value: 'unknown', state: 'leftOut', status: 'Left out: a workout with unknown calories' })
    expect(rowOf(week, 'burned').breakdown.days[3]).toMatchObject({ value: '0\u00a0kcal', detail: 'No workouts', state: 'counted' })
    // 40 + 60 over 5 = 20 min.
    expect(rowOf(week, 'workoutTime')).toMatchObject({ value: '20\u00a0min', count: 'average of 4 complete days and today so far (1 incomplete left out)' })
  })

  it('net: eaten minus burned where both are known (Thu 1100, Sun 1200, Mon 1250, Wed 1000)', () => {
    expect(rowOf(week, 'net')).toMatchObject({ value: '1,138\u00a0kcal', count: 'average of 3 complete days and today so far (2 incomplete left out)' })
  })

  it('gym: sets per session over the sessions in the week (one Push, 4 sets)', () => {
    expect(rowOf(week, 'gym')).toMatchObject({ title: 'Sets per gym session', value: '4 sets', count: 'average of 1 session in these 7 days' })
    expect(rowOf(week, 'gym').breakdown.days[4]).toMatchObject({ value: '4 sets', detail: '1 gym session', state: 'counted' })
    // Nothing to count is said once, in the status, with no value.
    expect(rowOf(week, 'gym').breakdown.days[0]).toMatchObject({ value: '', ok: false, state: 'none', status: 'No gym session' })
    expect(plain(rowOf(week, 'gym').breakdown.days[0].label)).toBe('Thu Oct 15: No gym session. Opens this day.')
  })

  it('sleep: the Sat night with no sleep time is not logged, so 6 of 7 nights', () => {
    expect(rowOf(week, 'sleepLength')).toMatchObject({ value: '8 h 0 min', count: '6 of 7 nights' })
    expect(rowOf(week, 'bedtime')).toMatchObject({ value: '11:00 PM', count: '6 of 7 nights' })
    expect(rowOf(week, 'wakeTime')).toMatchObject({ value: '7:00 AM', count: '6 of 7 nights' })
    expect(rowOf(week, 'wakeTime').breakdown.days[2]).toMatchObject({ value: '7:00 AM', state: 'leftOut', status: 'Left out: the sleep time was not logged' })
    expect(rowOf(week, 'sleepLength').breakdown.days[0]).toMatchObject({ value: '8 h 0 min', detail: 'Wed 11:00\u00a0PM to 7:00\u00a0AM' })
  })

  it('weight: every weigh-in once (72.4, 72.0, 71.8, 72.2 → 72.1 kg), with the dashboard’s trend', () => {
    const r = rowOf(week, 'weight')
    expect(r).toMatchObject({ value: '72.1\u00a0kg', count: 'average of 4 weigh-ins on 3 of 7 days' })
    expect(r.lines).toEqual(['Trend: 2 more weigh-ins needed'])
    expect(r.breakdown.days[5]).toMatchObject({ value: '72.0\u00a0kg', detail: 'average of 2 weigh-ins' })
    expect(r.breakdown.days[0]).toMatchObject({ value: '', ok: false, state: 'none', status: 'No weigh-in' })
    expect(rowOf(week, 'bodyFat')).toMatchObject({ value: '20.5%', count: 'average of 2 weigh-ins with body fat' })
  })

  it('the estimated deficit or surplus: days with every entry known count, Fri and Tue are left out', () => {
    const r = rowOf(week, 'balance')
    expect(r.count).toBe('average of 3 complete days and today so far (2 incomplete left out)')
    // Each left-out day names what was unknown: Fri a meal (no workouts that day), Tue a workout.
    expect(r.breakdown.days[1]).toMatchObject({ state: 'leftOut', status: 'Left out: a meal with unknown calories' })
    expect(r.breakdown.days[5]).toMatchObject({ state: 'leftOut', status: 'Left out: a workout with unknown calories' })
    // The average is the mean of the four counted days' deficits as each day's dashboard has them
    // (Thu, Sun, Mon and Wed so far), so a sign flip, another day's everyday burn or a known-meals-only
    // day slipping in would change it.
    expect(r.breakdown.days.map((d) => d.state)).toEqual(['counted', 'leftOut', 'notLogged', 'counted', 'counted', 'leftOut', 'counted'])
    const dashboard = week.days.flatMap((d) => (d.balance.kind === 'shown' && !d.balance.knownOnly ? [d.balance.est.balance] : []))
    expect(dashboard).toHaveLength(4)
    expect(dashboard.reduce((a, b) => a + b, 0) / 4).toBeCloseTo(-386.6, 0)
    expect(r.value).toBe('387\u00a0kcal deficit')
    expect(r.lines[0]).toMatch(/^likely /)
    // Its ranges' method, with the assumption named.
    expect(r.breakdown.notes).toEqual([copy.week.balanceMethod])
    expect(copy.week.balanceMethod).toContain('an assumption')
  })
})

describe('the rest of a week’s rows (fictional Sam)', () => {
  const week = weekOf(samWeek(), SAM_NOW)

  it('burned’s Estimate score: Thu and Mon’s device workouts score 60; Tue’s unknown workout is left out, days with none have nothing to score', () => {
    const r = rowOf(week, 'burnedScore')
    expect(r).toMatchObject({ title: 'Burned’s Estimate score', value: '60', ok: true, count: 'average of 2 days with workouts (1 incomplete left out)' })
    expect(r.breakdown.days[0]).toMatchObject({ value: '60', detail: '1 workout', state: 'counted' })
    expect(r.breakdown.days[1]).toMatchObject({ value: '', ok: false, state: 'none', status: 'No workouts' })
    expect(r.breakdown.days[5]).toMatchObject({ value: 'not scored', ok: false, state: 'leftOut', status: 'Left out: a workout with unknown calories' })
  })

  it('net and the deficit or surplus: a past day left out shows "unknown", never "not available yet"', () => {
    for (const id of ['net', 'balance'] as const) {
      const tue = rowOf(week, id).breakdown.days[5]
      expect(tue, id).toMatchObject({ value: 'unknown', ok: false, state: 'leftOut' })
      expect(tue.status, id).toMatch(/^Left out: /)
    }
    // A counted net day reads the day's own net (Thu: 1,400 eaten − 300 burned).
    expect(rowOf(week, 'net').breakdown.days[0]).toMatchObject({ value: '1,100\u00a0kcal', state: 'counted' })
    // A day with no workouts nets its meals alone (Sun 1,200).
    expect(rowOf(week, 'net').breakdown.days[3]).toMatchObject({ value: '1,200\u00a0kcal', state: 'counted' })
  })

  it('the current day is "(today, so far)" kept on one line, but "(today)" on the night before it, which is over', () => {
    expect(rowOf(week, 'eaten').breakdown.days[6].day).toBe('Wed\u00a0Oct\u00a021 (today,\u00a0so\u00a0far)')
    for (const id of ['sleepLength', 'bedtime', 'wakeTime'] as const) expect(rowOf(week, id).breakdown.days[6].day, id).toBe('Wed\u00a0Oct\u00a021 (today)')
  })

  it('a weigh-in under its day’s heading gives its time alone, not the date again', () => {
    expect(rowOf(week, 'weight').breakdown.days[1]).toMatchObject({ value: '72.4\u00a0kg', detail: '7:10\u00a0AM' })
    expect(rowOf(week, 'bodyFat').breakdown.days[1]).toMatchObject({ value: '21.0%', detail: '7:10\u00a0AM' })
  })

  it('the Estimate score’s count tells a complete day of 0 kcal from an incomplete one', () => {
    const doc = samWeek()
    const zero: LogDoc = { ...doc, meals: [...doc.meals.filter((x) => !x.eatenAt.startsWith('2026-10-18')), m('2026-10-18T09:00', 'label', 0)] }
    const r = rowOf(weekOf(zero, SAM_NOW), 'score')
    expect(r.count).toBe('average of 3 complete days and today so far (1 incomplete and 1 at 0 kcal left out)')
    expect(r.breakdown.days[3]).toMatchObject({ value: 'not scored', state: 'leftOut', status: 'Left out: no calories above 0' })
    // Every meal known and at 0 kcal: no score, but nothing incomplete.
    const allZero: LogDoc = { ...doc, meals: [m('2026-10-18T09:00', 'label', 0), m('2026-10-19T09:00', 'label', 0)] }
    expect(rowOf(weekOf(allZero, SAM_NOW), 'score')).toMatchObject({ value: 'Not available yet', ok: false, count: 'no day with a score yet (2 at 0 kcal left out)' })
  })
})

describe('Sam’s demo week (fixtures/demo-week.json), at the demo clock’s Thu 1:30 AM', () => {
  const week = weekOf(demoDoc, demoStartIso)

  it('seven days, Thu Oct 15 to Wed Oct 21; Saturday not logged and Friday known meals only', () => {
    expect(names(week)).toEqual(['Thu Oct 15', 'Fri Oct 16', 'Sat Oct 17', 'Sun Oct 18', 'Mon Oct 19', 'Tue Oct 20', 'Wed Oct 21'])
    const days = rowOf(week, 'eaten').breakdown.days
    expect(days[2]).toMatchObject({ state: 'notLogged', value: '', status: 'Not logged' })
    expect(days[1]).toMatchObject({ state: 'leftOut', value: '1,160\u00a0kcal', detail: 'Known meals only (incomplete)' })
  })

  it('every logged day has its estimate and both ranges (Wednesday is G11: 2,280, 1,870–2,780, 1,684–3,087)', () => {
    const wed = rowOf(week, 'eaten').breakdown.days[6]
    expect(wed).toMatchObject({ value: '2,280\u00a0kcal', detail: 'likely 1,870–2,780 kcal · very likely 1,684–3,087 kcal', state: 'counted' })
    for (const i of [0, 3, 4, 5]) expect(rowOf(week, 'eaten').breakdown.days[i].detail).toMatch(/^likely .* · very likely .*/)
  })

  it('the calorie average: (1,480 + 1,070 + 1,460 + 1,620 + 2,280) / 5 = 1,582, "average of 4 complete days and today so far (1 incomplete left out)" (Wed is still going at 1:30 AM)', () => {
    const r = rowOf(week, 'eaten')
    expect(r).toMatchObject({ value: '1,582\u00a0kcal', ok: true, count: 'average of 4 complete days and today so far (1 incomplete left out)' })
    expect(r.lines[0]).toMatch(/^likely [\d,]+–[\d,]+ kcal$/)
    expect(r.lines[1]).toMatch(/^very likely [\d,]+–[\d,]+ kcal$/)
    expect(r.lines[2]).toBe('Weekly totals are steadier than single meals, but photo estimates tend to run low on big plates.')
  })

  it('the Estimate score: (75 + 76 + 91 + 67 + 83) / 5 = 78; Friday is left out, not scored on its known meals', () => {
    const r = rowOf(week, 'score')
    expect(r.value).toBe('78')
    expect(r.breakdown.days.map((d) => d.value)).toEqual(['75', 'not scored', '', '76', '91', '67', '83'])
    expect(r.breakdown.days[1]).toMatchObject({ ok: false, state: 'leftOut', status: 'Left out: a meal with unknown calories' })
  })

  it('protein: (72 + 62 + 88 + 53 + 124) / 5 = 79.8, shown as 80 g', () => {
    expect(rowOf(week, 'protein')).toMatchObject({ value: '80\u00a0g', count: 'average of 4 complete days and today so far (1 incomplete left out)' })
  })

  it('net and burned, from Monday’s 210 kcal walk: net (7,910 − 210) / 5 = 1,540; burned 210 / 6 logged days = 35', () => {
    expect(rowOf(week, 'net').value).toBe('1,540\u00a0kcal')
    expect(rowOf(week, 'burned')).toMatchObject({ value: '35\u00a0kcal', count: 'average of 5 complete days and today so far' })
  })

  it('sleep: each night, the average and the average wake time, 6 of 7 nights, matching the dashboard’s 7-night figures', () => {
    const stats = nightStats(demoDoc.sleeps)
    expect(rowOf(week, 'sleepLength')).toMatchObject({ value: '8 h 49 min', count: '6 of 7 nights' })
    expect(rowOf(week, 'wakeTime')).toMatchObject({ value: fmtClockMinutes(stats.avgWakeMinutes as number), count: '6 of 7 nights' })
    expect(rowOf(week, 'sleepLength').breakdown.days[5]).toMatchObject({ value: '', state: 'notLogged', status: 'Not logged' })
  })

  it('leaves out rows for what the demo has none of: weight, body fat, gym, and the balance without body details', () => {
    const ids = week.rows.map((r) => r.id)
    expect(ids).not.toContain('weight')
    expect(ids).not.toContain('bodyFat')
    expect(ids).not.toContain('gym')
    expect(ids).not.toContain('balance')
    expect(ids).toEqual(['eaten', 'score', 'protein', 'carbs', 'fat', 'net', 'burned', 'burnedScore', 'workoutTime', 'sleepLength', 'bedtime', 'wakeTime'])
  })
})

describe('the week rolls with the day on screen', () => {
  const doc = samWeek()

  it('moving to the previous waking day shifts the week by one day', () => {
    const now = weekOf(doc, SAM_NOW)
    const before = weekOf(doc, SAM_NOW, iso('2026-10-20T07:00'))
    expect(names(before)).toEqual(['Wed Oct 14', 'Thu Oct 15', 'Fri Oct 16', 'Sat Oct 17', 'Sun Oct 18', 'Mon Oct 19', 'Tue Oct 20'])
    expect(before.days.slice(1)).toHaveLength(6)
    expect(names(before).slice(1)).toEqual(names(now).slice(0, 6))
    expect(plain(before.window)).toBe('The 7 waking days to Tue Oct 20')
    // An earlier week has no day still going.
    expect(before.todayNote).toBeNull()
  })

  it('a new wake moves the current week on: the new day comes in, the oldest goes', () => {
    const next: LogDoc = { ...doc, sleeps: [...doc.sleeps, { id: 's22', sleepStart: iso('2026-10-21T23:00'), wake: iso('2026-10-22T07:00') }] }
    const week = weekOf(next, iso('2026-10-22T09:00'))
    expect(plain(week.days[0].name)).toBe('Fri Oct 16')
    expect(week.days[6]).toMatchObject({ name: 'Thu\u00a0Oct\u00a022', current: true })
  })

  it('a younger log shows the days it has, and says so', () => {
    const young: LogDoc = { ...doc, sleeps: doc.sleeps.slice(-3), meals: doc.meals.slice(-3), workouts: [], weighIns: [] }
    const week = weekOf(young, SAM_NOW)
    expect(names(week)).toEqual(['Mon Oct 19', 'Tue Oct 20', 'Wed Oct 21'])
    expect(plain(week.window)).toBe('The 3 waking days to Wed Oct 21, from the start of your log')
  })

  it('on an earlier day, a short week says the log starts there, never that it is all the log has (the log goes on after it)', () => {
    const before = weekOf(doc, SAM_NOW, iso('2026-10-16T07:00'))
    expect(names(before)).toEqual(['Tue Oct 13', 'Wed Oct 14', 'Thu Oct 15', 'Fri Oct 16'])
    expect(plain(before.window)).toBe('The 4 waking days to Fri Oct 16, from the start of your log')
    expect(before.window).not.toMatch(/so far/)
    // The demo says whose log it is.
    const nav = dayNav(demoDoc, demoDoc.sleeps[demoDoc.sleeps.length - 2].wake, demoStartIso)
    expect(plain(buildWeekView(demoDoc, nav, demoStartIso, true).window)).toBe('The 6 waking days to Tue Oct 20, from the start of Sam’s log')
    expect(plain(buildWeekView({ ...demoDoc, sleeps: demoDoc.sleeps.slice(0, 1) }, dayNav({ ...demoDoc, sleeps: demoDoc.sleeps.slice(0, 1) }, demoDoc.sleeps[0].wake, demoStartIso), demoStartIso, true).window)).toBe(
      'The 1 waking day to Thu Oct 15, from the start of Sam’s log',
    )
  })

  it('the weight breakdown’s trend runs up to now on today, and to the end of the last day on an earlier week', () => {
    expect(rowOf(weekOf(doc, SAM_NOW), 'weight').breakdown.intro).toMatch(/the one on the dashboard, worked out up to now\.$/)
    expect(rowOf(weekOf(doc, SAM_NOW, iso('2026-10-20T07:00')), 'weight').breakdown.intro).toMatch(/the one on the dashboard, up to the end of the last day here\.$/)
  })

  it('the window ends at the viewed day and holds at most seven days', () => {
    const nav = dayNav(doc, iso('2026-10-21T07:00'), SAM_NOW)
    expect(weekWindow(nav)).toHaveLength(7)
    expect(weekWindow({ ...nav, index: 2 })).toEqual(nav.days.slice(0, 3))
  })
})

describe('wake times of 23:50 and 00:10 average to 00:00, not 12:00', () => {
  it('in the week view’s Woke up row', () => {
    const doc: LogDoc = {
      kind: 'mine',
      profile: { name: '', kind: 'guest' },
      meals: [],
      sleeps: [
        { id: 'a', sleepStart: iso('2026-10-20T16:00'), wake: iso('2026-10-20T23:50') },
        { id: 'b', sleepStart: iso('2026-10-21T16:20'), wake: iso('2026-10-22T00:10') },
      ],
      workouts: [],
      plates: [],
    }
    const week = weekOf(doc, iso('2026-10-22T09:00'))
    expect(rowOf(week, 'wakeTime')).toMatchObject({ value: '12:00 AM', count: '2 of 2 nights' })
  })
})

describe('an empty log: every always-on row says "Not available yet" in words, never 0', () => {
  it('the rows are status sentences, not numbers', () => {
    const doc: LogDoc = { kind: 'mine', profile: { name: '', kind: 'guest' }, meals: [], sleeps: [], workouts: [], plates: [] }
    const week = weekOf(doc, SAM_NOW, null)
    // No wake time in the log at all: there is no "first wake time" to name yet.
    expect(plain(week.window)).toBe('Your log so far: no wake time yet')
    for (const r of week.rows) {
      expect(r.ok, r.id).toBe(false)
      expect(r.value, r.id).toBe('Not available yet')
    }
    expect(rowOf(week, 'eaten').count).toBe('no day logged yet')
    // No night at all yet: said in words, never "0 of 1 night".
    expect(rowOf(week, 'sleepLength').count).toBe('no night logged yet')
    expect(rowOf(week, 'wakeTime').count).toBe('no night logged yet')
    // One line stands in for the empty rows, and the calorie breakdown draws no empty chart.
    expect(week.empty).toBe(true)
    expect(week.todayNote).toBeNull()
    expect(rowOf(week, 'eaten').breakdown.chart).toBeUndefined()
  })

  it('a week with numbers is not empty, and its calorie breakdown has its chart', () => {
    const week = weekOf(samWeek(), SAM_NOW)
    expect(week.empty).toBe(false)
    expect(rowOf(week, 'eaten').breakdown.chart).toBeDefined()
  })

  it('a log with weigh-ins, but none in these days, says so in words with no count', () => {
    const doc = samWeek()
    const week = weekOf({ ...doc, weighIns: [{ id: 'old', at: iso('2026-10-01T07:00'), kg: 73 }] }, SAM_NOW)
    // A word joiner after the hyphen keeps "weigh-ins" whole without a special hyphen glyph.
    expect(rowOf(week, 'weight')).toMatchObject({ value: 'No weigh-\u2060ins in these days', ok: false, count: '' })
  })
})

describe('today, still going, is named apart in each count that includes it (never called a complete day)', () => {
  /** Sam's own log: seven waking days from Thu Oct 15, 2,000 kcal on each earlier day, and a 400 kcal breakfast today. */
  function morning(todayKcal: number | null = 400): LogDoc {
    const sleeps: SleepRecord[] = []
    const meals: Meal[] = []
    for (let d = 15; d <= 21; d++) {
      const day = String(d).padStart(2, '0')
      sleeps.push({ id: `s${d}`, sleepStart: iso(`2026-10-${String(d - 1).padStart(2, '0')}T23:00`), wake: iso(`2026-10-${day}T07:00`) })
      meals.push(m(`2026-10-${day}T08:00`, 'label', d === 21 ? todayKcal : 2000))
    }
    return { kind: 'mine', profile: { name: '', kind: 'guest' }, meals, sleeps, workouts: [], plates: [] }
  }

  it('six earlier days at 2,000 kcal and today’s 400 kcal breakfast: "average of 6 complete days and today so far"', () => {
    const week = weekOf(morning(), iso('2026-10-21T09:00'))
    const r = rowOf(week, 'eaten')
    // (6 × 2,000 + 400) / 7 = 1,771: the value counts today as logged so far, and the count says so.
    expect(r.value).toBe('1,771 kcal')
    expect(r.count).toBe('average of 6 complete days and today so far')
    expect(r.count).not.toMatch(/7 complete/)
    for (const id of ['score', 'protein', 'carbs', 'fat'] as const) expect(rowOf(week, id).count, id).toBe('average of 6 complete days and today so far')
    // The spoken name carries the same count.
    expect(r.label).toContain('average of 6 complete days and today so far.')
  })

  it('on an earlier day the same days are all complete: no "today" in the count', () => {
    const doc = morning()
    const week = weekOf(doc, iso('2026-10-21T09:00'), iso('2026-10-20T07:00'))
    expect(rowOf(week, 'eaten').count).toBe('average of 6 complete days')
    expect(week.todayNote).toBeNull()
  })

  it('today with an unknown meal is left out like any day, so the count names no "today so far"', () => {
    const week = weekOf(morning(null), iso('2026-10-21T09:00'))
    expect(rowOf(week, 'eaten')).toMatchObject({ value: '2,000 kcal', count: 'average of 6 complete days (1 incomplete left out)' })
  })

  it('a log whose only day is today: "today so far only"', () => {
    const doc = morning()
    const one: LogDoc = { ...doc, sleeps: doc.sleeps.slice(-1), meals: doc.meals.slice(-1) }
    const week = weekOf(one, iso('2026-10-21T09:00'))
    expect(rowOf(week, 'eaten')).toMatchObject({ value: '400 kcal', count: 'today so far only' })
    expect(rowOf(week, 'score').count).toBe('today so far only')
  })

  it('the words, one by one', () => {
    expect(copy.week.completeDays(5, 1)).toBe('average of 5 complete days (1 incomplete left out)')
    expect(copy.week.completeDays(5, 1, true)).toBe('average of 5 complete days and today so far (1 incomplete left out)')
    expect(copy.week.completeDays(1, 0, true)).toBe('average of 1 complete day and today so far')
    expect(copy.week.completeDays(0, 2, true)).toBe('today so far only (2 incomplete left out)')
    expect(copy.week.scoreDays(2, 1, 0, 'burned', true)).toBe('average of 2 days with workouts and today so far (1 incomplete left out)')
    expect(copy.week.scoreDays(0, 0, 0, 'eaten', true)).toBe('today so far only')
  })

  it('workouts today count with the day: burned’s score names today apart too', () => {
    const doc = samWeek()
    const withToday: LogDoc = { ...doc, workouts: [...doc.workouts, wo('2026-10-21T18:00', 200, 30)] }
    const week = weekOf(withToday, SAM_NOW)
    expect(rowOf(week, 'burnedScore').count).toBe('average of 2 days with workouts and today so far (1 incomplete left out)')
    // Night rows are about the night before today, which is over: "6 of 7 nights", no "so far".
    expect(rowOf(week, 'sleepLength').count).toBe('6 of 7 nights')
  })
})

describe('the fix-round details (fictional Sam)', () => {
  it('a breakdown’s spoken row name includes its ranges and the PRD’s note, as shown', () => {
    const r = rowOf(weekOf(samWeek(), SAM_NOW), 'eaten')
    expect(r.label).toMatch(/^Calories eaten: 1,300 kcal, average of 4 complete days and today so far \(1 incomplete left out\)\. likely [\d,]+–[\d,]+ kcal\. very likely [\d,]+–[\d,]+ kcal\. Weekly totals are steadier than single meals, but photo estimates tend to run low on big plates\. Opens each day\.$/)
    const weight = rowOf(weekOf(samWeek(), SAM_NOW), 'weight')
    expect(weight.label).toContain('Trend: 2 more weigh-ins needed.')
  })

  it('a day with a meal and a workout both unknown names both; a deficit day left out names the kind that was unknown', () => {
    const doc = samWeek()
    const both: LogDoc = { ...doc, workouts: [...doc.workouts, wo('2026-10-16T18:00', null, 20)] }
    const r = rowOf(weekOf(both, SAM_NOW), 'balance')
    expect(r.breakdown.days[1].status).toBe('Left out: a meal and a workout with unknown calories')
    expect(r.breakdown.days[5].status).toBe('Left out: a workout with unknown calories')
  })

  it('a night whose sleep time equals its wake time is left out for that reason, never "not logged"', () => {
    const doc = samWeek()
    const zero: LogDoc = { ...doc, sleeps: doc.sleeps.map((s) => (s.id === 's16' ? { ...s, sleepStart: s.wake } : s)) }
    const week = weekOf(zero, SAM_NOW)
    for (const id of ['sleepLength', 'bedtime', 'wakeTime'] as const) {
      const fri = rowOf(week, id).breakdown.days[1]
      expect(fri, id).toMatchObject({ state: 'leftOut', status: 'Left out: the sleep time is the same as the wake time' })
    }
    expect(rowOf(week, 'sleepLength').breakdown.days[1].value).toBe('unknown')
    expect(rowOf(week, 'sleepLength').count).toBe('5 of 7 nights')
    // A night with no sleep time at all still says so.
    expect(rowOf(week, 'wakeTime').breakdown.days[2].status).toBe('Left out: the sleep time was not logged')
  })

  it('the chart names bars by weekday, adding the date when a weekday repeats or a date is skipped', () => {
    const chart = rowOf(weekOf(samWeek(), SAM_NOW), 'eaten').breakdown.chart
    expect(chart?.bars.map((b) => [b.name, b.date])).toEqual([
      ['Thu', null], ['Fri', null], ['Sat', null], ['Sun', null], ['Mon', null], ['Tue', null], ['Wed', null],
    ])
    // A missed wake merges Tue into Mon: the days run Wed 14 .. Mon 19, Wed 21, so Wed comes twice.
    const doc = samWeek()
    const merged: LogDoc = { ...doc, sleeps: doc.sleeps.filter((s) => s.id !== 's20') }
    const bars = rowOf(weekOf(merged, SAM_NOW), 'eaten').breakdown.chart?.bars ?? []
    expect(bars.map((b) => `${b.name} ${b.date}`)).toEqual(['Wed 14', 'Thu 15', 'Fri 16', 'Sat 17', 'Sun 18', 'Mon 19', 'Wed 21'])
    expect(chartNeedsDates([iso('2026-10-19T07:00'), iso('2026-10-21T07:00')])).toBe(true)
    expect(chartNeedsDates([iso('2026-10-20T07:00'), iso('2026-10-21T07:00')])).toBe(false)
    expect(chartNeedsDates([null, iso('2026-10-21T07:00')])).toBe(false)
  })

  it('a day whose meals all have unknown calories is an incomplete bar of 0 known (the chart draws none for it)', () => {
    const doc = samWeek()
    const unknownDay: LogDoc = { ...doc, meals: [...doc.meals.filter((x) => !x.eatenAt.startsWith('2026-10-18')), m('2026-10-18T09:00', 'menu', null)] }
    const r = rowOf(weekOf(unknownDay, SAM_NOW), 'eaten')
    expect(r.breakdown.chart?.bars[3]).toMatchObject({ kind: 'incomplete', value: 0 })
    expect(r.breakdown.days[3]).toMatchObject({ value: 'unknown', ok: false, state: 'leftOut' })
    expect(copy.week.chartLegend).toContain('No bar: not logged, or no known calories.')
  })

  it('the provisional day keeps "the day before your first wake time" once a wake exists', () => {
    const doc = samWeek()
    const early: LogDoc = { ...doc, meals: [m('2026-10-12T20:00', 'label', 500), ...doc.meals] }
    const week = weekOf(early, SAM_NOW, null)
    expect(plain(week.window)).toBe('The day before your first wake time')
  })

  it('the More hint and the Week button’s spoken name say "up to 7" (a younger log has fewer days)', () => {
    expect(copy.moreMenu.weekHint).toContain('up to 7 waking days')
    expect(copy.week.openLabel).toContain('up to 7 waking days')
    expect(copy.week.empty).toMatch(/^Nothing is logged here yet\./)
  })
})
