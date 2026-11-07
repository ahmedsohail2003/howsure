// The timeline of several waking days (build-out item 2.8; checklist slice 18; prd.md > 3-Day
// Timeline), worked out once for every look. Journal, Panel and Night draw this same view; none
// works anything out.
//
// - The window: the 3 waking days ending at the day the timeline was opened on (or 4, the option
//   that adds the day before), oldest first; fewer only at the start of a log, which its words say.
// - Each day lists, in time order: the wake (with the night before it), its meals, workouts (gym
//   sessions included) and weigh-ins, the expected-sleep marker, and how the day ended: now (the
//   current day), the sleep still going on, or the night that closed it.
// - Expected sleep is the spec's rule (kernel/sleepday.ts expectedSleepMs): the day's wake plus the
//   usual day length, preset to 16 h and changed by the person (profile.usualDayHours). It is
//   labelled as their setting, not advice, and nothing here guesses it from their sleep times.
// - Each day with a wake is also drawn hour by hour on one shared scale, with every row starting
//   at its wake, so the days line up and the expected-sleep markers of one setting sit in one
//   column: midnight lines (named by the new date's weekday), hour ticks, the sleep block with its
//   length, now, and a mark for each entry. Positions are fractions of the scale (0 = the wake).
//   The day before the first wake time has no wake to measure from, so it is listed, not drawn.
//
// The per-day list starts from the Night look's point builder (nightTimeline.ts timelinePoints),
// the seam item 1.5.2c left for this view, run once per day. Pure: no React.

import { toLocalIso } from '../clock'
import { DEFAULT_USUAL_DAY_HOURS, expectedSleepMs, isUsualDayHours, nightOf, usualDayHours, wakingDayStart } from '../kernel/sleepday'
import type { Meal, SleepRecord, WeighIn, Workout } from '../kernel/types'
import { weighInsForDay } from '../kernel/weight'
import type { LogDoc } from '../store/log'
import { copy } from './copy'
import { buildDayViewFor, type DayView } from './dayView'
import { dayNav, type DayNav } from './days'
import { fmtTime, fmtWeekdayDate, onLaterDate } from './format'
import { timelinePoints } from './nightTimeline'
import { buildSleepView, fmtDuration } from './sleepView'
import { weekDayName } from './weekView'

/** How many waking days the timeline shows: 3, or 4 with the day before (prd.md > 3-Day Timeline). */
export type TimelineSpan = 3 | 4
export const TIMELINE_SPANS: readonly TimelineSpan[] = [3, 4]
export const DEFAULT_SPAN: TimelineSpan = 3

const HOUR = 3_600_000
/** The shortest scale: a whole day, so a short day is never stretched across the width. */
const MIN_SCALE_HOURS = 24

/**
 * One line of a day's list, in time order. `x` is its place on the drawing (null: not drawn; a
 * weigh-in with no recorded time is never drawn), and `lane` its height there: 0 on the track, or
 * -1 (above) and 1 (below) for a mark that would cover the mark just before it.
 */
export type TimelineEntry = { key: string; x: number | null; lane: MarkLane; laterDate: boolean } & (
  | { kind: 'wake'; at: string; sleptMinutes: number | null; recordId: string | null }
  /** The day before the first wake time: no wake is recorded before it. */
  | { kind: 'noWake' }
  /** No meals logged on this day. */
  | { kind: 'empty' }
  | { kind: 'meal'; at: string; meal: Meal }
  /** A workout at its start time; a gym session is a workout with sets. */
  | { kind: 'workout'; at: string; workout: Workout }
  | { kind: 'weighIn'; at: string; weighIn: WeighIn }
  /** The expected-sleep marker: the wake plus the usual day length. */
  | { kind: 'expected'; at: string }
  /** The current day, awake. */
  | { kind: 'now'; at: string }
  /** The current day, closed by a sleep with no wake yet. */
  | { kind: 'asleep'; at: string; recordId: string; minutesSoFar: number }
  /** An earlier day, closed by a night that has its wake; `at` null: its sleep start was not logged. */
  | { kind: 'sleep'; at: string | null; recordId: string; wake: string; minutes: number | null }
)

export type TimelineEntryKind = TimelineEntry['kind']

/** A mark's height on the drawing: on the track (0), just above it (-1) or just below it (1). */
export type MarkLane = -1 | 0 | 1

