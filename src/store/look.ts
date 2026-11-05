// The chosen look (build-out item 1.5.2): how the dashboard is drawn. Every look shows the same
// numbers and offers the same actions; only the presentation differs.
//
// The look is a device preference, not part of a log. It is kept under its own key (keys.ts >
// look), outside both log documents, so:
//   - the demo and your own log share it (switching logs keeps the look you chose);
//   - Export, Import and Delete of your own log leave it alone (it is not your data, and an
//     imported log can't change how this device draws the app);
//   - a saved log never has to change format for it.
//
// A stored value that isn't a look this build has (unknown, unreadable, or a look not built yet)
// falls back to the default without crashing, and is left as it is. When storage is blocked the
// choice still applies for this visit, in memory. Pure apart from the Storage passed in.

import { KEYS, browserStore, readRaw, type KeyValueStore } from './storage'
import type { StorageKeys } from './keys'

/** Every look HowSure plans. Which of them this build offers is src/ui/looks.ts > LOOKS. */
export type Look = 'journal' | 'panel' | 'night'

/** Journal (direction A, the refined journal) is the default and always available. */
export const DEFAULT_LOOK: Look = 'journal'

/** The stored text as a look this build offers, or the default. */
export function readLook(raw: string | null, available: readonly Look[]): Look {
  return available.find((l) => l === raw) ?? DEFAULT_LOOK
}

/** The look saved on this device, or the default when none is saved or it can't be read. */
export function loadLook(
  available: readonly Look[],
  store: KeyValueStore | null = browserStore(),
  keys: StorageKeys = KEYS,
): Look {
  return readLook(readRaw(store, keys.look), available)
}

/** Save the look. False when the device won't save (blocked or full); the look still applies. */
export function saveLook(look: Look, store: KeyValueStore | null = browserStore(), keys: StorageKeys = KEYS): boolean {
  if (!store) return false
  try {
    store.setItem(keys.look, look)
    return true
  } catch {
    return false
  }
}
