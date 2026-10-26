// The sleep section and the two sleep buttons (prd.md > Sleep and Waking Days; spec.md > Maths
// Core: Waking Days and Sleep, > Clock). What the section shows for a viewed day, and what
// **I'm going to sleep** / **I woke up** would save, checked by the kernel's validateSleep().
// Pure: no React, no storage. The demo clock's re-anchoring happens in App.tsx.

import { movedMeals, nightStats, sleepStatus, sortedSleeps, validateSleep } from '../kernel/sleepday'
import type { Meal, Night, NightStats, SleepProblem, SleepRecord, SleepStatus } from '../kernel/types'
import { copy } from './copy'
import { fmtWeekdayTime } from './format'

export interface SleepView {
  /** Now's status: awake or asleep. It is about now, whichever day is on screen. */
  status: SleepStatus
  /** The night that ended at the viewed day's wake, or null (shown as "not logged"). */
  lastNight: Night | null
  /** The 7 nights up to the viewed day's wake. */
  stats: NightStats
}

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
  return {
    status: sleepStatus(sleeps),
    lastNight: last && dayStart !== null && last.wake === dayStart ? last : null,
    stats,
  }
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
      return copy.sleep.errors.sleepBeforeWake(fmtWeekdayTime(p.wake))
    case 'overlap':
      return copy.sleep.errors.overlap
    case 'future':
      return copy.sleep.errors.future
  }
}
