// checklist.md slice 4 Verify: days follow sleep, not the clock, with sleep length and the
// 7-night average. Covers the slice-4 "- [ ]" criteria under prd.md > Sleep and Waking Days,
// > Previous Days and > The Core Journey (steps 6, 8). The provisional-day criteria are slice 5's.
// Also: logging a meal while viewing an earlier day defaults its date to that day (slice 3 carry-over),
// and your own log rejects a sleep time later than now (spec.md > Clock).
//
// Expected values are worked out separately, not read from the app:
// - day totals with scripts/golden.py's day() (spec.md formulas, Python);
// - night lengths from fixtures/demo-week.json by hand: Wed 04:35 to 13:20 is 8 h 45 min; the six
//   complete nights (530, 515, 530, 525, 550, 525 min) average 529.17 min, shown as 8 h 49 min;
//   after a new 04:40 to 13:10 night (510 min) the window is 515, 530, 525, 550, 525, 510: 525.83, 8 h 46 min.
import { expect, test, type Locator, type Page } from '@playwright/test'

const FICTIONAL = 'Sample person — fictional'
// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock): still Wednesday's waking day.
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')
const MINE_NOW = new Date('2026-10-26T12:15:00-04:00')

const G11 = { kcal: '2280', score: 'Estimate score 83', likely: '1870–2780', veryLikely: '1684–3087' }
// Tuesday 2026-10-20: photo 430, label_lookup 190, photo 720, description 280 (golden.py day()).
const TUESDAY = { kcal: '1620', score: 'Estimate score 67', likely: '1119–2345', veryLikely: '920–2852' }
// The same Tuesday with the veggie pizza edited from 720 to 800 kcal.
const TUESDAY_PIZZA_800 = { kcal: '1700', score: 'Estimate score 66', likely: '1168–2473', veryLikely: '958–3016' }

async function digits(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/,/g, '')
}

