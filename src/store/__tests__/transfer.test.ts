// Build-out item 1.2: Export, Import and Delete for your own log (prd.md > Privacy Panel,
// spec.md > Store > Export / Delete).
//
// Expected values are written by hand from the frozen fixture fixtures/saved/v1-mine.json (read
// with a text editor, not produced by the code under test):
// - 6 meals, 3 sleep records, 1 workout, 1 plate, guest name "Sam";
// - earliest time: sleep-mine-1's wake, 2026-10-28T07:40:00-04:00 (before the first meal at 08:10);
// - latest time: sleep-mine-3's sleepStart, 2026-11-03T23:30:00+00:00, which is after the last
//   meal (2026-11-03T19:45:00+00:00). In Toronto (EST, -05:00, after Nov 1) that is 18:30 on
//   2026-11-03, so the span reads "From 2026-10-28 to 2026-11-03".
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { emptyLog, startDemo, type LogDoc } from '../log'
import { backupKey, DEFAULT_KEYS, storageKeys } from '../keys'
import { MIGRATIONS, type Migrations, type StoredJson } from '../migrations'
import { SCHEMA_VERSION } from '../schema'
import { loadLog, saveLog, serializeLog } from '../storage'
import {
  backupKeys,
  backupsFileName,
  countOlderCopies,
  deleteOwnLog,
  exportBackups,
  exportFileName,
  exportOwnLog,
  IMPORT_MAX_BYTES,
  keepsOriginal,
  listBackups,
  olderCopies,
  readImport,
  replaceOwnLog,
  summarize,
} from '../transfer'
import { MemoryStore } from './memoryStore'

const FIXTURE_DIR = fileURLToPath(new URL('../../../fixtures/saved/', import.meta.url))
const V1_MINE_TEXT = readFileSync(`${FIXTURE_DIR}v1-mine.json`, 'utf8')
const V1_DEMO_TEXT = readFileSync(`${FIXTURE_DIR}v1-demo.json`, 'utf8')
const V1_MINE = JSON.parse(V1_MINE_TEXT) as StoredJson

const K = DEFAULT_KEYS

/** What the fixture holds, counted by hand (see the top of this file). */
const SAM_SUMMARY = {
  name: 'Sam',
  meals: 6,
  nights: 3,
  workouts: 1,
  plates: 1,
  savedMeals: 0,
  // One weigh-in, Thu 2026-10-29 07:30 (build-out item 2.4); it is neither the first nor the last time.
  weighIns: 1,
  first: '2026-10-28T07:40:00-04:00',
  last: '2026-11-03T23:30:00+00:00',
}

/** The fixture as a LogDoc (the stored document minus its version), written out by hand. */
function mineDoc(): LogDoc {
  const { version: _v, ...rest } = structuredClone(V1_MINE)
  return rest as unknown as LogDoc
}

function storeWith(entries: Record<string, string>): MemoryStore {
  const s = new MemoryStore()
  for (const [k, v] of Object.entries(entries)) s.data.set(k, v)
  return s
}

/** Storage that reads but won't take another byte. */
class FullStore extends MemoryStore {
  override setItem(): void {
    throw new Error('QuotaExceededError')
  }
}

/** Storage that won't remove anything. */
class StuckStore extends MemoryStore {
  override removeItem(): void {
    throw new Error('SecurityError')
  }
}

describe('file names', () => {
  it('uses the local date', () => {
    // 2026-11-05 00:30 in Toronto is still 2026-11-05 locally (05:30 UTC).
    const d = new Date('2026-11-05T00:30:00-05:00')
    expect(exportFileName(d)).toBe('howsure-log-2026-11-05.json')
    expect(backupsFileName(d)).toBe('howsure-older-copies-2026-11-05.json')
    // 2026-11-05 23:30 in Toronto is 2026-11-06 in UTC, but the file is named for the local day.
    expect(exportFileName(new Date('2026-11-06T04:30:00Z'))).toBe('howsure-log-2026-11-05.json')
  })
})

