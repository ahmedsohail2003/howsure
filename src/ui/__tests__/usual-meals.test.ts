// Build-out item 2.3: Recent, Saved, the amount, and saving, renaming and deleting saved meals
// (src/ui/usualMeals.ts). The meals are the fictional Sam's, with invented foods and times.
import { describe, expect, it } from 'vitest'
import type { Meal } from '../../kernel/types'
import { emptyLog, startDemo, type LogDoc, type SavedMeal } from '../../store/log'
import { parseLogText, serializeLog } from '../../store/storage'
import { copy } from '../copy'
import {
  checkFactor,
  checkSavedName,
  fmtFactor,
  mealFromValues,
  quickLists,
  RECENT_LIMIT,
  recentMeals,
  repeatKey,
  savedFromMeal,
  savedInOrder,
  savedEarlier,
  savedMatch,
  valuesOf,
  withoutSavedMeal,
  withSavedMeal,
  withSavedMealRenamed,
  withSavedMealUpdated,
} from '../usualMeals'

function meal(id: string, name: string, eatenAt: string, kcal: number | null, extra: Partial<Meal> = {}): Meal {
  return {
    id,
    name,
    eatenAt,
    source: kcal === null ? null : 'description',
    kcal,
    protein: null,
    carbs: null,
    fat: null,
    ...extra,
  }
}

const OATS = meal('m1', 'Oats with honey', '2026-10-27T08:00:00-04:00', 350, { source: 'weighed', protein: 11 })
const SOUP = meal('m2', 'Tomato soup', '2026-10-27T13:00:00-04:00', 240)
const OATS_AGAIN = meal('m3', ' oats  WITH honey ', '2026-10-28T08:05:00-04:00', 350, { source: 'weighed', protein: 11 })
const OATS_BIGGER = meal('m4', 'Oats with honey', '2026-10-28T09:00:00-04:00', 450, { source: 'weighed', protein: 14 })
const MYSTERY = meal('m5', 'Leftovers', '2026-10-28T19:00:00-04:00', null)

function saved(id: string, name: string, from: Meal): SavedMeal {
  return savedFromMeal(from, name, id, '2026-10-28T20:00:00-04:00')
}

