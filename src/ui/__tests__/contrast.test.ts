// spec.md > Look and Feel: "Contrast is a test". Reads src/ui/theme.css itself (no colour is
// written twice), works out every text colour and the backgrounds it can sit on, and computes
// the WCAG 2.x contrast ratio:
//   - text: at least 4.5:1 (WCAG 1.4.3, normal-size text);
//   - the --teal and --amber signal colours, and the --line-strong input border, against the
//     backgrounds around them: at least 3:1 (WCAG 1.4.11, non-text contrast).
// If a pair fails, fix theme.css, not the threshold.
//
// Which pairs: a rule that sets both a text colour and a background is checked as that pair.
// A state rule (":hover", ":disabled", ...) that sets only a background is checked with the text
// colour of its base rule. Every other light background is a surface any text may sit on, so
// every text colour used on light backgrounds is checked against every one of them: more pairs
// than the screens use, never fewer. A new colour or background in theme.css is picked up
// automatically.
//
// On top of that, the cascade check takes every element the .tsx files draw (each class list its
// className can take) in every mix of states, hover and disabled together included, and works
// out which color and background win, as the browser does. Text a rule sets inside another
// rule's fill (".a .b { color }") is checked against that fill too.
import { readdirSync, readFileSync } from 'node:fs'
import { parseSync } from 'vite'
import { describe, expect, it } from 'vitest'

// Read from disk: vitest stubs CSS imports, even with ?raw.
const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8')

// ---------- WCAG 2.x maths ----------

function channel(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Relative luminance of "#RRGGBB". */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const WHITE = '#FFFFFF'
const BLACK = '#000000'
/** A background is dark when white text would contrast with it more than black text. */
const isDark = (hex: string) => ratio(hex, WHITE) > ratio(hex, BLACK)

// ---------- reading theme.css ----------

interface Rule {
  selector: string
  decls: Map<string, string>
}

/** Blocks parseRules could not look inside. Must stay empty (see the "never skip" test). */
const skippedAtRules: string[] = []

/** At-rule blocks that hold ordinary rules, read like the top level. */
const NESTING_AT_RULES = /^@(media|supports|layer|container)\b/
/** At-rule blocks that hold no colours a person reads on a background. */
const NO_COLOUR_AT_RULES = /^@(keyframes|font-face)\b/

function parseRules(text: string, skipped: string[] = skippedAtRules): Rule[] {
  const rules: Rule[] = []
  let i = 0
  while (i < text.length) {
    const open = text.indexOf('{', i)
    if (open === -1) break
    // A statement at-rule (@import ...; @layer a, b;) ends at its ";", before the next block.
    const before = text.slice(i, open)
    const prelude = before.slice(before.lastIndexOf(';') + 1).trim()
    // Find the matching close brace.
    let depth = 1
    let j = open + 1
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth += 1
      else if (text[j] === '}') depth -= 1
      j += 1
    }
    const body = text.slice(open + 1, j - 1)
    if (NESTING_AT_RULES.test(prelude)) {
      rules.push(...parseRules(body, skipped))
    } else if (prelude.startsWith('@')) {
      // Any other at-rule block could hide colour rules: report it rather than skip it quietly.
      if (!NO_COLOUR_AT_RULES.test(prelude)) skipped.push(prelude)
    } else {
      const decls = new Map<string, string>()
      for (const part of body.split(';')) {
        const colon = part.indexOf(':')
        if (colon === -1) continue
        decls.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim())
      }
      for (const selector of prelude.split(',')) rules.push({ selector: selector.trim().replace(/\s+/g, ' '), decls })
    }
    i = j
  }
  return rules
}

