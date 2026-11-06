// The body-details form's state and checks (build-out item 2.5b; store/log.ts BodyDetails).
// Numbers are read with the kernel's parseAmount. A blank box is not set and is stored as no key,
// never as 0 and never guessed. Height is stored in cm and weight in kg, with the unit each was
// typed in, so the form shows them the same way again. Pure: no React, no storage.

import { ACTIVITY_LEVELS, DEFAULT_ACTIVITY, yearsSince, type ActivityLevel, type BodySex } from '../kernel/energy'
import { parseAmount } from '../kernel/parse'
import { LB_TO_KG } from '../kernel/weight'
import type { BodyDetails, LogDoc, Profile } from '../store/log'
import { copy } from './copy'

export const CM_PER_INCH = 2.54
/** kg in one pound, exactly: the kernel's constant (kernel/weight.ts), so there is one. */
export const KG_PER_LB = LB_TO_KG

export const AGE_MIN = 18
export const AGE_MAX = 120
export const HEIGHT_CM_MIN = 100
export const HEIGHT_CM_MAX = 250
/** 3 ft 4 in to 8 ft 2 in. */
export const HEIGHT_IN_MIN = 40
export const HEIGHT_IN_MAX = 98
export const WEIGHT_KG_MIN = 30
export const WEIGHT_KG_MAX = 300
export const WEIGHT_LB_MIN = 66
export const WEIGHT_LB_MAX = 660
/** The inches box, as its message says: 0 to 11.9. */
export const INCHES_MAX = 11.9

export const SEXES: readonly BodySex[] = ['female', 'male', 'unspecified']
export { ACTIVITY_LEVELS }

export interface BodyFields {
  age: string
  sex: BodySex | null
  heightUnit: 'cm' | 'ftin'
  heightCm: string
  heightFt: string
  heightIn: string
  weightUnit: 'kg' | 'lb'
  weight: string
  /**
   * Set when the weight unit is switched: the box's text before the switch and what it was turned
   * into. Switching back with the box unchanged puts the first text back, so a round trip of
   * units never moves the number.
   */
  weightBefore?: { unit: 'kg' | 'lb'; text: string; shown: string }
  activity: ActivityLevel
}

export type BodyFieldKey = 'age' | 'heightCm' | 'heightFt' | 'heightIn' | 'weight'

