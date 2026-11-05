// Build-out item 1.3: the More menu, the targets editor and the full-screen view switch.
// Done when: each opens in a browser test.
//
// Expected values are written by hand. Your own log is the frozen fixture
// fixtures/saved/v1-mine.json (fictional Sam: targets 2,200 kcal, 120 g protein, 250 g carbs,
// 70 g fat, usualMealsPerDay 3). The demo is Sam's fictional week, whose targets are 2,400 kcal
// and 130 g protein, with no carbs or fat target (fixtures/demo-week.json, spec.md > Demo Fixture).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { E2E_KEYS } from './storage-keys'

const V1_MINE = readFileSync(fileURLToPath(new URL('../../fixtures/saved/v1-mine.json', import.meta.url)), 'utf8')

// Sam's Wednesday 2026-10-28, 8 PM: woke 07:40, with meals on screen (fixtures/saved/v1-mine.json).
const MINE_NOW = new Date('2026-10-28T20:00:00-04:00')
// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock).
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')

const NEGATIVE = 'A target can’t be below 0. Type a number, or leave it blank for no target.'
const ZERO = 'A target of 0 isn’t used. Type a number above 0, or leave it blank for no target.'
const NOT_A_NUMBER = 'Use digits, e.g. 1501 or 13.9'

async function startMine(page: Page) {
  await page.clock.setFixedTime(MINE_NOW)
  await page.goto('/')
  await page.evaluate(
    ([mineKey, mine, activeKey]) => {
      localStorage.setItem(mineKey, mine)
      localStorage.setItem(activeKey, 'mine')
    },
    [E2E_KEYS.mine, V1_MINE, E2E_KEYS.active],
  )
  await page.reload()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function startDemo(page: Page) {
  await page.clock.setFixedTime(DEMO_NOW)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the fictional demo' }).click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function startEmpty(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start my log' }).click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function openMore(page: Page) {
  await page.getByTestId('open-more').click()
  const menu = page.getByTestId('more-menu')
  await expect(menu).toBeVisible()
  return menu
}

async function openTargets(page: Page) {
  const menu = await openMore(page)
  await menu.getByTestId('more-targets').click()
  await expect(menu).toHaveCount(0)
  const sheet = page.getByTestId('targets-sheet')
  await expect(sheet).toBeVisible()
  return sheet
}

async function stored(page: Page, key: string): Promise<Record<string, unknown> | null> {
  const text = await page.evaluate((k) => localStorage.getItem(k), key)
  return text === null ? null : (JSON.parse(text) as Record<string, unknown>)
}

const isFullScreen = (page: Page) => page.evaluate(() => document.fullscreenElement === document.documentElement)
const hasFullViewClass = (page: Page) => page.evaluate(() => document.documentElement.classList.contains('full-view'))