const rules = parseRules(css.replace(/\/\*[\s\S]*?\*\//g, ''))
const root = rules.find((r) => r.selector === ':root')
const tokens = new Map([...(root?.decls ?? [])].filter(([k]) => k.startsWith('--')))

/** A solid colour as "#RRGGBB", or null for a value that has none (none, transparent, inherit). */
function solid(value: string): string | null | 'unreadable' {
  const v = value.trim()
  const ref = /^var\((--[\w-]+)\)$/.exec(v)
  if (ref) {
    const t = tokens.get(ref[1])
    return t === undefined ? 'unreadable' : solid(t)
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    return `#${h.toUpperCase()}`
  }
  if (/^(none|transparent|inherit|currentcolor)$/i.test(v)) return null
  return 'unreadable'
}

function bgOf(r: Rule): string | null | 'unreadable' {
  const v = r.decls.get('background-color') ?? r.decls.get('background')
  return v === undefined ? null : solid(v)
}

function colourOf(r: Rule): string | null | 'unreadable' {
  const v = r.decls.get('color')
  return v === undefined ? null : solid(v)
}

const PSEUDO_NAMES = 'hover|focus|focus-visible|focus-within|active|disabled|checked|visited'
const HAS_PSEUDO = new RegExp(`:(${PSEUDO_NAMES})\\b`)
const ALL_PSEUDO = new RegExp(`:(${PSEUDO_NAMES})\\b`, 'g')
/** The selector without its state parts: ".btn-primary:hover:not(:disabled)" -> ".btn-primary". */
const stripStates = (sel: string) => sel.replace(/:not\([^)]*\)/g, '').replace(ALL_PSEUDO, '')

/** Backgrounds that hold no text, with why. Each must still exist in theme.css. */
const NO_TEXT: Record<string, string> = {
  '.contrib-bar': 'the aria-hidden contribution bar holds no text; its share is printed beside it',
  '.contrib-bar span': 'the amber fill of that bar, also no text',
}
/** Backgrounds that only ever hold their own rule's text colour, with why. */
const ONLY_OWN_TEXT: Record<string, string> = {
  '.btn:disabled':
    'a disabled button holds only its label, in the colour the same rule sets (the cascade check below resolves it with every variant and hover)',
}
/** Translucent overlays, not surfaces text sits on. */
const OVERLAYS: Record<string, string> = {
  '.sheet-backdrop': 'the dimmed layer behind an open sheet; the sheet itself is --surface',
}

interface Pair {
  text: string
  bg: string
  where: string
}

const ownPairs: Pair[] = []
const surfaces = new Map<string, string>() // hex -> first selector that uses it
const darkUnpaired: string[] = []
const unreadable: string[] = []

for (const r of rules) {
  const bg = bgOf(r)
  const fg = colourOf(r)
  if (bg === 'unreadable' && !(r.selector in OVERLAYS)) unreadable.push(`${r.selector} background`)
  if (fg === 'unreadable') unreadable.push(`${r.selector} color`)
  if (typeof bg !== 'string' || bg === 'unreadable' || r.selector in NO_TEXT) continue

  let text = typeof fg === 'string' && fg !== 'unreadable' ? fg : null
  if (!text && HAS_PSEUDO.test(r.selector)) {
    // A state rule keeps its base rule's text colour (e.g. .btn-primary:hover keeps white).
    const base = stripStates(r.selector)
    const baseRule = rules.filter((b) => b.selector === base && typeof colourOf(b) === 'string').pop()
    const c = baseRule ? colourOf(baseRule) : null
    if (c && c !== 'unreadable') text = c
  }

  if (text) ownPairs.push({ text, bg, where: r.selector })
  if (isDark(bg)) {
    if (!text) darkUnpaired.push(r.selector)
  } else if (!(r.selector in ONLY_OWN_TEXT) && !surfaces.has(bg)) {
    surfaces.set(bg, r.selector)
  }
}

/** Every text colour set in a rule that doesn't put it on a dark fill of its own. */
const lightTextColours = new Map<string, string>()
for (const r of rules) {
  const fg = colourOf(r)
  const bg = bgOf(r)
  if (typeof fg !== 'string' || fg === 'unreadable') continue
  if (typeof bg === 'string' && bg !== 'unreadable' && isDark(bg)) continue
  if (!lightTextColours.has(fg)) lightTextColours.set(fg, r.selector)
}

const surfacePairs: Pair[] = []
for (const [text, textWhere] of lightTextColours) {
  for (const [bg, bgWhere] of surfaces) surfacePairs.push({ text, bg, where: `${textWhere} on ${bgWhere}` })
}

// ---------- the cascade: every state of every element the screens draw ----------
//
// A rule-by-rule reading misses pairs the cascade makes: a variant's ":hover" background can win
// over ":disabled" while the disabled text colour stays. So for each element the .tsx files draw
// (its tag and every class list its className can take), and for every mix of states
// (hover, disabled, focus, ...), this works out which color and background win, by specificity
// and then source order, the way the browser does. Only simple selectors take part here
// (".btn-primary:hover:not(:disabled)"); a rule with a combinator is checked by the
// descendant check below and the surface check above.

interface Compound {
  tag: string | null
  classes: string[]
  states: string[]
  notStates: string[]
  specificity: number
}

/** A selector with no combinator, as its parts; null for anything else. */
function parseCompound(sel: string): Compound | null {
  const m = /^([a-z][\w-]*|\*)?((?:\.[\w-]+|:not\(:[\w-]+\)|:[\w-]+)*)$/i.exec(sel)
  if (!m) return null
  const tag = m[1] && m[1] !== '*' ? m[1].toLowerCase() : null
  const classes: string[] = []
  const states: string[] = []
  const notStates: string[] = []
  for (const part of m[2].match(/\.[\w-]+|:not\(:[\w-]+\)|:[\w-]+/g) ?? []) {
    if (part.startsWith('.')) classes.push(part.slice(1))
    else if (part.startsWith(':not(')) notStates.push(part.slice(6, -1))
    else states.push(part.slice(1))
  }
  // Specificity (a, b, c) as one number: classes and pseudo-classes (":not(x)" counts as x) are b,
  // the tag is c. theme.css has no ids.
  return { tag, classes, states, notStates, specificity: (classes.length + states.length + notStates.length) * 100 + (tag ? 1 : 0) }
}

interface Element {
  tag: string | null // null: a component that passes className on to an element we can't see
  classes: string[]
  where: string
}

interface CascadeResult {
  pairs: Pair[]
  /** Dark backgrounds that win with no text colour of their own. */
  darkWithoutText: string[]
  /** Text colours that win with no background of their own: checked on every light surface. */
  bareText: Pair[]
}

function cascade(ruleList: Rule[], elements: Element[], surfaceMap: Map<string, string>): CascadeResult {
  const compounds = ruleList
    .map((r, index) => ({ r, index, c: parseCompound(r.selector) }))
    .filter((x): x is { r: Rule; index: number; c: Compound } => x.c !== null)
  const stateNames = [...new Set(compounds.flatMap((x) => [...x.c.states, ...x.c.notStates]))].filter((n) =>
    new RegExp(`^(${PSEUDO_NAMES})$`).test(n),
  )
  const stateSets: string[][] = [[]]
  for (const n of stateNames) for (const set of [...stateSets]) stateSets.push([...set, n])

  const out: CascadeResult = { pairs: [], darkWithoutText: [], bareText: [] }
  const seen = new Set<string>()
  for (const el of elements) {
    for (const states of stateSets) {
      const matching = compounds
        .filter(
          ({ c }) =>
            (c.tag === null || el.tag === null || c.tag === el.tag) &&
            c.classes.every((k) => el.classes.includes(k)) &&
            c.states.every((st) => states.includes(st)) &&
            !c.notStates.some((st) => states.includes(st)),
        )
        .sort((a, b) => a.c.specificity - b.c.specificity || a.index - b.index)
      const winner = (has: (r: Rule) => boolean) => matching.filter((x) => has(x.r)).pop()?.r
      const fgRule = winner((r) => r.decls.has('color'))
      const bgRule = winner((r) => r.decls.has('background') || r.decls.has('background-color'))
      const fg = fgRule ? colourOf(fgRule) : null
      const bg = bgRule ? bgOf(bgRule) : null
      const label = `<${el.tag ?? 'component'} class="${el.classes.join(' ')}">${states.length ? ` :${states.join(' :')}` : ''} (${el.where})`
      const add = (list: Pair[] | string[], key: string, item: Pair | string) => {
        if (seen.has(key)) return
        seen.add(key)
        ;(list as (Pair | string)[]).push(item)
      }
      const fgHex = typeof fg === 'string' && fg !== 'unreadable' ? fg : null
      const bgHex = typeof bg === 'string' && bg !== 'unreadable' ? bg : null
      if (bgHex && fgHex) {
        add(out.pairs, `${fgHex} ${bgHex}`, { text: fgHex, bg: bgHex, where: `${label}: ${fgRule!.selector} on ${bgRule!.selector}` })
      } else if (bgHex && isDark(bgHex)) {
        add(out.darkWithoutText, `dark ${bgHex} ${label}`, `${label}: ${bgRule!.selector} has no text colour`)
      } else if (fgHex && !bgHex) {
        for (const [surface, surfaceWhere] of surfaceMap) {
          add(out.bareText, `${fgHex} ${surface}`, { text: fgHex, bg: surface, where: `${label}: ${fgRule!.selector} on ${surfaceWhere}` })
        }
      }
    }
  }
  return out
}

type AstNode = { type: string; [k: string]: unknown }

/** The string pieces a className expression can take, following ?:, &&, ||, ?? and templates. */
function classStrings(n: AstNode | null | undefined, unread: string[], where: string): string[] {
  if (!n) return []
  switch (n.type) {
    case 'Literal':
      return typeof n.value === 'string' ? [n.value] : []
    case 'Identifier':
      if (n.name === 'undefined') return []
      unread.push(`${where}: className={${String(n.name)}}`)
      return []
    case 'TemplateLiteral':
      return [(n.quasis as { value: { raw: string } }[]).map((q) => q.value.raw).join(' ')]
    case 'ConditionalExpression':
      return [...classStrings(n.consequent as AstNode, unread, where), ...classStrings(n.alternate as AstNode, unread, where)]
    case 'LogicalExpression':
      return [...classStrings(n.left as AstNode, unread, where), ...classStrings(n.right as AstNode, unread, where)]
    case 'ParenthesizedExpression':
    case 'TSAsExpression':
      return classStrings(n.expression as AstNode, unread, where)
    default:
      unread.push(`${where}: className expression ${n.type}`)
      return []
  }
}

/** Every element the .tsx files in src/ui draw, with each class list it can take. */
function elementsInUi(unread: string[]): Element[] {
  const dir = new URL('../', import.meta.url)
  const out: Element[] = [{ tag: 'body', classes: [], where: 'index.html' }]
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx'))) {
    const parsed = parseSync(file, readFileSync(new URL(file, dir), 'utf8'))
    const walk = (n: unknown): void => {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) return n.forEach(walk)
      const node = n as AstNode
      if (node.type === 'JSXOpeningElement') {
        const name = node.name as AstNode
        const tag = name.type === 'JSXIdentifier' && /^[a-z]/.test(String(name.name)) ? String(name.name) : null
        const attr = (node.attributes as AstNode[]).find(
          (a) => a.type === 'JSXAttribute' && (a.name as AstNode).name === 'className',
        )
        const value = attr?.value as AstNode | undefined
        const lists = !value
          ? tag
            ? ['']
            : []
          : value.type === 'JSXExpressionContainer'
            ? classStrings(value.expression as AstNode, unread, file)
            : classStrings(value, unread, file)
        for (const list of lists) out.push({ tag, classes: list.split(/\s+/).filter(Boolean), where: file })
      }
      for (const [k, v] of Object.entries(node)) if (k !== 'type') walk(v)
    }
    walk(parsed.program)
  }
  return out
}

