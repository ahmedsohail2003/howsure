// Resting burn and the estimated deficit or surplus (build-out item 2.5b; spec.md > Maths Core:
// Energy Balance). Shown only when resting burn can be worked out from body details, and always called an estimate.
//
// - Resting burn: the Mifflin-St Jeor equation, 10 × kg + 6.25 × cm − 5 × age + s, with s = +5 for
//   men and −161 for women. "Prefer not to say" uses the midpoint of the two (−78) and widens the
//   spread as if the real value could sit anywhere between them: a uniform spread over 166 kcal,
//   whose sd is 166 / √12 = 47.9 kcal.
// - The equation's own typical error is 10% of resting burn (an assumption; its nearest study is
//   in RESTING_BASIS below).
// - Everyday activity, not counting workouts: resting burn × a factor (1.2 mostly sitting by
//   default, 1.375 or 1.55). Logged workouts are added on top, so they are counted once.
// - Time: a day's burn is spread evenly over 24 hours and counted from the wake that started the
//   waking day, up to the next wake (an earlier day) or up to now (today, "so far"). A waking day
//   that runs 26 hours counts 26 hours of burn, as its meals cover 26 hours too.
// - Balance = eaten − (resting × factor × hours / 24 + logged workouts). Below 0 is a deficit,
//   above 0 a surplus. Its sd is √(sd_eaten² + sd_workouts² + sd_rest²), where sd_rest is the
//   equation's error (and the sex midpoint's spread) carried through the same factor and share.
//   Ranges are normal, like net's: balance ± 1.2816 sd and ± 1.96 sd.
// - The spread of the activity factor itself is not in the range: it is the person's own pick.
//   The explanation says so.
// Pure: no React, no storage, no clock reads.

import { Z80, Z95 } from './estimate'
import { normalRange } from './net'
import type { Range, SourceBasis } from './types'

export type BodySex = 'female' | 'male' | 'unspecified'
export type ActivityLevel = 'sitting' | 'light' | 'moderate'

/** The activity levels, in the order the form lists them. The first is the default. */
export const ACTIVITY_LEVELS: readonly ActivityLevel[] = ['sitting', 'light', 'moderate']
export const DEFAULT_ACTIVITY: ActivityLevel = 'sitting'

/** Everyday-activity factors on resting burn, not counting workouts (conventional multipliers). */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = { sitting: 1.2, light: 1.375, moderate: 1.55 }

/** Mifflin-St Jeor's sex constants, and the midpoint used for "prefer not to say". */
export const SEX_CONSTANTS = { male: 5, female: -161 } as const
export const SEX_MIDPOINT = (SEX_CONSTANTS.male + SEX_CONSTANTS.female) / 2 // −78
/** The spread of a value anywhere between the two constants: uniform over 166 kcal, sd 166 / √12. */
export const SEX_SPREAD_SD = (SEX_CONSTANTS.male - SEX_CONSTANTS.female) / Math.sqrt(12)

/** The equation's typical error as a fraction of resting burn. */
export const RESTING_TYPICAL_ERROR = 0.1

/** Where the 10% comes from: an assumption, with its nearest study (re-opened on PubMed). */
export const RESTING_BASIS: SourceBasis & { context: string } = {
  kind: 'assumption',
  cite: 'Frankenfield et al. 2005, J Am Diet Assoc',
  doi: '10.1016/j.jada.2005.02.005',
  checked: '2026-11-05',
  context:
    'A systematic review of four common equations found Mifflin-St Jeor came within 10% of measured resting burn in more non-obese and obese adults than any other, with the narrowest error range, but warned of noteworthy errors when it is applied to one person, and older adults and some ethnic groups were underrepresented. That is a share within 10%, not a typical error, so 10% stays an assumption.',
}

export interface BodyInputs {
  kg: number
  cm: number
  age: number
  sex: BodySex
}

