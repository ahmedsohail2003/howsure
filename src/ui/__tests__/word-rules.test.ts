// tests/wordRules.ts: the copy word rules shared by copy.test.ts and the browser copy sweep
// (tests/e2e/copy-sweep.spec.ts). Each rule is shown catching what it should and letting the
// allowed wording through.
import { describe, expect, it } from 'vitest'
import { wordRuleHits } from '../../../tests/wordRules'

const matches = (text: string, allowed: string[] = []) => wordRuleHits(text, allowed).map((h) => h.match)

describe('word rules', () => {
  it('catches "accuracy" and its forms', () => {
    expect(matches('Accuracy 83')).toEqual(['Accuracy'])
    expect(matches('an accurate day')).toEqual(['accurate'])
  })

  it('lets a study title say "accuracy" when it is listed as allowed', () => {
    const title = 'Smith 2020, Accuracy of photo estimates'
    expect(matches(`Nearest study: ${title}.`, [title])).toEqual([])
    expect(matches(`Nearest study: ${title}. Accuracy 90.`, [title])).toEqual(['Accuracy'])
  })

  it('catches "for sure", "exact", "exactly", "precise" and "gut health"', () => {
    expect(matches('2,280 kcal for sure')).toEqual(['for sure'])
    expect(matches('the exact total, exactly')).toEqual(['exact', 'exactly'])
    expect(matches('a precise number, precisely')).toEqual(['precise', 'precisely'])
    expect(matches('Good for gut health')).toEqual(['gut health'])
  })

  it('lets "guarantee" through only inside a negation', () => {
    expect(matches('Not a guarantee. The likely range is not a guaranteed minimum and maximum.')).toEqual([])
    expect(matches('We guarantee this range.')).toEqual(['guarantee'])
    expect(matches('Guaranteed range')).toEqual(['Guaranteed'])
  })

  it('catches values leaked from code where "unknown" belongs', () => {
    expect(matches('NaN kcal')).toEqual(['NaN'])
    expect(matches('Protein undefined g')).toEqual(['undefined'])
    expect(matches('Fat null')).toEqual(['null'])
    expect(matches('[object Object]')).toEqual(['[object Object]'])
    expect(matches('Infinity%')).toEqual(['Infinity'])
  })

  it('passes plain, allowed wording', () => {
    expect(
      matches('Likely 1,870–2,780 kcal. Very likely 1,684–3,087 kcal. Estimate score 83. Protein unknown. Not a guarantee.'),
    ).toEqual([])
  })
})