/** An axis label under a day's drawing: a clock hour ("6 PM"), or a midnight named by its new date's weekday ("Thu"). */
export interface AxisLabel {
  x: number
  text: string
  midnight: boolean
  /** Which end of the text sits on its hour, so a label at either edge stays inside the drawing. */
  align: 'start' | 'middle' | 'end'
}

/** A day drawn to scale. Every x is a fraction of the shared scale, measured from the day's wake. */
export interface DayDrawing {
  /** Where the drawing of this day stops: its closing wake or now, the expected sleep, or its last entry. */
  end: number
  /** Where the day's own recorded time stops: the closing wake (an earlier day) or now (the current day). */
  logged: number
  /**
   * The rest of the current day while awake: from now up to the expected sleep (never past it),
   * drawn dotted. Null on a day that has ended (its closing wake or sleep marks the end; an
   * expected-sleep marker after it stands alone), and while asleep.
   */
  ahead: { from: number; to: number } | null
  /** The night that closed the day (or the sleep still going on), with its length when both ends are known. */
  sleep: { from: number; to: number; minutes: number | null; ongoing: boolean } | null
  /**
   * A closing night whose sleep start was not logged: asleep at some unknown point between `from`
   * (the last thing logged awake: the wake, or the end of the last entry) and `to` (the closing
   * wake). Drawn as its own stretch, never as time awake and never as no sleep.
   */
  unlogged: { from: number; to: number } | null
  /** The wake that ended an earlier day; null for the current day. */
  closingWake: number | null
  /**
   * The words over the sleep (its length, the length so far, or "sleep start not logged"), written
   * above the strip so they always show: anchored at the stretch's end when it ends past the middle
   * of the scale, otherwise at its start, so they stay inside the drawing.
   */
  note: { x: number; align: 'start' | 'end' } | null
  /** One tick per clock hour (every 3 or 6 hours on a long scale). */
  ticks: number[]
  midnights: number[]
  labels: AxisLabel[]
  expected: number
  /** Now, on the current day. */
  now: number | null
}

export interface TimelineDay {
  /** The wake that started it; null for the day before the first wake time. */
  dayStart: string | null
  /** A stable key for the day ("provisional" for the day before the first wake time). */
  key: string
  /** "Wed Oct 21", or "Before the first wake time". */
  name: string
  /** True for the current waking day, still going. */
  current: boolean
  view: DayView
  entries: TimelineEntry[]
  /** Null for the day before the first wake time: there is no wake to draw it from. */
  drawing: DayDrawing | null
}

export interface TimelineView {
  span: TimelineSpan
  /** "The 3 waking days to Wed Oct 21"; fewer only "from the start of your log". */
  window: string
  /** A shorter `window` for the narrowest phones, when the full one is long; null when `window` is short already. */
  windowShort: string | null
  /** The usual day length in use, in hours. */
  usualHours: number
  /** False while the 16 h preset is in use (nothing saved yet). */
  usualSaved: boolean
  /** The shared scale of the drawings, in whole hours (at least 24). */
  scaleHours: number
  /** False while the log has no wake time at all: the day before the first wake is then the only day. */
  anyWake: boolean
  days: TimelineDay[]
  /** The legend's keys: only the kinds of mark the drawing holds, in a fixed order (empty when nothing is drawn). */
  legend: LegendKind[]
}

/** A kind of mark on the drawing, as its legend names it. */
export type LegendKind =
  | 'wake'
  | 'expected'
  | 'sleep'
  | 'unlogged'
  | 'ahead'
  | 'midnight'
  | 'meal'
  | 'mealUnknown'
  | 'workout'
  | 'workoutUnknown'
  | 'weighIn'
  | 'now'

const LEGEND_ORDER: readonly LegendKind[] = [
  'wake',
  'expected',
  'sleep',
  'unlogged',
  'ahead',
  'midnight',
  'meal',
  'mealUnknown',
  'workout',
  'workoutUnknown',
  'weighIn',
  'now',
]

/** The kind of mark an entry is drawn as, or null when it has no mark of its own on the strip. */
export function markKind(e: TimelineEntry): LegendKind | null {
  if (e.x === null) return null
  if (e.kind === 'meal') return e.meal.kcal === null ? 'mealUnknown' : 'meal'
  if (e.kind === 'workout') return e.workout.kcal === null ? 'workoutUnknown' : 'workout'
  if (e.kind === 'weighIn') return 'weighIn'
  return null
}

