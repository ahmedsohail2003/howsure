// Shared shapes for the maths core (spec.md > Maths Core: *, Data Model).
// The kernel is pure: no React, no storage, no clock reads.

export type MealSourceId =
  | 'weighed'
  | 'label'
  | 'label_lookup'
  | 'menu'
  | 'photo'
  | 'description'
  | 'food_db'

export type BurnSourceId = 'burn_device' | 'burn_machine' | 'burn_guess'

export type SourceId = MealSourceId | BurnSourceId

export type MacroKey = 'protein' | 'carbs' | 'fat'

export interface SourceBasis {
  kind: 'study' | 'assumption'
  cite?: string // e.g. "Fridolfsson et al. 2025, <journal>"
  doi?: string
  finding?: string // one plain line on what the study found
  checked?: string // ISO date the study was re-opened
}

export interface Source {
  id: SourceId
  label: string // shown under "How do you know?"
  typicalError: number // fraction, e.g. 0.46
  hint?: string // short helper line under the option
  basis: SourceBasis
  context?: string // nearest study shown when basis is "assumption"
  macroErrors?: Partial<Record<MacroKey, number>> // Tier 3
}

// Added by the kernel builder (spec.md > Data Model, meals.foods and meals.lookup).
export interface MealFood {
  name: string
  amount: number
  unit: 'g' | 'oz' | 'serving'
  tagOverrides?: { add?: string[]; remove?: string[] } // Tier 2
  fiberPer100?: number // Tier 2
}

export type LookupAmountKind = 'weighed' | 'package' | 'portion'

// Tier 2 (barcode). Only amount.kind affects the maths: a 'portion' makes a
// label_lookup meal use the looked-up-amount rule (spec.md > Sources Table).
export interface MealLookup {
  kind: 'barcode' | 'foodSearch'
  id?: string // filled from fixtures/off-cache.json in the barcode slice
  credit?: string
  fetchedAt?: string
  saved?: boolean
  amount: { kind: LookupAmountKind; grams?: number | null }
}

export interface Meal {
  id: string
  name: string
  eatenAt: string // ISO 8601 with offset, e.g. "2026-10-21T17:30:00-04:00"
  // null = "How do you know?" not picked. Allowed only while kcal is null (prd.md > Logging a
  // Meal: "With calories blank, it can stay empty"); store/schema.ts rejects a known kcal with no
  // source. Widened in slice 3, never renamed. Use isKnownMeal() to narrow both at once.
  source: MealSourceId | null
  kcal: number | null // null = unknown, never 0
  protein: number | null
  carbs: number | null
  fat: number | null
  note?: string
  foods?: MealFood[] // added: spec.md > Demo Fixture "Foods listed"
  lookup?: MealLookup // added: spec.md > Data Model (Tier 2)
}

/** Build-out item 2.4: the unit a weight was typed in, and the display preference (settings.weightUnit). */
export type WeightUnit = 'kg' | 'lb'

/**
 * A weigh-in (spec.md > Data Model: weighIns `{ id, at, kg }`; build-out item 2.4). The weight is
 * stored in kg; `unit` keeps the unit it was typed in, so an edit shows it back as typed. A
 * weigh-in belongs to the waking day it was taken in, by the same rule as a meal (sleepday.ts).
 */
export interface WeighIn {
  id: string
  at: string // ISO 8601 with offset
  kg: number // above 0
  unit?: WeightUnit // the unit it was entered in; absent in logs saved before item 2.4 (read as kg)
  bodyFatPct?: number // optional, 0 < x < 100
  note?: string
  /** True when the time was not recorded and was set by a documented rule (an import). */
  timeApproximate?: boolean
  /** The original record an import read, kept as it was (src/import/trackerWeighIns.ts). */
  imported?: Record<string, unknown>
}

/** A meal the day's maths can count: known calories and a picked source (estimate.ts isKnownMeal). */
export type KnownMeal = Meal & { kcal: number; source: MealSourceId }

export interface SleepRecord {
  id: string
  sleepStart: string | null // ISO; null = not logged
  wake: string | null // ISO; null = still asleep
}

export interface Range {
  lo: number
  hi: number
}

export interface ItemEstimate {
  e: number // typical error as a fraction
  sd: number // x * e
  score: number // 0..100
  likely: Range
  veryLikely: Range
}

export interface Contribution {
  mealId: string
  source: MealSourceId
  sd: number
  share: number // fraction of sd_day^2, sums to 1 over known meals
}

export type DayStatus = 'empty' | 'all-unknown' | 'partial' | 'complete'

export interface DayEstimate {
  status: DayStatus
  knownTotal: number // sum of known kcal
  mealCount: number
  unknownMealIds: string[]
  e: number | null // null when knownTotal is 0 ("Not available yet")
  score: number | null
  likely: Range | null
  veryLikely: Range | null
  groups: { source: MealSourceId; sd: number; mealIds: string[] }[]
  contributions: Contribution[] // biggest first
  biggestMealId: string | null
}

// Added in slice 4 (spec.md > Maths Core: Waking Days and Sleep).
export type SleepStatus =
  | { kind: 'awake'; since: string | null; recordId: string | null } // since = latest wake, null when none
  | { kind: 'asleep'; since: string; recordId: string } // since = the open record's sleep start

export interface Night {
  id: string
  sleepStart: string | null
  wake: string | null
  minutes: number | null // wake - sleepStart, rounded; null = "not logged", never 0
}

