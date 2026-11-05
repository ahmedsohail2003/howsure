// Export, Import and Delete for your own log (build-out item 1.2: slice 13's core, plus Import,
// which no slice owned). prd.md > Privacy Panel, spec.md > Store (Export / Delete).
//
// - Export downloads the stored document, version included, as one JSON file. It always works:
//   when the saved copy can't be read by this version (unreadable, or from a newer version), the
//   stored text is exported exactly as it is, so a person can always get their data out.
// - Import reads a file through the same pipeline as a stored log (storage.ts > parseLogText:
//   JSON, the upgrade steps, then the zod check), shows what it holds, and replaces your own log
//   only after an explicit confirmation. A file it can't read changes nothing.
// - Delete removes your own log and every backup kept for it by a format upgrade (keys.ts >
//   backupKey). The demo and the "which log was open" key are left alone.
// - When an upgraded log's original couldn't be backed up (problem 'notBackedUp'), the text under
//   the log's own key is the only copy of the original, so it is offered as an older copy for
//   Export and named in the Delete confirmation.
//
// Demo and own log stay apart (spec.md > Store > Switching): Export, Import and Delete act on
// your own log only. A file holding the fictional demo is refused by Import rather than turned
// into your own log, because converting it would drop its clock and relabel a made-up person's
// week as yours.
//
// Not built yet: the Claude connector's bridge (build-out item 3.3). spec.md > Store says Export
// adds the bridge's pending proposals and research, and Delete clears them (DELETE /snapshot,
// /proposals, /research, or settings.pendingBridgeClear when the bridge is down). The seams are
// marked "Bridge seam" below; nothing here pretends to do that part.

import type { LogDoc } from './log'
import type { LogProblem } from './session'
import type { StorageKeys } from './keys'
import { MIGRATIONS, type Migrations } from './migrations'
import { SCHEMA_VERSION } from './schema'
import {
  KEYS,
  parseLogText,
  readRaw,
  saveLog,
  serializeLog,
  type KeyValueStore,
  type ListableStore,
} from './storage'

/** Files larger than this (in UTF-8 bytes) are refused before they are parsed: a log this big can't be saved anyway. */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024

/** The text's size in UTF-8 bytes, without encoding it when the answer is clear from its length. */
function overImportLimit(text: string): boolean {
  // Each UTF-16 code unit takes 1 to 3 UTF-8 bytes.
  if (text.length > IMPORT_MAX_BYTES) return true
  if (text.length * 3 <= IMPORT_MAX_BYTES) return false
  return new TextEncoder().encode(text).length > IMPORT_MAX_BYTES
}

