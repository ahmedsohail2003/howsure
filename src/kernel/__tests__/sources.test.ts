// spec.md > Maths Core: Sources Table.
import { describe, expect, it } from 'vitest'
import { LOG_SOURCE_IDS, MEAL_SOURCE_IDS, SOURCES, bestMealSource, getSource } from '../sources'
import type { SourceId } from '../types'

const TABLE: [SourceId, string, number][] = [
  ['weighed', 'Weighed', 0.08],
  ['label', 'Nutrition label (typed)', 0.1],
  ['label_lookup', 'Nutrition label (looked up)', 0.12],
  ['menu', 'Published menu', 0.21],
  ['photo', 'Photo estimate', 0.46],
  ['description', 'Description', 0.41],
  ['food_db', 'Food database', 0.15],
  ['burn_device', 'Device or watch estimate', 0.4],
  ['burn_machine', 'Machine display', 0.3],
  ['burn_guess', 'Rough guess', 0.5],
]

describe('SOURCES', () => {
  it('has every row of the spec table, and nothing else', () => {
    expect(Object.keys(SOURCES).sort()).toEqual(TABLE.map(([id]) => id).sort())
  })

  it.each(TABLE)('%s: "%s", typical error %d', (id, label, err) => {
    const s = getSource(id)
    expect(s.id).toBe(id)
    expect(s.label).toBe(label)
    expect(s.typicalError).toBe(err)
  })

  it('every row starts as "assumption" with a hint and its nearest study as context', () => {
    for (const s of Object.values(SOURCES)) {
      expect(s.basis.kind).toBe('assumption')
      expect(s.hint && s.hint.length).toBeTruthy()
      expect(s.context && s.context.length).toBeTruthy()
    }
  })

  it('every row was re-checked on 2026-10-26: "assumption" with its nearest study, or "study" with a DOI and date', () => {
    for (const s of Object.values(SOURCES)) {
      expect(s.basis.checked).toBe('2026-10-26')
      expect(s.basis.cite && s.basis.cite.length).toBeTruthy()
      if (s.basis.kind === 'study') {
        expect(s.basis.doi && s.basis.doi.length).toBeTruthy()
      } else {
        expect(s.basis.kind).toBe('assumption')
      }
    }
    // The strict rule upgraded no row: no study's own figure, for the matching method, backs its number.
    expect(Object.values(SOURCES).filter((s) => s.basis.kind === 'study')).toHaveLength(0)
    expect(SOURCES.photo.basis.doi).toBe('10.1016/j.cdnut.2025.107556')
    expect(SOURCES.description.context).toMatch(/1,877 diners/)
  })

  it('the photo hint defines "photo estimate" as an AI estimate from a meal photo', () => {
    expect(SOURCES.photo.hint).toMatch(/meal photo by an AI/)
    expect(SOURCES.photo.hint).toMatch(/Description/)
    expect(SOURCES.photo.basis.cite).toMatch(/Fridolfsson/) // slice 7 moved the citation from context into basis.cite
  })

  it('source text avoids the banned words', () => {
    const text = Object.values(SOURCES)
      .map((s) => [s.label, s.hint, s.context].join(' '))
      .join(' ')
      .toLowerCase()
    for (const w of ['accuracy', 'for sure', 'guaranteed', 'exactly', 'precise']) {
      expect(text).not.toContain(w)
    }
  })

  it('getSource throws on an unknown id', () => {
    expect(() => getSource('nope' as SourceId)).toThrow()
  })
})

describe('bestMealSource', () => {
  it('is the meal source with the lowest typical error (weighed today)', () => {
    expect(bestMealSource()).toBe('weighed')
    const min = Math.min(...MEAL_SOURCE_IDS.map((id) => SOURCES[id].typicalError))
    expect(SOURCES[bestMealSource()].typicalError).toBe(min)
  })

  it('the Tier 1 logging choices are weighed, label, menu, photo and description', () => {
    expect([...LOG_SOURCE_IDS]).toEqual(['weighed', 'label', 'menu', 'photo', 'description'])
  })
})
