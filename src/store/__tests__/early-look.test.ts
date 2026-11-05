// Build-out item 1.5.2c: the script vite.config.ts puts in index.html's <head>, so a reload in the
// dark Night look never flashes a light page. It is run here against a stand-in page.
import { describe, expect, it } from 'vitest'
import { DARK_LOOKS, earlyLookScript } from '../earlyLook'
import { storageKeys } from '../keys'
import { colorSchemeOf } from '../../ui/looks'

interface Page {
  look: string | null
  scheme: string
}

/** Runs the script with `stored` saved under the key (a function stands for blocked storage). */
function run(stored: string | null | (() => never), key = storageKeys('early-test').look, hasMeta = true): Page {
  const page: Page = { look: null, scheme: 'light' }
  const localStorage = {
    getItem: (k: string) => (typeof stored === 'function' ? stored() : k === key ? stored : null),
  }
  const document = {
    documentElement: { setAttribute: (name: string, value: string) => name === 'data-look' && (page.look = value) },
    querySelector: (sel: string) =>
      hasMeta && sel === 'meta[name="color-scheme"]' ? { setAttribute: (_: string, v: string) => (page.scheme = v) } : null,
  }
  new Function('localStorage', 'document', earlyLookScript(key))(localStorage, document)
  return page
}

describe('the early look script', () => {
  it('applies a saved dark look and asks for a dark canvas, before the page is drawn', () => {
    expect(DARK_LOOKS).toEqual(['night'])
    expect(run('night')).toEqual({ look: 'night', scheme: 'dark' })
  })

  it('leaves a light look, an unknown value and no saved look to main.tsx, so the page starts light', () => {
    for (const stored of ['journal', 'panel', 'sepia', ' night', '', null]) expect(run(stored), String(stored)).toEqual({ look: null, scheme: 'light' })
  })

  it("reads this build's own key, namespace included", () => {
    expect(earlyLookScript(storageKeys('early-test').look)).toContain('"howsure.early-test.look.v1"')
    expect(earlyLookScript(storageKeys().look)).toContain('"howsure.look.v1"')
    expect(run('night', storageKeys('other').look)).toEqual({ look: 'night', scheme: 'dark' })
  })

  it('never throws: blocked storage or a missing meta tag leave the page as it is', () => {
    expect(
      run(() => {
        throw new Error('SecurityError')
      }),
    ).toEqual({ look: null, scheme: 'light' })
    expect(run('night', undefined, false)).toEqual({ look: 'night', scheme: 'light' })
  })

  it('agrees with the color-scheme the app sets when a look is chosen', () => {
    expect(colorSchemeOf('night')).toBe('dark')
    expect(colorSchemeOf('journal')).toBe('light')
    expect(colorSchemeOf('panel')).toBe('light')
  })
})
