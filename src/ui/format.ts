// Number and time formatting for the screens. Words come from copy.ts.
// Formatting is done by hand (not Intl time formats) so the output is the same in
// every browser: some ICU versions put a narrow no-break space before AM/PM.

import type { Range } from '../kernel/types'
import { copy } from './copy'

const group = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, useGrouping: true })

/** 2280 -> "2,280" (rounded half up, like the spec's Math.round display rule). */
export function fmtInt(n: number): string {
  return group.format(Math.round(n))
}

const amount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: true })

/** A typed amount as typed, grouped, with up to 2 decimals: 2400 -> "2,400", 62.5 -> "62.5". */
export function fmtAmount(n: number): string {
  return amount.format(n)
}

/** A range's ends rounded with Math.round, joined by an en dash: "1,870–2,780". */
export function fmtRangeEnds(r: Range): { lo: string; hi: string } {
  return { lo: fmtInt(Math.max(0, r.lo)), hi: fmtInt(r.hi) }
}

export function fmtRange(r: Range): string {
  const { lo, hi } = fmtRangeEnds(r)
  return copy.headline.rangeValue(lo, hi)
}

/**
 * A number that can be below 0 (net calories), with a real minus sign: -140 -> "−140",
 * 1500 -> "1,500". Rounded like fmtInt; a value that rounds to 0 is "0", never "−0".
 */
export function fmtSigned(n: number): string {
  const r = Math.round(n)
  return r < 0 ? `${copy.headline.minus}${group.format(-r)}` : group.format(r === 0 ? 0 : r)
}

/** Rounded, with its sign either way: −369, +1,453, 0. */
export function fmtSignedPlus(n: number): string {
  const r = Math.round(n)
  return r > 0 ? `${copy.headline.plus}${group.format(r)}` : fmtSigned(r)
}

/** A range's ends that may run below 0 (net), not cut off at 0. */
export function fmtSignedRangeEnds(r: Range): { lo: string; hi: string } {
  return { lo: fmtSigned(r.lo), hi: fmtSigned(r.hi) }
}

/** True when either end of a range rounds below 0, so the ends are joined with "to", not a dash. */
function runsBelowZero(r: Range): boolean {
  return Math.round(r.lo) < 0 || Math.round(r.hi) < 0
}

/** "428–2,572 kcal", or "−140 to 3,140 kcal" once an end is below 0. */
export function fmtSignedRange(r: Range): string {
  const { lo, hi } = fmtSignedRangeEnds(r)
  return runsBelowZero(r) ? copy.headline.signedRangeValue(lo, hi) : copy.headline.rangeValue(lo, hi)
}

/** A range without its unit (Night's one-line ranges): "1,870–2,780". Never below 0. */
export function fmtRangeShort(r: Range): string {
  const { lo, hi } = fmtRangeEnds(r)
  return copy.night.rangeEnds(lo, hi)
}

/** A range that may run below 0, without its unit: "428–2,572", or "−140 to 3,140". */
export function fmtSignedRangeShort(r: Range): string {
  const { lo, hi } = fmtSignedRangeEnds(r)
  return runsBelowZero(r) ? copy.night.signedRangeEnds(lo, hi) : copy.night.rangeEnds(lo, hi)
}

/** A fraction as a percentage with at most one decimal: 0.46 -> "46", 0.1672 -> "16.7". */
export function fmtPct(fraction: number, decimals = 1): string {
  const f = 10 ** decimals
  const v = Math.round(fraction * 100 * f) / f
  return String(v)
}

/** A fraction of a whole as a whole percentage, for shares: 0.583 -> "58". */
export function fmtSharePct(fraction: number): string {
  return String(Math.round(fraction * 100))
}