test.describe('item 1.3: the More menu', () => {
  test('opens from the dashboard, lists its places, traps focus, and Esc closes it', async ({ page }) => {
    await startMine(page)
    const more = page.getByTestId('open-more')
    await expect(more).toHaveText('More')
    await expect(more).toHaveAttribute('aria-expanded', 'false')

    const menu = await openMore(page)
    await expect(more).toHaveAttribute('aria-expanded', 'true')
    await expect(menu.getByRole('heading', { name: 'More' })).toBeVisible()
    // Build-out item 2.3 adds Saved meals, in both logs.
    await expect(menu.locator('.more-label')).toHaveText(['Profile and privacy', 'Targets', 'Saved meals', 'Look', 'Show full screen'])

    // Focus stays inside: Close is first, the full-screen switch last.
    const close = menu.getByRole('button', { name: 'Close' })
    await expect(close).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(menu.getByTestId('more-fullScreen')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()

    // Esc closes it, and focus goes back to More.
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(more).toBeFocused()
    await expect(more).toHaveAttribute('aria-expanded', 'false')
  })

  test('each entry opens its place, and closing it gives focus back to More', async ({ page }) => {
    await startMine(page)
    const more = page.getByTestId('open-more')

    // Profile and privacy (item 1.2).
    let menu = await openMore(page)
    await menu.getByTestId('more-profile').click()
    const panel = page.getByTestId('profile-privacy')
    await expect(panel).toBeVisible()
    await expect(panel.getByTestId('privacy-saved-here')).toHaveText('Saved on this device only')
    await panel.getByRole('button', { name: 'Close' }).click()
    await expect(panel).toHaveCount(0)
    await expect(more).toBeFocused()

    // Targets, by keyboard.
    menu = await openMore(page)
    await menu.getByTestId('more-targets').focus()
    await page.keyboard.press('Enter')
    const sheet = page.getByTestId('targets-sheet')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('heading', { name: 'Targets' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(more).toBeFocused()
  })

  test('in the demo it shows the fictional label and leaves out Profile and privacy', async ({ page }) => {
    await startDemo(page)
    const menu = await openMore(page)
    await expect(menu.getByTestId('fictional-banner')).toHaveText('Sample person — fictional')
    // Build-out item 2.1 adds Reset demo, in the demo only.
    await expect(menu.locator('.more-label')).toHaveText(['Targets', 'Saved meals', 'Look', 'Show full screen', 'Reset demo'])
    await expect(menu.getByTestId('more-targets')).toContainText('Sam’s daily targets, which are made up.')
  })
})

test.describe('item 1.3: the targets editor', () => {
  test('edits your own targets, checks each box, shows them on the dashboard, and keeps them after a reload', async ({
    page,
  }) => {
    await startMine(page)
    const original = JSON.parse(V1_MINE)

    // The fixture's targets show under the headline and under each macro.
    await expect(page.getByTestId('headline-target')).toHaveText('Daily target 2,200 kcal')
    await expect(page.getByTestId('macro-protein-target')).toHaveText('Target 120 g')
    await expect(page.getByTestId('macro-carbs-target')).toHaveText('Target 250 g')
    await expect(page.getByTestId('macro-fat-target')).toHaveText('Target 70 g')

    const sheet = await openTargets(page)
    const kcal = sheet.getByTestId('target-kcal-input')
    const protein = sheet.getByTestId('target-protein-input')
    const carbs = sheet.getByTestId('target-carbs-input')
    const fat = sheet.getByTestId('target-fat-input')
    const save = sheet.getByTestId('save-targets')
    await expect(sheet.getByText('Leave a box blank for no target.')).toBeVisible()
    await expect(kcal).toHaveValue('2200')
    await expect(protein).toHaveValue('120')
    await expect(carbs).toHaveValue('250')
    await expect(fat).toHaveValue('70')
    await expect(kcal).toHaveAccessibleName('Calories (kcal)')

    // A negative number, letters and 0 are each refused under their box, and Save waits.
    await kcal.fill('-5')
    await expect(sheet.getByTestId('target-kcal-error')).toHaveText(NEGATIVE)
    await expect(kcal).toHaveAttribute('aria-invalid', 'true')
    await expect(save).toBeDisabled()
    await protein.fill('lots')
    await expect(sheet.getByTestId('target-protein-error')).toHaveText(NOT_A_NUMBER)
    await fat.fill('0')
    await expect(sheet.getByTestId('target-fat-error')).toHaveText(ZERO)

    // Fixed: grouped digits, a blank box (no target) and a decimal.
    await kcal.fill('2,300')
    await protein.fill('125')
    await carbs.fill('')
    await fat.fill('62.5')
    await expect(sheet.locator('.field-error')).toHaveCount(0)
    await expect(save).toBeEnabled()
    await save.click()
    await expect(sheet).toHaveCount(0)

    await expect(page.getByTestId('headline-target')).toHaveText('Daily target 2,300 kcal')
    await expect(page.getByTestId('macro-protein-target')).toHaveText('Target 125 g')
    await expect(page.getByTestId('macro-carbs-target')).toHaveCount(0)
    await expect(page.getByTestId('macro-fat-target')).toHaveText('Target 62.5 g')

    // Saved: only the targets changed, carbs has no key at all (blank is never 0).
    const saved = await stored(page, E2E_KEYS.mine)
    expect(saved).toStrictEqual({
      ...original,
      profile: { ...original.profile, targets: { kcal: 2300, protein: 125, fat: 62.5 } },
    })

    await page.reload()
    await expect(page.getByTestId('headline-target')).toHaveText('Daily target 2,300 kcal')
    await expect(page.getByTestId('macro-protein-target')).toHaveText('Target 125 g')
    await expect(page.getByTestId('macro-carbs-target')).toHaveCount(0)
    await expect(page.getByTestId('macro-fat-target')).toHaveText('Target 62.5 g')
  })

  test('Cancel and Esc leave the targets as they were', async ({ page }) => {
    await startMine(page)
    let sheet = await openTargets(page)
    await sheet.getByTestId('target-kcal-input').fill('1800')
    await sheet.getByTestId('cancel-targets').click()
    await expect(sheet).toHaveCount(0)
    await expect(page.getByTestId('headline-target')).toHaveText('Daily target 2,200 kcal')

    sheet = await openTargets(page)
    await expect(sheet.getByTestId('target-kcal-input')).toHaveValue('2200')
    await sheet.getByTestId('target-kcal-input').fill('1800')
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(page.getByTestId('headline-target')).toHaveText('Daily target 2,200 kcal')
    expect(await stored(page, E2E_KEYS.mine)).toStrictEqual(JSON.parse(V1_MINE))
  })

  test('a new log starts with no targets; one can be set and cleared again', async ({ page }) => {
    await startEmpty(page)
    await expect(page.getByTestId('headline-target')).toHaveCount(0)

    let sheet = await openTargets(page)
    for (const k of ['kcal', 'protein', 'carbs', 'fat']) await expect(sheet.getByTestId(`target-${k}-input`)).toHaveValue('')
    await sheet.getByTestId('target-kcal-input').fill('2000')
    await sheet.getByTestId('save-targets').click()
    await expect(page.getByTestId('headline-target')).toHaveText('Daily target 2,000 kcal')

    await page.reload()
    await expect(page.getByTestId('headline-target')).toHaveText('Daily target 2,000 kcal')
    expect((await stored(page, E2E_KEYS.mine))?.profile).toStrictEqual({ name: '', kind: 'guest', targets: { kcal: 2000 } })

    // Clearing every box removes the targets: no line on the dashboard, no key saved.
    sheet = await openTargets(page)
    await sheet.getByTestId('target-kcal-input').fill('')
    await sheet.getByTestId('save-targets').click()
    await expect(page.getByTestId('headline-target')).toHaveCount(0)
    expect((await stored(page, E2E_KEYS.mine))?.profile).toStrictEqual({ name: '', kind: 'guest' })
  })

  test("the demo shows Sam's made-up targets, and a change stays in the demo", async ({ page }) => {
    await startDemo(page)
    await expect(page.getByTestId('headline-target')).toHaveText('Daily target 2,400 kcal')
    await expect(page.getByTestId('macro-protein-target')).toHaveText('Target 130 g')
    await expect(page.getByTestId('macro-carbs-target')).toHaveCount(0)
    await expect(page.getByTestId('macro-fat-target')).toHaveCount(0)

    const sheet = await openTargets(page)
    await expect(sheet.getByTestId('fictional-banner')).toHaveText('Sample person — fictional')
    await expect(sheet).toContainText('Sam’s targets are made up, like the rest of the demo.')
    await expect(sheet.getByTestId('target-kcal-input')).toHaveValue('2400')
    await expect(sheet.getByTestId('target-protein-input')).toHaveValue('130')
    await expect(sheet.getByTestId('target-carbs-input')).toHaveValue('')
    await expect(sheet.getByTestId('target-fat-input')).toHaveValue('')
    await sheet.getByTestId('target-fat-input').fill('80')
    await sheet.getByTestId('save-targets').click()
    await expect(page.getByTestId('macro-fat-target')).toHaveText('Target 80 g')

    await page.reload()
    await expect(page.getByTestId('macro-fat-target')).toHaveText('Target 80 g')
    const demo = await stored(page, E2E_KEYS.demo)
    expect((demo?.profile as Record<string, unknown>).targets).toStrictEqual({ kcal: 2400, protein: 130, fat: 80 })
    // Your own log was never opened, so nothing was written for it.
    expect(await stored(page, E2E_KEYS.mine)).toBeNull()
  })
})

test.describe('item 1.3: the full-screen view switch', () => {
  test("enters the browser's full screen and comes back, with the label naming where it goes", async ({ page }) => {
    await startDemo(page)
    let menu = await openMore(page)
    await expect(menu.getByTestId('more-fullScreen')).toContainText('Show full screen')
    await menu.getByTestId('more-fullScreen').click()
    await expect(menu).toHaveCount(0)

    await expect.poll(() => isFullScreen(page)).toBe(true)
    expect(await hasFullViewClass(page)).toBe(true)
    const exit = page.getByTestId('full-screen-exit')
    await expect(exit).toHaveText('Exit full screen')
    await expect(page.getByTestId('fictional-banner').first()).toBeVisible()

    // On a wide screen the day's numbers and the meal list sit side by side; on a phone they stack.
    const day = (await page.getByTestId('dash-col-day').boundingBox())!
    const list = (await page.getByTestId('dash-col-list').boundingBox())!
    if (page.viewportSize()!.width >= 960) {
      expect(list.x).toBeGreaterThan(day.x + day.width - 1)
      expect(Math.abs(list.y - day.y)).toBeLessThan(2)
    } else {
      expect(list.y).toBeGreaterThanOrEqual(day.y + day.height - 1)
    }

    // A sheet still opens over it.
    menu = await openMore(page)
    await expect(menu.getByTestId('more-fullScreen')).toContainText('Exit full screen')
    await expect(menu.getByTestId('more-fullScreen')).toContainText('Back to the normal view. Esc also works.')
    await menu.getByTestId('more-fullScreen').click()
    await expect.poll(() => isFullScreen(page)).toBe(false)
    expect(await hasFullViewClass(page)).toBe(false)
    await expect(exit).toHaveCount(0)

    // In again, then out with the header button.
    menu = await openMore(page)
    await menu.getByTestId('more-fullScreen').click()
    await expect.poll(() => isFullScreen(page)).toBe(true)
    await exit.click()
    await expect.poll(() => isFullScreen(page)).toBe(false)
    await expect(exit).toHaveCount(0)
  })

  test('leaving full screen through the browser (as Esc does) ends the view, and a reload starts normal', async ({
    page,
  }) => {
    await startMine(page)
    const menu = await openMore(page)
    await menu.getByTestId('more-fullScreen').click()
    await expect.poll(() => isFullScreen(page)).toBe(true)
    await expect(page.getByTestId('full-screen-exit')).toBeVisible()

    await page.evaluate(() => document.exitFullscreen())
    await expect(page.getByTestId('full-screen-exit')).toHaveCount(0)
    expect(await hasFullViewClass(page)).toBe(false)

    // Nothing about it is saved.
    await (await openMore(page)).getByTestId('more-fullScreen').click()
    await expect.poll(() => isFullScreen(page)).toBe(true)
    await page.reload()
    await expect(page.getByTestId('dashboard')).toBeVisible()
    await expect(page.getByTestId('full-screen-exit')).toHaveCount(0)
    expect(await hasFullViewClass(page)).toBe(false)
  })

  const fallbacks: { name: string; script: string }[] = [
    {
      name: 'the browser refuses',
      script: "Element.prototype.requestFullscreen = function () { return Promise.reject(new TypeError('refused')) }",
    },
    {
      name: 'the Fullscreen API is missing',
      script: "Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false, configurable: true })",
    },
  ]

  for (const { name, script } of fallbacks) {
    test(`when ${name}, the page widens instead and says so; Esc and the header button go back`, async ({ page }) => {
      await page.addInitScript(script)
      await startDemo(page)
      let menu = await openMore(page)
      await menu.getByTestId('more-fullScreen').click()

      const exit = page.getByTestId('full-screen-exit')
      await expect(exit).toHaveText('Exit full screen')
      expect(await hasFullViewClass(page)).toBe(true)
      expect(await isFullScreen(page)).toBe(false)
      if (page.viewportSize()!.width >= 960) {
        const width = (await page.getByTestId('dashboard').boundingBox())!.width
        expect(width).toBeGreaterThan(640)
      }

      menu = await openMore(page)
      await expect(menu.getByTestId('more-fullScreen')).toContainText(
        'Your browser kept its own bars, so HowSure widened the page instead.',
      )
      // Esc first closes the menu, then a second Esc on the dashboard leaves the view.
      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
      await expect(exit).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(exit).toHaveCount(0)
      expect(await hasFullViewClass(page)).toBe(false)

      await (await openMore(page)).getByTestId('more-fullScreen').click()
      await expect(exit).toBeVisible()
      await exit.click()
      await expect(exit).toHaveCount(0)
      expect(await hasFullViewClass(page)).toBe(false)
    })
  }
})
