// spec.md > Store, > Clock and > Important Failure Modes: two separate keys, whole-document
// writes, a failed parse never wipes, blocked storage is reported, and the demo clock is kept
// in the demo document so a reload continues the timeline. prd.md > Saving.
import { describe, expect, it } from 'vitest'
import { demoNowMs, nowIso, parseWallClock, toLocalIso } from '../../clock'
import type { Meal } from '../../kernel/types'
import { emptyLog, startDemo, type LogDoc } from '../log'
import { loadSession } from '../session'
import {
  ACTIVE_KEY,
  loadActive,
  loadLog,
  saveActive,
  saveLog,
  serializeLog,
  STORAGE_KEYS,
  storageWorks,
  type KeyValueStore,
} from '../storage'

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.has(k) ? (this.data.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v))
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

/** Storage the browser refuses entirely (e.g. site data blocked). */
class BlockedStore implements KeyValueStore {
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

/** Storage that reads but won't take another byte. */
class FullStore extends MemoryStore {
  override setItem(): void {
    throw new Error('QuotaExceededError')
  }
}

const R0 = Date.UTC(2026, 9, 26, 15, 0) // any real time; the demo clock starts at the fixture's own moment
const DEMO_START_MS = parseWallClock('2026-10-22T01:30:00')

function mineWith(meals: Meal[]): LogDoc {
  return { ...emptyLog(), meals }
}

const unknownSnack: Meal = {
  id: 'mine-1',
  name: 'Snack',
  eatenAt: '2026-10-26T10:00:00-04:00',
  source: 'description',
  kcal: null,
  protein: null,
  carbs: 0,
  fat: null,
}

describe('two keys, kept apart', () => {
  it('uses howsure.demo.v1 and howsure.mine.v1', () => {
    expect(STORAGE_KEYS).toEqual({ demo: 'howsure.demo.v1', mine: 'howsure.mine.v1' })
  })

  it('round-trips the demo document, clock included', () => {
    const store = new MemoryStore()
    const demo = startDemo(R0)
    expect(saveLog(demo, store)).toBe(true)
    const back = loadLog('demo', store)
    expect(back.status).toBe('ok')
    if (back.status !== 'ok') return
    expect(back.doc).toEqual(demo)
    expect(back.doc.clock).toEqual({ demoEpochFixture: DEMO_START_MS, demoEpochReal: R0 })
    expect(JSON.parse(store.getItem('howsure.demo.v1') as string).version).toBe(1)
  })

  it('saving your own log never touches the demo, and the other way round', () => {
    const store = new MemoryStore()
    saveLog(startDemo(R0), store)
    const demoRaw = store.getItem(STORAGE_KEYS.demo)
    saveLog(mineWith([unknownSnack]), store)
    expect(store.getItem(STORAGE_KEYS.demo)).toBe(demoRaw)

    const mineRaw = store.getItem(STORAGE_KEYS.mine)
    const demo = loadLog('demo', store)
    if (demo.status !== 'ok') throw new Error('demo should load')
    saveLog({ ...demo.doc, meals: demo.doc.meals.slice(1) }, store)
    expect(store.getItem(STORAGE_KEYS.mine)).toBe(mineRaw)

    const mine = loadLog('mine', store)
    expect(mine.status === 'ok' && mine.doc.meals.map((m) => m.id)).toEqual(['mine-1'])
    const demoBack = loadLog('demo', store)
    expect(demoBack.status === 'ok' && demoBack.doc.meals.some((m) => m.id === 'mine-1')).toBe(false)
  })

  it('keeps unknown as null and a typed 0 as 0', () => {
    const store = new MemoryStore()
    saveLog(mineWith([unknownSnack]), store)
    const back = loadLog('mine', store)
    if (back.status !== 'ok') throw new Error('mine should load')
    expect(back.doc.meals[0]).toMatchObject({ kcal: null, protein: null, carbs: 0, fat: null })
  })

  it('remembers which log was open', () => {
    const store = new MemoryStore()
    expect(loadActive(store)).toBeNull()
    saveActive('mine', store)
    expect(store.getItem(ACTIVE_KEY)).toBe('mine')
    expect(loadActive(store)).toBe('mine')
    saveActive('demo', store)
    expect(loadActive(store)).toBe('demo')
  })

  it('keeps keys it does not know yet, so a later slice’s data is never trimmed', () => {
    const store = new MemoryStore()
    const raw = JSON.parse(serializeLog(mineWith([unknownSnack])))
    raw.sentCount = { barcode: 2 }
    raw.meals[0].fiberG = 3
    store.setItem(STORAGE_KEYS.mine, JSON.stringify(raw))
    const back = loadLog('mine', store)
    if (back.status !== 'ok') throw new Error('mine should load')
    expect((back.doc as unknown as Record<string, unknown>).sentCount).toEqual({ barcode: 2 })
    saveLog(back.doc, store)
    const again = JSON.parse(store.getItem(STORAGE_KEYS.mine) as string)
    expect(again.sentCount).toEqual({ barcode: 2 })
    expect(again.meals[0].fiberG).toBe(3)
  })
})

describe('a document that fails to parse is reported and never wiped', () => {
  const bad: [string, (doc: Record<string, unknown>) => unknown][] = [
    ['negative calories', (d) => ((d.meals as Record<string, unknown>[])[0].kcal = -50)],
    ['letters for calories', (d) => ((d.meals as Record<string, unknown>[])[0].kcal = 'abc')],
    ['a time with no offset', (d) => ((d.meals as Record<string, unknown>[])[0].eatenAt = '2026-10-21T17:30:00')],
    ['an unknown source', (d) => ((d.meals as Record<string, unknown>[])[0].source = 'vibes')],
    ['a mine document under the demo key', (d) => (d.kind = 'mine')],
    ['another schema version', (d) => (d.version = 2)],
  ]

  it('says "unreadable" for text that is not JSON', () => {
    const store = new MemoryStore()
    store.setItem(STORAGE_KEYS.demo, '{not json')
    expect(loadLog('demo', store)).toEqual({ status: 'unreadable', reason: 'not JSON' })
    expect(store.getItem(STORAGE_KEYS.demo)).toBe('{not json')
  })

  it.each(bad)('says "unreadable" for %s', (_name, spoil) => {
    const store = new MemoryStore()
    const doc = JSON.parse(serializeLog(startDemo(R0)))
    spoil(doc)
    const raw = JSON.stringify(doc)
    store.setItem(STORAGE_KEYS.demo, raw)
    expect(loadLog('demo', store).status).toBe('unreadable')
    expect(store.getItem(STORAGE_KEYS.demo)).toBe(raw)
  })

  it('on start, shows a fresh demo in memory and leaves the saved copy exactly as it was', () => {
    const store = new MemoryStore()
    store.setItem(STORAGE_KEYS.demo, '{not json')
    store.setItem(ACTIVE_KEY, 'demo')
    const s = loadSession(store, R0)
    expect(s.active).toBe('demo')
    expect(s.unreadable).toEqual({ demo: true, mine: false })
    expect(s.logs.demo?.meals.length).toBeGreaterThan(0)
    expect(store.getItem(STORAGE_KEYS.demo)).toBe('{not json')
  })

  it('refuses to write a document the next load would reject', () => {
    const doc = mineWith([{ ...unknownSnack, kcal: -1 }])
    expect(() => serializeLog(doc)).toThrow()
  })
})

describe('storage that is blocked or full', () => {
  it('blocked: nothing loads, nothing saves, and storageWorks says so', () => {
    const store = new BlockedStore()
    expect(storageWorks(store)).toBe(false)
    expect(storageWorks(null)).toBe(false)
    expect(loadLog('demo', store)).toEqual({ status: 'missing' })
    expect(saveLog(startDemo(R0), store)).toBe(false)
    expect(saveActive('demo', store)).toBe(false)
    expect(loadSession(store, R0)).toMatchObject({ active: null, storageOk: false })
  })

  it('full: saving reports false instead of throwing, and what was saved stays', () => {
    const store = new FullStore()
    store.data.set(STORAGE_KEYS.mine, serializeLog(mineWith([unknownSnack])))
    expect(storageWorks(store)).toBe(false)
    expect(saveLog(mineWith([]), store)).toBe(false)
    const back = loadLog('mine', store)
    expect(back.status === 'ok' && back.doc.meals.length).toBe(1)
  })
})

describe('the demo clock survives a reload (spec.md > Clock)', () => {
  it('continues from where it was instead of restarting at Thu 01:30', () => {
    const store = new MemoryStore()
    saveLog(startDemo(R0), store)
    store.setItem(ACTIVE_KEY, 'demo')

    // Two hours later the page reloads.
    const later = R0 + 2 * 60 * 60 * 1000
    const s = loadSession(store, later)
    expect(s.active).toBe('demo')
    expect(s.logs.demo?.clock).toEqual({ demoEpochFixture: DEMO_START_MS, demoEpochReal: R0 })
    expect(demoNowMs(later)).toBe(DEMO_START_MS + 2 * 60 * 60 * 1000)
    expect(nowIso('demo', later)).toBe(toLocalIso(parseWallClock('2026-10-22T03:30:00')))
  })

  it('a demo saved without a clock restarts it at the fixture moment and saves that', () => {
    const store = new MemoryStore()
    const { clock: _clock, ...noClock } = startDemo(R0)
    saveLog(noClock, store)
    const s = loadSession(store, R0 + 5000)
    expect(s.logs.demo?.clock).toEqual({ demoEpochFixture: DEMO_START_MS, demoEpochReal: R0 + 5000 })
    const back = loadLog('demo', store)
    expect(back.status === 'ok' && back.doc.clock).toEqual({ demoEpochFixture: DEMO_START_MS, demoEpochReal: R0 + 5000 })
  })

  it('with nothing saved, the first-open screen shows (no active log)', () => {
    const s = loadSession(new MemoryStore(), R0)
    expect(s).toMatchObject({ active: null, storageOk: true, logs: { demo: null } })
    expect(s.logs.mine.meals).toEqual([])
  })
})

// prd.md > Logging a Meal: "With calories blank, it can stay empty" (slice 3).
describe('a meal saved with blank calories and no source picked', () => {
  const noSource: Meal = { ...unknownSnack, id: 'mine-2', name: 'Leftover soup', source: null }

  it('saves and loads, kept as unknown with no source', () => {
    const store = new MemoryStore()
    expect(saveLog(mineWith([noSource]), store)).toBe(true)
    const back = loadLog('mine', store)
    if (back.status !== 'ok') throw new Error('mine should load')
    expect(back.doc.meals[0]).toEqual(noSource)
  })

  it('refuses known calories with no source, so the day never counts a meal it cannot say how sure about', () => {
    expect(() => serializeLog(mineWith([{ ...noSource, kcal: 300 }]))).toThrow()
    const store = new MemoryStore()
    const raw = JSON.parse(serializeLog(mineWith([noSource])))
    raw.meals[0].kcal = 300
    store.setItem(STORAGE_KEYS.mine, JSON.stringify(raw))
    expect(loadLog('mine', store).status).toBe('unreadable')
  })

  it('a typed 0 with a source is kept as 0', () => {
    const store = new MemoryStore()
    saveLog(mineWith([{ ...noSource, kcal: 0, source: 'label' }]), store)
    const back = loadLog('mine', store)
    expect(back.status === 'ok' && back.doc.meals[0].kcal).toBe(0)
  })
})