async function expectDay(page: Page, want: typeof G11) {
  expect(await digits(page.getByTestId('headline-kcal'))).toBe(want.kcal)
  await expect(page.getByTestId('day-score')).toHaveText(want.score)
  expect(await digits(page.getByTestId('likely-range'))).toContain(want.likely)
  expect(await digits(page.getByTestId('very-likely-range'))).toContain(want.veryLikely)
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

/** I'm going to sleep / I woke up: the sheet opens on now; set the date and time, then Save. */
async function sleepAction(page: Page, button: string, when: string) {
  const action = page.getByTestId('sleep-action')
  await expect(action).toHaveText(button)
  await action.click()
  const sheet = page.getByTestId('sleep-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText(FICTIONAL)
  await sheet.getByTestId('sleep-when-input').fill(when)
  await sheet.getByTestId('sleep-save').click()
  await expect(sheet).toBeHidden()
}

test.describe('slice 4: Sleep and Waking Days', () => {
  test('the after-midnight snack sits on Wednesday, while the demo clock says Thu 1:30 AM', async ({ page }) => {
    await openDemo(page)
    await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 1:20 PM')
    await expect(row(page, 'Apple and peanut butter')).toBeVisible()
    await expect(row(page, 'Apple and peanut butter')).toContainText('Thu 12:40 AM')
    await expect(row(page, 'Kefir with oats and blueberries')).toBeVisible()
    await expect(page.getByTestId('meal-row')).toHaveCount(5)
    await expectDay(page, G11)
  })

  test("the sleep section shows last night's length and the 7-night average as 6 of 7 nights", async ({ page }) => {
    await openDemo(page)
    const sleep = page.getByTestId('sleep-section')
    await expect(sleep.getByTestId('sleep-status')).toHaveText('Awake')
    await expect(sleep.getByTestId('sleep-action')).toHaveText('I’m going to sleep')
    await expect(sleep).toContainText('Last night')
    await expect(sleep.getByTestId('last-night')).toHaveText('8 h 45 min')
    await expect(sleep).toContainText('7-night average')
    await expect(sleep.getByTestId('sleep-average')).toContainText('8 h 49 min')
    await expect(sleep.getByTestId('night-count')).toContainText('6 of 7 nights')

    // Each night is one tap deep; the seeded night with no sleep start reads "not logged", never 0 h.
    await sleep.getByText('Each night').click()
    const rows = sleep.getByTestId('night-row')
    await expect(rows).toHaveCount(7)
    await expect(rows.filter({ hasText: 'Night before Tue' })).toContainText('not logged')
    await expect(sleep).not.toContainText(/\b0 h\b/)
    await expect(sleep.getByTestId('avg-wake')).toHaveText('Average wake time 1:17 PM')
  })

  test('a night with no sleep start is "not logged" and left out of the average', async ({ page }) => {
    await openDemo(page)
    await page.getByTestId('day-prev').click()
    await expect(page.getByTestId('waking-day')).toHaveText('Tue · awake since 1:05 PM')
    const sleep = page.getByTestId('sleep-section')
    await expect(sleep).toContainText('Night before this day')
    await expect(sleep.getByTestId('last-night')).toHaveText('not logged')
    // Up to Tuesday: six nights, five complete (530, 515, 530, 525, 550 min: 530 min, 8 h 50 min).
    await expect(sleep.getByTestId('night-count')).toContainText('5 of 6 nights')
    await expect(sleep.getByTestId('sleep-average')).toContainText('8 h 50 min')
  })

  test('I’m going to sleep, then I woke up, starts a new empty waking day; Wednesday stays reachable', async ({ page }) => {
    await openDemo(page)

    // 04:40 is later than the demo clock (01:30), so the demo moves forward to it (spec.md > Clock).
    await page.getByTestId('sleep-action').click()
    const sheet = page.getByTestId('sleep-sheet')
    await expect(sheet.getByTestId('sleep-when-input')).toHaveValue('2026-10-22T01:30') // defaults to now
    await expect(sheet).toContainText('This closes the waking day that started Wed 1:20 PM.')
    await sheet.getByTestId('sleep-when-input').fill('2026-10-22T04:40')
    await expect(sheet.getByTestId('demo-advance')).toBeVisible()
    await sheet.getByTestId('sleep-save').click()
    await expect(sheet).toBeHidden()

    const sleep = page.getByTestId('sleep-section')
    await expect(sleep.getByTestId('sleep-status')).toHaveText('Asleep since Thu 4:40 AM')
    // Asleep, the day hasn't moved on yet: Wednesday is still on screen.
    await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 1:20 PM')

    await page.getByTestId('sleep-action').click()
    await expect(page.getByTestId('sleep-sheet').getByTestId('sleep-when-input')).toHaveValue('2026-10-22T04:40')
    await page.keyboard.press('Escape')
    await sleepAction(page, 'I woke up', '2026-10-22T13:10')

    // The new, empty waking day.
    await expect(page.getByTestId('waking-day')).toHaveText('Thu · awake since 1:10 PM')
    await expect(page.getByTestId('empty-day')).toContainText('No meals logged yet')
    await expect(page.getByTestId('headline-kcal')).toHaveText('Not available yet')
    await expect(page.getByTestId('meal-row')).toHaveCount(0)
    await expect(sleep.getByTestId('sleep-status')).toHaveText('Awake')
    await expect(sleep.getByTestId('last-night')).toHaveText('8 h 30 min')
    // The new night counts toward the average: 6 of 7 nights, 525.83 min.
    await expect(sleep.getByTestId('night-count')).toContainText('6 of 7 nights')
    await expect(sleep.getByTestId('sleep-average')).toContainText('8 h 46 min')
    await expect(page.getByTestId('day-next')).toBeDisabled()

    // previous: Wednesday, snack included, with its own totals.
    await page.getByTestId('day-prev').click()
    await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 1:20 PM')
    await expect(row(page, 'Apple and peanut butter')).toBeVisible()
    await expectDay(page, G11)

    // A reload keeps the new day and the demo clock (spec.md > Store, > Clock).
    await page.reload()
    await expect(page.getByTestId('waking-day')).toHaveText('Thu · awake since 1:10 PM')
    await expect(page.getByTestId('empty-day')).toBeVisible()
  })

  test('your own log rejects a sleep time later than now, keeps it, and saves nothing', async ({ page }) => {
    await page.clock.setFixedTime(MINE_NOW)
    await page.goto('/')
    await page.getByRole('button', { name: 'Start empty' }).click()
    await page.getByTestId('sleep-action').click()
    const sheet = page.getByTestId('sleep-sheet')
    await expect(sheet.getByTestId('sleep-when-input')).toHaveValue('2026-10-26T12:15')
    await sheet.getByTestId('sleep-when-input').fill('2026-10-26T23:00')
    await sheet.getByTestId('sleep-save').click()
    await expect(sheet.getByTestId('sleep-error')).toHaveText('That time is later than now. Pick a time up to now.')
    await expect(sheet.getByTestId('sleep-when-input')).toHaveValue('2026-10-26T23:00')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('sleep-status')).toHaveText('Awake')
    const mine = await page.evaluate(() => JSON.parse(localStorage.getItem('howsure.mine.v1') ?? 'null'))
    expect(mine?.sleeps ?? []).toEqual([])
  })
})

test.describe('slice 4: Previous Days', () => {
  test("previous shows Tuesday with its own meals, totals and score; next comes back to Wednesday", async ({ page }) => {
    await openDemo(page)
    await expect(page.getByTestId('day-next')).toBeDisabled()
    await page.getByTestId('day-prev').click()
    await expect(page.getByTestId('waking-day')).toHaveText('Tue · awake since 1:05 PM')
    await expect(page.getByTestId('meal-row')).toHaveCount(4)
    await expect(row(page, 'Veggie pizza')).toBeVisible()
    await expect(row(page, 'Apple and peanut butter')).toHaveCount(0)
    await expect(page.getByText('Calories that day')).toBeVisible()
    await expectDay(page, TUESDAY)
    await expect(page.getByTestId('biggest-line')).toContainText('Veggie pizza')

    await page.getByTestId('day-next').click()
    await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 1:20 PM')
    await expectDay(page, G11)
    await expect(page.getByTestId('day-today')).toHaveCount(0)
  })

  test('the date picker opens the waking day for a date, and Back to today returns', async ({ page }) => {
    await openDemo(page)
    await page.getByTestId('day-date').fill('2026-10-20')
    await expect(page.getByTestId('waking-day')).toHaveText('Tue · awake since 1:05 PM')
    await expectDay(page, TUESDAY)
    // Saturday 2026-10-17 has nothing logged.
    await page.getByTestId('day-date').fill('2026-10-17')
    await expect(page.getByTestId('waking-day')).toHaveText('Sat · awake since 1:00 PM')
    await expect(page.getByTestId('empty-day')).toContainText('No meals logged yet')
    await page.getByTestId('day-today').click()
    await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 1:20 PM')
    await expectDay(page, G11)
  })

  test('editing a meal on a previous day updates that day only, and survives a reload', async ({ page }) => {
    await openDemo(page)
    await page.getByTestId('day-prev').click()
    await row(page, 'Veggie pizza').getByTestId('meal-open').click()
    const details = page.getByTestId('meal-details')
    await expect(details.getByRole('heading', { name: 'Veggie pizza' })).toBeVisible()
    await details.getByTestId('edit-meal').click()
    const edit = page.getByTestId('log-meal-sheet')
    await expect(edit.getByTestId('meal-kcal-input')).toHaveValue('720')
    await edit.getByTestId('meal-kcal-input').fill('800')
    // The before/after preview is Tuesday's, not today's.
    await expect(edit.getByTestId('meal-waking-day')).toHaveText('Waking day: Tue · awake since 1:05 PM')
    await edit.getByTestId('save-meal').click()
    await expect(edit).toBeHidden()

    await expect(page.getByTestId('waking-day')).toHaveText('Tue · awake since 1:05 PM')
    await expectDay(page, TUESDAY_PIZZA_800)
    await expect(row(page, 'Veggie pizza')).toContainText('800 kcal')

    await page.getByTestId('day-next').click()
    await expectDay(page, G11)

    await page.reload()
    await expectDay(page, G11)
    await page.getByTestId('day-prev').click()
    await expectDay(page, TUESDAY_PIZZA_800)
  })

  test('logging a meal while viewing a previous day defaults its date to that day', async ({ page }) => {
    await openDemo(page)
    await page.getByTestId('day-prev').click()
    await page.getByTestId('log-meal').click()
    const sheet = page.getByTestId('log-meal-sheet')
    await expect(sheet).toBeVisible()
    // Now's clock time (01:30) on the first date inside Tuesday's waking day (Tue 13:05 to Wed 13:20).
    await expect(sheet.getByTestId('meal-when-input')).toHaveValue('2026-10-21T01:30')
    await expect(sheet.getByTestId('meal-waking-day')).toHaveText('Waking day: Tue · awake since 1:05 PM')
    await expect(sheet.getByTestId('meal-other-day')).toHaveCount(0)

    await sheet.getByTestId('meal-name-input').fill('Toast')
    await sheet.getByTestId('source-label').check()
    await sheet.getByTestId('meal-kcal-input').fill('150')
    await sheet.getByTestId('save-meal').click()
    await expect(sheet).toBeHidden()
    await expect(page.getByTestId('waking-day')).toHaveText('Tue · awake since 1:05 PM')
    await expect(row(page, 'Toast')).toBeVisible()
    await expect(page.getByTestId('meal-row')).toHaveCount(5)
    await page.getByTestId('day-next').click()
    await expect(row(page, 'Toast')).toHaveCount(0)
    await expectDay(page, G11)
  })
})
