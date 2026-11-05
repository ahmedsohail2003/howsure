// Build-out item 1.5.2: start a page in a chosen look. The look is a device preference saved under
// its own namespaced key (src/store/keys.ts > look), read before the first render. The value is
// written before the page's own scripts run, and only when no look is saved yet, so a look the
// test then chooses in the Look sheet survives a reload.
import type { Page } from '@playwright/test'
import type { Look } from '../../src/store/look'
import { BUILT_LOOKS, LOOKS } from '../../src/ui/looks'
import { E2E_KEYS } from './storage-keys'

/** The looks this build offers; the data-driven specs run once in each. */
export { BUILT_LOOKS, LOOKS }

export async function startInLook(page: Page, look: Look): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
      } catch {
        // Storage blocked: the app starts in the default look, as it would for a person.
      }
    },
    [E2E_KEYS.look, look] as const,
  )
}

/** The look the page is drawn in (the attribute main.tsx sets on <html>). */
export function lookOnPage(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.documentElement.dataset.look)
}
