// Build-out item 2.4 (checklist slice 20; prd.md > Weight Log): weigh-ins with a trend, on the
// dashboard. In every look: a weigh-in logged shows on its day and in the trend; the 7-day average
// says how many weigh-ins it holds, and the trend over 21 days shows from 6 weigh-ins (until then it
// says how many more). The weight details open in one tap, list every weigh-in (each point of the
// chart is in that list), switch kg and lb, and edit and delete a weigh-in.
//
// The person is the fictional Sam. The 21 days of weigh-ins are the golden ones
// (fixtures/golden-weight.json, worked out by scripts/golden.py), so the dashboard is checked
// against values computed outside the app.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { LOOKS, startInLook } from './looks'
import { E2E_KEYS } from './storage-keys'

const GOLDEN = JSON.parse(readFileSync(fileURLToPath(new URL('../../fixtures/golden-weight.json', import.meta.url)), 'utf8')) as {
  weighIns: { id: string; at: string; kg: number; unit: 'kg' | 'lb'; bodyFatPct?: number }[]
}

// Wed 2026-10-21, 8 PM in Toronto (playwright.config.ts), the golden "as of".
const NOW = new Date('2026-10-21T20:00:00-04:00')

/** Sam's own log: three nights (or more), a meal, and the golden weigh-ins. */
function samLog(extraSleeps: { id: string; sleepStart: string; wake: string }[] = []): string {
  return JSON.stringify({
    version: 1,
    kind: 'mine',
    profile: { name: '', kind: 'guest' },
    meals: [
      { id: 'm1', name: 'Oats with blueberries', eatenAt: '2026-10-21T08:10:00-04:00', source: 'weighed', kcal: 410, protein: 14, carbs: 68, fat: 9 },
    ],
    sleeps: [
      { id: 's1', sleepStart: '2026-10-18T23:00:00-04:00', wake: '2026-10-19T06:30:00-04:00' },
      { id: 's2', sleepStart: '2026-10-19T23:10:00-04:00', wake: '2026-10-20T07:00:00-04:00' },
      { id: 's3', sleepStart: '2026-10-20T23:20:00-04:00', wake: '2026-10-21T06:50:00-04:00' },
      ...extraSleeps,
    ],
    workouts: [],
    plates: [],
    weighIns: GOLDEN.weighIns.map((w) => ({ id: w.id, at: w.at, kg: w.kg, unit: w.unit, ...(w.bodyFatPct ? { bodyFatPct: w.bodyFatPct } : {}) })),
  })
}

