// Build-out item 2.3: repeat a usual meal. Done when a home meal is logged in two taps: Log a
// meal, then the meal under Recent or Saved. Covers Undo, the amount change (the error scales with
// the amount), Save as a usual meal, renaming and deleting saved meals from More and from Log a
// meal, and Export/Import keeping saved meals. Every test runs once in each look (looks.ts).
//
// The people here are the fictional Sam (the demo week, fixtures/demo-week.json) and invented
// meals in an empty own log. Expected day values are spec.md's formulas computed separately in
// Python, not read from the app:
//   G11 + Lentil soup again (menu, 330):        2610, score 85, likely 2174–3133, very likely 1974–3451
//   G11 + Chicken, rice and broccoli x1.5 (720): 3000, score 87, likely 2564–3510
//   720 kcal weighed (8%): likely 652–795, very likely 619–837
import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { copy } from '../../src/ui/copy'
import { LOOKS, startInLook } from './looks'
import { E2E_KEYS } from './storage-keys'

// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock): Wednesday's waking day.
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')
// Your own log runs on real time; this pins it.
const MINE_NOW = new Date('2026-10-26T12:15:00-04:00')

const G11 = { kcal: '2280', score: 'Estimate score 83', likely: '1870–2780' }
const WITH_SOUP = { kcal: '2610', score: 'Estimate score 85', likely: '2174–3133', veryLikely: '1974–3451' }
const WITH_BOWL = { kcal: '3000', score: 'Estimate score 87', likely: '2564–3510' }

/** Text with thousands separators removed, so "2,174–3,133" reads as "2174–3133". */
async function digits(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/,/g, '')
}

async function expectDay(page: Page, want: { kcal: string; score: string; likely: string; veryLikely?: string }) {
  expect(await digits(page.getByTestId('headline-kcal'))).toBe(want.kcal)
  await expect(page.getByTestId('day-score')).toHaveText(want.score)
  expect(await digits(page.getByTestId('likely-range'))).toContain(want.likely)
  if (want.veryLikely) expect(await digits(page.getByTestId('very-likely-range'))).toContain(want.veryLikely)
}

