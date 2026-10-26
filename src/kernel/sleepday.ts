// Waking days (spec.md > Maths Core: Waking Days and Sleep).
// A waking day runs from one wake up to (not including) the next. A meal at time t
// belongs to the day whose wake is the latest wake <= t. Slice 4 adds the status, the list
// of days, validation, movedMeals() and nightStats() with the circular-mean wake time.
// Pure: no React, no storage, no clock reads ("at" is always passed in).

import type { Meal, Night, NightStats, SleepProblem, SleepRecord, SleepStatus } from './types'

function ms(iso: string): number {
  return Date.parse(iso)
}

/** Every recorded wake, sorted by time. */
function wakesOf(sleeps: SleepRecord[]): string[] {
  return sleeps
    .map((s) => s.wake)
    .filter((w): w is string => typeof w === 'string' && !Number.isNaN(ms(w)))
    .sort((a, b) => ms(a) - ms(b))
}

/** The latest wake <= at, as stored; null when there is none (the provisional day). */
export function wakingDayStart(sleeps: SleepRecord[], at: string): string | null {
  const t = ms(at)
  let best: string | null = null
  for (const w of wakesOf(sleeps)) {
    if (ms(w) <= t) best = w
    else break
  }
  return best
}

/** The first wake strictly after dayStart, or null when this is the latest day. */
export function nextWakeAfter(sleeps: SleepRecord[], dayStart: string): string | null {
  const t = ms(dayStart)
  for (const w of wakesOf(sleeps)) if (ms(w) > t) return w
  return null
}

/**
 * The meals from the wake dayStart up to (not including) the next wake, in time order.
 * dayStart null means the provisional day: meals before the first wake (all meals when
 * no wake is recorded).
 */
export function mealsForDay(meals: Meal[], sleeps: SleepRecord[], dayStart: string | null): Meal[] {
  let from = Number.NEGATIVE_INFINITY
  let to = Number.POSITIVE_INFINITY
  if (dayStart === null) {
    const first = wakesOf(sleeps)[0]
    if (first !== undefined) to = ms(first)
  } else {
    from = ms(dayStart)
    const next = nextWakeAfter(sleeps, dayStart)
    if (next !== null) to = ms(next)
  }
  return meals
    .filter((m) => {
      const t = ms(m.eatenAt)
      return t >= from && t < to
    })
    .sort((a, b) => ms(a.eatenAt) - ms(b.eatenAt))
}

/* ---------------- slice 4: status, the list of days, nights, moved meals, validation ---------------- */

/** When a record starts: its sleep start, or its wake when the sleep start wasn't logged. */
function startOf(r: SleepRecord): number {
  return ms(r.sleepStart ?? r.wake ?? '')
}

/** When a record ends: its wake, or its sleep start while the wake isn't logged. */
function endOf(r: SleepRecord): number {
  return ms(r.wake ?? r.sleepStart ?? '')
}

/** The records in time order (by start), dropping any with no usable time. */
export function sortedSleeps(sleeps: SleepRecord[]): SleepRecord[] {
  return sleeps.filter((r) => !Number.isNaN(startOf(r))).sort((a, b) => startOf(a) - startOf(b))
}

/**
 * Current status (spec.md > Waking Days and Sleep): asleep when the latest record has a sleep start
 * and no wake; awake otherwise, including when there are no records.
 */
export function sleepStatus(sleeps: SleepRecord[]): SleepStatus {
  const sorted = sortedSleeps(sleeps)
  const latest = sorted[sorted.length - 1]
  if (latest && latest.sleepStart !== null && latest.wake === null) {
    return { kind: 'asleep', since: latest.sleepStart, recordId: latest.id }
  }
  return { kind: 'awake', since: latest?.wake ?? null, recordId: latest?.id ?? null }
}

/**
 * Every waking day, oldest first, as the dayStart mealsForDay() takes. The provisional day (null)
 * comes first when there is no wake at all, or when some meal falls before the first wake.
 * Days that start after `upTo` (the log's now) are left out, so the list ends on the current day.
 */
export function wakingDays(meals: Meal[], sleeps: SleepRecord[], upTo?: string): (string | null)[] {
  const wakes = wakesOf(sleeps).filter((w) => upTo === undefined || ms(w) <= ms(upTo))
  const first = wakes[0]
  const provisional = first === undefined || meals.some((m) => ms(m.eatenAt) < ms(first))
  return provisional ? [null, ...wakes] : wakes
}

/** Which record's wake starts the day a time falls in (null = the provisional day). */
function dayKey(sleeps: SleepRecord[], at: string): string | null {
  const t = ms(at)
  let best: SleepRecord | null = null
  for (const r of sleeps) {
    if (r.wake === null || Number.isNaN(ms(r.wake)) || ms(r.wake) > t) continue
    if (best === null || ms(r.wake) > ms(best.wake as string)) best = r
  }
  return best ? best.id : null
}