describe('recentMeals', () => {
  it('lists the last meals logged, newest first by their time', () => {
    expect(recentMeals([OATS, SOUP, MYSTERY]).map((m) => m.id)).toEqual(['m5', 'm2', 'm1'])
  })

  it('leaves out a meal with the same name (spaces and case ignored) and values as a newer one', () => {
    expect(recentMeals([OATS, SOUP, OATS_AGAIN]).map((m) => m.id)).toEqual(['m3', 'm2'])
  })

  it('keeps the same name with other values: a bigger bowl is its own repeat', () => {
    expect(recentMeals([OATS, OATS_BIGGER]).map((m) => m.id)).toEqual(['m4', 'm1'])
  })

  it('a different source, or a looked-up amount of another kind, is another repeat', () => {
    const typed = { ...OATS, id: 'm6', source: 'label' as const, eatenAt: '2026-10-29T08:00:00-04:00' }
    expect(recentMeals([OATS, typed]).map((m) => m.id)).toEqual(['m6', 'm1'])
    const pkg = meal('b1', 'Granola bar', '2026-10-27T10:00:00-04:00', 190, {
      source: 'label_lookup',
      lookup: { kind: 'barcode', amount: { kind: 'package', grams: 40 } },
    })
    const portion = { ...pkg, id: 'b2', eatenAt: '2026-10-27T11:00:00-04:00', lookup: { kind: 'barcode' as const, amount: { kind: 'portion' as const } } }
    expect(repeatKey(pkg)).not.toBe(repeatKey(portion))
    expect(recentMeals([pkg, portion]).map((m) => m.id)).toEqual(['b2', 'b1'])
  })

  it('keeps unknown-calorie meals, deduplicated like any other', () => {
    const again = { ...MYSTERY, id: 'm7', eatenAt: '2026-10-29T19:00:00-04:00' }
    expect(recentMeals([MYSTERY, again]).map((m) => m.id)).toEqual(['m7'])
  })

  it('a tie in time goes to the meal added later', () => {
    const a = meal('t1', 'Apple', '2026-10-27T10:00:00-04:00', 80)
    const b = meal('t2', 'Pear', '2026-10-27T10:00:00-04:00', 90)
    expect(recentMeals([a, b]).map((m) => m.id)).toEqual(['t2', 't1'])
  })

  it('stops at the limit', () => {
    const many = Array.from({ length: 9 }, (_, i) => meal(`n${i}`, `Snack ${i}`, `2026-10-2${i}T10:00:00-04:00`, 100 + i))
    const out = recentMeals(many)
    expect(out).toHaveLength(RECENT_LIMIT)
    expect(out.map((m) => m.id)).toEqual(['n8', 'n7', 'n6', 'n5', 'n4'])
  })

  it('leaves out a meal the Saved list already offers (same name and values)', () => {
    const s = saved('s1', 'Oats with honey', OATS)
    expect(recentMeals([OATS, SOUP, OATS_AGAIN], [s]).map((m) => m.id)).toEqual(['m2'])
  })

  it('leaves out the meal a saved meal was saved from, and its repeats, even under a new name', () => {
    // Saved as "Usual oats": the bowl it came from (and the same bowl logged again) would otherwise
    // show twice, once in Saved and once in Recent.
    const s = saved('s2', 'Usual oats', OATS)
    expect(recentMeals([OATS, SOUP], [s]).map((m) => m.id)).toEqual(['m2'])
    expect(recentMeals([OATS, SOUP, OATS_AGAIN], [s]).map((m) => m.id)).toEqual(['m2'])
    // A lookalike with another name and the same values is a meal of its own.
    const porridge = { ...OATS, id: 'm8', name: 'Porridge', eatenAt: '2026-10-29T08:00:00-04:00' }
    expect(recentMeals([OATS, porridge], [s]).map((m) => m.id)).toEqual(['m8'])
  })

  it('a meal edited after it was saved is a recent meal of its own again', () => {
    const s = saved('s2', 'Usual oats', OATS)
    const edited = { ...OATS, kcal: 420 }
    expect(recentMeals([edited, SOUP], [s]).map((m) => m.id)).toEqual(['m2', 'm1'])
  })

  it('the demo week offers its newest five distinct meals', () => {
    const demo = startDemo()
    expect(recentMeals(demo.meals).map((m) => m.name)).toEqual([
      'Apple and peanut butter',
      'Lentil soup from the café',
      'Chicken, rice and broccoli',
      'Pasta bake (ready meal)',
      'Kefir with oats and blueberries',
    ])
  })
})

describe('the amount', () => {
  it('takes a preset as it is', () => {
    expect(checkFactor({ kind: 'preset', factor: 1.5 })).toEqual({ ok: true, factor: 1.5 })
  })

  it('reads a typed multiplier, with a decimal point or comma', () => {
    expect(checkFactor({ kind: 'other', text: '1.25' })).toEqual({ ok: true, factor: 1.25 })
    expect(checkFactor({ kind: 'other', text: ' 0,5 ' })).toEqual({ ok: true, factor: 0.5 })
    expect(checkFactor({ kind: 'other', text: '10' })).toEqual({ ok: true, factor: 10 })
    expect(checkFactor({ kind: 'other', text: '0.1' })).toEqual({ ok: true, factor: 0.1 })
  })

  it('reads a leading point or comma as 0 point: ".5" and ",5" are 0.5', () => {
    expect(checkFactor({ kind: 'other', text: '.5' })).toEqual({ ok: true, factor: 0.5 })
    expect(checkFactor({ kind: 'other', text: ' ,75' })).toEqual({ ok: true, factor: 0.75 })
  })

  it('blank is no amount yet, with no error; anything else that is not from 0.1 to 10 is an error', () => {
    expect(checkFactor({ kind: 'other', text: '' })).toEqual({ ok: false, error: null })
    expect(checkFactor({ kind: 'other', text: '   ' })).toEqual({ ok: false, error: null })
    // 0.001 would show as "×0" and log a meal of almost no calories: refused.
    for (const text of ['0', '0.05', '0.001', 'abc', '-1', '10.5', '1/2', '.']) {
      expect(checkFactor({ kind: 'other', text })).toEqual({ ok: false, error: copy.quickLog.amountError })
    }
  })

  it('shows a multiplier without float noise', () => {
    expect([0.5, 1, 1.5, 2, 1.25, 1 / 3].map(fmtFactor)).toEqual(['0.5', '1', '1.5', '2', '1.25', '0.33'])
  })
})