/** The kinds of mark the drawn days hold, in the legend's order. */
function legendKinds(days: TimelineDay[]): LegendKind[] {
  const present = new Set<LegendKind>()
  for (const d of days) {
    const g = d.drawing
    if (!g) continue
    present.add('wake').add('expected')
    if (g.sleep) present.add('sleep')
    if (g.unlogged) present.add('unlogged')
    if (g.ahead) present.add('ahead')
    if (g.midnights.length > 0) present.add('midnight')
    if (g.now !== null) present.add('now')
    for (const e of d.entries) {
      const k = markKind(e)
      if (k) present.add(k)
    }
  }
  return LEGEND_ORDER.filter((k) => present.has(k))
}

/**
 * The day list the timeline ends in, at its anchor day: null follows the current day. An anchor day
 * that is no longer in the log (its wake removed) gives way to the waking day that now holds that
 * moment, so the timeline stays where it was rather than jumping to today; the day before the first
 * wake time, once it has gone, gives way to the first waking day.
 */
export function timelineNav(doc: LogDoc, anchor: { dayStart: string | null } | null, nowIso: string): DayNav {
  if (anchor === null) return dayNav(doc, wakingDayStart(doc.sleeps, nowIso), nowIso)
  const nav = dayNav(doc, anchor.dayStart, nowIso)
  if (nav.days.includes(anchor.dayStart)) return nav
  const held = anchor.dayStart === null ? nav.days[0] : wakingDayStart(doc.sleeps, anchor.dayStart)
  return dayNav(doc, held ?? null, nowIso)
}

/** The waking days the timeline shows: up to `span`, ending at the anchor day, oldest first. */
export function timelineWindow(nav: DayNav, span: TimelineSpan): (string | null)[] {
  return nav.days.slice(Math.max(0, nav.index - (span - 1)), nav.index + 1)
}

/** Marks closer than this (a fraction of the scale) move to a lane above or below, so neither hides the other. */
const MARK_GAP = 0.025

/** Ties at one minute keep this order: the wake, then entries, then the marker, then how the day ends. */
const ORDER: Record<TimelineEntryKind, number> = {
  noWake: 0,
  wake: 0,
  empty: 1,
  meal: 2,
  workout: 3,
  weighIn: 4,
  expected: 5,
  now: 6,
  asleep: 6,
  sleep: 6,
}

function entryMs(e: TimelineEntry): number | null {
  return 'at' in e && e.at !== null ? Date.parse(e.at) : null
}

/** A day's entries before they are placed: everything but `x`. */
type Unplaced = TimelineEntry extends infer E ? (E extends TimelineEntry ? Omit<E, 'x' | 'lane'> : never) : never

/** "40 min" under an hour, "2 h" on the hour, else "8 h 10 min": a sleep's length, or its length so far. */
export function fmtSleepLength(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return copy.timeline.minutes(String(m))
  return m % 60 === 0 ? copy.timeline.hours(String(m / 60)) : fmtDuration(m)
}

