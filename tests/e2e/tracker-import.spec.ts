// Build-out item 2.1b: import an export of your earlier tracker (a tracker bundle) into your own
// log, through Profile and privacy, in every look. The preview says what the file becomes and what
// the conversion did before anything is replaced; Cancel changes nothing; the dashboard reads
// sensibly when the imported log's last wake-up is days old; an imported meal says its time is
// approximate and where its figures came from; a log that held something is kept as an older copy.
//
// The bundle is fictional: Sam's invented week (fixtures/tracker-bundle-sam.json). Expected values
// are worked out by hand from it (see src/import/__tests__/trackerBundle.test.ts):
// - 19 meals on 5 dates, 5 nights, Mon 12 Oct to Sat 17 Oct 2026, targets 2,300 kcal and
//   140 g protein; Wed 14 Oct has no sleep record and joins Tue 13 Oct.
// - Tue's waking day then holds 8 meals: 2,280 kcal from Tue and 1,345 from Wed, 3,625 in all.
// - The last wake is Sat 17 Oct 8:00 AM; the clock here is Tue 20 Oct 2026 noon, 3 days on.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { LOOKS, startInLook } from './looks'
import { E2E_KEYS } from './storage-keys'

const TRACKER = readFileSync(fileURLToPath(new URL('../../fixtures/tracker-bundle-sam.json', import.meta.url)), 'utf8')
const V1_MINE = readFileSync(fileURLToPath(new URL('../../fixtures/saved/v1-mine.json', import.meta.url)), 'utf8')
const NOW = new Date('2026-10-20T12:00:00-04:00')

const NAME_KEPT = /^Guest name after import: [A-Z][a-z]+[A-Z][a-z]+#\d{4}, your current one\. The file has none\.$/
const BECOMES = ['19 meals on 5 days', '5 nights of sleep', '2 weigh-ins', 'From Mon 12 Oct to Sat 17 Oct', 'Targets: 2,300 kcal and at least 140 g protein']
const NOTES = [
  'All 19 meals’ times are approximate. Your tracker kept the day, not the time eaten, so HowSure placed each meal in its waking day by its type.',
  '16 of 19 meals keep your tracker’s figure for how sure they are. The others use HowSure’s figure for their source.',
  '3 meals have no source recorded. HowSure counts them as Description.',
  '2 descriptions were cut short in your tracker. They are kept as they are.',
  'The bed time on Fri 16 Oct didn’t fall between the wake-up before it and its own wake-up, so it was worked out from the wake time and hours asleep in the same record.',
  '1 of 2 weigh-ins has no recorded time, so it is placed on its date, just after that date’s wake-up (at noon with no wake-up that date), and marked approximate.',
  'Not imported: 1 plate waiting to be logged and your tracker’s sync notes.',
]

async function chooseTracker(page: Page, text = TRACKER) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('import-data').click()])
  await chooser.setFiles({ name: 'tracker-bundle-sam.json', mimeType: 'application/json', buffer: Buffer.from(text) })
}

