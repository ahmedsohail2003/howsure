// checklist.md slice 2 Verify: improve the pasta bake from its note and watch the day narrow,
// and it all survives a reload. Covers prd.md > Improve That Entry, prd.md > Saving (editing
// a meal and switching logs; logging, deleting and sleep arrive in slices 3-4), and the
// storage failure modes in spec.md > Important Failure Modes and > Store.
import { expect, test, type Locator, type Page } from '@playwright/test'

const FICTIONAL = 'Sample person — fictional'
const DEMO_KEY = 'howsure.demo.v1'
const ACTIVE_KEY = 'howsure.active.v1'

// The demo clock starts at the fixture's wall-clock moment, Thu 2026-10-22 01:30 local
// (spec.md > Clock). This pins the page's real clock, so every run is identical.
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')

// G11 and G11b (spec.md > Maths Core: Estimates, Ranges and the Day).
const BEFORE = { kcal: '2280', score: 'Estimate score 83', likely: '1870–2780', veryLikely: '1684–3087' }
const AFTER = { kcal: '2380', score: 'Estimate score 92', likely: '2153–2631', veryLikely: '2042–2775' }

/** Text with thousands separators removed, so "2,153–2,631" reads as "2153–2631". */
async function digits(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/,/g, '')
}

function watchOffHostRequests(page: Page): string[] {
  const offHost: string[] = []
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (url.protocol === 'data:' || url.protocol === 'blob:' || url.protocol === 'about:') return
    if (url.hostname !== '127.0.0.1') offHost.push(req.url())
  })
  return offHost
}

async function openDemo(page: Page) {
  await page.clock.setFixedTime(DEMO_NOW)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the fictional demo' }).click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function expectDashboard(page: Page, want: typeof BEFORE, biggest: string) {
  expect(await digits(page.getByTestId('headline-kcal'))).toBe(want.kcal)
  await expect(page.getByTestId('day-score')).toHaveText(want.score)
  expect(await digits(page.getByTestId('likely-range'))).toContain(want.likely)
  expect(await digits(page.getByTestId('very-likely-range'))).toContain(want.veryLikely)
  await expect(page.getByTestId('biggest-line')).toContainText(`Most uncertainty comes from ${biggest}.`)
}

async function openImprove(page: Page, meal: string): Promise<Locator> {
  await expect(page.getByTestId('biggest-line')).toContainText(meal)
  await page.getByTestId('improve-entry').click()
  const sheet = page.getByTestId('log-meal-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByTestId('fictional-banner')).toHaveText(FICTIONAL)
  await expect(sheet.getByTestId('fictional-banner')).toBeVisible()
  await expect(sheet.getByRole('heading', { name: `Improve: ${meal}` })).toBeVisible()
  return sheet
}

/** Re-log the pasta bake from the label values in its note. */
async function enterLabelValues(sheet: Locator) {
  await sheet.getByTestId('source-label').check()
  await sheet.getByTestId('meal-kcal-input').fill('860')
  await sheet.getByTestId('meal-protein-input').fill('42')
  await sheet.getByTestId('meal-carbs-input').fill('96')
  await sheet.getByTestId('meal-fat-input').fill('33')
}

async function storedDemo(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), DEMO_KEY)
}