export interface BodyCheck {
  /** What Save would store, or null while a box has an error. */
  body: BodyDetails | null
  errors: Partial<Record<BodyFieldKey, string>>
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places

type Num = { kind: 'none' } | { kind: 'value'; value: number } | { kind: 'error'; message: string }

function num(text: string): Num {
  const s = (text ?? '').trim()
  // A minus sign is refused by parseAmount; say what range is wanted instead.
  const p = parseAmount(s.startsWith('-') || s.startsWith('−') ? 'x' : s)
  if (p.kind === 'unknown') return { kind: 'none' }
  if (p.kind === 'error') return { kind: 'error', message: p.message }
  return { kind: 'value', value: p.value }
}

/** `todayDate` (YYYY-MM-DD) is stored with a typed age, so the age moves on with time. */
export function checkBody(fields: BodyFields, todayDate: string): BodyCheck {
  const errors: BodyCheck['errors'] = {}
  const body: BodyDetails = {}

  const age = num(fields.age)
  if (age.kind === 'error') errors.age = copy.body.errors.age
  else if (age.kind === 'value') {
    if (!Number.isInteger(age.value) || age.value < AGE_MIN || age.value > AGE_MAX) errors.age = copy.body.errors.age
    else {
      body.age = age.value
      body.ageSetOn = todayDate
    }
  }

  if (fields.sex) body.sex = fields.sex

  if (fields.heightUnit === 'cm') {
    const h = num(fields.heightCm)
    if (h.kind === 'error' || (h.kind === 'value' && (h.value < HEIGHT_CM_MIN || h.value > HEIGHT_CM_MAX))) {
      errors.heightCm = copy.body.errors.heightCm
    } else if (h.kind === 'value') {
      body.heightCm = h.value
      body.heightUnit = 'cm'
    }
  } else {
    const ft = num(fields.heightFt)
    const inch = num(fields.heightIn)
    if (inch.kind === 'error' || (inch.kind === 'value' && inch.value > INCHES_MAX)) errors.heightIn = copy.body.errors.inches
    if (ft.kind === 'error') errors.heightFt = copy.body.errors.heightFtIn
    else if (ft.kind === 'none' && inch.kind === 'value' && !errors.heightIn) errors.heightFt = copy.body.errors.feetMissing
    else if (ft.kind === 'value' && !errors.heightIn) {
      const total = ft.value * 12 + (inch.kind === 'value' ? inch.value : 0)
      if (total < HEIGHT_IN_MIN || total > HEIGHT_IN_MAX) errors.heightFt = copy.body.errors.heightFtIn
      else {
        body.heightCm = round(total * CM_PER_INCH, 2)
        body.heightUnit = 'ftin'
      }
    }
  }

  const w = num(fields.weight)
  const [lo, hi] = fields.weightUnit === 'kg' ? [WEIGHT_KG_MIN, WEIGHT_KG_MAX] : [WEIGHT_LB_MIN, WEIGHT_LB_MAX]
  if (w.kind === 'error' || (w.kind === 'value' && (w.value < lo || w.value > hi))) {
    errors.weight = fields.weightUnit === 'kg' ? copy.body.errors.weightKg : copy.body.errors.weightLb
  } else if (w.kind === 'value') {
    body.weightKg = fields.weightUnit === 'kg' ? w.value : round(w.value * KG_PER_LB, 3)
    body.weightUnit = fields.weightUnit
  }

  body.activity = fields.activity
  return { body: Object.keys(errors).length > 0 ? null : body, errors }
}

/** Inches as feet and inches, the inches to one decimal (12 rounds up into the feet). */
export function feetInches(cm: number): { ft: number; inches: number } {
  const total = round(cm / CM_PER_INCH, 1)
  let ft = Math.floor(total / 12)
  let inches = round(total - ft * 12, 1)
  if (inches >= 12) {
    ft += 1
    inches = 0
  }
  return { ft, inches }
}

export function kgToLb(kg: number): number {
  return round(kg / KG_PER_LB, 1)
}

/** The form's starting text from what is stored; the age is moved on to `atIso`. */
export function fieldsFromBody(body: BodyDetails | undefined, atIso: string): BodyFields {
  const b = body ?? {}
  const heightUnit = b.heightUnit ?? 'cm'
  const weightUnit = b.weightUnit ?? 'kg'
  const fi = typeof b.heightCm === 'number' ? feetInches(b.heightCm) : null
  return {
    age: typeof b.age === 'number' ? String(b.age + (b.ageSetOn ? Math.max(0, yearsSince(b.ageSetOn, atIso)) : 0)) : '',
    sex: b.sex ?? null,
    heightUnit,
    heightCm: typeof b.heightCm === 'number' ? String(round(b.heightCm, 1)) : '',
    heightFt: fi ? String(fi.ft) : '',
    heightIn: fi ? String(fi.inches) : '',
    weightUnit,
    weight: typeof b.weightKg === 'number' ? String(weightUnit === 'kg' ? round(b.weightKg, 1) : kgToLb(b.weightKg)) : '',
    activity: b.activity ?? DEFAULT_ACTIVITY,
  }
}

/**
 * The form with the height unit switched. The amount in the box is carried over: cm become feet
 * and inches (to one decimal), and feet and inches become cm (to one decimal). When the cm box
 * already holds what the feet and inches show (they came from it and were not changed), it is
 * kept as it was. A blank or unreadable box, or one whose amount the form refuses (5 ft 12 in,
 * 300 cm), leaves the other unit's boxes blank: a refused amount never turns into an accepted one,
 * and the boxes never hold an older value that Save would store.
 */
export function withHeightUnit(fields: BodyFields, unit: 'cm' | 'ftin'): BodyFields {
  if (fields.heightUnit === unit) return fields
  if (unit === 'ftin') {
    const h = num(fields.heightCm)
    if (h.kind !== 'value' || h.value < HEIGHT_CM_MIN || h.value > HEIGHT_CM_MAX) return { ...fields, heightUnit: unit, heightFt: '', heightIn: '' }
    const fi = feetInches(h.value)
    return { ...fields, heightUnit: unit, heightFt: String(fi.ft), heightIn: String(fi.inches) }
  }
  const ft = num(fields.heightFt)
  const inch = num(fields.heightIn)
  const inches = inch.kind === 'value' ? inch.value : 0
  const refused =
    ft.kind !== 'value' ||
    inch.kind === 'error' ||
    inches > INCHES_MAX ||
    ft.value * 12 + inches < HEIGHT_IN_MIN ||
    ft.value * 12 + inches > HEIGHT_IN_MAX
  if (refused) return { ...fields, heightUnit: unit, heightCm: '' }
  const cm = num(fields.heightCm)
  if (cm.kind === 'value') {
    const fi = feetInches(cm.value)
    if (fi.ft === ft.value && fi.inches === inches) return { ...fields, heightUnit: unit }
  }
  return { ...fields, heightUnit: unit, heightCm: String(round((ft.value * 12 + inches) * CM_PER_INCH, 1)) }
}

/**
 * The form with the weight unit switched, the amount in the box converted (kg to lb or lb to kg,
 * to one decimal). Switching back without changing the box puts its earlier text back. A blank
 * or unreadable box, or an amount outside the box's range, is left blank (so 29.95 kg, which the
 * kg box refuses, never becomes an accepted 66 lb).
 */
export function withWeightUnit(fields: BodyFields, unit: 'kg' | 'lb'): BodyFields {
  if (fields.weightUnit === unit) return fields
  const before = fields.weightBefore
  if (before && before.unit === unit && before.shown === fields.weight.trim()) {
    return { ...fields, weightUnit: unit, weight: before.text, weightBefore: undefined }
  }
  const w = num(fields.weight)
  const [lo, hi] = fields.weightUnit === 'kg' ? [WEIGHT_KG_MIN, WEIGHT_KG_MAX] : [WEIGHT_LB_MIN, WEIGHT_LB_MAX]
  const ok = w.kind === 'value' && w.value >= lo && w.value <= hi
  const shown = ok ? String(unit === 'lb' ? kgToLb(w.value) : round(w.value * KG_PER_LB, 1)) : ''
  return {
    ...fields,
    weightUnit: unit,
    weight: shown,
    weightBefore: shown === '' ? undefined : { unit: fields.weightUnit, text: fields.weight, shown },
  }
}

/** Every box blank, nothing picked, the default activity. */
export function clearedFields(current: BodyFields): BodyFields {
  return {
    ...current,
    age: '',
    sex: null,
    heightCm: '',
    heightFt: '',
    heightIn: '',
    weight: '',
    weightBefore: undefined,
    activity: DEFAULT_ACTIVITY,
  }
}

/**
 * The log with its body details replaced. Keys a later version adds inside `body` are kept; the
 * form's own keys are replaced (a cleared box removes its key). With nothing left but the default
 * activity, `body` is removed. The log passed in is not changed.
 */
export function withBody(doc: LogDoc, next: BodyDetails): LogDoc {
  const OWN = ['age', 'ageSetOn', 'sex', 'heightCm', 'heightUnit', 'weightKg', 'weightUnit', 'activity'] as const
  const merged: Record<string, unknown> = { ...(doc.profile.body ?? {}) }
  for (const k of OWN) {
    if (next[k] === undefined) delete merged[k]
    else merged[k] = next[k]
  }
  // Only the default activity, with nothing else set: nothing to keep.
  const onlyDefault = Object.keys(merged).every((k) => k === 'activity') && (merged.activity ?? DEFAULT_ACTIVITY) === DEFAULT_ACTIVITY
  const profile: Profile = { ...doc.profile }
  if (Object.keys(merged).length > 0 && !onlyDefault) profile.body = merged as BodyDetails
  else delete profile.body
  return { ...doc, profile }
}

/** True when at least one body detail is set (the default activity alone doesn't count). */
export function hasBody(body: BodyDetails | undefined): boolean {
  if (!body) return false
  return ['age', 'sex', 'heightCm', 'weightKg'].some((k) => (body as Record<string, unknown>)[k] !== undefined) || (body.activity ?? DEFAULT_ACTIVITY) !== DEFAULT_ACTIVITY
}

const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, useGrouping: true })

