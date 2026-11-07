// Build-out item 2.9: what the details opened from dashboard numbers show, worked out once for every
// look: a macro's detail (macroView.ts), the sleep details (sleepView.ts sleepDetailView) and the
// foods and lookup stored on a meal (mealFoods.ts). The people are the fictional Sam: the demo
// week, and invented meals. Expected values are worked out by hand from the fixture:
//   Wednesday's protein: kefir 20 + pasta 34 + chicken 44 + soup 18 + apple 8 = 124 g (target 130:
//   124 × 100 / 130 = 95.4, so 95%); kefir's share 20 / 124 = 16%.
//   Wednesday's wake 1:20 PM after sleeping from 4:35 AM: 8 h 45 min; the 7 nights up to it have
//   one with no sleep time (Tue), so 6 of 7, averaging 8 h 49 min.
import { describe, expect, it } from 'vitest'
import { demoDoc, demoStartIso, meal } from '../../kernel/__tests__/helpers'
import type { Meal } from '../../kernel/types'
import { buildDayViewFor } from '../dayView'
import { buildMacroView, macroOpenLabel } from '../macroView'
import { foodAmount, foodRows, lookupView } from '../mealFoods'
import { buildSleepView, sleepDetailView } from '../sleepView'

const WED = '2026-10-21T13:20:00-04:00'
const TUE = '2026-10-20T13:05:00-04:00'
const wed = buildDayViewFor(demoDoc, WED)

describe('macroView: one macro on one waking day', () => {
  it('Wednesday’s protein: the known total, each meal’s value and share, and the target share', () => {
    const m = buildMacroView(wed.meals, 'protein', demoDoc.profile.targets, wed.dayStart)
    expect(m).toMatchObject({
      name: 'Protein',
      valueText: '124 g',
      complete: true,
      missingText: null,
      target: 130,
      targetText: '130 g',
      targetShareText: 'The day’s total is 95% of it.',
    })
    expect(m.rows.map((r) => [r.name, r.valueText, r.shareText])).toEqual([
      ['Kefir with oats and blueberries', '20 g', '16%'],
      ['Pasta bake (ready meal)', '34 g', '27%'],
      ['Chicken, rice and broccoli', '44 g', '35%'],
      ['Lentil soup from the café', '18 g', '15%'],
      ['Apple and peanut butter', '8 g', '6%'],
    ])
    expect(m.rows[0].meta).toBe('1:50 PM · Nutrition label (typed)')
    expect(m.rows[4].meta).toBe('Thu 12:40 AM · Description')
    expect(m.rows[0].label).toBe(
      'Kefir with oats and blueberries, 1:50 PM · Nutrition label (typed), 20 g, 16% of the known total. Opens the meal details.',
    )
  })

  it('no range yet, and a missing value is never 0 g', () => {
    const m = buildMacroView(wed.meals, 'fat', undefined, wed.dayStart)
    expect(m.rangeText).toBe('No range yet: ranges cover calories only for now. This total adds up the values entered for each meal.')
    expect(m.unknownsText).toBe('A meal with no fat value is left out of the total and counted as missing, never as 0 g.')
    expect(m.targetText).toBe('No fat target set.')
    expect(m.targetShareText).toBeNull()
  })

  it('a meal with no value: the total is a floor, the share against the target says "at least", and the meal has no share', () => {
    const meals: Meal[] = [meal('label', 500, { name: 'Oats', carbs: 60 }), meal('photo', 600, { name: 'Curry', carbs: null })]
    const m = buildMacroView(meals, 'carbs', { carbs: 250 }, null)
    expect(m.complete).toBe(false)
    expect(m.valueText).toBe('60 g')
    expect(m.missingText).toBe('1 meal has no carbs value, so the day’s total is at least 60 g.')
    // 60 × 100 / 250 = 24.
    expect(m.targetShareText).toBe('The day’s total is at least 24% of it: the meals with no value could add more.')
    expect(m.rows.map((r) => [r.valueText, r.shareText])).toEqual([
      ['60 g', '100%'],
      ['no value', null],
    ])
  })

  it('no meal with a value: "unknown", never 0, and no comparison with the target', () => {
    const meals: Meal[] = [meal('label', 500), meal('photo', 600)]
    const m = buildMacroView(meals, 'protein', { protein: 120 }, null)
    expect(m.valueText).toBe('unknown')
    expect(m.missingText).toBe('No meal on this day has a protein value, so the total is unknown, not 0.')
    expect(m.targetShareText).toBe('Not compared while the total is unknown.')
    expect(m.rows.every((r) => r.shareText === null)).toBe(true)
  })

  it('a day with no meals: says no meals are logged, never 0 g, with no comparison with the target', () => {
    const m = buildMacroView([], 'protein', { protein: 120 }, null)
    expect(m).toMatchObject({
      noMeals: true,
      valueText: 'No meals logged',
      roundedText: null,
      complete: false,
      missingText: null,
      targetText: '120 g',
      targetShareText: 'Not compared while no meals are logged.',
      rows: [],
    })
    expect(buildMacroView([], 'fat', undefined, null).targetShareText).toBeNull()
    // A day with meals is never in that state.
    expect(buildMacroView([meal('label', 500, { protein: 0 })], 'protein', undefined, null).noMeals).toBe(false)
  })

  it('the total is given to a tenth, as the meals’ values are entered, so one meal of 37.4 g reads 37.4 g, and says the dashboard shows 37 g', () => {
    const m = buildMacroView([meal('label', 500, { protein: 37.4 })], 'protein', undefined, null)
    expect(m.valueText).toBe('37.4 g')
    expect(m.rows[0].valueText).toBe('37.4 g')
    expect(m.roundedText).toBe('Shown on the dashboard as 37 g, rounded to the gram.')
    // A whole-gram total is the same on both, so no line.
    expect(buildMacroView([meal('label', 500, { protein: 37 })], 'protein', undefined, null).roundedText).toBeNull()
  })

  it('the share of the target is grouped like every other figure', () => {
    const m = buildMacroView([meal('label', 5000, { protein: 1234.5 })], 'protein', { protein: 100 }, null)
    expect(m.valueText).toBe('1,234.5 g')
    expect(m.targetShareText).toBe('The day’s total is 1,235% of it.')
  })

  it('a known total of 0 g gives no shares (nothing to divide by)', () => {
    const m = buildMacroView([meal('label', 50, { fat: 0 })], 'fat', { fat: 70 }, null)
    expect(m.valueText).toBe('0 g')
    expect(m.rows[0].shareText).toBeNull()
    expect(m.targetShareText).toBe('The day’s total is 0% of it.')
  })

  it('the dashboard button’s name gives the value, any missing entries, and what it opens', () => {
    expect(macroOpenLabel('protein', wed.macros.protein)).toBe('Protein 124 g. Opens the protein detail.')
    expect(macroOpenLabel('carbs', { known: 60, missing: 2, allUnknown: false })).toBe('Carbs 60 g, 2 entries missing. Opens the carbs detail.')
    expect(macroOpenLabel('fat', { known: 0, missing: 2, allUnknown: true })).toBe('Fat unknown. Opens the fat detail.')
  })
})