async function startEmpty(page: Page) {
  await page.clock.setFixedTime(NOW)
  await page.goto('/')
  await page.getByRole('button', { name: 'Start my log' }).click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function digits(page: Page, testId: string): Promise<string> {
  return (await page.getByTestId(testId).innerText()).replace(/,/g, '')
}

for (const { id: look, name } of LOOKS) {
  test.describe(`item 2.1b in the ${name} look: import a tracker export`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('preview, confirm, the dashboard and an imported meal', async ({ page }) => {
      test.setTimeout(60_000)
      await startEmpty(page)
      await page.getByTestId('open-profile').click()
      const panel = page.getByTestId('profile-privacy')

      await chooseTracker(page)
      const preview = panel.getByTestId('import-preview')
      await expect(preview.getByTestId('import-preview-kind')).toHaveText('An export from your earlier tracker. HowSure turns it into your log.')
      await expect(preview.getByTestId('import-preview-holds').getByRole('listitem')).toHaveText(BECOMES)
      // Build-out item 2.10: a tracker export has no guest name, so the log keeps yours. A line under
      // the list says so; the list of what the file becomes holds no name.
      await expect(preview.getByTestId('import-preview-name')).toHaveText(NAME_KEPT)
      await expect(preview.getByTestId('import-preview-name')).toHaveClass(/privacy-hint/)
      await expect(preview.getByTestId('import-preview-holds')).not.toContainText('Guest name')
      await expect(preview.getByTestId('import-preview-notes').getByRole('listitem')).toHaveText(NOTES)
      await expect(preview.getByTestId('import-preview-joined').getByRole('listitem')).toHaveText(['Wed 14 Oct joins Tue 13 Oct'])
      await expect(preview.getByText('Dates joined to the day before', { exact: true })).toHaveClass(/privacy-subtitle/)
      // Dates stay whole when the line wraps.
      await expect(preview.getByTestId('import-preview-holds').locator('.keep-together')).toHaveText(['2 weigh-ins', 'Mon 12 Oct', 'Sat 17 Oct'])
      // The name is kept, so it is not among what the import replaces.
      await expect(preview.getByTestId('import-preview-replaces')).toHaveText(
        'Importing replaces your targets, body details and settings on this device. Your log has no meals or sleep yet.',
      )
      // Nothing to replace yet, so the button just imports, in the plain main style.
      await expect(preview.getByTestId('import-confirm')).toHaveText('Import')
      await expect(preview.getByTestId('import-confirm')).toHaveClass(/btn-primary/)
      // Nothing is saved until the person confirms.
      expect((await page.evaluate((k) => localStorage.getItem(k), E2E_KEYS.mine)) ?? '').not.toContain('tracker')

      await preview.getByTestId('import-confirm').click()
      await expect(panel.getByTestId('privacy-status')).toHaveText('Imported. Your log now holds 19 meals, 5 nights of sleep and 2 weigh-ins.')
      await page.keyboard.press('Escape')
      await expect(panel).toHaveCount(0)

      // The current day is Saturday's, three days old: the header says when that wake-up was.
      await expect(page.getByTestId('waking-day')).toHaveText('Last wake\u2011up Sat 17 Oct, 8:00 AM · 3 days ago')
      await expect(page.getByTestId('waking-day').locator('.keep-together')).toHaveText(['Sat 17 Oct', '8:00 AM', '3 days ago'])
      await expect(page.getByTestId('stale-wake')).toContainText('To add last night, use “I’m going to sleep” and set when you went to bed.')
      await expect(page.getByTestId('sleep-action')).toHaveText('I’m going to sleep')
      await expect(page.getByTestId('set-today-wake')).toBeVisible()
      // On the narrowest screens it takes a shorter label and stays on one line.
      const size = page.viewportSize()
      await page.setViewportSize({ width: 320, height: 640 })
      await expect.poll(() => page.getByTestId('set-today-wake').innerText()).toBe('Set wake time')
      await expect(page.getByTestId('set-today-wake')).toHaveAccessibleName('Set wake time')
      expect((await page.getByTestId('set-today-wake').boundingBox())?.height ?? 99).toBeLessThan(46)
      if (size) await page.setViewportSize(size)
      await expect.poll(() => page.getByTestId('set-today-wake').innerText()).toBe('Set today’s wake time')
      await expect(page.getByTestId('set-today-wake')).toHaveAccessibleName('Set today’s wake time')
      // Now, three days on: no claim of being awake all that time, in every look.
      await expect(page.getByTestId('sleep-status')).toHaveText(
        look === 'night' ? 'Tue 12:00 PM · no sleep logged since this wake\u2011up' : 'No sleep logged since this wake\u2011up',
      )
      // The sleep details say the same, not "Awake".
      await page.getByTestId(look === 'night' ? 'tl-now' : 'sleep-open').click()
      await expect(page.getByTestId('sleep-detail-now')).toContainText('No sleep logged since this wake\u2011up')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('sleep-details')).toHaveCount(0)
      // The weigh-ins are in the weight log, shown in lb as the tracker kept them: Friday's 157.9 lb.
      await expect(page.getByTestId('weight-average-value')).toHaveText('157.9 lb')
      // Saturday's day is three days old, so the weight section doesn't call it "today" either.
      await expect(page.getByTestId('weight-day')).toHaveText('No weigh-in that day')
      // The current day is still going on: no "ran for" note (the header speaks for it).
      await expect(page.getByTestId('long-day')).toHaveCount(0)
      // Friday, the day just before, holds meals: no pointer to them.
      await expect(page.getByTestId('latest-meal')).toHaveCount(0)
      // Not called "today" or "last night": that day is three days old.
      await expect(page.getByTestId('dashboard')).toContainText('Calories that day')
      await expect(page.getByTestId('dashboard')).not.toContainText('Calories today')
      await expect(page.getByTestId('empty-day')).toBeVisible()

      // Tuesday, with Wednesday joined to it.
      for (let i = 0; i < 3; i += 1) await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('waking-day')).toContainText('Tue')
      // Now's sleep status on an earlier day: no "Awake" while no sleep is logged since the current
      // day's wake, and it names that wake, never reading as this day's own wake-up (Tuesday has
      // nights logged after it).
      if (look !== 'night') {
        await expect(page.getByTestId('sleep-status')).toHaveText('Now: no sleep logged since the wake\u2011up on Sat 17 Oct')
        await expect(page.getByTestId('sleep-status')).not.toHaveText(/this wake/)
      }
      expect(await digits(page, 'headline-kcal')).toBe('3625')
      // Two dates' meals in one waking day of 47 h 30 min: the day says how long it ran, in plain text.
      await expect(page.getByTestId('long-day')).toHaveText(
        'This day ran for 47 h 30 min to its next wake-up, so a night may be missing. Its meals and total cover all of that time, more than one day.',
      )
      await expect(page.getByTestId('long-day')).toHaveCSS('font-weight', '400')
      await expect(page.getByTestId('meal-row')).toHaveCount(8)

      const gnocchi = page.getByTestId('meal-row').filter({ hasText: 'Baked gnocchi with tomato and basil' })
      await expect(gnocchi.getByTestId('meal-open')).toHaveAttribute('aria-label', /about Wed 6:55 PM/)
      await gnocchi.getByTestId('meal-open').click()
      const details = page.getByTestId('meal-details')
      await expect(details).toContainText('Photo estimate · about Wed 6:55 PM')
      // The day and time stay together when the subtitle wraps on a narrow screen.
      await expect(details.locator('.sheet-sub .keep-together')).toHaveText(['Wed 6:55 PM'])
      await expect(details.getByTestId('details-kcal')).toHaveText('690 kcal')
      await expect(details.getByTestId('details-score')).toHaveText('Estimate score 71')
      await expect(details.getByTestId('details-source')).toContainText('Photo estimate · typical error 29%')
      await expect(details.getByTestId('details-source').getByTestId('basis-tag')).toHaveText('from your tracker')
      await expect(details.getByTestId('details-time-approx')).toHaveText('Time approximate: your tracker kept the day, not the time eaten.')
      await expect(details.getByTestId('details-tracker-source')).toContainText('Estimated from a photo, with the restaurant or dish identified')
      await expect(details.getByTestId('details-tracker-type')).toContainText('Dinner')
      await expect(details.getByTestId('details-tracker-error')).toHaveText(
        'This meal’s typical error is your tracker’s figure for it. HowSure’s figure for Photo estimate is 46%.',
      )
      await expect(details.getByTestId('details-truncated')).toHaveText('Description cut short in your tracker.')
      await expect(details.getByTestId('details-joined')).toHaveText(
        'Filed under Wed 14 Oct in your tracker, which has no sleep recorded for that date. It shows on Tue 13 Oct’s waking day until that night is added.',
      )
      // Its score explanation says the figure is the meal's own, from the tracker.
      await details.getByTestId('details-score').click()
      await expect(page.getByTestId('meal-score-sentence')).toHaveText(
        'A 71% estimate score means this meal is assigned a typical error of about 29%, your tracker’s figure for it. It does not mean there is a 71% chance this meal is correct. The actual error could be larger.',
      )
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('explain-meal')).toHaveCount(0)
      if (await details.isVisible()) await page.keyboard.press('Escape')
      // A past day's score isn't "today's".
      await page.getByTestId('day-score').click()
      await expect(page.getByTestId('explain-day')).toContainText("How sure is this day's total?")
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('explain-day')).toHaveCount(0)

      // A meal with no source recorded counts as Description, with HowSure's figure.
      await page.getByTestId('meal-row').filter({ hasText: 'Rice and beans with salsa' }).getByTestId('meal-open').click()
      await expect(details.getByTestId('details-tracker-source')).toContainText('No source recorded')
      await expect(details.getByTestId('details-source')).toContainText('Description · typical error 41%')
      await expect(details.getByTestId('details-tracker-error')).toHaveText(
        'Your tracker had no usable figure for this meal, so HowSure’s figure for its source applies.',
      )
      await page.keyboard.press('Escape')

      // Returning opens the last log used, imported log and all.
      await page.reload()
      await expect(page.getByTestId('waking-day')).toHaveText('Last wake\u2011up Sat 17 Oct, 8:00 AM · 3 days ago')

      // Set today's wake time starts a new day; the header then reads as usual.
      await page.getByTestId('set-today-wake').click()
      const sleepSheet = page.getByTestId('sleep-sheet')
      await sleepSheet.getByTestId('sleep-time-input').fill('7:10')
      await sleepSheet.getByTestId('sleep-save').click()
      await expect(sleepSheet).toHaveCount(0)
      await expect(page.getByTestId('waking-day')).toHaveText('Tue · awake since 7:10 AM')
      await expect(page.getByTestId('stale-wake')).toHaveCount(0)
    })
  })
}

