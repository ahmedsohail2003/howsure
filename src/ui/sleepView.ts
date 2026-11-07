// The sleep section and the two sleep buttons (prd.md > Sleep and Waking Days; spec.md > Maths
// Core: Waking Days and Sleep, > Clock). What the section shows for a viewed day, and what
// **I'm going to sleep** / **I woke up** would save, checked by the kernel's validateSleep().
// Pure: no React, no storage. The demo clock's re-anchoring happens in App.tsx.

import { movedMeals, nightStats, sleepStatus, sortedSleeps, validateSleep } from '../kernel/sleepday'
import type { Meal, Night, NightStats, SleepProblem, SleepRecord, SleepStatus } from '../kernel/types'
import { copy } from './copy'
import { fmtWeekday, fmtWeekdayDateTime, fmtWeekdayTime } from './format'

export interface SleepView {
  /** Now's status: awake or asleep. It is about now, whichever day is on screen. */
  status: SleepStatus
  /** The night that ended at the viewed day's wake, or null (shown as "not logged"). */
  lastNight: Night | null
  /** The 7 nights up to the viewed day's wake. */
  stats: NightStats
  /** How the viewed waking day ends (the Night look's timeline ends with it). */
  dayEnd: DayEnd
  /**
   * The record whose wake starts the viewed day (build-out item 2.2): what the header's wake time,
   * Edit in the sleep section and the Night timeline's wake point open in the editor. Null for
   * the provisional day.
   */
  dayRecordId: string | null
  /** The viewed day's wake (null: the provisional day), for the words around those entry points. */
  dayStart: string | null
}

/**
 * How a waking day ends: still running with the person awake (the current day), with the person
 * asleep since a time (the current day, closed by a sleep with no wake yet), or closed by a night
 * that has its wake (an earlier day). A closed day's sleep start may be "not logged" (null).
 */
export type DayEnd =
  | { kind: 'awake' }
  | { kind: 'asleep'; since: string; recordId: string }
  | { kind: 'closed'; sleepStart: string | null; recordId: string }

/** The sleep section for the waking day `dayStart`: nights up to that day's wake, so a previous day shows its own. */
export function buildSleepView(sleeps: SleepRecord[], dayStart: string | null): SleepView {
  const upTo =
    dayStart === null
      ? []
      : sleeps.filter((r) => {
          const end = r.wake ?? r.sleepStart
          return end !== null && Date.parse(end) <= Date.parse(dayStart)
        })
  const stats = nightStats(upTo)
  const last = stats.nights[stats.nights.length - 1]
  const status = sleepStatus(sleeps)
  return {
    status,
    lastNight: last && dayStart !== null && last.wake === dayStart ? last : null,
    stats,
    dayEnd: dayEndOf(sleeps, dayStart, status),
    dayRecordId: dayStart === null ? null : (sleeps.find((r) => r.wake === dayStart)?.id ?? null),
    dayStart,
  }
}

/** How the waking day starting at `dayStart` (null: the provisional day) ends. */
export function dayEndOf(sleeps: SleepRecord[], dayStart: string | null, status: SleepStatus = sleepStatus(sleeps)): DayEnd {
  const sorted = sortedSleeps(sleeps)
  const from = dayStart === null ? Number.NEGATIVE_INFINITY : Date.parse(dayStart)
  // The night that closes this day is the first one whose wake comes after the day's wake.
  const closing = sorted.find((r) => r.wake !== null && Date.parse(r.wake) > from)
  if (closing) return { kind: 'closed', sleepStart: closing.sleepStart, recordId: closing.id }
  if (status.kind === 'asleep' && Date.parse(status.since) >= from) {
    return { kind: 'asleep', since: status.since, recordId: status.recordId }
  }
  return { kind: 'awake' }
}

/** Minutes as "8 h 45 min" (rounded to the minute). */
export function fmtDuration(minutes: number): string {
  const m = Math.round(minutes)
  return copy.sleep.duration(String(Math.floor(m / 60)), String(m % 60))
}

/** "1:16 PM" from minutes after midnight. */
export function fmtClockMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? copy.am : copy.pm}`
}

export type SleepAction = 'sleep' | 'wake'

export type SleepSave =
  | { ok: true; sleeps: SleepRecord[]; record: SleepRecord; moved: Meal[] }
  | { ok: false; problem: SleepProblem }

/** A new sleep record's id: random, like a meal's. */
export function newSleepId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return `sleep-${c.randomUUID()}`
  return `sleep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * What **I'm going to sleep** or **I woke up** at `iso` would save. Going to sleep adds a record
 * with no wake (closing the waking day); waking up fills the open record's wake (starting the next
 * day). `latest` is now in your own log, where a later time is rejected; null in the demo, whose
 * clock moves forward instead. `moved` lists meals that would change day (meals timed after the
 * new wake). Nothing is saved when there is a problem.
 */
