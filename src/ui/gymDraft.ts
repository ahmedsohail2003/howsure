// The gym sets' form state and its checks (build-out item 2.6, slice 26; prd.md > Gym Log), used
// inside the Log a workout sheet (WorkoutSheet.tsx, GymEditor.tsx). Pure: no React, no storage.
//
// - A session has a unit (kg or lb) and exercises; an exercise has a name and sets; a set has a
//   kind (warm-up, working or drop set), a weight, reps, and for a drop set its drops.
// - Reps are needed (a whole number from 1). A blank weight is a set with no weight typed, such as
//   a bodyweight set, never 0; a typed 0 is refused with a line saying to leave it blank.
// - Everything typed is kept while something blocks Save; only Save waits.
// - Switching the unit converts every weight already typed (withUnit), keeping its exact value in
//   kg, so switching back or saving changes nothing stored. A box that doesn't read as a number is
//   left as typed. Copy last session converts the copied weights into the unit chosen.
// - A weight or exercise name that was not changed keeps its stored value exactly, so an untouched
//   session saves back identical. Keys a later format adds to a session, an exercise, a set or a
//   drop (the saved log keeps them) ride along in `extra` and are saved back, so an edit never
//   drops them, a unit switch included.

import { liftWeightIn, toKg } from '../kernel/gym'
import { parseAmount } from '../kernel/parse'
import type { GymDrop, GymSession, GymSet, SetKind, WeightUnit } from '../kernel/types'
import { copy } from './copy'
import { fmtLiftWeight } from './gymView'

/** Keys of a stored gym object this format does not know, kept to be saved back unchanged. */
export type Extra = Record<string, unknown>

function extraOf(o: object, known: readonly string[]): Extra | undefined {
  const rest = Object.fromEntries(Object.entries(o).filter(([k]) => !known.includes(k)))
  return Object.keys(rest).length > 0 ? rest : undefined
}

/** The heaviest weight HowSure takes for one set: a typing slip guard, far above any lift. */
export const MAX_WEIGHT_KG = 1000
/** The most reps one set takes. */
export const MAX_REPS = 1000

export interface DropDraft {
  key: string
  weight: string
  reps: string
  /** The stored weight and the text it was shown as, so an unchanged weight keeps its value. */
  orig?: { kg: number | null; text: string; unit: WeightUnit }
  extra?: Extra
}

export interface SetDraft {
  key: string
  kind: SetKind
  weight: string
  reps: string
  /** A drop set's drops. Kept while the kind is changed and back, saved only on a drop set. */
  drops: DropDraft[]
  orig?: { kg: number | null; text: string; unit: WeightUnit }
  extra?: Extra
}

export interface ExerciseDraft {
  key: string
  name: string
  sets: SetDraft[]
  /** The stored name, kept exactly (spacing too) while the box still shows it. */
  origName?: string
  extra?: Extra
}

export interface GymDraft {
  unit: WeightUnit
  exercises: ExerciseDraft[]
  extra?: Extra
}

