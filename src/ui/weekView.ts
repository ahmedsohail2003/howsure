// The week view (build-out item 2.7; checklist slice 8; prd.md > Week View; spec.md > Maths Core:
// Week Summary), worked out once for every look. The rows come from the stat registry
// (src/kernel/statRegistry.ts), each through its week row in weekStats.ts, so every stat the app
// shows has a week average. Journal, Panel and Night draw these same rows; none works anything out.
//
// - The window: the waking days ending at the day on screen, up to seven (fewer only when the log
//   starts later than that, which the window's words say on any day), oldest first. It rolls
//   forward as days pass: the current day follows now, and moving to another day moves the week.
// - The current day counts with what is logged so far, and says so: in a note at the top, and in
//   each count that includes it ("average of 5 complete days and today so far").
// - Every row says how many days its average counts, and opens a breakdown of each day: its value,
//   and whether it was counted, left out (and why), or not logged.
// Pure: no React.

import { nightBefore, WEEK_DAYS } from '../kernel/week'
import { STAT_IDS, STATS, STAT_GROUPS, type StatGroup, type StatId } from '../kernel/statRegistry'
import { weighInsForDay } from '../kernel/weight'
import type { Night, Range, WeighIn } from '../kernel/types'
import type { LogDoc } from '../store/log'
import { balanceView, type BalanceView } from './balanceView'
import { copy } from './copy'
import { buildDayViewFor, type DayView } from './dayView'
import type { DayNav } from './days'
import { fmtWeekdayDate } from './format'
import { buildWeightView, weightUnitOf, type WeightView } from './weightView'
import { WEEK_ROWS } from './weekStats'
import type { WeightUnit } from '../kernel/types'

/** One waking day of the week, with everything the rows read from it, worked out once. */
export interface WeekDay {
  /** The wake that started it; null for the provisional day (before the first wake). */
  dayStart: string | null
  /** "Thu Oct 15", or "Before the first wake time". */
  name: string
  /** True for the current day, still going: it counts with what is logged so far. */
  current: boolean
  view: DayView
  balance: BalanceView
  weighIns: WeighIn[]
  /** The night before it (null: no night, as before the first wake). */
  night: Night | null
}

/** What every week row reads. */
export interface WeekContext {
  doc: LogDoc
  days: WeekDay[]
  nowIso: string
  unit: WeightUnit
  /** The weight as of the last day here: its trend is the dashboard's for that day. */
  weight: WeightView
}

/** Whether a day counts toward an average, is left out (with why), is not logged, or has nothing to count. */
export type DayState = 'counted' | 'leftOut' | 'notLogged' | 'none'

export interface BreakdownDay {
  dayStart: string | null
  /** "Thu Oct 15", with "(today, so far)" on the current day. */
  day: string
  /** The day's value ("1,480 kcal"), or a word ("not logged"). */
  value: string
  /** True when value is a number, drawn in the number style; false for a word or a sentence. */
  ok: boolean
  /** A second line: the day's ranges, a count, the night's times. */
  detail?: string
  state: DayState
  /** "Counted", "Left out: a meal with unknown calories", "Not logged". */
  status: string
  /** The row's spoken name: the day, its value and status, and that it opens the day. */
  label: string
}

/** The calorie breakdown's bars: heights as fractions of the chart's top (0 at the bottom). */
export interface WeekChartBar {
  /** "Wed", or "Before" for the provisional day. */
  name: string
  /** The day of the month ("28") when weekdays alone would be ambiguous (chartNeedsDates); else null. */
  date: string | null
  kind: 'logged' | 'incomplete' | 'notLogged'
  value: number
  likely: Range | null
  veryLikely: Range | null
}

export interface WeekChart {
  bars: WeekChartBar[]
  /** The bars' scale: the top of the chart. */
  top: number
  /** The week average, drawn as a dashed line; null when there is none. */
  average: number | null
}

export interface Breakdown {
  title: string
  intro: string
  days: BreakdownDay[]
  /** Extra lines after the days: how the average's ranges are worked out, the PRD's note. */
  notes?: string[]
  chart?: WeekChart
}

export interface WeekStatRow {
  id: StatId
  group: StatGroup
  title: string
  /** The average ("1,520 kcal"), or a status sentence ("Not available yet"). */
  value: string
  /** True when value is a number; false draws it in normal weight, never as a figure. */
  ok: boolean
  /** "average of 5 complete days (1 incomplete left out)", "6 of 7 nights". */
  count: string
  /** Further lines: the likely and very likely ranges, the trend, the PRD's note on photos. */
  lines: string[]
  label: string
  breakdown: Breakdown
}

export interface WeekGroup {
  id: StatGroup
  title: string
  rows: WeekStatRow[]
}

export interface WeekView {
  /** "The 7 waking days to Wed Oct 21"; fewer days only "from the start of your log". */
  window: string
  /** Set when the current day is in the week: it counts so far. */
  todayNote: string | null
  /** No row has a number (nothing logged in these days): the view shows one line instead of the rows. */
  empty: boolean
  days: WeekDay[]
  rows: WeekStatRow[]
  groups: WeekGroup[]
}

/** The waking days of the week ending at the viewed day: up to seven, oldest first. */
export function weekWindow(nav: DayNav): (string | null)[] {
  return nav.days.slice(Math.max(0, nav.index - (WEEK_DAYS - 1)), nav.index + 1)
}

/** A day's name in the week: its weekday and date, or the provisional day's words. */
export function weekDayName(dayStart: string | null): string {
  return dayStart === null ? copy.week.provisional : keepDate(fmtWeekdayDate(dayStart))
}

/** "Wed Oct 21" with no-break spaces, so a date never splits over two lines. */
function keepDate(date: string): string {
  return date.replace(/ /g, '\u00a0')
}

export function buildWeekView(doc: LogDoc, nav: DayNav, nowIso: string, demo = false): WeekView {
  const starts = weekWindow(nav)
  const now = Date.parse(nowIso)
  const days: WeekDay[] = starts.map((dayStart) => {
    const view = buildDayViewFor(doc, dayStart)
    return {
      dayStart,
      name: weekDayName(dayStart),
      current: dayStart === nav.current,
      view,
      balance: balanceView(doc, view, nowIso, demo),
      // A weigh-in timed later than now (an import can bring one) waits until its time, as on the dashboard.
      weighIns: weighInsForDay(doc.weighIns ?? [], doc.sleeps, dayStart).filter((w) => Date.parse(w.at) <= now),
      night: nightBefore(doc.sleeps, dayStart),
    }
  })
  const last = starts[starts.length - 1] ?? null
  const ctx: WeekContext = {
    doc,
    days,
    nowIso,
    unit: weightUnitOf(doc),
    weight: buildWeightView(doc, last, nowIso),
  }
  const whose = copy.week.whose(demo)
  const rows = STAT_IDS.map((id) => WEEK_ROWS[id](ctx)).filter((r): r is WeekStatRow => r !== null)
  const groups = STAT_GROUPS.map((g) => ({ id: g, title: copy.week.groups[g], rows: rows.filter((r) => STATS[r.id].group === g) })).filter(
    (g) => g.rows.length > 0,
  )
  return {
    window:
      last === null
        ? copy.week.windowProvisional(whose, doc.sleeps.some((s) => s.wake !== null))
        : copy.week.window(days.length, keepDate(fmtWeekdayDate(last)), whose),
    // An empty week shows one line, with no note on how today counts.
    todayNote: days.some((d) => d.current) && rows.some((r) => r.ok) ? copy.week.todayNote : null,
    empty: rows.every((r) => !r.ok),
    days,
    rows,
    groups,
  }
}
