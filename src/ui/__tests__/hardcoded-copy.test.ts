// spec.md > Look and Feel > Copy tone: all user-visible copy lives in src/ui/copy.ts (study titles
// in src/kernel/sources.ts), so the word rules in copy.test.ts see every word a person reads.
// This test parses each UI file and fails on text written straight into it:
//   - JSX text;
//   - string values of JSX attributes, on elements and on our own components alike (a component
//     prop such as <Sheet title="..."> usually ends up on screen). Only attributes known to hold
//     no copy (className, data-testid, type, aria-live, ...) are passed over. On other attributes
//     every value with a capital letter, a space or punctuation is flagged; a bare lower-case key
//     like tone="error" is taken to be a value code switches on;
//   - string literals rendered as children ({on && 'Nothing here'});
//   - sentence-like string literals (two words or more) anywhere in src/ui.
//
// Known limits, accepted to keep the scan free of false alarms: a single word held in a variable,
// an object or a call before it is rendered is not followed, e.g.
// `const word = on ? 'Hide' : 'Show'; <b>{word}</b>`, `msgs = { a: 'Saved' }; {msgs.a}` and
// `{String('Done')}`. Neither is an all-lower-case single word passed to a component prop
// (`heading="calories"`). The browser copy sweep (tests/e2e/copy-sweep.spec.ts) still applies the
// word rules to whatever such text renders.
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseSync } from 'vite'

const UI_DIR = new URL('../', import.meta.url)

/** Files that may hold copy: copy.ts itself. Everything else in src/ui must not. */
const COPY_HOMES = new Set(['copy.ts'])

/** Attributes whose text a person reads or hears: any value with letters is copy. */
const VISIBLE_ATTRS = new Set([
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'aria-placeholder',
  'title',
  'placeholder',
  'alt',
  'label',
])

/** Attributes that hold names, keys and settings, never copy. */
const NON_COPY_ATTRS = new Set([
  'className',
  'id',
  'key',
  'ref',
  'type',
  'name',
  'htmlFor',
  'role',
  'form',
  'href',
  'src',
  'rel',
  'target',
  'lang',
  'dir',
  'method',
  'action',
  'accept',
  'pattern',
  'inputMode',
  'autoComplete',
  'autoCapitalize',
  'enterKeyHint',
  'spellCheck',
  'tabIndex',
  'min',
  'max',
  'step',
  'value',
  'defaultValue',
  'width',
  'height',
  'viewBox',
  'd',
  'fill',
  'stroke',
  'xmlns',
  'focusable',
  'aria-live',
  'aria-hidden',
  'aria-controls',
  'aria-labelledby',
  'aria-describedby',
  'aria-errormessage',
  'aria-expanded',
  'aria-haspopup',
  'aria-modal',
  'aria-current',
  'aria-pressed',
  'aria-checked',
  'aria-selected',
  'aria-invalid',
  'aria-atomic',
  'aria-busy',
  'aria-relevant',
  'aria-orientation',
  'aria-owns',
  'aria-activedescendant',
  'aria-autocomplete',
  'aria-sort',
  'scope',
  'colSpan',
  'rowSpan',
  'headers',
])
/** Our own props that carry test ids, element ids or class names, by naming pattern. */
const isNonCopyAttr = (name: string) =>
  NON_COPY_ATTRS.has(name) || name.startsWith('data-') || /(TestId|testId|Id|Key|ClassName)$/.test(name)

const hasLetters = (s: string) => /[A-Za-z]/.test(s)
/** Two words with a space between them, e.g. "Save meal" (not "btn btn-quiet": see isTokenList). */
const sentenceLike = (s: string) => /[A-Za-z]{2,}[^\S\n]+[A-Za-z]{2,}/.test(s)
/** Lower-case class lists and keys like "btn btn-primary log-btn". */
const isTokenList = (s: string) => /^[a-z0-9_-]+( [a-z0-9_-]+)*$/.test(s.trim())

type Node = { type: string; start: number; [k: string]: unknown }

interface Finding {
  file: string
  line: number
  text: string
  why: string
}

function lineOf(src: string, offset: number): number {
  return src.slice(0, offset).split('\n').length
}

function textOfTemplate(n: Node): string {
  const quasis = n.quasis as { value: { cooked: string | null; raw: string } }[]
  return quasis.map((q) => q.value.cooked ?? q.value.raw).join('…')
}

/** The string pieces an expression can evaluate to, following ?:, &&, || and ??, not calls. */
function resultStrings(n: Node | null | undefined): Node[] {
  if (!n) return []
  switch (n.type) {
    case 'Literal':
      return typeof n.value === 'string' ? [n] : []
    case 'TemplateLiteral':
      return [n]
    case 'ConditionalExpression':
      return [...resultStrings(n.consequent as Node), ...resultStrings(n.alternate as Node)]
    case 'LogicalExpression':
      return [...resultStrings(n.left as Node), ...resultStrings(n.right as Node)]
    case 'ParenthesizedExpression':
    case 'TSAsExpression':
    case 'TSNonNullExpression':
      return resultStrings(n.expression as Node)
    default:
      return []
  }
}

type JsxName = { type: string; name: string | { name: string }; namespace?: { name: string } }

function attrName(n: Node): string {
  const name = n.name as JsxName
  if (name.type === 'JSXNamespacedName' && typeof name.name === 'object') return `${name.namespace?.name}:${name.name.name}`
  return String(name.name)
}