test.describe('slice 2: improve the weakest meal, and it survives a reload', () => {
  test('Improve that entry opens the pasta bake with its values and note; the preview equals the dashboard after Save', async ({
    page,
  }) => {
    const offHost = watchOffHostRequests(page)
    await openDemo(page)
    await expectDashboard(page, BEFORE, 'Pasta bake (ready meal)')

    const sheet = await openImprove(page, 'Pasta bake (ready meal)')

    // Its current values, its note, and what would improve it.
    await expect(sheet.getByTestId('meal-name-input')).toHaveValue('Pasta bake (ready meal)')
    await expect(sheet.getByTestId('source-photo')).toBeChecked()
    await expect(sheet.getByTestId('meal-kcal-input')).toHaveValue('760')
    await expect(sheet.getByTestId('meal-when-input')).toHaveValue('2026-10-21T17:30')
    await expect(sheet.getByTestId('meal-waking-day')).toHaveText('Waking day: Wed · awake since 1:20 PM')
    await expect(sheet.getByTestId('meal-protein-input')).toHaveValue('34')
    await expect(sheet.getByTestId('meal-carbs-input')).toHaveValue('84')
    await expect(sheet.getByTestId('meal-fat-input')).toHaveValue('30')
    await expect(sheet.getByTestId('improve-note')).toContainText(
      'Label on the box (whole package): 860 kcal, protein 42 g, carbs 96 g, fat 33 g.',
    )
    await expect(sheet.getByTestId('meal-note-input')).toHaveValue(/860 kcal/)
    await expect(sheet.getByTestId('improve-suggestion')).toHaveText(
      'Logging it from "Nutrition label (typed)" would lower the typical error from 46% to 10%.',
    )

    // Before any change, the after column equals the before column.
    const preview = sheet.getByTestId('edit-preview')
    expect(await digits(preview.getByTestId('preview-day-kcal'))).toBe('2280')
    await expect(preview.getByTestId('preview-day-score')).toHaveText('83')

    await enterLabelValues(sheet)

    // The before/after preview of the meal and the day.
    await expect(preview.getByTestId('preview-meal-kcal')).toHaveText('860')
    await expect(preview.getByTestId('preview-meal-error')).toHaveText('10%')
    await expect(preview.getByTestId('preview-meal-score')).toHaveText('90')
    expect(await digits(preview.getByTestId('preview-day-kcal'))).toBe(AFTER.kcal)
    await expect(preview.getByTestId('preview-day-score')).toHaveText('92')
    // Range cells carry their unit through copy.headline.rangeValue, as the headline does.
    expect(await digits(preview.getByTestId('preview-likely'))).toBe(`${AFTER.likely} kcal`)
    expect(await digits(preview.getByTestId('preview-very-likely'))).toBe(`${AFTER.veryLikely} kcal`)
    await expect(preview.getByTestId('preview-biggest')).toContainText('Apple and peanut butter')
    const shown = {
      kcal: await digits(preview.getByTestId('preview-day-kcal')),
      score: `Estimate score ${await preview.getByTestId('preview-day-score').innerText()}`,
      likely: await digits(preview.getByTestId('preview-likely')),
      veryLikely: await digits(preview.getByTestId('preview-very-likely')),
    }

    // Nothing changes until Save.
    expect(await digits(page.getByTestId('headline-kcal'))).toBe(BEFORE.kcal)

    await sheet.getByTestId('save-meal').click()
    await expect(sheet).toBeHidden()

    // The dashboard shows what the preview showed, from the real calculation.
    await expectDashboard(page, shown, 'Apple and peanut butter')
    await expectDashboard(page, AFTER, 'Apple and peanut butter')
    const pasta = page.getByTestId('meal-row').filter({ hasText: 'Pasta bake (ready meal)' })
    await expect(pasta).toContainText('860 kcal')
    await expect(pasta).toContainText('Nutrition label (typed)')
    await expect(pasta).toContainText('Estimate score 90')
    await expect(page.getByTestId('macro-protein')).toContainText('132 g')
    await expect(page.getByTestId('macro-carbs')).toContainText('284 g')
    await expect(page.getByTestId('macro-fat')).toContainText('77 g')
    await expect(page.getByTestId('fictional-banner')).toBeVisible()
    expect(offHost).toEqual([])
  })

  test('closing without saving changes nothing (Cancel, Close and Escape)', async ({ page }) => {
    const offHost = watchOffHostRequests(page)
    await openDemo(page)
    const savedBefore = await storedDemo(page)

    const closers: ((sheet: Locator) => Promise<void>)[] = [
      (sheet) => sheet.getByTestId('cancel-meal').click(),
      (sheet) => sheet.getByRole('button', { name: 'Close' }).click(),
      () => page.keyboard.press('Escape'),
    ]
    for (const close of closers) {
      const sheet = await openImprove(page, 'Pasta bake (ready meal)')
      await enterLabelValues(sheet)
      expect(await digits(sheet.getByTestId('preview-day-kcal'))).toBe(AFTER.kcal)
      await close(sheet)
      await expect(sheet).toBeHidden()

      await expectDashboard(page, BEFORE, 'Pasta bake (ready meal)')
      const pasta = page.getByTestId('meal-row').filter({ hasText: 'Pasta bake (ready meal)' })
      await expect(pasta).toContainText('760 kcal')
      await expect(pasta).toContainText('Photo estimate')
      expect(await storedDemo(page)).toEqual(savedBefore)
    }

    // Re-opening shows the saved values again, not the discarded ones.
    const sheet = await openImprove(page, 'Pasta bake (ready meal)')
    await expect(sheet.getByTestId('source-photo')).toBeChecked()
    await expect(sheet.getByTestId('meal-kcal-input')).toHaveValue('760')
    expect(offHost).toEqual([])
  })

  test('an invalid number keeps everything typed and blocks Save', async ({ page }) => {
    await openDemo(page)
    const sheet = await openImprove(page, 'Pasta bake (ready meal)')
    await sheet.getByTestId('source-label').check()
    for (const bad of ['abc', '-50']) {
      await sheet.getByTestId('meal-kcal-input').fill(bad)
      await expect(sheet.getByTestId('kcal-error')).toHaveText('Use digits, e.g. 1501 or 13.9')
      await expect(sheet.getByTestId('save-meal')).toBeDisabled()
      await expect(sheet.getByTestId('meal-name-input')).toHaveValue('Pasta bake (ready meal)')
      await expect(sheet.getByTestId('source-label')).toBeChecked()
      await expect(sheet.getByTestId('meal-when-input')).toHaveValue('2026-10-21T17:30')
    }
    await sheet.getByTestId('meal-kcal-input').fill('860')
    await expect(sheet.getByTestId('kcal-error')).toHaveCount(0)
    await expect(sheet.getByTestId('save-meal')).toBeEnabled()
  })

  test('after a reload the improved day is still there, and the demo clock continues', async ({ page }) => {
    const offHost = watchOffHostRequests(page)
    await openDemo(page)
    const sheet = await openImprove(page, 'Pasta bake (ready meal)')
    await enterLabelValues(sheet)
    await sheet.getByTestId('save-meal').click()
    await expectDashboard(page, AFTER, 'Apple and peanut butter')

    const clock = (await storedDemo(page)).clock
    expect(clock).toEqual({ demoEpochFixture: DEMO_NOW.getTime(), demoEpochReal: DEMO_NOW.getTime() })

    await page.reload()
    // Straight back to the demo dashboard, not the first-open screen.
    await expect(page.getByTestId('dashboard')).toBeVisible()
    await expect(page.getByTestId('fictional-banner')).toHaveText(FICTIONAL)
    await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 1:20 PM')
    await expectDashboard(page, AFTER, 'Apple and peanut butter')
    await expect(page.getByTestId('meal-row').filter({ hasText: 'Pasta bake (ready meal)' })).toContainText('860 kcal')

    // Two hours later: the demo's now is Thu 03:30 on the same timeline. The stored anchor is
    // unchanged (a restart would have re-anchored it), and Sam is still on Wednesday's waking day.
    await page.clock.setFixedTime(new Date(DEMO_NOW.getTime() + 2 * 60 * 60 * 1000))
    await page.reload()
    await expect(page.getByTestId('dashboard')).toBeVisible()
    expect((await storedDemo(page)).clock).toEqual(clock)
    await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 1:20 PM')
    await expectDashboard(page, AFTER, 'Apple and peanut butter')
    expect(offHost).toEqual([])
  })

  test('switching logs survives a reload, and the two logs never mix', async ({ page }) => {
    await openDemo(page)
    const sheet = await openImprove(page, 'Pasta bake (ready meal)')
    await enterLabelValues(sheet)
    await sheet.getByTestId('save-meal').click()
    await expectDashboard(page, AFTER, 'Apple and peanut butter')

    await page.getByTestId('log-switch').click()
    await expect(page.getByTestId('waking-day')).toHaveText('Wake time not set')
    await page.reload()
    await expect(page.getByTestId('dashboard')).toBeVisible()
    await expect(page.getByTestId('waking-day')).toHaveText('Wake time not set')
    await expect(page.getByTestId('fictional-banner')).toHaveCount(0)
    await expect(page.getByTestId('empty-day')).toContainText('No meals logged yet')

    await page.getByTestId('log-switch').click()
    await expectDashboard(page, AFTER, 'Apple and peanut butter')
    await page.reload()
    await expect(page.getByTestId('fictional-banner')).toBeVisible()
    await expectDashboard(page, AFTER, 'Apple and peanut butter')
    expect(await page.evaluate((k) => localStorage.getItem(k), ACTIVE_KEY)).toBe('demo')
  })

  test('when the biggest contributor already uses the best source, Improve that entry is hidden', async ({ page }) => {
    await openDemo(page)

    // 1. The pasta bake from its label (G11b).
    let sheet = await openImprove(page, 'Pasta bake (ready meal)')
    await enterLabelValues(sheet)
    await sheet.getByTestId('save-meal').click()

    // 2. The apple and peanut butter from a label, same calories.
    sheet = await openImprove(page, 'Apple and peanut butter')
    await expect(sheet.getByTestId('source-description')).toBeChecked()
    await sheet.getByTestId('source-label').check()
    await sheet.getByTestId('save-meal').click()
    await expect(sheet).toBeHidden()

    // 3. The pasta bake is the biggest again, now on a label, so weighing is what's left.
    sheet = await openImprove(page, 'Pasta bake (ready meal)')
    await expect(sheet.getByTestId('improve-suggestion')).toHaveText(
      'Logging it from "Weighed" would lower the typical error from 10% to 8%.',
    )
    await sheet.getByTestId('source-weighed').check()
    await expect(sheet.getByTestId('preview-biggest')).toContainText('It already uses the most reliable source.')
    await sheet.getByTestId('save-meal').click()
    await expect(sheet).toBeHidden()

    await expect(page.getByTestId('biggest-line')).toHaveText(
      'Most uncertainty comes from Pasta bake (ready meal). It already uses the most reliable source.',
    )
    await expect(page.getByTestId('improve-entry')).toHaveCount(0)

    // Still hidden after a reload.
    await page.reload()
    await expect(page.getByTestId('biggest-line')).toContainText('It already uses the most reliable source.')
    await expect(page.getByTestId('improve-entry')).toHaveCount(0)
  })
})