describe('Export', () => {
  it('downloads the stored document with its version, readable, and nothing else', () => {
    const text = exportOwnLog(mineDoc(), null, new MemoryStore())
    expect(JSON.parse(text)).toStrictEqual(V1_MINE)
    expect(JSON.parse(text).version).toBe(SCHEMA_VERSION)
    // Indented for a person to read, and ends with a newline.
    expect(text.startsWith('{\n  "version": 1,\n  "kind": "mine",')).toBe(true)
    expect(text.endsWith('}\n')).toBe(true)
  })

  it('exports the log on screen, so changes the device could not save are included', () => {
    const store = new FullStore()
    const doc = { ...mineDoc(), meals: [] }
    expect(saveLog(doc, store)).toBe(false)
    expect(JSON.parse(exportOwnLog(doc, null, store)).meals).toEqual([])
  })

  it('exports the stored text as it is when this version cannot read it', () => {
    const junk = '{"version":1,"kind":"mine","meals":['
    const store = storeWith({ [K.mine]: junk })
    expect(exportOwnLog(emptyLog(), 'unreadable', store)).toBe(junk)
    const newer = JSON.stringify({ ...V1_MINE, version: 99, laterThing: [1] })
    expect(exportOwnLog(emptyLog(), 'newer', storeWith({ [K.mine]: newer }))).toBe(newer)
  })

  it('still exports when storage is blocked (no store)', () => {
    expect(JSON.parse(exportOwnLog(mineDoc(), null, null))).toStrictEqual(V1_MINE)
  })

  it('falls back to the stored text if the log on screen fails the check (a bug), never throwing', () => {
    const bad = { ...mineDoc(), meals: [{ id: '' }] } as unknown as LogDoc
    expect(exportOwnLog(bad, null, storeWith({ [K.mine]: V1_MINE_TEXT }))).toBe(V1_MINE_TEXT)
    expect(JSON.parse(exportOwnLog(bad, null, new MemoryStore())).meals).toEqual([{ id: '' }])
  })

  it('uses the namespaced key when given one', () => {
    const keys = storageKeys('e2e')
    const store = storeWith({ [keys.mine]: 'ns text', [K.mine]: 'default text' })
    expect(exportOwnLog(emptyLog(), 'unreadable', store, keys)).toBe('ns text')
  })
})

describe('older copies kept by format upgrades', () => {
  const b1 = backupKey(K.mine, 0)
  const b2 = backupKey(K.mine, 0, 2)
  const store = () =>
    storeWith({
      [K.mine]: V1_MINE_TEXT,
      [b2]: 'second',
      [b1]: 'first',
      // Not backups of your own log:
      [backupKey(K.demo, 0)]: 'demo backup',
      [`${K.mine}.backup-vx`]: 'not a backup key',
      [K.active]: 'mine',
    })

  it('lists only your own log’s backups, sorted by key', () => {
    expect(listBackups(store(), K.mine)).toEqual([
      { key: 'howsure.mine.v1.backup-v0', text: 'first' },
      { key: 'howsure.mine.v1.backup-v0-2', text: 'second' },
    ])
    expect(listBackups(null, K.mine)).toEqual([])
  })

  it('orders slots as numbers, oldest first, so a tenth backup comes after the second', () => {
    const many: Record<string, string> = {}
    for (let n = 1; n <= 11; n++) many[backupKey(K.mine, 1, n)] = `copy ${n}`
    many[backupKey(K.mine, 0)] = 'older format'
    const keys = backupKeys(storeWith(many), K.mine)
    expect(keys).toEqual([backupKey(K.mine, 0), ...Array.from({ length: 11 }, (_, i) => backupKey(K.mine, 1, i + 1))])
    expect(keys.at(-2)).toBe('howsure.mine.v1.backup-v1-10')
  })

  it('lists their keys without reading them, and counts them for the panel', () => {
    expect(backupKeys(store(), K.mine)).toEqual(['howsure.mine.v1.backup-v0', 'howsure.mine.v1.backup-v0-2'])
    expect(backupKeys(null, K.mine)).toEqual([])
    expect(countOlderCopies(null, store())).toEqual({ backups: 2, original: false })
    expect(olderCopies(null, store())).toEqual(listBackups(store(), K.mine))
  })

  it('exports them unchanged under their keys', () => {
    expect(JSON.parse(exportBackups(listBackups(store(), K.mine)))).toEqual({
      app: 'HowSure',
      olderCopies: [
        { key: 'howsure.mine.v1.backup-v0', text: 'first' },
        { key: 'howsure.mine.v1.backup-v0-2', text: 'second' },
      ],
    })
  })
})

describe('an upgraded log whose original could not be backed up (problem notBackedUp)', () => {
  // The original older-format text is still under the log's own key, and it is the only copy of
  // it: Export must offer it and the Delete confirmation must name it.
  const original = '{"version":0,"kind":"mine","nights":[]}'
  const b1 = backupKey(K.mine, 0)

  it('offers the original as the first older copy, unchanged, before any backups', () => {
    const store = storeWith({ [K.mine]: original, [b1]: 'an earlier backup' })
    expect(keepsOriginal('notBackedUp', store)).toBe(true)
    expect(countOlderCopies('notBackedUp', store)).toEqual({ backups: 1, original: true })
    expect(olderCopies('notBackedUp', store)).toEqual([
      { key: 'howsure.mine.v1', text: original },
      { key: 'howsure.mine.v1.backup-v0', text: 'an earlier backup' },
    ])
    expect(JSON.parse(exportBackups(olderCopies('notBackedUp', store)))).toEqual({
      app: 'HowSure',
      olderCopies: [
        { key: 'howsure.mine.v1', text: original },
        { key: 'howsure.mine.v1.backup-v0', text: 'an earlier backup' },
      ],
    })
  })

  it('the main Export is the upgraded log on screen', () => {
    const store = storeWith({ [K.mine]: original })
    expect(JSON.parse(exportOwnLog(mineDoc(), 'notBackedUp', store))).toStrictEqual(V1_MINE)
  })

  it('is not offered for other problems, or when nothing is stored', () => {
    const store = storeWith({ [K.mine]: original })
    for (const problem of [null, 'unreadable', 'newer'] as const) {
      expect(keepsOriginal(problem, store)).toBe(false)
      expect(olderCopies(problem, store)).toEqual([])
    }
    expect(keepsOriginal('notBackedUp', new MemoryStore())).toBe(false)
    expect(keepsOriginal('notBackedUp', null)).toBe(false)
    expect(countOlderCopies('notBackedUp', new MemoryStore())).toEqual({ backups: 0, original: false })
  })

  it('uses the namespaced key when given one', () => {
    const keys = storageKeys('e2e')
    const store = storeWith({ [keys.mine]: original, [K.mine]: 'default text' })
    expect(olderCopies('notBackedUp', store, keys)).toEqual([{ key: 'howsure.e2e.mine.v1', text: original }])
  })
})

