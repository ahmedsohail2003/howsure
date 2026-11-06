// What the gym log shows, worked out once for every look (build-out item 2.6, slice 26; prd.md >
// Gym Log). The dashboard's gym summary, a workout's sets in its details, and the gym log of every
// session all read these; each look only chooses how to draw them. Pure: no React.
//
// - Gym weights show in the unit of the latest gym session (gymUnitOf), so lifting in lb while
//   weighing in kg works: saving a session never changes the unit the weight log is shown in. With
//   no gym session yet, the weight log's unit (weightView.ts weightUnitOf) is the starting point.
// - "Previous best" is the best working set of that exercise in sessions that started earlier
//   (kernel/gym.ts exerciseHistoryBefore), with the date of that session. An exercise logged before
//   with no working set says so; only one never logged before is "first time logged".
// - Dates in the gym log always carry the calendar date (format.ts fmtDatedWhen), since it runs
//   across many dates.

import {
  exerciseHistoryBefore,
  gymSessions,
  isGymSession,
  liftWeightIn,
  sessionMatches,
  sessionSets,
  setCounts,
  topWorkingSet,
  type SetCounts,
} from '../kernel/gym'
import type { GymExercise, GymSession, GymSet, WeightUnit, Workout } from '../kernel/types'
import type { LogDoc } from '../store/log'
import { copy } from './copy'
import { fmtAmount, fmtDatedWhen, fmtInt, fmtTimeInDay } from './format'
import { weightUnitOf } from './weightView'

/**
 * The unit gym weights are shown in, and a new session starts in: the latest gym session's unit,
 * or with none yet, the weight log's. Kept apart from the weight log's own unit on purpose.
 */
export function gymUnitOf(doc: Pick<LogDoc, 'settings' | 'weighIns' | 'workouts'>): WeightUnit {
  return gymSessions(doc.workouts)[0]?.gym.unit ?? weightUnitOf(doc)
}

/** "80 kg", "176.37 lb", "1.25 kg": a gym weight to 2 decimals, so plates read as typed. */
export function fmtLiftWeight(kg: number, unit: WeightUnit): string {
  return copy.gym.weight(fmtAmount(liftWeightIn(kg, unit)), copy.gym.units[unit])
}

function partText(weightKg: number | null, reps: number, unit: WeightUnit): string {
  const r = fmtInt(reps)
  return weightKg === null ? copy.gym.setNoWeight(r) : copy.gym.setWeighted(fmtLiftWeight(weightKg, unit), r)
}

/** A set as text: "80 kg × 8", "12 reps, no weight logged", "60 kg × 10, then 45 kg × 8, then 30 kg × 6". */
export function setText(set: GymSet, unit: WeightUnit): string {
  const parts = [partText(set.weightKg, set.reps, unit)]
  if (set.kind === 'drop') for (const d of set.drops ?? []) parts.push(partText(d.weightKg, d.reps, unit))
  return parts.join(copy.gym.dropThen)
}

/** "7 sets (1 warm-up, 4 working, 2 drop sets)"; kinds with no set are left out. */
export function countsText(c: SetCounts): string {
  const kinds = (['warmup', 'working', 'drop'] as const).filter((k) => c[k] > 0).map((k) => copy.gym.kindCount[k](c[k]))
  return copy.gym.setsWithKinds(copy.gym.sets(c.total), kinds.join(copy.gym.countsJoin))
}

export interface SetRow {
  kind: GymSet['kind']
  /** "Warm-up", "Working", "Drop set". */
  kindLabel: string
  text: string
  /** False for a set with no weight logged ("12 reps, no weight logged"): words, not a figure. */
  weighted: boolean
}

export interface ExerciseView {
  name: string
  sets: SetRow[]
  /** "Previous best: 80 kg × 8 (Mon Oct 19)", the no-earlier-working-set line, or the first-time line. */
  best: string
}

export interface SessionView {
  workoutId: string
  name: string
  startedAt: string
  /** "Wed Oct 21, 6:30 PM". */
  when: string
  /** "3 exercises · 7 sets (1 warm-up, 4 working, 2 drop sets)". */
  counts: string
  exercises: ExerciseView[]
}

