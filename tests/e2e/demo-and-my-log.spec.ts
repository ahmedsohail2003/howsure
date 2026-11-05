// Build-out item 2.1, part a (checklist slice 5, reshaped by the owner's decision): your own log
// is the main path and the fictional demo is a side door, each one tap from the first open.
// Returning opens the last log used. The header switch reads "Open my log" in the demo and
// "See the demo" in your own log. Reset demo restores Sam's week, asking first only when the demo
// was edited, and never touches your own log. A log with no wake time offers Set wake time, and
// when meals were logged before it, the regroup preview names which meals move into which day
// before anything is saved.
//
// Every journey runs once in each look this build offers (looks.ts). The people and meals here are
// the fictional Sam and invented foods.
import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Meal } from '../../src/kernel/types'
import { copy } from '../../src/ui/copy'
import { LOOKS, lookOnPage, startInLook } from './looks'
import { E2E_KEYS } from './storage-keys'

// Your own log runs on real time; the tests fix it at Thu 2026-11-05 10:00 in Toronto.
const NOW = new Date('2026-11-05T10:00:00-05:00')
// G11 (spec.md > Maths Core): Sam's Wednesday as the demo starts.
const G11 = { kcal: '2280', score: 'Estimate score 83' }

/** Text with thousands separators removed. */
async function digits(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/,/g, '')
}

async function read(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key)
}

async function opened(page: Page, testId: string): Promise<Locator> {
  const sheet = page.getByTestId(testId)
  await expect(sheet).toBeVisible()
  return sheet
}

async function firstOpen(page: Page) {
  await page.clock.setFixedTime(NOW)
  await page.goto('/')
  await expect(page.getByTestId('first-open')).toBeVisible()
}

function mealAt(id: string, name: string, eatenAt: string, kcal: number): Meal {
  return { id, name, eatenAt, source: 'label', kcal, protein: null, carbs: null, fat: null }
}

// Sam's own log with no wake time: a snack before midnight, one after, and two in the morning.
const PROVISIONAL = [
  mealAt('p1', 'Oat bar', '2026-11-04T22:30:00-05:00', 190),
  mealAt('p2', 'Toast', '2026-11-05T00:45:00-05:00', 240),
  mealAt('p3', 'Yogurt', '2026-11-05T08:10:00-05:00', 150),
  mealAt('p4', 'Banana', '2026-11-05T09:40:00-05:00', 105),
]
// Saved as the app saves a log (format version 1); opening it writes nothing back.
const PROVISIONAL_LOG = JSON.stringify({
  version: 1,
  kind: 'mine',
  profile: { name: '', kind: 'guest' },
  meals: PROVISIONAL,
  sleeps: [],
  workouts: [],
  plates: [],
})

