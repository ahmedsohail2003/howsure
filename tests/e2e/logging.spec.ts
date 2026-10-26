// checklist.md slice 3 Verify: log, edit and delete meals honestly, with unknown never zero.
// Covers every "- [ ]" under prd.md > Logging a Meal, > Calorie Input Rules, > Days With
// Unknown Calories and > Meal Details, Edit and Delete, plus prd.md > States and Boundaries
// (the empty day) and prd.md > Saving (logging, editing and deleting survive a reload).
// Expected day values are spec.md's formulas computed separately in Python, not read from the app.
//
// One criterion needs a previous day on screen ("Logging from a previous day defaults the date
// to that day"). The rule is unit-tested in src/ui/__tests__/log-meal.test.ts (defaultMealTime);
// here the default is checked as now, and tests/e2e/sleep-days.spec.ts (slice 4, with
// previous/next) checks it on an earlier day.
import { expect, test, type Locator, type Page } from '@playwright/test'

const FICTIONAL = 'Sample person — fictional'
const DEMO_KEY = 'howsure.demo.v1'
const MINE_KEY = 'howsure.mine.v1'
const SOURCE_HINT = 'Pick how you know, so HowSure can say how sure.'
const PARSE_ERROR = 'Use digits, e.g. 1501 or 13.9'

// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock): Wednesday's waking day.
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')
// Your own log runs on real time; this pins it.
const MINE_NOW = new Date('2026-10-26T12:15:00-04:00')

// G11, and the day after each change (spec.md formulas, computed in Python).
const G11 = { kcal: '2280', score: 'Estimate score 83', likely: '1870–2780', veryLikely: '1684–3087' }
const WITH_RAMEN = { kcal: '3180', score: 'Estimate score 76', likely: '2402–4210', veryLikely: '2070–4885' }
const PASTA_900 = { kcal: '2420', score: 'Estimate score 82', likely: '1953–2999', veryLikely: '1743–3360' }
const NO_PASTA = { kcal: '1520', score: 'Estimate score 90', likely: '1345–1717', veryLikely: '1261–1832' }

const SOURCES = ['weighed', 'label', 'menu', 'photo', 'description'] as const

/** Text with thousands separators removed, so "2,402–4,210" reads as "2402–4210". */
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

async function openMine(page: Page) {
  await page.clock.setFixedTime(MINE_NOW)
  await page.goto('/')
  await page.getByRole('button', { name: 'Start empty' }).click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function expectDay(page: Page, want: typeof G11) {
  expect(await digits(page.getByTestId('headline-kcal'))).toBe(want.kcal)
  await expect(page.getByTestId('day-score')).toHaveText(want.score)
  expect(await digits(page.getByTestId('likely-range'))).toContain(want.likely)
  expect(await digits(page.getByTestId('very-likely-range'))).toContain(want.veryLikely)
}

/** There is one log button at a time: "Log a meal", or "Log your first meal" on an empty day. */
async function openLogMeal(page: Page, button?: 'Log a meal' | 'Log your first meal'): Promise<Locator> {
  const open = page.getByTestId('log-meal')
  if (button) await expect(open).toHaveText(button)
  await open.click()
  const sheet = page.getByTestId('log-meal-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('heading', { name: 'Log a meal' })).toBeVisible()
  return sheet
}

/** Name, how you know, calories: the few taps of prd.md > The Core Journey, step 5. */
async function logMeal(page: Page, name: string, source: (typeof SOURCES)[number] | null, kcal: string) {
  const sheet = await openLogMeal(page)
  await sheet.getByTestId('meal-name-input').fill(name)
  if (source) await sheet.getByTestId(`source-${source}`).check()
  await sheet.getByTestId('meal-kcal-input').fill(kcal)
  await expect(sheet.getByTestId('save-meal')).toBeEnabled()
  await sheet.getByTestId('save-meal').click()
  await expect(sheet).toBeHidden()
}

function row(page: Page, name: string): Locator {
  return page.getByTestId('meal-row').filter({ hasText: name })
}

async function openDetails(page: Page, name: string): Promise<Locator> {
  await row(page, name).getByTestId('meal-open').click()
  const sheet = page.getByTestId('meal-details')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('heading', { name })).toBeVisible()
  return sheet
}

async function stored(page: Page, key: string) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key)
}