describe('quickLists', () => {
  const s = saved('s1', 'Usual oats', OATS)
  const doc = { meals: [OATS, SOUP, MYSTERY], savedMeals: [s] }

  it('builds Recent and Saved with each item’s values, source and likely range', () => {
    const lists = quickLists(doc, 1)
    // The oats (m1) are offered once, under Saved as "Usual oats", not in Recent as well.
    expect(lists.recent.map((i) => i.id)).toEqual(['m5', 'm2'])
    expect(lists.saved.map((i) => [i.id, i.values.name])).toEqual([['s1', 'Usual oats']])
    const oats = lists.saved[0]
    expect(oats.sourceLabel).toBe('Weighed')
    expect(oats.values.kcal).toBe(350)
    // 350 kcal weighed (8%): likely 350 / 1.08^1.2816 to 350 * 1.08^1.2816 = 317.1 to 386.3.
    expect(oats.likely!.lo).toBeCloseTo(317.12, 1)
    expect(oats.likely!.hi).toBeCloseTo(386.28, 1)
    const unknown = lists.recent[0]
    expect(unknown.values.kcal).toBeNull()
    expect(unknown.likely).toBeNull()
    expect(unknown.sourceLabel).toBeNull()
  })

  it('scales every item at the chosen amount, keeping the usual calories for the "×1.5 of" line', () => {
    const lists = quickLists(doc, 1.5)
    const oats = lists.saved[0]
    expect(oats.values).toMatchObject({ kcal: 525, protein: 16.5, source: 'weighed', name: 'Usual oats' })
    expect(oats.usualKcal).toBe(350)
    expect(oats.likely!.lo).toBeCloseTo(317.12 * 1.5, 1)
    expect(lists.recent[0].values.kcal).toBeNull()
  })

  it('a log with nothing yet has two empty lists; a log saved before saved meals existed has no Saved', () => {
    expect(quickLists(emptyLog(), 1)).toEqual({ recent: [], saved: [] })
    expect(quickLists({ meals: [SOUP] }, 1).saved).toEqual([])
  })
})

describe('logging a repeat', () => {
  it('is a fresh meal: its own id and time, the same name, source and values, no link back', () => {
    const fresh = mealFromValues(valuesOf(OATS), 'new-1', '2026-10-30T07:55:00-04:00')
    expect(fresh).toEqual({ ...OATS, id: 'new-1', eatenAt: '2026-10-30T07:55:00-04:00' })
    expect(Object.keys(fresh).sort()).toEqual(Object.keys(OATS).sort())
  })

  it('copies the note, foods and lookup as copies, and nothing a single entry carries on its own', () => {
    const rich = {
      ...OATS,
      note: 'Weighed dry',
      foods: [{ name: 'Oats', amount: 50, unit: 'g' as const }],
      imported: { original: 'kept with that one entry' },
    } as Meal
    const v = valuesOf(rich)
    expect(v).toEqual({ ...OATS, note: 'Weighed dry', foods: [{ name: 'Oats', amount: 50, unit: 'g' }], id: undefined, eatenAt: undefined })
    expect('imported' in v).toBe(false)
    expect(v.foods).not.toBe(rich.foods)
  })
})

