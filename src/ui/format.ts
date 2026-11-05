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
  return dayStart !== null && fmtWeekday(iso) !== fmtWeekday(dayStart)
}

/** "Thu 12:40 AM": a meal's time with its own weekday, used where it differs from the day's. */
export function fmtWeekdayTime(iso: string): string {
  return `${fmtWeekday(iso)} ${fmtTime(iso)}`
}

/** "2026-10-21" in local time, for "re-checked" dates and the like. */
export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