describe('summarize', () => {
  it('counts the fixture by hand', () => {
    expect(summarize(mineDoc())).toEqual(SAM_SUMMARY)
  })

  it('an empty log has no times', () => {
    expect(summarize(emptyLog())).toEqual({ name: '', meals: 0, nights: 0, workouts: 0, plates: 0, savedMeals: 0, weighIns: 0, first: null, last: null })
  })
})

describe('Import reads a file through the same pipeline as a stored log', () => {
  it('accepts an own log, as exported or as frozen', () => {
    const exported = exportOwnLog(mineDoc(), null, null)
    for (const text of [exported, V1_MINE_TEXT, `\uFEFF${V1_MINE_TEXT}`]) {
      const res = readImport(text)
      expect(res.status).toBe('ok')
      if (res.status !== 'ok') return
      expect(res.doc).toStrictEqual(mineDoc())
      expect(res.upgradedFrom).toBeUndefined()
      expect(res.summary.meals).toBe(6)
      expect(res.summary.nights).toBe(3)
    }
  })

  it('upgrades a file from an older format version on the way in', () => {
    // A pretend previous version where sleeps were "nights" with start/end (as in
    // migrations.test.ts). Its step is passed in, so this works without bumping SCHEMA_VERSION.
    const prev = SCHEMA_VERSION - 1
    const { sleeps, ...rest } = structuredClone(V1_MINE)
    type Sleep = { sleepStart: string | null; wake: string | null }
    const nights = (sleeps as Sleep[]).map(({ sleepStart, wake, ...more }) => ({ ...more, start: sleepStart, end: wake }))
    const old = { ...rest, version: prev, nights }
    const steps: Migrations = {
      ...MIGRATIONS,
      [prev]: (d) => {
        const { nights: n, ...others } = d
        type Night = { start: string | null; end: string | null }
        return { ...others, sleeps: (n as Night[]).map(({ start, end, ...more }) => ({ ...more, sleepStart: start, wake: end })) }
      },
    }
    const res = readImport(JSON.stringify(old), steps)
    expect(res).toStrictEqual({ status: 'ok', doc: mineDoc(), summary: SAM_SUMMARY, upgradedFrom: prev })
    // Without the step there is no way up, so it is refused.
    expect(readImport(JSON.stringify(old))).toMatchObject({ status: 'refused', problem: 'unreadable' })
  })

  it('a workout logged in this version round-trips through Export and Import unchanged (build-out item 2.5a)', () => {
    const doc = mineDoc()
    const withRun: LogDoc = {
      ...doc,
      workouts: [
        ...doc.workouts,
        { id: 'workout-run', name: 'Evening run', startedAt: '2026-10-28T18:30:00-04:00', minutes: 35, kcal: 300, source: 'burn_guess' },
        { id: 'workout-swim', name: 'Swim', startedAt: '2026-10-28T19:30:00-04:00', minutes: null, kcal: null, source: null },
      ],
    }
    const res = readImport(exportOwnLog(withRun, null, null))
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.doc).toStrictEqual(withRun)
    expect(res.summary.workouts).toBe(3)
  })

  it('the usual day length round-trips through Export and Import unchanged; one out of its range is refused, naming the field (build-out item 2.8)', () => {
    const doc = mineDoc()
    const withDay: LogDoc = { ...doc, profile: { ...doc.profile, usualDayHours: 15.5 } }
    const res = readImport(exportOwnLog(withDay, null, null))
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.doc).toStrictEqual(withDay)
    expect(res.doc.profile.usualDayHours).toBe(15.5)
    // A log saved before item 2.8 has none, and loads (the 16 h preset is used, nothing is written).
    expect(mineDoc().profile.usualDayHours).toBeUndefined()
    for (const bad of [5.5, 23.5, -16]) {
      const text = JSON.stringify({ ...V1_MINE, profile: { ...(V1_MINE as { profile: object }).profile, usualDayHours: bad } })
      expect(readImport(text)).toMatchObject({ status: 'refused', problem: 'unreadable', detail: expect.stringContaining('usualDayHours') })
    }
  })

  it('a gym session with drop sets round-trips through Export and Import unchanged, with the weight unit setting (build-out item 2.6)', () => {
    const doc = mineDoc()
    const withGym: LogDoc = {
      ...doc,
      settings: { ...(doc.settings ?? {}), weightUnit: 'lb' },
      workouts: [
        ...doc.workouts,
        {
          id: 'workout-push',
          name: 'Push',
          startedAt: '2026-10-28T18:30:00-04:00',
          minutes: 50,
          kcal: null,
          source: null,
          gym: {
            unit: 'lb',
            exercises: [
              {
                name: 'Bench press',
                sets: [
                  { kind: 'warmup', weightKg: 20.41165665, reps: 10 },
                  { kind: 'working', weightKg: 61.2349699, reps: 8 },
                  { kind: 'drop', weightKg: 45.359237, reps: 10, drops: [{ weightKg: 34.01942775, reps: 8 }, { weightKg: null, reps: 6 }] },
                ],
              },
              { name: 'Dips', sets: [{ kind: 'working', weightKg: null, reps: 12 }] },
            ],
          },
        },
      ],
    }
    const res = readImport(exportOwnLog(withGym, null, null))
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.doc).toStrictEqual(withGym)
  })

  it('refuses gym sets that are not sets: a negative weight, reps that are not whole, a kind HowSure does not know (build-out item 2.6)', () => {
    const base = (set: Record<string, unknown>) => {
      const doc = structuredClone(V1_MINE) as { workouts: Record<string, unknown>[] }
      doc.workouts[0].gym = { unit: 'kg', exercises: [{ name: 'Row', sets: [set] }] }
      return JSON.stringify(doc)
    }
    expect(readImport(base({ kind: 'working', weightKg: 60, reps: 8 })).status).toBe('ok')
    expect(readImport(base({ kind: 'working', weightKg: -60, reps: 8 }))).toMatchObject({ status: 'refused', problem: 'unreadable' })
    expect(readImport(base({ kind: 'working', weightKg: 60, reps: 7.5 }))).toMatchObject({ status: 'refused', problem: 'unreadable' })
    expect(readImport(base({ kind: 'max', weightKg: 60, reps: 8 }))).toMatchObject({ status: 'refused', problem: 'unreadable' })
    // As strict as the model, so an edit never has to change a stored value without saying so:
    // reps from 1, a weight of 0 (blank is null), drops on a set that is not a drop set, an empty
    // drops list.
    expect(readImport(base({ kind: 'working', weightKg: 60, reps: 0 }))).toMatchObject({ status: 'refused', problem: 'unreadable' })
    expect(readImport(base({ kind: 'working', weightKg: 0, reps: 8 }))).toMatchObject({ status: 'refused', problem: 'unreadable' })
    expect(readImport(base({ kind: 'working', weightKg: null, reps: 8 })).status).toBe('ok')
    expect(
      readImport(base({ kind: 'working', weightKg: 60, reps: 8, drops: [{ weightKg: 40, reps: 6 }] })),
    ).toMatchObject({ status: 'refused', problem: 'unreadable' })
    expect(readImport(base({ kind: 'drop', weightKg: 60, reps: 8, drops: [] }))).toMatchObject({ status: 'refused', problem: 'unreadable' })
    expect(readImport(base({ kind: 'drop', weightKg: 60, reps: 8, drops: [{ weightKg: 40, reps: 0 }] }))).toMatchObject({
      status: 'refused',
      problem: 'unreadable',
    })
    expect(readImport(base({ kind: 'drop', weightKg: 60, reps: 8, drops: [{ weightKg: 40, reps: 6 }] })).status).toBe('ok')
    // A session needs an exercise, and an exercise a set.
    const shaped = (gym: unknown) => {
      const doc = structuredClone(V1_MINE) as { workouts: Record<string, unknown>[] }
      doc.workouts[0].gym = gym
      return JSON.stringify(doc)
    }
    expect(readImport(shaped({ unit: 'kg', exercises: [] }))).toMatchObject({ status: 'refused', problem: 'unreadable' })
    expect(readImport(shaped({ unit: 'kg', exercises: [{ name: 'Row', sets: [] }] }))).toMatchObject({
      status: 'refused',
      problem: 'unreadable',
    })
  })

  it('refuses a workout with known calories and no source, as for a meal (build-out item 2.5a)', () => {
    const doc = structuredClone(V1_MINE) as { workouts: { kcal: unknown; source: unknown }[] }
    doc.workouts[0].kcal = 200
    doc.workouts[0].source = null
    expect(readImport(JSON.stringify(doc))).toMatchObject({ status: 'refused', problem: 'unreadable', detail: expect.stringContaining('workouts.0.source') })
    // Unknown is null, never a negative number or a word.
    const bad = structuredClone(V1_MINE) as { workouts: { minutes: unknown }[] }
    bad.workouts[0].minutes = -5
    expect(readImport(JSON.stringify(bad))).toMatchObject({ status: 'refused', problem: 'unreadable' })
  })

  it('refuses text that is not a log', () => {
    for (const text of ['', 'not json', '[]', '{}', '{"version":"1"}', '{"version":1,"kind":"mine"}']) {
      expect(readImport(text)).toMatchObject({ status: 'refused', problem: 'unreadable' })
    }
  })

  it('refuses a log the zod check rejects, naming the field', () => {
    const doc = structuredClone(V1_MINE) as { meals: { kcal: unknown }[] }
    doc.meals[0].kcal = -5
    expect(readImport(JSON.stringify(doc))).toMatchObject({ status: 'refused', problem: 'unreadable', detail: expect.stringContaining('meals.0.kcal') })
  })

  it('refuses a file from a newer version', () => {
    expect(readImport(JSON.stringify({ ...V1_MINE, version: SCHEMA_VERSION + 1 }))).toEqual({
      status: 'refused',
      problem: 'newer',
      detail: `version ${SCHEMA_VERSION + 1}`,
    })
  })

  it('refuses the fictional demo instead of turning it into your own log', () => {
    expect(readImport(V1_DEMO_TEXT)).toEqual({ status: 'refused', problem: 'demo' })
    expect(readImport(serializeLog(startDemo(0)))).toEqual({ status: 'refused', problem: 'demo' })
  })

  it('refuses a file over the size limit before parsing it, counted in UTF-8 bytes', () => {
    expect(readImport(' '.repeat(IMPORT_MAX_BYTES + 1))).toEqual({ status: 'refused', problem: 'tooLarge' })
    // "é" is 1 UTF-16 code unit but 2 UTF-8 bytes: half the limit plus one in characters is over it.
    expect(readImport('é'.repeat(IMPORT_MAX_BYTES / 2 + 1))).toEqual({ status: 'refused', problem: 'tooLarge' })
    // Exactly at the limit is not refused for size (it is refused as not a log).
    expect(readImport(' '.repeat(IMPORT_MAX_BYTES))).toMatchObject({ status: 'refused', problem: 'unreadable' })
  })
})

