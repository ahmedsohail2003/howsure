// The Panel look's rings (build-out item 1.5.2b): how much of a ring to fill and the share it
// states in words. Pure: no React.
//
// The ring shows the best estimate only, as a share of a target the person set. It is never
// filled against a made-up target: with no target there is no share. Going over is never hidden:
// the ring is full and the words give the real share ("112% of 2,400"). The share is rounded so
// it can't claim more than is there before the target is reached (down below the target), and
// always shows a value past the target as more than 100% (up above it).

export interface RingFill {
  /** The share of the target, a whole percentage, for the words. */
  pct: number
  /** How much of the ring to draw, 0 to 100 (the ring's path length is 100). */
  fill: number
  over: boolean
}

/** The fill and share for `value` against `target`; null with no usable target or value. */
export function ringFill(value: number | null, target: number | undefined): RingFill | null {
  if (value === null || target === undefined || !(target > 0) || !Number.isFinite(value) || value < 0) return null
  // One division of the two amounts, so a whole share (2,280 of 2,400 is 95) stays whole.
  const share = (value * 100) / target
  const over = value > target
  const pct = over ? Math.ceil(share) : Math.floor(share)
  return { pct, fill: Math.min(100, share), over }
}
