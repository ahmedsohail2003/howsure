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
// colour of its base rule. Every other background of the look's own tone (light in a light look,
// dark in a dark one) is a surface any text may sit on, so every text colour used on those
// surfaces is checked against every one of them: more pairs than the screens use, never fewer. A
// fill of the opposite tone (a teal button in a light look, a light teal button in a dark look)
// must name the text colour on it. A new colour or background in theme.css is picked up
// automatically.
//
// On top of that, the cascade check takes every element the .tsx files draw (each class list its
// className can take) in every mix of states, hover and disabled together included, and works
// out which color and background win, as the browser does. Text a rule sets inside another
// rule's fill (".a .b { color }") is checked against that fill too.
//
// Every look (build-out item 1.5.2) is checked with all of the above. Journal, the default, is
// theme.css without any look-scoped rule. Another look is Journal's rules plus the rules scoped
// to it ([data-look="night"] ...), with its token overrides ([data-look="night"] { --bg: ... })
// applied on top of the :root palette, and without the rules of any other look. Each look named
// in theme.css, and each look src/ui/looks.ts offers, is found and checked automatically. A
// look's tone is its --bg's: Journal and Panel are light, Night (item 1.5.2c) is dark.
import { readdirSync, readFileSync } from 'node:fs'
import { parseSync } from 'vite'
import { describe, expect, it } from 'vitest'
import { DARK_LOOKS } from '../../store/earlyLook'
import type { Look } from '../../store/look'
import { BUILT_LOOKS } from '../looks'

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
  /** Specificity a look scope added before it was taken off the selector: [data-look] is (0,1,0). */
  bonus?: number
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

