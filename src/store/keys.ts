// Where each log lives in localStorage. Pure (no Vite, no browser), so Playwright and the unit
// tests can import it too.
//
// The default keys are the ones every saved log already uses. They never change: renaming one
// would hide every log saved under the old name. The ".v1" in a key name is the key's own
// generation, not the document's format version (that is the `version` field inside the
// document, see src/store/migrations.ts), so a format upgrade keeps the same key.
//
// A namespace gives a test run or a dev session its own keys in the same browser origin, so it
// never reads or writes the logs saved under the default keys. It is chosen at build time with
// VITE_HOWSURE_STORAGE_NS (src/store/storage.ts reads it; README > Test storage).

export interface StorageKeys {
  demo: string
  mine: string
  /** Which log was open last (spec.md > The Core Journey, step 7). */
  active: string
  /** Written and removed again to check that the device will save. */
  probe: string
  /**
   * The chosen look (build-out item 1.5.2; src/store/look.ts). A device preference, kept apart
   * from both log documents, so the demo and your own log share it and Export, Import and
   * Delete of a log leave it alone.
   */
  look: string
}

export const DEFAULT_KEYS: Readonly<StorageKeys> = Object.freeze({
  demo: 'howsure.demo.v1',
  mine: 'howsure.mine.v1',
  active: 'howsure.active.v1',
  probe: 'howsure.probe',
  look: 'howsure.look.v1',
})

/** Lower-case letters, digits and dashes, 1 to 32 long, starting with a letter or digit. No dots,
 * so a namespaced key can never equal a default key or a backup key. */
export const NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

/**
 * The keys for a namespace. No namespace (undefined, null, or blank) gives the default keys.
 * A namespace that doesn't fit NAMESPACE_PATTERN throws instead of falling back to the default
 * keys, because falling back would point a test run at the real logs.
 */
export function storageKeys(namespace?: string | null): StorageKeys {
  const ns = (namespace ?? '').trim()
  if (ns === '') return { ...DEFAULT_KEYS }
  if (!NAMESPACE_PATTERN.test(ns)) {
    throw new Error(
      `HowSure: storage namespace "${ns}" must be 1-32 lower-case letters, digits or dashes (VITE_HOWSURE_STORAGE_NS)`,
    )
  }
  return {
    demo: `howsure.${ns}.demo.v1`,
    mine: `howsure.${ns}.mine.v1`,
    active: `howsure.${ns}.active.v1`,
    probe: `howsure.${ns}.probe`,
    look: `howsure.${ns}.look.v1`,
  }
}

/**
 * Where the original text of a log is kept before an upgrade from `fromVersion` writes over it,
 * e.g. "howsure.mine.v1.backup-v1". When that key already holds different text, the next free
 * one is used ("...backup-v1-2", "...backup-v1-3"), so one backup never replaces another.
 */
export function backupKey(docKey: string, fromVersion: number, n = 1): string {
  return n <= 1 ? `${docKey}.backup-v${fromVersion}` : `${docKey}.backup-v${fromVersion}-${n}`
}
