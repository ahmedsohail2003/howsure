// Every user-visible string in HowSure lives here (spec.md > Screens; study titles live in
// src/kernel/sources.ts). Word rules, checked by src/ui/__tests__/copy.test.ts:
//   - "Estimate score", never "accuracy";
//   - "likely" and "very likely", never "for sure";
//   - "guarantee" only inside a negation;
//   - "unknown", never 0.
// Templates take already-formatted strings, so this file holds words, not number formatting.

import { PARSE_ERROR_MESSAGE } from '../kernel/parse'

// Shared by the sleep and weight sheets, whose time starts at now.
const STARTS_AT_NOW = 'Starts at now. Change it if it was another time.'

export const copy = {
  appName: 'HowSure',
  tagline: 'Food estimates, explained.',
  fictionalBanner: 'Sample person — fictional',
  sep: ' · ',
  /** After a short link's words ("Improve ›"); hidden from screen readers. */
  arrow: ' ›',

  // Build-out item 2.1: your own log is the main path; the fictional demo is a side door. Both
  // are one tap from the first open.
  firstOpen: {
    lede: 'A food log where every calorie number says how sure it is, what that rests on, and what would make it better.',
    startMine: 'Start my log',
    startMineHint: 'Your own log, saved on this device only. It starts with no meals and no wake time.',
    orDemo: 'Or look around first',
    tryDemo: 'Try the fictional demo',
    tryDemoHint: 'A week from Sam, a made-up person, with mixed sources and one rough meal. It is kept apart from your log.',
  },

  header: {
    awakeSince: (weekday: string, time: string) => `${weekday} · awake since ${time}`,
    wakeTimeNotSet: 'Wake time not set',
    // The switch between the logs: back to your own log from the demo, and the demo as a side door.
    switchToMine: 'Open my log',
    switchToDemo: 'See the demo',
    setWake: 'Set wake time',
    yourLog: 'Your log',
    // spec.md > Screens > Dashboard: the guest name opens Profile and privacy.
    profileAndPrivacy: 'Profile and privacy',
  },

  // Build-out item 2.1: Set wake time, for a log with no wake time yet (prd.md > Sleep and Waking
  // Days > Before a wake time is set). The regroup preview names every meal and its day before
  // anything is saved.
  setWake: {
    title: 'Set wake time',
    intro: 'When did you wake up for the day you are logging now? Your waking day starts then.',
    dayLegend: 'Day',
    today: (weekday: string) => `Today, ${weekday}`,
    yesterday: (weekday: string) => `Yesterday, ${weekday}`,
    time: 'Wake time',
    // Shown only while the field still holds the default.
    timeHint: (time: string) => `Filled in as ${time}. Change it to when you woke up.`,
    startsDay: (when: string) => `Your waking day will start ${when}.`,
    save: 'Save',
    next: 'Next',
    cancel: 'Cancel',
    previewTitle: 'Where your meals will go',
    previewIntro: (when: string) => `With a wake time of ${when}, your meals fall into these days:`,
    // The day the new wake starts is the one the dashboard shows as today after Save.
    todayFrom: (when: string) => `Today, from ${when}`,
    earlier: 'Earlier, before you woke',
    earlierNote: 'These stay in the day before, which has no wake time.',
    none: 'No meals',
    // Each list's calories, counted as the headline counts them (known meals only).
    total: (kcal: string) => `${kcal} kcal`,
    totalUnknown: 'Calories unknown',
    mealKcal: (kcal: string) => `${kcal} kcal`,
    mealKcalUnknown: 'unknown',
    keepsAll: 'Every meal stays in your log with its own date and time. Nothing changes until you tap Save.',
    // When the log also holds workouts or weigh-ins (or only those), the preview names what it lists,
    // so it never talks about meals that are not there.
    previewTitleEntries: 'Where your entries will go',
    previewIntroKinds: (when: string, kinds: string) => `With a wake time of ${when}, your ${kinds} fall into these days:`,
    kindMeals: 'meals',
    kindWorkouts: 'workouts',
    kindWeighIns: 'weigh-ins',
    noneEntries: 'Nothing logged',
    keepsAllEntries: 'Every entry stays in your log with its own date and time. Nothing changes until you tap Save.',
    back: 'Change the time',
    // Build-out item 2.2: the sleep and wake editor, for the whole night.
    addNight: 'Add the whole night instead',
  },

  // Build-out item 2.1: Reset demo (prd.md > Demo and My Log; spec.md > Store). It asks first only
  // when the demo has been edited, and never touches your own log.
  resetDemo: {
    title: 'Reset the demo?',
    intro: 'The demo has changed since it started:',
    mealsAdded: (n: number) => (n === 1 ? '1 meal added' : `${n} meals added`),
    mealsChanged: (n: number) => (n === 1 ? '1 meal changed' : `${n} meals changed`),
    mealsDeleted: (n: number) => (n === 1 ? '1 meal deleted' : `${n} meals deleted`),
    sleepChanged: 'Sleep times changed',
    targetsChanged: 'Sam’s targets changed',
    savedMealsChanged: 'Saved meals changed',
    workoutsChanged: 'Workouts changed',
    weighInsChanged: 'Weigh-ins changed',
    otherChanged: 'Other demo details changed',
    // Build-out item 2.5b.
    bodyChanged: 'Sam’s body details changed',
    discards: 'Resetting puts back Sam’s week as it started and discards these changes. Your own log is not affected.',
    confirm: 'Reset demo',
    keep: 'Keep the changes',
    done: 'The demo is back to Sam’s week as it started. Your own log was not touched.',
  },

  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const,
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const,
  // A past moment with its calendar date: "Tue 22 Sep", "Tue 22 Sep 2025", "Tue 22 Sep, 7:10 AM".
  dayDate: (weekday: string, day: string, month: string, year: string | null) =>
    year ? `${weekday} ${day} ${month} ${year}` : `${weekday} ${day} ${month}`,
  dateAndTime: (date: string, time: string) => `${date}, ${time}`,
  // "Wed Oct 21", "Wed Oct 21, 2025" (format.ts fmtDatedWhen).
  weekdayDate: (weekday: string, month: string, day: string, year: string | null) =>
    year ? `${weekday} ${month} ${day}, ${year}` : `${weekday} ${month} ${day}`,
  weekdaysFull: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const,
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const,
  am: 'AM',
  pm: 'PM',

  units: {
    kcal: 'kcal',
    grams: 'g',
    kcalValue: (n: string) => `${n} kcal`,
    gramsValue: (n: string) => `${n} g`,
    percent: (n: string) => `${n}%`,
    plusMinusKcal: (n: string) => `±${n} kcal`,
  },

  headline: {
    label: 'Calories today',
    labelEarlierDay: 'Calories that day',
    labelKnownOnly: 'Calories, known meals only',
    notAvailable: 'Not available yet',
    incompleteDay: 'Known meals only — incomplete day',
    unknownCount: (n: number) => (n === 1 ? '1 meal with unknown calories' : `${n} meals with unknown calories`),
    likely: 'Likely',
    veryLikely: 'Very likely',
    rangeValue: (lo: string, hi: string) => `${lo}–${hi} kcal`,
    estimateScore: (score: string) => `Estimate score ${score}`,
    estimateScoreNotAvailable: 'Estimate score: Not available yet',
    // Build-out item 1.5.2, Journal look: the range bar's text legend. Every number on the bar is
    // also written here as text; the bar itself is drawn for the eye only.
    bestEstimate: 'Best estimate',
    target: 'Target',
    rangesKnownOnly: 'These ranges cover the known meals only, so no bar is drawn until every meal has calories.',
    // Panel and Night, which draw no range bar.
    rangesKnownOnlyShort: 'These ranges cover the known meals only.',
    // Build-out item 2.5a (slice 10): with a workout on the day, the headline is net calories,
    // with eaten and burned under it. The score under it stays the eaten score, labelled so.
    netLabel: 'Net calories today',
    netLabelEarlierDay: 'Net calories that day',
    netLabelKnownOnly: 'Net calories, known entries only',
    netKnownOnly: 'Known entries only — incomplete day',
    unknownWorkouts: (n: number) =>
      n === 1 ? '1 workout with unknown calories burned' : `${n} workouts with unknown calories burned`,
    eatenScore: (score: string) => `Eaten: estimate score ${score}`,
    eatenScoreNotAvailable: 'Eaten: estimate score not available yet',
    netRangesKnownOnly: 'These ranges cover the known meals and workouts only.',
    // A range that runs below 0 reads "−140 to 3,140 kcal": an en dash after a minus sign is hard to read.
    signedRangeValue: (lo: string, hi: string) => `${lo} to ${hi} kcal`,
    // Build-out item 2.9: every number on the dashboard opens its detail. The headline number opens
    // the meals behind it (or, once net is the headline, how net is worked out).
    openEaten: (label: string, value: string) => `${label} ${value}. Opens the meals behind it.`,
    openNet: (label: string, value: string) => `${label} ${value}. Opens how net is worked out.`,
    // Read after the Panel ring's own words, which already give the number.
    opensMeals: 'Opens the meals behind it.',
    opensNet: 'Opens how net is worked out.',
    openUnknownMeals: (count: string) => `${count}. Opens the meals.`,
    openUnknownWorkouts: (count: string) => `${count}. Opens the workouts.`,
    openShare: (share: string) => `${share}. Opens the estimate score explanation, which lists each meal’s share.`,
    minus: '−',
    plus: '+',
  },

  // Build-out item 2.5a (slice 10; prd.md > Workouts and Net Calories): eaten and burned under the
  // net headline, each one tap from its detail, and what net leaves out.
  net: {
    eaten: 'Eaten',
    burned: 'Burned',
    value: (kcal: string) => `${kcal} kcal`,
    unknown: 'unknown',
    notAvailable: 'not available yet',
    eatenOpen: (value: string) => `Eaten ${value}. Opens the meals.`,
    burnedOpen: (value: string) => `Burned ${value}. Opens the workouts.`,
    restingShort: 'Burned counts the workouts you logged, not your resting burn.',
    // With the estimated deficit or surplus shown beside it, which does count resting burn.
    restingWithBalance: 'Burned counts the workouts you logged; the estimated deficit or surplus adds your resting burn.',
    // spec.md > Maths Core: Net Calories, word for word.
    note: "Not your full energy balance: your body's resting burn isn't counted, so net alone can't show whether you ate more or less than you burned.",
    // Journal's range bar shows net once net is the headline; the target is for calories eaten.
    // One line with restingShort under the bar.
    barNote: 'The bar shows net, so your target for eating isn’t marked on it.',
    // The mark for 0 on Journal's net range bar, once the bar runs below 0.
    zero: '0',
  },

  // Build-out item 2.5b, by the owner's decision: the estimated deficit or surplus, shown when resting
  // burn can be worked out from body details, and always called an estimate. Never "for sure".
  balance: {
    deficit: (kcal: string, soFar: boolean) => (soFar ? `Estimated deficit ${kcal} kcal so far` : `Estimated deficit ${kcal} kcal`),
    surplus: (kcal: string, soFar: boolean) => (soFar ? `Estimated surplus ${kcal} kcal so far` : `Estimated surplus ${kcal} kcal`),
    even: (soFar: boolean) => (soFar ? 'Estimated balance about even so far (0 kcal)' : 'Estimated balance about even (0 kcal)'),
    likely: (range: string) => `likely ${range}`,
    veryLikely: (range: string) => `very likely ${range}`,
    kcalSpace: 'kcal ',
    // Ranges on the deficit scale: "120–580 kcal deficit", "60–300 kcal surplus", or across 0
    // "120 kcal surplus to 580 kcal deficit". Night drops the unit ("120–580 deficit").
    rangeDeficit: (lo: string, hi: string, unit: string) => `${lo}–${hi} ${unit}deficit`,
    rangeSurplus: (lo: string, hi: string, unit: string) => `${lo}–${hi} ${unit}surplus`,
    rangeAcross: (surplus: string, deficit: string, unit: string) => `${surplus} ${unit}surplus to ${deficit} ${unit}deficit`,
    open: (text: string, likely: string) => `${text}, ${likely}. Opens how it is worked out.`,
    knownOnly: 'Known entries only',
    fields: { age: 'age', sex: 'sex', height: 'height', weight: 'weight' },
    and: ' and ',
    invite: (fields: string) => `Add your ${fields} in Profile to see an estimated deficit or surplus.`,
    inviteDemo: (fields: string) => `Add Sam’s ${fields} to see an estimated deficit or surplus.`,
    needsWake: 'Estimated deficit or surplus: needs a wake time to count the day from.',
  },

  // The estimated deficit or surplus explained (build-out item 2.5b).
  explainBalance: {
    title: 'Estimated deficit or surplus',
    intro:
      'Calories eaten minus an estimate of everything burned: your resting burn, your everyday activity and the workouts you logged.',
    eaten: 'Eaten',
    eatenKnownOnly: 'Eaten (known meals)',
    resting: 'Resting burn',
    restingValue: (kcal: string) => `${kcal} kcal a day`,
    activity: 'Everyday activity',
    activityValue: (name: string, factor: string, isDefault: boolean) =>
      isDefault ? `${name}, × ${factor} (the default)` : `${name}, × ${factor}`,
    hours: 'Hours counted',
    hoursValue: (duration: string, pct: string) => `${duration} (${pct}% of a day)`,
    everyday: 'Everyday burn',
    workouts: 'Workouts logged',
    workoutsKnownOnly: 'Workouts logged (known)',
    burn: 'Estimated burn',
    balance: 'Eaten minus burn',
    kcal: (kcal: string) => `${kcal} kcal`,
    inputsTitle: 'What it uses',
    age: 'Age',
    ageValue: (years: string) => `${years} years`,
    sex: 'Sex',
    height: 'Height',
    weight: 'Weight',
    weightFromProfile: (w: string) => `${w}, from body details`,
    // "from your Wed 7:35 AM weigh-in", "from your Tue 22 Sep weigh-in": reads the same with or without a time.
    weightFromWeighIn: (w: string, when: string) => `${w}, from your ${when} weigh-in`,
    sexNames: { female: 'Female', male: 'Male', unspecified: 'Prefer not to say' },
    equationTitle: 'The equation',
    equation: (kg: string, cm: string, age: string, s: string) => `Mifflin-St Jeor: 10 × ${kg} kg + 6.25 × ${cm} cm − 5 × ${age} ${s}`,
    equationResult: (kcal: string) => ` = ${kcal} kcal a day at rest.`,
    unspecified: (sd: string) =>
      `You chose Prefer not to say, so HowSure uses the middle of the equation’s values for women (−161) and men (+5), which is −78, and widens the range as if yours could be anywhere between them (±${sd} kcal a day).`,
    everydayLine: (resting: string, factor: string, share: string, kcal: string) =>
      `Everyday burn = ${resting} × ${factor} × ${share} of a day = ${kcal} kcal.`,
    soFar: (from: string) =>
      `This day is still going, so burn is counted from your wake (${from}) up to now, spread evenly over 24 hours. A deficit grows as the day goes on, even if you eat nothing more. By the next wake, the whole day is counted.`,
    wholeDay: (from: string, to: string) => `Counted from this day’s wake (${from}) to the next wake (${to}).`,
    once: 'Workouts are added on top of everyday activity, so each one is counted once. Pick the activity level for everyday movement only.',
    combine: (eaten: string, workouts: string, rest: string, total: string) =>
      `Eaten, workouts and the resting estimate are estimated separately, so their spreads combine: √(${eaten}² + ${workouts}² + ${rest}²) = ±${total} kcal.`,
    restError: (pct: string) => `The resting estimate’s spread is its typical error of ${pct}%, carried through the activity factor and the hours counted.`,
    notCountedTitle: 'What is not counted',
    notCounted: [
      'How far your everyday movement differs from the level you picked: the range leaves that out, so the real figure can sit outside it.',
      'Meals and workouts with unknown calories.',
      'Day-to-day changes in water and digestion, and anything that makes your resting burn differ from the equation’s average for people like you.',
      'A device’s workout calories often include the resting burn during the workout, so those minutes may count twice: once in everyday burn and once in the workout.',
    ],
    knownOnly: 'Meals and workouts with unknown calories are left out, so this covers known entries only.',
    notMeasured:
      'This is an estimate from an equation, not a measurement. A measured resting burn (from a clinic’s breath test) would be surer.',
    rangesNote:
      'The likely range is meant to catch the real figure about 8 times in 10, and the very likely range about 19 times in 20. They are design targets: HowSure hasn’t measured how often they do.',
    sourcesTitle: 'Where the numbers come from',
    equationSource: (pct: string) => `Mifflin-St Jeor equation · typical error ${pct}%`,
    factorsSource:
      'Activity factors 1.2, 1.375 and 1.55 are the usual multipliers for little, some and a lot of everyday movement. They are not measured for you.',
    howTitle: 'How the ranges are worked out',
    how: (sd: string) =>
      `With a spread of ±${sd} kcal: likely runs from the estimate − 1.2816 × ${sd} to the estimate + 1.2816 × ${sd}, and very likely uses 1.96 in place of 1.2816.`,
    duration: (h: string, m: string) => `${h} h ${m} min`,
  },

  macros: {
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
    unknown: 'unknown',
    missing: (n: number) => (n === 1 ? '1 entry missing' : `${n} entries missing`),
  },

  uncertainty: {
    sectionTitle: 'Biggest uncertainty',
    mostFrom: (meal: string) => `Most uncertainty comes from ${meal}.`,
    mostFromKnownOnly: (meal: string) => `Among the known meals, most uncertainty comes from ${meal}.`,
    alreadyBest: 'It already uses the most reliable source.',
    improveEntry: 'Improve that entry',
    // Build-out item 1.5.2, Journal look: the short link after the line. Its accessible name is
    // improveEntry, which starts with the same word.
    improveShort: 'Improve',
  },

  missing: {
    title: 'Missing information',
    unknownKcal: 'calories unknown',
    unknownBurned: 'calories burned unknown',
    // Build-out item 2.9: the row's button, which covers it, says what is unknown and what it opens.
    mealLabel: (meal: string) => `${meal}, calories unknown. Opens the meal details.`,
    workoutLabel: (workout: string) => `${workout}, calories burned unknown. Opens the workout details.`,
  },

  dashboard: {
    logMeal: 'Log a meal',
    logFirstMeal: 'Log your first meal',
  },

  meals: {
    title: 'Meals',
    unknownKcal: 'unknown',
    noScore: 'No estimate score',
    rowScore: (score: string) => `Estimate score ${score}`,
    // Build-out item 1.5.2, Journal look: the whole row opens the meal's details. The score shows
    // as plain text; the row's accessible name says it in full.
    rowScoreShort: (score: string) => `Score ${score}`,
    // Panel and Night mark the meal with the biggest uncertainty in words on its own row.
    rowScoreBiggest: (score: string) => `Estimate score ${score} · biggest uncertainty`,
    rowLabel: (meal: string, meta: string, kcal: string, score: string) =>
      `${meal}, ${meta}, ${kcal}, ${score}. Opens the meal details.`,
    // Build-out item 2.9: the score on a row is its own button, one tap from the score explanation.
    // The meal's name comes first, so the label reads "Pasta bake: Estimate score 54 · biggest uncertainty".
    scoreLabel: (score: string, meal: string) => `${meal}: ${score}. Opens the score explanation.`,
    meta: (time: string, source: string) => `${time} · ${source}`,
    // A meal saved with blank calories may have no source picked (prd.md > Logging a Meal).
    sourceNotPicked: 'source not picked',
  },

  emptyDay: {
    noMeals: 'No meals logged yet',
  },

  // Build-out item 2.5a (slice 10; prd.md > Workouts and Net Calories): log, list, edit and delete
  // workouts. A workout belongs to the waking day it started in. Blank is unknown, never 0.
  workouts: {
    sectionTitle: 'Workouts',
    none: 'No workouts logged',
    logWorkout: 'Log a workout',
    titleNew: 'Log a workout',
    titleEdit: (name: string) => `Edit: ${name}`,
    name: 'Workout name',
    nameNeeded: 'Give the workout a name.',
    howKnow: 'How do you know?',
    pickSourceHint: 'Pick how you know, so HowSure can say how sure.',
    calories: 'Calories burned (kcal)',
    caloriesHint: 'Leave it blank if you don’t know. A typed 0 counts as zero.',
    // "With this source: likely 178–504 kcal, very likely 136–664 kcal." Each range is kept on one line.
    rangePreviewLead: 'With this source:',
    rangePreviewLikely: (range: string) => `likely ${range}`,
    rangePreviewVeryLikely: (range: string) => `very likely ${range}`,
    rangePreviewJoin: ', ',
    rangePreviewEnd: '.',
    start: 'Start date and time',
    startNeeded: 'Pick a date and time.',
    otherDay: 'That time is on another waking day, so this workout won’t show on the day on screen.',
    duration: 'Duration (minutes)',
    durationHint: 'Leave it blank if you don’t know.',
    durationZero: 'A duration of 0 isn’t used. Type the minutes, or leave it blank if you don’t know.',
    save: 'Save',
    cancel: 'Cancel',
    minutes: (n: string) => `${n} min`,
    durationUnknown: 'duration unknown',
    unknownKcal: 'unknown',
    kcalBurned: (n: string) => `${n} kcal burned`,
    meta: (time: string, duration: string, source: string) => `${time} · ${duration} · ${source}`,
    rowScore: (score: string) => `Estimate score ${score}`,
    rowScoreShort: (score: string) => `Score ${score}`,
    noScore: 'No estimate score',
    rowLabel: (name: string, meta: string, kcal: string, score: string) =>
      `${name}, ${meta}, ${kcal}, ${score}. Opens the workout details.`,
    sourceNotPicked: 'source not picked',
    // The Night timeline's point.
    nightScore: (score: string) => `score ${score}`,
    nightNoScore: 'no estimate score',

    // The list, opened from Burned under the net headline.
    listTitle: 'Burned today',
    listTitleEarlierDay: 'Burned that day',
    listSub: (n: number) => (n === 1 ? 'From 1 logged workout' : `From ${n} logged workouts`),
    listIntro: 'Tap a workout for its details.',
    listNone: 'No workouts logged on this day.',
    listKnownOnly: 'Known workouts only: a workout with unknown calories is left out of burned.',
    burnedNotAvailable: 'Not available yet: no workout on this day has known calories burned.',
    scoreSentence:
      'A workout’s estimate score comes from the typical error of how you know its calories, as a meal’s does. Burned’s score combines the workouts the same way the day combines meals.',
    combinedGroups:
      'Workouts from the same kind of source are added together, then the sources are combined as the square root of the sum of squares.',
    groupLine: (source: string, spread: string) => `${source}: ±${spread} kcal`,
    combinedLine: (spread: string, total: string, pct: string, score: string) =>
      `Burned: ±${spread} kcal on ${total} kcal, a typical error of ${pct}%, so an estimate score of ${score}.`,
    // Burned's own wording for the design-target line.
    designTargets:
      "These ranges are design targets, meant to catch about 8 in 10 and 19 in 20 workouts like this. HowSure hasn't measured its own hit rate.",
    how: (pct: string) =>
      `With burned’s typical error e = ${pct}%: likely runs from burned ÷ (1 + e)^1.2816 to burned × (1 + e)^1.2816, and very likely uses 1.96 in place of 1.2816. The ranges never go below 0.`,

    // A workout's details.
    caloriesUnknown: 'Calories burned unknown',
    unknownNote:
      'With its calories unknown, this workout has no estimate score or range and is left out of burned and net. It is listed under Missing information.',
    started: 'Started',
    durationLabel: 'Duration',
    source: 'How you know',
    sourceLine: (label: string, pct: string) => `${label} · typical error ${pct}%`,
    scoreMeans: (score: string, pct: string) =>
      `A ${score}% estimate score means this source is assigned a typical error of about ${pct}%. It does not mean there is a ${score}% chance this number is correct. The actual error could be larger.`,
    basisLabel: 'Where the typical error comes from',
    edit: 'Edit',
    delete: 'Delete',
    confirmDelete: (name: string) => `Delete ${name}? It leaves this day and its burned and net totals. This can’t be undone.`,
    keep: 'Keep it',
    deleteConfirm: 'Delete workout',
  },

  // Build-out item 2.6 (slice 26; prd.md > Gym Log): a workout's gym sets, the day's gym summary on
  // the dashboard, and the gym log of every session. A blank weight is "no weight logged", never 0.
  gym: {
    sectionTitle: 'Gym',
    logSession: 'Log a gym session',
    titleNew: 'Log a gym session',
    addSets: 'Add gym sets',
    addSetsHint: 'Exercises, with each set’s weight, reps and type.',
    setsTitle: 'Gym sets',
    removeSets: 'Remove gym sets',
    setsRemoved: 'The gym sets will be removed when you save.',
    keepSets: 'Keep the gym sets',
    nameHint: 'For a gym session, its split or name, such as Push.',
    unitLegend: 'Weights in',
    units: { kg: 'kg', lb: 'lb' },
    unitHint: 'Changing the unit converts the weights already typed. The gym log shows weights in the unit of your latest session; your weigh-ins keep their own unit.',
    copyLast: 'Copy last session',
    copyLastFrom: (name: string, when: string, exercises: string) => `Starts from ${name}, ${when}: ${exercises}.`,
    copied: (name: string, when: string) => `Copied from ${name}, ${when}. Change anything before saving.`,
    exercise: (n: number) => `Exercise ${n}`,
    exerciseHint: 'Its name, such as Bench press. The same name links it to earlier sessions.',
    removeExercise: (n: number) => `Remove exercise ${n}`,
    removeExerciseShort: 'Remove exercise',
    // After Remove exercise on one with something typed: what went, and a way back until Save.
    exerciseRemoved: (name: string, sets: string) => `Removed ${name}, with ${sets}.`,
    exerciseRemovedUnnamed: (n: number, sets: string) => `Removed exercise ${n}, with ${sets}.`,
    undoRemove: 'Undo',
    undoRemoveLabel: (name: string) => `Undo: put back ${name}`,
    addExercise: 'Add exercise',
    head: { n: 'Set', kind: 'Type', weight: (unit: string) => `Weight (${unit})`, reps: 'Reps' },
    setKindLabel: (n: number) => `Set ${n} type`,
    setWeightLabel: (n: number, unit: string) => `Set ${n} weight (${unit})`,
    setRepsLabel: (n: number) => `Set ${n} reps`,
    removeSet: (n: number) => `Remove set ${n}`,
    removeMark: '×',
    addSet: 'Add set',
    addSetLabel: (exercise: string) => `Add a set to ${exercise}`,
    addSetHint: '“Add set” copies the set above, ready to change.',
    drop: (n: number) => `Drop ${n}`,
    dropWeightLabel: (set: number, n: number, unit: string) => `Set ${set}, drop ${n} weight (${unit})`,
    dropRepsLabel: (set: number, n: number) => `Set ${set}, drop ${n} reps`,
    removeDrop: (set: number, n: number) => `Remove drop ${n} of set ${set}`,
    addDrop: 'Add drop',
    addDropLabel: (set: number) => `Add a drop to set ${set}`,
    kinds: { warmup: 'Warm-up', working: 'Working', drop: 'Drop set' },
    weightHint: 'Leave a weight blank for a set with no weight, such as a bodyweight set.',
    // Messages.
    nameNeeded: 'Name the exercise.',
    setNeeded: 'Add a set, or remove the exercise.',
    exerciseNeeded: 'Add an exercise, or use “Remove gym sets”.',
    repsNeeded: 'Type the reps.',
    repsWhole: 'Reps are a whole number from 1 to 1,000.',
    weightZero: 'A weight of 0 isn’t used. Leave it blank for a set with no weight.',
    weightTooBig: (limit: string) => `That is more than ${limit}. Check the number.`,
    weightTooSmall: 'That is less than 0.01. Check the number, or leave it blank for a set with no weight.',
    dropNotLighter: 'This drop isn’t lighter than the weight before it.',
    fixToSave: 'To save, give each exercise a name and each set its reps, and fix any line marked above.',
    // A set as text: "80 kg × 8", "12 reps, no weight logged", a drop set "60 kg × 10, then 45 kg × 8".
    // No-break spaces keep "80 kg × 8" and "12 reps" on one line; a line breaks only between parts.
    weight: (n: string, unit: string) => `${n}\u00a0${unit}`,
    setWeighted: (weight: string, reps: string) => `${weight}\u00a0×\u00a0${reps}`,
    setNoWeight: (reps: string) => (reps === '1' ? '1\u00a0rep, no weight logged' : `${reps}\u00a0reps, no weight logged`),
    dropThen: ', then ',
    exercises: (n: number) => (n === 1 ? '1 exercise' : `${n} exercises`),
    sets: (n: number) => (n === 1 ? '1 set' : `${n} sets`),
    kindCount: {
      warmup: (n: number) => `${n} warm-up`,
      working: (n: number) => `${n} working`,
      drop: (n: number) => (n === 1 ? '1 drop set' : `${n} drop sets`),
    },
    countsJoin: ', ',
    setsWithKinds: (sets: string, kinds: string) => `${sets} (${kinds})`,
    // Best working set: from earlier sessions only.
    bestBefore: (set: string, date: string) => `Previous best: ${set} (${date})`,
    bestFirst: 'Previous best: none, first time logged',
    bestNoWorking: 'Previous best: none yet (no earlier working set)',
    bestRule:
      'Previous best is the heaviest working set of that exercise in earlier sessions, with the most reps at that weight. Warm-ups and drop sets are left out, and nothing is estimated.',
    topSet: (set: string) => `Top working set ${set}`,
    noWorkingSet: 'No working set',
    // The dashboard summary.
    summaryMeta: (time: string, exercises: string, sets: string) => `${time} · ${exercises} · ${sets}`,
    // The dashboard row's accessible name: its name, meta line and each exercise's line, as shown.
    summaryLabel: (name: string, meta: string, exercises: string) => `${name}, ${meta}. ${exercises} Opens the workout details with every set.`,
    summaryExerciseLabel: (name: string, text: string) => `${name}: ${text}.`,
    allSessions: 'Gym log',
    allSessionsLabel: 'Gym log: every gym session, by date',
    // The gym log.
    historyTitle: 'Gym log',
    historySub: (n: number) => (n === 1 ? '1 gym session' : `${n} gym sessions`),
    search: 'Find an exercise or split',
    searchHint: 'For example bench press, or Push.',
    none: 'No gym sessions logged yet. Use “Log a gym session”, or “Add gym sets” in a workout.',
    noMatch: (q: string) => `No gym session has “${q}” as its split or an exercise.`,
    matches: (n: number, total: number) => (n === total ? '' : `${n} of ${total} sessions match.`),
    showMore: (n: number) => `Show ${n} more`,
    openSession: (name: string, when: string) => `${name}, ${when}. Opens the workout details.`,
    exerciseSets: (name: string) => `${name} sets`,
  },

  // Build-out item 2.5a: Eaten under the net headline opens the day's meals, each opening its breakdown.
  eaten: {
    title: 'Eaten today',
    titleEarlierDay: 'Eaten that day',
    // Every meal has calories: the count, as Burned's detail says it. Some don't: the known total.
    sub: (n: number) => (n === 1 ? 'From 1 logged meal' : `From ${n} logged meals`),
    subKnownOnly: (kcal: string) => `${kcal} kcal from the known meals`,
    intro: 'Tap a meal for its breakdown.',
    none: 'No meals logged on this day.',
    // Build-out item 2.9: the daily target, so the Panel ring's share ("95% of 2,400") has a detail.
    targetLabel: 'Daily target',
    // Read under the target's own line, so the figure is not said twice.
    targetShare: (pct: string) => `The best estimate is ${pct}% of it.`,
    targetShareKnownOnly: 'Not compared while a meal has no calories.',
    changeTarget: 'Change targets',
  },

  // Build-out item 2.9: a macro's detail, opened from the macro row (each look). Blank is never 0;
  // there is no macro range yet (prd.md > Ranges for Protein, Carbs and Fat is a later tier).
  macroDetail: {
    title: (macro: string) => macro,
    sub: (n: number) => (n === 1 ? 'From 1 logged meal' : `From ${n} logged meals`),
    subEarlierDay: (n: number) => (n === 1 ? 'That day, from 1 logged meal' : `That day, from ${n} logged meals`),
    // A day with no meals (for example after deleting its last one from here): no total, never 0 g.
    noMeals: 'No meals logged',
    noMealsLine: 'No meals are logged on this day, so there is no total yet.',
    targetNoMeals: 'Not compared while no meals are logged.',
    knownOnly: 'Known meals only',
    rounded: (grams: string) => `Shown on the dashboard as ${grams}, rounded to the gram.`,
    missingLine: (n: number, macro: string, total: string) =>
      n === 1
        ? `1 meal has no ${macro} value, so the day’s total is at least ${total}.`
        : `${n} meals have no ${macro} value, so the day’s total is at least ${total}.`,
    allUnknown: (macro: string) => `No meal on this day has a ${macro} value, so the total is unknown, not 0.`,
    rangeTitle: 'Range',
    noRange: 'No range yet: ranges cover calories only for now. This total adds up the values entered for each meal.',
    unknownsTitle: 'Meals with no value',
    unknownsHow: (macro: string) =>
      `A meal with no ${macro} value is left out of the total and counted as missing, never as 0 g.`,
    targetTitle: 'Daily target',
    target: (grams: string) => `${grams} g`,
    // Read under the target's own line ("130 g"), so the figure is not said twice.
    targetShare: (pct: string) => `The day’s total is ${pct}% of it.`,
    targetShareKnownOnly: (pct: string) => `The day’s total is at least ${pct}% of it: the meals with no value could add more.`,
    targetUnknown: 'Not compared while the total is unknown.',
    noTarget: (macro: string) => `No ${macro} target set.`,
    setTargets: 'Set targets',
    changeTargets: 'Change targets',
    mealsTitle: 'By meal',
    mealsIntro: 'Each meal’s value as entered, with how you know it and its share of the known total.',
    share: (pct: string) => `${pct}%`,
    // The share in a meal's spoken name, where the column's heading isn't read with it.
    shareSpoken: (pct: string) => `${pct}% of the known total`,
    noValue: 'no value',
    rowLabel: (meal: string, meta: string, value: string) => `${meal}, ${meta}, ${value}. Opens the meal details.`,
    // The macro on the dashboard: a button that opens this detail.
    openLabel: (macro: string, value: string) => `${macro} ${value}. Opens the ${macro.toLowerCase()} detail.`,
  },

  // Build-out item 2.9: the sleep detail, opened from last night and the 7-night average (each look).
  sleepDetail: {
    title: 'Sleep',
    sub: (day: string) => `The nights up to the wake on ${day}`,
    subProvisional: 'This day has no wake time yet',
    // The current day while asleep: the list starts with the sleep going on.
    subAsleep: (day: string) => `The sleep going on now, and the nights up to the wake on ${day}`,
    now: 'Now',
    wentToSleep: 'Went to sleep',
    woke: 'Woke',
    lastNightNone: 'No night is logged that ended at this day’s wake time.',
    // The provisional day, before any wake time: there is no wake for a night to end at.
    lastNightNoneYet: 'No night is logged yet.',
    eachNight: 'Each night',
    averageTitle: '7-night average',
    averageHow:
      'The mean length of the nights with both a sleep time and a wake time. A night with either time not logged is left out, never counted as 0.',
    source: 'From the sleep and wake times in this log.',
    openLabel: (what: string) => `${what}. Opens the sleep details.`,
    // The sleep section's two rows as one button: what they show, then what opens.
    rowsLabel: (lastLabel: string, last: string, avgLabel: string, avg: string, count?: string | null) =>
      `${lastLabel} ${last}, ${avgLabel} ${avg}${count ? `, ${count}` : ''}. Opens the sleep details.`,
  },

  // Build-out item 2.9: the foods stored on a meal (spec.md > Data Model: meals.foods, meals.lookup).
  foods: {
    title: 'Foods in this meal',
    servings: (n: string) => (n === '1' ? '1 serving' : `${n} servings`),
    amount: (n: string, unit: string) => `${n} ${unit}`,
    fiber: (grams: string) => `fiber ${grams} g per 100 g`,
    // After the note, when a food lists fiber: it has no source of its own.
    fiberNote: 'Fiber per 100 g is as it was saved with the food, with no source saved for it.',
    // The list is stored with the meal and no editor changes it yet: after an edit it may no longer
    // match the meal's name, so the details say so in every state.
    keptNote: 'This list is kept as it was saved with the meal: “Edit” does not change it yet.',
    note: (source: string) =>
      `Listed as parts of the meal. The calories and macros above are the meal’s own totals, from how you know them: ${source}. No food here has its own calories or macros.`,
    noteNoSource: 'Listed as parts of the meal. The calories and macros above are the meal’s own totals. No food here has its own calories or macros.',
    lookupTitle: 'Lookup',
    lookupKind: { barcode: 'Barcode lookup', foodSearch: 'Food search' },
    lookupSaved: 'saved result',
    lookupAmount: {
      weighed: 'amount weighed',
      package: 'whole package',
      portion: 'a portion',
    },
    lookupGrams: (grams: string) => `${grams} g`,
    lookupFetched: (date: string) => `fetched ${date}`,
    lookupCredit: (credit: string) => `Credit: ${credit}`,
    lookupUnused: (source: string) => `Not used now: this meal’s values come from ${source}, not from this lookup.`,
    lookupUnusedNoSource: 'Not used now: no source is picked for this meal.',
    lookupKindLower: { barcode: 'a barcode lookup', foodSearch: 'a food search' },
    lookupMismatch: (source: string, kind: string) =>
      `Does not match: this meal’s values are marked ${source}, which ${kind} does not give, so they may not come from this lookup.`,
  },

  // prd.md > Sleep and Waking Days. A missing sleep or wake time is "not logged", never 0 h.
  sleep: {
    title: 'Sleep',
    awake: 'Awake',
    asleepSince: (when: string) => `Asleep since ${when}`,
    goingToSleep: 'I’m going to sleep',
    wokeUp: 'I woke up',
    lastNight: 'Last night',
    nightBefore: 'Night before this day',
    average: '7-night average',
    nightCount: (complete: string, total: string) => `${complete} of ${total} ${total === '1' ? 'night' : 'nights'}`,
    notLogged: 'not logged',
    notAvailable: 'Not available yet',
    duration: (h: string, m: string) => `${h} h ${m} min`,
    eachNight: 'Each night',
    nightRow: (weekday: string) => `Night before ${weekday}`,
    noNights: 'No nights logged yet.',
    leftOut: 'Nights marked “not logged” are left out of the average.',
    avgWake: (time: string) => `Average wake time ${time}`,
    wakeVaries: 'Wake times vary too much to average',
    sheetSleepTitle: 'Going to sleep',
    sheetWakeTitle: 'Woke up',
    when: 'Date and time',
    whenHint: STARTS_AT_NOW,
    closesDay: (day: string) => `This closes the waking day that started ${day}.`,
    startsDay: 'This starts a new, empty waking day.',
    // When entries after the wake time move to the new day, so it is not empty.
    startsDayWithMoves: 'This starts a new waking day.',
    // Meals and any other dated entry (a workout), as the sleep and wake editor's move warning counts them.
    moves: 'These entries are after that time, so they move to the new day:',
    demoAdvance: 'This is later than the demo’s clock, so the demo moves forward to it.',
    save: 'Save',
    cancel: 'Cancel',
    errors: {
      notATime: 'Pick a date and time.',
      wakeBeforeSleep: (when: string) =>
        `Waking up has to come after going to sleep (${when}). Nothing was saved; change the time and try again.`,
      sleepBeforeWake: (when: string) =>
        `Going to sleep has to come after the last wake time (${when}). Nothing was saved; change the time and try again.`,
      overlap: (night: string) => `That overlaps another recorded night (${night}). Nothing was saved.`,
      needsWake: (night: string) =>
        `A later night is already recorded (${night}), so this one needs a wake time. Nothing was saved.`,
      future: 'That time is later than now. Pick a time up to now.',
    },
    // A night's two ends, for the messages above and the delete confirmation.
    nightRange: (sleep: string, wake: string) => `${sleep} to ${wake}`,
    nightRangeNoSleep: (wake: string) => `sleep time not logged, woke ${wake}`,
    nightRangeOpen: (sleep: string) => `asleep since ${sleep}, no wake time yet`,
    // Build-out item 2.2: a time field takes shorthand ("8", "8am", "8:15 pm", "20:30").
    timePlaceholder: 'e.g. 7:30 am',
  },

  // Build-out item 2.2 (checklist slice 6; prd.md > Editing Sleep and Wake Times): the sleep and
  // wake editor. Explicit dates and times, the order check next to each field, a missed night,
  // deleting a wrong one, and the move warning before any entry changes day.
  sleepEditor: {
    titleEdit: 'Edit this night',
    // A sleep with no wake time yet, matching the button that opens it.
    titleOpen: 'Edit this sleep',
    titleAdd: 'Add a missed night',
    // `day` is the wake's weekday and date ("Thu Nov 5"), so two nights a week apart differ.
    introEdit: (day: string) => `The night before ${day}. Change either time. A blank sleep time means it wasn’t logged.`,
    // A sleep with no wake time yet: it is named by when it started.
    introOpen: (when: string) =>
      `The sleep that started ${when} and is still going on. Type the wake time to end it, or change when it started.`,
    introAdd: 'For a night that wasn’t logged. Its wake time starts a new waking day.',
    // The latest night woke on an earlier date than today, so a night since may be missing.
    missedSince: (weekday: string) => `Slept since ${weekday}? Add that night with “Add a missed night” below.`,
    sleepLegend: 'Went to sleep',
    wakeLegend: 'Woke up',
    date: 'Date',
    time: 'Time',
    readsAs: (when: string) => `Reads as ${when}.`,
    // Shown when a bare hour from 1 to 12 was typed with no am or pm.
    typePm: 'Type pm for the evening.',
    typeAm: 'Type am for midnight.',
    sleepBlank: 'Blank: the sleep time isn’t logged.',
    wakeBlank: 'Blank: still asleep, so this must be the latest night.',
    length: (duration: string) => `${duration} of sleep.`,
    // Over 16 hours: often a bare hour read on the 24-hour clock ("11" is 11:00 AM). Saving is still allowed.
    longNight: 'That is a long night. Check AM and PM on both times.',
    errors: {
      time: 'Type a time like 8, 8am, 8:15 pm or 20:30.',
      date: 'Pick a date.',
      noTimes: 'Type a wake time, a sleep time, or both.',
      // The date fields start at MIN_NIGHT_DATE (sleepEdit.ts).
      dateRange: 'Pick a date in 2000 or later.',
      // The demo only: its clock moves forward to a later time, but not past the day after it.
      demoDateLimit: (day: string) => `In the demo, pick a date up to ${day}.`,
    },
    save: 'Save',
    cancel: 'Cancel',
    deleteNight: 'Delete this night',
    addMissed: 'Add a missed night',
    // The move warning: what changes day, and to which day, before anything is saved.
    movesTitle: 'Entries that change day',
    movesIntro: 'Saving this moves these entries to another waking day. Each keeps its own date and time.',
    movesGroup: (from: string, to: string) => `From ${from} to ${to}`,
    // `weekday` is "Tue", or "Tue Nov 3" when both days of a move share a weekday.
    day: (weekday: string, time: string) => `${weekday}’s day (woke ${time})`,
    dayNoWake: 'the day with no wake time',
    workout: 'workout',
    weighIn: 'weigh-in',
    movesSave: 'Save and move',
    movesBack: 'Change the times',
    // Deleting a night: asked first, with the move list when entries change day.
    deleteTitle: 'Delete this night?',
    // Neutral about whose log it is: the same words serve the demo and your own log.
    deleteIntro: (night: string) => `The night ${night} will be removed.`,
    deleteIntroOpen: (when: string) => `The sleep that started ${when} will be removed.`,
    deleteIntroNoSleep: (when: string) => `The night that ended ${when} (sleep time not logged) will be removed.`,
    deleteEffect: 'Sleep lengths and averages are worked out again without it.',
    deleteNoMoves: 'No entries change day.',
    deleteMovesIntro: 'Deleting it moves these entries to another waking day. Each keeps its own date and time.',
    deleteConfirm: 'Delete night',
    deleteKeep: 'Keep it',
    // The ways in: the header's wake time, Edit in the sleep section, each night, the timeline.
    edit: 'Edit',
    editWake: (line: string) => `${line}, edit the wake time`,
    editNight: (weekday: string) => `Edit the night before ${weekday}`,
    // Edit in the sleep section's head says which night it opens.
    editLastNight: 'Edit last night',
    editThisSleep: 'Edit this sleep',
    // The open sleep (asleep now), listed above the nights so it can be corrected too.
    asleepRow: (when: string) => `Asleep since ${when}`,
    editAsleep: (when: string) => `Edit the sleep since ${when}`,
    // The Night timeline's last point on an earlier day: the night after that day.
    editNightFrom: (when: string) => `Edit the night that started ${when}`,
    editNightNoStart: 'Sleep time not logged. Edit the night after this day',
  },

  // prd.md > Previous Days.
  nav: {
    label: 'Waking days',
    previous: 'Previous',
    next: 'Next',
    pickDate: 'Go to a date',
    backToToday: 'Back to today',
  },

  sheet: {
    close: 'Close',
    moreDetail: 'More detail',
  },

  storage: {
    // spec.md > Important Failure Modes, word for word.
    blocked: "Can't save on this device right now; your changes will be lost on reload.",
    // spec.md > Store: a failed parse says so and never silently wipes.
    unreadable: "Couldn't read saved data. It has been left as it was, and changes made now won't be saved over it.",
    // Build-out item 1.1: a log saved by a newer version of HowSure is never written over.
    newer:
      "This log was saved by a newer version of HowSure, so this version can't open it. It has been left as it was, and changes made now won't be saved over it.",
    // Shown after `blocked` in your own log: spec.md > Important Failure Modes ends with it.
    exportToKeep: 'Export to keep them.',
    // Shown after `unreadable` or `newer` in your own log (spec.md > Store: "Export still works").
    exportStillWorks: 'You can still export it from Profile and privacy.',
  },

  // prd.md > Privacy Panel and build-out item 1.2: Export, Import and Delete for your own log.
  privacy: {
    title: 'Profile and privacy',
    savedHere: 'Saved on this device only',
    savedHereDetail: 'Your log is kept in this browser on this device.',
    and: 'and',
    meals: (n: number) => (n === 1 ? '1 meal' : `${n} meals`),
    nights: (n: number) => (n === 1 ? '1 night of sleep' : `${n} nights of sleep`),
    workouts: (n: number) => (n === 1 ? '1 workout' : `${n} workouts`),
    plates: (n: number) => (n === 1 ? '1 saved plate' : `${n} saved plates`),
    // Build-out item 2.3: meals saved as usual.
    savedMeals: (n: number) => (n === 1 ? '1 saved meal' : `${n} saved meals`),
    // Build-out item 2.4.
    weighIns: (n: number) => (n === 1 ? '1 weigh-in' : `${n} weigh-ins`),
    span: (from: string, to: string) => (from === to ? `On ${from}` : `From ${from} to ${to}`),
    noTimes: 'No meals or sleep logged yet.',

    exportTitle: 'Export my data',
    exportHint: 'Downloads your log as one JSON file, so you can keep a copy or move it to another device.',
    exportButton: 'Export my data',
    exportUnreadable:
      "Your saved log can't be read by this version of HowSure, so the file holds the saved text as it is, unchanged.",
    exportReady: (file: string) => `Export ready: ${file}`,
    olderCopiesHint:
      'HowSure kept older copies of your log when it updated the saved format. They are deleted with your data.',
    olderCopiesOriginalHint:
      "Your saved log is still in its older format, because HowSure couldn't back it up when it updated it. This file holds that copy, unchanged. It is deleted with your data.",
    olderCopiesButton: (n: number) => (n === 1 ? 'Export 1 older copy' : `Export ${n} older copies`),

    importTitle: 'Import a log',
    importHint:
      'Replaces your log on this device with one from a HowSure export file. You see what the file holds before anything changes.',
    importButton: 'Choose a file to import',
    importBlockedUnreadable:
      "Your saved log can't be read by this version of HowSure, so importing would replace it. Export it first to keep a copy, then delete it, then import.",
    importBlockedNotBackedUp:
      "Your saved log couldn't be backed up when HowSure updated it, so importing would replace the only copy of it in its older format. Export your log and the older copy first, then delete it, then import.",
    previewTitle: 'Check before importing',
    previewFile: (file: string) => `File: ${file}`,
    previewHolds: 'The file holds',
    previewName: (name: string) => `Guest name: ${name}`,
    previewUpgraded: (v: string) => `Saved in format version ${v}. It is updated to this version as it is imported.`,
    previewReplaces: (what: string) =>
      `Importing replaces your log on this device, which holds ${what}, and your guest name, targets, body details and settings. Export it first if you want to keep it.`,
    previewReplacesEmpty:
      'Importing replaces your guest name, targets, body details and settings on this device. Your log has no meals or sleep yet.',
    importConfirm: 'Replace my log',
    importCancel: 'Cancel',
    imported: (what: string) => `Imported. Your log now holds ${what}.`,
    importErrors: {
      notRead: "The file couldn't be opened. Nothing was changed. Try choosing it again.",
      tooLarge:
        'This file is too large to be a HowSure log. Nothing was changed. Choose the file Export made, named like howsure-log-2026-11-05.json.',
      unreadable:
        "HowSure couldn't read this file as a log. Nothing was changed. Choose the file Export made, named like howsure-log-2026-11-05.json.",
      newer:
        "This file was saved by a newer version of HowSure, so this version can't read it. Nothing was changed. Open it in the newer version, or update HowSure and try again.",
      demo: "This file holds the fictional demo, not your own log, so it wasn't imported. Nothing was changed. Choose an export of your own log.",
      notSaved: "Couldn't save the imported log on this device right now. Nothing was changed. Free some space in this browser, then try again.",
    },

    deleteTitle: 'Delete my data',
    deleteHint: 'Removes your log from this device. The fictional demo is not affected.',
    deleteButton: 'Delete my data',
    confirmTitle: 'Delete your log from this device?',
    confirmDeletes: 'This deletes',
    confirmProfile: 'your guest name, targets, body details and settings',
    confirmUnreadable: "your saved log, which this version of HowSure can't read",
    confirmUnsaved: (what: string) => `${what} on screen, which were never saved`,
    confirmOriginal: 'the older-format copy of your saved log, which was never backed up',
    confirmOlderCopies: (n: number) =>
      n === 1 ? '1 older copy kept when the saved format was updated' : `${n} older copies kept when the saved format was updated`,
    confirmKeeps: 'The fictional demo is not affected. This can’t be undone, so export first if you want a copy.',
    confirmButton: 'Delete my log',
    keep: 'Keep my log',
    deleted: 'Deleted. Your log on this device is now empty.',
    deletedNoStorage:
      "Cleared. Your log on screen is now empty. This browser isn't letting HowSure use its storage right now, so there was no saved copy it could reach.",
    deleteFailed: "Couldn't delete everything on this device right now. Try again. The fictional demo is not affected.",
  },

  // Build-out item 1.3: the dashboard's More menu (spec.md > Screens: Tier 3 screens are reached
  // from it). Each entry has a label and one line saying what it opens.
  moreMenu: {
    button: 'More',
    title: 'More',
    profile: 'Profile and privacy',
    profileHint: 'Export, import or delete your log.',
    targets: 'Targets',
    targetsHint: 'Your daily calories, protein, carbs and fat.',
    targetsHintDemo: 'Sam’s daily targets, which are made up.',
    // Build-out item 2.6: the gym log, in both logs.
    gym: 'Gym log',
    gymHint: 'Every gym session by date, found by exercise or split, with each set.',
    // Build-out item 2.3: saved meals, in both logs (the demo's stay in the demo).
    savedMeals: 'Saved meals',
    savedMealsHint: 'Rename or delete the meals you saved as usual.',
    // Build-out item 2.5b: body details, in both logs (the demo's stay in the demo).
    body: 'Body details',
    bodyHint: 'Age, sex, height, weight and everyday activity, for the estimated deficit or surplus.',
    bodyHintDemo: 'Sam’s made-up body details, for the estimated deficit or surplus.',
    // Build-out item 2.4: the weight details, in both logs.
    weight: 'Weight',
    weightHint: 'Your weigh-ins, the 7-day average and the trend.',
    // Build-out item 2.7: the week view, in both logs.
    week: 'Week',
    weekHint: 'The averages of every stat over up to 7 waking days, ending at the day on screen.',
    // Build-out item 2.1: in the demo only.
    resetDemo: 'Reset demo',
    resetDemoHint: 'Puts back Sam’s week as it started. Your own log is not affected.',
    fullScreenHint: 'Shows HowSure without the browser’s bars, using the whole screen.',
    // Build-out item 1.5.2: the Look sheet.
    look: 'Look',
    lookHint: (name: string) => `How the dashboard is drawn. Now: ${name}.`,
    exitFullScreenHint: 'Back to the normal view. Esc also works.',
    // The Fullscreen API was missing or refused: the page is widened instead.
    exitFallbackHint: 'Your browser kept its own bars, so HowSure widened the page instead. Esc also goes back.',
  },

  // Build-out item 1.5.2: the looks. Each one shows the same numbers, details and actions; only the
  // presentation differs. A look's name and one-line description show in the Look sheet.
  looks: {
    title: 'Look',
    intro: 'How the dashboard is drawn. The numbers, the details and what you can do are the same in every look.',
    legend: 'Choose a look',
    journal: {
      name: 'Journal',
      description: 'Light and warm, with the day’s ranges on one labelled bar.',
    },
    panel: {
      name: 'Panel',
      description: 'Tiles and rings: the day against your target at a glance, with the ranges beside it.',
    },
    night: {
      name: 'Night',
      description: 'Dark, with the waking day as a timeline from waking up to now.',
    },
  },

  // Build-out item 1.5.2b: words only the Panel look draws. The ring shows the best estimate only,
  // as a share of a target the person set; with no target it is not filled and says so.
  panel: {
    ringNote: 'The ring shows the best estimate only.',
    ringShare: (pct: string, target: string) => `${pct}% of ${target}`,
    // Read after ringShare by screen readers, so "95% of 2,400" is heard as a share of the target.
    ringShareHidden: ' kcal daily target',
    noTarget: 'No target',
    // An incomplete day: the known meals are only part of it, so the ring is not filled.
    ringKnownOnly: 'The ring is not filled until every meal has calories.',
    macroNoTarget: 'no target',
    biggestShare: (pct: string) => `${pct}% of the day’s uncertainty`,
    biggestShareKnownOnly: (pct: string) => `${pct}% of the known meals’ uncertainty`,
    // Build-out item 2.5a: with net in the centre, the ring keeps showing calories eaten against
    // the daily target, which is a target for eating. The number in the ring is labelled "kcal
    // net", and what the ring shows is said under the ring, apart from the number.
    ringNetUnit: 'kcal net',
    // Under the ring, before ringShare: "Ring: eaten, 95% of 2,400".
    ringEatenLead: 'Ring: eaten,',
    ringNoteEaten: 'The ring shows calories eaten (best estimate), not net, against your daily target for eating.',
    ringKnownOnlyEaten: 'The ring is not filled until every meal has calories.',
    // Build-out item 2.9: the spoken names of the ring and the line under it, which open details.
    ringOpenLabel: (what: string, opens: string) => `${what}. ${opens}`,
  },

  // Build-out item 1.5.2c: words only the Night look draws. The waking day is a timeline from the
  // wake to now (or to the sleep that closed it); the ranges are one line under the number, and
  // the score, target and macros are chips that each open their detail.
  night: {
    likely: 'likely',
    veryLikely: 'very likely',
    rangeEnds: (lo: string, hi: string) => `${lo}–${hi}`,
    // A net range with an end below 0: "−140 to 3,140", as the other looks write it.
    signedRangeEnds: (lo: string, hi: string) => `${lo} to ${hi}`,
    // Read after each range by screen readers; the number above already shows the unit.
    rangeUnitHidden: ' kcal',
    rangesNotAvailable: 'Ranges: not available yet',
    // Macro chip: "P 124 · C 272 · F 74 g". Its accessible name spells each macro out.
    macroLetters: { protein: 'P', carbs: 'C', fat: 'F' },
    macroChip: (parts: string) => `${parts} g`,
    macroPart: (letter: string, value: string) => `${letter} ${value}`,
    macrosMissing: 'entries missing',
    // Starts with the chip's own words, then spells each macro out.
    macroChipLabel: (shown: string, spoken: string) => `${shown}: ${spoken}. Shows each macro, its target and any missing entries.`,
    targetChipLabel: (target: string) => `Daily target ${target} kcal. Opens the targets editor.`,
    targetChipLabelEaten: (target: string) =>
      `Daily target ${target} kcal, compared with calories eaten. Opens the targets editor.`,
    // Build-out item 2.5a: eaten and burned as chips under the net headline.
    eatenChip: (kcal: string) => `Eaten ${kcal}`,
    burnedChip: (kcal: string) => `Burned ${kcal}`,
    timelineTitle: 'The waking day',
    wokeUp: 'Woke up',
    // The wake point's editor button (build-out item 2.9), before "edit the wake time".
    wokeAt: (time: string) => `Woke up ${time}`,
    slept: (duration: string) => `slept ${duration}`,
    sleepNotLogged: 'sleep not logged',
    score: (score: string) => `score ${score}`,
    noScore: 'no estimate score',
    biggest: 'biggest uncertainty',
    biggestKnownOnly: 'biggest uncertainty among the known meals',
    // A meal after midnight still belongs to the waking day it was eaten in.
    stillDay: (weekday: string) => `still ${weekday}’s day`,
    now: 'now',
    nowAwake: (time: string) => `${time}, awake`,
    wentToSleep: 'Went to sleep',
    sleepStartNotLogged: 'Went to sleep: time not logged',
    asleepNow: 'asleep now',
    average: (duration: string) => `7-night avg ${duration}`,
    averageNotAvailable: '7-night avg not available yet',
  },

  // Build-out item 1.3: the full-screen view switch. Its label names the view it goes to.
  fullScreen: {
    enter: 'Show full screen',
    exit: 'Exit full screen',
  },

  // Build-out item 1.3: the targets editor (spec.md > Data Model: profile.targets).
  // Blank means no target, never 0.
  targets: {
    title: 'Targets',
    subDemo: 'Sam’s targets are made up, like the rest of the demo.',
    intro: 'Daily numbers for calories, protein, carbs and fat. Leave a box blank for no target.',
    kcal: 'Calories (kcal)',
    protein: 'Protein (g)',
    carbs: 'Carbs (g)',
    fat: 'Fat (g)',
    save: 'Save targets',
    cancel: 'Cancel',
    errors: {
      negative: 'A target can’t be below 0. Type a number, or leave it blank for no target.',
      zero: 'A target of 0 isn’t used. Type a number above 0, or leave it blank for no target.',
    },
    // Shown on the dashboard where a target is set.
    headline: (kcal: string) => `Daily target ${kcal} kcal`,
    macro: (grams: string) => `Target ${grams} g`,
    // The Panel ring and the Night target chip.
    short: (kcal: string) => `Target ${kcal}`,
    // Build-out item 2.5a: once net is the headline, the target still compares with calories eaten.
    headlineEaten: (kcal: string) => `Daily target ${kcal} kcal, for calories eaten`,
    shortEaten: (kcal: string) => `Target ${kcal} for eaten`,
    setKcal: 'Set a calorie target',
  },

  // Build-out item 2.5b: body details for the resting-burn estimate (profile.body). A blank box is
  // not set, never guessed.
  body: {
    title: 'Body details',
    sub: 'For the estimated deficit or surplus. Saved with your log, on this device only.',
    subDemo: 'Sam’s body details are made up, like the rest of the demo.',
    intro:
      'HowSure estimates resting burn from these with the Mifflin-St Jeor equation. Leave a box blank to leave it out: nothing is guessed, and the estimate shows only once age, sex, height and weight are all in.',
    age: 'Age (years)',
    sex: 'Sex, for the equation',
    sexOptions: { female: 'Female', male: 'Male', unspecified: 'Prefer not to say' },
    sexHint: 'The equation has one value for women and one for men.',
    sexHintUnspecified: 'Prefer not to say uses the middle of the two values, with a wider range.',
    height: 'Height',
    heightCm: 'Height (cm)',
    heightFt: 'Feet',
    heightIn: 'Inches',
    units: { cm: 'cm', ftin: 'ft and in', kg: 'kg', lb: 'lb' },
    heightUnit: 'Height in',
    weight: 'Weight',
    weightKg: 'Weight (kg)',
    weightLb: 'Weight (lb)',
    weightUnit: 'Weight in',
    weighInHint: (w: string, when: string) => `Your ${when} weigh-in (${w}) is used while it is the latest. This weight counts when there is none.`,
    activity: 'Everyday activity, not counting workouts',
    activityOptions: {
      sitting: 'Mostly sitting',
      light: 'Some standing and walking',
      moderate: 'On your feet most of the day',
    },
    activityHints: {
      sitting: 'Desk work and little walking. The default.',
      light: 'Some of the day on your feet, such as errands or light chores.',
      moderate: 'Most of the day on your feet, such as shop or warehouse work.',
    },
    factor: (f: string) => `× ${f}`,
    activityNote: 'Workouts you log are added on top, so they are counted once.',
    save: 'Save body details',
    cancel: 'Cancel',
    clear: 'Clear all',
    errors: {
      age: 'Type an age from 18 to 120, in whole years. The equation is for adults.',
      heightCm: 'Type a height from 100 to 250 cm.',
      heightFtIn: 'Type a height from 3 ft 4 in to 8 ft 2 in.',
      inches: 'Inches run from 0 to 11.9.',
      feetMissing: 'Type the feet too, or clear the inches.',
      weightKg: 'Type a weight from 30 to 300 kg.',
      weightLb: 'Type a weight from 66 to 660 lb.',
    },
    // Values as shown in the explanation and in Profile and privacy.
    cmValue: (n: string) => `${n} cm`,
    ftInValue: (ft: string, inches: string) => `${ft} ft ${inches} in`,
    kgValue: (n: string) => `${n} kg`,
    lbValue: (n: string) => `${n} lb`,
    ageValue: (n: string) => `age ${n}`,
    // Profile and privacy's section.
    sectionHint: 'Used for the estimated deficit or surplus under the headline.',
    notSet: 'Not set yet.',
    edit: 'Edit body details',
    add: 'Add body details',
  },

  logMeal: {
    titleNew: 'Log a meal',
    titleEdit: (meal: string) => `Edit: ${meal}`,
    titleImprove: (meal: string) => `Improve: ${meal}`,
    improveTitle: 'What would improve it',
    currentSource: (label: string, pct: string) => `Now: ${label}, typical error ${pct}%`,
    yourNote: 'Your note',
    name: 'Meal name',
    nameNeeded: 'Give the meal a name.',
    howKnow: 'How do you know?',
    optionError: (pct: string) => `typical error ${pct}%`,
    suggested: 'suggested',
    pickSourceHint: 'Pick how you know, so HowSure can say how sure.',
    calories: 'Calories (kcal)',
    caloriesHint: 'Leave it blank if you don’t know. A typed 0 counts as zero.',
    dateTime: 'Date and time',
    dateTimeNeeded: 'Pick a date and time.',
    wakingDay: (day: string) => `Waking day: ${day}`,
    provisionalDay: 'Waking day: provisional (wake time not set)',
    otherDay: 'That time is on another waking day, so this meal won’t show on the day on screen.',
    optionalDetails: 'Optional details',
    protein: 'Protein (g)',
    carbs: 'Carbs (g)',
    fat: 'Fat (g)',
    note: 'Source or assumptions note',
    save: 'Save',
    cancel: 'Cancel',
  },

  // Build-out item 2.3: log a recent or saved meal again from the top of Log a meal. Tap 1 opens
  // the sheet, tap 2 logs the meal as a fresh entry with its own time, source and values.
  quickLog: {
    title: 'Log again',
    introNow: 'Tap a meal to log it again now, with the same source and values.',
    introOn: (when: string) => `Tap a meal to log it again on ${when}, with the same source and values.`,
    when: (weekday: string, time: string) => `${weekday} at ${time}`,
    amountLegend: 'Amount',
    amountTimes: (factor: string) => `×${factor}`,
    amountOther: 'Other',
    amountOtherLabel: 'Times the usual amount',
    amountError: 'Type a number from 0.1 to 10, such as 1.25 or 0.5.',
    // Shown while Other is chosen and its box is still blank: the meals can't be tapped until then.
    amountNeeded: 'Type an amount, then tap a meal to log it at that amount.',
    amountHint:
      'Calories, macros and both ranges scale with the amount. The source stays the same, so the typical error stays the same percentage.',
    recent: 'Recent',
    saved: 'Saved',
    savedEmpty: 'No saved meals yet. Open a meal and choose Save as a usual meal.',
    manageSaved: 'Rename or delete',
    manageSavedLabel: 'Rename or delete saved meals',
    // A non-breaking space, so the number and its unit stay on one line.
    kcal: (n: string) => `${n}\u00a0kcal`,
    kcalUnknown: 'Calories unknown',
    times: (factor: string, kcal: string) => `×${factor} of ${kcal}`,
    likely: (range: string) => `likely ${range}`,
    // Read out before the row's own words, so the button says what tapping it does.
    logPrefix: 'Log again:',
    orNew: 'Or fill in a new meal',
    logged: (meal: string, kcal: string) => `Logged ${meal}, ${kcal}.`,
    loggedUnknown: (meal: string) => `Logged ${meal}, calories unknown.`,
    undo: 'Undo',
    undoLabel: (meal: string) => `Undo logging ${meal}`,
    undone: (meal: string) => `Undone. ${meal} is no longer logged.`,
  },

  // Build-out item 2.3: meals saved as usual. Saved from a meal's details; renamed and deleted in
  // the Saved meals sheet (from More, or from Log a meal). Logged meals are never changed by it.
  usualMeals: {
    save: 'Save as a usual meal',
    saveHint: 'Keeps its name, source and values, so you can log it again from the top of Log a meal.',
    nameLabel: 'Name for the usual meal',
    confirm: 'Save',
    cancel: 'Cancel',
    nameNeeded: 'Give it a name.',
    nameTaken: (name: string) => `You already have a saved meal called ${name}. Pick another name.`,
    savedAs: (name: string) => `Saved as a usual meal: ${name}.`,
    // The meal was edited after it was saved: the saved meal still holds the values it had then.
    savedEarlier: (name: string, kcal: string) => `Saved earlier as ${name}, with the values this meal had then (${kcal}).`,
    updates: (name: string) => `Saving under this name updates ${name} to this meal’s values now.`,
    updated: (name: string) => `Saved meal updated: ${name}.`,
    manage: 'See saved meals',
    title: 'Saved meals',
    intro: 'The meals under Saved at the top of Log a meal. Renaming or deleting one leaves the meals you already logged as they are.',
    empty: 'No saved meals yet. Open a meal and choose Save as a usual meal.',
    rename: 'Rename',
    renameLabel: (name: string) => `Rename ${name}`,
    newName: 'New name',
    delete: 'Delete',
    deleteLabel: (name: string) => `Delete ${name}`,
    confirmDelete: (name: string) => `Delete the saved meal ${name}? Meals you already logged stay in your log.`,
    keep: 'Keep it',
    deleteConfirm: 'Delete saved meal',
    renamed: (from: string, to: string) => `Renamed ${from} to ${to}.`,
    deleted: (name: string) => `Deleted the saved meal ${name}. Meals you already logged are unchanged.`,
    meta: (kcal: string, source: string) => `${kcal} · ${source}`,
  },

  // Build-out item 2.4 (prd.md > Weight Log, checklist slice 20): weigh-ins with a unit, the 7-day
  // average with its count, and the trend over 21 days, which describes the past and is never a
  // prediction. Weights are shown in the unit chosen (settings.weightUnit), stored in kg.
  weight: {
    title: 'Weight',
    logWeight: 'Log weight',
    noWeighInToday: 'No weigh-in today',
    noWeighInThatDay: 'No weigh-in that day',
    noWeighInsYet: 'No weigh-ins yet.',
    // A non-breaking space, so the number and its unit stay on one line.
    value: (n: string, unit: string) => `${n}\u00a0${unit}`,
    unitName: { kg: 'kg', lb: 'lb' },
    at: (time: string) => `at ${time}`,
    when: (date: string, time: string) => `${date}, ${time}`,
    approxTime: 'time not recorded',
    // After the weight on the dashboard, in brackets so it never runs on from the number.
    approxTimeAfter: '(time not recorded)',
    moreThisDay: (n: number) => (n === 1 ? '1 more weigh-in this day' : `${n} more weigh-ins this day`),
    average: '7-day average',
    averageOf: (n: number) => (n === 1 ? 'average of 1 weigh-in' : `average of ${n} weigh-ins`),
    // A status sentence, drawn in normal weight where the average would be. Today and an earlier day
    // differ. "weigh-ins" has a word joiner (U+2060) after its hyphen, so it never splits.
    averageNone: 'No weigh-\u2060ins in the last 7 days',
    averageNoneThen: 'No weigh-\u2060ins in the 7 days to the end of that day',
    // An earlier day that ran on for days (no sleep logged in between): its real end is named.
    averageNoneTo: (when: string) => `No weigh-\u2060ins in the 7 days to ${when}, when that day ended`,
    trend: 'Trend',
    trendDown: (n: string, unit: string) => `down ${n} ${unit} a week`,
    trendUp: (n: string, unit: string) => `up ${n} ${unit} a week`,
    trendLevel: (unit: string) => `about level, under 0.1 ${unit} a week`,
    trendFrom: (n: number) => `from ${n} weigh-ins in 21 days`,
    // While the trend needs more weigh-ins: the count is the value, the rule is its note. The note
    // names both conditions (count and spread), so the value is never the whole story when it isn't.
    trendNeedsMore: (n: number) => (n === 1 ? '1 more weigh-in needed' : `${n} more weigh-ins needed`),
    // A word joiner (U+2060) after the hyphen in "weigh-ins", so a narrow phone never splits the word
    // (a no-break hyphen glyph is missing from some fonts and left a gap).
    trendRule: 'shown from 6 weigh-\u2060ins in 21 days, over at least 4 days',
    // Enough weigh-ins, but over too few days for a weekly rate (6 in one morning would read noise as a trend).
    trendNeedsSpan: 'needs weigh-\u2060ins spread over 4 days',
    // How far apart the first and last are, exactly: "under 3 days" for 2.5, never a rounded-down "2 days".
    trendSpanNote: (n: number, spanDays: number) => {
      if (!(spanDays > 0)) return `these ${n} all have the same time`
      const days = (d: number) => (d === 1 ? '1 day' : `${d} days`)
      return Number.isInteger(spanDays) ? `these ${n} span ${days(spanDays)}` : `these ${n} span under ${days(Math.ceil(spanDays))}`
    },
    // prd.md > Weight Log, word for word (with a capital and a full stop).
    swings: 'Daily weight swings with water and food; watch the trend.',
    notPrediction: 'The trend describes your past weigh-ins. It is not a prediction.',
    averageMethod: 'The 7-day average is the mean of your weigh-ins in the last 7 days.',
    averageMethodThen: 'The 7-day average is the mean of your weigh-ins in the 7 days to the end of that day.',
    trendMethod:
      'HowSure’s calculation from your weigh-ins: a straight line fitted by least squares through the last 21 days, given per week. It is shown once there are 6 weigh-ins in that time, spread over at least 4 days.',
    trendMethodThen:
      'HowSure’s calculation from your weigh-ins: a straight line fitted by least squares through the 21 days to the end of that day, given per week. It is shown once there are 6 weigh-ins in that time, spread over at least 4 days.',
    // Read last by screen readers: the dashboard summary is one button that opens the details.
    openHidden: 'Opens your weigh-ins.',

    detailsSub: 'Your weigh-ins, the 7-day average and the trend.',
    latest: 'Latest',
    latestNone: 'None by then',
    // The current day, when every weigh-in is timed later than now (only an import can do that).
    latestNoneYet: 'None up to now',
    // On an earlier day the details are worked out as that day ended, and say so.
    asOfDay: (day: string) => `As of the end of ${day}, the day you are viewing.`,
    asOfDayRanOn: (day: string, end: string) =>
      `As of ${end}, when the day you are viewing ended. It started ${day} and ran on, as no sleep was logged in between.`,
    // The provisional day (before the log's first wake) ended at that wake, not at the end of its date.
    asOfProvisional: (end: string) => `As of ${end}, when the day you are viewing ended: it is the provisional day before your first recorded wake time.`,
    howTitle: 'How these are worked out',
    showIn: 'Show weights in',
    chartTitle: 'Last 30 days',
    chartTitleTo: (day: string) => `30 days to the end of ${day}`,
    chartTitleToWhen: (when: string) => `30 days to ${when}`,
    // A word joiner (U+2060) after the hyphen in "7-day", so the caption never splits it on a narrow phone.
    chartCaption: 'Dots are weigh-ins and the line is the 7-\u2060day average. Every weigh-in is listed below.',
    // When the line's first points count weigh-ins from before the 30 days (not drawn as dots).
    chartCaptionEarlier: 'Near the left edge, the line also counts weigh-ins from just before these 30 days.',
    chartNeedsTwo: 'The chart needs 2 weigh-ins in these 30 days.',
    listTitle: 'Every weigh-in',
    // On an earlier day the list still runs to the newest weigh-in: rows later than the viewed day say so.
    listLaterNote: 'This list runs past the day you are viewing; later weigh-ins are marked.',
    laterThanDay: 'after the day you are viewing',
    bodyFat: (pct: string) => `body fat ${pct}%`,
    // Read last by screen readers: each row opens that weigh-in.
    rowHidden: 'Opens it to edit or delete.',

    sheetNew: 'Log weight',
    sheetEdit: 'Edit weigh-in',
    weightLabel: 'Weight',
    unitLegend: 'Unit',
    // What the unit does: a number typed (a new weigh-in, or one typed over the saved weight) is read
    // in it; while the box still shows the saved weight, switching converts it.
    // A new weigh-in's unit always becomes how weights are shown; an edited one's only when it is
    // switched (weighInEdit.ts > unitToRemember), so the edit hints say "if you switch it".
    unitHintNew: 'The unit of the weight you type. Weights are then shown in it.',
    unitHintEdit: 'Switching the unit converts the saved weight in the box, and weights are then shown in it.',
    unitHintTyped: 'The unit of the weight you type. If you switch it, weights are then shown in it.',
    whenLabel: 'Date and time',
    whenHint: STARTS_AT_NOW,
    whenHintDay: 'Starts on the day you are viewing. Change it if it was another time.',
    bodyFatLabel: 'Body fat % (optional)',
    noteLabel: 'Note (optional)',
    dayHint: (date: string, time: string) => `It goes in the waking day that started ${date}, ${time}.`,
    dayHintNoWake: 'No wake time is set yet, so it goes in the day you are logging now.',
    // Before the log's first wake: the provisional day, named by the wake it ends at.
    dayHintBeforeFirstWake: (date: string, time: string) =>
      `It is before your first recorded wake time, ${date}, ${time}, so it goes in the provisional day that ends then.`,
    // The time an import gave a weigh-in whose time was not recorded (trackerWeighIns.ts).
    approxNote: (time: string) => `The time was not recorded, so it was set to ${time} on its date. Change it if you know it.`,
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirmDelete: (weight: string, when: string) => `Delete the weigh-in of ${weight} on ${when}?`,
    deleteConfirm: 'Delete weigh-in',
    keep: 'Keep it',
    errors: {
      weightNeeded: 'Type your weight.',
      digits: 'Use digits, e.g. 72.5',
      range: (lo: string, hi: string, unit: string) => `Type a weight from ${lo} to ${hi} ${unit}.`,
      bodyFat: 'Body fat is a percentage above 0 and below 100. Leave it blank if you don’t know it.',
      notATime: 'Pick a date and time.',
      future: 'That time is later than now. Pick a time up to now.',
    },
  },

  preview: {
    title: 'Before and after',
    before: 'Before',
    after: 'After',
    thisMeal: 'This meal',
    theDay: 'The day',
    calories: 'Calories (kcal)',
    caloriesKnownOnly: 'Calories, known meals only (kcal)',
    typicalError: 'Typical error',
    score: 'Estimate score',
    likely: 'Likely',
    veryLikely: 'Very likely',
    unknown: 'unknown',
    notAvailable: 'Not available yet',
    pending: '—',
    appliesOnSave: 'Nothing changes until you tap Save.',
    waiting: 'Fix the field marked above to see the after column.',
    leavesDay: 'The new time is on another waking day, so this meal would leave this day.',
    biggestAfter: (meal: string) => `After saving, most uncertainty would come from ${meal}.`,
    biggestAfterKnownOnly: (meal: string) => `After saving, among the known meals, most uncertainty would come from ${meal}.`,
    biggestAfterAlreadyBest: 'It already uses the most reliable source.',
  },

  details: {
    calories: 'Calories',
    caloriesUnknown: 'Calories unknown',
    // prd.md > Days With Unknown Calories: no invented number, listed under Missing information.
    unknownNote:
      'With its calories unknown, this meal has no estimate score or range and is left out of the day’s total. It is listed under Missing information.',
    unknown: 'unknown',
    source: 'How you know',
    sourceNotPicked: 'not picked',
    noteTitle: 'Assumptions or note',
    noNote: 'No note.',
    improveUnknown: 'Adding its calories, and how you know them, would let HowSure count it and say how sure.',
    edit: 'Edit',
    delete: 'Delete',
    confirmDelete: (meal: string) => `Delete ${meal}? It leaves this day and every total. This can’t be undone.`,
    keep: 'Keep it',
    deleteConfirm: 'Delete meal',
  },

  input: {
    // The kernel owns this message (it can't import UI code); re-exported so copy.ts stays the one place for words.
    parseError: PARSE_ERROR_MESSAGE,
  },

  basis: {
    assumption: 'assumption',
    study: 'study',
    checkedOn: (date: string) => `re-checked ${date}`,
    nearestStudy: (context: string) => `Nearest study: ${context}`,
    doi: (doi: string) => `DOI ${doi}`,
    typicalError: (pct: string) => `typical error ${pct}%`,
    sourceLine: (label: string, pct: string) => `${label} · typical error ${pct}%`,
  },

  explainMeal: {
    title: (meal: string) => `How sure: ${meal}`,
    sub: (source: string, time: string) => `${source} · ${time}`,
    // prd.md > Estimate Score and Explanations, word for word, with the meal's own numbers.
    sentence: (score: string, errorPct: string) =>
      `A ${score}% estimate score means this source is assigned a typical error of about ${errorPct}%. It does not mean there is a ${score}% chance this meal is correct. The actual error could be larger.`,
    basisLabel: 'Where the typical error comes from',
    improveTitle: 'What would improve it',
    improveLine: (to: string, fromPct: string, toPct: string) =>
      `Logging it from "${to}" would lower the typical error from ${fromPct}% to ${toPct}%.`,
    noBetter: 'No better source in HowSure.',
    unknownKcal: 'This meal has unknown calories, so it has no estimate score or range. It is listed under Missing information instead.',
    detailCalories: 'Calories',
    detailSource: 'Source',
    detailTypicalError: 'Typical error',
    detailSpread: 'Typical spread (calories × typical error)',
    detailScore: 'Estimate score',
  },

  explainDay: {
    title: "How sure is today's total?",
    sub: (total: string) => `${total} kcal from the known meals`,
    // prd.md > Estimate Score and Explanations, word for word.
    sentence:
      "Each meal contributes calories and uncertainty. A large, uncertain meal can affect the total more than a small one. We combine those uncertainties and compare them with the day's total—we don't simply average the meal percentages.",
    dayFigure: (pct: string, total: string) => `Typical error about ${pct}% of ${total} kcal`,
    contributionsTitle: "Each meal's share of the uncertainty, biggest first",
    contributionShare: (pct: string) => `${pct}%`,
    contributionMeta: (kcal: string, source: string) => `${kcal} kcal · ${source}`,
    biggest: (meal: string) => `Biggest contributor: ${meal}`,
    biggestKnownOnly: (meal: string) => `Biggest contributor among the known meals: ${meal}`,
    wouldChange: (to: string, from: string, toScore: string) =>
      `Logging that meal from "${to}" instead, with the same calories, would move the day's estimate score from ${from} to ${toScore}.`,
    alreadyBest: 'That meal already uses the most reliable source in HowSure.',
    unknownNote: (n: number) =>
      n === 1
        ? '1 meal is left out: its calories are unknown, so no uncertainty is invented for it.'
        : `${n} meals are left out: their calories are unknown, so no uncertainty is invented for them.`,
    notAvailable: 'Not available yet: there are no meals with known calories on this day.',
    tableMeal: 'Meal',
    tableKcal: 'kcal',
    tableSource: 'Source',
    tableError: 'Typical error',
    tableSpread: 'Spread',
    combinedTitle: 'Combined result',
    combinedGroups:
      'Meals from the same kind of source are added together, then the sources are combined as the square root of the sum of squares.',
    groupLine: (source: string, spread: string) => `${source}: ±${spread} kcal`,
    combinedLine: (spread: string, total: string, pct: string, score: string) =>
      `Day: ±${spread} kcal on ${total} kcal, a typical error of ${pct}%, so an estimate score of ${score}.`,
  },

  explainRanges: {
    title: 'What the ranges mean',
    likelyLine: (value: string) => `Likely: ${value}`,
    veryLikelyLine: (value: string) => `Very likely: ${value}`,
    explanation:
      'The likely range is meant to catch the real total about 8 times in 10, and the very likely range about 19 times in 20. The likely range is not a guaranteed minimum and maximum.',
    widerFor:
      'Ranges are wider when the meals come from rougher sources: a photo estimate gives a wider range than a nutrition label or a weighed entry with the same calories.',
    // prd.md > Estimate Score and Explanations, word for word.
    planning: 'Staying under a target? Count the top of the very-likely range.',
    honesty: 'Not a guarantee. Photos, menus and even nutrition labels can be off. Scan the label or weigh it to tighten this.',
    howTitle: 'How the ranges are worked out',
    how: (pct: string) =>
      `With the day's typical error e = ${pct}%: likely runs from the total ÷ (1 + e)^1.2816 to the total × (1 + e)^1.2816, and very likely uses 1.96 in place of 1.2816. The ranges never go below 0.`,
    calcFromAssumption: "HowSure's calculation from the assumed typical errors below, not a finding of any study.",
    calcFromStudy: (study: string) => `HowSure's calculation from ${study}`,
    notAvailable: 'Not available yet: there are no meals with known calories on this day.',
  },

  // Build-out item 2.5a: ExplainSheet's net mode, opened from net's ranges (spec.md > Maths Core:
  // Net Calories): eaten's range, burned's range and how they combine, with the resting-burn note.
  explainNet: {
    title: 'What net calories mean',
    intro: 'Net is the calories you ate minus the calories burned in the workouts you logged.',
    net: 'Net',
    eaten: 'Eaten',
    burned: 'Burned',
    total: (kcal: string) => `${kcal} kcal`,
    likelyOf: (range: string) => `likely ${range}`,
    combine: (eaten: string, burned: string, net: string) =>
      `Eaten and burned are estimated separately, so their spreads combine as the square root of the sum of squares: √(${eaten}² + ${burned}²) = ±${net} kcal.`,
    ranges:
      'The likely range is meant to catch the real net about 8 times in 10, and the very likely range about 19 times in 20. Net can be near or below 0, so its ranges are even on both sides and can go below 0.',
    noScore:
      'Net has no estimate score: a percentage of a number near 0 says nothing. The score under the headline is for calories eaten.',
    knownOnly: 'Meals and workouts with unknown calories are left out of both sides, as they are from the day’s total.',
    // Net's own wording for the design-target line (net is not a meal).
    designTargets: "These ranges are design targets: HowSure hasn't measured how often they catch the real net.",
    howTitle: 'How the ranges are worked out',
    how: (sd: string) =>
      `With net’s spread of ±${sd} kcal: likely runs from net − 1.2816 × ${sd} to net + 1.2816 × ${sd}, and very likely uses 1.96 in place of 1.2816.`,
    notAvailable: 'Not available yet: net needs known calories for both eaten and burned on this day.',
    // Build-out item 2.5b: once body details are in, the line under the headline adds resting burn.
    balancePointer:
      'The estimated deficit or surplus under the headline adds an estimate of your resting burn and everyday activity, from your body details.',
  },

  // Build-out item 2.7 (checklist slice 8; prd.md > Week View): the week view, the averages of every
  // stat over the waking days ending at the day on screen, and each average's day-by-day breakdown.
  // Unknown is never 0: a day with an unknown value is left out of an average and counted.
  week: {
    title: 'Week',
    // The dashboard's way in, beside previous and next, and its spoken name.
    open: 'Week',
    openLabel: 'Week: the averages of up to 7 waking days, ending at the day on screen',
    // "The 7 waking days to Wed Oct 21". Fewer only when the log starts later than a week before the
    // day on screen, which is true on any day, today or earlier. `whose` is "your" or "Sam’s".
    window: (n: number, last: string, whose: string) =>
      n === 7
        ? `The 7 waking days to ${last}`
        : `The ${n} waking ${n === 1 ? 'day' : 'days'} to ${last}, from the start of ${whose} log`,
    whose: (demo: boolean) => (demo ? 'Sam’s' : 'your'),
    todayNote: 'Today counts with what is logged so far.',
    // Viewing the day before the log's first wake time: the week holds that day alone. With no
    // wake time in the log at all yet, there is no "first wake time" to name.
    windowProvisional: (whose: string, hasWake: boolean) =>
      hasWake ? `The day before ${whose} first wake time` : `${whose === 'your' ? 'Your' : whose} log so far: no wake time yet`,
    // When no average in the week has a number: one line instead of a list of empty rows.
    empty: 'Nothing is logged here yet. Each average shows here once meals, workouts, sleep or weigh-ins are logged.',
    groups: { food: 'Food', activity: 'Workouts and balance', sleep: 'Sleep', body: 'Weight' },
    titles: {
      eaten: 'Calories eaten',
      score: 'Estimate score',
      protein: 'Protein',
      carbs: 'Carbs',
      fat: 'Fat',
      net: 'Net calories',
      burned: 'Burned in workouts',
      burnedScore: 'Burned’s Estimate score',
      balance: 'Estimated deficit or surplus',
      workoutTime: 'Workout time',
      gym: 'Sets per gym session',
      sleepLength: 'Sleep length',
      bedtime: 'Went to sleep',
      wakeTime: 'Woke up',
      weight: 'Weight',
      bodyFat: 'Body fat',
    },
    // Lower case, inside a sentence ("a meal without its protein").
    macroWords: { protein: 'protein', carbs: 'carbs', fat: 'fat' },
    notAvailable: 'Not available yet',
    kcal: (n: string) => `${n} kcal`,
    grams: (n: string) => `${n} g`,
    minutes: (n: string) => `${n} min`,
    percent: (n: string) => `${n}%`,
    likely: (range: string) => `likely ${range}`,
    veryLikely: (range: string) => `very likely ${range}`,
    // The deficit or surplus as a value: "350 kcal deficit".
    deficit: (kcal: string) => `${kcal} kcal deficit`,
    surplus: (kcal: string) => `${kcal} kcal surplus`,
    even: 'about even (0 kcal)',
    // How each average counts its days. The calorie label is the PRD's, word for word. `today`: the
    // current day, still going, is one of the days counted; it is named apart, since more can still
    // be logged on it ("average of 5 complete days and today so far"), and `n` is the earlier days.
    completeDays: (n: number, leftOut: number, today = false) => {
      const out = leftOut > 0 ? ` (${leftOut} incomplete left out)` : ''
      if (today && n === 0) return `today so far only${out}`
      return `average of ${n} complete ${n === 1 ? 'day' : 'days'}${today ? ' and today so far' : ''}${out}`
    },
    noCompleteDay: (leftOut: number) => (leftOut > 0 ? `no complete day yet (${leftOut} incomplete left out)` : 'no day logged yet'),
    // A score's count: incomplete days and complete days with nothing above 0 kcal are told apart,
    // since only the first are incomplete. `kind` says which days count: complete days of meals, or
    // days with workouts. `today`, as in completeDays: the current day is counted, named apart, and
    // `counted` is the earlier days.
    scoreDays: (counted: number, incomplete: number, unscored: number, kind: 'eaten' | 'burned', today = false) => {
      const parts = [incomplete > 0 ? `${incomplete} incomplete` : '', unscored > 0 ? `${unscored} at 0 kcal` : ''].filter(Boolean)
      const out = parts.length > 0 ? ` (${parts.join(' and ')} left out)` : ''
      const noun = kind === 'eaten' ? (counted === 1 ? 'complete day' : 'complete days') : counted === 1 ? 'day with workouts' : 'days with workouts'
      if (today && counted === 0) return `today so far only${out}`
      if (counted > 0) return `average of ${counted} ${noun}${today ? ' and today so far' : ''}${out}`
      if (parts.length > 0) return `no day with a score yet${out}`
      return kind === 'eaten' ? 'no day logged yet' : 'no workouts in these days'
    },
    noNights: 'no night logged yet',
    nights: (complete: number, total: number) => `${complete} of ${total} ${total === 1 ? 'night' : 'nights'}`,
    weighIns: (count: number, days: number, total: number) =>
      `average of ${count} ${count === 1 ? 'weigh-in' : 'weigh-ins'} on ${days} of ${total} ${total === 1 ? 'day' : 'days'}`,
    bodyFatCount: (count: number) => `average of ${count} ${count === 1 ? 'weigh-in' : 'weigh-ins'} with body fat`,
    setsAverage: (n: string) => `${n} ${n === '1' ? 'set' : 'sets'}`,
    sessions: (n: number, total: number) =>
      `average of ${n} ${n === 1 ? 'session' : 'sessions'} in these ${total} ${total === 1 ? 'day' : 'days'}`,
    // Status sentences, drawn in normal weight where an average would be. "weigh-ins" has a word
    // joiner (U+2060) after its hyphen, so a narrow phone never splits it, in every look's font.
    noWeighIns: 'No weigh-\u2060ins in these days',
    noBodyFat: 'No body fat % logged in these days',
    noSessions: 'No gym sessions in these days',
    sleepVaries: 'Sleep times vary too much to average',
    wakeVaries: 'Wake times vary too much to average',
    // Under the calorie average (prd.md > Week View, word for word).
    steadier: 'Weekly totals are steadier than single meals, but photo estimates tend to run low on big plates.',
    trend: (value: string, note: string) => `Trend: ${value}, ${note}`,
    trendStatus: (value: string) => `Trend: ${value}`,
    // A row's spoken name: what it shows (its ranges or trend too), and that it opens the breakdown.
    // `lines`: the row's further lines as sentences, already joined ("likely 1,116–1,963 kcal.").
    rowLabel: (title: string, value: string, count: string, lines = '') =>
      `${title}: ${value}, ${count}.${lines ? ` ${lines}` : ''} Opens each day.`,
    // The breakdown.
    breakdownTitle: (title: string) => `${title}, day by day`,
    average: 'Week average',
    counted: 'Counted',
    notLogged: 'Not logged',
    none: 'Nothing to count',
    leftOut: (why: string) => `Left out: ${why}`,
    why: {
      unknownMeal: 'a meal with unknown calories',
      missingMacro: (macro: string) => `a meal without its ${macro}`,
      noScore: 'no calories above 0',
      noBurnedScore: 'no calories burned above 0',
      unknownWorkout: 'a workout with unknown calories',
      unknownMinutes: 'a workout with no duration',
      noMeals: 'no meals logged',
      unknownEntry: 'a meal and a workout with unknown calories',
      noWake: 'no wake time to count the day from',
      notWorkedOut: 'it could not be worked out that day',
      sleepNotLogged: 'the sleep time was not logged',
      // A night whose sleep time is its wake time: both are logged, but it has no length.
      noLength: 'the sleep time is the same as the wake time',
    },
    unknown: 'unknown',
    // A day left out of a score average: no score is given for it.
    notScored: 'not scored',
    knownOnlyNote: 'Known meals only (incomplete)',
    knownWorkoutsOnly: 'Known workouts only (incomplete)',
    workoutCount: (n: number) => (n === 1 ? '1 workout' : `${n} workouts`),
    sessionCount: (n: number) => (n === 1 ? '1 gym session' : `${n} gym sessions`),
    noBodyFatDay: 'No body fat %',
    provisionalShort: 'Before',
    noWorkouts: 'No workouts',
    noGym: 'No gym session',
    noWeighIn: 'No weigh-in',
    setsValue: (n: string) => `${n} ${n === '1' ? 'set' : 'sets'}`,
    dayWeighIns: (n: number) => `average of ${n} weigh-ins`,
    nightSpan: (sleep: string, wake: string) => `${sleep} to ${wake}`,
    provisional: 'Before the first wake time',
    // The current day in a breakdown. "so far" only where more can still be logged on it (not on
    // the night before it, which is over). No-break spaces keep the parenthesis on one line; it may
    // go under the date on a narrow phone.
    dayName: (day: string, today: 'soFar' | 'plain' | null) =>
      today === 'soFar' ? `${day} (today,\u00a0so\u00a0far)` : today === 'plain' ? `${day} (today)` : day,
    // A day not logged has no value: its status says so once.
    dayLabel: (day: string, value: string, status: string) => (value ? `${day}: ${value}. ${status}. Opens this day.` : `${day}: ${status}. Opens this day.`),
    // How each breakdown counts.
    intro: {
      eaten:
        'A day counts when every meal on it has known calories. A day with an unknown meal shows its known meals only and is left out; a day with no meals is not logged. Neither counts as 0.',
      score: 'Each complete day’s Estimate score. A day with an unknown meal is left out: its score would cover its known meals only.',
      macro: (macro: string) =>
        `A day counts when every meal on it has its ${macro}. A day with a meal missing it is left out, never counted as 0.`,
      net: 'Calories eaten minus burned in workouts, on days where both are known. A day with no workouts burns 0 in workouts. The resting burn isn’t counted.',
      burned:
        'Calories burned in the workouts you logged. A day with meals and no workouts counts 0; a workout with unknown calories leaves its day out.',
      burnedScore:
        'Each day’s Estimate score for its calories burned, as shown at the top of that day’s workout list. A day with no workouts has nothing to score; a workout with unknown calories leaves its day out.',
      balance:
        'The estimated deficit or surplus on each day, worked out as under the headline: eaten minus the resting burn, everyday activity and workouts. A day with an unknown meal or workout is left out.',
      workoutTime: 'Minutes of the workouts you logged. A day with meals and no workouts counts 0 min; a workout with no duration leaves its day out.',
      gym: 'The sets in each gym session, warm-ups and drop sets included, averaged over the sessions in these days.',
      sleepLength: 'The night before each day. A night with a missing sleep time is not logged and left out, never 0 h.',
      bedtime: 'Averaged as clock times, so 11:50 PM and 12:10 AM average to 12:00 AM. A night with a missing time is left out.',
      wakeTime:
        'Averaged as clock times, so 11:50 PM and 12:10 AM average to 12:00 AM. A night with a missing sleep time is left out, as in the 7-night average.',
      // `current`: the last day here is today, still going, so its trend runs up to now.
      weight: (current: boolean) =>
        `Every weigh-in in these days counts once. The trend is the one on the dashboard, ${current ? 'worked out up to now' : 'up to the end of the last day here'}.`,
      bodyFat: 'The weigh-ins in these days that have a body fat %.',
    },
    // How the calorie average's ranges are worked out (spec.md > Week Summary).
    method:
      'The average’s ranges group every meal on the counted days by source, as a day does, so errors from the same kind of source never average out across the week.',
    // How the deficit or surplus average's ranges are worked out (src/kernel/week.ts balanceAverage).
    balanceMethod:
      'The average’s ranges count the resting-burn equation’s error as leaning the same way on every day, an assumption since it is one equation for one person, so they don’t narrow as days are added.',
    chartLegend:
      'Bars: calories eaten. Thick line: likely range; thin line: very likely range. Dashed outline: known meals only. No bar: not logged, or no known calories. Dashed line across: the average.',
  },

  more: {
    sourcesTitle: 'Where each typical error comes from',
    limitTitle: 'The limit of this method',
    // spec.md > Maths Core: Estimates, Ranges and the Day (replaces the PRD's draft limit wording).
    limit:
      "Errors from the same kind of source are added, because they tend to lean the same way. Different kinds partly cancel. Photo estimates and people's own descriptions can both run low on big plates, which this doesn't count, so a day of photo and described meals may be less sure than this shows.",
    // spec.md > Maths Core: Estimates, Ranges and the Day.
    designTargets:
      "These ranges are design targets, meant to catch about 8 in 10 and 19 in 20 meals like this. HowSure hasn't measured its own hit rate.",
  },
} as const

export type Copy = typeof copy
