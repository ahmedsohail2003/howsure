// checklist.md slice 1 Verify: open the fictional demo and check that Sam's Wednesday
// says how sure it is, with explanations, the fictional banner on every view, and no
// request leaving 127.0.0.1.
import { expect, test, type Locator, type Page } from '@playwright/test'

const FICTIONAL = 'Sample person — fictional'

// prd.md > Estimate Score and Explanations, word for word (the kefir meal is a 10% label source).
const MEAL_SCORE_SENTENCE =
  'A 90% estimate score means this source is assigned a typical error of about 10%. It does not mean there is a 90% chance this meal is correct. The actual error could be larger.'
const DAY_SCORE_SENTENCE =
  "Each meal contributes calories and uncertainty. A large, uncertain meal can affect the total more than a small one. We combine those uncertainties and compare them with the day's total—we don't simply average the meal percentages."
const PLANNING_LINE = 'Staying under a target? Count the top of the very-likely range.'

// The demo clock starts at the fixture's wall-clock moment, Thu 2026-10-22 01:30 local, in any
// time zone (spec.md > Clock). This only pins the page's real clock, so every run is identical.
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')

/** Text with thousands separators removed, so "1,870–2,780" reads as "1870–2780". */
async function digits(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/,/g, '')
}

async function expectBanner(scope: Page | Locator) {
  await expect(scope.getByTestId('fictional-banner').first()).toHaveText(FICTIONAL)
  await expect(scope.getByTestId('fictional-banner').first()).toBeVisible()
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
  const tryDemo = page.getByRole('button', { name: 'Try the fictional demo' })
  await expect(tryDemo).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start empty' })).toBeVisible()
  await tryDemo.click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

test.describe('slice 1: the demo day says how sure it is', () => {
  test('first open offers the demo as the primary choice and Start empty as the other', async ({ page }) => {
    const offHost = watchOffHostRequests(page)
    await page.goto('/')
    const tryDemo = page.getByRole('button', { name: 'Try the fictional demo' })
    const startEmpty = page.getByRole('button', { name: 'Start empty' })
    await expect(tryDemo).toBeVisible()
    await expect(startEmpty).toBeVisible()
    await expect(tryDemo).toHaveClass(/btn-primary/)
    await expect(startEmpty).not.toHaveClass(/btn-primary/)
    expect(offHost).toEqual([])
  })

  test("Sam's Wednesday: 2280 kcal, score 83, both ranges and the biggest contributor", async ({ page }) => {
    const offHost = watchOffHostRequests(page)
    await openDemo(page)

    await expectBanner(page)
    await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 1:20 PM')

    expect(await digits(page.getByTestId('headline-kcal'))).toBe('2280')
    await expect(page.getByTestId('day-score')).toHaveText('Estimate score 83')
    expect(await digits(page.getByTestId('likely-range'))).toContain('1870–2780')
    expect(await digits(page.getByTestId('very-likely-range'))).toContain('1684–3087')

    await expect(page.getByTestId('biggest-line')).toContainText('Most uncertainty comes from Pasta bake (ready meal)')

    // The after-midnight snack sits on Wednesday's waking day; rows show no ranges.
    const rows = page.getByTestId('meal-row')
    await expect(rows).toHaveCount(5)
    await expect(rows.filter({ hasText: 'Apple and peanut butter' })).toContainText('Thu 12:40 AM')
    const pasta = rows.filter({ hasText: 'Pasta bake (ready meal)' })
    await expect(pasta).toContainText('760 kcal')
    await expect(pasta).toContainText('Photo estimate')
    await expect(pasta).toContainText('Estimate score 54')
    await expect(page.getByTestId('meal-list')).not.toContainText('–')

    // Protein / carbs / fat known totals.
    await expect(page.getByTestId('macro-protein')).toContainText('124 g')
    await expect(page.getByTestId('macro-carbs')).toContainText('272 g')
    await expect(page.getByTestId('macro-fat')).toContainText('74 g')

    expect(offHost).toEqual([])
  })

  test('the meal score explanation uses the exact sentence and says "assumption"', async ({ page }) => {
    const offHost = watchOffHostRequests(page)
    await openDemo(page)

    await page
      .getByTestId('meal-row')
      .filter({ hasText: 'Kefir with oats and blueberries' })
      .getByTestId('meal-score')
      .click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expectBanner(sheet)
    await expect(sheet.getByTestId('explain-score')).toHaveText('Estimate score 90')
    await expect(sheet.getByTestId('meal-score-sentence')).toHaveText(MEAL_SCORE_SENTENCE)
    await expect(sheet.getByTestId('basis-tag').first()).toHaveText('assumption')

    await sheet.getByText('More detail').click()
    await expect(sheet.getByTestId('source-basis')).toContainText('Nutrition label (typed)')
    await expect(sheet.getByTestId('source-basis')).toContainText('typical error 10%')
    await expect(sheet.getByTestId('source-basis')).toContainText('assumption')

    await sheet.getByRole('button', { name: 'Close' }).click()
    await expect(sheet).toBeHidden()

    // The pasta bake's own numbers.
    await page.getByTestId('meal-row').filter({ hasText: 'Pasta bake (ready meal)' }).getByTestId('meal-score').click()
    await expect(sheet.getByTestId('explain-score')).toHaveText('Estimate score 54')
    await expect(sheet.getByTestId('meal-score-sentence')).toHaveText(
      'A 54% estimate score means this source is assigned a typical error of about 46%. It does not mean there is a 54% chance this meal is correct. The actual error could be larger.',
    )
    await expectBanner(sheet)
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()

    expect(offHost).toEqual([])
  })

  test('the day score explanation lists contributions biggest first, with More detail', async ({ page }) => {
    const offHost = watchOffHostRequests(page)
    await openDemo(page)

    await page.getByTestId('day-score').click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expectBanner(sheet)
    await expect(sheet.getByTestId('explain-score')).toHaveText('Estimate score 83')
    await expect(sheet.getByTestId('day-score-sentence')).toHaveText(DAY_SCORE_SENTENCE)

    const contributions = sheet.getByTestId('contribution')
    await expect(contributions).toHaveCount(5)
    await expect(contributions.first()).toContainText('Pasta bake (ready meal)')
    await expect(sheet.getByTestId('biggest-contributor')).toContainText('Biggest contributor: Pasta bake (ready meal)')

    await sheet.getByText('More detail').click()
    const table = sheet.getByTestId('day-detail-table')
    await expect(table).toContainText('Pasta bake (ready meal)')
    await expect(table).toContainText('760')
    await expect(table).toContainText('46%')
    await expect(table).toContainText('Apple and peanut butter')
    await expect(table).toContainText('41%')
    expect(await digits(sheet.getByTestId('combined-result'))).toContain('2280 kcal')
    await expect(sheet.getByTestId('combined-result')).toContainText('16.7%')
    // Every source used today shows its typical error and "assumption" until slice 7.
    const bases = sheet.getByTestId('source-basis')
    await expect(bases).toHaveCount(5)
    for (const basis of await bases.all()) await expect(basis).toContainText('assumption')
    // Slice 7: each source shows its nearest study, DOI and re-check date (all stay "assumption").
    for (const cite of await sheet.getByTestId('basis-cite').all()) await expect(cite).toContainText('re-checked 2026-10-26')
    await expect(sheet.getByTestId('source-basis').filter({ hasText: 'Photo estimate' })).toContainText('DOI 10.1016/j.cdnut.2025.107556')
    await expect(sheet.getByTestId('limit-text')).toContainText('Errors from the same kind of source are added')

    await sheet.getByRole('button', { name: 'Close' }).click()
    await expect(sheet).toBeHidden()
    expect(offHost).toEqual([])
  })

  test('the range explanation says it is not a guaranteed minimum and maximum', async ({ page }) => {
    const offHost = watchOffHostRequests(page)
    await openDemo(page)

    for (const testId of ['likely-range', 'very-likely-range']) {
      await page.getByTestId(testId).click()
      const sheet = page.getByRole('dialog')
      await expect(sheet).toBeVisible()
      await expectBanner(sheet)
      expect(await digits(sheet.getByTestId('explain-likely'))).toContain('1870–2780')
      expect(await digits(sheet.getByTestId('explain-very-likely'))).toContain('1684–3087')
      await expect(sheet.getByTestId('range-explanation')).toContainText('not a guaranteed minimum and maximum')
      await expect(sheet.getByTestId('planning-line')).toHaveText(PLANNING_LINE)
      await sheet.getByText('More detail').click()
      await expect(sheet).toContainText('design targets')
      await sheet.getByRole('button', { name: 'Close' }).click()
      await expect(sheet).toBeHidden()
    }

    // Back on the dashboard, the banner is still there.
    await expectBanner(page)
    expect(offHost).toEqual([])
  })

  // prd.md > Screens and Layout: "Sample person — fictional" is "always visible there" in demo mode.
  test('the fictional banner stays in view after scrolling to the bottom, without covering content', async ({
    page,
  }) => {
    await openDemo(page)
    const banner = page.getByTestId('fictional-banner')
    await expectBanner(page)

    // Before scrolling it sits above the header, in its own space.
    const top = await banner.boundingBox()
    const header = await page.locator('.app-header').boundingBox()
    expect(top && header).toBeTruthy()
    expect(top!.y).toBe(0)
    expect(top!.y + top!.height).toBeLessThanOrEqual(header!.y + 0.5)

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1)
    if (scrolls) await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

    await expect(banner).toBeInViewport({ ratio: 1 })
    const stuck = await banner.boundingBox()
    expect(stuck!.y).toBe(0)

    // The last meal row is fully in view below the banner, not hidden under it.
    const last = page.getByTestId('meal-row').last()
    await expect(last).toBeInViewport({ ratio: 1 })
    const lastBox = await last.boundingBox()
    expect(lastBox!.y).toBeGreaterThanOrEqual(stuck!.y + stuck!.height)
  })

  test('Start empty opens your own log without the fictional banner or invented numbers', async ({ page }) => {
    const offHost = watchOffHostRequests(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Start empty' }).click()
    await expect(page.getByTestId('dashboard')).toBeVisible()
    await expect(page.getByTestId('fictional-banner')).toHaveCount(0)
    await expect(page.getByTestId('waking-day')).toHaveText('Wake time not set')
    await expect(page.getByTestId('headline-kcal')).toHaveText('Not available yet')
    await expect(page.getByTestId('empty-day')).toContainText('No meals logged yet')

    // The header switch goes to the demo, which shows the banner again.
    await page.getByTestId('log-switch').click()
    await expectBanner(page)
    expect(await digits(page.getByTestId('headline-kcal'))).toBe('2280')
    expect(offHost).toEqual([])
  })
})

// spec.md > Clock > Time zones: the fixture's times are wall-clock strings, so outside
// America/Toronto the demo is still Sam's Wednesday, and its waking day still crosses
// midnight with the 00:40 snack (prd.md > First Open).
for (const timezoneId of ['America/Los_Angeles', 'Asia/Tokyo']) {
  test.describe(`slice 1 in ${timezoneId}`, () => {
    test.use({ timezoneId })

    test("the demo is still Sam's Wednesday, awake since 1:20 PM, with the after-midnight snack", async ({ page }) => {
      const offHost = watchOffHostRequests(page)
      await openDemo(page)

      await expectBanner(page)
      await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 1:20 PM')
      const rows = page.getByTestId('meal-row')
      await expect(rows).toHaveCount(5)
      await expect(rows.filter({ hasText: 'Apple and peanut butter' })).toContainText('Thu 12:40 AM')
      expect(await digits(page.getByTestId('headline-kcal'))).toBe('2280')
      await expect(page.getByTestId('day-score')).toHaveText('Estimate score 83')
      await expect(page.getByTestId('biggest-line')).toContainText('Most uncertainty comes from Pasta bake (ready meal)')
      expect(offHost).toEqual([])
    })
  })
}
