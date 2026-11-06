// The stat registry (build-out item 2.7; prd.md > Week View: "the weekly average of all of the
// stats"). One list of every stat HowSure shows, the saved data and day values each one reads, and
// for everything else in the saved log, why it is not a stat. Pure data: no React, no copy.
//
// Every stat here must have a week average. src/ui/weekStats.ts gives each id its week row (its
// average, how many days it counts, and its day-by-day breakdown) in an object typed by StatId, so
// a stat registered here without a week row does not compile.
// src/ui/__tests__/week-view.test.ts then checks, among other things:
//   - every number in the saved log's schema (src/store/schema.ts), every list in it, every value
//     of a day's view (src/ui/dayView.ts DayView, read one level into its objects, such as
//     DayView.burned.score) and of the sleep averages (NightStats), and every number in the weight
//     and balance view-models (src/ui/weightView.ts WeightView, src/ui/balanceView.ts BalanceView,
//     read one level in, such as WeightView.trend.kgPerWeek) is read by a registered stat
//     (`covers`) or listed in NOT_STATS with a reason, so a figure worked out from existing data
//     (a weekly weight rate, say) needs a stat too;
//   - nothing in `covers` or NOT_STATS names a path that no longer exists;
//   - every registered stat gives a week row with an average, a count and a breakdown, for a week
//     that holds every kind of entry.
//
// How a new stat registers (for example a gut score, fibre, steps or runs):
//   1. Add its saved fields to the schema as usual. The coverage test now fails: nothing reads them.
//   2. Add its id to STAT_IDS below, with the paths it reads in `covers` (exact paths, as the test
//      prints them; or, for something that is genuinely not a stat, a NOT_STATS line with why).
//   3. Add its week row in src/ui/weekStats.ts: the per-day value, the average (unknown days left
//      out and counted, never 0) and the breakdown. TypeScript fails until it exists.
//   4. Add its words to src/ui/copy.ts (copy.week), and a case to the fixture week in the test.

/** Every stat, in the order the week view lists them. */
export const STAT_IDS = [
  'eaten',
  'score',
  'protein',
  'carbs',
  'fat',
  'net',
  'burned',
  'burnedScore',
  'balance',
  'workoutTime',
  'gym',
  'sleepLength',
  'bedtime',
  'wakeTime',
  'weight',
  'bodyFat',
] as const

export type StatId = (typeof STAT_IDS)[number]

/** The week view's groups, in order. */
export const STAT_GROUPS = ['food', 'activity', 'sleep', 'body'] as const
export type StatGroup = (typeof STAT_GROUPS)[number]

export interface StatEntry {
  group: StatGroup
  /**
   * What the stat reads: saved-log paths as the coverage test prints them ("meals[].kcal", a list
   * as "weighIns[]"), day values as "DayView.<key>" or "NightStats.<key>", and the numbers of the
   * weight and balance views as "WeightView.<key>.<sub>" or "BalanceView.<key>". A day value that is
   * an object is read one level in ("DayView.burned.score", "DayView.macros.protein"), so a new
   * figure inside a day's estimate needs a stat too. Exact paths only: covering "meals[]" does not
   * cover "meals[].protein".
   */
  covers: readonly string[]
}

const EATEN_DAY = ['status', 'knownTotal', 'mealCount', 'unknownMealIds', 'e', 'likely', 'veryLikely', 'groups'].map((k) => `DayView.day.${k}`)
const BURNED_DAY = ['status', 'knownTotal', 'workoutCount', 'unknownWorkoutIds', 'sd', 'e', 'likely', 'veryLikely', 'groups'].map(
  (k) => `DayView.burned.${k}`,
)