describe('saved meals', () => {
  it('a saved meal keeps the values, with its own name, id and time saved', () => {
    expect(saved('s1', '  Usual oats ', OATS)).toEqual({
      id: 's1',
      name: 'Usual oats',
      source: 'weighed',
      kcal: 350,
      protein: 11,
      carbs: null,
      fat: null,
      savedAt: '2026-10-28T20:00:00-04:00',
      fromMealId: 'm1',
    })
  })

  it('needs a name that is not blank and not taken (case and spaces ignored), except by itself', () => {
    const list = [saved('s1', 'Usual oats', OATS)]
    expect(checkSavedName('  ', list)).toBe(copy.usualMeals.nameNeeded)
    expect(checkSavedName(' usual  OATS', list)).toBe(copy.usualMeals.nameTaken('Usual oats'))
    expect(checkSavedName('Usual oats', list, 's1')).toBeNull()
    expect(checkSavedName('Soup', list)).toBeNull()
    expect(checkSavedName('Soup')).toBeNull()
  })

  it('are listed by name', () => {
    const list = [saved('s2', 'tomato soup', SOUP), saved('s1', 'Apple', OATS), saved('s3', 'banana', OATS_BIGGER)]
    expect(savedInOrder(list).map((s) => s.name)).toEqual(['Apple', 'banana', 'tomato soup'])
  })

  it('a logged meal finds the saved meal saved from it, or one with its name and values', () => {
    const list = [saved('s1', 'Oats with honey', OATS)]
    expect(savedMatch(OATS_AGAIN, list)?.id).toBe('s1')
    expect(savedMatch(OATS_BIGGER, list)).toBeUndefined()
    expect(savedMatch(SOUP, [])).toBeUndefined()
    // Saved under another name: the meal it came from still knows, a lookalike does not.
    const renamed = [saved('s2', 'Usual oats', OATS)]
    expect(savedMatch(OATS, renamed)?.id).toBe('s2')
    expect(savedMatch(OATS_AGAIN, renamed)).toBeUndefined()
    // Two meals with every value unknown are not each other's match.
    const leftovers = [saved('s3', 'Leftovers', MYSTERY)]
    expect(savedMatch(meal('m9', 'Soup from the freezer', '2026-10-29T19:00:00-04:00', null), leftovers)).toBeUndefined()
  })

  it('a meal edited after it was saved no longer matches it: its details offer Save again', () => {
    const list = [saved('s2', 'Usual oats', OATS)]
    const edited = { ...OATS, kcal: 420 }
    expect(savedMatch(OATS, list)?.id).toBe('s2')
    expect(savedEarlier(OATS, list)).toBeUndefined()
    expect(savedMatch(edited, list)).toBeUndefined()
    // The saved meal still holds the values the meal had then; the details name it.
    expect(savedEarlier(edited, list)?.id).toBe('s2')
    expect(savedEarlier(edited, list)?.kcal).toBe(350)
    // Only the meal it was saved from: another meal knows nothing of it.
    expect(savedEarlier(SOUP, list)).toBeUndefined()
    // Edited back to the saved values, it matches again.
    expect(savedMatch({ ...edited, kcal: 350 }, list)?.id).toBe('s2')
  })

  it('saving the edited meal under the earlier name updates that saved meal in place', () => {
    const doc: LogDoc = { ...emptyLog(), meals: [OATS, SOUP], savedMeals: [saved('s0', 'Apple', SOUP), saved('s2', 'Usual oats', OATS)] }
    const edited = { ...OATS, kcal: 420 }
    const next = withSavedMealUpdated(doc, savedFromMeal(edited, 'Usual oats', 's2', '2026-10-30T20:00:00-04:00'))
    expect(next.savedMeals?.map((s) => [s.id, s.name, s.kcal])).toEqual([
      ['s0', 'Apple', 240],
      ['s2', 'Usual oats', 420],
    ])
    expect(savedMatch(edited, next.savedMeals)?.id).toBe('s2')
    expect(doc.savedMeals?.[1].kcal).toBe(350)
    expect(next.meals).toBe(doc.meals)
  })

  it('save, rename and delete change only the saved meals, never the logged meals or the original log', () => {
    const doc: LogDoc = { ...emptyLog(), meals: [OATS, SOUP] }
    const one = withSavedMeal(doc, saved('s1', 'Usual oats', OATS))
    expect(doc.savedMeals).toBeUndefined()
    expect(one.savedMeals?.map((s) => s.name)).toEqual(['Usual oats'])
    const renamed = withSavedMealRenamed(one, 's1', ' Big oats ')
    expect(renamed.savedMeals?.map((s) => s.name)).toEqual(['Big oats'])
    expect(one.savedMeals?.[0].name).toBe('Usual oats')
    const none = withoutSavedMeal(renamed, 's1')
    expect(none.savedMeals).toEqual([])
    for (const d of [one, renamed, none]) expect(d.meals).toBe(doc.meals)
  })

  it('round-trip through the saved document (Export writes the same document)', () => {
    const doc = withSavedMeal({ ...emptyLog(), meals: [OATS] }, saved('s1', 'Usual oats', { ...OATS, note: 'Weighed dry' }))
    const back = parseLogText(serializeLog(doc))
    expect(back.status).toBe('ok')
    if (back.status === 'ok') expect(back.doc).toStrictEqual(doc)
  })
})