/**
 * The meals whose waking day changes between two versions of the sleep records (spec.md >
 * movedMeals). A day is known by the record whose wake starts it, so moving a wake a little
 * lists only the meals that cross it, not every meal on the day.
 */
export function movedMeals(meals: Meal[], before: SleepRecord[], after: SleepRecord[]): Meal[] {
  return meals
    .filter((m) => dayKey(before, m.eatenAt) !== dayKey(after, m.eatenAt))
    .sort((a, b) => ms(a.eatenAt) - ms(b.eatenAt))
}

const DAY_MIN = 1440

/** Minutes after local midnight (0..1439) for an ISO time. */
export function minutesOfDay(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * The circular mean of clock times in minutes (spec.md > nightStats): 23:50 and 00:10 average to
 * 00:00, not noon. Rounded (never floored), wrapped into 0..1439. Null when there are no times or
 * the resultant length is below 0.2 ("Wake times vary too much to average").
 */
export function circularMeanMinutes(minutes: number[]): number | null {
  if (minutes.length === 0) return null
  let s = 0
  let c = 0
  for (const m of minutes) {
    const a = (2 * Math.PI * m) / DAY_MIN
    s += Math.sin(a)
    c += Math.cos(a)
  }
  if (Math.sqrt(s * s + c * c) / minutes.length < 0.2) return null
  const m = Math.round((Math.atan2(s, c) * DAY_MIN) / (2 * Math.PI))
  return ((m % DAY_MIN) + DAY_MIN) % DAY_MIN
}

/**
 * The last `lastN` nights (spec.md > nightStats): each night's length (wake - sleepStart), or
 * null ("not logged") when its sleep start or wake is missing. A sleep still in progress (the
 * latest record, with no wake yet) is not a night yet and is left out. The average and the
 * average wake time use complete nights only; `complete` of `total` is the "6 of 7 nights" count.
 */
export function nightStats(sleeps: SleepRecord[], lastN = 7): NightStats {
  const sorted = sortedSleeps(sleeps)
  const latest = sorted[sorted.length - 1]
  const done = latest && latest.wake === null ? sorted.slice(0, -1) : sorted
  const recent = done.slice(Math.max(0, done.length - lastN))
  const nights: Night[] = recent.map((r) => {
    const len =
      r.sleepStart !== null && r.wake !== null ? Math.round((ms(r.wake) - ms(r.sleepStart)) / 60_000) : null
    return { id: r.id, sleepStart: r.sleepStart, wake: r.wake, minutes: len !== null && len > 0 ? len : null }
  })
  const complete = nights.filter((n) => n.minutes !== null)
  const lengths = complete.map((n) => n.minutes as number)
  const wakes = complete.map((n) => minutesOfDay(n.wake as string))
  const avgWake = circularMeanMinutes(wakes)
  return {
    nights,
    complete: lengths.length,
    total: nights.length,
    avgMinutes: lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null,
    avgWakeMinutes: avgWake,
    wakeVaries: wakes.length > 0 && avgWake === null,
  }
}

/**
 * Check one changed or added record against the rest (spec.md > Validation): wake after its sleep
 * start, sleep start after the previous record's wake, no overlaps, and (in your own log) nothing
 * later than `latest`. Null when it is valid; otherwise what is wrong, and nothing is saved.
 */
export function validateSleep(
  sleeps: SleepRecord[],
  changed: SleepRecord,
  latest: string | null = null,
): SleepProblem | null {
  const times = [changed.sleepStart, changed.wake].filter((t): t is string => t !== null)
  if (times.length === 0 || times.some((t) => Number.isNaN(ms(t)))) return { kind: 'not-a-time' }
  if (changed.sleepStart !== null && changed.wake !== null && ms(changed.wake) <= ms(changed.sleepStart)) {
    return { kind: 'wake-before-sleep', sleepStart: changed.sleepStart }
  }
  if (latest !== null && times.some((t) => ms(t) > ms(latest))) return { kind: 'future' }
  const start = startOf(changed)
  const end = endOf(changed)
  for (const o of sortedSleeps(sleeps.filter((r) => r.id !== changed.id))) {
    if (startOf(o) <= start) {
      // An earlier record must have ended (woken) before this one starts.
      if (endOf(o) >= start) {
        return o.wake !== null && changed.sleepStart !== null
          ? { kind: 'sleep-before-previous-wake', wake: o.wake }
          : { kind: 'overlap' }
      }
    } else if (end >= startOf(o) || changed.wake === null) {
      // A later record must start after this one ends; a sleep with no wake can't have records after it.
      return { kind: 'overlap' }
    }
  }
  return null
}