/** Text with no-break spaces as plain spaces, so "78.4 kg" reads the same however it is spaced. */
async function text(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

async function expectText(locator: Locator, want: string | RegExp) {
  await expect.poll(() => text(locator)).toMatch(typeof want === 'string' ? new RegExp(`^${want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) : want)
}

async function seed(page: Page, doc: string, now: Date = NOW) {
  await page.clock.setFixedTime(now)
  await page.goto('/')
  await page.evaluate(
    ([k, v, a]) => {
      localStorage.setItem(k, v)
      localStorage.setItem(a, 'mine')
    },
    [E2E_KEYS.mine, doc, E2E_KEYS.active] as const,
  )
  await page.reload()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function logWeight(page: Page, weight: string, opts: { unit?: 'kg' | 'lb'; bodyFat?: string; when?: string } = {}) {
  await page.getByTestId('log-weight').click()
  const sheet = page.getByTestId('weigh-in-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByTestId('weigh-in-save')).toBeDisabled()
  if (opts.unit) await sheet.getByTestId(`weigh-in-unit-${opts.unit}`).check()
  await sheet.getByTestId('weigh-in-weight').fill(weight)
  if (opts.bodyFat) await sheet.getByTestId('weigh-in-body-fat').fill(opts.bodyFat)
  if (opts.when) await sheet.getByTestId('weigh-in-when').fill(opts.when)
  await sheet.getByTestId('weigh-in-save').click()
  await expect(sheet).toHaveCount(0)
}

for (const { id: look, name } of LOOKS) {
  test.describe(`weight in the ${name} look`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('a weigh-in logged in a new log shows on the day and in the trend, and stays after a reload', async ({ page }) => {
      await page.clock.setFixedTime(NOW)
      await page.goto('/')
      await page.getByRole('button', { name: 'Start my log' }).click()
      const section = page.getByTestId('weight-section')
      await expect(section.getByTestId('weight-day')).toHaveText('No weigh-ins yet.')

      // Blank, then not a number, then too heavy: each keeps Save off, with its message once typed.
      await page.getByTestId('log-weight').click()
      const sheet = page.getByTestId('weigh-in-sheet')
      // A new weigh-in opens with focus in the weight box, so typing goes straight into it.
      await expect(sheet.getByTestId('weigh-in-weight')).toBeFocused()
      await expect(sheet.getByTestId('weigh-in-save')).toBeDisabled()
      await sheet.getByTestId('weigh-in-weight').fill('seventy')
      await expect(sheet.getByTestId('weigh-in-weight-error')).toHaveText('Use digits, e.g. 72.5')
      await sheet.getByTestId('weigh-in-weight').fill('900')
      await expect(sheet.getByTestId('weigh-in-weight-error')).toHaveText('Type a weight from 30 to 300 kg.')
      await expect(sheet.getByTestId('weigh-in-save')).toBeDisabled()
      await expect(sheet.getByTestId('weigh-in-day')).toHaveText('No wake time is set yet, so it goes in the day you are logging now.')
      await expect(sheet.getByTestId('weigh-in-unit-hint')).toHaveText('The unit of the weight you type. Weights are then shown in it.')
      await sheet.getByTestId('weigh-in-weight').fill('78.4')
      await sheet.getByTestId('weigh-in-save').click()
      await expect(sheet).toHaveCount(0)

      // On the day, and in the trend.
      await expectText(section.getByTestId('weight-day'), '78.4 kg')
      await expectText(section.getByTestId('weight-average'), '7-day average 78.4 kg average of 1 weigh-in')
      await expectText(section.getByTestId('weight-rate'), '5 more weigh-ins needed')
      // "weigh-ins" in the note has a word joiner (U+2060) after its hyphen, so it never splits there.
      await expectText(section.getByTestId('weight-trend'), 'Trend 5 more weigh-ins needed shown from 6 weigh-\u2060ins in 21 days, over at least 4 days')
      // The count needed is one short line: it never wraps to leave a word on its own.
      const rateLines = await section.getByTestId('weight-rate').evaluate((el) => el.getClientRects().length)
      expect(rateLines).toBe(1)
      // A status sentence, not a number: normal weight and no tabular figures.
      await expect(section.getByTestId('weight-rate')).toHaveCSS('font-weight', '400')
      await expect(section.getByTestId('weight-rate')).not.toHaveClass(/\bnum\b/)

      await page.reload()
      await expectText(page.getByTestId('weight-day'), '78.4 kg')

      // One tap opens the details, which list it.
      await page.getByTestId('weight-open').click()
      const details = page.getByTestId('weight-details')
      await expect(details).toBeVisible()
      await expect(details.getByTestId('weigh-in-row')).toHaveCount(1)
      await expectText(details.getByTestId('weigh-in-row'), /^Wed Oct 21, 8:00 PM 78\.4 kg/)
      await expect(details.getByTestId('weight-chart')).toContainText('The chart needs 2 weigh-ins in these 30 days.')
      await expect(details.getByTestId('weight-swings')).toHaveText('Daily weight swings with water and food; watch the trend.')
      // A claim with no source in the app says it is an assumption.
      await expect(details.getByTestId('weight-swings-basis')).toHaveText('assumption')
    })

    test('the current day with no weigh-in yet says so, with the 7-day average and the trend still shown', async ({ page }) => {
      // Thu Oct 22, 10 AM, after Sam woke at 7:00: weigh-ins on earlier days, none today. Worked out
      // from the golden weigh-ins: 3 in the 7 days (78.87 kg), 9 in the 21 days (-0.514 kg a week).
      const thursday = [{ id: 's4', sleepStart: '2026-10-21T23:00:00-04:00', wake: '2026-10-22T07:00:00-04:00' }]
      await seed(page, samLog(thursday), new Date('2026-10-22T10:00:00-04:00'))
      const section = page.getByTestId('weight-section')
      await expect(section.getByTestId('weight-day')).toHaveText('No weigh-in today')
      await expectText(section.getByTestId('weight-average'), '7-day average 78.9 kg average of 3 weigh-ins')
      await expectText(section.getByTestId('weight-trend'), 'Trend down 0.5 kg a week from 9 weigh-ins in 21 days')
      // One tap still opens the details, whose Latest is Wednesday's weigh-in.
      await page.getByTestId('weight-open').click()
      await expectText(page.getByTestId('weight-details').getByTestId('weight-details-latest'), 'Latest 78.6 kg Wed Oct 21, 7:35 AM')
      await page.keyboard.press('Escape')
      // The day before reads "that day", not "today", and shows Wednesday's weigh-in.
      await page.getByTestId('day-prev').click()
      await expectText(section.getByTestId('weight-day'), '78.6 kg')
      await page.getByTestId('day-prev').click()
      await expect(section.getByTestId('weight-day')).toHaveText('No weigh-in that day')
    })

    test('layout: Log weight has a 44 px tap target, matches Log a workout, and its focus ring hugs it', async ({ page }) => {
      await seed(page, samLog())
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        const btn = page.getByTestId('log-weight')
        await btn.scrollIntoViewIfNeeded()
        // Reached by the keyboard, so the focus ring shows.
        await btn.focus()
        await page.keyboard.press('Tab')
        await page.keyboard.press('Shift+Tab')
        await expect(btn).toBeFocused()
        const m = await btn.evaluate((b) => {
          const r = b.getBoundingClientRect()
          const x = r.left + r.width / 2
          const cy = r.top + r.height / 2
          const covered: boolean[] = []
          for (let y = cy - 22; y <= cy + 22; y += 2) covered.push(document.elementFromPoint(x, y) === b)
          // The 44 px layer never reaches into the weight summary under it.
          const summary = document.querySelector('[data-testid="weight-open"]')?.getBoundingClientRect()
          const workout = document.querySelector('[data-testid="log-workout"]')?.getBoundingClientRect()
          return {
            height: r.height,
            covered: covered.every(Boolean),
            ring: getComputedStyle(b).outlineStyle,
            gapToSummary: summary ? summary.top - (cy + 22) : 99,
            workoutHeight: workout?.height ?? null,
          }
        })
        expect(m.height, `Log weight looks under 44 px at ${width}`).toBeLessThan(44)
        expect(m.covered, `Log weight 44 px tall target at ${width}`).toBe(true)
        expect(m.ring, `Log weight shows its focus ring at ${width}`).toBe('solid')
        expect(m.gapToSummary, `Log weight's target stays clear of the summary at ${width}`).toBeGreaterThanOrEqual(0)
        expect(m.workoutHeight, `Log weight and Log a workout are one height at ${width}`).toBeCloseTo(m.height, 0)
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      }
    })

    test('a weigh-in whose time was not recorded reads "(time not recorded)" after its weight, in words', async ({ page }) => {
      const doc = JSON.parse(samLog()) as Record<string, unknown> & { weighIns: Record<string, unknown>[] }
      doc.weighIns = doc.weighIns.map((w) => (w.id === 'w10' ? { ...w, at: '2026-10-21T07:01:00-04:00', timeApproximate: true } : w))
      await seed(page, JSON.stringify(doc))
      const when = page.getByTestId('weight-section').getByTestId('weight-when')
      await expect(when).toHaveText('(time not recorded)')
      await expect(when).not.toHaveClass(/\bnum\b/)
      await expectText(page.getByTestId('weight-open'), /^78\.6 kg \(time not recorded\) 7-day average/)
      // In the details too, the words are not set in the number style; a recorded time is.
      await page.getByTestId('weight-open').click()
      const rows = page.getByTestId('weigh-in-row')
      await expect(rows.first().locator('.weigh-in-when')).toHaveText('Wed Oct 21, time not recorded')
      await expect(rows.first().locator('.weigh-in-when')).not.toHaveClass(/\bnum\b/)
      await expect(rows.nth(1).locator('.weigh-in-when')).toHaveClass(/\bnum\b/)
      await expect(page.getByTestId('weight-details-latest').locator('.weight-note')).not.toHaveClass(/\bnum\b/)
    })

    test('weighing in every morning: the trend shows from the 6th weigh-in, though the times drift', async ({ page }) => {
      // Five mornings in a row (Fri Oct 16 to Tue Oct 20), then the 6th on Wed at 7:00 AM: first to
      // last is 4 days 22 h 40 min, which is enough (4 days).
      const doc = JSON.parse(samLog()) as Record<string, unknown>
      const mornings = ['16T08:20', '17T07:05', '18T07:45', '19T06:50', '20T07:30']
      doc.weighIns = mornings.map((t, i) => ({ id: `d${i}`, at: `2026-10-${t}:00-04:00`, kg: 80.6 - i * 0.1, unit: 'kg' }))
      await seed(page, JSON.stringify(doc))
      const section = page.getByTestId('weight-section')
      await expectText(section.getByTestId('weight-trend'), 'Trend 1 more weigh-in needed shown from 6 weigh-\u2060ins in 21 days, over at least 4 days')
      await logWeight(page, '80.0', { when: '2026-10-21T07:00' })
      await expectText(section.getByTestId('weight-trend'), /^Trend down 0\.\d kg a week from 6 weigh-ins in 21 days$/)
      await expect(section.getByTestId('weight-rate')).toHaveClass(/\bnum\b/)
    })

    test('a wake time corrected past a weigh-in: the move warning lists it, and it moves to the day before', async ({ page }) => {
      // Thu Nov 5: Sam woke at 7:20 AM and weighed in at 7:30 AM. Moving the wake to 7:40 AM puts the
      // weigh-in on Wednesday's day; no meal or workout moves, so the weigh-in alone brings the warning.
      const sleeps = [
        { id: 'n1', sleepStart: '2026-11-03T23:50:00-05:00', wake: '2026-11-04T07:10:00-05:00' },
        { id: 'n2', sleepStart: '2026-11-04T23:10:00-05:00', wake: '2026-11-05T07:20:00-05:00' },
      ]
      const doc = JSON.parse(samLog()) as Record<string, unknown>
      doc.sleeps = sleeps
      doc.meals = []
      doc.weighIns = [{ id: 'wi1', at: '2026-11-05T07:30:00-05:00', kg: 79.6, unit: 'kg' }]
      await seed(page, JSON.stringify(doc), new Date('2026-11-05T10:00:00-05:00'))
      const section = page.getByTestId('weight-section')
      await expectText(section.getByTestId('weight-day'), '79.6 kg')
      await page.getByTestId('waking-day').click()
      const editor = page.getByTestId('sleep-editor')
      await editor.getByTestId('edit-wake-time-input').fill('7:40')
      await editor.getByTestId('edit-night-save').click()
      const warning = page.getByTestId('move-warning')
      await expect(warning).toBeVisible()
      await expect(warning.getByTestId('move-entry')).toHaveText(['Thu 7:30 AM79.6\u00a0kgweigh-in'])
      await warning.getByTestId('moves-save').click()
      await expect(warning).toHaveCount(0)
      await expect(section.getByTestId('weight-day')).toHaveText('No weigh-in today')
      await page.getByTestId('day-prev').click()
      await expectText(section.getByTestId('weight-day'), '79.6 kg')
    })

    test('Set wake time in a new log lists a weigh-in that moves into the new day, before saving', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-11-05T10:00:00-05:00'))
      await page.goto('/')
      await page.getByRole('button', { name: 'Start my log' }).click()
      await logWeight(page, '79.6', { when: '2026-11-05T09:00' })
      await page.getByTestId('set-wake').click()
      const sheet = page.getByTestId('set-wake-sheet')
      await expect(sheet).toBeVisible()
      // The 7:00 AM default: a weigh-in alone is enough for the preview, which lists it.
      await sheet.getByTestId('set-wake-save').click()
      const preview = page.getByTestId('regroup-preview')
      await expect(preview).toBeVisible()
      await expect(preview.getByTestId('regroup-moving').getByTestId('regroup-weigh-in')).toHaveText('Thu 9:00 AM79.6\u00a0kgweigh-in')
      // No meals in the log: the words name what it lists, never meals that are not there.
      await expect(preview.locator('.sheet-title')).toHaveText('Where your entries will go')
      await expect(preview.getByTestId('regroup-intro')).toHaveText('With a wake time of Thu 7:00 AM, your weigh-ins fall into these days:')
      await expect(preview.getByTestId('regroup-keeps')).toHaveText(
        'Every entry stays in your log with its own date and time. Nothing changes until you tap Save.',
      )
      await expect(preview).not.toContainText(/meal/i)
      await preview.getByTestId('regroup-save').click()
      await expect(preview).toHaveCount(0)
      await expectText(page.getByTestId('weight-day'), '79.6 kg')
    })

    test('no weigh-ins in the last 7 days: the average row says so in plain text, today and on an earlier day', async ({ page }) => {
      // Sat Oct 31, 10 AM, after a 7:00 wake: Sam's last weigh-in was Wed Oct 21, 10 days back.
      const saturday = [{ id: 's4', sleepStart: '2026-10-30T23:00:00-04:00', wake: '2026-10-31T07:00:00-04:00' }]
      await seed(page, samLog(saturday), new Date('2026-10-31T10:00:00-04:00'))
      const section = page.getByTestId('weight-section')
      await expect(section.getByTestId('weight-day')).toHaveText('No weigh-in today')
      const value = section.getByTestId('weight-average-value')
      await expect(value).toHaveText('No weigh-\u2060ins in the last 7 days')
      // A status sentence, not a number: normal weight, no tabular figures, and no "num" class.
      await expect(value).not.toHaveClass(/\bnum\b/)
      await expect(value).toHaveCSS('font-weight', '400')
      await expect(value).not.toHaveCSS('font-variant-numeric', /tabular-nums/)
      // The trend still has 21 days to look back on: w05 to w10, 6 weigh-ins over 10 days (-0.526 kg a
      // week, worked out separately in Python from the golden weigh-ins).
      await expectText(section.getByTestId('weight-trend'), 'Trend down 0.5 kg a week from 6 weigh-ins in 21 days')
      // The details say the same, with "7-day average" on one line.
      await page.getByTestId('weight-open').click()
      const details = page.getByTestId('weight-details')
      await expectText(details.getByTestId('weight-details-average'), '7-day average No weigh-\u2060ins in the last 7 days')
      const label = details.getByTestId('weight-details-average').locator('.k')
      expect(await label.evaluate((el) => el.getClientRects().length)).toBe(1)
      await expect(details.getByTestId('weight-how')).toContainText('in the last 7 days.')
      await page.keyboard.press('Escape')
      // The day before is Wednesday's, which ran on to this morning's wake (no sleep logged in
      // between): no "last 7 days" there, and its real end is named rather than "the end of Wed".
      await page.getByTestId('day-prev').click()
      await expectText(section.getByTestId('weight-day'), '78.6 kg')
      await expect(value).toHaveText('No weigh-\u2060ins in the 7 days to Sat Oct 31, 7:00 AM, when that day ended')
      await expect(value).toHaveCSS('font-weight', '400')
      // On a 320 px phone the long sentence goes on its own line under "7-day average", left-aligned,
      // in at most 3 lines, rather than a thin right-aligned column.
      await page.setViewportSize({ width: 320, height: 640 })
      const box = async (sel: string) => (await section.getByTestId('weight-average').locator(sel).boundingBox())!
      await expect.poll(async () => Math.round((await box('.weight-fact-v')).x - (await box('.k')).x)).toBe(0)
      expect((await box('.weight-fact-v')).y).toBeGreaterThan((await box('.k')).y)
      const lines = await value.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))
      expect(lines).toBeLessThanOrEqual(3)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      await page.getByTestId('weight-open').click()
      const then = page.getByTestId('weight-details')
      await expect(then.getByTestId('weight-as-of')).toHaveText(
        'As of Sat Oct 31, 7:00 AM, when the day you are viewing ended. It started Wed Oct 21 and ran on, as no sleep was logged in between.',
      )
      await expect(then.getByTestId('weight-chart-title')).toHaveText('30 days to Sat Oct 31, 7:00 AM')
      await expect(then.getByTestId('weight-how')).toContainText('in the 7 days to the end of that day.')
      await expect(then.getByTestId('weight-how')).toContainText('through the 21 days to the end of that day')
    })

    test('the provisional day before the first wake: its details name the wake it ended at, never "the end of" that date', async ({ page }) => {
      // Sam weighs in Tue 9 PM, sleeps, wakes Wed 7:00 AM (the log's first wake) and weighs in at 7:30.
      const doc = JSON.parse(samLog()) as Record<string, unknown>
      doc.sleeps = [{ id: 'p1', sleepStart: '2026-10-20T23:00:00-04:00', wake: '2026-10-21T07:00:00-04:00' }]
      doc.meals = []
      doc.weighIns = [
        { id: 'tue', at: '2026-10-20T21:00:00-04:00', kg: 80, unit: 'kg' },
        { id: 'wed', at: '2026-10-21T07:30:00-04:00', kg: 79.5, unit: 'kg' },
      ]
      await seed(page, JSON.stringify(doc), new Date('2026-10-21T12:00:00-04:00'))
      const section = page.getByTestId('weight-section')
      await expectText(section.getByTestId('weight-day'), '79.5 kg')
      await page.getByTestId('day-prev').click()
      await expectText(section.getByTestId('weight-day'), '80.0 kg')
      await page.getByTestId('weight-open').click()
      const details = page.getByTestId('weight-details')
      await expect(details.getByTestId('weight-as-of')).toHaveText(
        'As of Wed Oct 21, 7:00 AM, when the day you are viewing ended: it is the provisional day before your first recorded wake time.',
      )
      await expect(details.getByTestId('weight-chart-title')).toHaveText('30 days to Wed Oct 21, 7:00 AM')
      await expectText(details.getByTestId('weight-details-latest'), 'Latest 80.0 kg Tue Oct 20, 9:00 PM')
      // Wednesday's 7:30 weigh-in is in the list, marked as after the viewed day.
      await expect(details.getByTestId('weigh-in-later')).toHaveCount(1)
      await expect(details).not.toContainText('end of Wed')
    })

    test('the estimated deficit or surplus takes its weight from the latest weigh-in, and says which', async ({ page }) => {
      const doc = JSON.parse(samLog()) as Record<string, unknown> & { profile: Record<string, unknown> }
      doc.profile = { ...doc.profile, body: { age: 34, ageSetOn: '2026-10-21', sex: 'female', heightCm: 168, weightKg: 64, weightUnit: 'kg', heightUnit: 'cm' } }
      await seed(page, JSON.stringify(doc))
      await page.getByTestId('balance').click()
      const explain = page.getByTestId('explain-balance')
      await expectText(explain.getByTestId('balance-weight'), 'Weight 78.6 kg, from your Wed 7:35 AM weigh-in')
      await page.keyboard.press('Escape')
      await logWeight(page, '77.2')
      await page.getByTestId('balance').click()
      await expectText(page.getByTestId('explain-balance').getByTestId('balance-weight'), 'Weight 77.2 kg, from your Wed 8:00 PM weigh-in')
    })

    test("Sam's 21 days: the day's weigh-in, the 7-day average and the trend, then a new weigh-in moves them", async ({ page }) => {
      test.setTimeout(90_000)
      await seed(page, samLog())
      const section = page.getByTestId('weight-section')
      // Golden W1 as of Wed 8 PM: 4 weigh-ins in the 7 days (78.95 kg), 9 in the 21 days (-0.514 kg a week).
      await expectText(section.getByTestId('weight-day'), '78.6 kg')
      await expectText(section.getByTestId('weight-average'), '7-day average 79.0 kg average of 4 weigh-ins')
      await expectText(section.getByTestId('weight-trend'), 'Trend down 0.5 kg a week from 9 weigh-ins in 21 days')

      // Tuesday had no weigh-in; its average and trend are as they stood when it ended.
      await page.getByTestId('day-prev').click()
      await expectText(section.getByTestId('weight-day'), 'No weigh-in that day')
      await expectText(section.getByTestId('weight-average'), '7-day average 79.1 kg average of 4 weigh-ins')
      await expectText(section.getByTestId('weight-trend'), /from 8 weigh-ins in 21 days$/)

      // Its details stand at the end of Tuesday, and say so: Latest is Monday's weigh-in, not
      // Wednesday's, the chart ends on Tuesday, and only the list of every weigh-in runs on.
      await page.getByTestId('weight-open').click()
      const earlier = page.getByTestId('weight-details')
      await expect(earlier.getByTestId('weight-as-of')).toHaveText('As of the end of Tue Oct 20, the day you are viewing.')
      await expectText(earlier.getByTestId('weight-details-latest'), 'Latest 79.1 kg Mon Oct 19, 7:10 AM')
      await expectText(earlier.getByTestId('weight-details-average'), '7-day average 79.1 kg average of 4 weigh-ins')
      await expect(earlier.getByTestId('weight-chart-title')).toHaveText('30 days to the end of Tue Oct 20')
      await expect(earlier.getByTestId('weight-chart-point')).toHaveCount(9)
      await expect(earlier.getByTestId('weigh-in-row')).toHaveCount(10)
      // Wednesday's weigh-in came after Tuesday: the list says it runs on, and marks that row only.
      await expect(earlier.getByTestId('weigh-in-list-later')).toHaveText(
        'This list runs past the day you are viewing; later weigh-ins are marked.',
      )
      await expect(earlier.getByTestId('weigh-in-later')).toHaveCount(1)
      await expect(earlier.getByTestId('weigh-in-row').first().getByTestId('weigh-in-later')).toHaveText('after the day you are viewing')
      // Log weight from an earlier day starts on that day, and its hint says so.
      await earlier.getByTestId('weight-details-log').click()
      await expect(page.getByTestId('weigh-in-sheet')).toContainText('Starts on the day you are viewing. Change it if it was another time.')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('weight-details')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('weight-details')).toHaveCount(0)

      await page.getByTestId('day-prev').click()
      await expectText(section.getByTestId('weight-day'), '79.1 kg')
      await page.getByTestId('day-today').click()

      // A second weigh-in today, in lb: it is the day's latest, and the average and trend count it.
      await logWeight(page, '172.4', { unit: 'lb' })
      await expectText(section.getByTestId('weight-day'), '172.4 lb')
      await expectText(section.getByTestId('weight-more'), '1 more weigh-in this day')
      await expectText(section.getByTestId('weight-average'), /average of 5 weigh-ins$/)
      await expectText(section.getByTestId('weight-trend'), /^Trend down 1\.3 lb a week from 10 weigh-ins in 21 days$/)

      // The details: every weigh-in in the list, and each point of the chart is one of them.
      await page.getByTestId('weight-open').click()
      const details = page.getByTestId('weight-details')
      await expect(details).toBeVisible()
      await expect(details.getByTestId('weigh-in-row')).toHaveCount(11)
      await expect(details.getByTestId('weight-chart-point')).toHaveCount(11)
      // The 7-day average's line runs through all of them (prd.md > Weight Log: the trend line).
      await expect(details.getByTestId('weight-chart-line')).toHaveAttribute('points', /^(\S+,\S+ ){10}\S+,\S+$/)
      await expect(details.getByTestId('weight-chart-svg')).toHaveAttribute('aria-hidden', 'true')
      await expectText(details.getByTestId('weigh-in-row').first(), /^Wed Oct 21, 8:00 PM 172\.4 lb/)
      await expectText(details.getByTestId('weigh-in-row').nth(4), /^Thu Oct 15, 7:25 AM 174\.6 lb body fat 21\.5%/)

      // Shown in kg again: nothing stored changes, only how it reads.
      await details.getByTestId('weight-show-kg').check()
      await expectText(details.getByTestId('weigh-in-row').first(), /^Wed Oct 21, 8:00 PM 78\.2 kg/)
      await expectText(details.getByTestId('weight-details-latest'), 'Latest 78.2 kg Wed Oct 21, 8:00 PM')
      // The current day: no "as of" line, and the chart is the last 30 days.
      await expect(details.getByTestId('weight-as-of')).toHaveCount(0)
      await expect(details.getByTestId('weigh-in-later')).toHaveCount(0)
      await expect(details.getByTestId('weigh-in-list-later')).toHaveCount(0)
      await expect(details.getByTestId('weight-chart-title')).toHaveText('Last 30 days')

      // Esc out of a weigh-in's edit sheet puts focus back on its row in the list.
      await details.getByTestId('weigh-in-row').nth(3).getByRole('button').focus()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('weigh-in-sheet')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('weight-details')).toBeVisible()
      await expect(page.getByTestId('weigh-in-row').nth(3).getByRole('button')).toBeFocused()

      // An older lb weigh-in: switching its unit converts the weight in the box, never reads 175 as kg.
      await page.getByTestId('weigh-in-row').nth(5).click()
      const edit = page.getByTestId('weigh-in-sheet')
      await expect(edit.getByTestId('weigh-in-unit-lb')).toBeChecked()
      const converts = 'Switching the unit converts the saved weight in the box, and weights are then shown in it.'
      await expect(edit.getByTestId('weigh-in-unit-hint')).toHaveText(converts)
      await expect(edit.getByTestId('weigh-in-weight')).toHaveValue('175')
      // A number typed over the saved one is read in the unit picked, and the hint says so instead.
      await edit.getByTestId('weigh-in-weight').fill('176')
      await expect(edit.getByTestId('weigh-in-unit-hint')).toHaveText('The unit of the weight you type. If you switch it, weights are then shown in it.')
      await edit.getByTestId('weigh-in-weight').fill('175')
      await expect(edit.getByTestId('weigh-in-unit-hint')).toHaveText(converts)
      // Wed Oct 14 is before Sam's first wake time (Mon Oct 19), and the day line names that wake.
      await expect(edit.getByTestId('weigh-in-day')).toHaveText(
        'It is before your first recorded wake time, Mon Oct 19, 6:30 AM, so it goes in the provisional day that ends then.',
      )
      await edit.getByTestId('weigh-in-unit-kg').check()
      await expect(edit.getByTestId('weigh-in-weight')).toHaveValue('79.38')
      await edit.getByTestId('weigh-in-unit-lb').check()
      await expect(edit.getByTestId('weigh-in-weight')).toHaveValue('175')
      // A note added to it leaves weights shown in kg.
      await page.getByTestId('weigh-in-sheet').getByTestId('weigh-in-note').fill('Before breakfast')
      await page.getByTestId('weigh-in-sheet').getByTestId('weigh-in-save').click()
      await expect(page.getByTestId('weight-details')).toBeVisible()
      await expectText(page.getByTestId('weigh-in-row').nth(5), /^Wed Oct 14, 7:30 AM 79\.4 kg Before breakfast/)
      await expect(page.getByTestId('weight-show-kg')).toBeChecked()

      // Edit Monday's weigh-in, then delete it.
      await details.getByTestId('weigh-in-row').nth(2).click()
      const sheet = page.getByTestId('weigh-in-sheet')
      await expect(sheet).toBeVisible()
      await expect(sheet.getByTestId('weigh-in-weight')).toHaveValue('79.1')
      await sheet.getByTestId('weigh-in-weight').fill('79.3')
      await sheet.getByTestId('weigh-in-save').click()
      await expect(page.getByTestId('weight-details')).toBeVisible()
      await expectText(page.getByTestId('weigh-in-row').nth(2), /^Mon Oct 19, 7:10 AM 79\.3 kg/)
      await expect(page.getByTestId('weigh-in-row').nth(2).getByRole('button')).toBeFocused()
      await page.getByTestId('weigh-in-row').nth(2).click()
      await page.getByTestId('weigh-in-delete').click()
      await expect(page.getByTestId('weigh-in-delete-confirm')).toContainText('Delete the weigh-in of 79.3')
      // Focus stays in the sheet: on Keep it, and back on Delete after it.
      await expect(page.getByTestId('weigh-in-delete-keep')).toBeFocused()
      await page.getByTestId('weigh-in-delete-keep').click()
      await expect(page.getByTestId('weigh-in-delete')).toBeFocused()
      // The first Delete is plain, as Delete meal's is: only the confirming button is destructive.
      await expect(page.getByTestId('weigh-in-delete')).toHaveClass(/btn-plain/)
      await expect(page.getByTestId('weigh-in-delete')).not.toHaveClass(/btn-primary/)
      await page.getByTestId('weigh-in-delete').click()
      // Delete is in the destructive style, never the teal primary fill; Keep it is plain.
      await expect(page.getByTestId('weigh-in-delete-confirm-btn')).toHaveClass(/btn-ink/)
      await expect(page.getByTestId('weigh-in-delete-confirm-btn')).not.toHaveClass(/btn-primary/)
      await expect(page.getByTestId('weigh-in-delete-keep')).not.toHaveClass(/btn-primary|btn-ink/)
      await page.getByTestId('weigh-in-delete-confirm-btn').click()
      await expect(page.getByTestId('weigh-in-row')).toHaveCount(10)

      // Closed: the dashboard reads the same log, in kg, and so does a reload.
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('weight-details')).toHaveCount(0)
      await expectText(section.getByTestId('weight-day'), '78.2 kg')
      await page.reload()
      await expectText(page.getByTestId('weight-day'), '78.2 kg')
      await expectText(page.getByTestId('weight-trend'), /from 9 weigh-ins in 21 days$/)
    })
  })
}

