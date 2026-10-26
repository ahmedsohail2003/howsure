// prd.md > Improve That Entry and spec.md > The Core Journey Through the System, step 4:
// the before/after preview runs buildDayView() on a copy of the log, so its numbers are the
// ones the dashboard shows after Save (G11 -> G11b), and the log itself is untouched until then.
import { describe, expect, it } from 'vitest'
import type { Meal } from '../../kernel/types'
import { demoDoc, demoStartIso } from '../../kernel/__tests__/helpers'
import { emptyLog, type LogDoc } from '../../store/log'
import { buildDayView } from '../dayView'
import { checkDraft, draftFromMeal, previewEdit, toLocalInput, withMeal } from '../editMeal'

const round = (r: { lo: number; hi: number } | null) => (r ? [Math.round(r.lo), Math.round(r.hi)] : null)

function summary(doc: LogDoc, at: string) {
  const v = buildDayView(doc, at)
  return {
    total: v.day.knownTotal,
    score: v.day.score,
    likely: round(v.day.likely),
    veryLikely: round(v.day.veryLikely),
    biggest: v.biggest?.name ?? null,
    improveHidden: v.improvement === null,
  }
}

const pasta = demoDoc.meals.find((m) => m.name === 'Pasta bake (ready meal)') as Meal

describe("improving the demo's pasta bake from its note (G11 -> G11b)", () => {
  it('opens with its current values and its note, nothing changed', () => {
    const draft = draftFromMeal(pasta)
    expect(draft).toEqual({
      name: 'Pasta bake (ready meal)',
      source: 'photo',
      kcal: '760',
      eatenAtLocal: '2026-10-21T17:30',
      protein: '34',
      carbs: '84',
      fat: '30',
      note: 'Label on the box (whole package): 860 kcal, protein 42 g, carbs 96 g, fat 33 g.',
    })
    // Saving an untouched draft stores the same meal.
    expect(checkDraft(draft, pasta)).toEqual({ meal: pasta, errors: {} })
  })

  const before = structuredClone(demoDoc)
  const draft = { ...draftFromMeal(pasta), source: 'label' as const, kcal: '860', protein: '42', carbs: '96', fat: '33' }
  const { meal: edited, errors } = checkDraft(draft, pasta)
  const preview = previewEdit(demoDoc, demoStartIso, edited as Meal)

  it('the label values parse into the edited meal', () => {
    expect(errors).toEqual({})
    expect(edited).toMatchObject({ id: pasta.id, source: 'label', kcal: 860, protein: 42, carbs: 96, fat: 33 })
    expect(edited?.eatenAt).toBe(pasta.eatenAt)
  })

  it('before is G11: 2280, score 83, likely 1870–2780, very likely 1684–3087', () => {
    expect(preview.before.day.knownTotal).toBe(2280)
    expect(preview.before.day.score).toBe(83)
    expect(round(preview.before.day.likely)).toEqual([1870, 2780])
    expect(round(preview.before.day.veryLikely)).toEqual([1684, 3087])
  })

  it('after is G11b: 2380, score 92, likely 2153–2631, very likely 2042–2775, apple and peanut butter biggest', () => {
    expect(preview.after.day.knownTotal).toBe(2380)
    expect(preview.after.day.score).toBe(92)
    expect(round(preview.after.day.likely)).toEqual([2153, 2631])
    expect(round(preview.after.day.veryLikely)).toEqual([2042, 2775])
    expect(preview.after.biggest?.name).toBe('Apple and peanut butter')
    expect(preview.stillOnThisDay).toBe(true)
  })

  it('the preview leaves the log untouched', () => {
    expect(demoDoc).toEqual(before)
  })

  it('after Save the dashboard shows the same numbers as the preview', () => {
    const saved = withMeal(demoDoc, edited as Meal)
    expect(buildDayView(saved, demoStartIso)).toEqual(preview.after)
    expect(summary(saved, demoStartIso)).toEqual({
      total: 2380,
      score: 92,
      likely: [2153, 2631],
      veryLikely: [2042, 2775],
      biggest: 'Apple and peanut butter',
      improveHidden: false,
    })
  })

  it('a time on another waking day is flagged in the preview', () => {
    const moved = checkDraft({ ...draft, eatenAtLocal: '2026-10-20T17:30' }, pasta)
    const p = previewEdit(demoDoc, demoStartIso, moved.meal as Meal)
    expect(p.stillOnThisDay).toBe(false)
    expect(p.after.meals.some((m) => m.id === pasta.id)).toBe(false)
  })
})

describe('calorie and macro input in the edit sheet (prd.md > Calorie Input Rules)', () => {
  const base = draftFromMeal(pasta)

  it('blank calories save as unknown, never 0; a typed 0 stays 0', () => {
    expect(checkDraft({ ...base, kcal: '' }, pasta).meal?.kcal).toBeNull()
    expect(checkDraft({ ...base, kcal: '  ' }, pasta).meal?.kcal).toBeNull()
    expect(checkDraft({ ...base, kcal: '0' }, pasta).meal?.kcal).toBe(0)
    expect(checkDraft({ ...base, protein: '' }, pasta).meal?.protein).toBeNull()
  })

  it('"abc" and "-50" are inline errors that block Save', () => {
    for (const kcal of ['abc', '-50']) {
      const c = checkDraft({ ...base, kcal }, pasta)
      expect(c.meal).toBeNull()
      expect(c.errors.kcal).toBe('Use digits, e.g. 1501 or 13.9')
    }
    expect(checkDraft({ ...base, fat: 'lots' }, pasta).errors.fat).toBe('Use digits, e.g. 1501 or 13.9')
  })

  it('"1,501" reads as 1501', () => {
    expect(checkDraft({ ...base, kcal: '1,501' }, pasta).meal?.kcal).toBe(1501)
  })

  it('a blank name or date and time blocks Save', () => {
    expect(checkDraft({ ...base, name: '  ' }, pasta).meal).toBeNull()
    expect(checkDraft({ ...base, eatenAtLocal: '' }, pasta).meal).toBeNull()
  })

  it('reads and writes date and time in local time', () => {
    expect(toLocalInput('2026-10-22T00:40:00-04:00')).toBe('2026-10-22T00:40')
    const c = checkDraft({ ...base, eatenAtLocal: '2026-10-21T18:05' }, pasta)
    expect(c.meal?.eatenAt).toBe('2026-10-21T18:05:00-04:00')
  })

  it('clearing the note removes it', () => {
    expect(checkDraft({ ...base, note: '' }, pasta).meal).not.toHaveProperty('note')
  })
})

describe('G12: when the biggest contributor already uses the best source, Improve is hidden', () => {
  it('weighed 700 + label 150: the weighed meal is biggest and improve() is null', () => {
    const doc: LogDoc = {
      ...emptyLog(),
      meals: [
        { id: 'w', name: 'Weighed dinner', eatenAt: '2026-10-26T18:00:00-04:00', source: 'weighed', kcal: 700, protein: null, carbs: null, fat: null },
        { id: 'l', name: 'Label snack', eatenAt: '2026-10-26T15:00:00-04:00', source: 'label', kcal: 150, protein: null, carbs: null, fat: null },
      ],
    }
    expect(summary(doc, '2026-10-26T20:00:00-04:00')).toEqual({
      total: 850,
      score: 93,
      likely: [781, 925],
      veryLikely: [747, 967],
      biggest: 'Weighed dinner',
      improveHidden: true,
    })
  })
})
