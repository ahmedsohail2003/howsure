// Build-out item 1.3: the More menu's entries (src/ui/moreMenu.ts).
import { describe, expect, it } from 'vitest'
import { copy } from '../copy'
import { BUILT_LOOKS, LOOKS } from '../looks'
import { MORE_ENTRIES, moreEntries } from '../moreMenu'

describe('More menu entries', () => {
  it('lists Profile and privacy, Targets, Body details, Saved meals, Weight, Look and the full-screen switch in your own log', () => {
    expect(moreEntries({ kind: 'mine', fullScreen: 'off', look: 'journal' })).toEqual([
      { id: 'profile', label: 'Profile and privacy', hint: copy.moreMenu.profileHint },
      { id: 'targets', label: 'Targets', hint: copy.moreMenu.targetsHint },
      {
        id: 'body',
        label: 'Body details',
        hint: 'Age, sex, height, weight and everyday activity, for the estimated deficit or surplus.',
      },
      { id: 'savedMeals', label: 'Saved meals', hint: 'Rename or delete the meals you saved as usual.' },
      { id: 'weight', label: 'Weight', hint: 'Your weigh-ins, the 7-day average and the trend.' },
      { id: 'look', label: 'Look', hint: 'How the dashboard is drawn. Now: Journal.' },
      { id: 'fullScreen', label: 'Show full screen', hint: copy.moreMenu.fullScreenHint },
    ])
  })

  it('leaves Profile and privacy out of the demo, and says the demo targets are made up', () => {
    const entries = moreEntries({ kind: 'demo', fullScreen: 'off', look: 'journal' })
    expect(entries.map((e) => e.id)).toEqual(['targets', 'body', 'savedMeals', 'weight', 'look', 'fullScreen', 'resetDemo'])
    expect(entries[0].hint).toBe(copy.moreMenu.targetsHintDemo)
    // Build-out item 2.5b: Sam's body details stay in the demo, and the hint says they are made up.
    expect(entries[1].hint).toBe(copy.moreMenu.bodyHintDemo)
  })

  it('offers Reset demo in the demo only (build-out item 2.1)', () => {
    const demo = moreEntries({ kind: 'demo', fullScreen: 'off', look: 'night' })
    expect(demo.find((e) => e.id === 'resetDemo')).toEqual({
      id: 'resetDemo',
      label: 'Reset demo',
      hint: 'Puts back Sam’s week as it started. Your own log is not affected.',
    })
    expect(moreEntries({ kind: 'mine', fullScreen: 'off', look: 'night' }).map((e) => e.id)).not.toContain('resetDemo')
  })

  it('names the current look, and Journal for a look this build does not offer', () => {
    const hint = (look: 'journal' | 'panel' | 'night') =>
      moreEntries({ kind: 'demo', fullScreen: 'off', look }).find((e) => e.id === 'look')?.hint
    expect(hint('journal')).toBe('How the dashboard is drawn. Now: Journal.')
    for (const l of LOOKS) expect(hint(l.id)).toBe(`How the dashboard is drawn. Now: ${l.name}.`)
    for (const id of ['panel', 'night'] as const) {
      if (!BUILT_LOOKS.includes(id)) expect(hint(id)).toBe('How the dashboard is drawn. Now: Journal.')
    }
  })

  it('names the view the full-screen switch goes to', () => {
    const label = (fullScreen: 'off' | 'native' | 'fallback') =>
      moreEntries({ kind: 'mine', fullScreen, look: 'journal' }).find((e) => e.id === 'fullScreen')
    expect(label('off')?.label).toBe('Show full screen')
    expect(label('native')).toEqual({ id: 'fullScreen', label: 'Exit full screen', hint: copy.moreMenu.exitFullScreenHint })
    expect(label('fallback')).toEqual({ id: 'fullScreen', label: 'Exit full screen', hint: copy.moreMenu.exitFallbackHint })
  })

  it('has one entry per id, so a later screen adds exactly one line', () => {
    const ids = MORE_ENTRIES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
