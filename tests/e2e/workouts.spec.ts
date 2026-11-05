// Build-out item 2.5a (slice 10; prd.md > Workouts and Net Calories): log, edit and delete a
// workout, and net calories as the headline, with eaten and burned under it, each one tap from its
// detail. Every journey runs once in each look this build offers (looks.ts): the numbers are the
// same in every look, only the presentation differs.
//
// The person is the fictional Sam (fixtures/demo-week.json). Expected values, worked by hand:
// - Sam's Wednesday is G11: eaten 2,280 kcal, sd 381.2 (e 16.72%), score 83.
// - A 300 kcal rough guess (burn_guess, e 50%): sd 150, score 50, likely 300 / 1.5^1.2816 = 178 to
//   300 × 1.6810 = 504, very likely 300 / 2.2140 = 136 to 664.
// - Net 2,280 − 300 = 1,980, sd √(381.2² + 150²) = 409.7: likely 1,980 ± 525 = 1,455–2,505, very
//   likely 1,980 ± 803 = 1,177–2,783.
// - Monday: eaten 290 + 560 + 610 = 1,460, the demo's Brisk walk 210 kcal (device): net 1,250.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { LOOKS, startInLook } from './looks'

// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock).
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')

/** Text with thousands separators removed, so "1,455–2,505" reads as "1455–2505". */
async function digits(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/,/g, '')
}

async function openDemo(page: Page) {
  await page.clock.setFixedTime(DEMO_NOW)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the fictional demo' }).click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function opened(page: Page, testId: string): Promise<Locator> {
  const sheet = page.getByTestId(testId)
  await expect(sheet).toBeVisible()
  return sheet
}

async function closeWithEsc(page: Page, testId: string) {
  await page.keyboard.press('Escape')
  await expect(page.getByTestId(testId)).toHaveCount(0)
}

interface WorkoutInput {
  name: string
  source?: 'burn_device' | 'burn_machine' | 'burn_guess'
  kcal?: string
  minutes?: string
  when?: string
}

async function logWorkout(page: Page, w: WorkoutInput) {
  await page.getByTestId('log-workout').click()
  const sheet = await opened(page, 'workout-sheet')
  await expect(sheet.getByRole('heading', { name: 'Log a workout' })).toBeVisible()
  await sheet.getByTestId('workout-name-input').fill(w.name)
  if (w.source) await sheet.getByTestId(`source-${w.source}`).check()
  if (w.kcal !== undefined) await sheet.getByTestId('workout-kcal-input').fill(w.kcal)
  if (w.minutes !== undefined) await sheet.getByTestId('workout-minutes-input').fill(w.minutes)
  if (w.when !== undefined) await sheet.getByTestId('workout-when-input').fill(w.when)
  await sheet.getByTestId('save-workout').click()
  await expect(sheet).toBeHidden()
}