describe('sleepDetailView: the sleep details for the viewed day', () => {
  it('the demo’s Wednesday: now, last night’s two times and length, the average and its count', () => {
    const d = sleepDetailView(buildSleepView(demoDoc.sleeps, WED), true, demoStartIso)
    expect(d).toEqual({
      now: 'Awake',
      lastNightLabel: 'Last night',
      lastNight: { sleptAt: 'Wed 4:35 AM', wokeAt: 'Wed 1:20 PM', length: '8 h 45 min' },
      edit: { recordId: 'sleep-1021', label: 'Edit last night' },
      average: '8 h 49 min',
      count: '6 of 7 nights',
    })
  })

  it('an earlier day: no "now", its night named by the day, a missing sleep time "not logged" (null), never 0', () => {
    const d = sleepDetailView(buildSleepView(demoDoc.sleeps, TUE), false, demoStartIso)
    expect(d.now).toBeNull()
    expect(d.lastNightLabel).toBe('Night before this day')
    expect(d.lastNight).toEqual({ sleptAt: null, wokeAt: 'Tue 1:05 PM', length: null })
    expect(d.edit).toEqual({ recordId: 'sleep-1020', label: 'Edit the night before Tue' })
  })

  it('asleep now: the status says since when; the night that started the day is still the one to edit', () => {
    const sleeps = [...demoDoc.sleeps, { id: 'open', sleepStart: '2026-10-22T03:00:00-04:00', wake: null }]
    const d = sleepDetailView(buildSleepView(sleeps, WED), true, '2026-10-22T04:00:00-04:00')
    expect(d.now).toBe('Asleep since Thu 3:00 AM')
    expect(d.edit).toEqual({ recordId: 'sleep-1021', label: 'Edit last night' })
  })

  it('a current day woken from 24 hours ago or more: the night is named by its day, as the section names it', () => {
    const d = sleepDetailView(buildSleepView(demoDoc.sleeps, WED), true, '2026-10-22T13:20:00-04:00')
    expect(d.lastNightLabel).toBe('Night before Wed')
    expect(d.edit?.label).toBe('Edit the night before Wed')
  })

  it('the provisional day (no wake yet): no night, nothing to edit, no average', () => {
    const d = sleepDetailView(buildSleepView([], null), true, demoStartIso)
    expect(d).toMatchObject({ lastNight: null, edit: null, average: null, count: null })
  })
})

