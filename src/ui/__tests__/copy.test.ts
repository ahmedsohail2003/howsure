// Word rules for every user-visible string (spec.md > Screens > Copy checks) and the
// required wording from prd.md > Estimate Score and Explanations and spec.md > Maths Core.
import { describe, expect, it } from 'vitest'
import { copy } from '../copy'

/** Every string in copy.ts. Templates are called with placeholder text so their fixed words are checked. */
function allStrings(node: unknown, path = 'copy'): { path: string; text: string }[] {
  if (typeof node === 'string') return [{ path, text: node }]
  if (typeof node === 'function') {
    const out = (node as (...args: string[]) => unknown)('X', 'X', 'X', 'X')
    return allStrings(out, `${path}()`)
  }
  if (Array.isArray(node)) return node.flatMap((v, i) => allStrings(v, `${path}[${i}]`))
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => allStrings(v, `${path}.${k}`))
  }
  return []
}

const strings = allStrings(copy)

/** Templates that switch on a count: check their "1" branch too. */
const countBranches = [
  copy.headline.unknownCount(1),
  copy.macros.missing(1),
  copy.explainDay.unknownNote(1),
].map((text, i) => ({ path: `count branch ${i}`, text }))

const everything = [...strings, ...countBranches]

describe('copy.ts word rules', () => {
  it('collects a meaningful number of strings', () => {
    expect(strings.length).toBeGreaterThan(80)
  })

  it('never calls the score "accuracy" (study titles live in sources.ts, not here)', () => {
    const hits = everything.filter((s) => /accura/i.test(s.text))
    expect(hits).toEqual([])
  })

  it('never says "for sure"', () => {
    expect(everything.filter((s) => /for sure/i.test(s.text))).toEqual([])
  })

  it('uses "guarantee" only inside a negation', () => {
    const bad = everything.filter((s) => {
      const matches = [...s.text.matchAll(/guarantee/gi)]
      return matches.some((m) => {
        const before = s.text.slice(0, m.index).toLowerCase()
        return !/not a\s*$/.test(before)
      })
    })
    expect(bad).toEqual([])
  })

  it('never says "exactly" or "precise"', () => {
    expect(everything.filter((s) => /\bexact(ly)?\b|precis/i.test(s.text))).toEqual([])
  })

  it('never says "gut health"', () => {
    expect(everything.filter((s) => /gut health/i.test(s.text))).toEqual([])
  })

  it('calls the score "Estimate score"', () => {
    expect(copy.headline.estimateScore('83')).toBe('Estimate score 83')
    expect(copy.meals.rowScore('54')).toBe('Estimate score 54')
  })
})

describe('required wording', () => {
  it('has the meal-score sentence from prd.md, word for word', () => {
    expect(copy.explainMeal.sentence('90', '10')).toBe(
      'A 90% estimate score means this source is assigned a typical error of about 10%. It does not mean there is a 90% chance this meal is correct. The actual error could be larger.',
    )
  })

  it("has the day-score sentence from prd.md, word for word", () => {
    expect(copy.explainDay.sentence).toBe(
      "Each meal contributes calories and uncertainty. A large, uncertain meal can affect the total more than a small one. We combine those uncertainties and compare them with the day's total—we don't simply average the meal percentages.",
    )
  })

  it('says the likely range is not a guaranteed minimum and maximum', () => {
    expect(copy.explainRanges.explanation).toContain('not a guaranteed minimum and maximum')
  })

  it('has the planning line and the honesty line from prd.md', () => {
    expect(copy.explainRanges.planning).toBe('Staying under a target? Count the top of the very-likely range.')
    expect(copy.explainRanges.honesty).toBe(
      'Not a guarantee. Photos, menus and even nutrition labels can be off. Scan the label or weigh it to tighten this.',
    )
  })

  it('has the design-target line and the limit text from spec.md', () => {
    expect(copy.more.designTargets).toBe(
      "These ranges are design targets, meant to catch about 8 in 10 and 19 in 20 meals like this. HowSure hasn't measured its own hit rate.",
    )
    expect(copy.more.limit).toBe(
      "Errors from the same kind of source are added, because they tend to lean the same way. Different kinds partly cancel. Photo estimates and people's own descriptions can both run low on big plates, which this doesn't count, so a day of photo and described meals may be less sure than this shows.",
    )
  })

  it('has the fictional banner and the first-open choices', () => {
    expect(copy.fictionalBanner).toBe('Sample person — fictional')
    expect(copy.firstOpen.tryDemo).toBe('Try the fictional demo')
    expect(copy.firstOpen.startEmpty).toBe('Start empty')
  })

  it('has the partial-day and empty-day wording from prd.md', () => {
    expect(copy.headline.incompleteDay).toBe('Known meals only — incomplete day')
    expect(copy.headline.unknownCount(1)).toBe('1 meal with unknown calories')
    expect(copy.headline.notAvailable).toBe('Not available yet')
    expect(copy.emptyDay.noMeals).toBe('No meals logged yet')
    expect(copy.uncertainty.mostFrom('Pasta bake (ready meal)')).toBe('Most uncertainty comes from Pasta bake (ready meal).')
    expect(copy.uncertainty.alreadyBest).toBe('It already uses the most reliable source.')
    // prd.md > Improve That Entry: "Most uncertainty comes from [meal]. It already uses the most reliable source."
    expect(`${copy.uncertainty.mostFrom('Chicken, rice and broccoli')} ${copy.uncertainty.alreadyBest}`).toBe(
      'Most uncertainty comes from Chicken, rice and broccoli. It already uses the most reliable source.',
    )
    expect(copy.explainMeal.noBetter).toBe('No better source in HowSure.')
  })

  it('has the Improve wording and the storage messages from prd.md and spec.md', () => {
    expect(copy.uncertainty.improveEntry).toBe('Improve that entry')
    // spec.md > Important Failure Modes, word for word.
    expect(copy.storage.blocked).toBe(
      "Can't save on this device right now; your changes will be lost on reload.",
    )
    // spec.md > Store: "a failed parse shows "Couldn't read saved data"".
    expect(copy.storage.unreadable.startsWith("Couldn't read saved data")).toBe(true)
    // prd.md > Logging a Meal.
    expect(copy.logMeal.pickSourceHint).toBe('Pick how you know, so HowSure can say how sure.')
    expect(copy.logMeal.howKnow).toBe('How do you know?')
  })

  it('has the logging, empty-day and unknown wording from prd.md (slice 3)', () => {
    expect(copy.dashboard.logMeal).toBe('Log a meal')
    expect(copy.dashboard.logFirstMeal).toBe('Log your first meal')
    expect(copy.logMeal.titleNew).toBe('Log a meal')
    expect(copy.logMeal.optionalDetails).toBe('Optional details')
    // prd.md > States and Boundaries: totals, ranges and the estimate score say "Not available yet".
    expect(copy.headline.estimateScoreNotAvailable).toContain('Not available yet')
    expect(copy.headline.unknownCount(2)).toBe('2 meals with unknown calories')
    expect(copy.details.edit).toBe('Edit')
    expect(copy.details.delete).toBe('Delete')
  })

  it('formats the waking-day header like "Wed · awake since 1:20 PM"', () => {
    expect(copy.header.awakeSince('Wed', '1:20 PM')).toBe('Wed · awake since 1:20 PM')
  })
})