for (const { id: look, name: lookName } of LOOKS) {
  test.describe(`item 2.5a in the ${lookName} look: workouts and net calories`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('the workout sheet: each source shows its typical error as an assumption, and the ranges once calories are in', async ({
      page,
    }) => {
      await openDemo(page)
      await page.getByTestId('log-workout').click()
      const sheet = await opened(page, 'workout-sheet')
      // No default under "How do you know?".
      for (const id of ['burn_device', 'burn_machine', 'burn_guess']) await expect(sheet.getByTestId(`source-${id}`)).not.toBeChecked()
      const options = sheet.locator('.source-option')
      await expect(options).toHaveCount(3)
      await expect(options.nth(0)).toContainText('Device or watch estimate')
      await expect(options.nth(0)).toContainText('typical error 40%')
      await expect(options.nth(1)).toContainText('Machine display')
      await expect(options.nth(1)).toContainText('typical error 30%')
      await expect(options.nth(2)).toContainText('Rough guess')
      await expect(options.nth(2)).toContainText('typical error 50%')
      for (let i = 0; i < 3; i += 1) await expect(options.nth(i).getByTestId('basis-tag')).toHaveText('assumption')

      // Calories with no source: Save waits for it, and says why.
      await sheet.getByTestId('workout-name-input').fill('Evening run')
      await sheet.getByTestId('workout-kcal-input').fill('300')
      await expect(sheet.getByTestId('workout-source-hint')).toHaveText('Pick how you know, so HowSure can say how sure.')
      await expect(sheet.getByTestId('save-workout')).toBeDisabled()
      await sheet.getByTestId('source-burn_guess').check()
      await expect(sheet.getByTestId('workout-range-preview')).toHaveText(
        'With this source: likely 178–504 kcal, very likely 136–664 kcal.',
      )
      // Letters, and a duration of 0, are refused inline; everything typed stays.
      await sheet.getByTestId('workout-kcal-input').fill('abc')
      await expect(sheet.getByTestId('workout-kcal-error')).toHaveText('Use digits, e.g. 1501 or 13.9')
      await expect(sheet.getByTestId('save-workout')).toBeDisabled()
      await sheet.getByTestId('workout-kcal-input').fill('300')
      await sheet.getByTestId('workout-minutes-input').fill('0')
      await expect(sheet.getByTestId('workout-minutes-error')).toBeVisible()
      await expect(sheet.getByTestId('save-workout')).toBeDisabled()
      await sheet.getByTestId('workout-minutes-input').fill('35')
      await expect(sheet.getByTestId('workout-name-input')).toHaveValue('Evening run')
      // It starts now, on the day on screen.
      await expect(sheet.getByTestId('workout-waking-day')).toHaveText('Waking day: Wed · awake since 1:20 PM')
      await expect(sheet.getByTestId('save-workout')).toBeEnabled()

      // Cancel changes nothing: the headline is still calories eaten.
      await closeWithEsc(page, 'workout-sheet')
      await expect(page.getByTestId('headline')).toHaveAttribute('data-mode', 'eaten')
      await expect(page.getByTestId('headline-eaten')).toHaveCount(0)
    })

    test('edit and delete: the headline follows, and deleting the only workout brings back calories eaten', async ({ page }) => {
      await openDemo(page)
      await logWorkout(page, { name: 'Evening run', source: 'burn_guess', kcal: '300', minutes: '35' })
      expect(await digits(page.getByTestId('headline-kcal'))).toBe('1980')

      // The day lists its workouts (on the timeline in Night); a row opens the workout's details.
      const row = page.getByTestId('dashboard').getByTestId('workout-row').filter({ hasText: 'Evening run' })
      await expect(row).toContainText('300 kcal burned')
      await expect(row).toContainText('35 min')
      await expect(row).toContainText('Rough guess')
      await row.getByTestId('workout-open').click()
      const details = await opened(page, 'workout-details')
      await details.getByTestId('edit-workout').click()
      const edit = await opened(page, 'workout-sheet')
      await expect(edit.getByRole('heading', { name: 'Edit: Evening run' })).toBeVisible()
      await expect(edit.getByTestId('workout-kcal-input')).toHaveValue('300')
      await expect(edit.getByTestId('source-burn_guess')).toBeChecked()
      await edit.getByTestId('workout-kcal-input').fill('200')
      await edit.getByTestId('source-burn_machine').check()
      await edit.getByTestId('save-workout').click()
      await expect(edit).toBeHidden()
      expect(await digits(page.getByTestId('headline-kcal'))).toBe('2080')
      await expect(page.getByTestId('headline-burned')).toContainText('200')

      // Delete asks first; Keep changes nothing.
      await row.getByTestId('workout-open').click()
      const again = await opened(page, 'workout-details')
      await again.getByTestId('delete-workout').click()
      await expect(again.getByTestId('workout-delete-confirm')).toContainText('Delete Evening run?')
      await again.getByTestId('workout-delete-keep').click()
      await expect(again.getByTestId('workout-delete-confirm')).toHaveCount(0)
      await again.getByTestId('delete-workout').click()
      await again.getByTestId('workout-delete-confirm-btn').click()
      await expect(again).toBeHidden()

      await expect(page.getByTestId('headline')).toHaveAttribute('data-mode', 'eaten')
      await expect(page.locator('.headline-label')).toHaveText('Calories today')
      expect(await digits(page.getByTestId('headline-kcal'))).toBe('2280')
      await expect(page.getByTestId('day-score')).toHaveText('Estimate score 83')
      await expect(page.getByTestId('headline-eaten')).toHaveCount(0)
      await expect(page.getByTestId('dashboard').getByTestId('workout-row')).toHaveCount(0)
      // And it stays deleted after a reload.
      await page.reload()
      await expect(page.getByTestId('headline')).toHaveAttribute('data-mode', 'eaten')
    })

    test('a workout with unknown calories is never counted as 0: net waits, and it is listed under Missing information', async ({
      page,
    }) => {
      await openDemo(page)
      await logWorkout(page, { name: 'Swim', minutes: '40' })
      await expect(page.getByTestId('headline')).toHaveAttribute('data-mode', 'net')
      await expect(page.getByTestId('headline-kcal')).toHaveText('Not available yet')
      await expect(page.getByTestId('headline-burned')).toContainText('unknown')
      expect(await digits(page.getByTestId('headline-eaten'))).toContain('2280')
      await expect(page.getByTestId('unknown-workout-count')).toHaveText('1 workout with unknown calories burned')
      await expect(page.getByTestId('missing-workout')).toContainText('Swim')
      await expect(page.getByTestId('missing-workout')).toContainText('calories burned unknown')
      await page.getByTestId('missing-workout').getByRole('button', { name: 'Swim' }).click()
      const details = await opened(page, 'workout-details')
      await expect(details.getByTestId('workout-kcal')).toHaveText('Calories burned unknown')
      await expect(details.getByTestId('workout-likely')).toHaveCount(0)
      await closeWithEsc(page, 'workout-details')

      // With a known workout too, net counts the known one and says it is known entries only.
      await logWorkout(page, { name: 'Walk', source: 'burn_device', kcal: '200' })
      expect(await digits(page.getByTestId('headline-kcal'))).toBe('2080')
      await expect(page.locator('.headline-label')).toHaveText('Net calories, known entries only')
      await expect(page.getByTestId('day-status')).toContainText('Known entries only — incomplete day')
    })

    // Net below 0, an everyday case early in a day: Sam logs a 3,200 kcal device estimate on G11.
    // By hand: net 2,280 − 3,200 = −920, sd √(381.2² + 1,280²) = 1,335.6, so likely −920 ± 1,711.7
    // = −2,632 to 792 and very likely −920 ± 2,617.8 = −3,538 to 1,698. Every look writes a range
    // with an end below 0 as "lo to hi", never with a dash after a minus sign.
    test('net below 0: a real minus sign, and every look writes its ranges as "lo to hi"', async ({ page }) => {
      await openDemo(page)
      await logWorkout(page, { name: 'Long ride', source: 'burn_device', kcal: '3200', minutes: '240' })
      await expect(page.getByTestId('headline')).toHaveAttribute('data-mode', 'net')
      await expect(page.getByTestId('headline-kcal')).toHaveText('−920')
      const likely = page.getByTestId('likely-range')
      const veryLikely = page.getByTestId('very-likely-range')
      if (look === 'night') {
        await expect(likely).toHaveText('likely −2,632 to 792 kcal')
        await expect(veryLikely).toHaveText('very likely −3,538 to 1,698 kcal')
        await expect(likely.locator('b')).toHaveText('−2,632 to 792')
      } else {
        await expect(likely).toContainText('−2,632 to 792 kcal')
        await expect(veryLikely).toContainText('−3,538 to 1,698 kcal')
      }
      for (const range of [likely, veryLikely]) expect(await range.innerText()).not.toMatch(/−[\d,]+–/)
      if (look === 'journal') {
        // The bar runs below 0, so a labelled tick marks where 0 falls.
        await expect(page.getByTestId('range-zero')).toHaveCount(1)
      } else if (look === 'panel') {
        await expect(page.locator('.ring-centre .unit')).toHaveText('kcal net')
      }
      // Without a workout that pushes net below 0, no zero mark is drawn.
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('range-zero')).toHaveCount(0)
    })

    test('a workout belongs to the waking day it started in; the demo’s Monday walk shows net on Monday', async ({ page }) => {
      await openDemo(page)
      // Started before Wednesday's 1:20 PM wake: it lands on Tuesday, and the sheet says so.
      await page.getByTestId('log-workout').click()
      const sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('workout-name-input').fill('Morning bike')
      await sheet.getByTestId('source-burn_device').check()
      await sheet.getByTestId('workout-kcal-input').fill('250')
      await sheet.getByTestId('workout-when-input').fill('2026-10-21T11:00')
      await expect(sheet.getByTestId('workout-waking-day')).toHaveText('Waking day: Tue · awake since 1:05 PM')
      await expect(sheet.getByTestId('workout-other-day')).toBeVisible()
      await sheet.getByTestId('save-workout').click()
      await expect(sheet).toBeHidden()
      // Wednesday keeps its eaten headline.
      await expect(page.getByTestId('headline')).toHaveAttribute('data-mode', 'eaten')
      expect(await digits(page.getByTestId('headline-kcal'))).toBe('2280')
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('waking-day')).toHaveText('Tue · awake since 1:05 PM')
      await expect(page.getByTestId('headline')).toHaveAttribute('data-mode', 'net')
      await expect(page.locator('.headline-label')).toHaveText('Net calories that day')
      await expect(page.getByTestId('dashboard').getByTestId('workout-row')).toContainText('Morning bike')

      // Monday: the demo's Brisk walk, 210 kcal from a device.
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('waking-day')).toHaveText('Mon · awake since 1:15 PM')
      expect(await digits(page.getByTestId('headline-kcal'))).toBe('1250')
      expect(await digits(page.getByTestId('headline-eaten'))).toContain('1460')
      expect(await digits(page.getByTestId('headline-burned'))).toContain('210')
      await page.getByTestId('headline-burned').click()
      const list = await opened(page, 'workouts-sheet')
      await expect(list.getByRole('heading', { name: 'Burned that day' })).toBeVisible()
      await expect(list.getByTestId('workout-row')).toContainText('Brisk walk')
      await expect(list.getByTestId('workout-row')).toContainText('45 min')
      await expect(list.getByTestId('workout-row')).toContainText('Device or watch estimate')
      await expect(list.getByTestId('burned-score')).toHaveText('Estimate score 60')
    })
  })
}