export interface NightStats {
  nights: Night[] // oldest first, at most lastN
  complete: number // nights with a length: the "6" in "6 of 7 nights"
  total: number // nights in the window: the "7"
  avgMinutes: number | null // over complete nights only; null when there are none
  avgWakeMinutes: number | null // circular mean, 0..1439; null when none or too spread out
  wakeVaries: boolean // true when there are wake times but the resultant length is below 0.2
}

export type SleepProblem =
  | { kind: 'not-a-time' }
  | { kind: 'wake-before-sleep'; sleepStart: string }
  | { kind: 'sleep-before-previous-wake'; wake: string }
  | { kind: 'overlap'; other: SleepRecord } // the record it runs into (build-out item 2.2)
  | { kind: 'needs-wake'; other: SleepRecord } // no wake, but a later record exists
  | { kind: 'future' }

export interface Improvement {
  mealId: string
  to: MealSourceId
  newMealE: number
  newDayScore: number | null
}

export interface MacroTotal {
  known: number
  missing: number // meals with a null value for this macro
  allUnknown: boolean // the day has meals but none has this macro
}

// Added by the kernel builder: the shape of fixtures/demo-week.json (spec.md > Demo Fixture).
// Typed in slice 10 (build-out item 2.5a): a workout belongs to the waking day it started in, as a
// meal does to the day it was eaten in.
export interface Workout {
  id: string
  name: string
  startedAt: string // ISO with offset in a log; a wall-clock string with no offset in the fixture
  minutes: number | null // null = duration unknown, never 0
  kcal: number | null // calories burned; null = unknown, never 0
  // null = "How do you know?" not picked, allowed only while kcal is null (as for a meal).
  source: BurnSourceId | null
}

/** A workout the burned maths can count: known calories and a picked source (net.ts isKnownWorkout). */
export type KnownWorkout = Workout & { kcal: number; source: BurnSourceId }

export interface Plate {
  id: string
  name: string
  grams: number
}

// Every time in the fixture (clock.start, eatenAt, sleepStart, wake, startedAt) is a wall-clock
// string with no offset, e.g. "2026-10-21T13:20:00", read as local time (spec.md > Clock).
// store/log.ts demoLog() converts them to local-offset ISO strings before the kernel sees them.
export interface DemoFixture {
  label: string // "Sample person — fictional"
  person: {
    name: string // "Sam"
    gamerTag: string // "CalmLentil#3108"
    kind: 'demo'
    fictional: true
    targets: { kcal: number; protein: number }
  }
  clock: { start: string } // the demo clock's first "now", wall-clock with no offset
  meals: Meal[]
  sleeps: SleepRecord[]
  workouts: Workout[]
  plates: Plate[]
}

export type Parsed =
  | { kind: 'unknown' }
  | { kind: 'value'; value: number }
  | { kind: 'error'; message: string }

// Function contract (implemented in the files named; spec.md has the formulas):
// sources.ts   SOURCES: Record<SourceId, Source>; getSource(id): Source; bestMealSource(): MealSourceId
// estimate.ts  Z80 = 1.2816; Z95 = 1.96
//              scoreFromE(e: number): number                       // clamp(round-half-up(100*(1-e)),0,100)
//              rangeFromE(x: number, e: number, z: number): Range  // [x/(1+e)^z, x*(1+e)^z], unrounded
//              isKnownMeal(meal: Meal): meal is KnownMeal          // kcal and source both present
//              estimateMeal(meal: Meal): ItemEstimate | null       // null when kcal (or source) is null
//              combineDay(meals: Meal[]): DayEstimate
//              improve(meals: Meal[], mealId: string): Improvement | null
//              macroTotals(meals: Meal[]): Record<MacroKey, MacroTotal>
// portion.ts   MAX_FACTOR = 10; isFactor(factor): boolean
//              scaleAmounts(meal, factor): same shape, kcal/macros/foods/lookup grams x factor (item 2.3)
// parse.ts     parseAmount(input: string): Parsed
// sleepday.ts  wakingDayStart(sleeps: SleepRecord[], at: string): string | null   // latest wake <= at
//              nextWakeAfter(sleeps: SleepRecord[], dayStart: string): string | null
//              mealsForDay(meals: Meal[], sleeps: SleepRecord[], dayStart: string | null): Meal[]  // null = provisional day
//              sleepStatus(sleeps): SleepStatus; wakingDays(meals, sleeps, upTo?): (string | null)[]
//              movedMeals(meals, before: SleepRecord[], after: SleepRecord[]): Meal[]
//              movedBy(items, at: (item) => string, before, after): items whose waking day changes
//              circularMeanMinutes(minutes: number[]): number | null; nightStats(sleeps, lastN = 7): NightStats
//              validateSleep(sleeps, changed: SleepRecord, latest: string | null): SleepProblem | null
//              workoutsForDay(workouts, sleeps, dayStart): Workout[]   // the waking day a workout started in
// net.ts       combineBurned(workouts: Workout[]): BurnedEstimate        // per-source grouping, like a day
//              combine(eaten: DayEstimate, burned: BurnedEstimate): NetDay // N = X - B, sd_N = sqrt(sd_X^2 + sd_B^2)
// weight.ts    LB_TO_KG = 0.45359237; toKg(value, unit); fromKg(kg, unit)          // item 2.4
//              weighInsForDay(weighIns, sleeps, dayStart); averageOver(weighIns, asOf, days = 7)
//              trendRate(weighIns, asOf): least-squares kg per week over 21 days, 6 weigh-ins or more