/** "168 cm" or "5 ft 6.1 in", in the unit it was typed in. */
export function heightText(cm: number, unit: 'cm' | 'ftin' | undefined): string {
  if (unit === 'ftin') {
    const { ft, inches } = feetInches(cm)
    return copy.body.ftInValue(String(ft), oneDecimal.format(inches))
  }
  return copy.body.cmValue(oneDecimal.format(cm))
}

/** "64 kg" or "141.1 lb". */
export function weightText(kg: number, unit: 'kg' | 'lb' | undefined): string {
  return unit === 'lb' ? copy.body.lbValue(oneDecimal.format(kgToLb(kg))) : copy.body.kgValue(oneDecimal.format(kg))
}

/**
 * The age the form shows and the stored age: when the box still holds the age shown at the
 * start, the stored age and the date it was typed are kept, so saving other changes doesn't
 * restart its clock.
 */
export function keepAge(next: BodyDetails, previous: BodyDetails | undefined, startAgeText: string, ageText: string): BodyDetails {
  if (previous?.age !== undefined && next.age !== undefined && ageText.trim() === startAgeText.trim()) {
    const kept: BodyDetails = { ...next, age: previous.age }
    if (previous.ageSetOn !== undefined) kept.ageSetOn = previous.ageSetOn
    else delete kept.ageSetOn
    return kept
  }
  return next
}