const allRules = parseRules(css.replace(/\/\*[\s\S]*?\*\//g, ''))

type Tokens = Map<string, string>

/** The custom properties set in a list of rules' :root blocks, later ones winning. */
function rootTokens(ruleList: Rule[]): Tokens {
  const out: Tokens = new Map()
  for (const r of ruleList) {
    if (r.selector !== ':root') continue
    for (const [k, v] of r.decls) if (k.startsWith('--')) out.set(k, v)
  }
  return out
}

/** A solid colour as "#RRGGBB", or null for a value that has none (none, transparent, inherit). */
function solid(value: string, tokens: Tokens): string | null | 'unreadable' {
  const v = value.trim()
  const ref = /^var\((--[\w-]+)\)$/.exec(v)
  if (ref) {
    const t = tokens.get(ref[1])
    return t === undefined ? 'unreadable' : solid(t, tokens)
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    return `#${h.toUpperCase()}`
  }
  if (/^(none|transparent|inherit|currentcolor)$/i.test(v)) return null
  return 'unreadable'
}

/**
 * A look's tone is its page background's (--bg). In a light look the light backgrounds are the
 * surfaces any text may sit on and a dark fill must name its own text colour; in a dark look it
 * is the other way round. Returns true for a fill of the opposite tone.
 */
function oppositeToneOf(tokens: Tokens): (hex: string) => boolean {
  const bg = solid('var(--bg)', tokens)
  const darkLook = typeof bg === 'string' && bg !== 'unreadable' && isDark(bg)
  return (hex) => isDark(hex) !== darkLook
}

function bgOf(r: Rule, tokens: Tokens): string | null | 'unreadable' {
  const v = r.decls.get('background-color') ?? r.decls.get('background')
  return v === undefined ? null : solid(v, tokens)
}

function colourOf(r: Rule, tokens: Tokens): string | null | 'unreadable' {
  const v = r.decls.get('color')
  return v === undefined ? null : solid(v, tokens)
}

// ---------- looks: each look's rules and palette ----------

/** A look scope: [data-look="night"], on its own or after :root or html. */
const LOOK_SCOPE = /\[data-look="([a-z][a-z0-9-]*)"\]/
const LEADING_SCOPE = /^(?::root|html)?\[data-look="[a-z][a-z0-9-]*"\]/

/** Journal first (it has no scope), then every look named in a selector, in the order found. */
function looksIn(ruleList: Rule[]): string[] {
  const out = ['journal']
  for (const r of ruleList) {
    const m = LOOK_SCOPE.exec(r.selector)
    if (m && !out.includes(m[1])) out.push(m[1])
  }
  return out
}

interface LookRules {
  look: string
  rules: Rule[]
  tokens: Tokens
  /** Selectors whose look scope is not at the start, so it can't be read. Must stay empty. */
  misplaced: string[]
}

/**
 * The rules a page in `look` uses: every unscoped rule, plus the rules scoped to this look with
 * the scope taken off (and its specificity kept as `bonus`). "[data-look=x] { }" becomes a :root
 * block, so its custom properties override the :root palette.
 */
function forLook(ruleList: Rule[], look: string): LookRules {
  const rules: Rule[] = []
  const misplaced: string[] = []
  for (const r of ruleList) {
    const m = LOOK_SCOPE.exec(r.selector)
    if (!m) {
      rules.push(r)
      continue
    }
    if (!LEADING_SCOPE.test(r.selector)) {
      misplaced.push(r.selector)
      continue
    }
    if (m[1] !== look) continue
    const rest = r.selector.replace(LEADING_SCOPE, '')
    const selector = rest.trim() === '' ? ':root' : rest.startsWith(' ') ? rest.trim() : `:root${rest}`
    rules.push({ selector, decls: r.decls, bonus: 100 })
  }
  return { look, rules, tokens: rootTokens(rules), misplaced }
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
  '.range-summary .range-track':
    'the track of the aria-hidden range bar (Journal look) holds no text; every number is in the legend beside it',
  '.range-summary .likely-band': 'the likely band of that bar and its legend key, no text (the legend names it)',
  '.range-summary .range-best': 'the best-estimate marker of that bar and its legend key, no text (the legend names it)',
  '.score-bar .score-fill':
    'the teal fill of the aria-hidden score bar on a meal row (Panel look) holds no text; the score is written beside it',
  '.score-bar .score-fill.biggest':
    'the amber fill of that bar for the meal with the biggest uncertainty, no text; "biggest uncertainty" is written beside it',
  '.tl .tl-dot':
    "a dot on the Night look's timeline (aria-hidden) holds no text; each point says what it is in words beside it",
  '.tl .tl-dot.amber': 'the amber dot of the meal with the biggest uncertainty, no text; "biggest uncertainty" is written beside it',
}
/** Selector starts whose rules hold no text, with why. Each must still match a rule. */
const NO_TEXT_PREFIXES: Record<string, string> = {
  '.look-preview-':
    "each look's small aria-hidden preview in the Look sheet and its parts, drawn in that look's own colours; the look's name and description sit beside it",
}
const holdsNoText = (sel: string) => sel in NO_TEXT || Object.keys(NO_TEXT_PREFIXES).some((p) => sel.startsWith(p))
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

interface RulePairs {
  ownPairs: Pair[]
  /** Backgrounds of the look's own tone, which any text may sit on: hex -> first selector that uses it. */
  surfaces: Map<string, string>
  /** Fills of the opposite tone that don't name the text colour on them. */
  oppositeUnpaired: string[]
  unreadable: string[]
  /** Every text colour set in a rule that doesn't put it on a fill of the opposite tone. */
  surfaceTextColours: Map<string, string>
  surfacePairs: Pair[]
}

function rulePairs(rules: Rule[], tokens: Tokens): RulePairs {
  const ownPairs: Pair[] = []
  const surfaces = new Map<string, string>()
  const oppositeUnpaired: string[] = []
  const unreadable: string[] = []
  const opposite = oppositeToneOf(tokens)

  for (const r of rules) {
    const bg = bgOf(r, tokens)
    const fg = colourOf(r, tokens)
    if (bg === 'unreadable' && !(r.selector in OVERLAYS)) unreadable.push(`${r.selector} background`)
    if (fg === 'unreadable') unreadable.push(`${r.selector} color`)
    if (typeof bg !== 'string' || bg === 'unreadable' || holdsNoText(r.selector)) continue

    let text = typeof fg === 'string' && fg !== 'unreadable' ? fg : null
    if (!text && HAS_PSEUDO.test(r.selector)) {
      // A state rule keeps its base rule's text colour (e.g. .btn-primary:hover keeps white).
      const base = stripStates(r.selector)
      const baseRule = rules.filter((b) => b.selector === base && typeof colourOf(b, tokens) === 'string').pop()
      const c = baseRule ? colourOf(baseRule, tokens) : null
      if (c && c !== 'unreadable') text = c
    }

    if (text) ownPairs.push({ text, bg, where: r.selector })
    if (opposite(bg)) {
      if (!text) oppositeUnpaired.push(r.selector)
    } else if (!(r.selector in ONLY_OWN_TEXT) && !surfaces.has(bg)) {
      surfaces.set(bg, r.selector)
    }
  }

  const surfaceTextColours = new Map<string, string>()
  for (const r of rules) {
    const fg = colourOf(r, tokens)
    const bg = bgOf(r, tokens)
    if (typeof fg !== 'string' || fg === 'unreadable') continue
    if (typeof bg === 'string' && bg !== 'unreadable' && opposite(bg)) continue
    if (!surfaceTextColours.has(fg)) surfaceTextColours.set(fg, r.selector)
  }

  const surfacePairs: Pair[] = []
  for (const [text, textWhere] of surfaceTextColours) {
    for (const [bg, bgWhere] of surfaces) surfacePairs.push({ text, bg, where: `${textWhere} on ${bgWhere}` })
  }
  return { ownPairs, surfaces, oppositeUnpaired, unreadable, surfaceTextColours, surfacePairs }
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
  /** Fills of the opposite tone (dark in a light look, light in a dark one) that win with no text colour of their own. */
  oppositeWithoutText: string[]
  /** Text colours that win with no background of their own: checked on every surface of the look's tone. */
  bareText: Pair[]
}

function cascade(ruleList: Rule[], elements: Element[], surfaceMap: Map<string, string>, tokens: Tokens): CascadeResult {
  const compounds = ruleList
    .map((r, index) => {
      const c = parseCompound(r.selector)
      return { r, index, c: c && { ...c, specificity: c.specificity + (r.bonus ?? 0) } }
    })
    .filter((x): x is { r: Rule; index: number; c: Compound } => x.c !== null)
  const stateNames = [...new Set(compounds.flatMap((x) => [...x.c.states, ...x.c.notStates]))].filter((n) =>
    new RegExp(`^(${PSEUDO_NAMES})$`).test(n),
  )
  const stateSets: string[][] = [[]]
  for (const n of stateNames) for (const set of [...stateSets]) stateSets.push([...set, n])

  const out: CascadeResult = { pairs: [], oppositeWithoutText: [], bareText: [] }
  const opposite = oppositeToneOf(tokens)
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
      const fg = fgRule ? colourOf(fgRule, tokens) : null
      const bg = bgRule ? bgOf(bgRule, tokens) : null
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
      } else if (bgHex && opposite(bgHex)) {
        add(out.oppositeWithoutText, `opposite ${bgHex} ${label}`, `${label}: ${bgRule!.selector} has no text colour`)
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

// ---------- text set inside a fill: ".a .b { color }" sits on ".a"'s background ----------

function descendantPairs(ruleList: Rule[], tokens: Tokens): Pair[] {
  const out: Pair[] = []
  for (const r of ruleList) {
    const fg = colourOf(r, tokens)
    if (typeof fg !== 'string' || fg === 'unreadable') continue
    if (typeof bgOf(r, tokens) === 'string') continue // its own fill is what it sits on (checked above)
    const parts = r.selector.split(' ')
    for (let k = 0; k < parts.length - 1; k += 1) {
      if (['>', '+', '~'].includes(parts[k])) continue
      // Only ancestors: the next combinator must be a space or ">", not "+" or "~".
      if (parts[k + 1] === '+' || parts[k + 1] === '~') continue
      const ancestor = stripStates(parts[k])
      for (const b of ruleList) {
        const bg = bgOf(b, tokens)
        if (typeof bg !== 'string' || bg === 'unreadable' || stripStates(b.selector) !== ancestor) continue
        out.push({ text: fg, bg, where: `${r.selector} inside ${b.selector}` })
      }
    }
  }
  return out
}

// ---------- signal colours (non-text) ----------

const SIGNALS = ['--teal', '--amber', '--line-strong']
const SIGNAL_PROPS = /^(background|background-color|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|box-shadow|accent-color|text-decoration-color|fill|stroke)$/

interface SignalUse {
  token: string
  hex: string
  against: string
  where: string
}

function signalUsesIn(rules: Rule[], tokens: Tokens, surfaces: Map<string, string>): SignalUse[] {
  const signalUses: SignalUse[] = []
  for (const r of rules) {
    if (r.selector === ':root') continue
    for (const [prop, value] of r.decls) {
      if (!SIGNAL_PROPS.test(prop)) continue
      for (const token of SIGNALS) {
        if (!value.includes(`var(${token})`)) continue
        const hex = solid(`var(${token})`, tokens) as string
        const where = `${r.selector} { ${prop} }`
        const own = bgOf(r, tokens)
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
            ? rules.filter((p) => p.selector === parts.slice(0, -1).join(' ') && typeof bgOf(p, tokens) === 'string').pop()
            : undefined
        const parentBg = parentRule ? bgOf(parentRule, tokens) : null
        if (typeof parentBg === 'string' && parentBg !== 'unreadable') {
          signalUses.push({ token, hex, against: parentBg, where: `${where} on ${parentRule!.selector}` })
        } else {
          for (const [bg, bgWhere] of surfaces) signalUses.push({ token, hex, against: bg, where: `${where} on ${bgWhere}` })
        }
      }
    }
  }
  return signalUses
}

const fmt = (n: number) => n.toFixed(2)

// ---------- every look, analysed the same way ----------

interface LookAnalysis extends RulePairs {
  look: string
  rules: Rule[]
  tokens: Tokens
  misplaced: string[]
  resolved: CascadeResult
  insidePairs: Pair[]
  signalUses: SignalUse[]
}

function analyse(lr: LookRules, elements: Element[]): LookAnalysis {
  const pairs = rulePairs(lr.rules, lr.tokens)
  return {
    ...lr,
    ...pairs,
    resolved: cascade(lr.rules, elements, pairs.surfaces, lr.tokens),
    insidePairs: descendantPairs(lr.rules, lr.tokens),
    signalUses: signalUsesIn(lr.rules, lr.tokens, pairs.surfaces),
  }
}

/** Every look named in theme.css, and every look src/ui/looks.ts offers. Journal comes first. */
const LOOK_IDS = [...new Set([...looksIn(allRules), ...BUILT_LOOKS])]
const analyses = LOOK_IDS.map((look) => analyse(forLook(allRules, look), uiElements))
const journal = analyses[0]
// Journal's rules and palette, for the checks below that are about the reader itself.
const rules = journal.rules
const tokens = journal.tokens
const surfaces = journal.surfaces

// ---------- tests ----------

const textFailures = (pairs: Pair[]) =>
  pairs.filter((p) => ratio(p.text, p.bg) < 4.5).map((p) => `${p.where}: ${p.text} on ${p.bg} is ${fmt(ratio(p.text, p.bg))}:1`)

describe('reading theme.css', () => {
  it('finds the colour tokens and the rules that use them', () => {
    for (const t of ['--bg', '--surface', '--ink', '--ink-soft', '--teal', '--teal-ink', '--amber', '--amber-ink', '--amber-bg']) {
      expect(tokens.has(t), t).toBe(true)
    }
    expect(journal.surfaceTextColours.size).toBeGreaterThanOrEqual(4)
    expect(surfaces.size).toBeGreaterThanOrEqual(4)
    expect(journal.ownPairs.length).toBeGreaterThanOrEqual(5)
    expect(journal.signalUses.length).toBeGreaterThanOrEqual(20)
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
    // In Journal's rules or in a look's own (scope taken off), as the checks above read them.
    const inSomeLook = (sel: string) => analyses.some((a) => a.rules.some((r) => r.selector === sel))
    for (const sel of [...Object.keys(NO_TEXT), ...Object.keys(ONLY_OWN_TEXT), ...Object.keys(OVERLAYS)]) {
      expect(inSomeLook(sel), sel).toBe(true)
    }
    for (const prefix of Object.keys(NO_TEXT_PREFIXES)) {
      expect(rules.some((r) => r.selector.startsWith(prefix)), prefix).toBe(true)
    }
  })
})

describe('the looks (build-out item 1.5.2)', () => {
  it('checks Journal and every look src/ui/looks.ts offers', () => {
    expect(LOOK_IDS[0]).toBe('journal')
    for (const look of BUILT_LOOKS) expect(LOOK_IDS).toContain(look)
  })

  it('every look scope starts its selector, so it can be read', () => {
    for (const a of analyses) expect(a.misplaced, a.look).toEqual([])
  })

  // Each look's preview in the Look sheet is drawn in that look's own colours, written out as
  // hex because the preview must keep them whatever look is on. Every one must be a token of
  // that look's palette, so a palette change that forgets the preview fails here.
  it("each look's preview in the Look sheet uses only that look's palette colours", () => {
    for (const a of analyses) {
      if (!BUILT_LOOKS.includes(a.look as Look)) continue
      const palette = new Set([...a.tokens.values()].map((v) => v.trim().toUpperCase()))
      const used = allRules
        .filter((r) => r.selector.split(',').some((part) => part.trim().startsWith(`.look-preview-${a.look}`)))
        .flatMap((r) => [...r.decls.values()].flatMap((value) => value.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []))
      expect(used.length, `${a.look} preview colours`).toBeGreaterThan(0)
      for (const hex of used) expect(palette.has(hex.toUpperCase()), `${a.look} preview ${hex}`).toBe(true)
    }
  })

  // Night (item 1.5.2c) is dark: it must draw native controls dark too, and index.html's early
  // script must know it is dark (src/store/earlyLook.ts), so a reload never flashes light.
  it('a look named in DARK_LOOKS sets color-scheme: dark and has a dark --bg; every other look stays light', () => {
    for (const a of analyses) {
      const scheme = a.rules.filter((r) => r.selector === ':root' && r.decls.has('color-scheme')).pop()?.decls.get('color-scheme')
      const dark = DARK_LOOKS.includes(a.look)
      expect(scheme, a.look).toBe(dark ? 'dark' : 'light')
      expect(isDark(solid('var(--bg)', a.tokens) as string), a.look).toBe(dark)
    }
    expect(analyses.some((a) => DARK_LOOKS.includes(a.look))).toBe(true)
  })

  it("Journal's palette is the :root palette, with no look-scoped rule in it", () => {
    expect(journal.tokens).toEqual(rootTokens(allRules.filter((r) => r.selector === ':root')))
    expect(journal.rules.filter((r) => r.bonus !== undefined)).toEqual([])
  })

  // A small sheet with a made-up look, to show a new look is found and held to the same rules.
  const SAMPLE = `
    :root { --bg: #FAF7F2; --ink: #2B2B2B; --teal: #2F7F7A; }
    body { background: var(--bg); color: var(--ink); }
    .chip { border: 1px solid var(--teal); }
    [data-look="dusk"] { --bg: #1E2226; --ink: #3A3F44; }
    [data-look="dusk"] .note { color: var(--ink); }
    [data-look="other"] .note { color: #FFFFFF; }
  `
  const sampleRules = parseRules(SAMPLE)
  const body: Element[] = [{ tag: 'body', classes: [], where: 'sample' }]

  it('finds a look added to theme.css without any change to this test', () => {
    expect(looksIn(sampleRules)).toEqual(['journal', 'dusk', 'other'])
  })

  it("applies a look's token overrides and its own rules, and leaves out other looks' rules", () => {
    const dusk = forLook(sampleRules, 'dusk')
    expect(dusk.tokens.get('--bg')).toBe('#1E2226')
    expect(dusk.tokens.get('--teal')).toBe('#2F7F7A')
    expect(dusk.rules.map((r) => r.selector)).toEqual([':root', 'body', '.chip', ':root', '.note'])
    expect(dusk.rules.find((r) => r.selector === '.note')?.bonus).toBe(100)
    expect(forLook(sampleRules, 'journal').rules.map((r) => r.selector)).toEqual([':root', 'body', '.chip'])
  })

  it('fails a look whose palette breaks the rules, while Journal passes', () => {
    const j = analyse(forLook(sampleRules, 'journal'), body)
    const d = analyse(forLook(sampleRules, 'dusk'), body)
    expect(textFailures(j.resolved.pairs)).toEqual([])
    // --ink #3A3F44 on --bg #1E2226 (Python, WCAG 2.x, 2026-11-05: 1.50:1).
    expect(textFailures(d.resolved.pairs)).toEqual([expect.stringContaining('#3A3F44 on #1E2226 is 1.50:1')])
  })

  // A dark look reads the other way round: its dark backgrounds are the surfaces text sits on,
  // and a light fill must name the colour of the text on it.
  const TONES = `
    :root { --bg: #FAF7F2; --surface: #FFFFFF; --ink: #2B2B2B; --ink-soft: #5E5A55; --accent: #F2F8F7; }
    body { background: var(--bg); color: var(--ink); }
    .card { background: var(--surface); }
    .chip { background: var(--accent); }
    .note { color: var(--ink-soft); }
    [data-look="dusk"] { --bg: #15191B; --surface: #1E2427; --ink: #ECE8E1; --accent: #6CC2BA; }
  `
  const toneRules = parseRules(TONES)

  it("takes a look's tone from its --bg: the dark look's surfaces are its dark backgrounds", () => {
    const j = analyse(forLook(toneRules, 'journal'), body)
    const d = analyse(forLook(toneRules, 'dusk'), body)
    expect([...j.surfaces.keys()]).toEqual(['#FAF7F2', '#FFFFFF', '#F2F8F7'])
    expect([...d.surfaces.keys()]).toEqual(['#15191B', '#1E2427'])
    // --ink-soft #5E5A55 is 6.40:1 on Journal's --bg #FAF7F2, but 2.59:1 on the dark look's
    // --bg #15191B and 2.30:1 on its --surface #1E2427 (WCAG 2.x, worked out 2026-11-05).
    expect(textFailures(j.surfacePairs)).toEqual([])
    expect(textFailures(d.surfacePairs)).toEqual([
      '.note on body: #5E5A55 on #15191B is 2.59:1',
      '.note on .card: #5E5A55 on #1E2427 is 2.30:1',
    ])
  })

  it('flags a light fill with no text colour of its own in a dark look, as it flags a dark fill in a light look', () => {
    expect(analyse(forLook(toneRules, 'journal'), body).oppositeUnpaired).toEqual([])
    expect(analyse(forLook(toneRules, 'dusk'), body).oppositeUnpaired).toEqual(['.chip'])
    const chip: Element[] = [{ tag: 'span', classes: ['chip'], where: 'sample' }]
    const d = forLook(toneRules, 'dusk')
    expect(cascade(d.rules, chip, new Map(), d.tokens).oppositeWithoutText).toEqual([
      '<span class="chip"> (sample): .chip has no text colour',
    ])
  })

  it('reports a look scope that is not at the start of its selector', () => {
    expect(forLook(parseRules('.a [data-look="dusk"] .b { color: #000000 }'), 'dusk').misplaced).toEqual(['.a [data-look="dusk"] .b'])
  })
})

describe('agrees with the ratios spec.md lists (computed in Python, 2026-10-26)', () => {
  const t = (name: string) => solid(`var(${name})`, tokens) as string
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

describe.each(analyses.map((a) => [a.look, a] as const))('the %s look', (_look, a) => {
  describe('reading its palette', () => {
    it('can read every color and background value (add new forms to the parser, never skip them)', () => {
      expect(a.unreadable).toEqual([])
    })

    it('every fill of the opposite tone (dark in a light look, light in a dark look) names the colour of the text on it', () => {
      expect(a.oppositeUnpaired).toEqual([])
    })
  })

  describe('text contrast: at least 4.5:1', () => {
    it('each rule that sets both a text colour and a background', () => {
      expect(textFailures(a.ownPairs)).toEqual([])
    })

    it('every element, in every mix of states, with the color and background the cascade gives it', () => {
      expect(a.resolved.pairs.length).toBeGreaterThanOrEqual(5)
      expect(textFailures(a.resolved.pairs)).toEqual([])
      expect(a.resolved.oppositeWithoutText).toEqual([])
    })

    it('a disabled button stays readable while the mouse is over it, in every variant', () => {
      for (const variant of ['btn-primary', 'btn-ink', 'btn-plain', 'btn-quiet']) {
        // cascade() tries every mix of states, :hover with :disabled included.
        const one = cascade(a.rules, [{ tag: 'button', classes: ['btn', variant], where: 'test' }], a.surfaces, a.tokens)
        expect(one.pairs.length, variant).toBeGreaterThanOrEqual(2)
        expect(Math.min(...one.pairs.map((p) => ratio(p.text, p.bg))), variant).toBeGreaterThanOrEqual(4.5)
      }
    })

    it('text a rule sets inside a fill, checked against that fill', () => {
      expect(textFailures(a.insidePairs)).toEqual([])
    })

    it("a text colour with no background of its own, on every surface of the look's tone", () => {
      expect(textFailures(a.resolved.bareText)).toEqual([])
    })

    it("every text colour on every surface of the look's tone", () => {
      expect(a.surfacePairs.length).toBeGreaterThanOrEqual(16)
      expect(textFailures(a.surfacePairs)).toEqual([])
    })

    it('--teal and --amber are never used as text colours (the -ink tokens are)', () => {
      const misuse = a.rules.filter((r) => /^var\(--(teal|amber)\)$/.test(r.decls.get('color') ?? '')).map((r) => r.selector)
      expect(misuse).toEqual([])
    })
  })

  describe('signal colours: at least 3:1 against what surrounds them', () => {
    it.each(SIGNALS)('%s', (token) => {
      const uses = a.signalUses.filter((u) => u.token === token)
      expect(uses.length, `${token} is used somewhere`).toBeGreaterThan(0)
      const bad = uses
        .filter((u) => ratio(u.hex, u.against) < 3)
        .map((u) => `${u.where}: ${u.hex} on ${u.against} is ${fmt(ratio(u.hex, u.against))}:1`)
      expect(bad).toEqual([])
    })
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
    cascade(parseRules(css), button, surfaces, tokens)
      .pairs.filter((p) => ratio(p.text, p.bg) < 4.5)
      .map((p) => `${p.text} on ${p.bg} ${fmt(ratio(p.text, p.bg))}`)

  it('finds the disabled-and-hovered primary button the old rules drew', () => {
    expect(failing(BEFORE)).toEqual(['#5E5A55 on #2A736E 1.23'])
  })

  it('passes the same button once hover skips disabled', () => {
    expect(failing(AFTER)).toEqual([])
  })

  it('pairs text set inside a dark fill with that fill', () => {
    const pairs = descendantPairs(
      parseRules('.btn-primary { background: var(--teal); color: #FFFFFF; } .btn-primary .sub { color: var(--ink-soft); }'),
      tokens,
    )
    // --ink-soft #5E5A55 on --teal #2F7F7A: 1.45:1 (Python, WCAG 2.x, 2026-11-05).
    expect(pairs.map((p) => `${p.where}: ${fmt(ratio(p.text, p.bg))}`)).toEqual(['.btn-primary .sub inside .btn-primary: 1.45'])
  })

  it('a look-scoped rule wins over an unscoped one of the same selector, as [data-look] adds specificity', () => {
    const scoped = forLook(parseRules('[data-look="dusk"] .x { color: #FFFFFF; background: #000000 } .x { color: #000000; background: #FFFFFF }'), 'dusk')
    const res = cascade(scoped.rules, [{ tag: 'p', classes: ['x'], where: 'sample' }], surfaces, scoped.tokens)
    expect(res.pairs.map((p) => `${p.text} on ${p.bg}`)).toEqual(['#FFFFFF on #000000'])
  })
})