describe('replaceOwnLog saves a confirmed import', () => {
  it('replaces your own log and leaves the demo and the active key alone', () => {
    const demo = serializeLog(startDemo(0))
    const store = storeWith({ [K.demo]: demo, [K.active]: 'demo', [K.mine]: serializeLog(emptyLog()) })
    expect(replaceOwnLog(mineDoc(), store)).toEqual({ ok: true })
    expect(JSON.parse(store.getItem(K.mine) as string)).toStrictEqual(V1_MINE)
    expect(store.getItem(K.demo)).toBe(demo)
    expect(store.getItem(K.active)).toBe('demo')
  })

  it('never replaces a saved copy this version cannot read, or one from a newer version', () => {
    for (const raw of ['{"version":1,"kind":"mine","meals":[', JSON.stringify({ ...V1_MINE, version: 99 })]) {
      const store = storeWith({ [K.mine]: raw })
      expect(replaceOwnLog(mineDoc(), store)).toEqual({ ok: false, reason: 'storedUnreadable' })
      expect(store.getItem(K.mine)).toBe(raw)
    }
  })

  it('says so when the device will not save, and what was saved stays', () => {
    const before = serializeLog(emptyLog())
    const store = new FullStore()
    store.data.set(K.mine, before)
    expect(replaceOwnLog(mineDoc(), store)).toEqual({ ok: false, reason: 'notSaved' })
    expect(store.getItem(K.mine)).toBe(before)
    expect(replaceOwnLog(mineDoc(), null)).toEqual({ ok: false, reason: 'notSaved' })
  })

  it('refuses a demo document outright', () => {
    expect(() => replaceOwnLog(startDemo(0), new MemoryStore())).toThrow()
  })
})

