// Build-out item 2.7 (checklist slice 8; prd.md > Week View): the week view, with the average of
// every stat over the 7 waking days to the day on screen, each one tap from its day-by-day
// breakdown. Covers every check under prd.md > Week View:
//   - seven days are shown; each logged day has its estimate and both ranges, and the demo's
//     unlogged day is clearly marked as not logged;
//   - every average is labelled with its count ("average of 5 complete days (1 incomplete left
//     out)", "6 of 7 nights");
//   - a day with one unknown-calorie meal is left out of the calorie average and counted;
//   - wake times of 23:50 and 00:10 average to 00:00 (12:00 AM), not 12:00;
//   - moving to the next waking day shifts the week by one day.
// And: every stat in the registry has a week row; a day in a breakdown opens that day; focus and
// layout at 320, 390 and 1440 px. Every journey runs once in each look this build offers.
//
// The people are the fictional Sam: the demo week (fixtures/demo-week.json) and an invented own log.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { STAT_IDS } from '../../src/kernel/statRegistry'
import { LOOKS, startInLook } from './looks'
import { fillWhen } from './sleepFields'
import { E2E_KEYS } from './storage-keys'
import { iso, samWeek } from './weekLog'

// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock).
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')
const SAM_NOW = new Date('2026-10-21T20:00:00-04:00')

/** Text with its no-break spaces read as plain ones, and its word joiners (U+2060) dropped. */
const plain = (s: string) => s.replace(/\u00a0/g, ' ').replace(/\u2060/g, '')

