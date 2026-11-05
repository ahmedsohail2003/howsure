// Every user-visible string in HowSure lives here (spec.md > Screens; study titles live in
// src/kernel/sources.ts). Word rules, checked by src/ui/__tests__/copy.test.ts:
//   - "Estimate score", never "accuracy";
//   - "likely" and "very likely", never "for sure";
//   - "guarantee" only inside a negation;
//   - "unknown", never 0.
// Templates take already-formatted strings, so this file holds words, not number formatting.

import { PARSE_ERROR_MESSAGE } from '../kernel/parse'

export const copy = {
  appName: 'HowSure',
  tagline: 'Food estimates, explained.',
  fictionalBanner: 'Sample person — fictional',
  sep: ' · ',

  firstOpen: {
    lede: 'A food log where every calorie number says how sure it is, what that rests on, and what would make it better.',
    tryDemo: 'Try the fictional demo',
    tryDemoHint: 'A week from Sam, a made-up person, with mixed sources and one rough meal.',
    startEmpty: 'Start empty',
    startEmptyHint: 'Your own log, starting with no meals and no wake time.',
  },

  header: {
    awakeSince: (weekday: string, time: string) => `${weekday} · awake since ${time}`,
    wakeTimeNotSet: 'Wake time not set',
    switchToMine: 'Start empty',
    switchToDemo: 'Try the fictional demo',
    yourLog: 'Your log',
    // spec.md > Screens > Dashboard: the guest name opens Profile and privacy.
    profileAndPrivacy: 'Profile and privacy',
  },

  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const,
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
    openRangesLabel: (name: string, value: string) => `${name} range ${value}. Opens the range explanation.`,
    openScoreLabel: (score: string) => `Estimate score ${score}. Opens the explanation.`,
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
  },

  missing: {
    title: 'Missing information',
    unknownKcal: 'calories unknown',
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
    rowScoreLabel: (score: string, meal: string) => `Estimate score ${score} for ${meal}. Opens the explanation.`,
    meta: (time: string, source: string) => `${time} · ${source}`,
    // A meal saved with blank calories may have no source picked (prd.md > Logging a Meal).
    sourceNotPicked: 'source not picked',
  },

  emptyDay: {
    noMeals: 'No meals logged yet',
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
    nightCount: (complete: string, total: string) => `${complete} of ${total} nights`,
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
    whenHint: 'Starts at now. Change it if it was another time.',
    closesDay: (day: string) => `This closes the waking day that started ${day}.`,
    startsDay: 'This starts a new, empty waking day.',
    moves: (meals: string) => `These meals are after that time, so they move to the new day: ${meals}`,
    demoAdvance: 'This is later than the demo’s clock, so the demo moves forward to it.',
    save: 'Save',
    cancel: 'Cancel',
    errors: {
      notATime: 'Pick a date and time.',
      wakeBeforeSleep: (when: string) =>
        `Waking up has to come after going to sleep (${when}). Nothing was saved; change the time and try again.`,
      sleepBeforeWake: (when: string) =>
        `Going to sleep has to come after the last wake time (${when}). Nothing was saved; change the time and try again.`,
      overlap: 'That time overlaps another recorded sleep. Nothing was saved.',
      future: 'That time is later than now. Pick a time up to now.',
    },
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
      `Importing replaces your log on this device, which holds ${what}, and your guest name, targets and settings. Export it first if you want to keep it.`,
    previewReplacesEmpty:
      'Importing replaces your guest name, targets and settings on this device. Your log has no meals or sleep yet.',
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
    confirmProfile: 'your guest name, targets and settings',
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
    fullScreenHint: 'Shows HowSure without the browser’s bars. On a wide screen the day sits in two columns.',
    exitFullScreenHint: 'Back to the normal view. Esc also works.',
    // The Fullscreen API was missing or refused: the page is widened instead.
    exitFallbackHint: 'Your browser kept its own bars, so HowSure widened the page instead. Esc also goes back.',
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