/** The word rules of spec.md > Screens > Copy checks, on whatever is on screen now. */
async function expectCleanCopy(page: Page) {
  const text = await page.evaluate(() => document.body.innerText)
  expect(text).not.toMatch(/accura|for sure|\bexact(ly)?\b|precis/i)
}

test.describe('slice 3: Logging a Meal', () => {
  test('Log a meal asks in order, with Optional details collapsed; Save returns to an updated day that survives a reload', async ({
    page,
  }) => {
    const offHost = watchOffHostRequests(page)
    await openDemo(page)
    await expectDay(page, G11)

    const sheet = await openLogMeal(page, 'Log a meal')
    await expect(sheet.getByTestId('fictional-banner')).toHaveText(FICTIONAL)
    await expect(sheet.getByTestId('fictional-banner')).toBeVisible()

    // The order of prd.md > Logging a Meal: name, how you know, calories, date and time, optional details.
    const order = await sheet.evaluate((root) =>
      [...root.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')),
    )
    const at = (id: string) => order.indexOf(id)
    const sequence = ['meal-name-input', 'source-weighed', 'meal-kcal-input', 'meal-when-input', 'optional-details']
    for (const id of sequence) expect(at(id), id).toBeGreaterThanOrEqual(0)
    for (let i = 1; i < sequence.length; i++) expect(at(sequence[i])).toBeGreaterThan(at(sequence[i - 1]))
    expect(at('meal-waking-day')).toBeGreaterThan(at('meal-when-input'))
    expect(at('meal-waking-day')).toBeLessThan(at('optional-details'))

    // Nothing pre-filled but now: no source by default, blank calories, Optional details collapsed.
    await expect(sheet.getByTestId('meal-name-input')).toHaveValue('')
    for (const id of SOURCES) await expect(sheet.getByTestId(`source-${id}`)).not.toBeChecked()
    await expect(sheet.getByTestId('meal-kcal-input')).toHaveValue('')
    await expect(sheet.getByTestId('meal-when-input')).toHaveValue('2026-10-22T01:30')
    await expect(sheet.getByTestId('meal-waking-day')).toHaveText('Waking day: Wed · awake since 1:20 PM')
    await expect(sheet.getByTestId('optional-details')).not.toHaveAttribute('open', /.*/)
    await expect(sheet.getByTestId('meal-protein-input')).toBeHidden()
    await expect(sheet.getByTestId('name-error')).toHaveCount(0)
    await expect(sheet.getByTestId('save-meal')).toBeDisabled()
    await expect(sheet.getByTestId('edit-preview')).toHaveCount(0)

    await sheet.getByTestId('meal-name-input').fill('Late-night ramen')
    await sheet.getByTestId('source-photo').check()
    await sheet.getByTestId('meal-kcal-input').fill('900')
    await expectCleanCopy(page)
    await sheet.getByTestId('save-meal').click()
    await expect(sheet).toBeHidden()

    // Back on the dashboard, already updated by the real calculation.
    await expectDay(page, WITH_RAMEN)
    await expect(page.getByTestId('biggest-line')).toHaveText('Most uncertainty comes from Late-night ramen.')
    await expect(page.getByTestId('meal-row')).toHaveCount(6)
    const ramen = row(page, 'Late-night ramen')
    await expect(ramen).toContainText('Thu 1:30 AM')
    await expect(ramen).toContainText('900 kcal')
    await expect(ramen).toContainText('Photo estimate')
    await expect(ramen).toContainText('Estimate score 54')
    await expect(page.getByTestId('fictional-banner')).toBeVisible()

    // prd.md > Saving: a reload shows the same data.
    await page.reload()
    await expect(page.getByTestId('dashboard')).toBeVisible()
    await expectDay(page, WITH_RAMEN)
    await expect(page.getByTestId('biggest-line')).toHaveText('Most uncertainty comes from Late-night ramen.')
    await expect(row(page, 'Late-night ramen')).toContainText('900 kcal')
    expect(offHost).toEqual([])
  })

  test('blank protein, carbs and fat are saved as unknown, never as zero', async ({ page }) => {
    await openDemo(page)
    await logMeal(page, 'Toast with jam', 'label', '150')

    // The macro row keeps the known totals and says one entry is missing each macro.
    for (const [k, total] of [
      ['protein', '124 g'],
      ['carbs', '272 g'],
      ['fat', '74 g'],
    ]) {
      await expect(page.getByTestId(`macro-${k}`)).toContainText(total)
      await expect(page.getByTestId(`macro-${k}`)).toContainText('1 entry missing')
    }

    const sheet = await openDetails(page, 'Toast with jam')
    await expect(sheet.getByTestId('details-protein')).toContainText('unknown')
    await expect(sheet.getByTestId('details-carbs')).toContainText('unknown')
    await expect(sheet.getByTestId('details-fat')).toContainText('unknown')
    await expect(sheet.getByTestId('details-facts')).not.toContainText('0 g')

    const toast = (await stored(page, DEMO_KEY)).meals.find((m: { name: string }) => m.name === 'Toast with jam')
    expect(toast).toMatchObject({ kcal: 150, source: 'label', protein: null, carbs: null, fat: null })
  })

  test('typing calories without picking a source keeps Save disabled and shows the hint', async ({ page }) => {
    await openDemo(page)
    const sheet = await openLogMeal(page)
    await sheet.getByTestId('meal-name-input').fill('Toast')
    await sheet.getByTestId('meal-kcal-input').fill('150')
    await expect(sheet.getByTestId('save-meal')).toBeDisabled()
    await expect(sheet.getByTestId('source-hint')).toHaveText(SOURCE_HINT)

    await sheet.getByTestId('source-label').check()
    await expect(sheet.getByTestId('source-hint')).toHaveCount(0)
    await expect(sheet.getByTestId('save-meal')).toBeEnabled()
  })

  test('changing the date and time to another waking day changes the waking-day label before saving', async ({
    page,
  }) => {
    await openDemo(page)
    const sheet = await openLogMeal(page)
    // Defaults to now on the viewed (current) waking day.
    await expect(sheet.getByTestId('meal-when-input')).toHaveValue('2026-10-22T01:30')
    await expect(sheet.getByTestId('meal-waking-day')).toHaveText('Waking day: Wed · awake since 1:20 PM')
    await expect(sheet.getByTestId('meal-other-day')).toHaveCount(0)

    await sheet.getByTestId('meal-when-input').fill('2026-10-20T18:00')
    await expect(sheet.getByTestId('meal-waking-day')).toHaveText('Waking day: Tue · awake since 1:05 PM')
    // It says the meal won't show on the day on screen once saved.
    await expect(sheet.getByTestId('meal-other-day')).toHaveText(
      'That time is on another waking day, so this meal won’t show on the day on screen.',
    )
    // After midnight, before the next wake, is still the same waking day.
    await sheet.getByTestId('meal-when-input').fill('2026-10-21T02:10')
    await expect(sheet.getByTestId('meal-waking-day')).toHaveText('Waking day: Tue · awake since 1:05 PM')
    await sheet.getByTestId('meal-when-input').fill('2026-10-21T13:25')
    await expect(sheet.getByTestId('meal-waking-day')).toHaveText('Waking day: Wed · awake since 1:20 PM')
    await expect(sheet.getByTestId('meal-other-day')).toHaveCount(0)

    // Nothing was saved.
    await sheet.getByTestId('cancel-meal').click()
    await expectDay(page, G11)
    await expect(page.getByTestId('meal-row')).toHaveCount(5)
  })

  test('Cancel (and Escape) discard the entry and change nothing', async ({ page }) => {
    await openDemo(page)
    const savedBefore = await stored(page, DEMO_KEY)

    for (const close of ['cancel', 'escape'] as const) {
      const sheet = await openLogMeal(page)
      await sheet.getByTestId('meal-name-input').fill('Midnight cereal')
      await sheet.getByTestId('source-description').check()
      await sheet.getByTestId('meal-kcal-input').fill('400')
      await sheet.getByText('Optional details').click()
      await sheet.getByTestId('meal-protein-input').fill('12')
      if (close === 'cancel') await sheet.getByTestId('cancel-meal').click()
      else await page.keyboard.press('Escape')
      await expect(sheet).toBeHidden()

      await expectDay(page, G11)
      await expect(page.getByTestId('meal-row')).toHaveCount(5)
      await expect(page.getByTestId('meal-list')).not.toContainText('Midnight cereal')
      expect(await stored(page, DEMO_KEY)).toEqual(savedBefore)
    }

    // Opening it again starts blank, not with the discarded entry.
    const sheet = await openLogMeal(page)
    await expect(sheet.getByTestId('meal-name-input')).toHaveValue('')
    await expect(sheet.getByTestId('meal-kcal-input')).toHaveValue('')
    for (const id of SOURCES) await expect(sheet.getByTestId(`source-${id}`)).not.toBeChecked()
  })
})

test.describe('slice 3: Calorie Input Rules', () => {
  test('"abc" or "-50" shows an inline error and disables Save; name, source, date and time stay filled in', async ({
    page,
  }) => {
    await openDemo(page)
    const sheet = await openLogMeal(page)
    await sheet.getByTestId('meal-name-input').fill('Toast')
    await sheet.getByTestId('source-label').check()
    await sheet.getByTestId('meal-when-input').fill('2026-10-21T19:00')

    for (const bad of ['abc', '-50']) {
      await sheet.getByTestId('meal-kcal-input').fill(bad)
      await expect(sheet.getByTestId('kcal-error')).toHaveText(PARSE_ERROR)
      await expect(sheet.getByTestId('save-meal')).toBeDisabled()
      await expect(sheet.getByTestId('meal-kcal-input')).toHaveValue(bad)
      await expect(sheet.getByTestId('meal-name-input')).toHaveValue('Toast')
      await expect(sheet.getByTestId('source-label')).toBeChecked()
      await expect(sheet.getByTestId('meal-when-input')).toHaveValue('2026-10-21T19:00')
      await expect(sheet.getByTestId('meal-waking-day')).toHaveText('Waking day: Wed · awake since 1:20 PM')
    }

    // Cleared to blank, it is unknown and Save works again.
    await sheet.getByTestId('meal-kcal-input').fill('')
    await expect(sheet.getByTestId('kcal-error')).toHaveCount(0)
    await expect(sheet.getByTestId('save-meal')).toBeEnabled()
  })

  test('a meal saved with 0 calories shows 0, and the day is not marked incomplete because of it', async ({ page }) => {
    await openDemo(page)
    await logMeal(page, 'Black coffee', 'label', '0')

    const coffee = row(page, 'Black coffee')
    await expect(coffee).toContainText('0 kcal')
    await expect(coffee).not.toContainText('unknown')
    await expect(page.getByTestId('day-status')).toHaveCount(0)
    await expect(page.getByTestId('missing-info')).toHaveCount(0)
    await expect(page.locator('.headline-label')).toHaveText('Calories today')
    await expectDay(page, G11)
    expect((await stored(page, DEMO_KEY)).meals.find((m: { name: string }) => m.name === 'Black coffee').kcal).toBe(0)
  })

  test('in your own log, a day of only a 0 kcal meal shows 0 kcal, not "unknown"', async ({ page }) => {
    await openMine(page)
    await expect(page.getByTestId('log-meal')).toHaveText('Log your first meal')
    await logMeal(page, 'Tea', 'label', '0')
    await expect(page.getByTestId('log-meal')).toHaveText('Log a meal')
    expect(await digits(page.getByTestId('headline-kcal'))).toBe('0')
    await expect(page.getByTestId('day-status')).toHaveCount(0)
    await expect(row(page, 'Tea')).toContainText('0 kcal')
    // Nothing to divide by, so the ranges and score are not available, never a perfect score.
    await expect(page.getByTestId('likely-range')).toContainText('Not available yet')
    await expect(page.getByTestId('day-score-na')).toContainText('Not available yet')
  })
})

test.describe('slice 3: Days With Unknown Calories', () => {
  test('one unknown meal among known ones: known meals only, "1 meal with unknown calories", Missing information with no number', async ({
    page,
  }) => {
    await openDemo(page)

    // Blank calories, and with calories blank "How do you know?" can stay empty.
    const sheet = await openLogMeal(page)
    await sheet.getByTestId('meal-name-input').fill('Leftover soup')
    await expect(sheet.getByTestId('save-meal')).toBeEnabled()
    await sheet.getByTestId('save-meal').click()
    await expect(sheet).toBeHidden()

    await expect(page.locator('.headline-label')).toHaveText('Calories, known meals only')
    await expect(page.getByTestId('day-status')).toContainText('Known meals only — incomplete day')
    await expect(page.getByTestId('unknown-count')).toHaveText('1 meal with unknown calories')
    await expectDay(page, G11)

    const missing = page.getByTestId('missing-info')
    await expect(missing).toContainText('Missing information')
    await expect(missing.getByTestId('missing-meal')).toHaveCount(1)
    await expect(missing.getByTestId('missing-meal')).toContainText('Leftover soup')
    await expect(missing).toContainText('calories unknown')
    expect(await missing.innerText()).not.toMatch(/\d/)

    const soup = row(page, 'Leftover soup')
    await expect(soup).toContainText('unknown')
    await expect(soup).toContainText('source not picked')
    await expect(soup).toContainText('No estimate score')

    // Missing information sits above the calculated uncertainty, which covers the known meals only.
    const biggest = page.getByTestId('biggest-line')
    await expect(biggest).toHaveText('Among the known meals, most uncertainty comes from Pasta bake (ready meal).')
    expect((await missing.boundingBox())!.y).toBeLessThan((await biggest.boundingBox())!.y)

    // The uncertainty ranking lists only the known meals.
    await page.getByTestId('day-score').click()
    const explain = page.getByTestId('explain-day')
    await expect(explain.getByTestId('contribution')).toHaveCount(5)
    await expect(explain.getByTestId('contributions')).not.toContainText('Leftover soup')
    await expect(explain).toContainText('1 meal is left out: its calories are unknown, so no uncertainty is invented for it.')
    await expect(explain.getByTestId('biggest-contributor')).toContainText(
      'Biggest contributor among the known meals: Pasta bake (ready meal)',
    )
    await explain.getByRole('button', { name: 'Close' }).click()

    // Tapping it under Missing information opens its details: no number is invented.
    await missing.getByRole('button', { name: 'Leftover soup' }).click()
    const details = page.getByTestId('meal-details')
    await expect(details.getByTestId('details-kcal')).toHaveText('Calories unknown')
    await expect(details.getByTestId('details-likely')).toHaveCount(0)
    await expect(details.getByTestId('details-score')).toHaveCount(0)
    await expect(details.getByTestId('details-source')).toContainText('not picked')
    await expect(details.getByTestId('details-improve')).toContainText('Adding its calories')
    await expectCleanCopy(page)
    await details.getByRole('button', { name: 'Close' }).click()

    // Saved: still incomplete after a reload, still unknown (null), never 0.
    await page.reload()
    await expect(page.getByTestId('unknown-count')).toHaveText('1 meal with unknown calories')
    const saved = (await stored(page, DEMO_KEY)).meals.find((m: { name: string }) => m.name === 'Leftover soup')
    expect(saved).toMatchObject({ kcal: null, source: null, protein: null, carbs: null, fat: null })
  })

  test('with every meal unknown, the meals are listed with the count and calories, range and score say "Not available yet"', async ({
    page,
  }) => {
    const offHost = watchOffHostRequests(page)
    await openMine(page)

    // prd.md > States and Boundaries: a day with no meals.
    await expect(page.getByTestId('empty-day')).toContainText('No meals logged yet')
    await expect(page.getByTestId('headline-kcal')).toHaveText('Not available yet')
    await expect(page.getByTestId('likely-range')).toContainText('Not available yet')
    await expect(page.getByTestId('very-likely-range')).toContainText('Not available yet')
    await expect(page.getByTestId('day-score-na')).toContainText('Not available yet')
    await expect(page.getByTestId('biggest-line')).toHaveCount(0)
    await expect(page.getByTestId('fictional-banner')).toHaveCount(0)

    const first = await openLogMeal(page, 'Log your first meal')
    await expect(first.getByTestId('meal-when-input')).toHaveValue('2026-10-26T12:15')
    await expect(first.getByTestId('meal-waking-day')).toHaveText('Waking day: provisional (wake time not set)')
    await first.getByTestId('meal-name-input').fill('Leftover soup')
    await first.getByTestId('save-meal').click()
    await expect(first).toBeHidden()
    await logMeal(page, 'Stew from the freezer', 'description', '')

    await expect(page.getByTestId('meal-row')).toHaveCount(2)
    await expect(page.getByTestId('unknown-count')).toHaveText('2 meals with unknown calories')
    await expect(page.getByTestId('headline-kcal')).toHaveText('Not available yet')
    await expect(page.getByTestId('likely-range')).toContainText('Not available yet')
    await expect(page.getByTestId('very-likely-range')).toContainText('Not available yet')
    await expect(page.getByTestId('day-score-na')).toContainText('Not available yet')
    await expect(page.getByTestId('day-score')).toHaveCount(0)
    await expect(page.getByText('No meals logged yet')).toHaveCount(0)
    await expect(page.getByTestId('empty-day')).toHaveCount(0)
    await expect(page.getByTestId('missing-info').getByTestId('missing-meal')).toHaveCount(2)
    await expect(page.getByTestId('biggest-line')).toHaveCount(0)

    // Your own log, saved under its own key, and the demo never touched.
    await page.reload()
    await expect(page.getByTestId('unknown-count')).toHaveText('2 meals with unknown calories')
    const mine = await stored(page, MINE_KEY)
    expect(mine.meals.map((m: { kcal: number | null }) => m.kcal)).toEqual([null, null])
    expect(await stored(page, DEMO_KEY)).toBeNull()
    expect(offHost).toEqual([])
  })
})

test.describe('slice 3: Meal Details, Edit and Delete', () => {
  test('meal details show the breakdown; editing the calories updates the row and the day, and survives a reload', async ({
    page,
  }) => {
    await openDemo(page)
    const sheet = await openDetails(page, 'Pasta bake (ready meal)')
    await expect(sheet.getByTestId('fictional-banner')).toHaveText(FICTIONAL)
    await expect(sheet.locator('.sheet-sub')).toHaveText('Photo estimate · 5:30 PM')
    await expect(sheet.getByTestId('details-kcal')).toHaveText('760 kcal')
    await expect(sheet.getByTestId('details-score')).toHaveText('Estimate score 54')
    expect(await digits(sheet.getByTestId('details-likely'))).toContain('468–1234')
    expect(await digits(sheet.getByTestId('details-very-likely'))).toContain('362–1596')
    await expect(sheet.getByTestId('details-protein')).toContainText('34 g')
    await expect(sheet.getByTestId('details-carbs')).toContainText('84 g')
    await expect(sheet.getByTestId('details-fat')).toContainText('30 g')
    await expect(sheet.getByTestId('details-source')).toContainText('Photo estimate · typical error 46%')
    await expect(sheet.getByTestId('details-source')).toContainText('assumption')
    await expect(sheet.getByTestId('details-note')).toHaveText(
      'Label on the box (whole package): 860 kcal, protein 42 g, carbs 96 g, fat 33 g.',
    )
    await expect(sheet.getByTestId('details-improve')).toContainText(
      'Logging it from "Nutrition label (typed)" would lower the typical error from 46% to 10%.',
    )
    await expectCleanCopy(page)

    // Its score opens the meal explanation with that meal's numbers.
    await sheet.getByTestId('details-score').click()
    await expect(page.getByTestId('explain-meal').getByTestId('explain-score')).toHaveText('Estimate score 54')
    await page.keyboard.press('Escape')

    // Edit opens the same sheet as logging, filled with the meal's current values.
    const again = await openDetails(page, 'Pasta bake (ready meal)')
    await again.getByTestId('edit-meal').click()
    const edit = page.getByTestId('log-meal-sheet')
    await expect(edit.getByRole('heading', { name: 'Edit: Pasta bake (ready meal)' })).toBeVisible()
    await expect(edit.getByTestId('meal-name-input')).toHaveValue('Pasta bake (ready meal)')
    await expect(edit.getByTestId('source-photo')).toBeChecked()
    await expect(edit.getByTestId('meal-kcal-input')).toHaveValue('760')
    await expect(edit.getByTestId('meal-when-input')).toHaveValue('2026-10-21T17:30')
    await expect(edit.getByTestId('meal-protein-input')).toHaveValue('34')
    await edit.getByTestId('meal-kcal-input').fill('900')
    await edit.getByTestId('save-meal').click()
    await expect(edit).toBeHidden()

    await expectDay(page, PASTA_900)
    await expect(row(page, 'Pasta bake (ready meal)')).toContainText('900 kcal')
    await expect(row(page, 'Pasta bake (ready meal)')).toContainText('Estimate score 54')
    await expect(page.getByTestId('meal-row')).toHaveCount(5)

    await page.reload()
    await expectDay(page, PASTA_900)
    await expect(row(page, 'Pasta bake (ready meal)')).toContainText('900 kcal')

    // A weighed meal already uses the most reliable source.
    const chicken = await openDetails(page, 'Chicken, rice and broccoli')
    await expect(chicken.getByTestId('details-improve')).toContainText('No better source in HowSure.')
  })

  test('deleting a meal removes it from the list and from every total, and survives a reload', async ({ page }) => {
    await openDemo(page)
    const pastaId = (await stored(page, DEMO_KEY)).meals.find((m: { name: string }) => m.name === 'Pasta bake (ready meal)').id

    let sheet = await openDetails(page, 'Pasta bake (ready meal)')
    // Delete asks once; Keep it changes nothing.
    await sheet.getByTestId('delete-meal').click()
    await expect(sheet.getByTestId('delete-confirm')).toContainText('Delete Pasta bake (ready meal)?')
    await sheet.getByTestId('delete-keep').click()
    await expect(sheet.getByTestId('delete-confirm')).toHaveCount(0)
    await sheet.getByRole('button', { name: 'Close' }).click()
    await expectDay(page, G11)

    sheet = await openDetails(page, 'Pasta bake (ready meal)')
    await sheet.getByTestId('delete-meal').click()
    await sheet.getByTestId('delete-confirm-btn').click()
    await expect(sheet).toBeHidden()

    const check = async () => {
      await expect(page.getByTestId('meal-row')).toHaveCount(4)
      await expect(page.getByTestId('meal-list')).not.toContainText('Pasta bake')
      await expectDay(page, NO_PASTA)
      await expect(page.getByTestId('macro-protein')).toContainText('90 g')
      await expect(page.getByTestId('macro-carbs')).toContainText('188 g')
      await expect(page.getByTestId('macro-fat')).toContainText('44 g')
      await expect(page.getByTestId('biggest-line')).toHaveText('Most uncertainty comes from Apple and peanut butter.')
      await page.getByTestId('day-score').click()
      const explain = page.getByTestId('explain-day')
      await expect(explain.getByTestId('contribution')).toHaveCount(4)
      await expect(explain).not.toContainText('Pasta bake')
      await explain.getByRole('button', { name: 'Close' }).click()
    }
    await check()
    await page.reload()
    await expect(page.getByTestId('fictional-banner')).toBeVisible()
    await check()
    const ids = (await stored(page, DEMO_KEY)).meals.map((m: { id: string }) => m.id)
    expect(ids).not.toContain(pastaId)
    expect(ids).toHaveLength(19)
  })
})