describe('Delete', () => {
  it('removes your own log and its backups, and nothing else', () => {
    const demo = serializeLog(startDemo(0))
    const demoBackup = backupKey(K.demo, 0)
    const store = storeWith({
      [K.mine]: V1_MINE_TEXT,
      [backupKey(K.mine, 0)]: 'old 1',
      [backupKey(K.mine, 0, 2)]: 'old 2',
      [K.demo]: demo,
      [demoBackup]: 'old demo',
      [K.active]: 'mine',
      'someone.else': 'kept',
    })
    const res = deleteOwnLog(store)
    expect(res).toEqual({
      ok: true,
      removed: ['howsure.mine.v1', 'howsure.mine.v1.backup-v0', 'howsure.mine.v1.backup-v0-2'],
      left: [],
    })
    expect(store.snapshot()).toEqual({ [K.demo]: demo, [demoBackup]: 'old demo', [K.active]: 'mine', 'someone.else': 'kept' })
    // A reload then shows an empty own log: nothing saved under the key.
    expect(loadLog('mine', store)).toEqual({ status: 'missing' })
  })

  it('removes a saved copy this version cannot read, once asked', () => {
    const store = storeWith({ [K.mine]: 'not json' })
    expect(deleteOwnLog(store).ok).toBe(true)
    expect(store.getItem(K.mine)).toBeNull()
  })

  it('with nothing saved, it still succeeds', () => {
    expect(deleteOwnLog(new MemoryStore())).toEqual({ ok: true, removed: ['howsure.mine.v1'], left: [] })
  })

  it('reports what it could not remove', () => {
    const store = new StuckStore()
    store.data.set(K.mine, V1_MINE_TEXT)
    expect(deleteOwnLog(store)).toEqual({ ok: false, removed: [], left: ['howsure.mine.v1'] })
    expect(deleteOwnLog(null)).toEqual({ ok: false, removed: [], left: ['howsure.mine.v1'] })
  })
})