test.describe('slice 2: when the device will not save', () => {
  test('blocked storage shows the banner, and the app keeps working in memory', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      }
    })
    const blocked =
      "Can't save on this device right now; your changes will be lost on reload."
    await openDemo(page)
    await expect(page.getByTestId('storage-blocked')).toHaveText(blocked)
    await expect(page.getByTestId('fictional-banner')).toBeVisible()

    const sheet = await openImprove(page, 'Pasta bake (ready meal)')
    await enterLabelValues(sheet)
    await sheet.getByTestId('save-meal').click()
    await expectDashboard(page, AFTER, 'Apple and peanut butter')
    await expect(page.getByTestId('storage-blocked')).toBeVisible()

    // Nothing was saved, so a reload starts over, still saying so.
    await page.reload()
    await expect(page.getByTestId('first-open')).toBeVisible()
    await expect(page.getByTestId('storage-blocked')).toHaveText(blocked)
  })

  test("saved data that can't be read is reported and never written over", async ({ page }) => {
    await page.clock.setFixedTime(DEMO_NOW)
    await page.goto('/')
    await page.evaluate(
      ([demoKey, activeKey]) => {
        localStorage.setItem(demoKey, '{"version":1,"kind":"demo","meals":[')
        localStorage.setItem(activeKey, 'demo')
      },
      [DEMO_KEY, ACTIVE_KEY],
    )
    await page.reload()
    await expect(page.getByTestId('dashboard')).toBeVisible()
    await expect(page.getByTestId('storage-unreadable')).toContainText("Couldn't read saved data")
    await expectDashboard(page, BEFORE, 'Pasta bake (ready meal)')

    const sheet = await openImprove(page, 'Pasta bake (ready meal)')
    await enterLabelValues(sheet)
    await sheet.getByTestId('save-meal').click()
    await expectDashboard(page, AFTER, 'Apple and peanut butter')
    expect(await page.evaluate((k) => localStorage.getItem(k), DEMO_KEY)).toBe('{"version":1,"kind":"demo","meals":[')
  })
})