function scan(file: string, src: string): Finding[] {
  const parsed = parseSync(file, src)
  if (parsed.errors.length > 0) throw new Error(`${file} did not parse: ${parsed.errors[0].message}`)
  const out: Finding[] = []
  const flag = (n: Node, text: string, why: string) =>
    out.push({ file, line: lineOf(src, n.start), text: text.trim().replace(/\s+/g, ' '), why })
  const flagged = new Set<Node>()

  function walk(n: unknown, skip: boolean): void {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) {
      for (const c of n) walk(c, skip)
      return
    }
    const node = n as Node
    if (typeof node.type !== 'string') return
    // Not copy: import paths, type-level strings, and developer-facing errors and logs.
    if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') return
    if (node.type.startsWith('TS') && node.type.endsWith('Type')) return
    if (node.type === 'TSTypeAnnotation' || node.type === 'TSInterfaceDeclaration' || node.type === 'TSTypeAliasDeclaration') return
    let skipHere = skip
    if (node.type === 'NewExpression' && /Error$/.test(String((node.callee as Node & { name?: string }).name))) skipHere = true
    if (node.type === 'CallExpression') {
      const callee = node.callee as Node & { object?: Node & { name?: string } }
      if (callee.type === 'MemberExpression' && callee.object?.name === 'console') skipHere = true
    }

    if (node.type === 'JSXText' && hasLetters(String(node.value))) {
      flag(node, String(node.value), 'JSX text')
    }
    if (node.type === 'JSXAttribute') {
      const name = attrName(node)
      // className, data-testid, type, ... hold no copy.
      if (isNonCopyAttr(name)) return
      const value = node.value as Node | null
      if (value) {
        const pieces = value.type === 'JSXExpressionContainer' ? resultStrings(value.expression as Node) : [value]
        for (const p of pieces) {
          const text = p.type === 'TemplateLiteral' ? textOfTemplate(p) : String(p.value)
          // A visible attribute's text is copy whatever it looks like; on any other attribute a
          // bare lower-case key (tone="error") is a value code switches on.
          if (hasLetters(text) && (VISIBLE_ATTRS.has(name) || !isTokenList(text))) flag(p, text, `${name}="…"`)
          // Decided here either way, so the walk below doesn't report it again.
          flagged.add(p)
        }
      }
      // Keep walking: the value may hold JSX (icon={<b>Text</b>}) or other expressions.
    }
    if (node.type === 'JSXExpressionContainer' && !skipHere) {
      for (const p of resultStrings(node.expression as Node)) {
        const text = p.type === 'TemplateLiteral' ? textOfTemplate(p) : String(p.value)
        if (hasLetters(text) && !flagged.has(p)) {
          flag(p, text, 'string rendered as JSX')
          flagged.add(p)
        }
      }
    }
    if (!skipHere && !flagged.has(node)) {
      const text =
        node.type === 'Literal' && typeof node.value === 'string'
          ? node.value
          : node.type === 'TemplateLiteral'
            ? textOfTemplate(node)
            : null
      if (text !== null && sentenceLike(text) && !isTokenList(text)) {
        flag(node, text, 'sentence-like string literal')
        flagged.add(node)
      }
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'type' || k === 'start' || k === 'end') continue
      walk(v, skipHere)
    }
  }

  walk(parsed.program, false)
  return out
}

const uiFiles = readdirSync(UI_DIR)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !COPY_HOMES.has(f))
  .sort()

describe('no hard-coded user-visible text outside copy.ts', () => {
  it('finds the UI files', () => {
    expect(uiFiles).toContain('App.tsx')
    expect(uiFiles).toContain('Dashboard.tsx')
    expect(uiFiles.filter((f) => f.endsWith('.tsx')).length).toBeGreaterThanOrEqual(15)
  })

  it.each(uiFiles)('%s', (file) => {
    const src = readFileSync(new URL(file, UI_DIR), 'utf8')
    const found = scan(file, src).map((f) => `${f.file}:${f.line} ${f.why}: ${JSON.stringify(f.text)}`)
    expect(found).toEqual([])
  })
})

describe('the scanner itself', () => {
  // A made-up component with every kind of hard-coded text, so a broken scanner can't pass quietly.
  const SAMPLE = `
    import { copy } from './copy'
    type Mode = 'Edit meal' | 'new'
    export function Sample({ on, n }: { on: boolean; n: number }) {
      if (n < 0) throw new Error('Negative count is a bug')
      const label = on ? 'Turn it off' : copy.x
      return (
        <div className="btn btn-quiet" data-testid="sample-root">
          Save meal
          <button aria-label="Close sheet" title={on ? 'Open details' : copy.y}>{copy.z}</button>
          <input placeholder={\`e.g. \${n} kcal\`} type="text" />
          {on && 'Nothing here'}
          <span>{label} · {n}</span>
          <Notice message="Your log could not be read" heading="Calories" tone="error" sampleTestId="notice" />
          <Sheet confirmLabel={'Remove'} icon={<b>Gone</b>} open={on} />
        </div>
      )
    }
  `
  const found = scan('Sample.tsx', SAMPLE)
  const texts = found.map((f) => f.text)

  it('catches JSX text, visible attributes, rendered strings and sentence-like literals', () => {
    expect(texts).toEqual(
      expect.arrayContaining(['Save meal', 'Close sheet', 'Open details', 'e.g. … kcal', 'Nothing here', 'Turn it off']),
    )
  })

  it('catches text passed to our own components through any prop', () => {
    expect(texts).toEqual(expect.arrayContaining(['Your log could not be read', 'Calories', 'Remove', 'Gone']))
  })

  it('ignores class names, test ids, input types, lower-case keys, type-level strings and thrown errors', () => {
    expect(texts).not.toContain('btn btn-quiet')
    expect(texts).not.toContain('sample-root')
    expect(texts).not.toContain('text')
    expect(texts).not.toContain('Edit meal')
    expect(texts).not.toContain('Negative count is a bug')
    expect(texts).not.toContain('error')
    expect(texts).not.toContain('notice')
    expect(found).toHaveLength(10)
  })
})
