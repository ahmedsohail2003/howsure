// spec.md > Store: each log is one JSON document under its own localStorage key, so the
// demo and your own log never mix. Every change writes the whole document, synchronously,
// inside try/catch. A document that fails to parse is reported ("Couldn't read saved data")
// and left exactly as it is: it is never silently wiped.
//
// Build-out item 1.1: a document saved in an older format version is upgraded on load
// (src/store/migrations.ts). Before the upgraded document is written back, the original text is
// kept under a backup key (keys.ts > backupKey). Backups are never pruned by the app: they stay
// until the person deletes their data. A document from a newer version is never written over.
//
// Every function takes the Storage to use, so the unit tests can pass an in-memory one, and
// the keys to use (default: this build's namespace, keys.ts).

import type { LogKind } from '../clock'
import type { Meal, SleepRecord } from '../kernel/types'
import { backupKey, storageKeys, type StorageKeys } from './keys'
import type { LogDoc } from './log'
import { MIGRATIONS, upgradeDoc, versionOf, type Migrations } from './migrations'
import { logDocSchema, SCHEMA_VERSION } from './schema'

/** This build's storage namespace (README > Test storage). Unset: the default keys. */
export const STORAGE_NAMESPACE: string | undefined = import.meta.env?.VITE_HOWSURE_STORAGE_NS

/** The keys this build reads and writes. */
export const KEYS: StorageKeys = storageKeys(STORAGE_NAMESPACE)

export const STORAGE_KEYS: Record<LogKind, string> = {
  demo: KEYS.demo,
  mine: KEYS.mine,
}

/**
 * Which log was open last, so a reload returns to it (spec.md > The Core Journey, step 7).
 * The spec leaves "which log is active" unnamed; it is kept apart from both documents so
 * switching never writes to either of them.
 */
export const ACTIVE_KEY = KEYS.active

/** The minimal Storage surface used here (window.localStorage in the app). */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type LoadResult =
  | { status: 'missing' }
  /**
   * `upgradedFrom`: the format version the stored document was in, when it was upgraded on this
   * load. `saveBlocked`: the original text couldn't be backed up, so neither the upgraded
   * document nor any later change may be written over it.
   */
  | { status: 'ok'; doc: LogDoc; upgradedFrom?: number; saveBlocked?: boolean }
  /** Saved by a newer version of HowSure: left as it is and never written over. */
  | { status: 'newer'; version: number }
  | { status: 'unreadable'; reason: string }

export interface LoadOptions {
  keys?: StorageKeys
  /** The upgrade steps; tests pass their own to exercise the machinery. */
  migrations?: Migrations
}

/** window.localStorage, or null when the browser blocks it (reading the property can throw). */
export function browserStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** True when a test value can be written and removed. False when storage is blocked or full. */
export function storageWorks(store: KeyValueStore | null = browserStore(), keys: StorageKeys = KEYS): boolean {
  if (!store) return false
  try {
    store.setItem(keys.probe, '1')
    store.removeItem(keys.probe)
    return true
  } catch {
    return false
  }
}

function readRaw(store: KeyValueStore | null, key: string): string | null {
  if (!store) return null
  try {
    return store.getItem(key)
  } catch {
    return null
  }
}

/**
 * Keep `raw` under the first free backup key for this upgrade. Returns false when it can't be
 * written (then nothing may be written over the original).
 */
