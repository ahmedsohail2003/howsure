// Build-out item 2.5b, by the owner's decision: the estimated deficit or surplus under the
// headline, when resting burn can be worked out from body details, always called an estimate. Without age, sex,
// height and weight nothing is shown and one line invites adding them. Every journey runs once in
// each look this build offers (looks.ts): the numbers are the same in every look.
//
// The person is the fictional Sam (fixtures/demo-week.json and fixtures/saved/v1-mine.json), with
// made-up body details: 34 years, female, 168 cm, 64 kg, mostly sitting. Resting burn is
// 10 × 64 + 6.25 × 168 − 5 × 34 − 161 = 1,359 kcal a day (golden E1), typical error 10%.
// Worked by hand (src/ui/__tests__/balance-view.test.ts has the same cases):
// - Wednesday, the demo's current day (wake Wed 1:20 PM, now Thu 1:30 AM: 12 h 10 min, 0.50694 of a
//   day): everyday burn 1,359 × 1.2 × 0.50694 = 826.7 (sd 82.7). Eaten 2,280 (sd 381.2), so the
//   balance is +1,453.3, sd √(381.2² + 82.7²) = 390.1: "Estimated surplus 1,453 kcal so far",
//   likely 1,453.3 ± 499.9 = 953–1,953 kcal surplus.
// - With a 300 kcal rough guess (sd 150) logged on Wednesday: +1,153.3, "Estimated surplus 1,153
//   kcal so far".
// - Monday (23 h 50 min to Tuesday's wake): everyday 1,619.48 plus the Brisk walk 210 = 1,829.48;
//   eaten 1,460; balance −369.48: "Estimated deficit 369 kcal", likely 82–657 kcal deficit.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { LOOKS, startInLook } from './looks'
import { E2E_KEYS } from './storage-keys'

const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')
const MINE_NOW = new Date('2026-10-28T20:00:00-04:00')
const V1_MINE = readFileSync(fileURLToPath(new URL('../../fixtures/saved/v1-mine.json', import.meta.url)), 'utf8')

async function openDemo(page: Page) {
  await page.clock.setFixedTime(DEMO_NOW)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the fictional demo' }).click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function openMine(page: Page) {
  await page.clock.setFixedTime(MINE_NOW)
  await page.goto('/')
  await page.evaluate(
    (entries) => {
      for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v)
    },
    { [E2E_KEYS.mine]: V1_MINE, [E2E_KEYS.active]: 'mine' },
  )
  await page.reload()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function opened(page: Page, testId: string): Promise<Locator> {
  const sheet = page.getByTestId(testId)
  await expect(sheet).toBeVisible()
  return sheet
}

/** Fill Body details with Sam's made-up numbers and save. */
async function fillSam(page: Page, sheet: Locator) {
  await sheet.getByTestId('body-age-input').fill('34')
  await sheet.getByTestId('body-sex-female').check()
  await sheet.getByTestId('body-height-cm-input').fill('168')
  await sheet.getByTestId('body-weight-input').fill('64')
  await expect(sheet.getByTestId('body-activity-sitting')).toBeChecked()
  await sheet.getByTestId('save-body').click()
  await expect(sheet).toBeHidden()
}

const headline = (page: Page) => page.getByTestId('headline')

