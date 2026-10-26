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

/** A range's ends rounded with Math.round, joined by an en dash: "1,870–2,780". */
export function fmtRangeEnds(r: Range): { lo: string; hi: string } {
  return { lo: fmtInt(Math.max(0, r.lo)), hi: fmtInt(r.hi) }
}

export function fmtRange(r: Range): string {
  const { lo, hi } = fmtRangeEnds(r)
  return copy.headline.rangeValue(lo, hi)
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

/** "Thu 12:40 AM": a meal's time with its own weekday, used where it differs from the day's. */
export function fmtWeekdayTime(iso: string): string {
  return `${fmtWeekday(iso)} ${fmtTime(iso)}`
}

/** "2026-10-21" in local time, for "re-checked" dates and the like. */
export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