/** Class names code sets outside className (classList), and what they sit on. */
const CODE_CLASSES: Element[] = [{ tag: 'html', classes: ['full-view'], where: 'fullScreen.ts (classList on <html>)' }]

const unreadClassNames: string[] = []
const uiElements = [...elementsInUi(unreadClassNames), ...CODE_CLASSES]
const resolved = cascade(rules, uiElements, surfaces)

// ---------- text set inside a fill: ".a .b { color }" sits on ".a"'s background ----------

function descendantPairs(ruleList: Rule[]): Pair[] {
  const out: Pair[] = []
  for (const r of ruleList) {
    const fg = colourOf(r)
    if (typeof fg !== 'string' || fg === 'unreadable') continue
    if (typeof bgOf(r) === 'string') continue // its own fill is what it sits on (checked above)
    const tokens = r.selector.split(' ')
    for (let k = 0; k < tokens.length - 1; k += 1) {
      if (['>', '+', '~'].includes(tokens[k])) continue
      // Only ancestors: the next combinator must be a space or ">", not "+" or "~".
      if (tokens[k + 1] === '+' || tokens[k + 1] === '~') continue
      const ancestor = stripStates(tokens[k])
      for (const b of ruleList) {
        const bg = bgOf(b)
        if (typeof bg !== 'string' || bg === 'unreadable' || stripStates(b.selector) !== ancestor) continue
        out.push({ text: fg, bg, where: `${r.selector} inside ${b.selector}` })
      }
    }
  }
  return out
}