/** One day's entries, in time order, from the Night look's point builder plus the weigh-ins and the expected-sleep marker. */
function dayEntries(doc: LogDoc, view: DayView, nowIso: string, hours: number): Unplaced[] {
  const dayStart = view.dayStart
  const sleep = buildSleepView(doc.sleeps, dayStart)
  const later = (iso: string) => onLaterDate(iso, dayStart)
  const out: Unplaced[] = []
  for (const p of timelinePoints(view, sleep, nowIso)) {
    switch (p.kind) {
      case 'wake':
        out.push({ key: `wake-${p.recordId ?? p.at}`, kind: 'wake', at: p.at, sleptMinutes: p.sleptMinutes, recordId: p.recordId, laterDate: false })
        break
      case 'noWake':
        out.push({ key: 'no-wake', kind: 'noWake', laterDate: false })
        break
      case 'empty':
        out.push({ key: `empty-${dayStart ?? 'provisional'}`, kind: 'empty', laterDate: false })
        break
      case 'meal':
        out.push({ key: `meal-${p.meal.id}`, kind: 'meal', at: p.meal.eatenAt, meal: p.meal, laterDate: p.laterDate })
        break
      case 'workout':
        out.push({ key: `workout-${p.workout.id}`, kind: 'workout', at: p.workout.startedAt, workout: p.workout, laterDate: p.laterDate })
        break
      case 'now':
        out.push({ key: 'now', kind: 'now', at: p.at, laterDate: later(p.at) })
        break
      case 'asleep':
        out.push({
          key: `asleep-${p.recordId}`,
          kind: 'asleep',
          at: p.since,
          recordId: p.recordId,
          minutesSoFar: Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(p.since)) / 60_000)),
          laterDate: p.laterDate,
        })
        break
      case 'sleep': {
        const record = doc.sleeps.find((r) => r.id === p.recordId) as SleepRecord
        out.push({
          key: `sleep-${p.recordId}`,
          kind: 'sleep',
          at: p.at,
          recordId: p.recordId,
          wake: record.wake as string,
          minutes: nightOf(record).minutes,
          laterDate: p.laterDate,
        })
        break
      }
    }
  }
  // A weigh-in timed later than now (an import can bring one) waits until its time, as on the dashboard.
  const now = Date.parse(nowIso)
  for (const w of weighInsForDay(doc.weighIns ?? [], doc.sleeps, dayStart)) {
    if (Date.parse(w.at) <= now) out.push({ key: `weighIn-${w.id}`, kind: 'weighIn', at: w.at, weighIn: w, laterDate: later(w.at) })
  }
  if (dayStart !== null) {
    const at = toLocalIso(expectedSleepMs(dayStart, hours))
    out.push({ key: `expected-${dayStart}`, kind: 'expected', at, laterDate: later(at) })
  }
  // Entries with no time keep their place: the wake (or no wake) first, then "no meals", and a
  // night whose sleep start was not logged last. Everything timed goes in time order between.
  const rank = (e: Unplaced) => {
    if (e.kind === 'wake' || e.kind === 'noWake') return 0
    if (e.kind === 'empty') return 1
    if (e.kind === 'sleep' && e.at === null) return 3
    return 2
  }
  return out
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const r = rank(a.e) - rank(b.e)
      if (r !== 0) return r
      const ta = entryMs(a.e as TimelineEntry) ?? 0
      const tb = entryMs(b.e as TimelineEntry) ?? 0
      return ta - tb || ORDER[a.e.kind] - ORDER[b.e.kind] || a.i - b.i
    })
    .map(({ e }) => e)
}

/** Where a day's own recorded time stops: the closing wake, or now. */
function loggedEnd(entries: Unplaced[], nowIso: string): number {
  const closed = entries.find((e) => e.kind === 'sleep')
  return closed && closed.kind === 'sleep' ? Date.parse(closed.wake) : Date.parse(nowIso)
}

/** The hours a day's drawing spans from its wake: to its logged end, its expected sleep, or its last entry. */
function spanHours(dayStart: string, entries: Unplaced[], nowIso: string): number {
  const times = entries.map((e) => entryMs(e as TimelineEntry)).filter((t): t is number => t !== null)
  return (Math.max(loggedEnd(entries, nowIso), ...times) - Date.parse(dayStart)) / HOUR
}

/** "6 PM", "12 PM" for noon, "12 AM" never: a midnight is named by its weekday. */
function hourText(d: Date): string {
  const h = d.getHours()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return copy.timeline.hour(String(h12), h < 12 ? copy.am : copy.pm)
}

/** Hour ticks, midnights and axis labels from the wake to `endMs`, on a scale of `scaleHours`. */
function axis(wakeMs: number, endMs: number, scaleHours: number): Pick<DayDrawing, 'ticks' | 'midnights' | 'labels'> {
  const scale = scaleHours * HOUR
  const tickEvery = scaleHours <= 36 ? 1 : scaleHours <= 72 ? 3 : 6
  const labelEvery = scaleHours <= 36 ? 6 : scaleHours <= 72 ? 12 : 24
  const ticks: number[] = []
  const midnights: number[] = []
  const labels: AxisLabel[] = []
  // The first whole clock hour after the wake, then each hour after it (local time).
  const first = new Date(wakeMs)
  first.setMinutes(0, 0, 0)
  if (first.getTime() <= wakeMs) first.setHours(first.getHours() + 1)
  for (let t = first.getTime(); t <= endMs; ) {
    const d = new Date(t)
    const x = (t - wakeMs) / scale
    const h = d.getHours()
    if (h === 0) midnights.push(x)
    if (h % tickEvery === 0) ticks.push(x)
    if (h % labelEvery === 0) {
      labels.push({
        x,
        text: h === 0 ? copy.weekdays[d.getDay()] : hourText(d),
        midnight: h === 0,
        align: x < 0.05 ? 'start' : x > 0.95 ? 'end' : 'middle',
      })
    }
    // The next whole local hour (a clock change moves it, so it is worked out again each time).
    const next = new Date(t)
    next.setHours(next.getHours() + 1)
    t = next.getTime() > t ? next.getTime() : t + HOUR
  }
  return { ticks, midnights, labels }
}