export const STATS: { readonly [K in StatId]: StatEntry } = {
  eaten: { group: 'food', covers: ['meals[]', 'meals[].kcal', 'DayView.meals', 'DayView.eatenSd', ...EATEN_DAY] },
  score: { group: 'food', covers: ['DayView.day.score'] },
  protein: { group: 'food', covers: ['meals[].protein', 'DayView.macros.protein'] },
  carbs: { group: 'food', covers: ['meals[].carbs', 'DayView.macros.carbs'] },
  fat: { group: 'food', covers: ['meals[].fat', 'DayView.macros.fat'] },
  net: { group: 'activity', covers: ['DayView.net.total', 'DayView.net.sd', 'DayView.net.likely', 'DayView.net.veryLikely', 'DayView.net.knownOnly'] },
  burned: { group: 'activity', covers: ['workouts[]', 'workouts[].kcal', 'DayView.workouts', ...BURNED_DAY] },
  burnedScore: { group: 'activity', covers: ['DayView.burned.score'] },
  balance: {
    group: 'activity',
    covers: [
      'profile.body.age',
      'profile.body.heightCm',
      'profile.body.weightKg',
      ...['rounded', 'eaten', 'eatenSd', 'workouts', 'workoutsSd'].map((k) => `BalanceView.${k}`),
      ...['balance', 'sd', 'everyday', 'everydaySd', 'burn', 'share'].map((k) => `BalanceView.est.${k}`),
      'BalanceView.resting.kcal',
      'BalanceView.resting.sd',
    ],
  },
  workoutTime: { group: 'activity', covers: ['workouts[].minutes', 'DayView.workouts'] },
  gym: { group: 'activity', covers: ['workouts[].gym.exercises[].sets[]'] },
  sleepLength: { group: 'sleep', covers: ['sleeps[]', 'NightStats.nights', 'NightStats.avgMinutes', 'NightStats.complete', 'NightStats.total'] },
  bedtime: { group: 'sleep', covers: ['sleeps[]'] },
  wakeTime: { group: 'sleep', covers: ['sleeps[]', 'NightStats.avgWakeMinutes', 'NightStats.wakeVaries'] },
  weight: {
    group: 'body',
    covers: [
      'weighIns[]',
      'weighIns[].kg',
      'WeightView.latest.kg',
      'WeightView.latestAsOf.kg',
      'WeightView.average.kg',
      'WeightView.average.count',
      'WeightView.trend.kgPerWeek',
      'WeightView.trend.count',
      'WeightView.trend.needed',
    ],
  },
  bodyFat: { group: 'body', covers: ['weighIns[].bodyFatPct', 'WeightView.latest.bodyFatPct', 'WeightView.latestAsOf.bodyFatPct'] },
}

/**
 * Saved fields and day values that are not stats, with why. Unlike `covers`, an entry here also
 * covers everything under it ("savedMeals[]" covers "savedMeals[].kcal").
 */
export const NOT_STATS: Readonly<Record<string, string>> = {
  'profile.targets': 'Targets the person sets, compared with a stat (eaten, protein); not something measured.',
  'clock': 'The demo clock’s anchor, not something measured.',
  'plates[]': 'Saved plates (a later item) are weights of empty plates, not entries of a day.',
  'savedMeals[]': 'Meals saved to log again; nothing counts until one is logged as a meal.',
  'meals[].foods[]': 'The foods listed in a meal: its parts, already counted in the meal’s own calories and macros.',
  'meals[].lookup.amount.grams': 'The weighed amount behind a looked-up label: part of how the meal’s calories were worked out.',
  'workouts[].gym.exercises[]':
    'Exercises are named per session; a session’s exercises and sets show in the breakdown, and sets a session is the averaged figure.',
  'workouts[].gym.exercises[].sets[].weightKg':
    'A set’s weight is compared within one exercise (previous best in the gym log); averaging weights across different exercises means nothing.',
  'workouts[].gym.exercises[].sets[].reps': 'Reps, like a set’s weight, are compared within one exercise, never averaged across exercises.',
  'workouts[].gym.exercises[].sets[].drops[]': 'The steps inside one drop set, counted as part of that set.',
  'DayView.dayStart': 'Which day it is, not a value of the day.',
  'DayView.biggest': 'Which meal is least sure: a pointer to one meal, explained on its day.',
  'DayView.day.biggestMealId': 'Which meal is least sure, as its id: the same pointer as the biggest meal, explained on its day.',
  'DayView.day.contributions':
    'Each meal’s share of one day’s uncertainty, which explains that day; the week’s ranges regroup every meal by source instead.',
  'DayView.net.score': 'Always empty: net shows its ranges but has no Estimate score of its own, on a day or over the week.',
  'DayView.improvement': 'A suggestion for one meal, not a measure of the day.',
  'WeightView.chart': 'The weight chart’s drawing size in its own units: how it is laid out, not something measured.',
  'BalanceView.inputs':
    'The body details, activity level and hours the estimate is worked out from: what the person enters, read by the balance’s own stat through the profile.',
  'BalanceView.resting.sexConstant': 'A fixed constant of the published resting-burn equation, the same on every day.',
  'BalanceView.resting.sexSd': 'The spread of that equation’s constant, fixed by the equation, the same on every day.',
  'BalanceView.resting.equationSd': 'The equation’s published typical error, fixed by the equation, the same on every day.',
}
