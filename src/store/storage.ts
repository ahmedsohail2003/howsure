// spec.md > Store: each log is one JSON document under its own localStorage key, so the
// demo and your own log never mix. Every change writes the whole document, synchronously,
// inside try/catch. A document that fails to parse is reported ("Couldn't read saved data")
// and left exactly as it is: it is never silently wiped.
//
// Every function takes the Storage to use, so the unit tests can pass an in-memory one.

import type { LogKind } from '../clock'
import type { Meal, SleepRecord } from '../kernel/types'
import type { LogDoc } from './log'
import { logDocSchema, SCHEMA_VERSION } from './schema'

export const STORAGE_KEYS: Record<LogKind, string> = {
  demo: 'howsure.demo.v1',
  mine: 'howsure.mine.v1',
}

/**
 * Which log was open last, so a reload returns to it (spec.md > The Core Journey, step 7).
 * The spec leaves "which log is active" unnamed; it is kept apart from both documents so
 * switching never writes to either of them.
 */
export const ACTIVE_KEY = 'howsure.active.v1'

/** The minimal Storage surface used here (window.localStorage in the app). */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type LoadResult =
  | { status: 'missing' }
  | { status: 'ok'; doc: LogDoc }
  | { status: 'unreadable'; reason: string }

/** window.localStorage, or null when the browser blocks it (reading the property can throw). */
export function browserStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** True when a test value can be written and removed. False when storage is blocked or full. */
export function storageWorks(store: KeyValueStore | null = browserStore()): boolean {
  if (!store) return false
  const probe = 'howsure.probe'
  try {
    store.setItem(probe, '1')
    store.removeItem(probe)
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

/** Read one log. A missing key is 'missing'; bad JSON or a schema failure is 'unreadable'. */
export function loadLog(kind: LogKind, store: KeyValueStore | null = browserStore()): LoadResult {
  const raw = readRaw(store, STORAGE_KEYS[kind])
  if (raw === null) return { status: 'missing' }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { status: 'unreadable', reason: 'not JSON' }
  }
  const parsed = logDocSchema.safeParse(json)
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
  return { status: 'ok', doc }
}

/** The document as stored: the log plus its schema version. */
export function serializeLog(doc: LogDoc): string {
  const stored = { version: SCHEMA_VERSION, ...doc }
  // Validate before writing, so a bug can't put a document on the device that the next load rejects.
  const checked = logDocSchema.parse(stored)
  return JSON.stringify(checked)
}

/** Write the whole document. Returns false when the device won't save (blocked or full). */
export function saveLog(doc: LogDoc, store: KeyValueStore | null = browserStore()): boolean {
  if (!store) return false
  try {
    store.setItem(STORAGE_KEYS[doc.kind], serializeLog(doc))
    return true
  } catch (err) {
    // Blocked or full storage, or (a bug) a document the schema rejects: either way nothing is
    // written, the saved copy stays as it was, and the app keeps working in memory.
    if (err instanceof Error && err.name === 'ZodError') console.error('HowSure: not saved, invalid document', err)
    return false
  }
}

export function loadActive(store: KeyValueStore | null = browserStore()): LogKind | null {
  const raw = readRaw(store, ACTIVE_KEY)
  return raw === 'demo' || raw === 'mine' ? raw : null
}

export function saveActive(kind: LogKind, store: KeyValueStore | null = browserStore()): boolean {
  if (!store) return false
  try {
    store.setItem(ACTIVE_KEY, kind)
    return true
  } catch {
    return false
  }
}