describe('export, delete, import returns the identical log (item 1.2 done-when)', () => {
  it('round-trips the frozen own log through the store', () => {
    const store = storeWith({ [K.mine]: V1_MINE_TEXT, [K.active]: 'mine' })
    const loaded = loadLog('mine', store)
    if (loaded.status !== 'ok') throw new Error('fixture did not load')

    const file = exportOwnLog(loaded.doc, null, store)
    expect(deleteOwnLog(store).ok).toBe(true)
    expect(store.getItem(K.mine)).toBeNull()

    const read = readImport(file)
    if (read.status !== 'ok') throw new Error('export did not import')
    expect(replaceOwnLog(read.doc, store)).toEqual({ ok: true })

    expect(JSON.parse(store.getItem(K.mine) as string)).toStrictEqual(V1_MINE)
    const again = loadLog('mine', store)
    expect(again).toStrictEqual({ status: 'ok', doc: loaded.doc })
  })
})

describe('saved meals (build-out item 2.3) travel with the log', () => {
  /** Sam's own log with two saved meals: invented names and values. */
  function withSaved(): LogDoc {
    return {
      ...mineDoc(),
      savedMeals: [
        { id: 'saved-1', name: 'Usual oats', source: 'weighed', kcal: 410, protein: 14, carbs: 66, fat: 9, savedAt: '2026-10-28T20:00:00-04:00' },
        {
          id: 'saved-2',
          name: 'Office samosa',
          source: null,
          kcal: null,
          protein: null,
          carbs: null,
          fat: null,
          note: 'Size varies',
          savedAt: '2026-10-28T20:05:00-04:00',
        },
      ],
    }
  }

  it('a log saved before saved meals existed loads with none, and saves back unchanged', () => {
    const store = storeWith({ [K.mine]: V1_MINE_TEXT })
    const loaded = loadLog('mine', store)
    if (loaded.status !== 'ok') throw new Error('fixture did not load')
    expect('savedMeals' in loaded.doc).toBe(false)
    expect(JSON.parse(serializeLog(loaded.doc))).toStrictEqual(V1_MINE)
  })

  it('export, delete, import keeps every saved meal, field for field', () => {
    const store = new MemoryStore()
    expect(saveLog(withSaved(), store)).toBe(true)
    const file = exportOwnLog(withSaved(), null, store)
    expect(JSON.parse(file).savedMeals).toHaveLength(2)
    expect(deleteOwnLog(store).ok).toBe(true)
    const read = readImport(file)
    if (read.status !== 'ok') throw new Error('export did not import')
    expect(read.doc.savedMeals).toStrictEqual(withSaved().savedMeals)
    expect(read.summary.savedMeals).toBe(2)
    expect(replaceOwnLog(read.doc, store)).toEqual({ ok: true })
    expect(loadLog('mine', store)).toStrictEqual({ status: 'ok', doc: withSaved() })
  })

  it('refuses a saved meal with known calories and no source, as it does a logged meal', () => {
    const bad = { ...V1_MINE, savedMeals: [{ id: 's', name: 'Oats', source: null, kcal: 300, protein: null, carbs: null, fat: null, savedAt: '2026-10-28T20:00:00-04:00' }] }
    const read = readImport(JSON.stringify(bad))
    expect(read).toMatchObject({ status: 'refused', problem: 'unreadable' })
    if (read.status === 'refused') expect(read.detail).toContain('savedMeals.0.source')
  })

  it('refuses a saved meal with no name or a time with no offset', () => {
    const one = withSaved().savedMeals![0]
    for (const s of [{ ...one, name: '' }, { ...one, savedAt: '2026-10-28T20:00:00' }]) {
      expect(readImport(JSON.stringify({ ...V1_MINE, savedMeals: [s] }))).toMatchObject({ status: 'refused', problem: 'unreadable' })
    }
  })
})

