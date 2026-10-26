import { defineConfig } from 'vitest/config'

// spec.md > Where It Runs and How Someone Tries It (Tests).
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'tests/connector/**/*.test.ts'],
    setupFiles: ['tests/vitest.setup.ts'],
  },
})
