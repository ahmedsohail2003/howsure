// The estimated deficit or surplus under the headline, worked out once for every look (build-out
// item 2.5b; the owner's decision to show it when resting burn can be worked out from body details,
// always called an estimate). Each look draws these same numbers and words; none works anything out itself.
//
// - Shown only with age, sex, height and weight all known. Nothing is guessed: a missing input
//   leaves the line out, and one line invites adding what is missing.
// - Weight is the latest weigh-in up to the end of the day counted, when the log holds weigh-ins
//   (spec.md > Data Model: weighIns { id, at, kg }), else the weight typed in body details.
// - Age is the age typed, moved on by the whole years since it was typed (or back, for a day a
//   whole year or more before it was typed).
// - The hours counted run from the wake that started the day to the next wake, or to now on the
//   current day ("so far"), and never past now. The provisional day has no wake to count from, so it says so.
//   A current day whose wake is more than a day old while awake (wakeSet.ts > staleWakeDays, the
//   header's rule) isn't counted up to now either: it says the next wake is needed. Any day, earlier
//   or current, that runs for more than 36 hours (LONG_DAY_MS) isn't counted: a night is likely
//   missing, and one day's meals against days of resting burn would read as a huge deficit.
// - Eaten must have a known total. With none known the line is left out (kind 'hidden'): the
//   headline already says it is not available. Burned is treated the same way: a day whose
//   workouts all have unknown calories is left out too, never counted as 0 burned (net's headline
//   says it needs known calories for both). A day with no workouts counts 0 workouts. With some
//   known, meals and workouts with unknown calories are left out, and the line says it covers
//   known entries only.
// - Age, height and weight outside the Body details form's ranges, or an age that is not a whole
//   number (only a hand-edited or imported file can hold them), count as missing.
// - An age moved on or back to a day outside the form's 18-120 (an age typed as 18 counted back
//   to a day a year before) leaves the line out for that day (kind 'hidden'): the equation is not
//   fed an age the form would refuse.
// - The balance is eaten − burn, so below 0 is a deficit. The words turn it the plain way round:
//   "Estimated deficit 350 kcal", "Estimated surplus 120 kcal".
// Pure: no React.

import {
  ACTIVITY_FACTORS,
  DEFAULT_ACTIVITY,
  estimateBalance,
  hoursBetween,
  restingBurn,
  yearsSince,
  type ActivityLevel,
  type BalanceEstimate,
  type BodySex,
  type RestingBurn,
} from '../kernel/energy'
import { nextWakeAfter, sleepStatus } from '../kernel/sleepday'
import type { Range } from '../kernel/types'
import type { BodyDetails, LogDoc } from '../store/log'
import { copy } from './copy'
import type { DayView } from './dayView'
import { AGE_MAX, AGE_MIN, HEIGHT_CM_MAX, HEIGHT_CM_MIN, KG_PER_LB, WEIGHT_KG_MAX, WEIGHT_KG_MIN, WEIGHT_LB_MIN } from './body'
import { fmtInt, fmtPastWhen } from './format'
import { fmtDuration } from './sleepView'
import { staleWakeDays } from './wakeSet'

/** A waking day longer than this isn't counted as one day (a night is likely missing). */
export const LONG_DAY_MS = 36 * 60 * 60 * 1000

export type BodyField = 'age' | 'sex' | 'height' | 'weight'
export const BODY_FIELDS: readonly BodyField[] = ['age', 'sex', 'height', 'weight']

/**
 * `approx`: the weigh-in's time was not recorded (only its date). `when` says when it was, plain
 * enough to tell which day: "Tue 7:10 AM" this week, else with its date, the time left out when
 * it was not recorded (format.ts fmtPastWhen).
 */
export type WeightFrom = { from: 'profile' } | { from: 'weighIn'; at: string; approx: boolean; when: string }

/** A weigh-in as read from the log: weight in kg, when, and whether its time is approximate. */
export interface WeighInRead {
  kg: number
  at: string
  approx: boolean
}

