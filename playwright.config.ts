import os from 'node:os'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

// spec.md > Where It Runs and How Someone Tries It.
// One Playwright job at a time on this machine, so one worker and no retries.
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  retries: 0,
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:5273',
    timezoneId: 'America/Toronto',
    locale: 'en-US',
  },
  webServer: {
    command: 'npm run dev:app',
    url: 'http://127.0.0.1:5273',
    reuseExistingServer: false,
    env: {
      HOWSURE_BRIDGE_PORT: '5284',
      HOWSURE_DATA_DIR: path.join(os.tmpdir(), 'howsure-e2e-data'),
    },
  },
  projects: [
    { name: 'phone-390x844', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop-1920x1080', use: { viewport: { width: 1920, height: 1080 } } },
  ],
})