let counter = 0
/** A key for a new row, unique on this page (React list keys and focus targets). */
export function newKey(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

/** A weight as the form shows it: plain digits, up to 2 decimals, no grouping. "" for no weight. */
export function weightText(kg: number | null, unit: WeightUnit): string {
  return kg === null ? '' : String(liftWeightIn(kg, unit))
}

function repsText(reps: number): string {
  return String(reps)
}

export function blankSet(kind: SetKind = 'working'): SetDraft {
  return { key: newKey('set'), kind, weight: '', reps: '', drops: [] }
}

export function blankDrop(): DropDraft {
  return { key: newKey('drop'), weight: '', reps: '' }
}

export function blankExercise(): ExerciseDraft {
  return { key: newKey('exercise'), name: '', sets: [blankSet()] }
}

/** A new session's starting point: one exercise with one set, in the unit preferred. */
export function blankGymDraft(unit: WeightUnit): GymDraft {
  return { unit, exercises: [blankExercise()] }
}

function dropDraft(d: GymDrop, unit: WeightUnit, keepOrig: boolean): DropDraft {
  const text = weightText(d.weightKg, unit)
  return {
    key: newKey('drop'),
    weight: text,
    reps: repsText(d.reps),
    orig: keepOrig ? { kg: d.weightKg, text, unit } : undefined,
    extra: keepOrig ? extraOf(d, ['weightKg', 'reps']) : undefined,
  }
}

function setDraft(s: GymSet, unit: WeightUnit, keepOrig: boolean): SetDraft {
  const text = weightText(s.weightKg, unit)
  return {
    key: newKey('set'),
    kind: s.kind,
    weight: text,
    reps: repsText(s.reps),
    drops: (s.drops ?? []).map((d) => dropDraft(d, unit, keepOrig)),
    orig: keepOrig ? { kg: s.weightKg, text, unit } : undefined,
    extra: keepOrig ? extraOf(s, ['kind', 'weightKg', 'reps', 'drops']) : undefined,
  }
}

/** The form for a stored session, in the unit it was typed in, so it reads back as typed. */
export function draftFromGym(gym: GymSession): GymDraft {
  return {
    unit: gym.unit,
    exercises: gym.exercises.map((e) => ({
      key: newKey('exercise'),
      name: e.name,
      sets: e.sets.map((s) => setDraft(s, gym.unit, true)),
      origName: e.name,
      extra: extraOf(e, ['name', 'sets']),
    })),
    extra: extraOf(gym, ['unit', 'exercises']),
  }
}

/** Copy last session: its exercises and sets as a new session's starting point, in `unit`. */
export function draftCopiedFrom(gym: GymSession, unit: WeightUnit): GymDraft {
  return {
    unit,
    exercises: gym.exercises.map((e) => ({ key: newKey('exercise'), name: e.name, sets: e.sets.map((s) => setDraft(s, unit, false)) })),
  }
}

/** True while nothing has been typed in the sets (Copy last session is offered then). */
export function isBlankDraft(d: GymDraft): boolean {
  return d.exercises.every(
    (e) => e.name.trim() === '' && e.sets.every((s) => s.weight.trim() === '' && s.reps.trim() === '' && s.drops.length === 0),
  )
}

/**
 * Add set: a copy of the exercise's last set (kind, weight and reps, not its drops), since the
 * next set is most often the same again. With no set yet, a blank working set.
 */
export function withSetAdded(e: ExerciseDraft): ExerciseDraft {
  const last = e.sets[e.sets.length - 1]
  const next: SetDraft = last ? { key: newKey('set'), kind: last.kind, weight: last.weight, reps: last.reps, drops: [] } : blankSet()
  return { ...e, sets: [...e.sets, next] }
}

type WeightRow = { weight: string; orig?: DropDraft['orig'] }

/** One weight box shown in `to` instead of `from`; blank or not a number: as typed. */
function convertRow<T extends WeightRow>(row: T, from: WeightUnit, to: WeightUnit): T {
  const p = parseAmount(row.weight)
  if (p.kind !== 'value') return row
  const kg = row.orig && row.orig.unit === from && row.orig.text === row.weight ? row.orig.kg : toKg(p.value, from)
  if (kg === null) return row
  const text = weightText(kg, to)
  return { ...row, weight: text, orig: { kg, text, unit: to } }
}

/**
 * The unit choice: the form in `unit`, with every typed weight converted (80 kg reads 176.37 lb),
 * never a number reinterpreted in the new unit.
 */
export function withUnit(d: GymDraft, unit: WeightUnit): GymDraft {
  if (d.unit === unit) return d
  return {
    ...d,
    unit,
    exercises: d.exercises.map((e) => ({
      ...e,
      sets: e.sets.map((s) => ({ ...convertRow(s, d.unit, unit), drops: s.drops.map((x) => convertRow(x, d.unit, unit)) })),
    })),
  }
}

/** Errors are keyed by the row's key and the field: "set-3.weight", "exercise-1.name". */
export type GymErrors = Record<string, string>

export interface GymCheck {
  /** The session Save would store, or null while something blocks Save. */
  gym: GymSession | null
  errors: GymErrors
  /** Drops that are not lighter than the weight before them: said, not refused. Keyed like errors. */
  notes: GymErrors
}

type WeightResult = { ok: true; kg: number | null } | { ok: false; message: string }

function readWeight(text: string, unit: WeightUnit, orig: DropDraft['orig']): WeightResult {
  if (orig && orig.unit === unit && orig.text === text) return { ok: true, kg: orig.kg }
  const p = parseAmount(text)
  if (p.kind === 'unknown') return { ok: true, kg: null }
  if (p.kind === 'error') return { ok: false, message: p.message }
  if (p.value === 0) return { ok: false, message: copy.gym.weightZero }
  // Shown to 2 decimals: a weight that would read as 0 is a slip, never kept as a 0 on screen.
  if (Math.round(p.value * 100) === 0) return { ok: false, message: copy.gym.weightTooSmall }
  const kg = toKg(p.value, unit)
  // Said in the unit being typed: 1,000 kg, or 2,204.62 lb.
  if (kg > MAX_WEIGHT_KG) return { ok: false, message: copy.gym.weightTooBig(fmtLiftWeight(MAX_WEIGHT_KG, unit)) }
  return { ok: true, kg }
}

type RepsResult = { ok: true; reps: number } | { ok: false; message: string }

function readReps(text: string): RepsResult {
  const p = parseAmount(text)
  if (p.kind === 'unknown') return { ok: false, message: copy.gym.repsNeeded }
  if (p.kind === 'error') return { ok: false, message: p.message }
  if (!Number.isInteger(p.value) || p.value < 1 || p.value > MAX_REPS) return { ok: false, message: copy.gym.repsWhole }
  return { ok: true, reps: p.value }
}

export function checkGymDraft(draft: GymDraft): GymCheck {
  const errors: GymErrors = {}
  const notes: GymErrors = {}
  const exercises: GymSession['exercises'] = []
  if (draft.exercises.length === 0) errors.session = copy.gym.exerciseNeeded
  for (const e of draft.exercises) {
    // A typed name is tidied (spaces trimmed and single); a stored one left as it is stays exact.
    const name = e.origName !== undefined && e.name === e.origName ? e.name : e.name.trim().replace(/\s+/g, ' ')
    if (name.trim() === '') errors[`${e.key}.name`] = copy.gym.nameNeeded
    if (e.sets.length === 0) errors[`${e.key}.sets`] = copy.gym.setNeeded
    const sets: GymSet[] = []
    for (const s of e.sets) {
      const w = readWeight(s.weight, draft.unit, s.orig)
      const r = readReps(s.reps)
      if (!w.ok) errors[`${s.key}.weight`] = w.message
      if (!r.ok) errors[`${s.key}.reps`] = r.message
      const drops: GymDrop[] = []
      if (s.kind === 'drop') {
        let before = w.ok ? w.kg : null
        for (const d of s.drops) {
          const dw = readWeight(d.weight, draft.unit, d.orig)
          const dr = readReps(d.reps)
          if (!dw.ok) errors[`${d.key}.weight`] = dw.message
          if (!dr.ok) errors[`${d.key}.reps`] = dr.message
          if (dw.ok && dw.kg !== null && before !== null && dw.kg >= before) notes[`${d.key}.weight`] = copy.gym.dropNotLighter
          if (dw.ok && dr.ok) drops.push({ ...d.extra, weightKg: dw.kg, reps: dr.reps })
          before = dw.ok ? dw.kg : null
        }
      }
      if (w.ok && r.ok) {
        const set: GymSet = { ...s.extra, kind: s.kind, weightKg: w.kg, reps: r.reps }
        if (s.kind === 'drop' && s.drops.length > 0) set.drops = drops
        sets.push(set)
      }
    }
    exercises.push({ ...e.extra, name, sets })
  }
  if (Object.keys(errors).length > 0) return { gym: null, errors, notes }
  return { gym: { ...draft.extra, unit: draft.unit, exercises }, errors, notes }
}