export interface RestingBurn {
  /** Resting burn per 24 hours, kcal. */
  kcal: number
  /** The sex constant used: +5, −161, or the midpoint −78. */
  sexConstant: number
  /** Extra spread from the midpoint (0 unless "prefer not to say"). */
  sexSd: number
  /** The equation's error: RESTING_TYPICAL_ERROR × kcal. */
  equationSd: number
  /** √(equationSd² + sexSd²), per 24 hours. */
  sd: number
}

/** Mifflin-St Jeor resting burn for one day, with its spread. */
export function restingBurn({ kg, cm, age, sex }: BodyInputs): RestingBurn {
  const sexConstant = sex === 'male' ? SEX_CONSTANTS.male : sex === 'female' ? SEX_CONSTANTS.female : SEX_MIDPOINT
  const kcal = 10 * kg + 6.25 * cm - 5 * age + sexConstant
  const sexSd = sex === 'unspecified' ? SEX_SPREAD_SD : 0
  const equationSd = RESTING_TYPICAL_ERROR * kcal
  return { kcal, sexConstant, sexSd, equationSd, sd: Math.sqrt(equationSd * equationSd + sexSd * sexSd) }
}

export interface BalanceInput {
  /** Eaten's known total and its absolute spread. */
  eaten: number
  eatenSd: number
  /** Logged workouts' known total and spread (0 and 0 with none). */
  workouts: number
  workoutsSd: number
  resting: RestingBurn
  factor: number
  /** Hours counted: from the day's wake to the next wake, or to now. */
  hours: number
}

export interface BalanceEstimate {
  /** Resting burn × factor × hours / 24: everyday burn over the hours counted. */
  everyday: number
  /** Its spread: resting.sd × factor × hours / 24. */
  everydaySd: number
  /** everyday + workouts. */
  burn: number
  /** eaten − burn. Below 0 is a deficit, above 0 a surplus. */
  balance: number
  /** √(eatenSd² + workoutsSd² + everydaySd²). */
  sd: number
  likely: Range
  veryLikely: Range
  /** The share of a day counted: hours / 24. */
  share: number
}

export function estimateBalance(input: BalanceInput): BalanceEstimate {
  const share = Math.max(0, input.hours) / 24
  const everyday = input.resting.kcal * input.factor * share
  const everydaySd = input.resting.sd * input.factor * share
  const burn = everyday + input.workouts
  const balance = input.eaten - burn
  const sd = Math.sqrt(input.eatenSd ** 2 + input.workoutsSd ** 2 + everydaySd ** 2)
  return {
    everyday,
    everydaySd,
    burn,
    balance,
    sd,
    likely: normalRange(balance, sd, Z80),
    veryLikely: normalRange(balance, sd, Z95),
    share,
  }
}

/** Hours between two ISO times (0 when the end is not after the start). */
export function hoursBetween(startIso: string, endIso: string): number {
  return Math.max(0, (Date.parse(endIso) - Date.parse(startIso)) / 3_600_000)
}

/**
 * Whole years from `fromDate` (YYYY-MM-DD, local) to `atIso`, so an age typed a year ago reads a
 * year older now. For a moment before `fromDate` it counts back the same way (a day a whole year
 * before the age was typed reads a year younger); within a year either side it is 0.
 */
export function yearsSince(fromDate: string, atIso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromDate)
  if (!m) return 0
  const at = new Date(atIso)
  if (Number.isNaN(at.getTime())) return 0
  const from = [Number(m[1]), Number(m[2]), Number(m[3])]
  const to = [at.getFullYear(), at.getMonth() + 1, at.getDate()]
  const before = (a: number[], b: number[]) => a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])))
  // Whole years from the earlier date to the later one, signed.
  const [lo, hi, sign] = before(to, from) ? [to, from, -1] : [from, to, 1]
  let years = hi[0] - lo[0]
  if (hi[1] < lo[1] || (hi[1] === lo[1] && hi[2] < lo[2])) years--
  return years === 0 ? 0 : sign * years
}
