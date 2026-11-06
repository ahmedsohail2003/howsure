// The gym log's set model (build-out item 2.6, slice 26; prd.md > Gym Log; spec.md > Other Tier 3
// Pieces). A gym session is a workout's `gym` part: exercises, each with sets of a kind (warm-up,
// working or drop set), a weight and reps, and for a drop set its drops. Pure: no React, no
// storage, no clock reads.
//
// - Weights are kept in kg, converted by weight.ts (1 lb = 0.45359237 kg exactly); a gym weight is
//   shown to 2 decimals, so a typed 225 lb or 1.25 kg reads back as typed.
// - A blank weight is a set with no weight typed (a bodyweight set), never 0.
// - The best working set of an exercise is the heaviest working set, and the most reps at that
//   weight. Warm-ups and drop sets are left out, and so are sets with no weight while any set of
//   that exercise has one. With no weighted working set at all, the most reps wins. No formula
//   (such as an estimated one-rep maximum) is used, so nothing here is an estimate.
// - An exercise is the same exercise in every session when its name matches, ignoring case and
//   extra spaces.

import type { GymSession, GymSet, SetKind, WeightUnit, Workout } from './types'
import { fromKg } from './weight'

export { toKg } from './weight'

export const SET_KINDS: readonly SetKind[] = ['warmup', 'working', 'drop']

/** A gym weight in kg, in `unit`, rounded to 2 decimals (so a typed 225 lb reads back as 225). */
export function liftWeightIn(kg: number, unit: WeightUnit): number {
  return Math.round(fromKg(kg, unit) * 100) / 100
}

/** The name an exercise is matched by: lower case, spaces trimmed and collapsed. */
export function exerciseKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** A workout with gym sets: at least one exercise. */
export function isGymSession(w: Workout): w is Workout & { gym: GymSession } {
  return w.gym !== undefined && w.gym.exercises.length > 0
}

function time(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

// gymSessions is read for every exercise shown (each one's previous best), on every render. A log's
// workouts array is never changed in place (ui/editWorkout.ts makes a new one for each change), so
// the sorted list is kept per array and worked out once (and again if its length ever changes).
const sortedCache = new WeakMap<Workout[], { length: number; sorted: (Workout & { gym: GymSession })[] }>()

/** Every gym session in the log, newest first (same start: by id, so the order is stable). */
export function gymSessions(workouts: Workout[]): (Workout & { gym: GymSession })[] {
  const cached = sortedCache.get(workouts)
  if (cached && cached.length === workouts.length) return cached.sorted
  const sorted = workouts
    .filter(isGymSession)
    .map((w) => ({ w, t: time(w.startedAt) }))
    .sort((a, b) => b.t - a.t || (a.w.id < b.w.id ? -1 : a.w.id > b.w.id ? 1 : 0))
    .map((x) => x.w)
  sortedCache.set(workouts, { length: workouts.length, sorted })
  return sorted
}

export interface SetCounts {
  warmup: number
  working: number
  drop: number
  total: number
}

/** How many sets of each kind (a drop set counts once, however many drops it has). */
export function setCounts(sets: GymSet[]): SetCounts {
  const c: SetCounts = { warmup: 0, working: 0, drop: 0, total: sets.length }
  for (const s of sets) c[s.kind] += 1
  return c
}

/** Every set of a session, across its exercises. */
export function sessionSets(gym: GymSession): GymSet[] {
  return gym.exercises.flatMap((e) => e.sets)
}

/** True when set `a` beats set `b`: heavier, or as heavy with more reps. No weight is below any weight. */
function beats(a: GymSet, b: GymSet): boolean {
  const wa = a.weightKg ?? Number.NEGATIVE_INFINITY
  const wb = b.weightKg ?? Number.NEGATIVE_INFINITY
  if (wa !== wb) return wa > wb
  return a.reps > b.reps
}

/** The best working set among `sets`, or null when none is a working set. */
export function topWorkingSet(sets: GymSet[]): GymSet | null {
  let best: GymSet | null = null
  for (const s of sets) if (s.kind === 'working' && (best === null || beats(s, best))) best = s
  return best
}

export interface BestSet {
  set: GymSet
  workoutId: string
  startedAt: string
}

export interface ExerciseHistory {
  /** The best working set before, or null when no earlier session has a working set of it. */
  best: BestSet | null
  /** True when an earlier session logged this exercise at all, with or without a working set. */
  seen: boolean
}

/**
 * An exercise in the sessions that started before `before` (an ISO time), leaving out the workout
 * `excludeId` (the session being looked at): its best working set, and whether it was logged at
 * all. Equal sets: the most recent session's.
 */
export function exerciseHistoryBefore(
  workouts: Workout[],
  exerciseName: string,
  before: string,
  excludeId?: string,
): ExerciseHistory {
  const key = exerciseKey(exerciseName)
  if (key === '') return { best: null, seen: false }
  const limit = time(before)
  let best: BestSet | null = null
  let seen = false
  // Newest first, so on a tie the first one found (the most recent) is kept.
  for (const w of gymSessions(workouts)) {
    if (w.id === excludeId || !(time(w.startedAt) < limit)) continue
    for (const e of w.gym.exercises) {
      if (exerciseKey(e.name) !== key) continue
      seen = true
      const top = topWorkingSet(e.sets)
      if (top && (best === null || beats(top, best.set))) best = { set: top, workoutId: w.id, startedAt: w.startedAt }
    }
  }
  return { best, seen }
}

/** The best working set of an exercise before `before` (exerciseHistoryBefore), or null. */
export function bestWorkingSetBefore(
  workouts: Workout[],
  exerciseName: string,
  before: string,
  excludeId?: string,
): BestSet | null {
  return exerciseHistoryBefore(workouts, exerciseName, before, excludeId).best
}

/** True when the session's name (its split) or any exercise name contains the search words. */
export function sessionMatches(w: Workout, query: string): boolean {
  const q = exerciseKey(query)
  if (q === '') return true
  if (exerciseKey(w.name).includes(q)) return true
  return (w.gym?.exercises ?? []).some((e) => exerciseKey(e.name).includes(q))
}

/**
 * The session "Copy last session" starts from: the latest gym session that started before
 * `before` or at it, leaving out `excludeId`. When the new session already has a name and an earlier
 * session has the same name (its split, such as "Push"), the latest of those is used instead.
 */
export function lastSession(
  workouts: Workout[],
  name: string,
  before: string,
  excludeId?: string,
): (Workout & { gym: GymSession }) | null {
  const limit = time(before)
  // At the same minute counts too: a session logged a moment ago is the last one.
  const earlier = gymSessions(workouts).filter((w) => w.id !== excludeId && time(w.startedAt) <= limit)
  const key = exerciseKey(name)
  const sameName = key === '' ? undefined : earlier.find((w) => exerciseKey(w.name) === key)
  return sameName ?? earlier[0] ?? null
}
