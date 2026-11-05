// The browser tests run the app in their own storage namespace (playwright.config.ts sets
// VITE_HOWSURE_STORAGE_NS), so they never read or write logs saved under the default keys in
// the same browser origin (build-out item 1.1).
import { storageKeys } from '../../src/store/keys'

export const E2E_NAMESPACE = 'e2e'

export const E2E_KEYS = storageKeys(E2E_NAMESPACE)