const insidePairs = descendantPairs(rules)

// ---------- signal colours (non-text) ----------

const SIGNALS = ['--teal', '--amber', '--line-strong']
const SIGNAL_PROPS = /^(background|background-color|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|box-shadow|accent-color|text-decoration-color|fill|stroke)$/

interface SignalUse {
  token: string
  hex: string
  against: string
  where: string
}

const signalUses: SignalUse[] = []
for (const r of rules) {
  if (r.selector === ':root') continue
  for (const [prop, value] of r.decls) {
    if (!SIGNAL_PROPS.test(prop)) continue
    for (const token of SIGNALS) {
      if (!value.includes(`var(${token})`)) continue
      const hex = solid(`var(${token})`) as string
      const where = `${r.selector} { ${prop} }`
      const own = bgOf(r)
      const isFill = prop === 'background' || prop === 'background-color'
      // A border or outline sits on the element's own fill, unless it is the same colour as
      // that fill (then it is just the fill's edge, checked against the surroundings below).
      if (!isFill && typeof own === 'string' && own !== 'unreadable' && own !== hex) {
        signalUses.push({ token, hex, against: own, where: `${where} on its own background` })
      }
      // And on whatever is behind the element: its parent's fill if the selector names one,
      // otherwise any surface.
      const parts = r.selector.split(' ')
      const parentRule =
        parts.length > 1
          ? rules.filter((p) => p.selector === parts.slice(0, -1).join(' ') && typeof bgOf(p) === 'string').pop()
          : undefined
      const parentBg = parentRule ? bgOf(parentRule) : null
      if (typeof parentBg === 'string' && parentBg !== 'unreadable') {
        signalUses.push({ token, hex, against: parentBg, where: `${where} on ${parentRule!.selector}` })
      } else {
        for (const [bg, bgWhere] of surfaces) signalUses.push({ token, hex, against: bg, where: `${where} on ${bgWhere}` })
      }
    }
  }
}