/**
 * What Save stores, with every box still holding its starting text kept exactly as it was stored.
 * The form shows height and weight to one decimal (168.25 cm shows as 168.3, 64.07 kg as 141.2 lb),
 * so storing what the box shows would move a stored value that was never edited. Age keeps its
 * date as keepAge says. Height is kept when its unit and box (or both boxes) are unchanged, and
 * weight when its unit and box are.
 */
export function keepUnchanged(next: BodyDetails, previous: BodyDetails | undefined, start: BodyFields, fields: BodyFields): BodyDetails {
  const kept: BodyDetails = { ...keepAge(next, previous, start.age, fields.age) }
  const same = (a: string, b: string) => a.trim() === b.trim()
  const heightSame =
    fields.heightUnit === start.heightUnit &&
    (fields.heightUnit === 'cm'
      ? same(fields.heightCm, start.heightCm)
      : same(fields.heightFt, start.heightFt) && same(fields.heightIn, start.heightIn))
  if (heightSame && previous?.heightCm !== undefined && kept.heightCm !== undefined) kept.heightCm = previous.heightCm
  const weightSame = fields.weightUnit === start.weightUnit && same(fields.weight, start.weight)
  if (weightSame && previous?.weightKg !== undefined && kept.weightKg !== undefined) kept.weightKg = previous.weightKg
  return kept
}

/**
 * Profile and privacy's one-line summary: "age 34 · Female · 168 cm · 64 kg · Mostly sitting",
 * with only what is set; null when nothing is.
 */
export function bodySummary(body: BodyDetails | undefined, atIso: string): string | null {
  if (!hasBody(body)) return null
  const b = body as BodyDetails
  const parts: string[] = []
  if (typeof b.age === 'number') parts.push(copy.body.ageValue(String(b.age + (b.ageSetOn ? Math.max(0, yearsSince(b.ageSetOn, atIso)) : 0))))
  if (b.sex) parts.push(copy.body.sexOptions[b.sex])
  if (typeof b.heightCm === 'number') parts.push(heightText(b.heightCm, b.heightUnit))
  if (typeof b.weightKg === 'number') parts.push(weightText(b.weightKg, b.weightUnit))
  parts.push(copy.body.activityOptions[b.activity ?? DEFAULT_ACTIVITY])
  return parts.join(copy.sep)
}