export interface BalanceInputs {
  age: number
  sex: BodySex
  heightCm: number
  weightKg: number
  weightFrom: WeightFrom
  /** The units the body details were typed in, for showing them back the same way. */
  heightUnit: 'cm' | 'ftin' | undefined
  weightUnit: 'kg' | 'lb' | undefined
  activity: ActivityLevel
  /** True when the level is the default one, mostly sitting (picked or left as it was). */
  activityDefault: boolean
  factor: number
  /** The hours counted, from `from` to `to`. */
  from: string
  to: string
  hours: number
  /** True on the current day: `to` is now. */
  soFar: boolean
}

export type BalanceView =
  | { kind: 'invite'; missing: BodyField[]; text: string }
  | { kind: 'needsWake'; text: string }
  | { kind: 'hidden' }
  | {
      kind: 'shown'
      inputs: BalanceInputs
      resting: RestingBurn
      est: BalanceEstimate
      /** Eaten's known total and spread, and the logged workouts' (0 with none known). */
      eaten: number
      eatenSd: number
      workouts: number
      workoutsSd: number
      /** Rounded balance: below 0 a deficit, above 0 a surplus. */
      rounded: number
      direction: 'deficit' | 'surplus' | 'even'
      /** "Estimated deficit so far 350 kcal". */
      text: string
      /** "likely 120–580 kcal deficit". */
      likelyText: string
      veryLikelyText: string
      /** The ranges without their lead word: "120–580 kcal deficit". */
      likelyRange: string
      veryLikelyRange: string
      /** Night's short form: "likely 120–580 deficit". */
      likelyShort: string
      /** Unknown meals or workouts are left out. */
      knownOnly: boolean
      /** The button's accessible name, which says what it opens. */
      label: string
    }