test.describe('item 2.1b: importing over a log keeps it, and Cancel changes nothing', () => {
  test('Cancel at the preview changes nothing', async ({ page }) => {
    await startEmpty(page)
    await page.getByTestId('open-profile').click()
    const panel = page.getByTestId('profile-privacy')
    const before = await page.evaluate(() => JSON.stringify(localStorage))
    await chooseTracker(page)
    await panel.getByTestId('import-cancel').click()
    await expect(panel.getByTestId('import-data')).toBeFocused()
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(before)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('empty-day')).toBeVisible()
  })

  test('the log it replaces is kept as an older copy, which Export offers', async ({ page }) => {
    await page.clock.setFixedTime(NOW)
    await page.goto('/')
    await page.evaluate(
      ([k, v, a]) => {
        localStorage.setItem(k, v)
        localStorage.setItem(a, 'mine')
      },
      [E2E_KEYS.mine, V1_MINE, E2E_KEYS.active] as const,
    )
    await page.reload()
    await page.getByTestId('open-profile').click()
    const panel = page.getByTestId('profile-privacy')
    await chooseTracker(page)
    await expect(panel.getByTestId('import-preview-replaces')).toHaveText(
      'Importing replaces your log on this device, which holds 6 meals, 3 nights of sleep, 1 workout, 1 saved plate and 1 weigh-in, and your targets, body details and settings. HowSure keeps a copy of it, which you can export from this panel.',
    )
    // Build-out item 2.10: Sam's name is kept, as the tracker export has none.
    await expect(panel.getByTestId('import-preview-name')).toHaveText('Guest name after import: Sam, your current one. The file has none.')
    await expect(panel.getByTestId('import-confirm')).toHaveText('Replace my log')
    // Replacing a log that holds something uses the destructive style, as Delete my data does.
    await expect(panel.getByTestId('import-confirm')).toHaveClass(/btn-ink/)
    await expect(panel.getByTestId('import-confirm')).not.toHaveClass(/btn-primary/)
    await panel.getByTestId('import-confirm').click()
    await expect(panel.getByTestId('privacy-status')).toHaveText('Imported. Your log now holds 19 meals, 5 nights of sleep and 2 weigh-ins. The log it replaced is kept as an older copy, which you can export from this panel.')
    expect(await page.evaluate((k) => localStorage.getItem(k), `${E2E_KEYS.mine}.backup-v1`)).toBe(V1_MINE)
    await expect(panel.getByTestId('export-older-copies')).toHaveText('Export 1 older copy')
    const [download] = await Promise.all([page.waitForEvent('download'), panel.getByTestId('export-older-copies').click()])
    const path = test.info().outputPath(download.suggestedFilename())
    await download.saveAs(path)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
      app: 'HowSure',
      olderCopies: [{ key: `${E2E_KEYS.mine}.backup-v1`, text: V1_MINE }],
    })
  })
})