export function writeBackup(store: KeyValueStore, docKey: string, fromVersion: number, raw: string): boolean {
  try {
    for (let n = 1; n < 1000; n++) {
      const key = backupKey(docKey, fromVersion, n)
      const existing = store.getItem(key)
      if (existing === raw) return true
      if (existing === null) {
        store.setItem(key, raw)
        return store.getItem(key) === raw
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Read one log. A missing key is 'missing'; a newer format version is 'newer'; bad JSON, no
 * usable version, a failed upgrade or a schema failure is 'unreadable'. In each of those the
 * stored text is left exactly as it was.
 */
export function loadLog(kind: LogKind, store: KeyValueStore | null = browserStore(), opts: LoadOptions = {}): LoadResult {
  const keys = opts.keys ?? KEYS
  const key = keys[kind]
  const raw = readRaw(store, key)
  if (raw === null) return { status: 'missing' }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { status: 'unreadable', reason: 'not JSON' }
  }

  const up = upgradeDoc(json, SCHEMA_VERSION, opts.migrations ?? MIGRATIONS)
  if (up.status === 'newer') return { status: 'newer', version: up.version }
  if (up.status === 'noVersion') return { status: 'unreadable', reason: 'no format version' }
  if (up.status === 'noStep') return { status: 'unreadable', reason: `no upgrade from version ${up.at}` }
  if (up.status === 'failed') return { status: 'unreadable', reason: `upgrade from version ${up.at} failed: ${up.reason}` }

  const parsed = logDocSchema.safeParse(up.doc)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { status: 'unreadable', reason: first ? `${first.path.join('.')}: ${first.message}` : 'invalid' }
  }
  if (parsed.data.kind !== kind) return { status: 'unreadable', reason: `kind ${parsed.data.kind} under the ${kind} key` }
  const { version: _version, ...rest } = parsed.data
  const doc: LogDoc = {
    ...rest,
    kind,
    meals: rest.meals as Meal[],
    sleeps: rest.sleeps as SleepRecord[],
  }
  if (up.status === 'current') return { status: 'ok', doc }

  // Upgraded: keep the original text first, then write the upgraded document over it. If the
  // backup can't be written, the original stays as the only stored copy and nothing replaces it.
  if (!store || !writeBackup(store, key, up.from, raw)) {
    return { status: 'ok', doc, upgradedFrom: up.from, saveBlocked: true }
  }
  saveLog(doc, store, keys)
  return { status: 'ok', doc, upgradedFrom: up.from }
}

/** The document as stored: the log plus its schema version. */
export function serializeLog(doc: LogDoc): string {
  const stored = { version: SCHEMA_VERSION, ...doc }
  // Validate before writing, so a bug can't put a document on the device that the next load rejects.
  const checked = logDocSchema.parse(stored)
  return JSON.stringify(checked)
}

/** True when the stored text under `key` is a document from a newer format version. */
function storedIsNewer(store: KeyValueStore, key: string): boolean {
  const raw = store.getItem(key)
  if (raw === null) return false
  try {
    const v = versionOf(JSON.parse(raw))
    return v !== null && v > SCHEMA_VERSION
  } catch {
    return false
  }
}

/**
 * Write the whole document. Returns false when the device won't save (blocked or full), and
 * when the stored copy was written by a newer version of HowSure (e.g. in another tab), which
 * is never written over.
 */
export function saveLog(doc: LogDoc, store: KeyValueStore | null = browserStore(), keys: StorageKeys = KEYS): boolean {
  if (!store) return false
  const key = keys[doc.kind]
  try {
    if (storedIsNewer(store, key)) return false
    store.setItem(key, serializeLog(doc))
    return true
  } catch (err) {
    // Blocked or full storage, or (a bug) a document the schema rejects: either way nothing is
    // written, the saved copy stays as it was, and the app keeps working in memory.
    if (err instanceof Error && err.name === 'ZodError') console.error('HowSure: not saved, invalid document', err)
    return false
  }
}

export function loadActive(store: KeyValueStore | null = browserStore(), keys: StorageKeys = KEYS): LogKind | null {
  const raw = readRaw(store, keys.active)
  return raw === 'demo' || raw === 'mine' ? raw : null
}

export function saveActive(kind: LogKind, store: KeyValueStore | null = browserStore(), keys: StorageKeys = KEYS): boolean {
  if (!store) return false
  try {
    store.setItem(keys.active, kind)
    return true
  } catch {
    return false
  }
}
