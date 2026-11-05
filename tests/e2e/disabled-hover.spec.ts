// Build-out item 1.4 (contrast): a disabled button stays grey while the mouse is over it. Before
// the fix, ".btn-primary:hover" came after ".btn:disabled" with the same specificity, so a
// disabled "Save meal" under the mouse turned dark teal (--teal-ink #2A736E) while its label kept
// the disabled grey (--ink-soft #5E5A55): 1.23:1, almost invisible.
//
// Expected colours, by hand from theme.css: --line #E6E0D6 = rgb(230, 224, 214) and --ink-soft
// #5E5A55 = rgb(94, 90, 85); --ink-soft on --line is 5.21:1 (Python, WCAG 2.x, 2026-11-05).
import { expect, test, type Locator } from '@playwright/test'

// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock).
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')
const LINE = 'rgb(230, 224, 214)'
const INK_SOFT = 'rgb(94, 90, 85)'

// No sheet animation or colour transition: the mouse must land on the button where it stays, and
// the colours read must be the final ones.
test.use({ reducedMotion: 'reduce' })

/** Hover a disabled button and prove the mouse really is over it before reading its colours. */
async function hoverDisabled(save: Locator) {
  await expect(save).toBeDisabled()
  await save.hover({ force: true })
  await expect.poll(() => save.evaluate((e) => e.matches(':hover'))).toBe(true)
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(DEMO_NOW)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the fictional demo' }).click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
})

test('a disabled "Save meal" keeps its grey fill and readable label under the mouse', async ({ page }) => {
  await page.getByTestId('log-meal').click()
  const save = page.getByTestId('log-meal-sheet').getByTestId('save-meal')
  await hoverDisabled(save)
  await expect(save).toHaveCSS('background-color', LINE)
  await expect(save).toHaveCSS('color', INK_SOFT)
})

test('a disabled targets Save keeps its grey fill and readable label under the mouse', async ({ page }) => {
  await page.getByTestId('open-more').click()
  await page.getByTestId('more-menu').getByTestId('more-targets').click()
  const sheet = page.getByTestId('targets-sheet')
  await sheet.getByTestId('target-kcal-input').fill('-5')
  const save = sheet.getByTestId('save-targets')
  await hoverDisabled(save)
  await expect(save).toHaveCSS('background-color', LINE)
  await expect(save).toHaveCSS('color', INK_SOFT)
})
