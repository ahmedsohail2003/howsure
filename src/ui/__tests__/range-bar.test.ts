// Build-out item 1.5.2, Journal look: the range bar's geometry (src/ui/rangeBar.ts).
// Expected positions worked out by hand (Python, 2026-11-05) for Sam's Wednesday rounded to whole
// kcal: very likely 1,684–3,087, likely 1,870–2,780, best 2,280, target 2,400. Span 1,403 kcal,
// 8% room each end: scale 1,571.76–3,199.24 kcal.
//   very likely: left 6.90, width 86.20; likely: left 18.33, width 55.91;
//   best 43.52; target 50.89.
import { describe, expect, it } from 'vitest'
import { MIN_LIKELY_WIDTH, MIN_VERY_LIKELY_WIDTH, rangeBarGeometry } from '../rangeBar'

const VL = { lo: 1684, hi: 3087 }
const LK = { lo: 1870, hi: 2780 }

describe('the range bar', () => {
  it('places both bands and both markers on one scale', () => {
    const g = rangeBarGeometry(2280, LK, VL, 2400)
    expect(g).not.toBeNull()
    expect(g!.min).toBeCloseTo(1571.76, 2)
    expect(g!.max).toBeCloseTo(3199.24, 2)
    expect(g!.veryLikely).toEqual({ left: 6.9, width: 86.2 })
    expect(g!.likely).toEqual({ left: 18.33, width: 55.91 })
    expect(g!.best).toBe(43.52)
    expect(g!.target).toBe(50.89)
  })

  it('draws no target marker when no target is set', () => {
    const g = rangeBarGeometry(2280, LK, VL)
    expect(g!.target).toBeNull()
    // Same scale as before: the target sat inside the very likely range.
    expect(g!.veryLikely).toEqual({ left: 6.9, width: 86.2 })
  })

  it('widens the scale to take in a target outside the ranges', () => {
    const g = rangeBarGeometry(2280, LK, VL, 3600)!
    expect(g.max).toBeGreaterThan(3600)
    expect(g.target).toBeLessThan(100)
    expect(g.veryLikely.left + g.veryLikely.width).toBeLessThan(g.target!)
  })

  it('keeps the inner band inside the outer one and the best estimate inside the inner band', () => {
    const g = rangeBarGeometry(2280, LK, VL, 1200)!
    expect(g.likely.left).toBeGreaterThanOrEqual(g.veryLikely.left)
    expect(g.likely.left + g.likely.width).toBeLessThanOrEqual(g.veryLikely.left + g.veryLikely.width)
    expect(g.best).toBeGreaterThan(g.likely.left)
    expect(g.best).toBeLessThan(g.likely.left + g.likely.width)
    for (const v of [g.veryLikely.left, g.likely.left, g.best, g.target!]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('never starts the scale below 0 kcal', () => {
    const g = rangeBarGeometry(60, { lo: 40, hi: 90 }, { lo: 10, hi: 160 })!
    expect(g.min).toBe(0)
    expect(g.veryLikely.left).toBeGreaterThan(0)
  })

  it('draws nothing without ranges or with a span of 0 kcal', () => {
    expect(rangeBarGeometry(2280, null, VL)).toBeNull()
    expect(rangeBarGeometry(2280, LK, null)).toBeNull()
    expect(rangeBarGeometry(0, { lo: 0, hi: 0 }, { lo: 0, hi: 0 })).toBeNull()
    expect(rangeBarGeometry(Number.NaN, LK, VL)).toBeNull()
  })
})

describe('the range bar, early in a day with a large target', () => {
  // One 300 kcal meal against a 6,000 kcal target (the case where the true bands are a sliver):
  // very likely 240–345, likely 270–330. Span 240–6,000 (5,760 kcal) plus 8% each end: scale
  // 0–6,460.8 kcal (it never starts below 0), so the true very likely band is 1.63% wide and the
  // likely band 0.93%.
  const g = rangeBarGeometry(300, { lo: 270, hi: 330 }, { lo: 240, hi: 345 }, 6000)!

  it('draws each band at least its minimum width', () => {
    expect(g.veryLikely.width).toBeGreaterThanOrEqual(MIN_VERY_LIKELY_WIDTH)
    expect(g.likely.width).toBeGreaterThanOrEqual(MIN_LIKELY_WIDTH)
  })

  it('keeps the best estimate where it is, inside the inner band, inside the outer band', () => {
    expect(g.best).toBeCloseTo((300 / 6460.8) * 100, 2)
    expect(g.likely.left).toBeLessThanOrEqual(g.best)
    expect(g.likely.left + g.likely.width).toBeGreaterThanOrEqual(g.best)
    expect(g.veryLikely.left).toBeLessThanOrEqual(g.likely.left)
    expect(g.veryLikely.left + g.veryLikely.width).toBeGreaterThanOrEqual(g.likely.left + g.likely.width)
    expect(g.veryLikely.left).toBeGreaterThanOrEqual(0)
    expect(g.target).toBeCloseTo((6000 / 6460.8) * 100, 2)
  })

  it('widens a band at the left end of the bar without running off it', () => {
    const edge = rangeBarGeometry(20, { lo: 15, hi: 25 }, { lo: 10, hi: 30 }, 6000)!
    expect(edge.veryLikely.left).toBe(0)
    expect(edge.veryLikely.width).toBeGreaterThanOrEqual(MIN_VERY_LIKELY_WIDTH)
    expect(edge.likely.left).toBeGreaterThanOrEqual(0)
    expect(edge.likely.width).toBeGreaterThanOrEqual(MIN_LIKELY_WIDTH)
    expect(edge.best).toBeGreaterThanOrEqual(edge.likely.left)
    expect(edge.best).toBeLessThanOrEqual(edge.likely.left + edge.likely.width)
  })
})