async function openDemo(page: Page) {
  await page.clock.setFixedTime(DEMO_NOW)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the fictional demo' }).click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function seedOwn(page: Page, doc: unknown, now = SAM_NOW) {
  await page.clock.setFixedTime(now)
  await page.goto('/')
  await page.evaluate(
    ([k, v, a]) => {
      localStorage.setItem(k, v)
      localStorage.setItem(a, 'mine')
    },
    [E2E_KEYS.mine, JSON.stringify(doc), E2E_KEYS.active] as const,
  )
  await page.reload()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function openWeek(page: Page): Promise<Locator> {
  await page.getByTestId('open-week').click()
  const week = page.getByTestId('week-view')
  await expect(week).toBeVisible()
  return week
}

async function settle(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

/** A control's own box height (its focus ring hugs it) and how tall a run of points through it reaches it. */
async function tapTarget(el: Locator): Promise<{ height: number; tall: number }> {
  await el.evaluate((b) => b.scrollIntoView({ block: 'center' }))
  return el.evaluate((b) => {
    const r = b.getBoundingClientRect()
    const cx = r.left + Math.min(r.width, 44) / 2
    let best = 0
    let cur = 0
    for (let v = r.top - 20; v <= r.bottom + 20; v += 0.5) {
      cur = b.contains(document.elementFromPoint(cx, v)) ? cur + 0.5 : 0
      best = Math.max(best, cur)
    }
    return { height: r.height, tall: best + 0.5 }
  })
}

/**
 * A breakdown's day names never run under their values: each name fits its own box, and where a
 * name and its value share a line they don't overlap. "(today, so far)" stays on one line.
 */
async function namesClear(bd: Locator, label: string) {
  const clashes = await bd.getByTestId('week-day').evaluateAll((days) =>
    days.flatMap((d) => {
      const name = d.querySelector('.week-day-name') as HTMLElement
      const value = d.querySelector('[data-testid="week-day-value"]') as HTMLElement | null
      const out: string[] = []
      if (name.scrollWidth > name.clientWidth + 1) out.push(`${name.innerText} overflows`)
      if (value) {
        const n = name.getBoundingClientRect()
        const v = value.getBoundingClientRect()
        if (v.top < n.bottom - 1 && n.top < v.bottom - 1 && n.right > v.left + 1) out.push(`${name.innerText} runs under ${value.innerText}`)
      }
      return out
    }),
  )
  expect(clashes, label).toEqual([])
  for (const p of await bd.locator('.week-day-name').all()) {
    const parts = await p.evaluate((e) => {
      const t = e.firstChild as Text
      const i = t.data.indexOf('(')
      if (i < 0) return 0
      const r = document.createRange()
      r.setStart(t, i)
      r.setEnd(t, t.data.length)
      return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size
    })
    expect(parts, `${await p.innerText()}: its parenthesis on one line (${label})`).toBeLessThanOrEqual(1)
  }
}

/** How many lines an inline-level element's text takes. */
const lines = (el: Locator) =>
  el.evaluate((e) => {
    const lh = parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.5
    return Math.round(e.getBoundingClientRect().height / lh)
  })

for (const { id: look, name: lookName } of LOOKS) {
  test.describe(`item 2.7 in the ${lookName} look: the week view`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('the demo week: seven days with their estimates and ranges, Saturday not logged, Friday left out and counted, every average labelled', async ({
      page,
    }) => {
      await openDemo(page)
      const week = await openWeek(page)
      await expect(week.getByRole('heading', { name: 'Week', exact: true })).toBeVisible()
      await expect(week).toContainText('The 7 waking days to Wed Oct 21')
      await expect(week.getByTestId('week-today-note')).toHaveText('Today counts with what is logged so far.')

      const eaten = week.locator('[data-stat="eaten"]')
      expect(plain(await eaten.getByTestId('week-value').innerText())).toBe('1,582 kcal')
      // Wednesday is today, still going at 1:30 AM: counted so far, and named apart from the complete days.
      await expect(eaten.getByTestId('week-count')).toHaveText('average of 4 complete days and today so far (1 incomplete left out)')
      await expect(eaten.getByTestId('week-line').nth(0)).toHaveText(/^likely [\d,]+–[\d,]+ kcal$/)
      await expect(eaten.getByTestId('week-line').nth(1)).toHaveText(/^very likely [\d,]+–[\d,]+ kcal$/)
      await expect(eaten.getByTestId('week-line').nth(2)).toHaveText(
        'Weekly totals are steadier than single meals, but photo estimates tend to run low on big plates.',
      )
      await expect(week.locator('[data-stat="sleepLength"]').getByTestId('week-count')).toHaveText('6 of 7 nights')
      await expect(week.locator('[data-stat="wakeTime"]').getByTestId('week-count')).toHaveText('6 of 7 nights')
      // Every average says how many days or nights it holds.
      for (const count of await week.getByTestId('week-count').allInnerTexts()) {
        expect(count).toMatch(/^average of \d+ (complete days?|days? with workouts)( and today so far)?( \(\d+ incomplete left out\))?$|^\d+ of \d+ nights$/)
      }

      // The calorie breakdown: each day with its estimate and both ranges, or why it is left out.
      await eaten.getByRole('button').click()
      const bd = page.getByTestId('week-breakdown')
      await expect(bd.getByRole('heading', { name: 'Calories eaten, day by day' })).toBeVisible()
      const days = bd.getByTestId('week-day')
      await expect(days).toHaveCount(7)
      await expect(days.locator('.week-day-name')).toHaveText([
        'Thu Oct 15',
        'Fri Oct 16',
        'Sat Oct 17',
        'Sun Oct 18',
        'Mon Oct 19',
        'Tue Oct 20',
        'Wed Oct 21 (today, so far)',
      ])
      const sat = days.nth(2)
      await expect(sat).toHaveAttribute('data-state', 'notLogged')
      // Not logged is said once, in its status, with no value (never 0).
      await expect(sat.getByTestId('week-day-value')).toHaveCount(0)
      await expect(sat.getByTestId('week-day-status')).toHaveText('Not logged')
      const fri = days.nth(1)
      await expect(fri).toHaveAttribute('data-state', 'leftOut')
      await expect(fri.getByTestId('week-day-status')).toHaveText('Left out: a meal with unknown calories')
      await expect(fri.getByTestId('week-day-detail')).toHaveText('Known meals only (incomplete)')
      expect(plain(await fri.getByTestId('week-day-value').innerText())).toBe('1,160 kcal')
      const wed = days.nth(6)
      expect(plain(await wed.getByTestId('week-day-value').innerText())).toBe('2,280 kcal')
      await expect(wed.getByTestId('week-day-detail')).toHaveText('likely 1,870–2,780 kcal · very likely 1,684–3,087 kcal')
      for (const i of [0, 3, 4, 5]) await expect(days.nth(i).getByTestId('week-day-detail')).toHaveText(/^likely .+ · very likely .+ kcal$/)
      // The chart draws five complete days and Friday's known meals (dashed); Saturday has no bar.
      await expect(bd.getByTestId('week-chart-bar')).toHaveCount(6)
      await expect(bd.locator('[data-testid="week-chart-bar"][data-kind="incomplete"]')).toHaveCount(1)
      await expect(bd.getByTestId('week-chart-average')).toHaveCount(1)

      // Close goes back to the week, with focus on the row that opened it.
      await bd.getByRole('button', { name: 'Close' }).click()
      await expect(bd).toHaveCount(0)
      await expect(week.getByTestId('week-row-eaten')).toBeFocused()

      // Every average opens its breakdown, by keyboard too, and Esc comes back to its row.
      const ids = await week.getByTestId('week-stat').evaluateAll((els) => els.map((e) => e.getAttribute('data-stat') as string))
      expect(ids).toEqual(['eaten', 'score', 'protein', 'carbs', 'fat', 'net', 'burned', 'burnedScore', 'workoutTime', 'sleepLength', 'bedtime', 'wakeTime'])
      for (const id of ids) {
        const row = week.getByTestId(`week-row-${id}`)
        const title = await week.locator(`[data-stat="${id}"] .week-title`).innerText()
        await row.focus()
        await page.keyboard.press('Enter')
        await expect(page.getByTestId('week-breakdown').getByRole('heading', { name: `${title}, day by day` })).toBeVisible()
        await expect(page.getByTestId('week-breakdown').getByTestId('week-day')).toHaveCount(7)
        await page.keyboard.press('Escape')
        await expect(page.getByTestId('week-breakdown')).toHaveCount(0)
        await expect(row).toBeFocused()
      }

      // Esc closes the week, and focus goes back to Week.
      await page.keyboard.press('Escape')
      await expect(week).toHaveCount(0)
      await expect(page.getByTestId('open-week')).toBeFocused()
    })

    test('a day in a breakdown opens that day; the week ends at the day on screen and moves by one day with it', async ({ page }) => {
      await openDemo(page)
      let week = await openWeek(page)
      await week.getByTestId('week-row-sleepLength').click()
      const bd = page.getByTestId('week-breakdown')
      await bd.getByTestId('week-day').nth(5).getByRole('button').click()
      // Tuesday is on the dashboard, and focus is on its waking-day line at the top.
      await expect(page.getByTestId('week-breakdown')).toHaveCount(0)
      await expect(page.getByTestId('waking-day')).toContainText('Tue')
      await expect(page.getByTestId('waking-day')).toBeFocused()
      await expect(page.getByTestId('day-today')).toBeVisible()

      // The week now ends at Tuesday: Thursday to Tuesday, six days, and no day still going. Fewer
      // than seven because Sam's log starts on Thursday (it goes on to Wednesday), and it says so.
      week = await openWeek(page)
      await expect(week).toContainText('The 6 waking days to Tue Oct 20, from the start of Sam’s log')
      await expect(week).not.toContainText('so far')
      await expect(week.getByTestId('week-today-note')).toHaveCount(0)
      // On an earlier day every counted day is over: the count names no "today".
      await expect(week.locator('[data-stat="eaten"]').getByTestId('week-count')).toHaveText('average of 4 complete days (1 incomplete left out)')
      await page.keyboard.press('Escape')

      // Back to today, then Sam sleeps and wakes on Thursday: a new waking day starts, and the week
      // moves by one day (Thursday Oct 15 goes, Thursday Oct 22 comes in).
      await page.getByTestId('day-today').click()
      for (const [when, testId] of [
        ['2026-10-22T02:10', 'sleep'],
        ['2026-10-22T10:30', 'sleep'],
      ]) {
        await page.getByTestId('sleep-action').click()
        const sheet = page.getByTestId('sleep-sheet')
        await fillWhen(sheet, testId, when)
        await sheet.getByTestId('sleep-save').click()
        await expect(sheet).toBeHidden()
      }
      week = await openWeek(page)
      await expect(week).toContainText('The 7 waking days to Thu Oct 22')
      await week.getByTestId('week-row-eaten').click()
      await expect(page.getByTestId('week-breakdown').locator('.week-day-name')).toHaveText([
        'Fri Oct 16',
        'Sat Oct 17',
        'Sun Oct 18',
        'Mon Oct 19',
        'Tue Oct 20',
        'Wed Oct 21',
        'Thu Oct 22 (today, so far)',
      ])
      // The new day has no meals yet: not logged, never 0 kcal.
      const newDay = page.getByTestId('week-breakdown').getByTestId('week-day').nth(6)
      await expect(newDay).toHaveAttribute('data-state', 'notLogged')
      await expect(newDay.getByTestId('week-day-status')).toHaveText('Not logged')
      await expect(newDay.getByTestId('week-day-value')).toHaveCount(0)
    })

    test('wake times of 23:50 and 00:10 average to 12:00 AM, not noon; the week opens from More too', async ({ page }) => {
      await seedOwn(
        page,
        {
          version: 1,
          kind: 'mine',
          profile: { name: '', kind: 'guest' },
          meals: [],
          sleeps: [
            { id: 'a', sleepStart: iso('2026-10-20T16:00'), wake: iso('2026-10-20T23:50') },
            { id: 'b', sleepStart: iso('2026-10-21T16:20'), wake: iso('2026-10-22T00:10') },
          ],
          workouts: [],
          plates: [],
        },
        new Date('2026-10-22T09:00:00-04:00'),
      )
      await page.getByTestId('open-more').click()
      await page.getByTestId('more-week').click()
      const week = page.getByTestId('week-view')
      await expect(week).toBeVisible()
      const wake = week.locator('[data-stat="wakeTime"]')
      await expect(wake.getByTestId('week-value')).toHaveText('12:00 AM')
      await expect(wake.getByTestId('week-count')).toHaveText('2 of 2 nights')
      // Unknown is never 0: with no meals, the food rows say so in words.
      await expect(week.locator('[data-stat="eaten"]').getByTestId('week-value')).toHaveText('Not available yet')
      // The night before today is over: "(today)", not "(today, so far)".
      await wake.getByRole('button').click()
      await expect(page.getByTestId('week-breakdown').locator('.week-day-name').last()).toHaveText('Thu Oct 22 (today)')
      await page.keyboard.press('Escape')
      // With no meals there is no bar to draw: no empty chart or legend.
      await week.getByTestId('week-row-eaten').click()
      await expect(page.getByTestId('week-breakdown').getByTestId('week-days')).toBeVisible()
      await expect(page.getByTestId('week-breakdown').getByTestId('week-chart')).toHaveCount(0)
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('open-more')).toBeFocused()
    })

    test('an empty own log: one line in place of empty rows, and the window in words', async ({ page }) => {
      await seedOwn(page, { version: 1, kind: 'mine', profile: { name: '', kind: 'guest' }, meals: [], sleeps: [], workouts: [], plates: [] })
      const week = await openWeek(page)
      await expect(week).toContainText('Your log so far: no wake time yet')
      await expect(week.getByTestId('week-empty')).toHaveText(
        'Nothing is logged here yet. Each average shows here once meals, workouts, sleep or weigh-ins are logged.',
      )
      await expect(week.getByTestId('week-stat')).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('open-week')).toBeFocused()
    })

    test('every stat in the registry has a week row, each opening its breakdown', async ({ page }) => {
      await seedOwn(page, samWeek())
      const week = await openWeek(page)
      const ids = await week.getByTestId('week-stat').evaluateAll((els) => els.map((e) => e.getAttribute('data-stat')))
      expect(ids).toEqual([...STAT_IDS])
      await expect(week.getByTestId('week-group').locator('.week-group-title')).toHaveText(['Food', 'Workouts and balance', 'Sleep', 'Weight'])
      expect(plain(await week.locator('[data-stat="weight"]').getByTestId('week-value').innerText())).toBe('72.1 kg')
      await expect(week.locator('[data-stat="weight"]').getByTestId('week-count')).toHaveText('average of 3 weigh-ins on 3 of 7 days')
      await expect(week.locator('[data-stat="weight"]').getByTestId('week-line')).toHaveText('Trend: 3 more weigh-ins needed')
      await expect(week.locator('[data-stat="balance"] .week-title')).toHaveText('Estimated deficit or surplus')
      // Worked out by hand: Thu −604.3, Sun −528.3, Mon −478.3 and Wed so far +65.1 average to a 386 kcal deficit.
      expect(plain(await week.locator('[data-stat="balance"]').getByTestId('week-value').innerText())).toBe('386 kcal deficit')
      await expect(week.locator('[data-stat="balance"]').getByTestId('week-count')).toHaveText('average of 3 complete days and today so far (2 incomplete left out)')
      expect(plain(await week.locator('[data-stat="gym"]').getByTestId('week-value').innerText())).toBe('2 sets')
      await expect(week.locator('[data-stat="burnedScore"]').getByTestId('week-value')).toHaveText('60')
      await expect(week.locator('[data-stat="burnedScore"]').getByTestId('week-count')).toHaveText('average of 2 days with workouts (1 incomplete left out)')
      // The weight breakdown: each weigh-in's time under its day, and the trend as of now on today.
      await week.getByTestId('week-row-weight').click()
      const wbd = page.getByTestId('week-breakdown')
      await expect(wbd.getByTestId('week-intro')).toContainText('worked out up to now.')
      await expect(wbd.getByTestId('week-day').nth(1).getByTestId('week-day-detail')).toHaveText('7:10 AM')
      await page.keyboard.press('Escape')
      // A past day left out of net is "unknown", as eaten and burned put it.
      await week.getByTestId('week-row-net').click()
      await expect(page.getByTestId('week-breakdown').getByTestId('week-day').nth(5).getByTestId('week-day-value')).toHaveText('unknown')
      await page.keyboard.press('Escape')
      await week.getByTestId('week-row-burned').click()
      const tue = page.getByTestId('week-breakdown').getByTestId('week-day').nth(5)
      await expect(tue.getByTestId('week-day-value')).toHaveText('unknown')
      await expect(tue.getByTestId('week-day-status')).toHaveText('Left out: a workout with unknown calories')
    })

    test('layout at 320, 390 and 1440 px: no sideways scrolling, numbers kept whole, sentences in text style, focus rings and 44 px targets', async ({
      page,
    }) => {
      await seedOwn(page, { ...samWeek(), weighIns: [{ id: 'old', at: iso('2026-10-01T07:10'), kg: 72.5, unit: 'kg' }] })
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await settle(page)
        expect(await sideways(page), `dashboard at ${width}`).toBeLessThanOrEqual(0)
        // Week, under previous and next: its box hugs the word, its tap target is 44 px tall, and
        // its focus ring shows.
        const open = page.getByTestId('open-week')
        const hit = await tapTarget(open)
        expect(hit.height, `"Week" hugs its word at ${width}`).toBeLessThan(32)
        expect(hit.tall, `"Week" is 44 px tall to tap at ${width}`).toBeGreaterThanOrEqual(44)
        await open.focus()
        await page.keyboard.press('Shift+Tab')
        await page.keyboard.press('Tab')
        await expect(open).toBeFocused()
        expect(await open.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid')

        await page.keyboard.press('Enter')
        const week = page.getByTestId('week-view')
        await expect(week).toBeVisible()
        await settle(page)
        expect(await week.evaluate((el) => el.scrollWidth - el.clientWidth), `week at ${width}`).toBeLessThanOrEqual(0)
        expect(await sideways(page), `page under the week at ${width}`).toBeLessThanOrEqual(0)
        // Every average that is a number stays on one line; a status sentence is plain text.
        for (const v of await week.getByTestId('week-value').all()) {
          const cls = (await v.getAttribute('class')) ?? ''
          const style = await v.evaluate((e) => ({ ws: getComputedStyle(e).whiteSpace, weight: getComputedStyle(e).fontWeight, num: getComputedStyle(e).fontVariantNumeric }))
          if (cls.includes('num')) {
            expect(style.ws, `${await v.innerText()} at ${width}`).toBe('nowrap')
            expect(await lines(v), `${await v.innerText()} at ${width}`).toBe(1)
          } else {
            expect(style.weight, `${await v.innerText()} at ${width}`).toBe('400')
            expect(style.num).not.toContain('tabular-nums')
          }
        }
        // A long average never squeezes its name or count into a narrow column: the name takes at
        // most two lines, and the count runs across the row (at most two lines).
        for (const t of await week.locator('.week-title').all()) expect(await lines(t), `${await t.innerText()} at ${width}`).toBeLessThanOrEqual(2)
        for (const c of await week.getByTestId('week-count').all()) expect(await lines(c), `${await c.innerText()} at ${width}`).toBeLessThanOrEqual(2)
        // The weight row, with no weigh-in this week, says so in words, never as a number.
        const weightValue = week.locator('[data-stat="weight"]').getByTestId('week-value')
        expect(plain(await weightValue.innerText())).toBe('No weigh-ins in these days')
        await expect(weightValue).not.toHaveClass(/num/)
        // A range is never split at its dash.
        for (const l of await week.locator('.week-keep').all()) expect(await lines(l), `${await l.innerText()} at ${width}`).toBe(1)
        // A row's focus ring shows.
        const row = week.getByTestId('week-row-eaten')
        await row.focus()
        await page.keyboard.press('Tab')
        await page.keyboard.press('Shift+Tab')
        await expect(row).toBeFocused()
        expect(await row.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid')
        if (look === 'panel') expect(await week.getByTestId('week-group').first().evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe('14px')
        if (look === 'night') expect(await week.getByTestId('week-group').first().evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe('solid')

        // The calorie breakdown: the chart and the days fit; each range stays whole.
        await page.keyboard.press('Enter')
        const bd = page.getByTestId('week-breakdown')
        await expect(bd).toBeVisible()
        await settle(page)
        expect(await bd.evaluate((el) => el.scrollWidth - el.clientWidth), `breakdown at ${width}`).toBeLessThanOrEqual(0)
        for (const l of await bd.locator('.week-keep').all()) expect(await lines(l), `${await l.innerText()} at ${width}`).toBe(1)
        for (const v of await bd.getByTestId('week-day-value').all()) {
          if (((await v.getAttribute('class')) ?? '').includes('num')) expect(await lines(v), `${await v.innerText()} at ${width}`).toBe(1)
        }
        await namesClear(bd, `calories at ${width}`)
        const dayBtn = bd.getByTestId('week-day-open').first()
        await dayBtn.focus()
        expect(await dayBtn.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid')
        expect((await dayBtn.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        await page.keyboard.press('Escape')
        await expect(row).toBeFocused()
        // The weight breakdown: "No weigh-in" beside each day, today's "(today, so far)" included,
        // said once in its status with no value beside it.
        await week.getByTestId('week-row-weight').click()
        await expect(bd).toBeVisible()
        await settle(page)
        await namesClear(bd, `weight at ${width}`)
        await expect(bd.getByTestId('week-day-status')).toHaveText(Array(7).fill('No weigh-in'))
        await expect(bd.getByTestId('week-day-value')).toHaveCount(0)
        await page.keyboard.press('Escape')
        await expect(week.getByTestId('week-row-weight')).toBeFocused()
        await page.keyboard.press('Escape')
        await expect(week).toHaveCount(0)
      }
    })
    test('today versus an earlier day: each count names today apart while it is still going', async ({ page }) => {
      // Sam's own log: six earlier days at 2,000 kcal, and only a 400 kcal breakfast so far today.
      const sleeps = []
      const meals = []
      for (let d = 15; d <= 21; d++) {
        sleeps.push({ id: `s${d}`, sleepStart: iso(`2026-10-${d - 1}T23:00`), wake: iso(`2026-10-${d}T07:00`) })
        meals.push({ id: `m${d}`, name: 'Oat porridge', eatenAt: iso(`2026-10-${d}T08:00`), source: 'label', kcal: d === 21 ? 400 : 2000, protein: 20, carbs: 50, fat: 12 })
      }
      await seedOwn(page, { version: 1, kind: 'mine', profile: { name: '', kind: 'guest' }, meals, sleeps, workouts: [], plates: [] }, new Date('2026-10-21T09:00:00-04:00'))
      let week = await openWeek(page)
      const eaten = week.locator('[data-stat="eaten"]')
      expect(plain(await eaten.getByTestId('week-value').innerText())).toBe('1,771 kcal')
      await expect(eaten.getByTestId('week-count')).toHaveText('average of 6 complete days and today so far')
      await expect(week.getByTestId('week-row-eaten')).toHaveAttribute('aria-label', /average of 6 complete days and today so far\./)
      await expect(week.locator('[data-stat="protein"]').getByTestId('week-count')).toHaveText('average of 6 complete days and today so far')
      // The breakdown repeats the count beside the average.
      await week.getByTestId('week-row-eaten').click()
      await expect(page.getByTestId('week-breakdown').getByTestId('week-count')).toHaveText('average of 6 complete days and today so far')
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')

      // The day before: the same earlier days, none still going.
      await page.getByTestId('day-prev').click()
      week = await openWeek(page)
      await expect(week.locator('[data-stat="eaten"]').getByTestId('week-count')).toHaveText('average of 6 complete days')
      await expect(week).not.toContainText('today so far')
    })

    for (const width of [320, 390]) {
      test(`keyboard focus never hides under the sheet's sticky header at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 640 })
        await seedOwn(page, samWeek())
        const week = await openWeek(page)
        await settle(page)
        /** How far the focused element's top (with its 2 px ring) sits above the bottom of the sheet's header; 0 when clear. */
        const hidden = (sheet: Locator) =>
          sheet.evaluate((el) => {
            const head = el.querySelector(':scope > header') as HTMLElement
            const f = document.activeElement as HTMLElement
            return Math.max(0, head.getBoundingClientRect().bottom - (f.getBoundingClientRect().top - 2))
          })
        // Scroll to the end, then Shift+Tab back up through every row: each one stops clear of the header.
        const rows = week.locator('.week-open')
        const n = await rows.count()
        await rows.last().focus()
        await week.evaluate((el) => el.scrollTo(0, el.scrollHeight))
        for (let i = n - 2; i >= 0; i--) {
          await page.keyboard.press('Shift+Tab')
          await expect(rows.nth(i)).toBeFocused()
          expect(await hidden(week), `row ${i} at ${width}`).toBe(0)
        }

        // A breakdown: from the last day, Tab goes to Close, then on to the first day, which shows in full.
        await week.getByTestId('week-row-balance').click()
        const bd = page.getByTestId('week-breakdown')
        await expect(bd).toBeVisible()
        await settle(page)
        const days = bd.getByTestId('week-day-open')
        await days.last().focus()
        await page.keyboard.press('Tab')
        await expect(bd.getByRole('button', { name: 'Close' })).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(days.first()).toBeFocused()
        expect(await hidden(bd), `first day at ${width}`).toBe(0)
        // And back up from the end with Shift+Tab, day by day.
        await days.last().focus()
        await bd.evaluate((el) => el.scrollTo(0, el.scrollHeight))
        for (let i = (await days.count()) - 2; i >= 0; i--) {
          await page.keyboard.press('Shift+Tab')
          await expect(days.nth(i)).toBeFocused()
          expect(await hidden(bd), `day ${i} at ${width}`).toBe(0)
        }
      })
    }

    test('a missed wake that merges two days gives the chart’s days their dates; a day of only unknown meals has no bar', async ({ page }) => {
      const doc = samWeek()
      // No wake on Tue Oct 20: Mon runs on into Tue, so the week runs Wed 14 .. Mon 19, Wed 21.
      // Sun Oct 18's only meal has unknown calories.
      const merged = {
        ...doc,
        sleeps: doc.sleeps.filter((x) => x.id !== 's20'),
        meals: doc.meals.map((x) => (x.id === 'm7' ? { ...x, kcal: null, source: 'menu' } : x)),
      }
      await seedOwn(page, merged)
      const week = await openWeek(page)
      await week.getByTestId('week-row-eaten').click()
      const bd = page.getByTestId('week-breakdown')
      await expect(bd.getByTestId('week-chart-day')).toHaveText(['Wed14', 'Thu15', 'Fri16', 'Sat17', 'Sun18', 'Mon19', 'Wed21'])
      // Sat (not logged) and Sun (no known calories) draw no bar; Fri's known meals are dashed.
      await expect(bd.getByTestId('week-chart-bar')).toHaveCount(5)
      await expect(bd.locator('[data-testid="week-chart-bar"][data-kind="incomplete"]')).toHaveCount(1)
      await expect(bd.getByTestId('week-day').nth(4).getByTestId('week-day-value')).toHaveText('unknown')
    })
  })
}