for (const { id: look, name } of LOOKS) {
  test(`item 2.1b in the ${name} look: an empty current day points at the latest meals days back`, async ({ page }) => {
    await startInLook(page, look)
    await startEmpty(page)
    // Without Friday's meals, the latest are Thursday's: two days before Saturday's empty day.
    const json = JSON.parse(TRACKER)
    json.meals = json.meals.filter((m: { data: { date: string } }) => m.data.date !== '2026-10-16')
    await page.getByTestId('open-profile').click()
    await chooseTracker(page, JSON.stringify(json))
    await page.getByTestId('import-confirm').click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('empty-day')).toBeVisible()
    const link = page.getByTestId('latest-meal')
    await expect(link).toHaveText('Last meal logged: Thu 15 Oct ›')
    // Earlier meals exist, so the button doesn't say "first".
    await expect(page.getByTestId('log-meal')).toHaveText('Log a meal')
    // The line sits right under "No meals logged yet" on every width: in the empty-day tile in
    // Journal and Panel (including Panel's wide grid), on the timeline's empty point in Night.
    await expect(page.getByTestId('empty-day').getByTestId('latest-meal')).toBeVisible()
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const tile = await page.getByTestId('empty-day').boundingBox()
      const box = await link.boundingBox()
      expect(box && tile && box.y >= tile.y && box.y + box.height <= tile.y + tile.height + 0.5, `width ${width}`).toBe(true)
      // No sideways scrolling.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `width ${width}`).toBe(true)
    }
    // By keyboard: focus moves to the new day's waking-day line, not to the top of the page.
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('waking-day')).toContainText('Thu')
    await expect(page.getByTestId('waking-day')).toBeFocused()
    await expect(page.getByTestId('latest-meal')).toHaveCount(0)
    await expect(page.getByTestId('empty-day')).toHaveCount(0)
  })

  test(`item 2.1b in the ${name} look: an earlier empty day never points at a later meal`, async ({ page }) => {
    await startInLook(page, look)
    await startEmpty(page)
    // Two nights with nothing logged, Fri 9 and Sat 10 Oct, before the first meal date.
    const json = JSON.parse(TRACKER)
    const night = json.sleep.find((r: { id: string }) => r.id === '2026-10-13')
    for (const [date, prev] of [['2026-10-10', '2026-10-09'], ['2026-10-09', '2026-10-08']]) {
      json.sleep.unshift({ ...night, id: date, data: { ...night.data, date, bed: `${prev}T23:00:00-04:00`, wake: `${date}T07:00:00-04:00`, hours: 8 } })
    }
    await page.getByTestId('open-profile').click()
    await chooseTracker(page, JSON.stringify(json))
    await expect(page.getByTestId('import-preview-holds').getByRole('listitem').nth(1)).toHaveText('7 nights of sleep')
    await page.getByTestId('import-confirm').click()
    await page.keyboard.press('Escape')
    // Back to Fri 9 Oct: Sat 17 Oct, Fri 16, Thu 15, Tue 13 (Wed joins it), Mon 12, Sat 10 (it runs
    // to Monday's wake), Fri 9.
    for (let i = 0; i < 6; i += 1) await page.getByTestId('day-prev').click()
    await expect(page.getByTestId('day-date')).toHaveValue('2026-10-09')
    await expect(page.getByTestId('waking-day')).toHaveText('Fri · awake since 7:00 AM')
    // The time stays whole when the header wraps on a narrow screen.
    await expect(page.getByTestId('waking-day').locator('.keep-together')).toHaveText(['7:00 AM'])
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.getByTestId('empty-day')).toBeVisible()
      // Every meal was logged a week later: no "Last meal logged" link, and nothing "first" to undo.
      await expect(page.getByTestId('latest-meal'), `width ${width}`).toHaveCount(0)
      await expect(page.getByTestId('log-meal')).toHaveText('Log your first meal')
    }
    await page.getByTestId('day-next').click()
    await expect(page.getByTestId('day-date')).toHaveValue('2026-10-10')
    await expect(page.getByTestId('latest-meal')).toHaveCount(0)
  })

  test(`item 2.1b in the ${name} look: a tracker export with nothing left to import is refused`, async ({ page }) => {
    await startInLook(page, look)
    await startEmpty(page)
    const json = JSON.parse(TRACKER)
    json.meals = json.meals.map((m: { data: object }) => ({ ...m, data: { ...m.data, date: 'someday' } }))
    json.sleep = []
    json.weighins = []
    await page.getByTestId('open-profile').click()
    const panel = page.getByTestId('profile-privacy')
    const before = await page.evaluate(() => JSON.stringify(localStorage))
    await chooseTracker(page, JSON.stringify(json))
    await expect(panel.getByTestId('privacy-error')).toHaveText(
      "This tracker export has no meals, sleep or weigh-ins HowSure can use, so it wasn't imported. Nothing was changed. Choose another export from your tracker.",
    )
    await expect(panel.getByTestId('import-preview')).toHaveCount(0)
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(before)
  })
}


