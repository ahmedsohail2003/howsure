import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 127.0.0.1, not localhost: on this machine localhost resolves to ::1 first.
// strictPort: exit with a message instead of silently moving to another port.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5273, strictPort: true },
})
