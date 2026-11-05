// Saved logs upgrade safely (build-out item 1.1). Every log document carries the format
// `version` it was written in. On load, the raw JSON is upgraded one version at a time
// (v1 -> v2 -> ... -> SCHEMA_VERSION) and only then validated by the current zod schema, so a
// format change never makes an older log unreadable.
//
// Adding a format version (bumping SCHEMA_VERSION in src/store/schema.ts) takes three things,
// and src/store/__tests__/migrations.test.ts fails until all three exist:
//   1. a step here, keyed by the version it upgrades FROM: MIGRATIONS[n] turns a vN document
//      into a v(N+1) one;
//   2. frozen fixtures fixtures/saved/v(N+1)-demo.json and v(N+1)-mine.json: the vN fixtures
//      rewritten by hand in the new format, nothing lost (fixtures/saved/README.md);
//   3. their SHA-256 in that test's FROZEN list, so no fixture is edited afterwards.
//
// Rules for a step: it gets its own copy of the document, keeps every key it doesn't change
// (unknown keys belong to later versions or later features), and never drops data. The runner
// sets `version` itself after each step.
//
// A document from a newer version than this app, or with no usable version, is never upgraded
// or written over: the loader reports it and leaves the stored text as it is.

import { SCHEMA_VERSION } from './schema'

export type StoredJson = Record<string, unknown>

/** One step: a document in version `from` (the key) to version `from + 1`. */
export type Migration = (doc: StoredJson) => StoredJson

export type Migrations = Readonly<Record<number, Migration>>

/** v1 is the first saved format, so there are no steps yet. */
export const MIGRATIONS: Migrations = Object.freeze({})

export type UpgradeResult =
  /** Already in the target version; `doc` is the input. */
  | { status: 'current'; doc: StoredJson }
  /** Upgraded from `from`; `doc` is a new object, the input is untouched. */
  | { status: 'upgraded'; doc: StoredJson; from: number }
  /** Written by a newer version of HowSure than this one. */
  | { status: 'newer'; version: number }
  /** Not an object, or no whole-number version of at least 0. */
  | { status: 'noVersion' }
  /** An older version with no step from `at`. */
  | { status: 'noStep'; at: number }
  /** The step from `at` threw or returned something that isn't a document. */
  | { status: 'failed'; at: number; reason: string }

function isObj(v: unknown): v is StoredJson {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** The document's format version, or null when there isn't a usable one. */
export function versionOf(json: unknown): number | null {
  if (!isObj(json)) return null
  const v = json.version
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null
}

/** Run the steps from the document's version up to `target`. Pure: nothing is read or written. */
export function upgradeDoc(
  json: unknown,
  target: number = SCHEMA_VERSION,
  steps: Migrations = MIGRATIONS,
): UpgradeResult {
  const from = versionOf(json)
  if (from === null || !isObj(json)) return { status: 'noVersion' }
  if (from > target) return { status: 'newer', version: from }
  if (from === target) return { status: 'current', doc: json }

  let doc: StoredJson = structuredClone(json)
  for (let v = from; v < target; v++) {
    const step = Object.hasOwn(steps, v) ? steps[v] : undefined
    if (!step) return { status: 'noStep', at: v }
    let next: unknown
    try {
      next = step(doc)
    } catch (err) {
      return { status: 'failed', at: v, reason: err instanceof Error ? err.message : String(err) }
    }
    if (!isObj(next)) return { status: 'failed', at: v, reason: 'the step did not return a document' }
    doc = { ...next, version: v + 1 }
  }
  return { status: 'upgraded', doc, from }
}