/** "1:20 PM" from an ISO string, in local time. */
export function fmtTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? copy.am : copy.pm}`
}

/** "Wed" from an ISO string, in local time. */
export function fmtWeekday(iso: string): string {
  return copy.weekdays[new Date(iso).getDay()]
}

/** "Wednesday" from an ISO string, in local time (the Night look's "still Wednesday’s day"). */
export function fmtWeekdayFull(iso: string): string {
  return copy.weekdaysFull[new Date(iso).getDay()]
}

/** True when `iso` falls on a later calendar date than the waking day's wake (after midnight). */
export function onLaterDate(iso: string, dayStart: string | null): boolean {
  // The calendar date, not just the weekday: a day a week later has the same weekday name.
  return dayStart !== null && new Date(iso).toDateString() !== new Date(dayStart).toDateString()
}

/** "Thu Nov 5": a weekday with its date, where a weekday alone could name two days a week apart. */
export function fmtWeekdayDate(iso: string): string {
  const d = new Date(iso)
  return `${copy.weekdays[d.getDay()]} ${copy.monthsShort[d.getMonth()]} ${d.getDate()}`
}

/** "Thu 12:40 AM": a meal's time with its own weekday, used where it differs from the day's. */
export function fmtWeekdayTime(iso: string): string {
  return `${fmtWeekday(iso)} ${fmtTime(iso)}`
}

/** "Wed Nov 4, 11:10 PM": a time with its weekday and date, for a night that may be weeks away. */
export function fmtWeekdayDateTime(iso: string): string {
  return copy.dateAndTime(fmtWeekdayDate(iso), fmtTime(iso))
}

/**
 * A time inside a waking day: "6:30 PM" on the day's own date, "Thu 12:40 AM" on a later date, and
 * "Mon Oct 19, 6:30 PM" 6 or more days on (a long day with no sleep logged), where a weekday alone
 * could name the day the waking day started on.
 */
export function fmtTimeInDay(iso: string, dayStart: string | null): string {
  if (!onLaterDate(iso, dayStart)) return fmtTime(iso)
  return farIntoDay(iso, dayStart) ? fmtWeekdayDateTime(iso) : fmtWeekdayTime(iso)
}

/** True 6 or more days after the waking day's wake, where a weekday alone is ambiguous. */
function farIntoDay(iso: string, dayStart: string | null): boolean {
  return dayStart !== null && Date.parse(iso) - Date.parse(dayStart) >= 6 * 86_400_000
}

/** The date part fmtTimeInDay gives a time on a later date: "Thu", or "Mon Oct 26" 6 or more days on. */
export function fmtDateInDay(iso: string, dayStart: string | null): string {
  return farIntoDay(iso, dayStart) ? fmtWeekdayDate(iso) : fmtWeekday(iso)
}

/**
 * "Wed Oct 21, 6:30 PM": a moment with its weekday and date always given, for a list that runs
 * across many dates (the gym log). The year is added when it is not now's: "Wed Oct 21, 2025, 6:30 PM".
 * Without the time: "Wed Oct 21".
 */
export function fmtDatedWhen(iso: string, nowIso: string, withTime = true): string {
  const d = new Date(iso)
  const year = d.getFullYear() === new Date(nowIso).getFullYear() ? null : String(d.getFullYear())
  const date = copy.weekdayDate(copy.weekdays[d.getDay()], copy.monthsShort[d.getMonth()], String(d.getDate()), year)
  return withTime ? copy.dateAndTime(date, fmtTime(iso)) : date
}

/** Local calendar days from `iso` to `nowIso` (0 on the same date, 1 the day before, below 0 ahead). */
function daysBefore(iso: string, nowIso: string): number {
  const a = new Date(iso)
  const b = new Date(nowIso)
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((db - da) / 86_400_000)
}

/**
 * When a past entry was, plain enough to tell which day it was. Within the last six days the
 * weekday says it: "Tue 7:10 AM". Earlier (or ahead), the calendar date is added, with the year
 * when it is not this year's: "Tue 22 Sep, 7:10 AM", "Tue 22 Sep 2025, 7:10 AM". With no recorded
 * time (`timeKnown` false) the time is left out and the date is always given: "Tue 22 Sep".
 */
export function fmtPastWhen(iso: string, nowIso: string, timeKnown = true): string {
  const days = daysBefore(iso, nowIso)
  if (timeKnown && days >= 0 && days <= 6) return fmtWeekdayTime(iso)
  const d = new Date(iso)
  const year = d.getFullYear() === new Date(nowIso).getFullYear() ? null : String(d.getFullYear())
  const date = copy.dayDate(fmtWeekday(iso), String(d.getDate()), copy.months[d.getMonth()], year)
  return timeKnown ? copy.dateAndTime(date, fmtTime(iso)) : date
}

/**
 * A calendar date written YYYY-MM-DD as people read it: "Tue 13 Oct", with the year when it isn't
 * the year of `nowIso` ("Tue 13 Oct 2025"), or always when no `nowIso` is given. The date is its
 * own calendar day, whatever the device's time zone. Text that isn't such a date comes back as it is.
 */
export function fmtCalendarDate(date: string, nowIso?: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(t.getTime())) return date
  const sameYear = nowIso !== undefined && new Date(nowIso).getFullYear() === y
  return copy.dayDate(copy.weekdays[t.getUTCDay()], String(d), copy.months[m - 1], sameYear ? null : String(y))
}

/** "2026-10-21" in local time, for "re-checked" dates and the like. */
export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
