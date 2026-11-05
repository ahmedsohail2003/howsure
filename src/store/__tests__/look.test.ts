// Build-out item 1.5.2: the chosen look is a device preference under its own key, outside both
// log documents. An unknown or unreadable value falls back to Journal without crashing and is
// left as it is; blocked storage keeps the look in memory; Export, Import and Delete of your
// own log leave it alone.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { storageKeys } from '../keys'
import { emptyLog } from '../log'
import { DEFAULT_LOOK, loadLook, readLook, saveLook, type Look } from '../look'
import { saveLog } from '../storage'
import { deleteOwnLog, exportOwnLog, readImport, replaceOwnLog } from '../transfer'
import { MemoryStore } from './memoryStore'

const ALL: readonly Look[] = ['journal', 'panel', 'night']
const JOURNAL_ONLY: readonly Look[] = ['journal']
const keys = storageKeys('look-test')
const V1_MINE_TEXT = readFileSync(fileURLToPath(new URL('../../../fixtures/saved/v1-mine.json', import.meta.url)), 'utf8')

class BlockedStore {
  getItem(): string | null {
    throw new Error('SecurityError')
  }
  setItem(): void {
    throw new Error('SecurityError')
  }
  removeItem(): void {
    throw new Error('SecurityError')
  }
}

describe('reading the stored look', () => {
  it('defaults to Journal', () => {
    expect(DEFAULT_LOOK).toBe('journal')
    expect(readLook(null, ALL)).toBe('journal')
  })

  it('takes a look this build offers', () => {
    expect(readLook('panel', ALL)).toBe('panel')
    expect(readLook('night', ALL)).toBe('night')
  })

  it.each(['', 'Panel', ' night', 'dark', '{"look":"night"}', 'undefined'])('falls back to Journal for %j', (raw) => {
    expect(readLook(raw, ALL)).toBe('journal')
  })

  it('falls back to Journal for a look this build does not offer yet', () => {
    expect(readLook('night', JOURNAL_ONLY)).toBe('journal')
  })
})

describe('saving and loading the look', () => {
  it('saves under the look key and reads it back', () => {
    const store = new MemoryStore()
    expect(loadLook(ALL, store, keys)).toBe('journal')
    expect(saveLook('night', store, keys)).toBe(true)
    expect(store.getItem('howsure.look-test.look.v1')).toBe('night')
    expect(loadLook(ALL, store, keys)).toBe('night')
    expect(store.writes).toEqual(['howsure.look-test.look.v1'])
  })

  it('leaves an unknown stored value as it is when it falls back', () => {
    const store = new MemoryStore()
    store.data.set(keys.look, 'sepia')
    expect(loadLook(ALL, store, keys)).toBe('journal')
    expect(store.getItem(keys.look)).toBe('sepia')
    expect(store.writes).toEqual([])
  })

  it('works without storage: loads the default and reports that it did not save', () => {
    expect(loadLook(ALL, null, keys)).toBe('journal')
    expect(saveLook('panel', null, keys)).toBe(false)
    const blocked = new BlockedStore()
    expect(loadLook(ALL, blocked, keys)).toBe('journal')
    expect(saveLook('panel', blocked, keys)).toBe(false)
  })
})

describe('the look is not part of either log', () => {
  it('saving a log writes no look, and the look key is not a log key', () => {
    const store = new MemoryStore()
    saveLog(emptyLog(), store, keys)
    expect(store.getItem(keys.look)).toBeNull()
    expect([keys.demo, keys.mine, keys.active, keys.probe]).not.toContain(keys.look)
    expect(keys.look.startsWith(`${keys.mine}.`) || keys.look.startsWith(`${keys.demo}.`)).toBe(false)
  })

  it('Export leaves it out, and Import and Delete leave it as it is', () => {
    const store = new MemoryStore()
    saveLook('night', store, keys)
    saveLog(emptyLog(), store, keys)

    expect(exportOwnLog(emptyLog(), null, store, keys)).not.toContain('night')

    const imported = readImport(V1_MINE_TEXT)
    if (imported.status !== 'ok') throw new Error('the fixture should import')
    expect(replaceOwnLog(imported.doc, store, keys).ok).toBe(true)
    expect(store.getItem(keys.look)).toBe('night')

    expect(deleteOwnLog(store, keys).ok).toBe(true)
    expect(store.getItem(keys.mine)).toBeNull()
    expect(store.getItem(keys.look)).toBe('night')
  })
})