/** The last moment an entry shows the person awake: a meal's time, a workout's end (its start when its length is unknown), a weigh-in's time when it was recorded. */
function awakeUntilMs(e: Unplaced): number | null {
  switch (e.kind) {
    case 'meal':
      return Date.parse(e.at)
    case 'workout':
      return Date.parse(e.at) + (e.workout.minutes ?? 0) * 60_000
    case 'weighIn':
      return untimed(e) ? null : Date.parse(e.at)
    default:
      return null
  }
}

/** True for a weigh-in whose time was not recorded: it is listed with words, and never drawn at its placeholder time. */
function untimed(e: Unplaced): boolean {
  return e.kind === 'weighIn' && e.weighIn.timeApproximate === true
}

function drawDay(dayStart: string, entries: Unplaced[], nowIso: string, current: boolean, scaleHours: number): DayDrawing {
  const wakeMs = Date.parse(dayStart)
  const scale = scaleHours * HOUR
  const at = (ms: number) => (ms - wakeMs) / scale
  const logged = loggedEnd(entries, nowIso)
  const endMs = wakeMs + spanHours(dayStart, entries, nowIso) * HOUR
  const expected = entries.find((e) => e.kind === 'expected')
  let sleep: DayDrawing['sleep'] = null
  let unlogged: DayDrawing['unlogged'] = null
  let closingWake: number | null = null
  for (const e of entries) {
    if (e.kind === 'sleep') {
      const wake = Date.parse(e.wake)
      closingWake = at(wake)
      if (e.at !== null) {
        sleep = { from: at(Date.parse(e.at)), to: at(wake), minutes: e.minutes, ongoing: false }
      } else {
        // Asleep at some point after the last thing logged awake, and before the closing wake.
        const awake = entries.map(awakeUntilMs).filter((t): t is number => t !== null && t < wake)
        unlogged = { from: at(Math.max(wakeMs, ...awake)), to: at(wake) }
      }
    }
    if (e.kind === 'asleep') sleep = { from: at(Date.parse(e.at)), to: at(Date.parse(nowIso)), minutes: e.minutesSoFar, ongoing: true }
  }
  const stretch = sleep ?? unlogged
  // Only the current day, awake, has time still ahead, from now up to expected sleep (never past
  // it, even when an entry is timed later); a day that has ended never does.
  const expectedMs = expected && expected.kind === 'expected' ? Date.parse(expected.at) : null
  const aheadTo = expectedMs === null ? logged : Math.min(endMs, expectedMs)
  const ahead = current && sleep === null && aheadTo > logged ? { from: at(logged), to: at(aheadTo) } : null
  return {
    end: at(endMs),
    logged: at(logged),
    ahead,
    sleep,
    unlogged,
    closingWake,
    note: stretch ? (stretch.to > 0.5 ? { x: stretch.to, align: 'end' } : { x: stretch.from, align: 'start' }) : null,
    ...axis(wakeMs, endMs, scaleHours),
    expected: expectedMs === null ? 0 : at(expectedMs),
    now: current ? at(Date.parse(nowIso)) : null,
  }
}

/** Each drawn mark's lane: on the track, unless the mark (or the wake bar) just before it is too close; then above, or below. */
function laneMarks(entries: TimelineEntry[]): TimelineEntry[] {
  // The wake bar holds the track at 0, so a mark just after the wake moves off it too.
  const last: Record<MarkLane, number> = { [-1]: -Infinity, 0: 0, 1: -Infinity }
  const drawn = entries
    .filter((e) => e.x !== null && (e.kind === 'meal' || e.kind === 'workout' || e.kind === 'weighIn'))
    .sort((a, b) => (a.x as number) - (b.x as number))
  const lanes = new Map<string, MarkLane>()
  for (const e of drawn) {
    const x = e.x as number
    const lane = ([0, -1, 1] as const).find((l) => x - last[l] >= MARK_GAP) ?? 0
    last[lane] = x
    lanes.set(e.key, lane)
  }
  return entries.map((e) => ({ ...e, lane: lanes.get(e.key) ?? 0 }))
}

