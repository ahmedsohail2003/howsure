// Build-out item 1.5.2, Journal look: where the range bar draws its bands and markers. The very
// likely range is the outer band, the likely range the inner band, with a marker for the best
// estimate and one for the daily calorie target when one is set. Pure, so the positions can be
// tested without a browser.
//
// The scale runs from a little below the lowest value shown (the very likely range's low end, or
// the target) to a little above the highest, so every band and marker fits with room around it.
// It never starts below 0 kcal for calories eaten; net calories (item 2.5a) may, and then the bar
// marks where 0 falls. The bar is drawn for the eye only: every number is also written as text in
// the legend beside it.
//
// A band is never drawn thinner than a few per cent of the bar. Early in a day, with a large
// target, the true bands can be a sliver a few pixels wide; each is widened about its own middle
// to the minimum, the inner band stays inside the outer one, and the best estimate stays where
// it is (inside the inner band). The legend keeps the exact numbers.

import type { Range } from '../kernel/types'

/** Left edge and width of a band, as percentages of the bar's width. */
export interface BandBox {
  left: number
  width: number
}

export interface RangeBarGeometry {
  /** The scale's ends in kcal. */
  min: number
  max: number
  veryLikely: BandBox
  likely: BandBox
  /** Where the markers sit, as a percentage of the bar's width. */
  best: number
  target: number | null
  /** Where 0 kcal falls, when the scale runs from below 0 to above it (net only); else null. */
  zero: number | null
}

/** Room left at each end of the scale, as a share of the span between the outermost values. */
const PAD = 0.08

/** The thinnest each band is drawn, as a percentage of the bar's width. */
export const MIN_VERY_LIKELY_WIDTH = 6
export const MIN_LIKELY_WIDTH = 3

const round2 = (n: number) => Math.round(n * 100) / 100

/** Left and right edges (percentages), widened about the middle to at least `min`, kept on the bar. */
function widen(left: number, right: number, min: number): [number, number] {
  if (right - left >= min) return [left, right]
  const mid = (left + right) / 2
  let l = mid - min / 2
  let r = mid + min / 2
  if (l < 0) [l, r] = [0, min]
  if (r > 100) [l, r] = [100 - min, 100]
  return [l, r]
}

/**
 * The bar for a day with known calories and both ranges. Null when there is nothing to draw:
 * no ranges, or a span of 0 kcal (every value the same), where a bar would say nothing.
 */
export function rangeBarGeometry(
  best: number,
  likely: Range | null,
  veryLikely: Range | null,
  target?: number,
  /**
   * Build-out item 2.5a: net calories can be below 0 and their ranges are normal, so the scale may
   * start below 0 too. Eaten calories (the default) never go below 0.
   */
  { signed = false }: { signed?: boolean } = {},
): RangeBarGeometry | null {
  if (!likely || !veryLikely) return null
  const values = [veryLikely.lo, veryLikely.hi, likely.lo, likely.hi, best, ...(target !== undefined ? [target] : [])]
  if (!values.every(Number.isFinite)) return null
  const floor = signed ? Number.NEGATIVE_INFINITY : 0
  const lo = Math.max(floor, Math.min(...values))
  const hi = Math.max(...values)
  const span = hi - lo
  if (span <= 0) return null
  const min = Math.max(floor, lo - span * PAD)
  const max = hi + span * PAD
  const at = (v: number) => ((Math.max(floor, v) - min) / (max - min)) * 100
  const bestAt = at(best)
  let [lkL, lkR] = widen(at(likely.lo), at(likely.hi), MIN_LIKELY_WIDTH)
  // Widening never moves the inner band off the best estimate.
  if (bestAt < lkL) [lkL, lkR] = [bestAt, bestAt + MIN_LIKELY_WIDTH]
  if (bestAt > lkR) [lkL, lkR] = [bestAt - MIN_LIKELY_WIDTH, bestAt]
  let [vlL, vlR] = widen(at(veryLikely.lo), at(veryLikely.hi), MIN_VERY_LIKELY_WIDTH)
  vlL = Math.min(vlL, lkL)
  vlR = Math.max(vlR, lkR)
  // Edges rounded first, so a band's right edge is exactly left + width.
  const box = (l: number, r: number): BandBox => ({ left: round2(l), width: round2(round2(r) - round2(l)) })
  return {
    min,
    max,
    veryLikely: box(vlL, vlR),
    likely: box(lkL, lkR),
    best: round2(bestAt),
    target: target !== undefined ? round2(at(target)) : null,
    zero: min < 0 && max > 0 ? round2(at(0)) : null,
  }
}