for (const { id: look, name } of LOOKS) {
  test(`item 2.1b in the ${name} look: the confirmation after importing over a full log is in view`, async ({ page }) => {
    test.setTimeout(90_000)
    await startInLook(page, look)
    // At a phone's size and a laptop's, each from a fresh start: import the bundle, then import it
    // again over the full log. Once the old log is kept the panel grows an "Export 1 older copy" row.
    for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size)
      await page.goto('/')
      await page.evaluate(() => localStorage.clear())
      await startEmpty(page)
      await page.getByTestId('open-profile').click()
      const panel = page.getByTestId('profile-privacy')
      await chooseTracker(page)
      await panel.getByTestId('import-confirm').click()
      await expect(panel.getByTestId('privacy-status')).toBeVisible()
      await chooseTracker(page)
      const confirm = panel.getByTestId('import-confirm')
      await expect(confirm).toHaveText('Replace my log')
      // Scrolled a little way down the preview, then the button pressed where it is (a click
      // here would first scroll the button into view): the sheet keeps that small scroll once the
      // preview closes, which is what once left the message under the header.
      await panel.evaluate((el) => {
        el.scrollTop = 60
      })
      await confirm.evaluate((b: HTMLButtonElement) => b.click())
      const status = panel.getByTestId('privacy-status')
      await expect(status).toHaveText('Imported. Your log now holds 19 meals, 5 nights of sleep and 2 weigh-ins. The log it replaced is kept as an older copy, which you can export from this panel.')
      await expect(status).toBeFocused()
      await expect(panel.getByTestId('export-older-copies')).toHaveText('Export 1 older copy')
      await expect(status).toBeInViewport({ ratio: 1 })
      // Not under the sticky sheet header: the whole message sits below it.
      const header = await panel.locator('header').first().boundingBox()
      const box = await status.boundingBox()
      expect(header && box && box.y >= header.y + header.height - 0.5, `${size.width}x${size.height}`).toBe(true)
    }
  })

  test(`item 2.1b in the ${name} look: an edited imported meal says truly where its figure comes from`, async ({ page }) => {
    test.setTimeout(60_000)
    await startInLook(page, look)
    await startEmpty(page)
    await page.getByTestId('open-profile').click()
    // Without Saturday's night, the current day is Friday's, with meals, its wake four days old.
    const json = JSON.parse(TRACKER)
    json.sleep = json.sleep.filter((r: { id: string }) => r.id !== '2026-10-17')
    await chooseTracker(page, JSON.stringify(json))
    await page.getByTestId('import-confirm').click()
    // Body details, so the estimated deficit or surplus can show.
    await page.getByTestId('edit-body').click()
    const body = page.getByTestId('body-sheet')
    await body.getByTestId('body-age-input').fill('34')
    await body.getByTestId('body-sex-female').check()
    await body.getByTestId('body-height-cm-input').fill('168')
    await body.getByTestId('body-weight-input').fill('64')
    await body.getByTestId('save-body').click()
    await expect(body).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('profile-privacy')).toHaveCount(0)
    // The current day's wake is three days old: no estimate counting three days of burn.
    await expect(page.getByTestId('balance-na')).toHaveText('Estimated deficit or surplus: not counted, as you woke up more than a day ago.')
    await expect(page.getByTestId('balance')).toHaveCount(0)
    await expect(page.getByTestId('waking-day')).toHaveText('Last wake\u2011up Fri 16 Oct, 7:30 AM · 4 days ago')

    // Tuesday, with Wednesday joined to it.
    for (let i = 0; i < 2; i += 1) await page.getByTestId('day-prev').click()
    await expect(page.getByTestId('waking-day')).toContainText('Tue')
    // Tuesday runs from its wake to Thursday's, 47 h 30 min, as Wednesday has no night: it isn't
    // counted as one day.
    await expect(page.getByTestId('balance-na')).toHaveText(
      'Estimated deficit or surplus: not counted, as this day runs for more than 36 hours. A night may be missing.',
    )
    await expect(page.getByTestId('balance')).toHaveCount(0)
    // An earlier day of ordinary length with its next wake (Monday) is estimated as usual.
    await page.getByTestId('day-prev').click()
    await expect(page.getByTestId('waking-day')).toContainText('Mon')
    await expect(page.getByTestId('balance')).toBeVisible()
    await page.getByTestId('day-next').click()
    await expect(page.getByTestId('waking-day')).toContainText('Tue')
    await page.getByTestId('meal-row').filter({ hasText: 'Baked gnocchi' }).getByTestId('meal-open').click()
    const details = page.getByTestId('meal-details')
    await expect(details.getByTestId('details-source').getByTestId('basis-tag')).toHaveText('from your tracker')
    await details.getByTestId('edit-meal').click()
    const sheet = page.getByTestId('log-meal-sheet')
    await sheet.getByTestId('meal-kcal-input').fill('720')
    await sheet.getByTestId('save-meal').click()
    await expect(sheet).toHaveCount(0)
    await page.getByTestId('meal-row').filter({ hasText: 'Baked gnocchi' }).getByTestId('meal-open').click()
    await expect(details.getByTestId('details-kcal')).toHaveText('720 kcal')
    await expect(details.getByTestId('details-source')).toContainText('Photo estimate · typical error 46%')
    await expect(details.getByTestId('details-source').getByTestId('basis-tag')).not.toHaveText('from your tracker')
    await expect(details.getByTestId('details-tracker-error')).toHaveText(
      'Its calories or source changed since the import, so HowSure’s figure for its source applies. Your tracker’s figure for it was 29%.',
    )
    // Still imported, with its time still approximate (only the calories changed).
    await expect(details.getByTestId('details-time-approx')).toBeVisible()
    await expect(details.getByTestId('details-tracker-source')).toContainText('Estimated from a photo')
    // Still on Tuesday's waking day: the joined line says so.
    await expect(details.getByTestId('details-joined')).toHaveText(
      'Filed under Wed 14 Oct in your tracker, which has no sleep recorded for that date. It shows on Tue 13 Oct’s waking day until that night is added.',
    )

    // Moved to Thursday by an edit: it no longer shows on Tuesday's waking day, so the line says only
    // where the tracker filed it, and the time is no longer approximate.
    await details.getByTestId('edit-meal').click()
    await sheet.getByTestId('meal-when-input').fill('2026-10-15T12:00')
    await sheet.getByTestId('save-meal').click()
    await expect(sheet).toHaveCount(0)
    await expect(page.getByTestId('meal-row').filter({ hasText: 'Baked gnocchi' })).toHaveCount(0)
    await page.getByTestId('day-next').click()
    await expect(page.getByTestId('waking-day')).toContainText('Thu')
    await page.getByTestId('meal-row').filter({ hasText: 'Baked gnocchi' }).getByTestId('meal-open').click()
    await expect(details.getByTestId('details-joined')).toHaveText('Filed under Wed 14 Oct in your tracker.')
    await expect(details.getByTestId('details-joined')).not.toContainText('Tue 13 Oct')
    await expect(details.getByTestId('details-time-approx')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(details).toHaveCount(0)

    // "Set today's wake time" ends Friday four days after it began: Friday then runs for more than
    // 36 hours to its next wake, so it is not counted as one day against one day's meals.
    await page.getByTestId('day-today').click()
    await page.getByTestId('set-today-wake').click()
    const sleepSheet = page.getByTestId('sleep-sheet')
    await sleepSheet.getByTestId('sleep-time-input').fill('7:10')
    await sleepSheet.getByTestId('sleep-save').click()
    await expect(sleepSheet).toHaveCount(0)
    await expect(page.getByTestId('waking-day')).toHaveText('Tue · awake since 7:10 AM')
    await page.getByTestId('day-prev').click()
    await expect(page.getByTestId('waking-day')).toContainText('Fri')
    await expect(page.getByTestId('balance-na')).toHaveText(
      'Estimated deficit or surplus: not counted, as this day runs for more than 36 hours. A night may be missing.',
    )
    await expect(page.getByTestId('balance')).toHaveCount(0)
  })
}
