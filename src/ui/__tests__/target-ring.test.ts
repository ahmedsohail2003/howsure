// Build-out item 1.5.2b, Panel look: the target ring's fill and share (src/ui/targetRing.ts).
// Sam's Wednesday: best estimate 2,280 kcal against his 2,400 kcal target is 95%.
import { describe, expect, it } from 'vitest'
import { ringFill } from '../targetRing'

describe('the target ring', () => {
  it('fills the share of the target the best estimate reaches, and says it in words', () => {
    expect(ringFill(2280, 2400)).toEqual({ pct: 95, fill: 95, over: false })
  })

  it('is not filled, and states no share, when no target is set: a target is never invented', () => {
    expect(ringFill(2280, undefined)).toBeNull()
  })

  it('is not filled when there is no known value', () => {
    expect(ringFill(null, 2400)).toBeNull()
  })

  it('ignores a target that is not above 0 (the editor refuses those)', () => {
    expect(ringFill(2280, 0)).toBeNull()
    expect(ringFill(2280, -5)).toBeNull()
  })

  it('is full over the target, and the words give the real share, so going over is never hidden', () => {
    expect(ringFill(2688, 2400)).toEqual({ pct: 112, fill: 100, over: true })
    // Just past the target still reads as more than 100%.
    expect(ringFill(2401, 2400)).toMatchObject({ pct: 101, fill: 100, over: true })
  })

  it('never claims 100% before the target is reached', () => {
    const r = ringFill(2399, 2400)!
    expect(r.pct).toBe(99)
    expect(r.fill).toBeCloseTo(99.958, 3)
    expect(r.over).toBe(false)
  })

  it('reads exactly 100% at the target', () => {
    expect(ringFill(2400, 2400)).toEqual({ pct: 100, fill: 100, over: false })
  })

  it('a known 0 is an empty ring at 0%, not an unknown', () => {
    expect(ringFill(0, 2400)).toEqual({ pct: 0, fill: 0, over: false })
  })

  it('works for a macro target in grams with decimals', () => {
    expect(ringFill(124, 130)).toEqual({ pct: 95, fill: (124 * 100) / 130, over: false })
    expect(ringFill(62.5, 62.5)).toMatchObject({ pct: 100, fill: 100 })
  })
})