function ymd(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** "howsure-log-2026-11-05.json", from the local date. */
export function exportFileName(now: Date): string {
  return `howsure-log-${ymd(now)}.json`
}

/** "howsure-older-copies-2026-11-05.json", for the backups kept by format upgrades. */
export function backupsFileName(now: Date): string {
  return `howsure-older-copies-${ymd(now)}.json`
}

/**
 * The text Export downloads for your own log.
 * - Readable log: the document as stored (version first), indented so a person can open and read
 *   it. It is built from the log on screen, so changes the device couldn't save are included.
 * - Saved copy unreadable or from a newer version: the stored text, exactly as it is.
 * - Saved copy upgraded but not backed up ('notBackedUp'): the upgraded log on screen; the
 *   original older-format text goes in the older-copies file (olderCopies).
 * Bridge seam (item 3.3): pending proposals and research from the bridge join the file here.
 */
export function exportOwnLog(
  doc: LogDoc,
  problem: LogProblem | null,
  store: KeyValueStore | null,
  keys: StorageKeys = KEYS,
): string {
  if (problem === 'unreadable' || problem === 'newer') {
    const raw = readRaw(store, keys.mine)
    if (raw !== null) return raw
  }
  try {
    return `${JSON.stringify(JSON.parse(serializeLog(doc)), null, 2)}\n`
  } catch {
    // The log on screen fails the check (a bug). Export must still work: the stored text if
    // there is one, else the log as it is.
    const raw = readRaw(store, keys.mine)
    if (raw !== null) return raw
    return `${JSON.stringify({ version: SCHEMA_VERSION, ...doc }, null, 2)}\n`
  }
}

export interface StoredCopy {
  key: string
  text: string
}

/** The keys of the backups kept for a log by format upgrades (keys.ts > backupKey), sorted. Reads no values. */
export function backupKeys(store: ListableStore | null, docKey: string): string[] {
  if (!store) return []
  const prefix = `${docKey}.backup-v`
  const out: string[] = []
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key !== null && key.startsWith(prefix) && /^\d+(-\d+)?$/.test(key.slice(prefix.length))) out.push(key)
    }
  } catch {
    // Blocked part-way: what was found so far.
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/** The backups kept for a log by format upgrades (keys.ts > backupKey), sorted by key. */
export function listBackups(store: ListableStore | null, docKey: string): StoredCopy[] {
  const out: StoredCopy[] = []
  for (const key of backupKeys(store, docKey)) {
    const text = readRaw(store, key)
    if (text !== null) out.push({ key, text })
  }
  return out
}

/**
 * True when your own log's saved copy is the only copy of its older-format text: it was upgraded
 * on screen, but its original couldn't be backed up first (problem 'notBackedUp'), so the text
 * under the log's own key is still the original. Export then offers it as an older copy, and the
 * Delete confirmation names it, so following "export, then delete" never loses it.
 */
export function keepsOriginal(problem: LogProblem | null, store: KeyValueStore | null, keys: StorageKeys = KEYS): boolean {
  return problem === 'notBackedUp' && readRaw(store, keys.mine) !== null
}

/** What the older-copies Export holds, without reading any text: for the panel's button and Delete list. */
export interface OlderCopiesCount {
  /** Backups kept by format upgrades. */
  backups: number
  /** The original older-format text under the log's own key (see keepsOriginal). */
  original: boolean
}

export function countOlderCopies(
  problem: LogProblem | null,
  store: ListableStore | null,
  keys: StorageKeys = KEYS,
): OlderCopiesCount {
  return { backups: backupKeys(store, keys.mine).length, original: keepsOriginal(problem, store, keys) }
}

/**
 * Every older copy of your own log, for the second Export file: the original older-format text
 * first when it was never backed up (see keepsOriginal), then the backups.
 */
export function olderCopies(problem: LogProblem | null, store: ListableStore | null, keys: StorageKeys = KEYS): StoredCopy[] {
  const original = keepsOriginal(problem, store, keys) ? readRaw(store, keys.mine) : null
  const backups = listBackups(store, keys.mine)
  return original === null ? backups : [{ key: keys.mine, text: original }, ...backups]
}

/**
 * The second Export file, offered only when older copies exist: each one's stored text,
 * unchanged, under the key it is stored at.
 */
export function exportBackups(copies: StoredCopy[]): string {
  return `${JSON.stringify({ app: 'HowSure', olderCopies: copies }, null, 2)}\n`
}

export interface LogSummary {
  /** The guest name, or '' when there isn't one yet. */
  name: string
  meals: number
  /** Sleep records, each one night. */
  nights: number
  workouts: number
  plates: number
  /** The earliest and latest time in the log (meals and sleep), as stored; null when it has none. */
  first: string | null
  last: string | null
}

/** What a log holds, for the Import preview and the Delete confirmation. */
export function summarize(doc: LogDoc): LogSummary {
  const times: string[] = []
  for (const m of doc.meals) times.push(m.eatenAt)
  for (const s of doc.sleeps) {
    if (s.sleepStart) times.push(s.sleepStart)
    if (s.wake) times.push(s.wake)
  }
  let first: string | null = null
  let last: string | null = null
  for (const t of times) {
    const ms = Date.parse(t)
    if (Number.isNaN(ms)) continue
    if (first === null || ms < Date.parse(first)) first = t
    if (last === null || ms > Date.parse(last)) last = t
  }
  return {
    name: doc.profile.name,
    meals: doc.meals.length,
    nights: doc.sleeps.length,
    workouts: doc.workouts.length,
    plates: doc.plates.length,
    first,
    last,
  }
}

/**
 * Why Import refused a file. In every case nothing was changed.
 * - 'tooLarge': over IMPORT_MAX_BYTES;
 * - 'unreadable': not JSON, no usable version, a failed upgrade, or the zod check failed;
 * - 'newer': saved by a newer version of HowSure;
 * - 'demo': the fictional demo, not an own log.
 */
export type ImportProblem = 'tooLarge' | 'unreadable' | 'newer' | 'demo'

export type ImportRead =
  | { status: 'ok'; doc: LogDoc; summary: LogSummary; upgradedFrom?: number }
  | { status: 'refused'; problem: ImportProblem; detail?: string }

/** Read an Import file. Pure: nothing is written until replaceOwnLog. */
export function readImport(text: string, migrations: Migrations = MIGRATIONS): ImportRead {
  if (overImportLimit(text)) return { status: 'refused', problem: 'tooLarge' }
  // A UTF-8 byte order mark, as some editors save one, is not part of the JSON.
  const res = parseLogText(text.replace(/^\uFEFF/, ''), migrations)
  if (res.status === 'newer') return { status: 'refused', problem: 'newer', detail: `version ${res.version}` }
  if (res.status === 'unreadable') return { status: 'refused', problem: 'unreadable', detail: res.reason }
  if (res.doc.kind !== 'mine') return { status: 'refused', problem: 'demo' }
  return res.upgradedFrom === undefined
    ? { status: 'ok', doc: res.doc, summary: summarize(res.doc) }
    : { status: 'ok', doc: res.doc, summary: summarize(res.doc), upgradedFrom: res.upgradedFrom }
}

export type ReplaceResult =
  | { ok: true }
  /**
   * 'storedUnreadable': the saved copy can't be read by this version, so it is not replaced
   * (Export it, then Delete it, first). 'notSaved': the device wouldn't save.
   */
  | { ok: false; reason: 'storedUnreadable' | 'notSaved' }

/** Replace your own log with an imported one, after the person confirmed it. */
export function replaceOwnLog(
  doc: LogDoc,
  store: KeyValueStore | null,
  keys: StorageKeys = KEYS,
  migrations: Migrations = MIGRATIONS,
): ReplaceResult {
  if (doc.kind !== 'mine') throw new Error('HowSure: only your own log can be replaced by an import')
  const raw = readRaw(store, keys.mine)
  if (raw !== null && parseLogText(raw, migrations).status !== 'ok') return { ok: false, reason: 'storedUnreadable' }
  return saveLog(doc, store, keys) ? { ok: true } : { ok: false, reason: 'notSaved' }
}

export interface DeleteResult {
  /** True when nothing of your own log is left on the device. */
  ok: boolean
  removed: string[]
  /** Keys that couldn't be removed (blocked storage). */
  left: string[]
}

/**
 * Delete your own log: the document and every backup kept for it. The demo and the active-log
 * key are not touched, so a reload opens an empty own log.
 * Bridge seam (item 3.3): clear the bridge's snapshot, proposals and research here, or set
 * settings.pendingBridgeClear when it isn't running.
 */
export function deleteOwnLog(store: ListableStore | null, keys: StorageKeys = KEYS): DeleteResult {
  if (!store) return { ok: false, removed: [], left: [keys.mine] }
  const targets = [keys.mine, ...backupKeys(store, keys.mine)]
  const removed: string[] = []
  const left: string[] = []
  for (const key of targets) {
    try {
      store.removeItem(key)
      if (store.getItem(key) === null) removed.push(key)
      else left.push(key)
    } catch {
      left.push(key)
    }
  }
  return { ok: left.length === 0, removed, left }
}
