// Build-out item 1.1: a log saved in any earlier format version loads into the current one
// with every field intact (src/store/migrations.ts), and the frozen fixtures keep up with
// SCHEMA_VERSION.
//
// Expected values here are written by hand (the frozen fixtures in fixtures/saved/ and the
// documents in this file), never produced by the code under test. The fixture hashes in FROZEN
// were taken with `tr -d '\r' < FILE | sha256sum`.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { startDemo } from '../log'
import { backupKey, DEFAULT_KEYS } from '../keys'
import { MIGRATIONS, upgradeDoc, versionOf, type Migrations, type StoredJson } from '../migrations'
import { SCHEMA_VERSION } from '../schema'
import { loadSession } from '../session'
import { loadLog, saveLog, serializeLog, STORAGE_KEYS } from '../storage'
import { MemoryStore } from './memoryStore'

const R0 = Date.UTC(2026, 9, 26, 15, 0)
const FIXTURE_DIR = fileURLToPath(new URL('../../../fixtures/saved/', import.meta.url))

/**
 * Every frozen fixture and its SHA-256 (line endings normalised to LF). A fixture is never
 * edited once committed: change the data in a new version's fixture instead. A new fixture
 * needs its hash added here.
 */
const FROZEN: Record<string, string> = {
  'v1-demo.json': '653ce71768e8a36c0b72baa7ffd36231078ff81d84b9c4904ce0aad6eb4808fe',
  'v1-mine.json': 'd8d44f3ce40ab0c2946a7b6f02eb1150bf89d9fdf7347cde916f03491f3c3a9d',
}

const KINDS = ['demo', 'mine'] as const

function fixtureText(name: string): string {
  return readFileSync(`${FIXTURE_DIR}${name}`, 'utf8')
}

function fixture(version: number, kind: (typeof KINDS)[number]): StoredJson {
  return JSON.parse(fixtureText(`v${version}-${kind}.json`)) as StoredJson
}

function withoutVersion(doc: StoredJson): StoredJson {
  const { version: _v, ...rest } = doc
  return rest
}

function storeWith(key: string, raw: string): MemoryStore {
  const store = new MemoryStore()
  store.data.set(key, raw)
  return store
}

describe('the frozen fixtures keep up with SCHEMA_VERSION', () => {
  const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'))

  it('every fixture is listed in FROZEN and unchanged since it was committed', () => {
    expect(files.sort()).toEqual(Object.keys(FROZEN).sort())
    for (const f of files) {
      const hash = createHash('sha256').update(fixtureText(f).replace(/\r/g, '')).digest('hex')
      expect({ file: f, hash }).toEqual({ file: f, hash: FROZEN[f] })
    }
  })

  it('has a demo and a mine fixture for every version from 1 to SCHEMA_VERSION, and none newer', () => {
    const versions = files.map((f) => Number(/^v(\d+)-/.exec(f)?.[1]))
    expect(Math.max(...versions)).toBe(SCHEMA_VERSION)
    for (let v = 1; v <= SCHEMA_VERSION; v++) {
      for (const kind of KINDS) {
        expect(files).toContain(`v${v}-${kind}.json`)
        const doc = fixture(v, kind)
        expect({ version: doc.version, kind: doc.kind }).toEqual({ version: v, kind })
      }
    }
  })

  it('has exactly one upgrade step for every older version (1 to SCHEMA_VERSION - 1)', () => {
    const want = Array.from({ length: SCHEMA_VERSION - 1 }, (_, i) => String(i + 1))
    expect(Object.keys(MIGRATIONS).sort((a, b) => Number(a) - Number(b))).toEqual(want)
  })

  it('each step turns version N’s fixture into version N+1’s, nothing lost', () => {
    for (let v = 1; v < SCHEMA_VERSION; v++) {
      for (const kind of KINDS) {
        const up = upgradeDoc(fixture(v, kind), v + 1)
        expect(up).toEqual({ status: 'upgraded', from: v, doc: fixture(v + 1, kind) })
      }
    }
  })
})