test.describe('weight in the demo', () => {
  test('a weigh-in logged in the demo stays in the demo, and Reset demo names it', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-22T01:30:00-04:00'))
    await page.goto('/')
    await page.getByRole('button', { name: 'Try the fictional demo' }).click()
    await expect(page.getByTestId('weight-day')).toHaveText('No weigh-ins yet.')
    await logWeight(page, '70.2')
    await expectText(page.getByTestId('weight-day'), '70.2 kg')
    await page.getByTestId('open-more').click()
    await page.getByTestId('more-resetDemo').click()
    const reset = page.getByTestId('reset-demo-sheet')
    await expect(reset.getByTestId('reset-demo-changes')).toHaveText('Weigh-ins changed')
    await reset.getByTestId('reset-demo-confirm').click()
    await expect(page.getByTestId('weight-day')).toHaveText('No weigh-ins yet.')
    // Your own log never had it.
    await page.getByRole('button', { name: 'Open my log' }).click()
    await expect(page.getByTestId('weight-day')).toHaveText('No weigh-ins yet.')
  })

  test('More opens the weight details, and the sheet carries the fictional label', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-22T01:30:00-04:00'))
    await page.goto('/')
    await page.getByRole('button', { name: 'Try the fictional demo' }).click()
    await page.getByTestId('open-more').click()
    await page.getByTestId('more-weight').click()
    const details = page.getByTestId('weight-details')
    await expect(details.getByTestId('fictional-banner')).toHaveText('Sample person — fictional')
    await expect(details.getByTestId('weight-details-empty')).toHaveText('No weigh-ins yet.')
    await details.getByTestId('weight-details-log').click()
    await expect(page.getByTestId('weigh-in-sheet').getByTestId('fictional-banner')).toBeVisible()
    await page.keyboard.press('Escape')
    // Closing Log weight goes back to the details it was opened from.
    await expect(page.getByTestId('weight-details')).toBeVisible()
  })
})