const fmt = (n: number) => n.toFixed(2)

// ---------- tests ----------

describe('reading theme.css', () => {
  it('finds the colour tokens and the rules that use them', () => {
    for (const t of ['--bg', '--surface', '--ink', '--ink-soft', '--teal', '--teal-ink', '--amber', '--amber-ink', '--amber-bg']) {
      expect(tokens.has(t), t).toBe(true)
    }
    expect(lightTextColours.size).toBeGreaterThanOrEqual(4)
    expect(surfaces.size).toBeGreaterThanOrEqual(4)
    expect(ownPairs.length).toBeGreaterThanOrEqual(5)
    expect(signalUses.length).toBeGreaterThanOrEqual(20)
  })

  it('can read every color and background value (add new forms to the parser, never skip them)', () => {
    expect(unreadable).toEqual([])
  })

  it('every dark fill names the colour of the text on it', () => {
    expect(darkUnpaired).toEqual([])
  })

  it('looks inside every at-rule block that can hold colour rules (no block is skipped)', () => {
    expect(skippedAtRules).toEqual([])
    const skipped: string[] = []
    const sample = parseRules(
      '@import url(x.css); @supports (color: red) { .a { color: var(--ink) } } @layer base { .b { color: var(--ink) } } @font-feature-values F { @swash { s: 1 } } .c { color: var(--ink) }',
      skipped,
    )
    expect(sample.map((r) => r.selector)).toEqual(['.a', '.b', '.c'])
    expect(skipped).toEqual(['@font-feature-values F'])
  })

  it('reads the class lists of the elements the screens draw', () => {
    expect(unreadClassNames).toEqual([])
    const lists = uiElements.map((e) => e.classes.join(' '))
    for (const l of ['btn btn-primary', 'btn btn-quiet', 'btn btn-plain', 'btn btn-ink', 'callout amber']) expect(lists).toContain(l)
  })

  it('every exception still exists in theme.css', () => {
    for (const sel of [...Object.keys(NO_TEXT), ...Object.keys(ONLY_OWN_TEXT), ...Object.keys(OVERLAYS)]) {
      expect(rules.some((r) => r.selector === sel), sel).toBe(true)
    }
  })
})