describe('mealFoods: the foods and the lookup stored on a meal', () => {
  it('the demo’s kefir breakfast lists its three foods with their amounts', () => {
    const kefir = wed.meals.find((m) => m.name === 'Kefir with oats and blueberries') as Meal
    expect(foodRows(kefir)).toEqual([
      { name: 'kefir', amount: '6 oz', fiber: null },
      { name: 'rolled oats', amount: '1 serving', fiber: null },
      { name: 'blueberries', amount: '1 serving', fiber: null },
    ])
  })

  it('amounts in each unit, grouped as typed, with fiber per 100 g when stored', () => {
    expect(foodAmount({ name: 'rice', amount: 1250, unit: 'g' })).toBe('1,250 g')
    expect(foodAmount({ name: 'bread', amount: 2, unit: 'serving' })).toBe('2 servings')
    expect(foodAmount({ name: 'nuts', amount: 1.5, unit: 'oz' })).toBe('1.5 oz')
    expect(foodRows(meal('label', 300, { foods: [{ name: 'oats', amount: 50, unit: 'g', fiberPer100: 10 }] }))).toEqual([
      { name: 'oats', amount: '50 g', fiber: 'fiber 10 g per 100 g' },
    ])
  })

  it('a meal with no foods stored has none', () => {
    expect(foodRows(meal('photo', 760))).toEqual([])
    expect(lookupView(meal('photo', 760))).toBeNull()
  })

  it('the demo’s saved barcode lookup says how much was eaten', () => {
    const tue = buildDayViewFor(demoDoc, TUE)
    const bar = tue.meals.find((m) => m.name === 'Granola bar') as Meal
    expect(lookupView(bar)?.parts.join(' · ')).toBe('Barcode lookup · saved result · whole package')
    expect(lookupView(bar)?.credit).toBeNull()
  })

  it('a lookup with grams, a fetch date (written out, the year only when it differs) and a credit', () => {
    const lookup = {
      kind: 'foodSearch' as const,
      credit: 'Example credit line',
      fetchedAt: '2025-12-30T10:00:00-05:00',
      amount: { kind: 'portion' as const, grams: 45 },
    }
    const v = lookupView({ lookup, source: 'food_db', eatenAt: WED })
    expect(v?.parts.join(' · ')).toBe('Food search · a portion (45 g) · fetched Tue Dec 30, 2025')
    expect(v?.credit).toBe('Credit: Example credit line')
    expect(lookupView({ lookup: { ...lookup, fetchedAt: '2026-10-02T10:00:00-04:00' }, source: 'food_db', eatenAt: WED })?.parts.join(' · ')).toBe(
      'Food search · a portion (45 g) · fetched Fri Oct 2',
    )
  })

  it('a lookup applies only while the meal’s source uses it; after an edit to another source it says so', () => {
    const tue = buildDayViewFor(demoDoc, TUE)
    const bar = tue.meals.find((m) => m.name === 'Granola bar') as Meal
    expect(lookupView(bar)).toEqual({ parts: ['Barcode lookup', 'saved result', 'whole package'], credit: null, unused: null })
    // An edit keeps the stored lookup (editMeal spreads the original) when the source changes.
    expect(lookupView({ ...bar, source: 'photo' })?.unused).toBe('Not used now: this meal’s values come from Photo estimate, not from this lookup.')
    expect(lookupView({ ...bar, source: 'label' })?.unused).toBe(
      'Not used now: this meal’s values come from Nutrition label (typed), not from this lookup.',
    )
    expect(lookupView({ ...bar, source: null })?.unused).toBe('Not used now: no source is picked for this meal.')
    // A food search is a database entry: it applies to a Food database meal, not a looked-up label.
    const search = { ...bar, lookup: { kind: 'foodSearch' as const, credit: 'Example credit line', amount: { kind: 'portion' as const } } }
    expect(lookupView({ ...search, source: 'food_db' })).toMatchObject({ unused: null, credit: 'Credit: Example credit line' })
    // Imported data can pair the two the other way round: the details say they do not match.
    expect(lookupView({ ...search, source: 'label_lookup' })?.unused).toBe(
      'Does not match: this meal’s values are marked Nutrition label (looked up), which a food search does not give, so they may not come from this lookup.',
    )
    expect(lookupView({ ...bar, source: 'food_db' })?.unused).toContain('which a barcode lookup does not give')
    expect(lookupView(meal('photo', 760))).toBeNull()
  })
})