/** The timeline of `span` waking days ending at the anchor day of `nav` (the day it was opened on). */
export function buildTimelineView(doc: LogDoc, nav: DayNav, nowIso: string, span: TimelineSpan, demo = false): TimelineView {
  const starts = timelineWindow(nav, span)
  const saved = doc.profile.usualDayHours
  const hours = usualDayHours(saved)
  const built = starts.map((dayStart) => {
    const view = buildDayViewFor(doc, dayStart)
    return { dayStart, view, current: dayStart === nav.current, entries: dayEntries(doc, view, nowIso, hours) }
  })
  const spans = built.flatMap((d) => (d.dayStart === null ? [] : [spanHours(d.dayStart, d.entries, nowIso)]))
  const scaleHours = Math.max(MIN_SCALE_HOURS, Math.ceil(Math.max(0, ...spans)))
  const days: TimelineDay[] = built.map(({ dayStart, view, current, entries }) => {
    const wakeMs = dayStart === null ? 0 : Date.parse(dayStart)
    const placed = laneMarks(
      entries.map((e) => {
        const t = entryMs(e as TimelineEntry)
        const x = dayStart === null || t === null || untimed(e) ? null : (t - wakeMs) / (scaleHours * HOUR)
        return { ...e, x, lane: 0 } as TimelineEntry
      }),
    )
    return {
      dayStart,
      key: dayStart ?? 'provisional',
      name: dayName(dayStart, starts),
      current,
      view,
      entries: placed,
      drawing: dayStart === null ? null : drawDay(dayStart, entries, nowIso, current, scaleHours),
    }
  })
  const last = starts[starts.length - 1] ?? null
  const whose = copy.week.whose(demo)
  // The day before the first wake time can be in the window, but it is not a waking day: the count leaves it out and says so.
  const waking = starts.filter((s) => s !== null).length
  const before = waking < starts.length
  const lastDate = last === null ? '' : fmtWeekdayDate(last).replace(/ /g, ' ')
  return {
    span,
    window:
      last === null
        ? copy.week.windowProvisional(whose, doc.sleeps.some((s) => s.wake !== null))
        : copy.timeline.window(waking, span, lastDate, whose, before),
    windowShort: last !== null && (before || waking < span) ? copy.timeline.windowShort(waking, lastDate, before) : null,
    usualHours: hours,
    usualSaved: isUsualDayHours(saved),
    scaleHours,
    anyWake: doc.sleeps.some((s) => s.wake !== null),
    days,
    legend: legendKinds(days),
  }
}

/**
 * A day's name: "Wed Oct 21", or "Before the first wake time". When two waking days in the window
 * start on the same date (a long daytime sleep logged as a night), each also gives its wake time:
 * "Mon Oct 19, from 2:00 PM".
 */
function dayName(dayStart: string | null, starts: (string | null)[]): string {
  const name = weekDayName(dayStart)
  if (dayStart === null) return name
  const twin = starts.some((s) => s !== null && s !== dayStart && weekDayName(s) === name)
  return twin ? copy.timeline.dayFrom(name, fmtTime(dayStart).replace(/ /g, ' ')) : name
}

/** The usual day length in words: "16 h", "16 h 30 min". */
export function fmtDayLength(hours: number): string {
  const total = Math.round(hours * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? copy.timeline.hours(String(h)) : copy.timeline.hoursMinutes(String(h), String(m))
}

/** The usual day lengths the setting offers: every half hour within the bounds, and a saved value that is not on that list. */
export function usualDayChoices(current: number, min: number, max: number): number[] {
  const out: number[] = []
  for (let h = min; h <= max; h += 0.5) out.push(h)
  if (!out.includes(current)) out.push(current)
  return out.sort((a, b) => a - b)
}

/**
 * The log with the usual day length set to `hours`. Choosing the 16 h preset again removes the saved
 * value, so the log is back on the preset (its hint says so again, and in the demo Reset demo no
 * longer lists it as a change).
 */
export function withUsualHours(doc: LogDoc, hours: number): LogDoc {
  const { usualDayHours: _old, ...rest } = doc.profile
  return { ...doc, profile: hours === DEFAULT_USUAL_DAY_HOURS ? rest : { ...rest, usualDayHours: hours } }
}