describe('agrees with the ratios spec.md lists (computed in Python, 2026-10-26)', () => {
  const t = (name: string) => solid(`var(${name})`) as string
  it.each([
    ['--amber', '--bg', 3.41],
    ['--teal', '--bg', 4.43],
    ['--amber-ink', '--bg', 5.53],
    ['--amber-ink', '--amber-bg', 5.28],
    ['--amber-ink', '--surface', 5.91],
    ['--teal-ink', '--bg', 5.2],
    ['--teal-ink', '--amber-bg', 4.97],
    ['--teal-ink', '--surface', 5.56],
  ])('%s on %s is %s:1', (fg, bg, want) => {
    expect(fmt(ratio(t(fg), t(bg)))).toBe(want.toFixed(2))
  })

  it('white on --teal is 4.73:1', () => {
    expect(fmt(ratio(WHITE, t('--teal')))).toBe('4.73')
  })

  it("matches theme.css's own notes: --line-strong 3.50 on white and 3.28 on --bg; --teal-ink 5.18 on --teal-bg", () => {
    // Recomputed in Python (WCAG 2.x formula), 2026-11-05.
    expect(fmt(ratio(t('--line-strong'), WHITE))).toBe('3.50')
    expect(fmt(ratio(t('--line-strong'), t('--bg')))).toBe('3.28')
    expect(fmt(ratio(t('--teal-ink'), t('--teal-bg')))).toBe('5.18')
  })
})