for (const { id: look, name: lookName } of LOOKS) {
  test.describe(`item 2.5b in the ${lookName} look: estimated deficit or surplus`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('without body details nothing is shown, and one line invites adding them; it opens Body details', async ({ page }) => {
      await openDemo(page)
      const invite = headline(page).getByTestId('balance-invite')
      await expect(invite).toHaveText('Add Sam’s age, sex, height and weight to see an estimated deficit or surplus. ›')
      await expect(headline(page).getByTestId('balance')).toHaveCount(0)
      await expect(headline(page)).not.toContainText(/Estimated (deficit|surplus)/)
      await invite.click()
      const sheet = await opened(page, 'body-sheet')
      await expect(sheet.getByRole('heading', { name: 'Body details' })).toBeVisible()
      await expect(sheet).toContainText('Sam’s body details are made up, like the rest of the demo.')
      // Cancel changes nothing.
      await sheet.getByTestId('body-age-input').fill('34')
      await sheet.getByTestId('cancel-body').click()
      await expect(sheet).toBeHidden()
      await expect(invite).toBeVisible()

      // Only part of them: the line names what is still missing.
      await invite.click()
      await sheet.getByTestId('body-age-input').fill('34')
      await sheet.getByTestId('body-sex-unspecified').check()
      await expect(sheet.getByTestId('body-sex-hint')).toHaveText('Prefer not to say uses the middle of the two values, with a wider range.')
      await sheet.getByTestId('save-body').click()
      await expect(invite).toHaveText('Add Sam’s height and weight to see an estimated deficit or surplus. ›')
    })

    test('with body details: the estimated surplus so far under the headline, one tap from its explanation', async ({ page }) => {
      await openDemo(page)
      await headline(page).getByTestId('balance-invite').click()
      await fillSam(page, await opened(page, 'body-sheet'))

      const line = headline(page).getByTestId('balance')
      await expect(line.getByTestId('balance-text')).toHaveText('Estimated surplus 1,453 kcal so far')
      await expect(line.getByTestId('balance-range')).toHaveText(
        look === 'night' ? 'likely 953–1,953 surplus' : 'likely 953–1,953 kcal surplus',
      )
      await expect(line).toHaveAttribute('data-direction', 'surplus')
      await expect(line).toHaveAccessibleName('Estimated surplus 1,453 kcal so far, likely 953–1,953 kcal surplus. Opens how it is worked out.')
      await expect(headline(page).getByTestId('balance-invite')).toHaveCount(0)
      // The headline itself is unchanged: still calories eaten, 2,280.
      await expect(headline(page)).toHaveAttribute('data-mode', 'eaten')
      await expect(headline(page).getByTestId('headline-kcal')).toHaveText('2,280')

      await line.click()
      const sheet = await opened(page, 'explain-balance')
      await expect(sheet.getByRole('heading', { name: 'Estimated deficit or surplus' })).toBeVisible()
      await expect(sheet.getByTestId('explain-balance-total')).toHaveText('Estimated surplus 1,453 kcal so far')
      await expect(sheet.getByTestId('explain-balance-likely')).toContainText('953–1,953 kcal surplus')
      await expect(sheet.getByTestId('explain-balance-eaten')).toContainText('2,280 kcal')
      await expect(sheet.getByTestId('explain-balance-resting')).toContainText('1,359 kcal a day')
      await expect(sheet.getByTestId('explain-balance-activity')).toContainText('Mostly sitting, × 1.2 (the default)')
      await expect(sheet.getByTestId('explain-balance-hours')).toContainText('12 h 10 min (51% of a day)')
      await expect(sheet.getByTestId('explain-balance-everyday')).toContainText('827 kcal')
      await expect(sheet.getByTestId('explain-balance-workouts')).toContainText('0 kcal')
      // A surplus carries its sign, as a deficit does, so the sum can be redone without the heading.
      await expect(sheet.getByTestId('explain-balance-sum')).toContainText('+1,453 kcal')
      await expect(sheet.getByTestId('balance-time')).toContainText('still going')
      await expect(sheet.getByTestId('balance-equation')).toHaveText(
        'Mifflin-St Jeor: 10 × 64 kg + 6.25 × 168 cm − 5 × 34 − 161 = 1,359 kcal a day at rest.',
      )
      await expect(sheet.getByTestId('balance-weight')).toContainText('64 kg, from body details')
      // The share of a day to four decimals, so the sum can be redone: 1,359 × 1.2 × 0.5069 = 826.7.
      await expect(sheet.getByTestId('balance-everyday-line')).toHaveText('Everyday burn = 1,359 × 1.2 × 0.5069 of a day = 827 kcal.')
      await expect(sheet.getByTestId('balance-not-counted')).toContainText('What is not counted')
      await expect(sheet.getByTestId('balance-not-counted')).toContainText('may count twice')
      await expect(sheet).toContainText('not a measurement')
      await sheet.locator('summary').click()
      await expect(sheet.getByTestId('balance-source')).toContainText('Mifflin-St Jeor equation · typical error 10%')
      await expect(sheet.getByTestId('balance-source')).toContainText('assumption')
      await expect(sheet.getByTestId('balance-source')).toContainText('Frankenfield et al. 2005, J Am Diet Assoc')
      await expect(sheet.getByTestId('balance-source')).toContainText('DOI 10.1016/j.jada.2005.02.005')
      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)
      await expect(line).toBeFocused()
    })

    test('under the net headline a logged workout counts once; an earlier day counts the whole day and says deficit', async ({ page }) => {
      await openDemo(page)
      await headline(page).getByTestId('balance-invite').click()
      await fillSam(page, await opened(page, 'body-sheet'))

      await page.getByTestId('log-workout').click()
      const ws = await opened(page, 'workout-sheet')
      await ws.getByTestId('workout-name-input').fill('Evening run')
      await ws.getByTestId('source-burn_guess').check()
      await ws.getByTestId('workout-kcal-input').fill('300')
      await ws.getByTestId('save-workout').click()
      await expect(ws).toBeHidden()
      await expect(headline(page)).toHaveAttribute('data-mode', 'net')
      await expect(headline(page).getByTestId('balance-text')).toHaveText('Estimated surplus 1,153 kcal so far')
      // Net's note on burned says the estimate beside it adds resting burn.
      await expect(headline(page).getByTestId('net-resting')).toHaveText(
        'Burned counts the workouts you logged; the estimated deficit or surplus adds your resting burn.',
      )
      await headline(page).getByTestId('balance').click()
      const sheet = await opened(page, 'explain-balance')
      await expect(sheet.getByTestId('explain-balance-workouts')).toContainText('300 kcal')
      await page.keyboard.press('Escape')
      // Net's own explanation keeps its resting-burn note and points to the line that adds it.
      await headline(page).getByTestId('ranges').click()
      const net = await opened(page, 'explain-net')
      await expect(net.getByTestId('net-note')).toBeVisible()
      await expect(net.getByTestId('net-balance-pointer')).toContainText('adds an estimate of your resting burn')
      await page.keyboard.press('Escape')

      // Monday: from its wake to Tuesday's, with the demo's Brisk walk.
      await page.getByTestId('day-prev').click()
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('waking-day')).toHaveText('Mon · awake since 1:15 PM')
      const line = headline(page).getByTestId('balance')
      await expect(line.getByTestId('balance-text')).toHaveText('Estimated deficit 369 kcal')
      await expect(line.getByTestId('balance-range')).toHaveText(look === 'night' ? 'likely 82–657 deficit' : 'likely 82–657 kcal deficit')
      await expect(line).toHaveAttribute('data-direction', 'deficit')
      await line.click()
      const mon = await opened(page, 'explain-balance')
      await expect(mon.getByTestId('explain-balance-very-likely')).toContainText('70 kcal surplus to 809 kcal deficit')
      await expect(mon.getByTestId('explain-balance-workouts')).toContainText('210 kcal')
      await expect(mon.getByTestId('explain-balance-sum')).toContainText('−369 kcal')
      await expect(mon.getByTestId('balance-everyday-line')).toHaveText('Everyday burn = 1,359 × 1.2 × 0.9931 of a day = 1,619 kcal.')
      await expect(mon.getByTestId('balance-time')).toHaveText('Counted from this day’s wake (Mon 1:15 PM) to the next wake (Tue 1:05 PM).')
    })

    test('a day whose workouts all have unknown calories shows no estimate (never 0 burned), as net waits too', async ({ page }) => {
      await openDemo(page)
      await headline(page).getByTestId('balance-invite').click()
      await fillSam(page, await opened(page, 'body-sheet'))
      await expect(headline(page).getByTestId('balance')).toBeVisible()

      // A workout with no calories: net says it is not available, and no estimate appears under it.
      await page.getByTestId('log-workout').click()
      const ws = await opened(page, 'workout-sheet')
      await ws.getByTestId('workout-name-input').fill('Swim')
      await ws.getByTestId('workout-minutes-input').fill('40')
      await ws.getByTestId('save-workout').click()
      await expect(ws).toBeHidden()
      await expect(headline(page)).toHaveAttribute('data-mode', 'net')
      await expect(headline(page).getByTestId('headline-kcal')).toHaveText('Not available yet')
      await expect(headline(page).getByTestId('balance')).toHaveCount(0)
      await expect(headline(page).getByTestId('balance-invite')).toHaveCount(0)
      await expect(headline(page)).not.toContainText(/Estimated (deficit|surplus)/)

      // With a known workout beside it, the known one counts and the line says known entries only.
      await page.getByTestId('log-workout').click()
      await ws.getByTestId('workout-name-input').fill('Evening run')
      await ws.getByTestId('source-burn_guess').check()
      await ws.getByTestId('workout-kcal-input').fill('300')
      await ws.getByTestId('save-workout').click()
      await expect(ws).toBeHidden()
      await expect(headline(page).getByTestId('balance-text')).toHaveText('Estimated surplus 1,153 kcal so far')
      await expect(headline(page).getByTestId('balance-range')).toContainText('Known entries only')
    })

    test('Body details checks each box as it is typed and keeps feet, inches and pounds as typed', async ({ page }) => {
      await openDemo(page)
      await page.getByTestId('open-more').click()
      await page.getByTestId('more-body').click()
      const sheet = await opened(page, 'body-sheet')
      await sheet.getByTestId('body-age-input').fill('17')
      await expect(sheet.getByTestId('body-age-error')).toHaveText('Type an age from 18 to 120, in whole years. The equation is for adults.')
      await expect(sheet.getByTestId('save-body')).toBeDisabled()
      await sheet.getByTestId('body-age-input').fill('34')
      await expect(sheet.getByTestId('body-age-error')).toHaveCount(0)
      await sheet.getByTestId('body-sex-female').check()
      await sheet.getByTestId('body-height-unit-ftin').check()
      await sheet.getByTestId('body-height-ft-input').fill('5')
      await sheet.getByTestId('body-height-in-input').fill('7')
      await sheet.getByTestId('body-weight-unit-lb').check()
      await sheet.getByTestId('body-weight-input').fill('700')
      await expect(sheet.getByTestId('body-weight-error')).toHaveText('Type a weight from 66 to 660 lb.')
      await sheet.getByTestId('body-weight-input').fill('141')
      await sheet.getByTestId('body-activity-light').check()
      await sheet.getByTestId('save-body').click()
      await expect(sheet).toBeHidden()
      await expect(headline(page).getByTestId('balance')).toBeVisible()

      // Reopened, the boxes read back the same way, and the explanation shows them so.
      await page.getByTestId('open-more').click()
      await page.getByTestId('more-body').click()
      await expect(sheet.getByTestId('body-height-ft-input')).toHaveValue('5')
      await expect(sheet.getByTestId('body-height-in-input')).toHaveValue('7')
      await expect(sheet.getByTestId('body-weight-input')).toHaveValue('141')
      await expect(sheet.getByTestId('body-activity-light')).toBeChecked()
      await sheet.getByTestId('cancel-body').click()
      await headline(page).getByTestId('balance').click()
      const explain = await opened(page, 'explain-balance')
      await expect(explain.getByTestId('balance-inputs')).toContainText('5 ft 7 in')
      await expect(explain.getByTestId('balance-inputs')).toContainText('141 lb, from body details')
      await expect(explain.getByTestId('explain-balance-activity')).toContainText('Some standing and walking, × 1.375')
    })

    test('switching a unit converts the amount already in the box, and switching back puts it back', async ({ page }) => {
      await openDemo(page)
      await headline(page).getByTestId('balance-invite').click()
      const sheet = await opened(page, 'body-sheet')
      await sheet.getByTestId('body-age-input').fill('34')
      await sheet.getByTestId('body-sex-female').check()
      await sheet.getByTestId('body-height-cm-input').fill('168')
      await sheet.getByTestId('body-weight-input').fill('64')

      // 64 kg is 141.1 lb, never 64 lb.
      await sheet.getByTestId('body-weight-unit-lb').check()
      await expect(sheet.getByLabel('Weight (lb)')).toHaveValue('141.1')
      await sheet.getByTestId('body-weight-unit-kg').check()
      await expect(sheet.getByLabel('Weight (kg)')).toHaveValue('64')
      await sheet.getByTestId('body-weight-unit-lb').check()

      // 168 cm is 5 ft 6.1 in; unchanged, it comes back as 168.
      await sheet.getByTestId('body-height-unit-ftin').check()
      await expect(sheet.getByTestId('body-height-ft-input')).toHaveValue('5')
      await expect(sheet.getByTestId('body-height-in-input')).toHaveValue('6.1')
      await sheet.getByTestId('body-height-unit-cm').check()
      await expect(sheet.getByTestId('body-height-cm-input')).toHaveValue('168')
      // A new amount typed in feet and inches is carried over too: 5 ft 8 in is 172.7 cm.
      await sheet.getByTestId('body-height-unit-ftin').check()
      await sheet.getByTestId('body-height-in-input').fill('8')
      await sheet.getByTestId('body-height-unit-cm').check()
      await expect(sheet.getByTestId('body-height-cm-input')).toHaveValue('172.7')
      // An amount the form refuses never turns into an accepted one: 5 ft 12 in leaves cm blank.
      await sheet.getByTestId('body-height-unit-ftin').check()
      await sheet.getByTestId('body-height-in-input').fill('12')
      await expect(sheet.getByTestId('body-height-in-error')).toHaveText('Inches run from 0 to 11.9.')
      await sheet.getByTestId('body-height-unit-cm').check()
      await expect(sheet.getByTestId('body-height-cm-input')).toHaveValue('')
      await sheet.getByTestId('body-height-cm-input').fill('172.7')
      await sheet.getByTestId('save-body').click()
      await expect(sheet).toBeHidden()

      await headline(page).getByTestId('balance').click()
      const explain = await opened(page, 'explain-balance')
      await expect(explain.getByTestId('balance-inputs')).toContainText('172.7 cm')
      await expect(explain.getByTestId('balance-weight')).toContainText('141.1 lb, from body details')
      await expect(explain.getByRole('heading', { name: 'The equation' })).toBeVisible()
      await expect(explain.getByTestId('balance-equation')).toHaveText(
        'Mifflin-St Jeor: 10 × 64 kg + 6.25 × 172.7 cm − 5 × 34 − 161 = 1,388 kcal a day at rest.',
      )
    })

    test('a saved log whose body details are outside the form’s ranges shows the invite, not an estimate', async ({ page }) => {
      const doc = JSON.parse(V1_MINE)
      doc.profile.body = { age: 1000, sex: 'male', heightCm: 1, weightKg: 1 }
      await page.clock.setFixedTime(MINE_NOW)
      await page.goto('/')
      await page.evaluate(
        (entries) => {
          for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v)
        },
        { [E2E_KEYS.mine]: JSON.stringify(doc), [E2E_KEYS.active]: 'mine' },
      )
      await page.reload()
      await expect(headline(page).getByTestId('balance-invite')).toHaveText(
        'Add your age, height and weight in Profile to see an estimated deficit or surplus. ›',
      )
      await expect(headline(page).getByTestId('balance')).toHaveCount(0)
    })

    test('a weigh-in from weeks ago is named by its date, without a time it never had', async ({ page }) => {
      const doc = JSON.parse(V1_MINE)
      doc.profile.body = { age: 34, sex: 'female', heightCm: 168, weightKg: 64 }
      doc.weighIns = [{ id: 'weigh-mine-old', at: '2026-09-22T12:00:00-04:00', kg: 63, unit: 'kg', timeApproximate: true }]
      await page.clock.setFixedTime(MINE_NOW)
      await page.goto('/')
      await page.evaluate(
        (entries) => {
          for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v)
        },
        { [E2E_KEYS.mine]: JSON.stringify(doc), [E2E_KEYS.active]: 'mine' },
      )
      await page.reload()
      await headline(page).getByTestId('balance').click()
      const explain = await opened(page, 'explain-balance')
      await expect(explain.getByTestId('balance-weight')).toContainText('63 kg, from your Tue 22 Sep weigh-in')
      await page.keyboard.press('Escape')
      await page.getByTestId('open-more').click()
      await page.getByTestId('more-body').click()
      const sheet = await opened(page, 'body-sheet')
      await expect(sheet.getByTestId('body-weighin-hint')).toHaveText(
        'Your Tue 22 Sep weigh-in (63 kg) is used while it is the latest. This weight counts when there is none.',
      )
    })

    test('your own log: Body details in Profile and privacy, back there on Save, kept after a reload and in Export', async ({ page }) => {
      await openMine(page)
      await expect(headline(page).getByTestId('balance-invite')).toHaveText(
        'Add your age, sex, height and weight in Profile to see an estimated deficit or surplus. ›',
      )
      await page.getByTestId('open-profile').click()
      const panel = await opened(page, 'profile-privacy')
      await expect(panel.getByTestId('privacy-body-summary')).toHaveText('Not set yet.')
      await panel.getByTestId('edit-body').click()
      await fillSam(page, await opened(page, 'body-sheet'))
      await expect(panel).toBeVisible()
      await expect(panel.getByTestId('privacy-body-summary')).toHaveText('age 34 · Female · 168 cm · 64 kg · Mostly sitting')
      const [download] = await Promise.all([page.waitForEvent('download'), panel.getByTestId('export-data').click()])
      const path = test.info().outputPath(download.suggestedFilename())
      await download.saveAs(path)
      const exported = JSON.parse(readFileSync(path, 'utf8'))
      expect(exported.profile.body).toMatchObject({ age: 34, sex: 'female', heightCm: 168, weightKg: 64, activity: 'sitting' })
      await page.keyboard.press('Escape')

      await page.reload()
      await expect(headline(page).getByTestId('balance-text')).toHaveText(/^Estimated (deficit|surplus) [\d,]+ kcal so far$/)
      // Sam's own Wednesday has a meal with unknown calories, so the line says it covers known entries only.
      await expect(headline(page).getByTestId('balance-range')).toHaveText(
        look === 'night' ? 'likely 313–543 deficit · Known entries only' : 'likely 313–543 kcal deficit · Known entries only',
      )
    })
  })
}
