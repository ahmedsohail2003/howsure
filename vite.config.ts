import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { earlyLookScript } from './src/store/earlyLook.ts'
import { storageKeys } from './src/store/keys.ts'

/**
 * Build-out item 1.5.2c: puts src/store/earlyLook.ts's script at the end of index.html's <head>
 * (after the color-scheme meta tag it may change), so a reload in a dark look never flashes a
 * light page. It reads this build's look key, namespace included (src/store/keys.ts).
 */
function earlyLook(namespace: string | undefined): Plugin {
  return {
    name: 'howsure-early-look',
    transformIndexHtml() {
      return [{ tag: 'script', children: earlyLookScript(storageKeys(namespace).look), injectTo: 'head' }]
    },
  }
}

// 127.0.0.1, not localhost: on this machine localhost resolves to ::1 first.
// strictPort: exit with a message instead of silently moving to another port.
export default defineConfig(({ mode }) => ({
  plugins: [react(), earlyLook(loadEnv(mode, process.cwd(), 'VITE_').VITE_HOWSURE_STORAGE_NS)],
  server: { host: '127.0.0.1', port: 5273, strictPort: true },
}))
