// Demo capture config (spec.md > Where It Runs and How Someone Tries It > Demo recording).
// Run only when no other Playwright or ffmpeg job is running on this machine.
// 1280x720, one worker, one short test per scene (each its own browser context), so a
// low-memory renderer crash costs one scene, not the whole capture.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'record.spec.ts',
  outputDir: 'out',
  timeout: 90 * 1000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:5273',
    timezoneId: 'America/Toronto',
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
  },
  webServer: {
    command: 'npm run dev:app',
    url: 'http://127.0.0.1:5273',
    reuseExistingServer: false,
  },
})
