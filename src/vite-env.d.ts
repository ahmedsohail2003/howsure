/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Storage namespace for test runs and dev sessions (src/store/keys.ts, README > Test storage). */
  readonly VITE_HOWSURE_STORAGE_NS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