async function openDemo(page: Page) {
  await page.clock.setFixedTime(DEMO_NOW)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the fictional demo' }).click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

function row(page: Page, name: string): Locator {
  return page.getByTestId('meal-row').filter({ hasText: name })
}

function quickItem(sheet: Locator, list: 'quick-recent' | 'quick-saved', name: string): Locator {
  return sheet.getByTestId(list).getByTestId('quick-item').filter({ has: sheet.page().getByTestId('quick-name').getByText(name, { exact: true }) })
}

/** Counts every tap a person makes, so "two taps" is checked, not assumed. */
function tapCounter() {
  let taps = 0
  return {
    tap: async (target: Locator) => {
      taps += 1
      await target.click()
    },
    get count() {
      return taps
    },
  }
}

/** Save as a usual meal from the meal's details, under `name`. */
async function saveAsUsual(page: Page, meal: string, name: string) {
  await row(page, meal).first().getByTestId('meal-open').click()
  const details = page.getByTestId('meal-details')
  await expect(details).toBeVisible()
  await details.getByTestId('save-usual-open').click()
  const field = details.getByTestId('save-usual-name')
  await expect(field).toHaveValue(meal)
  await expect(field).toBeFocused()
  await field.fill(name)
  await details.getByTestId('save-usual-confirm').click()
  await expect(details.getByTestId('saved-as')).toHaveText(`${copy.usualMeals.savedAs(name)} ${copy.usualMeals.manage}`)
  await expect(details.getByTestId('saved-as')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(details).toHaveCount(0)
}

for (const { id: look, name: lookName } of LOOKS) {
  test.describe(`item 2.3 in the ${lookName} look: repeat a usual meal`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('a recent meal is logged again in two taps, as a fresh meal with its source and values, and Undo takes it back', async ({ page }) => {
      await openDemo(page)
      await expectDay(page, G11)
      await expect(row(page, 'Lentil soup from the café')).toHaveCount(1)

      const t = tapCounter()
      await t.tap(page.getByTestId('log-meal'))
      const sheet = page.getByTestId('log-meal-sheet')
      await expect(sheet).toBeVisible()
      await expect(sheet.getByTestId('quick-intro')).toHaveText(copy.quickLog.introNow)
      // Recent: the newest distinct meals, newest first.
      await expect(sheet.getByTestId('quick-recent').getByTestId('quick-name')).toHaveText([
        'Apple and peanut butter',
        'Lentil soup from the café',
        'Chicken, rice and broccoli',
        'Pasta bake (ready meal)',
        'Kefir with oats and blueberries',
      ])
      const soup = quickItem(sheet, 'quick-recent', 'Lentil soup from the café')
      await expect(soup.getByTestId('quick-kcal')).toHaveText('330 kcal')
      await expect(soup.getByTestId('quick-meta')).toHaveText('Published menu · likely 258–421 kcal')
      await expect(sheet.getByTestId('saved-empty')).toHaveText(copy.quickLog.savedEmpty)
      await t.tap(soup.getByTestId('quick-log-item'))

      // Two taps, and it is logged.
      await expect(sheet).toHaveCount(0)
      expect(t.count).toBe(2)
      await expectDay(page, WITH_SOUP)
      const soups = row(page, 'Lentil soup from the café')
      await expect(soups).toHaveCount(2)
      // A fresh meal with its own time (the demo's now) and the same source and calories.
      const fresh = soups.filter({ hasText: '1:30 AM' })
      await expect(fresh).toHaveCount(1)
      await fresh.getByTestId('meal-open').click()
      const details = page.getByTestId('meal-details')
      await expect(details.getByTestId('details-kcal')).toHaveText('330 kcal')
      await expect(details.getByTestId('details-source')).toContainText('Published menu · typical error 21%')
      await expect(details.getByTestId('details-protein')).toContainText('18 g')
      await page.keyboard.press('Escape')

      // Opening the details cleared the Logged line; log once more and Undo it.
      await page.getByTestId('log-meal').click()
      await quickItem(page.getByTestId('log-meal-sheet'), 'quick-recent', 'Apple and peanut butter').getByTestId('quick-log-item').click()
      await expect(page.getByTestId('logged-note')).toHaveText(copy.quickLog.logged('Apple and peanut butter', '300 kcal'))
      // In the action bar, just above Log a meal, not under the header.
      await expect(page.getByTestId('action-bar').getByTestId('logged-note')).toBeInViewport()
      await expect(page.getByTestId('status-note')).toHaveText('')
      await expect(row(page, 'Apple and peanut butter')).toHaveCount(2)
      const undo = page.getByTestId('status-undo')
      await expect(undo).toHaveText(copy.quickLog.undo)
      await expect(undo).toHaveAccessibleName(copy.quickLog.undoLabel('Apple and peanut butter'))
      await undo.click()
      await expect(row(page, 'Apple and peanut butter')).toHaveCount(1)
      await expect(page.getByTestId('logged-note')).toHaveText(copy.quickLog.undone('Apple and peanut butter'))
      await expect(undo).toHaveCount(0)
      await expect(page.getByTestId('log-meal')).toBeFocused()
      await expectDay(page, WITH_SOUP)

      // Saved on the device: the soup stays, the undone apple stays gone.
      await page.reload()
      await expect(row(page, 'Lentil soup from the café')).toHaveCount(2)
      await expect(row(page, 'Apple and peanut butter')).toHaveCount(1)
    })

    test('Save as a usual meal, then log it in two taps at x1.5: calories, macros and the range scale', async ({ page }) => {
      await openDemo(page)
      // Cancel puts focus back on the button, inside the sheet.
      await row(page, 'Chicken, rice and broccoli').getByTestId('meal-open').click()
      await page.getByTestId('save-usual-open').click()
      await page.getByTestId('save-usual-cancel').click()
      await expect(page.getByTestId('save-usual-open')).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('meal-details')).toHaveCount(0)
      await saveAsUsual(page, 'Chicken, rice and broccoli', 'Usual chicken bowl')
      // The details now say it is saved, instead of offering it again.
      await row(page, 'Chicken, rice and broccoli').getByTestId('meal-open').click()
      await expect(page.getByTestId('meal-details').getByTestId('saved-as')).toContainText('Usual chicken bowl')
      await expect(page.getByTestId('save-usual-open')).toHaveCount(0)
      await page.keyboard.press('Escape')

      const t = tapCounter()
      await t.tap(page.getByTestId('log-meal'))
      const sheet = page.getByTestId('log-meal-sheet')
      const bowl = quickItem(sheet, 'quick-saved', 'Usual chicken bowl')
      // Saved comes first and is in view as the sheet opens: no scrolling before the second tap.
      await expect(bowl).toBeInViewport()
      // Offered once: the meal it was saved from is not listed again under Recent.
      await expect(sheet.getByTestId('quick-recent').getByTestId('quick-name')).toHaveText([
        'Apple and peanut butter',
        'Lentil soup from the café',
        'Pasta bake (ready meal)',
        'Kefir with oats and blueberries',
        'Hummus and crackers',
      ])
      await expect(bowl.getByTestId('quick-kcal')).toHaveText('480 kcal')
      await expect(bowl.getByTestId('quick-meta')).toHaveText('Weighed · likely 435–530 kcal')

      // The amount: ×1.5 scales the calories and the range; the typical error stays the same share.
      await sheet.getByTestId('amount-1.5').check()
      await expect(bowl.getByTestId('quick-kcal')).toHaveText('720 kcal')
      await expect(bowl.getByTestId('quick-times')).toHaveText('×1.5 of 480 kcal')
      await expect(bowl.getByTestId('quick-meta')).toHaveText('Weighed · likely 652–795 kcal')
      await expect(sheet.getByTestId('amount-hint')).toHaveText(copy.quickLog.amountHint)

      // A typed multiplier: an error blocks the taps; a number scales them.
      await sheet.getByTestId('amount-other').check()
      // Still blank: the meals can't be tapped yet, and a hint says why.
      await expect(sheet.getByTestId('amount-needed')).toHaveText(copy.quickLog.amountNeeded)
      await expect(bowl.getByTestId('quick-log-item')).toBeDisabled()
      await sheet.getByTestId('amount-other-input').fill('0.001')
      await expect(sheet.getByTestId('amount-error')).toHaveText(copy.quickLog.amountError)
      await sheet.getByTestId('amount-other-input').fill('abc')
      await expect(sheet.getByTestId('amount-error')).toHaveText(copy.quickLog.amountError)
      await expect(sheet.getByTestId('amount-other-input')).toHaveAttribute('aria-invalid', 'true')
      await expect(bowl.getByTestId('quick-log-item')).toBeDisabled()
      await sheet.getByTestId('amount-other-input').fill('1.25')
      await expect(sheet.getByTestId('amount-error')).toHaveCount(0)
      await expect(bowl.getByTestId('quick-kcal')).toHaveText('600 kcal')
      await sheet.getByTestId('amount-other-input').fill('.5')
      await expect(bowl.getByTestId('quick-kcal')).toHaveText('240 kcal')
      await sheet.getByTestId('amount-1.5').check()
      await t.tap(bowl.getByTestId('quick-log-item'))
      await expect(sheet).toHaveCount(0)
      await expect(page.getByTestId('logged-note')).toHaveText(copy.quickLog.logged('Usual chicken bowl', '720 kcal'))
      await expectDay(page, WITH_BOWL)

      await row(page, 'Usual chicken bowl').getByTestId('meal-open').click()
      const details = page.getByTestId('meal-details')
      await expect(details.getByTestId('details-kcal')).toHaveText('720 kcal')
      await expect(details.getByTestId('details-source')).toContainText('Weighed · typical error 8%')
      expect(await digits(details.getByTestId('details-likely'))).toContain('652–795')
      expect(await digits(details.getByTestId('details-very-likely'))).toContain('619–837')
      await expect(details.getByTestId('details-protein')).toContainText('66 g')
      await expect(details.getByTestId('details-carbs')).toContainText('75 g')
      await expect(details.getByTestId('details-fat')).toContainText('15 g')
      // The logged meal is not the saved meal: at another amount it offers to be saved itself.
      await expect(details.getByTestId('save-usual-open')).toBeVisible()
    })

    test('saved meals are renamed and deleted from More and from Log a meal; logged meals stay as they are', async ({ page }) => {
      await openDemo(page)
      await saveAsUsual(page, 'Chicken, rice and broccoli', 'Usual chicken bowl')
      await saveAsUsual(page, 'Kefir with oats and blueberries', 'Kefir oats')

      await page.getByTestId('open-more').click()
      await page.getByTestId('more-menu').getByTestId('more-savedMeals').click()
      const sheet = page.getByTestId('saved-meals-sheet')
      await expect(sheet.getByTestId('saved-meal-name')).toHaveText(['Kefir oats', 'Usual chicken bowl'])

      // Rename: a taken name is refused, then a new one is saved.
      const bowl = sheet.getByTestId('saved-meal').filter({ hasText: 'Usual chicken bowl' })
      await bowl.getByTestId('saved-rename').click()
      const input = bowl.getByTestId('saved-rename-input')
      await expect(input).toBeFocused()
      await input.fill('kefir OATS')
      await expect(bowl.getByTestId('saved-rename-error')).toHaveText(copy.usualMeals.nameTaken('Kefir oats'))
      await input.fill('Chicken bowl')
      await bowl.getByTestId('saved-rename-save').click()
      await expect(sheet.getByTestId('saved-meals-status')).toHaveText(copy.usualMeals.renamed('Usual chicken bowl', 'Chicken bowl'))
      await expect(sheet.getByTestId('saved-meal-name')).toHaveText(['Chicken bowl', 'Kefir oats'])
      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)

      // From Log a meal: Rename or delete opens the same sheet, and closing it goes back.
      await page.getByTestId('log-meal').click()
      let logSheet = page.getByTestId('log-meal-sheet')
      await expect(logSheet.getByTestId('quick-saved').getByTestId('quick-name')).toHaveText(['Chicken bowl', 'Kefir oats'])
      await logSheet.getByTestId('manage-saved').click()
      await expect(sheet).toBeVisible()
      const kefir = sheet.getByTestId('saved-meal').filter({ hasText: 'Kefir oats' })
      await kefir.getByTestId('saved-delete').click()
      await expect(kefir.getByTestId('saved-delete-confirm')).toContainText(copy.usualMeals.confirmDelete('Kefir oats'))
      await kefir.getByTestId('saved-delete-keep').click()
      await expect(kefir.getByTestId('saved-delete')).toBeFocused()
      await kefir.getByTestId('saved-delete').click()
      await kefir.getByTestId('saved-delete-confirm-btn').click()
      await expect(sheet.getByTestId('saved-meals-status')).toHaveText(copy.usualMeals.deleted('Kefir oats'))
      await expect(sheet.getByTestId('saved-meal-name')).toHaveText(['Chicken bowl'])
      await sheet.getByRole('button', { name: copy.sheet.close }).click()
      logSheet = page.getByTestId('log-meal-sheet')
      await expect(logSheet).toBeVisible()
      await expect(logSheet.getByTestId('quick-saved').getByTestId('quick-name')).toHaveText(['Chicken bowl'])
      await page.keyboard.press('Escape')

      // The logged meals are untouched, and the change is saved.
      await expect(row(page, 'Chicken, rice and broccoli')).toHaveCount(1)
      await expect(row(page, 'Kefir with oats and blueberries')).toHaveCount(1)
      await expectDay(page, G11)
      await page.reload()
      await page.getByTestId('open-more').click()
      await page.getByTestId('more-menu').getByTestId('more-savedMeals').click()
      await expect(page.getByTestId('saved-meals-sheet').getByTestId('saved-meal-name')).toHaveText(['Chicken bowl'])
    })

    test('a meal edited after it was saved: its details say what the saved meal holds, and saving again updates it', async ({ page }) => {
      await openDemo(page)
      await saveAsUsual(page, 'Chicken, rice and broccoli', 'Chicken, rice and broccoli')
      await row(page, 'Chicken, rice and broccoli').getByTestId('meal-open').click()
      await page.getByTestId('meal-details').getByTestId('edit-meal').click()
      const edit = page.getByTestId('log-meal-sheet')
      await edit.getByTestId('meal-kcal-input').fill('600')
      await edit.getByTestId('save-meal').click()
      await expect(edit).toHaveCount(0)

      // No stale "Saved as": the saved meal still holds 480 kcal, and the details say so.
      await row(page, 'Chicken, rice and broccoli').getByTestId('meal-open').click()
      const details = page.getByTestId('meal-details')
      await expect(details.getByTestId('details-kcal')).toHaveText('600 kcal')
      await expect(details.getByTestId('saved-as')).toHaveCount(0)
      await expect(details.getByTestId('saved-earlier')).toHaveText(copy.usualMeals.savedEarlier('Chicken, rice and broccoli', '480 kcal'))
      await details.getByTestId('save-usual-open').click()
      // The name form takes the footer's place: one set of actions, not two.
      await expect(details.getByTestId('edit-meal')).toHaveCount(0)
      await expect(details.getByTestId('save-usual-error')).toHaveCount(0)
      await expect(details.getByTestId('save-usual-updates')).toHaveText(copy.usualMeals.updates('Chicken, rice and broccoli'))
      await details.getByTestId('save-usual-confirm').click()
      await expect(details.getByTestId('saved-as')).toHaveText(
        `${copy.usualMeals.updated('Chicken, rice and broccoli')} ${copy.usualMeals.manage}`,
      )
      await expect(details.getByTestId('edit-meal')).toBeVisible()
      await page.keyboard.press('Escape')

      // One saved meal, now at 600 kcal.
      await page.getByTestId('log-meal').click()
      const sheet = page.getByTestId('log-meal-sheet')
      await expect(sheet.getByTestId('quick-saved').getByTestId('quick-name')).toHaveText(['Chicken, rice and broccoli'])
      await expect(quickItem(sheet, 'quick-saved', 'Chicken, rice and broccoli').getByTestId('quick-kcal')).toHaveText('600 kcal')
    })

    test('Logged with Undo is in view after a quick log, however far the page was scrolled', async ({ page }) => {
      await openDemo(page)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const logBtn = page.getByTestId('log-meal')
      await logBtn.scrollIntoViewIfNeeded()
      await logBtn.click()
      const sheet = page.getByTestId('log-meal-sheet')
      await quickItem(sheet, 'quick-recent', 'Apple and peanut butter').getByTestId('quick-log-item').click()
      await expect(sheet).toHaveCount(0)
      await expect(page.getByTestId('logged-note')).toBeInViewport({ ratio: 1 })
      const undo = page.getByTestId('status-undo')
      await expect(undo).toBeInViewport({ ratio: 1 })
      await expect(logBtn).toBeFocused()
      await expect(logBtn).toBeInViewport()
      // Undo sits just before Log a meal in the Tab order.
      await page.keyboard.press('Shift+Tab')
      await expect(undo).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('logged-note')).toHaveText(copy.quickLog.undone('Apple and peanut butter'))
      await expect(row(page, 'Apple and peanut butter')).toHaveCount(1)
    })

    test('on an earlier day, a tap logs the meal on that day and says when', async ({ page }) => {
      await openDemo(page)
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('day-today')).toBeVisible()
      const before = await row(page, 'Apple and peanut butter').count()
      await page.getByTestId('log-meal').click()
      const sheet = page.getByTestId('log-meal-sheet')
      await expect(sheet.getByTestId('quick-intro')).toHaveText(/^Tap a meal to log it again on \w{3} at 1:30 AM, with the same source and values\.$/)
      await quickItem(sheet, 'quick-recent', 'Apple and peanut butter').getByTestId('quick-log-item').click()
      await expect(sheet).toHaveCount(0)
      // Still the earlier day on screen, now with the meal.
      await expect(page.getByTestId('day-today')).toBeVisible()
      await expect(row(page, 'Apple and peanut butter')).toHaveCount(before + 1)
    })

    test('your own log: a home meal saved as usual survives Export, Delete and Import, and logs in two taps', async ({ page }) => {
      await page.clock.setFixedTime(MINE_NOW)
      await page.goto('/')
      await page.getByRole('button', { name: 'Start my log' }).click()
      await expect(page.getByTestId('empty-day')).toBeVisible()

      // An empty log: nothing to repeat yet, so the sheet opens on the form alone.
      await page.getByTestId('log-meal').click()
      let sheet = page.getByTestId('log-meal-sheet')
      await expect(sheet.getByTestId('meal-name-input')).toBeVisible()
      await expect(sheet.getByTestId('quick-log')).toHaveCount(0)
      await expect(sheet.getByTestId('quick-or')).toHaveCount(0)
      await sheet.getByTestId('meal-name-input').fill('Lentil stew')
      await sheet.getByTestId('source-weighed').check()
      await sheet.getByTestId('meal-kcal-input').fill('450')
      await sheet.getByTestId('optional-details').locator('summary').click()
      await sheet.getByTestId('meal-protein-input').fill('22')
      await sheet.getByTestId('save-meal').click()
      await expect(sheet).toHaveCount(0)
      // A second meal, not saved: after the import it is under Recent like any other meal.
      await page.getByTestId('log-meal').click()
      sheet = page.getByTestId('log-meal-sheet')
      await expect(sheet.getByTestId('quick-recent').getByTestId('quick-name')).toHaveText(['Lentil stew'])
      await sheet.getByTestId('meal-name-input').fill('Toast with jam')
      await sheet.getByTestId('source-label').check()
      await sheet.getByTestId('meal-kcal-input').fill('210')
      await sheet.getByTestId('save-meal').click()
      await expect(sheet).toHaveCount(0)
      await saveAsUsual(page, 'Lentil stew', 'Home lentil stew')

      // Export, delete, import.
      await page.getByTestId('open-profile').click()
      const panel = page.getByTestId('profile-privacy')
      const [download] = await Promise.all([page.waitForEvent('download'), panel.getByTestId('export-data').click()])
      const path = test.info().outputPath(download.suggestedFilename())
      await download.saveAs(path)
      const text = readFileSync(path, 'utf8')
      const exported = JSON.parse(text)
      expect(exported.savedMeals).toHaveLength(1)
      expect(exported.savedMeals[0]).toMatchObject({ name: 'Home lentil stew', source: 'weighed', kcal: 450, protein: 22, carbs: null, fat: null })

      await panel.getByTestId('delete-data').click()
      await panel.getByTestId('delete-data-confirm-btn').click()
      expect(await page.evaluate((k) => localStorage.getItem(k), E2E_KEYS.mine)).toBeNull()
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), panel.getByTestId('import-data').click()])
      await chooser.setFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(text) })
      await expect(panel.getByTestId('import-preview-holds')).toContainText('2 meals, 0 nights of sleep and 1 saved meal')
      await panel.getByTestId('import-confirm').click()
      await page.keyboard.press('Escape')
      await expect(panel).toHaveCount(0)

      // The imported meals are under Recent, but for the one saved as usual, which is under Saved
      // (offered once); two taps log it.
      const t = tapCounter()
      await t.tap(page.getByTestId('log-meal'))
      sheet = page.getByTestId('log-meal-sheet')
      await expect(sheet.getByTestId('quick-recent').getByTestId('quick-name')).toHaveText(['Toast with jam'])
      await expect(sheet.getByTestId('quick-saved').getByTestId('quick-name')).toHaveText(['Home lentil stew'])
      await t.tap(quickItem(sheet, 'quick-saved', 'Home lentil stew').getByTestId('quick-log-item'))
      await expect(sheet).toHaveCount(0)
      expect(t.count).toBe(2)
      await expect(row(page, 'Home lentil stew')).toHaveCount(1)
      expect(await digits(page.getByTestId('headline-kcal'))).toBe('1110')
      const stored = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), E2E_KEYS.mine)) as string)
      expect(stored.savedMeals).toEqual(exported.savedMeals)
      expect(stored.meals).toHaveLength(3)
      expect(stored.meals[2]).toMatchObject({ name: 'Home lentil stew', source: 'weighed', kcal: 450, protein: 22 })
      expect(stored.meals[2].id).not.toBe(stored.meals[0].id)
    })
  })
}