describe('weigh-ins (build-out item 2.4) travel with the log', () => {
  /** Sam's own log with three made-up weigh-ins: one in lb with body fat, one with a note, one imported with an approximate time. */
  function withWeighIns(): LogDoc {
    return {
      ...mineDoc(),
      settings: { weightUnit: 'lb', connectorOn: false },
      weighIns: [
        { id: 'weigh-mine-1', at: '2026-10-29T07:30:00-04:00', kg: 72.4 },
        { id: 'weigh-2', at: '2026-10-30T07:05:00-04:00', kg: 160 * 0.45359237, unit: 'lb', bodyFatPct: 19.5 },
        { id: 'weigh-3', at: '2026-10-31T07:20:00-04:00', kg: 72.1, unit: 'kg', note: 'After a run' },
        {
          id: 'weighin-tracker-2026-11-01',
          at: '2026-11-01T12:00:00-05:00',
          kg: 159.2 * 0.45359237,
          unit: 'lb',
          timeApproximate: true,
          imported: { date: '2026-11-01', lb: 159.2 },
        },
      ],
    }
  }

  it('the frozen v1 log keeps its weigh-in as written, with no fields added', () => {
    const read = readImport(V1_MINE_TEXT)
    if (read.status !== 'ok') throw new Error('fixture did not import')
    expect(read.doc.weighIns).toStrictEqual([{ id: 'weigh-mine-1', at: '2026-10-29T07:30:00-04:00', kg: 72.4 }])
    expect(JSON.parse(serializeLog(read.doc))).toStrictEqual(V1_MINE)
  })

  it('export, delete, import keeps every weigh-in and the unit preference, field for field', () => {
    const store = new MemoryStore()
    expect(saveLog(withWeighIns(), store)).toBe(true)
    const file = exportOwnLog(withWeighIns(), null, store)
    expect(JSON.parse(file).weighIns).toHaveLength(4)
    expect(deleteOwnLog(store).ok).toBe(true)
    const read = readImport(file)
    if (read.status !== 'ok') throw new Error('export did not import')
    expect(read.doc.weighIns).toStrictEqual(withWeighIns().weighIns)
    expect(read.doc.settings).toStrictEqual({ weightUnit: 'lb', connectorOn: false })
    expect(read.summary.weighIns).toBe(4)
    expect(read.summary.last).toBe('2026-11-03T23:30:00+00:00')
    expect(replaceOwnLog(read.doc, store)).toEqual({ ok: true })
    expect(loadLog('mine', store)).toStrictEqual({ status: 'ok', doc: withWeighIns() })
  })

  it('a log with no weigh-ins loads with none', () => {
    const { weighIns: _w, ...rest } = V1_MINE
    const read = readImport(JSON.stringify(rest))
    if (read.status !== 'ok') throw new Error('did not import')
    expect('weighIns' in read.doc).toBe(false)
    expect(read.summary.weighIns).toBe(0)
  })

  it('refuses a weigh-in with no weight, a weight of 0, a time with no offset, an odd unit or body fat outside 0–100', () => {
    const one = { id: 'w', at: '2026-10-29T07:30:00-04:00', kg: 72.4 }
    const bad = [
      { id: 'w', at: one.at },
      { ...one, kg: 0 },
      { ...one, kg: -70 },
      { ...one, at: '2026-10-29T07:30:00' },
      { ...one, unit: 'stone' },
      { ...one, bodyFatPct: 0 },
      { ...one, bodyFatPct: 100 },
    ]
    for (const w of bad) {
      expect(readImport(JSON.stringify({ ...V1_MINE, weighIns: [w] }))).toMatchObject({ status: 'refused', problem: 'unreadable' })
    }
    expect(readImport(JSON.stringify({ ...V1_MINE, settings: { weightUnit: 'stone' } }))).toMatchObject({ status: 'refused' })
  })
})

// Build-out item 2.1b: Import also takes an export of the owner's earlier tracker, told apart by
// shape, and keeps a backup of the log it replaces. The bundle here is the fictional one for Sam.
const TRACKER_TEXT = readFileSync(fileURLToPath(new URL('../../../fixtures/tracker-bundle-sam.json', import.meta.url)), 'utf8')

describe('Import takes a tracker bundle (build-out item 2.1b)', () => {
  it('converts it, with the report for the preview and a summary like any log', () => {
    const read = readImport(TRACKER_TEXT)
    if (read.status !== 'ok') throw new Error('refused')
    expect(read.tracker).toMatchObject({ meals: 19, nights: 5, days: 5, untagged: 3, truncated: 2 })
    expect(read.summary).toMatchObject({ name: '', meals: 19, nights: 5, workouts: 0, plates: 0 })
    expect(read.doc.kind).toBe('mine')
    // A HowSure export carries no tracker report.
    const own = readImport(V1_MINE_TEXT)
    expect(own.status === 'ok' && own.tracker).toBe(undefined)
  })

  it('refuses a bundle of another version, or the wrong shape, and says it is a tracker file', () => {
    const json = JSON.parse(TRACKER_TEXT)
    expect(readImport(JSON.stringify({ ...json, formatVersion: 3 }))).toMatchObject({ status: 'refused', problem: 'trackerVersion' })
    expect(readImport(JSON.stringify({ ...json, sleep: {} }))).toMatchObject({ status: 'refused', problem: 'trackerUnreadable' })
    // Neither a bundle nor a log: the plain "couldn't read this file as a log".
    expect(readImport(JSON.stringify({ format: 'something-else', meals: [] }))).toMatchObject({ status: 'refused', problem: 'unreadable' })
  })

  it('refuses a bundle from which nothing survives, so importing it never just empties your log', () => {
    const json = JSON.parse(TRACKER_TEXT)
    const undated = json.meals.map((m: { data: object }) => ({ ...m, data: { ...m.data, date: 'someday' } }))
    const empty = { ...json, meals: undated, sleep: [], weighins: [] }
    expect(readImport(JSON.stringify(empty))).toEqual({ status: 'refused', problem: 'trackerEmpty' })
    // One weigh-in is still something to keep for the weight log.
    const read = readImport(JSON.stringify({ ...empty, weighins: json.weighins.slice(0, 1) }))
    expect(read).toMatchObject({ status: 'ok', summary: { meals: 0, nights: 0 }, tracker: { weighins: 1 } })
  })

  it('round-trips through Save, Export and Import with everything the import kept', () => {
    const read = readImport(TRACKER_TEXT)
    if (read.status !== 'ok') throw new Error('refused')
    const store = new MemoryStore()
    expect(replaceOwnLog(read.doc, store)).toEqual({ ok: true })
    const loaded = loadLog('mine', store)
    if (loaded.status !== 'ok') throw new Error('not loaded')
    expect(loaded.doc).toStrictEqual(read.doc)
    const exported = exportOwnLog(loaded.doc, null, store)
    const again = readImport(exported)
    if (again.status !== 'ok') throw new Error('export not importable')
    expect(again.tracker).toBeUndefined()
    expect(again.doc).toStrictEqual(read.doc)
    const meal = again.doc.meals.find((m) => m.id === 'tracker-3000112')
    expect(meal).toMatchObject({ timeApproximate: true, imported: { from: 'tracker', truncated: true, code: 'PHOTO_CTX' } })
    expect(meal?.typicalError).toBeCloseTo(0.29, 12)
    // The weigh-ins are in the weight log, and come back field for field.
    expect(again.doc.weighIns).toHaveLength(2)
    expect(again.doc.weighIns).toStrictEqual(read.doc.weighIns)
    expect(again.summary.weighIns).toBe(2)
  })
})