export function sleepSave(
  sleeps: SleepRecord[],
  meals: Meal[],
  action: SleepAction,
  iso: string | null,
  latest: string | null,
  id: string = newSleepId(),
): SleepSave {
  if (iso === null) return { ok: false, problem: { kind: 'not-a-time' } }
  const status = sleepStatus(sleeps)
  let record: SleepRecord
  if (action === 'wake' && status.kind === 'asleep') {
    const open = sortedSleeps(sleeps).find((r) => r.id === status.recordId) as SleepRecord
    record = { ...open, wake: iso }
  } else if (action === 'wake') {
    // Awake with no open sleep: a wake on its own (its sleep start "not logged").
    record = { id, sleepStart: null, wake: iso }
  } else {
    record = { id, sleepStart: iso, wake: null }
  }
  const problem = validateSleep(sleeps, record, latest)
  if (problem) return { ok: false, problem }
  const next = sleeps.some((r) => r.id === record.id)
    ? sleeps.map((r) => (r.id === record.id ? record : r))
    : [...sleeps, record]
  return { ok: true, sleeps: next, record, moved: movedMeals(meals, sleeps, next) }
}

/** The inline message for a problem (spec.md > Validation). */
export function problemText(p: SleepProblem): string {
  switch (p.kind) {
    case 'not-a-time':
      return copy.sleep.errors.notATime
    case 'wake-before-sleep':
      return copy.sleep.errors.wakeBeforeSleep(fmtWeekdayTime(p.sleepStart))
    case 'sleep-before-previous-wake':
      return copy.sleep.errors.sleepBeforeWake(fmtWeekdayDateTime(p.wake))
    case 'overlap':
      return copy.sleep.errors.overlap(nightRangeText(p.other))
    case 'needs-wake':
      return copy.sleep.errors.needsWake(nightRangeText(p.other))
    case 'future':
      return copy.sleep.errors.future
  }
}

/**
 * A night's two ends in words, dated so a night weeks away in an imported log is clear: "Wed Nov 4,
 * 11:10 PM to Thu 7:20 AM" (the wake carries its own date too when it is a week or more later).
 * A night missing an end says so: "sleep time not logged, woke Thu Nov 5, 7:20 AM", or "asleep
 * since Wed Nov 4, 11:10 PM, no wake time yet".
 */
export function nightRangeText(r: SleepRecord): string {
  if (r.sleepStart === null) return r.wake !== null ? copy.sleep.nightRangeNoSleep(fmtWeekdayDateTime(r.wake)) : ''
  if (r.wake === null) return copy.sleep.nightRangeOpen(fmtWeekdayDateTime(r.sleepStart))
  const farApart = Date.parse(r.wake) - Date.parse(r.sleepStart) >= 6 * 86_400_000
  return copy.sleep.nightRange(fmtWeekdayDateTime(r.sleepStart), farApart ? fmtWeekdayDateTime(r.wake) : fmtWeekdayTime(r.wake))
}

/** How long after a wake, with no sleep logged since, a night counts as gone by unlogged. */
const NIGHT_GONE_MS = 24 * 60 * 60 * 1000

/**
 * True when a night has gone by since `wakeIso` (24 hours or more before now). Under that, the
 * night woken from is still "last night", even after midnight (still up at 1:30 AM after waking
 * at 7:10 AM the day before). The sleep section's head and its row, and the editor's hint about
 * a missed night, all use this one test, so they tell the same story.
 */
export function nightGoneBySince(wakeIso: string, nowIso: string): boolean {
  return Date.parse(nowIso) - Date.parse(wakeIso) >= NIGHT_GONE_MS
}

// The sleep section's head and its first row (build-out item 2.2), kept here so the sleep details
// (build-out item 2.9) name the same night the same way.

/**
 * What Edit in the head opens, and its visible words. On the current day while asleep: the sleep
 * going on, beside "Asleep since …". Otherwise the night that started the viewed day: "last night"
 * when no night has passed since it (isLastNight); otherwise named by its day (an earlier day, or
 * a current day that runs on because nothing was logged for last night).
 */
export function headEdit(sleep: SleepView, today: boolean, nowIso: string): { recordId: string; label: string } | null {
  if (today && sleep.status.kind === 'asleep') return { recordId: sleep.status.recordId, label: copy.sleepEditor.editThisSleep }
  return dayNightEdit(sleep, today, nowIso)
}

/**
 * Edit for the night that started the viewed day, named as the section names it ("Edit last night"
 * or "Edit the night before Wed"); null with no record (the provisional day). The head's Edit and
 * the sleep details' Edit both use it.
 */