describe('text contrast: at least 4.5:1', () => {
  it('each rule that sets both a text colour and a background', () => {
    const bad = ownPairs
      .filter((p) => ratio(p.text, p.bg) < 4.5)
      .map((p) => `${p.where}: ${p.text} on ${p.bg} is ${fmt(ratio(p.text, p.bg))}:1`)
    expect(bad).toEqual([])
  })

  it('every element, in every mix of states, with the color and background the cascade gives it', () => {
    expect(resolved.pairs.length).toBeGreaterThanOrEqual(5)
    const bad = resolved.pairs
      .filter((p) => ratio(p.text, p.bg) < 4.5)
      .map((p) => `${p.where}: ${p.text} on ${p.bg} is ${fmt(ratio(p.text, p.bg))}:1`)
    expect(bad).toEqual([])
    expect(resolved.darkWithoutText).toEqual([])
  })

  it('a disabled button stays readable while the mouse is over it, in every variant', () => {
    for (const variant of ['btn-primary', 'btn-ink', 'btn-plain', 'btn-quiet']) {
      // cascade() tries every mix of states, :hover with :disabled included.
      const one = cascade(rules, [{ tag: 'button', classes: ['btn', variant], where: 'test' }], surfaces)
      expect(one.pairs.length, variant).toBeGreaterThanOrEqual(2)
      expect(Math.min(...one.pairs.map((p) => ratio(p.text, p.bg))), variant).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('text a rule sets inside a fill, checked against that fill', () => {
    const bad = insidePairs
      .filter((p) => ratio(p.text, p.bg) < 4.5)
      .map((p) => `${p.where}: ${p.text} on ${p.bg} is ${fmt(ratio(p.text, p.bg))}:1`)
    expect(bad).toEqual([])
  })

  it('a text colour with no background of its own, on every light surface', () => {
    const bad = resolved.bareText
      .filter((p) => ratio(p.text, p.bg) < 4.5)
      .map((p) => `${p.where}: ${p.text} on ${p.bg} is ${fmt(ratio(p.text, p.bg))}:1`)
    expect(bad).toEqual([])
  })

  it('every text colour on every light surface', () => {
    expect(surfacePairs.length).toBeGreaterThanOrEqual(16)
    const bad = surfacePairs
      .filter((p) => ratio(p.text, p.bg) < 4.5)
      .map((p) => `${p.where}: ${p.text} on ${p.bg} is ${fmt(ratio(p.text, p.bg))}:1`)
    expect(bad).toEqual([])
  })

  it('--teal and --amber are never used as text colours (the -ink tokens are)', () => {
    const misuse = rules
      .filter((r) => /^var\(--(teal|amber)\)$/.test(r.decls.get('color') ?? ''))
      .map((r) => r.selector)
    expect(misuse).toEqual([])
  })
})

describe('signal colours: at least 3:1 against what surrounds them', () => {
  it.each(SIGNALS)('%s', (token) => {
    const uses = signalUses.filter((u) => u.token === token)
    expect(uses.length, `${token} is used somewhere`).toBeGreaterThan(0)
    const bad = uses
      .filter((u) => ratio(u.hex, u.against) < 3)
      .map((u) => `${u.where}: ${u.hex} on ${u.against} is ${fmt(ratio(u.hex, u.against))}:1`)
    expect(bad).toEqual([])
  })
})

describe('the cascade check itself', () => {
  // The rules as they were before the fix: ".btn-primary:hover" comes after ".btn:disabled" with
  // the same specificity (0,2,0), so a disabled primary button under the mouse got the dark hover
  // fill and kept the disabled grey text. --ink-soft #5E5A55 on --teal-ink #2A736E is 1.23:1
  // (worked out in Python with the WCAG 2.x formula, 2026-11-05).
  const BEFORE = `
    .btn { background: var(--surface); color: var(--teal-ink); }
    .btn:hover { background: var(--teal-bg); }
    .btn:disabled { background: var(--line); color: var(--ink-soft); }
    .btn-primary { background: var(--teal); color: #FFFFFF; }
    .btn-primary:hover { background: var(--teal-ink); }
  `
  const AFTER = BEFORE.replace(/:hover/g, ':hover:not(:disabled)')
  const button: Element[] = [{ tag: 'button', classes: ['btn', 'btn-primary'], where: 'sample' }]
  const failing = (css: string) =>
    cascade(parseRules(css), button, surfaces)
      .pairs.filter((p) => ratio(p.text, p.bg) < 4.5)
      .map((p) => `${p.text} on ${p.bg} ${fmt(ratio(p.text, p.bg))}`)

  it('finds the disabled-and-hovered primary button the old rules drew', () => {
    expect(failing(BEFORE)).toEqual(['#5E5A55 on #2A736E 1.23'])
  })

  it('passes the same button once hover skips disabled', () => {
    expect(failing(AFTER)).toEqual([])
  })

  it('pairs text set inside a dark fill with that fill', () => {
    const pairs = descendantPairs(parseRules('.btn-primary { background: var(--teal); color: #FFFFFF; } .btn-primary .sub { color: var(--ink-soft); }'))
    // --ink-soft #5E5A55 on --teal #2F7F7A: 1.45:1 (Python, WCAG 2.x, 2026-11-05).
    expect(pairs.map((p) => `${p.where}: ${fmt(ratio(p.text, p.bg))}`)).toEqual(['.btn-primary .sub inside .btn-primary: 1.45'])
  })
})
