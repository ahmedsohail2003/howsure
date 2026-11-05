// Build-out item 1.3: the More menu's entries (src/ui/moreMenu.ts).
import { describe, expect, it } from 'vitest'
import { copy } from '../copy'
import { MORE_ENTRIES, moreEntries } from '../moreMenu'

describe('More menu entries', () => {
  it('lists Profile and privacy, Targets and the full-screen switch in your own log', () => {
    expect(moreEntries({ kind: 'mine', fullScreen: 'off' })).toEqual([
      { id: 'profile', label: 'Profile and privacy', hint: copy.moreMenu.profileHint },
      { id: 'targets', label: 'Targets', hint: copy.moreMenu.targetsHint },
      { id: 'fullScreen', label: 'Show full screen', hint: copy.moreMenu.fullScreenHint },
    ])
  })

  it('leaves Profile and privacy out of the demo, and says the demo targets are made up', () => {
    const entries = moreEntries({ kind: 'demo', fullScreen: 'off' })
    expect(entries.map((e) => e.id)).toEqual(['targets', 'fullScreen'])
    expect(entries[0].hint).toBe(copy.moreMenu.targetsHintDemo)
  })

  it('names the view the full-screen switch goes to', () => {
    const label = (fullScreen: 'off' | 'native' | 'fallback') =>
      moreEntries({ kind: 'mine', fullScreen }).find((e) => e.id === 'fullScreen')
    expect(label('off')?.label).toBe('Show full screen')
    expect(label('native')).toEqual({ id: 'fullScreen', label: 'Exit full screen', hint: copy.moreMenu.exitFullScreenHint })
    expect(label('fallback')).toEqual({ id: 'fullScreen', label: 'Exit full screen', hint: copy.moreMenu.exitFallbackHint })
  })

  it('has one entry per id, so a later screen adds exactly one line', () => {
    const ids = MORE_ENTRIES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