describe('every saved fixture opens in this version with nothing lost', () => {
  for (let v = 1; v <= SCHEMA_VERSION; v++) {
    for (const kind of KINDS) {
      it(`v${v} ${kind}: loads equal to the current fixture, and saving it back changes nothing`, () => {
        const raw = fixtureText(`v${v}-${kind}.json`)
        const store = storeWith(STORAGE_KEYS[kind], raw)
        const current = fixture(SCHEMA_VERSION, kind)

        const res = loadLog(kind, store)
        if (res.status !== 'ok') throw new Error(`v${v} ${kind} did not load: ${JSON.stringify(res)}`)
        // Every field, including keys this version doesn't know (deep equality both ways).
        expect(res.doc).toStrictEqual(withoutVersion(current))
        expect(res.upgradedFrom).toBe(v < SCHEMA_VERSION ? v : undefined)

        expect(saveLog(res.doc, store)).toBe(true)
        expect(JSON.parse(store.getItem(STORAGE_KEYS[kind]) as string)).toStrictEqual(current)
        if (v < SCHEMA_VERSION) expect(store.getItem(backupKey(STORAGE_KEYS[kind], v))).toBe(raw)
      })
    }
  }

  it('v1 mine: the edge cases come through as written', () => {
    const store = storeWith(STORAGE_KEYS.mine, fixtureText('v1-mine.json'))
    const res = loadLog('mine', store)
    if (res.status !== 'ok') throw new Error('v1 mine should load')
    const doc = res.doc as unknown as Record<string, any>
    // Unknown is null, never 0; a typed 0 stays 0; a meal with no source keeps null.
    expect(doc.meals[1]).toMatchObject({ id: 'mine-unknown-no-source', source: null, kcal: null, protein: null })
    expect(doc.meals[2]).toMatchObject({ source: 'description', kcal: null, carbs: 0 })
    expect(doc.meals[3]).toMatchObject({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
    // Offsets are kept as written, including after the clocks change and away from home.
    expect(doc.meals[4].eatenAt).toBe('2026-11-02T10:20:00-05:00')
    expect(doc.meals[5].eatenAt).toBe('2026-11-03T19:45:00+00:00')
    expect(doc.sleeps[0]).toEqual({ id: 'sleep-mine-1', sleepStart: null, wake: '2026-10-28T07:40:00-04:00' })
    expect(doc.sleeps[2].wake).toBeNull()
    // Keys this version doesn't use yet survive, at every level.
    expect(doc.profile.usualMealsPerDay).toBe(3)
    expect(doc.meals[0].fiberG).toBe(9.4)
    expect(doc.meals[0].foods[1].tagOverrides).toEqual({ add: ['berries'], remove: [] })
    expect(doc.meals[4].nutrients).toEqual({ sugarG: 6, sodiumMg: null })
    expect(doc.meals[4].lookup.amount).toEqual({ kind: 'package', grams: null })
    expect(doc.meals[5]).toMatchObject({ proposedBy: 'claude', link: 'https://example.com/menu' })
    expect(doc.sleeps[1].tags).toEqual(['late coffee'])
    expect(doc.workouts[0]).toMatchObject({ kcal: null, source: 'burn_device' })
    expect(doc.settings).toEqual({ weightUnit: 'kg', connectorOn: false })
    expect(doc.weighIns).toEqual([{ id: 'weigh-mine-1', at: '2026-10-29T07:30:00-04:00', kg: 72.4 }])
    expect(doc.sentCount).toEqual({ barcode: 1, foodSearch: 0 })
  })

  it('v1 demo: Sam’s week and the demo clock come through as written', () => {
    const store = storeWith(STORAGE_KEYS.demo, fixtureText('v1-demo.json'))
    const res = loadLog('demo', store)
    if (res.status !== 'ok') throw new Error('v1 demo should load')
    // 2026-10-22 01:30 EDT is 05:30 UTC; 2026-10-26 11:00 EDT is 15:00 UTC.
    expect(res.doc.clock).toEqual({ demoEpochFixture: Date.UTC(2026, 9, 22, 5, 30), demoEpochReal: Date.UTC(2026, 9, 26, 15, 0) })
    expect(res.doc.profile).toEqual({ name: 'CalmLentil#3108', kind: 'demo', targets: { kcal: 2400, protein: 130 } })
    expect(res.doc.sleeps.find((s) => s.id === 'sleep-1020')?.sleepStart).toBeNull()
    expect(res.doc.meals.find((m) => m.id === 'fri-3')).toMatchObject({ kcal: null, note: "Didn't check the portion." })
  })

  it('the demo this version starts has the same shape as the frozen v1 demo (same keys, same meals)', () => {
    // A guard that the fixture is real-shaped: what the app writes today matches it key for key.
    const fresh = JSON.parse(serializeLog(startDemo(R0))) as StoredJson
    const frozen = fixture(1, 'demo')
    expect(Object.keys(fresh).sort()).toEqual(Object.keys(frozen).sort())
    expect(fresh.meals).toEqual(frozen.meals)
    expect(fresh.sleeps).toEqual(frozen.sleeps)
    expect(fresh.workouts).toEqual(frozen.workouts)
  })
})

describe('upgradeDoc: the step runner', () => {
  // A pretend history for target version 3, with nothing to do with the real formats.
  const steps: Migrations = {
    1: (d) => ({ ...d, renamed: d.old, old: undefined, ran: [...((d.ran as number[]) ?? []), 1] }),
    2: (d) => ({ ...d, ran: [...(d.ran as number[]), 2] }),
  }

  it('leaves a document already in the target version as it is', () => {
    const doc = { version: 3, a: 1 }
    expect(upgradeDoc(doc, 3, steps)).toEqual({ status: 'current', doc })
  })

  it('runs every step in order, sets each version, keeps unknown keys and never changes the input', () => {
    const doc = { version: 1, old: 'x', extra: { kept: true } }
    const before = structuredClone(doc)
    const up = upgradeDoc(doc, 3, steps)
    expect(up).toEqual({ status: 'upgraded', from: 1, doc: { version: 3, renamed: 'x', old: undefined, ran: [1, 2], extra: { kept: true } } })
    expect(doc).toEqual(before)
  })

  it('starts from the document’s own version', () => {
    expect(upgradeDoc({ version: 2, ran: [] }, 3, steps)).toEqual({ status: 'upgraded', from: 2, doc: { version: 3, ran: [2] } })
  })

  it('reports a newer version instead of touching it', () => {
    expect(upgradeDoc({ version: 4 }, 3, steps)).toEqual({ status: 'newer', version: 4 })
  })

  it.each([
    ['no version', { kind: 'mine' }],
    ['a version in quotes', { version: '1' }],
    ['a fractional version', { version: 1.5 }],
    ['a negative version', { version: -1 }],
    ['null', null],
    ['a list', [{ version: 1 }]],
  ])('refuses %s', (_name, json) => {
    expect(upgradeDoc(json, 3, steps)).toEqual({ status: 'noVersion' })
    expect(versionOf(json)).toBeNull()
  })

  it('stops at a missing step', () => {
    expect(upgradeDoc({ version: 1 }, 3, { 1: steps[1] })).toEqual({ status: 'noStep', at: 2 })
    expect(upgradeDoc({ version: 0 }, 3, steps)).toEqual({ status: 'noStep', at: 0 })
  })

  it('reports a step that throws or returns something that is not a document', () => {
    const throws: Migrations = { 1: () => { throw new Error('boom') } }
    expect(upgradeDoc({ version: 1 }, 2, throws)).toEqual({ status: 'failed', at: 1, reason: 'boom' })
    const list: Migrations = { 1: () => [] as unknown as StoredJson }
    expect(upgradeDoc({ version: 1 }, 2, list)).toMatchObject({ status: 'failed', at: 1 })
  })
})

// A pretend previous version of Sam's own log, used only here to drive the loader through a
// real upgrade (backup, write-back, failures) without bumping SCHEMA_VERSION. In it, sleeps
// were "nights" with start/end and there was no plates list. It is the current frozen mine
// fixture with that rename done by hand below, and the pretend step replaces the real last step
// (if any), so these tests keep working after a real version bump.
const PREV = SCHEMA_VERSION - 1
// Falls back to v1 when the current fixture is missing, so the fixture checks above can say so.
const CURRENT_MINE = existsSync(`${FIXTURE_DIR}v${SCHEMA_VERSION}-mine.json`) ? fixture(SCHEMA_VERSION, 'mine') : fixture(1, 'mine')
type Night = { id: string; start: string | null; end: string | null }
type Sleep = { id: string; sleepStart: string | null; wake: string | null }

const OLD_MINE: StoredJson = (() => {
  const { sleeps, plates: _plates, ...rest } = CURRENT_MINE
  const nights = (sleeps as Sleep[]).map(({ sleepStart, wake, ...more }) => ({ ...more, start: sleepStart, end: wake }))
  return { ...rest, version: PREV, nights }
})()

const PRETEND: Migrations = {
  ...MIGRATIONS,
  [PREV]: (d) => {
    const { nights, ...rest } = d
    const sleeps = (nights as Night[]).map(({ start, end, ...more }) => ({ ...more, sleepStart: start, wake: end }))
    return { ...rest, sleeps, plates: (rest.plates as unknown[] | undefined) ?? (CURRENT_MINE.plates as unknown[]) }
  },
}

describe('the loader upgrades an older log, backing up the original first', () => {
  const key = DEFAULT_KEYS.mine
  const backup = `howsure.mine.v1.backup-v${PREV}`
  const raw = JSON.stringify(OLD_MINE)
  const expected = withoutVersion(CURRENT_MINE)

  it('the pretend old log really is different from the current one', () => {
    expect(OLD_MINE.sleeps).toBeUndefined()
    expect(OLD_MINE.plates).toBeUndefined()
    expect((OLD_MINE.nights as Night[])[0]).toEqual({ id: 'sleep-mine-1', start: null, end: '2026-10-28T07:40:00-04:00' })
  })

  it('loads the upgraded log, keeps the original under the backup key, then writes the upgrade back', () => {
    const store = storeWith(key, raw)
    const res = loadLog('mine', store, { migrations: PRETEND })
    expect(res).toStrictEqual({ status: 'ok', doc: expected, upgradedFrom: PREV })
    expect(store.getItem(backup)).toBe(raw)
    expect(JSON.parse(store.getItem(key) as string)).toStrictEqual(CURRENT_MINE)
    // The backup is written before the log is written over.
    expect(store.writes).toEqual([backup, key])
  })

  it('the next load is a plain load: no upgrade, no new backup', () => {
    const store = storeWith(key, raw)
    loadLog('mine', store, { migrations: PRETEND })
    const after = store.snapshot()
    store.writes = []
    expect(loadLog('mine', store, { migrations: PRETEND })).toStrictEqual({ status: 'ok', doc: expected })
    expect(store.writes).toEqual([])
    expect(store.snapshot()).toEqual(after)
  })

  it('never replaces an older backup that holds different text', () => {
    const store = storeWith(key, raw)
    store.data.set(backup, 'an earlier original')
    loadLog('mine', store, { migrations: PRETEND })
    expect(store.getItem(backup)).toBe('an earlier original')
    expect(store.getItem(`${backup}-2`)).toBe(raw)
  })

  it('when the backup cannot be written, the original stays and the log is not saved over', () => {
    class NoBackups extends MemoryStore {
      override setItem(k: string, v: string) {
        if (k.includes('.backup-')) throw new Error('QuotaExceededError')
        super.setItem(k, v)
      }
    }
    const store = new NoBackups()
    store.data.set(key, raw)
    const res = loadLog('mine', store, { migrations: PRETEND })
    expect(res).toStrictEqual({ status: 'ok', doc: expected, upgradedFrom: PREV, saveBlocked: true })
    expect(store.snapshot()).toEqual({ [key]: raw })

    const s = loadSession(store, R0, { migrations: PRETEND })
    expect(s.problems).toEqual({ demo: null, mine: 'notBackedUp' })
    expect(s.logs.mine).toStrictEqual(expected)
    expect(store.getItem(key)).toBe(raw)
  })

  it('a step that throws leaves the log unreadable and untouched, with no backup', () => {
    const store = storeWith(key, raw)
    const throws: Migrations = { ...PRETEND, [PREV]: () => { throw new Error('bad step') } }
    expect(loadLog('mine', store, { migrations: throws })).toEqual({
      status: 'unreadable',
      reason: `upgrade from version ${PREV} failed: bad step`,
    })
    expect(store.snapshot()).toEqual({ [key]: raw })
  })

  it('an upgrade the current schema rejects leaves the log unreadable and untouched, with no backup', () => {
    const store = storeWith(key, raw)
    const spoils: Migrations = {
      ...PRETEND,
      [PREV]: (d) => {
        const up = PRETEND[PREV](d)
        return { ...up, meals: [{ ...(up.meals as StoredJson[])[0], kcal: -1 }] }
      },
    }
    expect(loadLog('mine', store, { migrations: spoils }).status).toBe('unreadable')
    expect(store.snapshot()).toEqual({ [key]: raw })
  })

  it('with the real steps, an older version that has no step is unreadable and untouched', () => {
    const v0 = JSON.stringify({ ...OLD_MINE, version: 0 })
    const store = storeWith(key, v0)
    expect(loadLog('mine', store)).toEqual({ status: 'unreadable', reason: 'no upgrade from version 0' })
    expect(store.snapshot()).toEqual({ [key]: v0 })
  })
})

describe('a log saved by a newer version is reported and never written over', () => {
  const newerMine = JSON.stringify({ ...fixture(1, 'mine'), version: SCHEMA_VERSION + 1, futureKey: [1, 2] })
  const newerDemo = JSON.stringify({ ...fixture(1, 'demo'), version: SCHEMA_VERSION + 1 })

  it('loadLog says which version saved it and leaves the text as it is', () => {
    const store = storeWith(STORAGE_KEYS.mine, newerMine)
    expect(loadLog('mine', store)).toEqual({ status: 'newer', version: SCHEMA_VERSION + 1 })
    expect(store.snapshot()).toEqual({ [STORAGE_KEYS.mine]: newerMine })
  })

  it('on start, both logs show from fresh copies and neither saved copy is written', () => {
    const store = new MemoryStore()
    store.data.set(STORAGE_KEYS.mine, newerMine)
    store.data.set(STORAGE_KEYS.demo, newerDemo)
    store.data.set(DEFAULT_KEYS.active, 'demo')
    const s = loadSession(store, R0)
    expect(s.problems).toEqual({ demo: 'newer', mine: 'newer' })
    expect(s.active).toBe('demo')
    expect(s.logs.demo?.meals.length).toBeGreaterThan(0)
    expect(s.logs.mine.meals).toEqual([])
    expect(store.getItem(STORAGE_KEYS.mine)).toBe(newerMine)
    expect(store.getItem(STORAGE_KEYS.demo)).toBe(newerDemo)
  })

  it('saveLog refuses to write over it, even when asked directly (e.g. a newer version in another tab)', () => {
    const store = storeWith(STORAGE_KEYS.demo, newerDemo)
    expect(saveLog(startDemo(R0), store)).toBe(false)
    expect(store.getItem(STORAGE_KEYS.demo)).toBe(newerDemo)
  })
})