function dayNightEdit(sleep: SleepView, today: boolean, nowIso: string): { recordId: string; label: string } | null {
  if (!sleep.dayRecordId || !sleep.dayStart) return null
  const last = isLastNight(sleep, today, nowIso)
  return {
    recordId: sleep.dayRecordId,
    label: last ? copy.sleepEditor.editLastNight : copy.sleepEditor.editNight(fmtWeekday(sleep.dayStart)),
  }
}

/**
 * True when the night that started the viewed day is the one the person last woke from with no
 * night since: the current day, woken up from under 24 hours ago (nightGoneBySince). So at 1:30 AM,
 * still up after waking at 7:10 AM the day before, that night is still "last night"; at 10:00 AM
 * the day after, with nothing logged in between, it is named by its day.
 */
function isLastNight(sleep: SleepView, today: boolean, nowIso: string): boolean {
  return today && sleep.dayStart !== null && !nightGoneBySince(sleep.dayStart, nowIso)
}

/**
 * The name of the row under the head: "Last night" only under the same test Edit in the head uses. On a current day that runs on because nothing was logged for last night,
 * the night is named by its day ("Night before Wed"), so the row never claims it was last night.
 * With no night at all on the current day, "Last night" reads "not logged", which is true.
 */
export function lastNightLabel(sleep: SleepView, today: boolean, nowIso: string): string {
  if (!today) return copy.sleep.nightBefore
  if (sleep.dayStart === null || isLastNight(sleep, today, nowIso)) return copy.sleep.lastNight
  return copy.sleep.nightRow(fmtWeekday(sleep.dayStart))
}

/**
 * Build-out item 2.9: what the sleep details show for the viewed day. Now's status (the current
 * day only: it is about now), the night that started the day with its two times and length (each
 * "not logged" when missing, never 0), how to edit that night, and the 7-night average with its
 * count. The nights themselves come from the same SleepView the section draws.
 */
export interface SleepDetailView {
  /** "Awake" or "Asleep since Thu 4:40 AM" on the current day; null on an earlier day. */
  now: string | null
  /** The row name the section uses: "Last night", "Night before Wed" or "Night before this day". */
  lastNightLabel: string
  /** The night that ended at the day's wake, or null when none was logged. */
  lastNight: { sleptAt: string | null; wokeAt: string; length: string | null } | null
  /** Edit for that night, named as the section names it; null with no record (the provisional day). */
  edit: { recordId: string; label: string } | null
  /** "8 h 49 min", or null when no night has both times. */
  average: string | null
  /** "6 of 7 nights", or null with no nights. */
  count: string | null
}

export function sleepDetailView(sleep: SleepView, today: boolean, nowIso: string): SleepDetailView {
  const label = lastNightLabel(sleep, today, nowIso)
  const n = sleep.lastNight
  // A wake more than a day old (build-out item 2.1b): nothing says the person was awake all that
  // time, only that no sleep was logged since, as the section and the Night timeline say.
  const awake = staleWakeDays(sleep.dayStart, nowIso, sleep.status) !== null ? copy.sleep.noSleepSinceWake : copy.sleep.awake
  return {
    now: today ? (sleep.status.kind === 'asleep' ? copy.sleep.asleepSince(fmtWeekdayTime(sleep.status.since)) : awake) : null,
    lastNightLabel: label,
    lastNight:
      n && n.wake !== null
        ? {
            sleptAt: n.sleepStart === null ? null : fmtWeekdayTime(n.sleepStart),
            wokeAt: fmtWeekdayTime(n.wake),
            length: n.minutes === null ? null : fmtDuration(n.minutes),
          }
        : null,
    edit: dayNightEdit(sleep, today, nowIso),
    average: sleep.stats.avgMinutes !== null ? fmtDuration(sleep.stats.avgMinutes) : null,
    count: sleep.stats.total > 0 ? copy.sleep.nightCount(String(sleep.stats.complete), String(sleep.stats.total)) : null,
  }
}

/** How old a wake must be before the header says when it was (build-out item 2.1b): one day. */
export const STALE_WAKE_MS = 24 * 60 * 60 * 1000

/**
 * Whole days since the current day's wake when it is more than a day old and nobody is asleep
 * (an imported log whose last night is days back, or nights not added yet), else null. The header
 * then says when the last wake-up was and offers to set today's wake time, so an old day doesn't
 * read as today.
 */
export function staleWakeDays(dayStart: string | null, nowIso: string, status: SleepStatus): number | null {
  if (dayStart === null || status.kind !== 'awake') return null
  const age = Date.parse(nowIso) - Date.parse(dayStart)
  if (!Number.isFinite(age) || age <= STALE_WAKE_MS) return null
  return Math.floor(age / STALE_WAKE_MS)
}