/**
 * An exercise's previous best, as said in the details, the gym log and the editor: the best working
 * set and its date; or, logged before with only warm-ups or drop sets, that no earlier working set
 * exists; or, never logged before, that this is the first time.
 */
export function bestLine(all: Workout[], name: string, before: string, excludeId: string, unit: WeightUnit, nowIso: string): string {
  const h = exerciseHistoryBefore(all, name, before, excludeId)
  if (h.best) return copy.gym.bestBefore(setText(h.best.set, unit), fmtDatedWhen(h.best.startedAt, nowIso, false))
  return h.seen ? copy.gym.bestNoWorking : copy.gym.bestFirst
}

function exerciseView(e: GymExercise, unit: WeightUnit, all: Workout[], w: Workout, nowIso: string): ExerciseView {
  return {
    name: e.name,
    sets: e.sets.map((s) => ({ kind: s.kind, kindLabel: copy.gym.kinds[s.kind], text: setText(s, unit), weighted: s.weightKg !== null })),
    best: bestLine(all, e.name, w.startedAt, w.id, unit, nowIso),
  }
}

function countsLine(gym: GymSession): string {
  return [copy.gym.exercises(gym.exercises.length), countsText(setCounts(sessionSets(gym)))].join(copy.sep)
}

/** One session with every set and each exercise's previous best. */
export function sessionView(w: Workout & { gym: GymSession }, all: Workout[], unit: WeightUnit, nowIso: string): SessionView {
  return {
    workoutId: w.id,
    name: w.name,
    startedAt: w.startedAt,
    when: fmtDatedWhen(w.startedAt, nowIso),
    counts: countsLine(w.gym),
    exercises: w.gym.exercises.map((e) => exerciseView(e, unit, all, w, nowIso)),
  }
}

/** The page size of the gym log: more sessions come in steps of this many. */
export const HISTORY_PAGE = 20

export interface GymHistory {
  /** Every gym session in the log. */
  total: number
  /** The sessions that match the search, newest first (all of them; the sheet shows a page at a time). */
  matches: (Workout & { gym: GymSession })[]
}

/** The gym log: every session, newest first, kept to those whose split or an exercise matches `query`. */
export function gymHistory(workouts: Workout[], query: string): GymHistory {
  const all = gymSessions(workouts)
  return { total: all.length, matches: all.filter((w) => sessionMatches(w, query)) }
}

export interface SummaryExercise {
  name: string
  /** "4 sets · Top working set 80 kg × 8". */
  text: string
}

export interface SummaryItem {
  workoutId: string
  name: string
  /** "6:30 PM · 3 exercises · 7 sets (…)". */
  meta: string
  exercises: SummaryExercise[]
  /** The row button's accessible name. */
  label: string
}

/** The dashboard's gym summary: the viewed day's gym sessions (none: an empty list, and nothing shows). */
export function gymSummary(dayWorkouts: Workout[], dayStart: string | null, unit: WeightUnit): SummaryItem[] {
  return dayWorkouts
    .filter(isGymSession)
    .map((w) => {
      const time = fmtTimeInDay(w.startedAt, dayStart)
      const sets = sessionSets(w.gym)
      const meta = copy.gym.summaryMeta(time, copy.gym.exercises(w.gym.exercises.length), copy.gym.sets(sets.length))
      const exercises = w.gym.exercises.map((e) => {
        const top = topWorkingSet(e.sets)
        return {
          name: e.name,
          text: [copy.gym.sets(e.sets.length), top ? copy.gym.topSet(setText(top, unit)) : copy.gym.noWorkingSet].join(copy.sep),
        }
      })
      return {
        workoutId: w.id,
        name: w.name,
        meta,
        exercises,
        // Every exercise line is in it too, since the label replaces the row's visible text.
        label: copy.gym.summaryLabel(
          w.name,
          meta,
          exercises.map((e) => copy.gym.summaryExerciseLabel(e.name, e.text)).join(' '),
        ),
      }
    })
}