describe('replaceOwnLog keeps a backup of the log it replaces (build-out item 2.1b)', () => {
  it('keeps the saved text under a backup key first, listed with the older copies', () => {
    const before = serializeLog(mineDoc())
    const store = storeWith({ [K.mine]: before })
    const res = replaceOwnLog(emptyLog(), store)
    expect(res).toEqual({ ok: true, backupKey: backupKey(K.mine, SCHEMA_VERSION) })
    expect(store.getItem(backupKey(K.mine, SCHEMA_VERSION))).toBe(before)
    expect(store.writes.indexOf(backupKey(K.mine, SCHEMA_VERSION))).toBeLessThan(store.writes.lastIndexOf(K.mine))
    expect(listBackups(store, K.mine)).toEqual([{ key: backupKey(K.mine, SCHEMA_VERSION), text: before }])
    // Delete removes it with the log.
    expect(deleteOwnLog(store).removed).toContain(backupKey(K.mine, SCHEMA_VERSION))
  })

  it('a second import keeps a second backup, never writing over the first', () => {
    const first = serializeLog(mineDoc())
    const store = storeWith({ [K.mine]: first })
    const other = { ...mineDoc(), meals: [] }
    expect(replaceOwnLog(other, store)).toMatchObject({ ok: true })
    expect(replaceOwnLog(emptyLog(), store)).toEqual({ ok: true, backupKey: backupKey(K.mine, SCHEMA_VERSION, 2) })
    expect(store.getItem(backupKey(K.mine, SCHEMA_VERSION))).toBe(first)
    expect(store.getItem(backupKey(K.mine, SCHEMA_VERSION, 2))).toBe(serializeLog(other))
  })

  it('importing the same file again over itself adds no second backup', () => {
    const read = readImport(TRACKER_TEXT)
    if (read.status !== 'ok') throw new Error('refused')
    const store = storeWith({ [K.mine]: serializeLog(mineDoc()) })
    expect(replaceOwnLog(read.doc, store)).toEqual({ ok: true, backupKey: backupKey(K.mine, SCHEMA_VERSION) })
    // The second import backs up the imported log; a third finds that same text already kept.
    expect(replaceOwnLog(read.doc, store)).toEqual({ ok: true, backupKey: backupKey(K.mine, SCHEMA_VERSION, 2) })
    expect(replaceOwnLog(read.doc, store)).toEqual({ ok: true, backupKey: backupKey(K.mine, SCHEMA_VERSION, 2) })
    expect(backupKeys(store, K.mine)).toHaveLength(2)
  })

  it('keeps no backup of an empty log or of nothing saved', () => {
    const store = storeWith({ [K.mine]: serializeLog(emptyLog()) })
    expect(replaceOwnLog(mineDoc(), store)).toEqual({ ok: true })
    expect(backupKeys(store, K.mine)).toEqual([])
    const fresh = new MemoryStore()
    expect(replaceOwnLog(mineDoc(), fresh)).toEqual({ ok: true })
    expect(backupKeys(fresh, K.mine)).toEqual([])
  })

  it('replaces nothing when the backup cannot be written', () => {
    const before = serializeLog(mineDoc())
    const store = new FullStore()
    store.data.set(K.mine, before)
    expect(replaceOwnLog(emptyLog(), store)).toEqual({ ok: false, reason: 'notBackedUp' })
    expect(store.getItem(K.mine)).toBe(before)
  })
})