function positive(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

/** 66 lb in kg as the form stores it (to three decimals, rounded down so 66 lb itself passes). */
const WEIGHT_LB_MIN_KG = Math.floor(WEIGHT_LB_MIN * KG_PER_LB * 1000) / 1000

/**
 * True when a stored value is inside the range the Body details form accepts (body.ts). A value
 * outside it (only a hand-edited or imported file can hold one) counts as missing, so the invite
 * line shows instead of an estimate worked out from a value the equation was never meant for.
 * Weight's lower end is the lb box's 66 lb in kg. Age must be a whole number, as the form takes it.
 */
export function bodyValueInRange(field: 'age' | 'height' | 'weight', v: unknown): v is number {
  if (!positive(v)) return false
  if (field === 'age') return Number.isInteger(v) && v >= AGE_MIN && v <= AGE_MAX
  if (field === 'height') return v >= HEIGHT_CM_MIN && v <= HEIGHT_CM_MAX
  return v >= Math.min(WEIGHT_KG_MIN, WEIGHT_LB_MIN_KG) && v <= WEIGHT_KG_MAX
}

/**
 * The latest weigh-in at or before `endIso`, read defensively: weigh-ins are a later item's
 * field (spec.md > Data Model: { id, at, kg }, optionally timeApproximate when only the date was
 * recorded), so anything that isn't { at, kg } with kg in the form's range is skipped.
 */
export function latestWeighIn(doc: LogDoc, endIso: string): WeighInRead | null {
  const list = (doc as { weighIns?: unknown }).weighIns
  if (!Array.isArray(list)) return null
  const end = Date.parse(endIso)
  let best: (WeighInRead & { t: number }) | null = null
  for (const w of list) {
    if (typeof w !== 'object' || w === null) continue
    const { at, kg, timeApproximate } = w as { at?: unknown; kg?: unknown; timeApproximate?: unknown }
    if (typeof at !== 'string' || !bodyValueInRange('weight', kg)) continue
    const t = Date.parse(at)
    if (Number.isNaN(t) || t > end) continue
    if (!best || t >= best.t) best = { kg, at, approx: timeApproximate === true, t }
  }
  return best ? { kg: best.kg, at: best.at, approx: best.approx } : null
}

/** When a weigh-in was, as the explanation's Weight row and the Body details hint both show it. */
export function weighInWhen(w: WeighInRead, nowIso: string): string {
  return fmtPastWhen(w.at, nowIso, !w.approx)
}

/**
 * Which of age, sex, height and weight are missing (weight counts a weigh-in). A value outside
 * the form's range counts as missing (bodyValueInRange).
 */
export function missingBodyFields(body: BodyDetails | undefined, hasWeighIn: boolean): BodyField[] {
  const b = body ?? {}
  const missing: BodyField[] = []
  if (!bodyValueInRange('age', b.age)) missing.push('age')
  if (b.sex !== 'female' && b.sex !== 'male' && b.sex !== 'unspecified') missing.push('sex')
  if (!bodyValueInRange('height', b.heightCm)) missing.push('height')
  if (!bodyValueInRange('weight', b.weightKg) && !hasWeighIn) missing.push('weight')
  return missing
}

/** "age, sex, height and weight", "height and weight", "weight". */
export function fieldList(fields: BodyField[]): string {
  const words = fields.map((f) => copy.balance.fields[f])
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')}${copy.balance.and}${words[words.length - 1]}`
}

/** Deficit-scale ends of a balance range (deficit = −balance), rounded. The week view (item 2.7) reads it too. */
export function rangeWords(r: Range, short: boolean): string {
  const dLo = Math.round(-r.hi)
  const dHi = Math.round(-r.lo)
  const unit = short ? '' : copy.balance.kcalSpace
  if (dLo >= 0) return copy.balance.rangeDeficit(fmtInt(dLo), fmtInt(dHi), unit)
  if (dHi <= 0) return copy.balance.rangeSurplus(fmtInt(-dHi), fmtInt(-dLo), unit)
  return copy.balance.rangeAcross(fmtInt(-dLo), fmtInt(dHi), unit)
}

/** The rounded balance's direction and the headline words. */
function headlineWords(rounded: number, soFar: boolean): { direction: 'deficit' | 'surplus' | 'even'; text: string } {
  if (rounded < 0) return { direction: 'deficit', text: copy.balance.deficit(fmtInt(-rounded), soFar) }
  if (rounded > 0) return { direction: 'surplus', text: copy.balance.surplus(fmtInt(rounded), soFar) }
  return { direction: 'even', text: copy.balance.even(soFar) }
}

/**
 * The estimated deficit or surplus for the viewed day. `nowIso` is the open log's now: the
 * current day counts up to it.
 */
export function balanceView(doc: LogDoc, view: DayView, nowIso: string, demo = false): BalanceView {
  const body = doc.profile.body
  // The day counts up to the next wake, or up to now when that is sooner (the current day, or a
  // wake logged ahead of the clock): burn is never counted for time that hasn't passed.
  const next = view.dayStart !== null ? nextWakeAfter(doc.sleeps, view.dayStart) : null
  const soFar = next === null || Date.parse(next) > Date.parse(nowIso)
  const end = soFar ? nowIso : (next as string)
  const weighIn = latestWeighIn(doc, end)
  const missing = missingBodyFields(body, weighIn !== null)
  if (missing.length > 0) {
    const list = fieldList(missing)
    return { kind: 'invite', missing, text: demo ? copy.balance.inviteDemo(list) : copy.balance.invite(list) }
  }
  const { day, eatenSd, burned } = view
  // No known calories eaten, or workouts logged but none with known calories: the headline
  // already says net is not available, so nothing more is added (neither is counted as 0).
  if (day.status !== 'complete' && day.status !== 'partial') return { kind: 'hidden' }
  if (burned.workoutCount > 0 && burned.status !== 'complete' && burned.status !== 'partial') return { kind: 'hidden' }
  if (view.dayStart === null) return { kind: 'needsWake', text: copy.balance.needsWake }
  // A current day whose wake is more than a day old while awake (an imported log, or nights not
  // added yet, build-out item 2.1b): counting burn up to now would add days of resting burn
  // against one day's meals, so nothing is estimated until the next wake is added. The header
  // uses the same rule (staleWakeDays), so the two never disagree.
  if (soFar && staleWakeDays(view.dayStart, nowIso, sleepStatus(doc.sleeps)) !== null) {
    return { kind: 'needsWake', text: copy.balance.staleWake }
  }
  // Any day that runs for more than 36 hours (an earlier day whose next wake came days later, as
  // after "Set today's wake time" on an old day, or the current day while asleep for long): a
  // night is likely missing, so its span isn't counted as one day.
  if (Date.parse(end) - Date.parse(view.dayStart) > LONG_DAY_MS) {
    return { kind: 'needsWake', text: copy.balance.longDay }
  }

  const b = body as Required<Pick<BodyDetails, 'age' | 'sex' | 'heightCm'>> & BodyDetails
  const activity = b.activity ?? DEFAULT_ACTIVITY
  const age = b.age + (b.ageSetOn ? yearsSince(b.ageSetOn, end) : 0)
  if (!bodyValueInRange('age', age)) return { kind: 'hidden' }
  const inputs: BalanceInputs = {
    age,
    sex: b.sex,
    heightCm: b.heightCm,
    weightKg: weighIn ? weighIn.kg : (b.weightKg as number),
    weightFrom: weighIn
      ? { from: 'weighIn', at: weighIn.at, approx: weighIn.approx, when: weighInWhen(weighIn, nowIso) }
      : { from: 'profile' },
    heightUnit: b.heightUnit,
    weightUnit: b.weightUnit,
    activity,
    activityDefault: activity === DEFAULT_ACTIVITY,
    factor: ACTIVITY_FACTORS[activity],
    from: view.dayStart,
    to: end,
    hours: hoursBetween(view.dayStart, end),
    soFar,
  }
  const resting = restingBurn({ kg: inputs.weightKg, cm: inputs.heightCm, age: inputs.age, sex: inputs.sex })
  // Here burned is complete, partial or has no workouts (0 and 0).
  const known = burned.status === 'complete' || burned.status === 'partial'
  const workouts = known ? burned.knownTotal : 0
  const workoutsSd = known ? burned.sd : 0
  const est = estimateBalance({
    eaten: day.knownTotal,
    eatenSd,
    workouts,
    workoutsSd,
    resting,
    factor: inputs.factor,
    hours: inputs.hours,
  })
  const rounded = Math.round(est.balance)
  const { direction, text } = headlineWords(rounded, soFar)
  const likelyRange = rangeWords(est.likely, false)
  const veryLikelyRange = rangeWords(est.veryLikely, false)
  const likelyText = copy.balance.likely(likelyRange)
  const knownOnly = day.status === 'partial' || burned.unknownWorkoutIds.length > 0
  return {
    kind: 'shown',
    inputs,
    resting,
    est,
    eaten: day.knownTotal,
    eatenSd,
    workouts,
    workoutsSd,
    rounded,
    direction,
    text,
    likelyText,
    veryLikelyText: copy.balance.veryLikely(veryLikelyRange),
    likelyRange,
    veryLikelyRange,
    likelyShort: copy.balance.likely(rangeWords(est.likely, true)),
    knownOnly,
    label: copy.balance.open(text, knownOnly ? `${likelyText}${copy.sep}${copy.balance.knownOnly}` : likelyText),
  }
}

/**
 * Build-out item 2.1b: the note for an ended waking day that ran for more than 36 hours (LONG_DAY_MS)
 * to its next wake, a night likely missing (a date joined to the day before after an import, say):
 * its meals, total and target share cover more than one day, so the dashboard says how long it ran.
 * Null for a day of ordinary length, a day still going on (the header speaks for that), the
 * provisional day, or a day with no meals.
 */
export function longDayNote(doc: LogDoc, view: DayView, nowIso: string): string | null {
  if (view.dayStart === null || view.meals.length === 0) return null
  const next = nextWakeAfter(doc.sleeps, view.dayStart)
  if (next === null || Date.parse(next) > Date.parse(nowIso)) return null
  const ms = Date.parse(next) - Date.parse(view.dayStart)
  if (!(ms > LONG_DAY_MS)) return null
  return copy.headline.longDay(fmtDuration(Math.round(ms / 60_000)))
}
