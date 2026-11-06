// The Log a workout sheet's form state and its checks (build-out item 2.5a, slice 10; prd.md >
// Workouts and Net Calories): name, how you know, calories burned, start date and time, and
// duration. Blank calories and duration are unknown (null), never 0; "How do you know?" has no
// default, and known calories need it, as for a meal. Pure: no React, no storage.
// Build-out item 2.6 (slice 26): the same sheet holds a workout's gym sets (gymDraft.ts), so a gym
// session is a workout like any other, with its burned calories and source beside its sets.

import { parseAmount } from '../kernel/parse'
import type { BurnSourceId, Parsed, Workout } from '../kernel/types'
import type { LogDoc } from '../store/log'
import { copy } from './copy'
import { fromLocalInput, toLocalInput } from './editMeal'
import { checkGymDraft, draftFromGym, type GymCheck, type GymDraft } from './gymDraft'

export interface WorkoutDraft {
  name: string
  source: BurnSourceId | null
  kcal: string
  startedAtLocal: string // a datetime-local value, "YYYY-MM-DDTHH:MM", in local time
  minutes: string
  /** The gym sets (build-out item 2.6), or null for a workout without them. */
  gym: GymDraft | null
}

export type WorkoutField = 'name' | 'source' | 'kcal' | 'startedAt' | 'minutes' | 'gym'

export interface WorkoutCheck {
  /** The workout Save would store, or null while something blocks Save. */
  workout: Workout | null
  /** Inline errors by field. Everything typed is kept; only Save is blocked. */
  errors: Partial<Record<WorkoutField, string>>
  /** The gym sets' own check, row by row (null without gym sets). */
  gym: GymCheck | null
}

/** A new workout's id: random, so two devices or two tabs never pick the same one. */
export function newWorkoutId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return `workout-${c.randomUUID()}`
  return `workout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** The starting point for Log a workout: nothing filled in but the start time. */
export function blankWorkout(id: string, startedAt: string): Workout {
  return { id, name: '', startedAt, minutes: null, kcal: null, source: null }
}

function amountText(v: number | null): string {
  return v === null ? '' : String(v)
}

export function draftFromWorkout(w: Workout): WorkoutDraft {
  return {
    name: w.name,
    source: w.source,
    kcal: amountText(w.kcal),
    startedAtLocal: toLocalInput(w.startedAt),
    minutes: amountText(w.minutes),
    gym: w.gym ? draftFromGym(w.gym) : null,
  }
}

function valueOf(p: Parsed): number | null {
  return p.kind === 'value' ? p.value : null
}

export function checkWorkoutDraft(draft: WorkoutDraft, original: Workout): WorkoutCheck {
  const errors: WorkoutCheck['errors'] = {}
  const kcal = parseAmount(draft.kcal)
  const minutes = parseAmount(draft.minutes)
  if (kcal.kind === 'error') errors.kcal = kcal.message
  if (minutes.kind === 'error') errors.minutes = minutes.message
  else if (minutes.kind === 'value' && minutes.value === 0) errors.minutes = copy.workouts.durationZero
  const name = draft.name.trim()
  if (name === '') errors.name = copy.workouts.nameNeeded
  if (draft.source === null && kcal.kind === 'value') errors.source = copy.workouts.pickSourceHint
  // Keep the stored time as it was unless the field was changed, so an untouched workout stays identical.
  const startedAt =
    draft.startedAtLocal === toLocalInput(original.startedAt) ? original.startedAt : fromLocalInput(draft.startedAtLocal)
  if (startedAt === null) errors.startedAt = copy.workouts.startNeeded
  const gym = draft.gym ? checkGymDraft(draft.gym) : null
  if (gym && gym.gym === null) errors.gym = copy.gym.fixToSave
  if (Object.keys(errors).length > 0 || startedAt === null) return { workout: null, errors, gym }
  const { gym: _dropped, ...rest } = original
  void _dropped
  const workout: Workout = { ...rest, name, source: draft.source, kcal: valueOf(kcal), startedAt, minutes: valueOf(minutes) }
  if (gym?.gym) workout.gym = gym.gym
  return { workout, errors, gym }
}

/** The log with one workout saved: replaced in place when its id is there (Edit), else added. */
export function withWorkout(doc: LogDoc, w: Workout): LogDoc {
  if (!doc.workouts.some((x) => x.id === w.id)) return { ...doc, workouts: [...doc.workouts, w] }
  return { ...doc, workouts: doc.workouts.map((x) => (x.id === w.id ? w : x)) }
}

/** The log without one workout (Delete). Burned and net are recomputed from what is left. */
export function withoutWorkout(doc: LogDoc, workoutId: string): LogDoc {
  return { ...doc, workouts: doc.workouts.filter((w) => w.id !== workoutId) }
}
