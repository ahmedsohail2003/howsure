// The one sources table (spec.md > Maths Core: Sources Table).
// Starting values are Ahmed's earlier personal tracker figures. Every row is
// "assumption" unless the study's own figure, for the matching method, supports the
// number. Re-checked 2026-10-26 (checklist slice 7): every row stays "assumption", and
// its nearest study (cite, DOI, re-check date) is shown as context.
// Pure data: no React, no storage, no clock reads.

import type { MealSourceId, Source, SourceId } from './types'

export const SOURCES: Record<SourceId, Source> = {
  weighed: {
    id: 'weighed',
    label: 'Weighed',
    typicalError: 0.08,
    hint: 'You weighed the food and used its per-100 g values.',
    basis: { kind: 'assumption', cite: "Novotny et al. 2012, Am J Clin Nutr", doi: "10.3945/ajcn.112.035782", checked: '2026-10-26' },
    context:
      "Atwater factors overestimated the measured energy in almonds by 32%, so weighing alone does not remove calorie error. That is one food's energy per gram, not the error of weighing, so the 8% stays an assumption.",
  },
  label: {
    id: 'label',
    label: 'Nutrition label (typed)',
    typicalError: 0.1,
    hint: "You typed the numbers from the package's nutrition label.",
    basis: { kind: 'assumption', cite: "Jumpertz et al. 2013, Obesity", doi: "10.1002/oby.20185", checked: '2026-10-26' },
    context:
      "24 snack foods measured a median 4.3% above their labels, with the middle half between +0.2% and +13.7%. That fits 10% but is a median and quartiles, not a typical error, so 10% stays an assumption. US rule: 21 CFR 101.9(g) lets a 12-unit sample hold up to 20% more calories than declared.",
  },
  label_lookup: {
    id: 'label_lookup',
    label: 'Nutrition label (looked up)',
    typicalError: 0.12,
    hint: 'The label values came from a barcode lookup.',
    basis: { kind: 'assumption', cite: "Jumpertz et al. 2013, Obesity (nearest)", doi: "10.1002/oby.20185", checked: '2026-10-26' },
    context:
      "No study found measures barcode-database entries against measured energy. Open Food Facts says its entries carry no promise of being right, so 12% stays an assumption.",
  },
  menu: {
    id: 'menu',
    label: 'Published menu',
    typicalError: 0.21,
    hint: "From the restaurant's published menu or website.",
    basis: { kind: 'assumption', cite: "Urban et al. 2011, JAMA", doi: "10.1001/jama.2011.993", checked: '2026-10-26' },
    context:
      "269 chain-restaurant items were right on average, but the spread was 134 kcal at quick-serve (about 20% of the average item) and up to 225 kcal at sit-down restaurants. 21% fits quick-serve only, so it stays an assumption.",
  },
  photo: {
    id: 'photo',
    label: 'Photo estimate',
    typicalError: 0.46,
    hint:
      'Calories estimated from a meal photo by an AI app. Your own guess with no label, menu or scale is a Description.',
    basis: { kind: 'assumption', cite: "Fridolfsson et al. 2025, Curr Dev Nutr", doi: "10.1016/j.cdnut.2025.107556", checked: '2026-10-26' },
    context:
      "On 52 food photos, two of three general-purpose AI models missed the energy by 35.8% on average (the third: 64.2%), and estimates ran lower as portions grew. That is an average miss, not the spread HowSure uses, so 46% stays an assumption.",
  },
  description: {
    id: 'description',
    label: 'Description',
    typicalError: 0.41,
    hint: 'Your own estimate of what you ate, with no label, menu or scale.',
    basis: { kind: 'assumption', cite: "Block et al. 2013, BMJ", doi: "10.1136/bmj.f2907", checked: '2026-10-26' },
    context:
      "1,877 diners guessed their fast-food meal 175 kcal low on average, with a spread of 637 kcal on meals averaging 836 kcal. Untrained guesses can be much less sure than 41%, so 41% stays an assumption.",
  },
  food_db: {
    id: 'food_db',
    label: 'Food database',
    typicalError: 0.15,
    hint: 'From a food database entry and your portion.',
    basis: { kind: 'assumption', cite: "Urban et al. 2013, JAMA Intern Med", doi: "10.1001/jamainternmed.2013.6163", checked: '2026-10-26' },
    context:
      "Non-chain restaurant meals held 19% more energy than food-database values for the same items. That is an average gap, not the error of one entry plus your portion, so 15% stays an assumption.",
  },
  burn_device: {
    id: 'burn_device',
    label: 'Device or watch estimate',
    typicalError: 0.4,
    hint: 'The burn your watch, phone or fitness tracker reported.',
    basis: { kind: 'assumption', cite: "Shcherbina et al. 2017, J Pers Med", doi: "10.3390/jpm7020003", checked: '2026-10-26' },
    context:
      "Seven wrist devices tested against lab gas analysis in 60 adults had median energy-expenditure errors from 27.4% to 92.6%; none was under 20%. 40% sits inside that range but is not a figure from the study.",
  },
  burn_machine: {
    id: 'burn_machine',
    label: 'Machine display',
    typicalError: 0.3,
    hint: 'The burn shown on a gym machine.',
    basis: { kind: 'assumption', cite: "Erdogan et al. 2010, J Sports Sci Med", checked: '2026-10-26' },
    context:
      "A rowing machine's monitor read 2.3–2.9 kcal per minute too high against lab measurement. No study found gives a percentage for gym-machine displays, so 30% stays an assumption.",
  },
  burn_guess: {
    id: 'burn_guess',
    label: 'Rough guess',
    typicalError: 0.5,
    hint: 'Your own guess of what you burned.',
    basis: { kind: 'assumption', cite: "Willbond et al. 2010, J Sports Med Phys Fitness", checked: '2026-10-26' },
    context:
      "16 adults guessed about 825 kcal for a treadmill session that burned 200 kcal, and about 897 kcal for one that burned 300 kcal: 3 to 4 times too high. Guesses can be off by far more than 50%, so 50% stays an assumption.",
  },
}

/** Every meal source, in the order the spec lists them (also the tie order). */
export const MEAL_SOURCE_IDS: readonly MealSourceId[] = [
  'weighed',
  'label',
  'label_lookup',
  'menu',
  'photo',
  'description',
  'food_db',
]

/** The Tier 1 choices under "How do you know?" (prd.md > Logging a Meal). */
export const LOG_SOURCE_IDS: readonly MealSourceId[] = ['weighed', 'label', 'menu', 'photo', 'description']

export function getSource(id: SourceId): Source {
  const s = SOURCES[id]
  if (!s) throw new Error(`Unknown source id: ${String(id)}`)
  return s
}

/** The meal source with the lowest typical error, computed so it follows the re-check. */
export function bestMealSource(): MealSourceId {
  let best: MealSourceId = MEAL_SOURCE_IDS[0]
  for (const id of MEAL_SOURCE_IDS) {
    if (SOURCES[id].typicalError < SOURCES[best].typicalError) best = id
  }
  return best
}
