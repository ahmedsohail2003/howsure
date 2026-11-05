// Build-out item 1.1: storage namespaces for test runs and dev sessions. The default keys stay the
// ones every saved log already uses; a namespace gives a test run or dev session its own keys
// in the same browser origin and never touches the default ones.
import { describe, expect, it } from 'vitest'
import { emptyLog, startDemo } from '../log'
import { backupKey, DEFAULT_KEYS, storageKeys } from '../keys'
import { loadSession } from '../session'
import { KEYS, loadLog, saveActive, saveLog, STORAGE_NAMESPACE } from '../storage'
import { MemoryStore } from './memoryStore'

const R0 = Date.UTC(2026, 9, 26, 15, 0)

describe('default keys', () => {
  it('are exactly the keys saved logs already use', () => {
    expect(DEFAULT_KEYS).toEqual({
      demo: 'howsure.demo.v1',
      mine: 'howsure.mine.v1',
      active: 'howsure.active.v1',
      probe: 'howsure.probe',
      look: 'howsure.look.v1',
    })
  })

  it.each([undefined, null, '', '   '])('are what no namespace (%j) gives', (ns) => {
    expect(storageKeys(ns)).toEqual(DEFAULT_KEYS)
  })

  it('this build uses the namespace it was built with (none in unit tests)', () => {
    expect(KEYS).toEqual(storageKeys(STORAGE_NAMESPACE))
    if (!STORAGE_NAMESPACE) expect(KEYS).toEqual(DEFAULT_KEYS)
  })
})

describe('namespaced keys', () => {
  it('put the namespace after "howsure."', () => {
    expect(storageKeys('e2e')).toEqual({
      demo: 'howsure.e2e.demo.v1',
      mine: 'howsure.e2e.mine.v1',
      active: 'howsure.e2e.active.v1',
      probe: 'howsure.e2e.probe',
      look: 'howsure.e2e.look.v1',
    })
  })

  it('never equal a default key or one of its backups, whatever the namespace', () => {
    const defaults = Object.values(DEFAULT_KEYS)
    for (const ns of ['demo', 'mine', 'active', 'v1', 'probe', 'look', 'e2e', 'dev-sam-2']) {
      for (const k of Object.values(storageKeys(ns))) {
        expect(defaults).not.toContain(k)
        expect(k.startsWith(`${DEFAULT_KEYS.demo}.`) || k.startsWith(`${DEFAULT_KEYS.mine}.`)).toBe(false)
      }
    }
  })

  it.each(['E2E', 'a.b', '-x', 'a b', 'x'.repeat(33), 'ü'])('refuse %j instead of falling back to the default keys', (ns) => {
    expect(() => storageKeys(ns)).toThrow(/storage namespace/)
  })

  it('a session in a namespace reads and writes only its own keys', () => {
    const store = new MemoryStore()
    // Logs already saved under the default keys (stand-in text: they are never parsed or written).
    store.data.set(DEFAULT_KEYS.demo, 'saved demo')
    store.data.set(DEFAULT_KEYS.mine, 'saved own log')
    store.data.set(DEFAULT_KEYS.active, 'mine')
    const keys = storageKeys('e2e')

    const s = loadSession(store, R0, { keys })
    expect(s).toMatchObject({ active: null, problems: { demo: null, mine: null }, logs: { demo: null } })
    expect(saveLog(startDemo(R0), store, keys)).toBe(true)
    expect(saveLog({ ...emptyLog(), profile: { name: 'Sam', kind: 'guest' } }, store, keys)).toBe(true)
    expect(saveActive('demo', store, keys)).toBe(true)

    expect(store.getItem(DEFAULT_KEYS.demo)).toBe('saved demo')
    expect(store.getItem(DEFAULT_KEYS.mine)).toBe('saved own log')
    expect(store.getItem(DEFAULT_KEYS.active)).toBe('mine')
    expect([...store.data.keys()].sort()).toEqual([
      'howsure.active.v1',
      'howsure.demo.v1',
      'howsure.e2e.active.v1',
      'howsure.e2e.demo.v1',
      'howsure.e2e.mine.v1',
      'howsure.mine.v1',
    ])
    expect(store.writes.every((w) => w.includes('howsure.e2e.'))).toBe(true)

    const back = loadLog('mine', store, { keys })
    expect(back.status === 'ok' && back.doc.profile.name).toBe('Sam')
    expect(loadSession(store, R0, { keys }).active).toBe('demo')
  })
})

describe('backup keys', () => {
  it('name the document key and the version upgraded from, then count up', () => {
    expect(backupKey('howsure.mine.v1', 1)).toBe('howsure.mine.v1.backup-v1')
    expect(backupKey('howsure.mine.v1', 1, 2)).toBe('howsure.mine.v1.backup-v1-2')
    expect(backupKey('howsure.e2e.demo.v1', 3)).toBe('howsure.e2e.demo.v1.backup-v3')
  })
})
