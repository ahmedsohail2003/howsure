// The copy word rules (spec.md > Look and Feel > Copy tone; spec.md > Screens > Copy checks), in one
// place for the unit tests on copy.ts and the browser sweep over every view and sheet
// (tests/e2e/copy-sweep.spec.ts).

export interface WordRuleHit {
  rule: string
  match: string
  context: string
}

interface Rule {
  name: string
  pattern: RegExp
  /** Return true to let this match stand (e.g. "guarantee" inside a negation). */
  allow?: (before: string) => boolean
}

const RULES: Rule[] = [
  { name: 'say "Estimate score", never "accuracy"', pattern: /accura\w*/gi },
  { name: 'say "likely" or "very likely", never "for sure"', pattern: /for sure/gi },
  {
    name: '"guarantee" only inside a negation ("not a guarantee")',
    pattern: /guarantee\w*/gi,
    allow: (before) => /not a\s*$/i.test(before),
  },
  { name: 'never "exact" or "precise"', pattern: /\bexact(ly)?\b|precis\w*/gi },
  { name: 'never "gut health"', pattern: /gut health/gi },
  // Values that leaked from code instead of copy (an unknown must read "unknown", never these).
  { name: 'no leaked code values', pattern: /\b(NaN|undefined|null|Infinity)\b|\[object Object\]/g },
]

/**
 * Every place `text` breaks a word rule. `allowed` lists exact passages that may break them
 * (study titles from src/kernel/sources.ts, which spec.md lets say "accuracy").
 */
export function wordRuleHits(text: string, allowed: readonly string[] = []): WordRuleHit[] {
  let checked = text
  for (const a of allowed) if (a) checked = checked.split(a).join(' ')
  const hits: WordRuleHit[] = []
  for (const rule of RULES) {
    for (const m of checked.matchAll(rule.pattern)) {
      const at = m.index ?? 0
      if (rule.allow?.(checked.slice(0, at))) continue
      hits.push({
        rule: rule.name,
        match: m[0],
        context: checked.slice(Math.max(0, at - 40), at + m[0].length + 40).replace(/\s+/g, ' '),
      })
    }
  }
  return hits
}
