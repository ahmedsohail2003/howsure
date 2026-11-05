// Net calories (spec.md > Maths Core: Net Calories; slice 10, build-out item 2.5a).
// - Burned uses the same per-source grouping as meals: same-source spreads add straight, and
//   the source groups combine as the root of the sum of squares. Its score and lognormal ranges
//   follow the day's rules (estimate.ts), so burned is never below 0.
// - Net is N = X_eaten - B_burned, with sd_N = sqrt(sd_eaten^2 + sd_burned^2): eaten and burned
//   are independent. Its ranges are normal, N +- z * sd_N, because net can be near or below 0.
// - Net has no estimate score: a percentage of a number near zero says nothing.
// - Only known entries count, as for a day: a workout with unknown calories (or no source
//   picked) is listed, never counted as 0. Net is available only when both sides have a known
//   total; it is "known entries only" when either side leaves an unknown entry out.
// Resting burn is not part of burned: net is not the full energy balance.
// Pure: no React, no storage, no clock reads.

import { rangeFromE, scoreFromE, Z80, Z95 } from './estimate'
import { SOURCES } from './sources'
import type { BurnSourceId, DayEstimate, DayStatus, ItemEstimate, KnownWorkout, Range, Workout } from './types'

/** The burn sources, in the sources table's order ("How do you know?" for a workout). */
export const BURN_SOURCE_IDS: readonly BurnSourceId[] = ['burn_device', 'burn_machine', 'burn_guess']

const TIE_EPS = 1e-12

export interface BurnedEstimate {
  status: DayStatus
  /** The sum of the known workouts' calories burned. */
  knownTotal: number
  workoutCount: number
  unknownWorkoutIds: string[]
  /** sqrt of the sum of the groups' squared spreads (0 with no known workout). */
  sd: number
  e: number | null // null when knownTotal is 0 ("Not available yet")
  score: number | null
  likely: Range | null
  veryLikely: Range | null
  groups: { source: BurnSourceId; sd: number; workoutIds: string[] }[]
}

export interface NetEstimate {
  /** N = eaten's known total - burned's known total. Can be below 0. */
  total: number
  /** sqrt(sd_eaten^2 + sd_burned^2). */
  sd: number
  /** Normal: N +- 1.2816 sd_N and N +- 1.96 sd_N. Unrounded; displayed with Math.round. */
  likely: Range
  veryLikely: Range
  /** Always null: net shows its ranges but no estimate score. */
  score: null
  /** True when an unknown meal or workout is left out of either side. */
  knownOnly: boolean
}

export interface NetDay {
  eaten: DayEstimate
  /** Eaten's absolute spread, sqrt of the sum of its groups' squared spreads. */
  eatenSd: number
  burned: BurnedEstimate
  /** Null until both eaten and burned have a known total. */
  net: NetEstimate | null
}

/** Known calories burned and a picked source: the workouts the burned maths counts. */
export function isKnownWorkout(w: Workout): w is KnownWorkout {
  return w.kcal !== null && w.source !== null
}

/** A workout's typical error, from the sources table. */
export function workoutError(w: { source: BurnSourceId | null }): number {
  if (w.source === null) throw new Error('workoutError: the workout has no source picked')
  return SOURCES[w.source].typicalError
}

/** One workout's score and lognormal ranges; null when its calories are unknown. */
export function estimateWorkout(w: Workout): ItemEstimate | null {
  if (!isKnownWorkout(w)) return null
  const e = workoutError(w)
  return { e, sd: w.kcal * e, score: scoreFromE(e), likely: rangeFromE(w.kcal, e, Z80), veryLikely: rangeFromE(w.kcal, e, Z95) }
}

/** The day's burned calories: per-source grouping, score and ranges, as combineDay does for meals. */
export function combineBurned(workouts: Workout[]): BurnedEstimate {
  const known = workouts.filter(isKnownWorkout)
  const unknownWorkoutIds = workouts.filter((w) => !isKnownWorkout(w)).map((w) => w.id)
  const status: DayStatus =
    workouts.length === 0 ? 'empty' : known.length === 0 ? 'all-unknown' : unknownWorkoutIds.length > 0 ? 'partial' : 'complete'
  const knownTotal = known.reduce((s, w) => s + w.kcal, 0)

  const bySource = new Map<BurnSourceId, { sd: number; workoutIds: string[] }>()
  for (const w of known) {
    const g = bySource.get(w.source) ?? { sd: 0, workoutIds: [] }
    g.sd += w.kcal * workoutError(w)
    g.workoutIds.push(w.id)
    bySource.set(w.source, g)
  }
  const groups = [...bySource.entries()]
    .map(([source, g]) => ({ source, sd: g.sd, workoutIds: g.workoutIds }))
    .sort((a, b) =>
      Math.abs(a.sd - b.sd) > TIE_EPS ? b.sd - a.sd : BURN_SOURCE_IDS.indexOf(a.source) - BURN_SOURCE_IDS.indexOf(b.source),
    )
  const sd = Math.sqrt(groups.reduce((s, g) => s + g.sd * g.sd, 0))

  let e: number | null = null
  let score: number | null = null
  let likely: Range | null = null
  let veryLikely: Range | null = null
  if (knownTotal > 0) {
    e = sd / knownTotal
    score = scoreFromE(e)
    likely = rangeFromE(knownTotal, e, Z80)
    veryLikely = rangeFromE(knownTotal, e, Z95)
  }
  return { status, knownTotal, workoutCount: workouts.length, unknownWorkoutIds, sd, e, score, likely, veryLikely, groups }
}

/** A day's absolute spread: the root of the sum of its source groups' squared spreads (= e * X). */
export function daySd(day: Pick<DayEstimate, 'groups'>): number {
  return Math.sqrt(day.groups.reduce((s, g) => s + g.sd * g.sd, 0))
}

/** Normal range N +- z * sd, unrounded. Unlike a day's range it can run below 0. */
export function normalRange(total: number, sd: number, z: number): Range {
  return { lo: total - z * sd, hi: total + z * sd }
}

function hasKnown(status: DayStatus): boolean {
  return status === 'complete' || status === 'partial'
}

/** net.combine(): eaten minus burned, with its spread and normal ranges, and burned's own estimate. */
export function combine(eaten: DayEstimate, burned: BurnedEstimate): NetDay {
  const eatenSd = daySd(eaten)
  let net: NetEstimate | null = null
  if (hasKnown(eaten.status) && hasKnown(burned.status)) {
    const total = eaten.knownTotal - burned.knownTotal
    const sd = Math.sqrt(eatenSd * eatenSd + burned.sd * burned.sd)
    net = {
      total,
      sd,
      likely: normalRange(total, sd, Z80),
      veryLikely: normalRange(total, sd, Z95),
      score: null,
      knownOnly: eaten.status === 'partial' || burned.status === 'partial',
    }
  }
  return { eaten, eatenSd, burned, net }
}