async function openSeededOwnLog(page: Page, mine: string) {
  await page.clock.setFixedTime(NOW)
  await page.goto('/')
  await page.evaluate(
    ([k, v, a]) => {
      localStorage.setItem(k, v)
      localStorage.setItem(a, 'mine')
    },
    [E2E_KEYS.mine, mine, E2E_KEYS.active] as const,
  )
  await page.reload()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function logMeal(page: Page, name: string, kcal: string) {
  await page.getByTestId('log-meal').click()
  const sheet = await opened(page, 'log-meal-sheet')
  await sheet.getByTestId('meal-name-input').fill(name)
  await sheet.getByTestId('source-label').check()
  await sheet.getByTestId('meal-kcal-input').fill(kcal)
  await sheet.getByTestId('save-meal').click()
  await expect(sheet).toBeHidden()
}

async function chooseMore(page: Page, id: string) {
  await page.getByTestId('open-more').click()
  await (await opened(page, 'more-menu')).getByTestId(`more-${id}`).click()
}

/** The meal names on the day on screen, in the meal list (Journal, Panel) or the timeline (Night). */
async function dayMealNames(page: Page): Promise<string[]> {
  return page.locator('[data-testid="meal-row"] .meal-name').allInnerTexts()
}

for (const { id: look, name: lookName } of LOOKS) {
  test.describe(`item 2.1a in the ${lookName} look`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('a fresh start reaches an empty own log in one tap, with nothing invented', async ({ page }) => {
      await firstOpen(page)
      expect(await lookOnPage(page)).toBe(look)
      const start = page.getByTestId('start-mine')
      await expect(start).toHaveText('Start my log')
      await expect(start).toHaveClass(/btn-primary/)
      await expect(page.getByTestId('try-demo')).not.toHaveClass(/btn-primary/)

      await start.click()
      await expect(page.getByTestId('dashboard')).toBeVisible()
      await expect(page.getByTestId('fictional-banner')).toHaveCount(0)
      await expect(page.getByTestId('waking-day')).toHaveText('Wake time not set')
      await expect(page.getByTestId('set-wake')).toHaveText('Set wake time')
      await expect(page.getByTestId('headline-kcal')).toHaveText('Not available yet')
      await expect(page.getByTestId('empty-day')).toHaveText('No meals logged yet')
      await expect(page.getByTestId('log-switch')).toHaveText('See the demo')
      // Nothing is written to your own log until you change it: no invented meals or wake time.
      expect(await read(page, E2E_KEYS.mine)).toBeNull()
      expect(await read(page, E2E_KEYS.active)).toBe('mine')
    })

    test('the demo is one tap from the first open, and its switch reads "Open my log"', async ({ page }) => {
      await firstOpen(page)
      await page.getByTestId('try-demo').click()
      await expect(page.getByTestId('dashboard')).toBeVisible()
      await expect(page.getByTestId('fictional-banner').first()).toHaveText('Sample person — fictional')
      expect(await digits(page.getByTestId('headline-kcal'))).toBe(G11.kcal)
      await expect(page.getByTestId('log-switch')).toHaveText('Open my log')
      // The demo always has a wake time, so Set wake time isn't offered there.
      await expect(page.getByTestId('set-wake')).toHaveCount(0)

      await page.getByTestId('log-switch').click()
      await expect(page.getByTestId('fictional-banner')).toHaveCount(0)
      await expect(page.getByTestId('log-switch')).toHaveText('See the demo')
    })

    test('returning opens the last log used: after a reload, after Delete and after Import', async ({ page }) => {
      await firstOpen(page)
      await page.getByTestId('start-mine').click()
      await logMeal(page, 'Rice cake', '35')

      // Reload: your own log, with its meal.
      await page.reload()
      await expect(page.getByTestId('fictional-banner')).toHaveCount(0)
      expect(await dayMealNames(page)).toEqual(['Rice cake'])

      // Switch to the demo, reload: the demo.
      await page.getByTestId('log-switch').click()
      await expect(page.getByTestId('fictional-banner').first()).toBeVisible()
      await page.reload()
      await expect(page.getByTestId('fictional-banner').first()).toBeVisible()
      expect(await digits(page.getByTestId('headline-kcal'))).toBe(G11.kcal)

      // Back to your own log; Delete my data; a reload stays in your (now empty) own log.
      await page.getByTestId('log-switch').click()
      const exported = (await read(page, E2E_KEYS.mine)) as string
      await page.getByTestId('open-profile').click()
      const panel = await opened(page, 'profile-privacy')
      await panel.getByTestId('delete-data').click()
      await panel.getByTestId('delete-data-confirm-btn').click()
      await page.keyboard.press('Escape')
      await page.reload()
      await expect(page.getByTestId('dashboard')).toBeVisible()
      await expect(page.getByTestId('fictional-banner')).toHaveCount(0)
      await expect(page.getByTestId('empty-day')).toBeVisible()

      // Import the earlier copy; a reload opens your own log with it.
      await page.getByTestId('open-profile').click()
      const panel2 = await opened(page, 'profile-privacy')
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), panel2.getByTestId('import-data').click()])
      await chooser.setFiles({ name: 'howsure-log.json', mimeType: 'application/json', buffer: Buffer.from(exported) })
      await panel2.getByTestId('import-confirm').click()
      await page.keyboard.press('Escape')
      await page.reload()
      await expect(page.getByTestId('fictional-banner')).toHaveCount(0)
      expect(await dayMealNames(page)).toEqual(['Rice cake'])
    })

    test('your log and the demo never mix', async ({ page }) => {
      await firstOpen(page)
      await page.getByTestId('start-mine').click()
      await logMeal(page, 'Rice cake', '35')
      await page.getByTestId('log-switch').click()
      await expect(page.getByTestId('fictional-banner').first()).toBeVisible()
      expect(await dayMealNames(page)).not.toContain('Rice cake')
      expect(await digits(page.getByTestId('headline-kcal'))).toBe(G11.kcal)
      await page.getByTestId('log-switch').click()
      expect(await dayMealNames(page)).toEqual(['Rice cake'])
    })

    test('Reset demo on an unedited demo resets at once, with no confirmation', async ({ page }) => {
      await firstOpen(page)
      await page.getByTestId('start-mine').click()
      await logMeal(page, 'Rice cake', '35')
      const mine = await read(page, E2E_KEYS.mine)
      await page.getByTestId('log-switch').click()
      await expect(page.getByTestId('fictional-banner').first()).toBeVisible()

      // Reset demo is in the demo's More menu only.
      await chooseMore(page, 'resetDemo')
      await expect(page.getByTestId('reset-demo-sheet')).toHaveCount(0)
      await expect(page.getByTestId('more-menu')).toHaveCount(0)
      await expect(page.getByTestId('status-note')).toHaveText(copy.resetDemo.done)
      expect(await digits(page.getByTestId('headline-kcal'))).toBe(G11.kcal)
      await expect(page.getByTestId('day-score')).toHaveText(G11.score)
      expect(await read(page, E2E_KEYS.mine)).toBe(mine)
      // Moving to another day clears the line, as any next step does.
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('status-note')).toHaveText('')

      await page.getByTestId('log-switch').click()
      await expect(page.getByTestId('status-note')).toHaveText('')
      await page.getByTestId('open-more').click()
      await expect((await opened(page, 'more-menu')).getByTestId('more-resetDemo')).toHaveCount(0)
    })

    test('Reset demo on an edited demo asks first; Keep changes nothing, Reset restores Sam’s day', async ({ page }) => {
      await firstOpen(page)
      await page.getByTestId('start-mine').click()
      await logMeal(page, 'Rice cake', '35')
      const mine = await read(page, E2E_KEYS.mine)
      await page.getByTestId('log-switch').click()
      const pristine = await read(page, E2E_KEYS.demo)

      // Improve the pasta bake from its label: 2,380 kcal, score 92 (G11b).
      await page.getByTestId('improve-entry').click()
      const improve = await opened(page, 'log-meal-sheet')
      await improve.getByTestId('source-label').check()
      await improve.getByTestId('meal-kcal-input').fill('860')
      await improve.getByTestId('save-meal').click()
      await expect(improve).toBeHidden()
      expect(await digits(page.getByTestId('headline-kcal'))).toBe('2380')
      const edited = await read(page, E2E_KEYS.demo)

      await chooseMore(page, 'resetDemo')
      const sheet = await opened(page, 'reset-demo-sheet')
      await expect(sheet.getByTestId('fictional-banner')).toHaveText('Sample person — fictional')
      await expect(sheet.getByTestId('reset-demo-changes')).toHaveText('1 meal changed')
      await expect(sheet.getByTestId('reset-demo-discards')).toContainText('Your own log is not affected.')
      // As in the app's other discard confirmations: the discard is drawn in ink, never as the
      // teal main action; the safe choice is the outlined button.
      await expect(sheet.getByTestId('reset-demo-confirm')).toHaveClass(/btn-ink/)
      await expect(sheet.getByTestId('reset-demo-confirm')).not.toHaveClass(/btn-primary/)
      await expect(sheet.getByTestId('reset-demo-keep')).not.toHaveClass(/btn-primary|btn-ink/)

      // Keep: nothing changes.
      await sheet.getByTestId('reset-demo-keep').click()
      await expect(page.getByTestId('reset-demo-sheet')).toHaveCount(0)
      expect(await digits(page.getByTestId('headline-kcal'))).toBe('2380')
      expect(await read(page, E2E_KEYS.demo)).toBe(edited)

      // Esc: nothing changes either.
      await chooseMore(page, 'resetDemo')
      await opened(page, 'reset-demo-sheet')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('reset-demo-sheet')).toHaveCount(0)
      expect(await read(page, E2E_KEYS.demo)).toBe(edited)

      // Reset: Sam's Wednesday exactly as it started; your own log untouched.
      await chooseMore(page, 'resetDemo')
      await (await opened(page, 'reset-demo-sheet')).getByTestId('reset-demo-confirm').click()
      await expect(page.getByTestId('reset-demo-sheet')).toHaveCount(0)
      expect(await digits(page.getByTestId('headline-kcal'))).toBe(G11.kcal)
      await expect(page.getByTestId('day-score')).toHaveText(G11.score)
      await expect(page.getByTestId('status-note')).toHaveText(copy.resetDemo.done)
      // The clock is fixed in this test, so the restarted demo is stored exactly as it first was.
      expect(await read(page, E2E_KEYS.demo)).toBe(pristine)
      expect(await read(page, E2E_KEYS.mine)).toBe(mine)

      // And it survives a reload.
      await page.reload()
      expect(await digits(page.getByTestId('headline-kcal'))).toBe(G11.kcal)
      await page.getByTestId('log-switch').click()
      expect(await dayMealNames(page)).toEqual(['Rice cake'])
    })

    test('Set wake time with no meals saves at once and starts the day', async ({ page }) => {
      await firstOpen(page)
      await page.getByTestId('start-mine').click()
      await page.getByTestId('set-wake').click()
      const sheet = await opened(page, 'set-wake-sheet')
      // Today once 7:00 AM has passed, at 7:00 AM; yesterday is the other choice.
      await expect(sheet.getByTestId('set-wake-today')).toBeChecked()
      await expect(sheet.getByText('Yesterday, Wednesday')).toBeVisible()
      await expect(sheet.getByTestId('set-wake-time')).toHaveValue('07:00')
      await expect(sheet.getByTestId('set-wake-effect')).toHaveText('Your waking day will start Thu 7:00 AM.')
      // The hint names the default while the field still holds it, and goes once it is changed.
      await expect(sheet.getByTestId('set-wake-hint')).toHaveText('Filled in as 7:00 AM. Change it to when you woke up.')
      await sheet.getByTestId('set-wake-time').fill('06:30')
      await expect(sheet.getByTestId('set-wake-hint')).toHaveCount(0)
      await expect(sheet.getByTestId('set-wake-effect')).toHaveText('Your waking day will start Thu 6:30 AM.')

      // A time later than now is refused inline, and nothing is saved. The sheet states no
      // outcome it has just refused: the effect line goes while the error shows.
      await sheet.getByTestId('set-wake-time').fill('10:30')
      await sheet.getByTestId('set-wake-save').click()
      await expect(sheet.getByTestId('set-wake-error')).toHaveText(copy.sleep.errors.future)
      await expect(sheet.getByTestId('set-wake-effect')).toHaveCount(0)
      await expect(sheet.getByTestId('set-wake-time')).toHaveValue('10:30')
      expect(await read(page, E2E_KEYS.mine)).toBeNull()

      // Yesterday at 11:15 PM: no meals, so no preview; Enter in the time field saves straight away.
      await sheet.getByTestId('set-wake-yesterday').check()
      await sheet.getByTestId('set-wake-time').fill('23:15')
      await expect(sheet.getByTestId('set-wake-effect')).toHaveText('Your waking day will start Wed 11:15 PM.')
      await expect(sheet.getByTestId('set-wake-save')).toHaveText('Save')
      await sheet.getByTestId('set-wake-time').press('Enter')
      await expect(page.getByTestId('set-wake-sheet')).toHaveCount(0)
      await expect(page.getByTestId('regroup-preview')).toHaveCount(0)
      await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 11:15 PM')
      await expect(page.getByTestId('set-wake')).toHaveCount(0)
      // The button that opened the sheet has gone, so focus lands on the waking-day line.
      await expect(page.getByTestId('waking-day')).toBeFocused()
      await page.reload()
      await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 11:15 PM')
    })

    test('Set wake time after meals: the regroup preview names each meal’s day; cancel changes nothing', async ({ page }) => {
      await openSeededOwnLog(page, PROVISIONAL_LOG)
      // Before and after midnight, together in one provisional day.
      expect(await dayMealNames(page)).toEqual(['Oat bar', 'Toast', 'Yogurt', 'Banana'])

      await page.getByTestId('set-wake').click()
      const sheet = await opened(page, 'set-wake-sheet')
      await expect(sheet.getByTestId('set-wake-save')).toHaveText('Next')
      // Enter on a day choice submits the step, as the Next button does.
      await sheet.getByTestId('set-wake-today').press('Enter')
      const preview = await opened(page, 'regroup-preview')
      await expect(preview.locator('.sheet-title')).toHaveText('Where your meals will go')
      const moving = preview.getByTestId('regroup-moving')
      const staying = preview.getByTestId('regroup-staying')
      // Today after Save: Yogurt 150 + Banana 105 = 255 kcal, the headline's new number.
      await expect(moving.locator('h3')).toHaveText('Today, from Thu 7:00 AM')
      await expect(moving.getByTestId('regroup-total')).toHaveText('255 kcal')
      await expect(moving.getByTestId('regroup-meal')).toHaveText(['Thu 8:10 AMYogurt150 kcal', 'Thu 9:40 AMBanana105 kcal'])
      // Earlier: Oat bar 190 + Toast 240 = 430 kcal.
      await expect(staying.locator('h3')).toHaveText('Earlier, before you woke')
      await expect(staying.getByTestId('regroup-total')).toHaveText('430 kcal')
      await expect(staying.getByTestId('regroup-meal')).toHaveText(['Wed 10:30 PMOat bar190 kcal', 'Thu 12:45 AMToast240 kcal'])

      // Close (cancel): nothing changes, on screen or on the device.
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('regroup-preview')).toHaveCount(0)
      await expect(page.getByTestId('waking-day')).toHaveText('Wake time not set')
      expect(await read(page, E2E_KEYS.mine)).toBe(PROVISIONAL_LOG)

      // Change the time goes back to the time step with the choice kept.
      await page.getByTestId('set-wake').click()
      const again = await opened(page, 'set-wake-sheet')
      await again.getByTestId('set-wake-time').fill('09:00')
      await again.getByTestId('set-wake-save').click()
      const preview2 = await opened(page, 'regroup-preview')
      await expect(preview2.getByTestId('regroup-moving').getByTestId('regroup-meal')).toHaveText(['Thu 9:40 AMBanana105 kcal'])
      await expect(preview2.getByTestId('regroup-moving').getByTestId('regroup-total')).toHaveText('105 kcal')
      await preview2.getByTestId('regroup-back').click()
      const back = await opened(page, 'set-wake-sheet')
      await expect(back.getByTestId('set-wake-time')).toHaveValue('09:00')
      await back.getByTestId('set-wake-time').fill('07:00')
      await back.getByTestId('set-wake-save').click()
      await (await opened(page, 'regroup-preview')).getByTestId('regroup-save').click()
      await expect(page.getByTestId('regroup-preview')).toHaveCount(0)
      await expect(page.getByTestId('waking-day')).toBeFocused()

      // Saved: Thursday's day holds Yogurt and Banana (255 kcal, as the preview said); the day
      // before holds Oat bar and Toast.
      await expect(page.getByTestId('waking-day')).toHaveText('Thu · awake since 7:00 AM')
      expect(await dayMealNames(page)).toEqual(['Yogurt', 'Banana'])
      expect(await digits(page.getByTestId('headline-kcal'))).toBe('255')
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('waking-day')).toHaveText('Wake time not set')
      expect(await dayMealNames(page)).toEqual(['Oat bar', 'Toast'])
      const stored = JSON.parse((await read(page, E2E_KEYS.mine)) as string)
      expect(stored.meals).toHaveLength(4)
      expect(stored.sleeps).toEqual([{ id: expect.any(String), sleepStart: null, wake: '2026-11-05T07:00:00-05:00' }])
    })
  })
}
