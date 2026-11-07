// Build-out item 2.8 (checklist slice 18; prd.md > 3-Day Timeline): the timeline of 3 waking days,
// or 4 with the day before, with a wake marker and an expected-sleep marker on every day. Covers
// every check under prd.md > 3-Day Timeline:
//   - the demo's after-midnight snack appears as a dot after the midnight line and before that
//     night's sleep block;
//   - with a usual day length of 16 h, the expected-sleep marker sits 16 h after the wake marker;
// and the item's own: both views (3 and 4 days) show both markers on every day, in the drawing and
// in the list; the usual day length is a setting (labelled "your setting, not advice") that moves
// the markers and is saved; every entry opens its details and comes back to the timeline; layout,
// focus and sideways scrolling at 320, 390 and 1440 px. Every journey runs once in each look.
//
// The people are the fictional Sam: the demo week (fixtures/demo-week.json) and an invented own log.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { copy } from '../../src/ui/copy'
import { LOOKS, startInLook } from './looks'
import { fillWhen } from './sleepFields'
import { E2E_KEYS } from './storage-keys'

// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock).
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')
const SAM_NOW = new Date('2026-10-21T10:00:00-04:00')
const iso = (s: string) => `${s}:00-04:00`

/** Text with its no-break spaces read as plain ones. */
const plain = (s: string) => s.replace(/ /g, ' ')

/** An invented own log for Sam: a meal before the first wake, three nights, a gym session, a workout with unknown calories and two weigh-ins. */
function samOwn() {
  return {
    version: 1,
    kind: 'mine',
    profile: { name: '', kind: 'guest' },
    meals: [
      { id: 'm0', name: 'Toast with a long name that needs to wrap on a small phone screen', eatenAt: iso('2026-10-18T21:00'), source: 'label', kcal: 200, protein: null, carbs: null, fat: null },
      { id: 'm1', name: 'Oats', eatenAt: iso('2026-10-19T07:30'), source: 'weighed', kcal: 350, protein: 12, carbs: 60, fat: 6 },
      { id: 'm2', name: 'Soup', eatenAt: iso('2026-10-19T12:30'), source: null, kcal: null, protein: null, carbs: null, fat: null },
      { id: 'm3', name: 'Rice bowl', eatenAt: iso('2026-10-20T19:00'), source: 'photo', kcal: 700, protein: 30, carbs: 90, fat: 20 },
      { id: 'm4', name: 'Yogurt', eatenAt: iso('2026-10-21T00:20'), source: 'label', kcal: 150, protein: 10, carbs: 15, fat: 4 },
      { id: 'm5', name: 'Eggs', eatenAt: iso('2026-10-21T08:00'), source: 'weighed', kcal: 300, protein: 20, carbs: 2, fat: 22 },
    ],
    sleeps: [
      { id: 's1', sleepStart: iso('2026-10-18T23:30'), wake: iso('2026-10-19T07:00') },
      { id: 's2', sleepStart: iso('2026-10-19T23:10'), wake: iso('2026-10-20T06:40') },
      { id: 's3', sleepStart: iso('2026-10-21T01:00'), wake: iso('2026-10-21T07:20') },
    ],
    workouts: [
      {
        id: 'g1', name: 'Pull', startedAt: iso('2026-10-19T18:00'), minutes: 50, kcal: 220, source: 'burn_device',
        gym: { unit: 'kg', exercises: [{ name: 'Row', sets: [{ kind: 'working', weightKg: 40, reps: 10 }] }] },
      },
      { id: 'w2', name: 'Swim', startedAt: iso('2026-10-20T17:00'), minutes: null, kcal: null, source: null },
    ],
    plates: [],
    settings: { weightUnit: 'kg' },
    weighIns: [
      { id: 'wi1', at: iso('2026-10-19T07:10'), kg: 72.4, unit: 'kg', bodyFatPct: 21 },
      { id: 'wi2', at: iso('2026-10-21T07:30'), kg: 72.1, unit: 'kg' },
      // An imported weigh-in with no recorded time: stored a minute after the wake, never drawn there.
      { id: 'wi3', at: iso('2026-10-20T06:41'), kg: 72.3, unit: 'kg', timeApproximate: true },
    ],
  }
}

async function openDemo(page: Page) {
  await page.clock.setFixedTime(DEMO_NOW)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the fictional demo' }).click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function seedOwn(page: Page, doc: unknown = samOwn(), now = SAM_NOW) {
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

async function openTimeline(page: Page): Promise<Locator> {
  await page.getByTestId('open-timeline').click()
  const t = page.getByTestId('timeline-view')
  await expect(t).toBeVisible()
  return t
}

async function settle(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

/** A drawn row's geometry: its strip, the wake and expected-sleep marks, the midnight lines, the sleep block, and each mark's centre. */
async function rowGeometry(row: Locator) {
  return row.evaluate((r) => {
    const box = (sel: string) => {
      const el = r.querySelector(sel)
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { left: b.left, right: b.right, width: b.width, cx: b.left + b.width / 2 }
    }
    return {
      strip: box('[data-testid="timeline-strip"]')!,
      wake: box('[data-kind="wake"]'),
      expected: box('[data-kind="expected"]'),
      now: box('[data-kind="now"]'),
      sleep: box('[data-testid="tld-sleep"]'),
      midnights: [...r.querySelectorAll('[data-testid="tld-midnight"]')].map((m) => m.getBoundingClientRect().left),
      marks: [...r.querySelectorAll('[data-testid="tld-mark"][data-key]')].map((m) => {
        const b = m.getBoundingClientRect()
        return { key: m.getAttribute('data-key'), cx: b.left + b.width / 2 }
      }),
    }
  })
}

/** Every day, in the drawing and in the list, shows a wake marker and an expected-sleep marker 16 h (or `hours`) after it. */
async function expectMarkers(t: Locator, days: number, hours = 16) {
  const rows = t.getByTestId('timeline-row')
  await expect(rows).toHaveCount(days)
  const scale = Number(await t.getByTestId('timeline-drawing').getAttribute('data-scale-hours'))
  expect(scale).toBeGreaterThanOrEqual(24)
  for (let i = 0; i < days; i++) {
    const row = rows.nth(i)
    await expect(row.locator('[data-kind="wake"]')).toHaveCount(1)
    await expect(row.locator('[data-kind="expected"]')).toHaveCount(1)
    const g = await rowGeometry(row)
    expect(g.wake!.left).toBeCloseTo(g.strip.left, 0)
    // The expected-sleep marker sits `hours` after the wake marker, on the row's own scale.
    expect(Math.abs(g.expected!.left - g.wake!.left - (hours / scale) * g.strip.width), `row ${i}`).toBeLessThanOrEqual(1.5)
  }
  const lists = t.getByTestId('timeline-day')
  await expect(lists).toHaveCount(days)
  for (let i = 0; i < days; i++) {
    await expect(lists.nth(i).locator('[data-kind="wake"]')).toHaveCount(1)
    await expect(lists.nth(i).locator('[data-kind="expected"]')).toHaveCount(1)
    await expect(lists.nth(i).locator('[data-kind="expected"]')).toContainText('Expected sleep')
    await expect(lists.nth(i).locator('[data-kind="expected"]')).toContainText('your setting, not advice')
  }
}

for (const { id: look, name: lookName } of LOOKS) {
  test.describe(`item 2.8 in the ${lookName} look: the 3-day and 4-day timeline`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('both views show a wake marker and an expected-sleep marker 16 h after it on every day', async ({ page }) => {
      await openDemo(page)
      const t = await openTimeline(page)
      await expect(t.locator('.sheet-sub')).toHaveText('The 3 waking days to Wed Oct 21')
      await expect(t.getByTestId('timeline-span-3')).toBeChecked()
      await expectMarkers(t, 3)
      await expect(t.locator('.tld-row-name')).toHaveText([/^Mon\sOct\s19$/, /^Tue\sOct\s20$/, /^Wed\sOct\s21 · today$/])
      // The list says what the marker is based on: Wednesday's wake at 1:20 PM plus 16 h.
      const wed = t.getByTestId('timeline-day').nth(2)
      const expected = wed.locator('[data-kind="expected"]')
      await expect(expected).toContainText('Thu')
      await expect(expected).toContainText('5:20 AM')
      await expect(expected).toContainText(copy.timeline.expectedBasis('16 h', '1:20 PM'))
      await expect(expected).toContainText('your setting, not advice')
      await expect(wed.locator('[data-kind="wake"]')).toContainText('1:20 PM')
      await expect(wed.locator('[data-kind="wake"]')).toContainText('after 8 h 45 min of sleep')
      await expect(t.getByTestId('timeline-usual-hint')).toContainText('Your setting, not advice. Preset to 16 h until you change it.')

      // The 4-day view adds the day before.
      await t.getByTestId('timeline-span-4').check()
      await expect(t.locator('.sheet-sub')).toHaveText('The 4 waking days to Wed Oct 21')
      await expectMarkers(t, 4)
      await expect(t.getByTestId('timeline-row').first()).toContainText('Sun Oct 18')
      // Back to 3.
      await t.getByTestId('timeline-span-3').check()
      await expectMarkers(t, 3)
    })

    test('the demo’s after-midnight snack: after the midnight line and before that night’s sleep block, on Wednesday', async ({ page }) => {
      await openDemo(page)
      let t = await openTimeline(page)
      const wedRow = () => t.getByTestId('timeline-row').filter({ hasText: /Wed\sOct\s21/ })
      let g = await rowGeometry(wedRow())
      const snackKey = await t
        .getByTestId('timeline-day')
        .nth(2)
        .getByTestId('timeline-entry')
        .filter({ hasText: 'Apple and peanut butter' })
        .getAttribute('data-key')
      expect(snackKey).toMatch(/^meal-/)
      const snackX = (geo: typeof g) => geo.marks.find((m) => m.key === snackKey)!.cx
      expect(g.midnights).toHaveLength(1)
      expect(snackX(g)).toBeGreaterThan(g.midnights[0])
      // Still awake: the snack comes before now.
      expect(snackX(g)).toBeLessThan(g.now!.cx)
      // In the list it is on Wednesday, with Thursday's weekday over its time.
      const entry = t.getByTestId('timeline-day').nth(2).getByTestId('timeline-entry').filter({ hasText: 'Apple and peanut butter' })
      await expect(entry).toContainText('Thu')
      await expect(entry).toContainText('12:40 AM')
      await page.keyboard.press('Escape')
      await expect(t).toBeHidden()

      // Sam goes to sleep at 1:00 AM: that night's sleep block starts after the snack.
      await page.getByTestId('sleep-action').click()
      const sheet = page.getByTestId('sleep-sheet')
      await fillWhen(sheet, 'sleep', '2026-10-22T01:00')
      await sheet.getByTestId('sleep-save').click()
      await expect(sheet).toBeHidden()
      t = await openTimeline(page)
      g = await rowGeometry(wedRow())
      expect(g.sleep, 'the sleep still going on is drawn').not.toBeNull()
      expect(snackX(g)).toBeGreaterThan(g.midnights[0])
      expect(snackX(g)).toBeLessThan(g.sleep!.left)
      await expect(wedRow().getByTestId('tld-sleep-length')).toHaveText('30 min so far')
      const asleep = t.getByTestId('timeline-day').nth(2).locator('[data-kind="asleep"]')
      await expect(asleep).toContainText('Went to sleep')
      // Under an hour, in minutes only, as a number; "so far" is said once.
      await expect(asleep.locator('.tld-value')).toHaveText('30 min so far')
      await expect(asleep.locator('.tld-value')).toHaveClass(/\bnum\b/)
      await expect(asleep.locator('.tld-detail')).toHaveText('asleep now')
      await page.keyboard.press('Escape')

      // Sam wakes at 9:10 AM: Wednesday is closed by that night, and the new day starts its own row.
      await page.getByTestId('sleep-action').click()
      await fillWhen(sheet, 'sleep', '2026-10-22T09:10')
      await sheet.getByTestId('sleep-save').click()
      await expect(sheet).toBeHidden()
      t = await openTimeline(page)
      await expect(t.locator('.tld-row-name')).toHaveText([/^Tue\sOct\s20$/, /^Wed\sOct\s21$/, /^Thu\sOct\s22 · today$/])
      g = await rowGeometry(wedRow())
      expect(snackX(g)).toBeGreaterThan(g.midnights[0])
      expect(snackX(g)).toBeLessThan(g.sleep!.left)
      await expect(wedRow().getByTestId('tld-sleep-length')).toHaveText('8 h 10 min')
      await expectMarkers(t, 3)
    })

    test('the usual day length is a setting: it moves every marker, says it is not advice, and is saved', async ({ page }) => {
      await openDemo(page)
      let t = await openTimeline(page)
      await t.getByTestId('timeline-usual').selectOption({ label: '15 h' })
      await expectMarkers(t, 3, 15)
      const expected = t.getByTestId('timeline-day').nth(2).locator('[data-kind="expected"]')
      await expect(expected).toContainText('4:20 AM')
      await expect(expected).toContainText(copy.timeline.expectedBasis('15 h', '1:20 PM'))
      // Once set, the preset sentence goes; the demo note stays.
      await expect(t.getByTestId('timeline-usual-hint')).not.toContainText('Preset to')
      await expect(t.getByTestId('timeline-usual-hint')).toContainText('Changing it here changes it in the demo only.')
      await t.getByTestId('timeline-span-4').check()
      await expectMarkers(t, 4, 15)
      // A reload keeps it.
      await page.reload()
      await expect(page.getByTestId('dashboard')).toBeVisible()
      t = await openTimeline(page)
      await expect(t.getByTestId('timeline-usual')).toHaveValue('15')
      await expectMarkers(t, 3, 15)
      // Half hours too.
      await t.getByTestId('timeline-usual').selectOption({ label: '16 h 30 min' })
      await expect(t.getByTestId('timeline-day').nth(2).locator('[data-kind="expected"]')).toContainText('5:50 AM')
      await expectMarkers(t, 3, 16.5)
    })

    test('each entry opens its details, and closing them comes back to the timeline at that entry', async ({ page }) => {
      await seedOwn(page)
      // Viewing an earlier day: the timeline ends there, and closing it puts that day back on screen.
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('waking-day')).toContainText('Tue')
      let t = await openTimeline(page)
      await t.getByTestId('timeline-span-4').check()
      // The day before the first wake time is in the window, but it is not counted as a waking day.
      await expect(t.locator('.sheet-sub-wide')).toHaveText('The 2 waking days to Tue Oct 20, and the time before your first wake time')
      await expect(t.getByTestId('timeline-day')).toHaveCount(3)
      // The day before the first wake time is listed, not drawn.
      await expect(t.getByTestId('timeline-row').first()).toContainText(copy.timeline.notDrawn)
      // Its closing night ends on the next date, so the wake gives its weekday.
      await expect(t.getByTestId('timeline-day').first().locator('[data-kind="sleep"]')).toContainText(/until\sMon\s7:00\sAM/)
      await expect(t.getByTestId('timeline-row').first().locator('[data-kind="wake"]')).toHaveCount(0)
      await expectMarkersOnDrawn(t)

      const mon = t.getByTestId('timeline-day').filter({ hasText: 'Mon Oct 19' })
      // A gym session, a weigh-in and a meal with unknown calories, at their times.
      await expect(mon.getByTestId('timeline-entry').filter({ hasText: 'Pull' })).toContainText('gym session')
      await expect(mon.getByTestId('timeline-entry').filter({ hasText: 'Weigh-in' })).toContainText('72.4 kg')
      await expect(mon.getByTestId('timeline-entry').filter({ hasText: 'Soup' })).toContainText('unknown')
      // After a separator the detail line runs on in lower case.
      await expect(mon.getByTestId('timeline-entry').filter({ hasText: 'Soup' }).locator('.tld-detail')).toHaveText(
        `source not picked${copy.sep}${copy.timeline.noScore}`,
      )
      await expect(mon.getByRole('button', { name: /^Pull,/ })).toHaveAttribute('aria-label', /^Pull, gym session, /)
      await expect(mon.locator('[data-kind="workout"]')).toHaveCount(1)
      const monRow = t.getByTestId('timeline-row').filter({ hasText: 'Mon Oct 19' })
      await expect(monRow.locator('[data-kind="weighIn"]')).toHaveCount(1)
      await expect(monRow.locator('[data-kind="workout"]')).toHaveCount(1)
      await expect(monRow.locator('.tld-meal.unknown')).toHaveCount(1)
      // Tuesday: the swim with unknown calories is a hollow diamond, and the weigh-in with no
      // recorded time is listed in words but not drawn at its placeholder time.
      const tue = t.getByTestId('timeline-day').filter({ hasText: 'Tue Oct 20' })
      const tueRow = t.getByTestId('timeline-row').filter({ hasText: 'Tue Oct 20' })
      await expect(tueRow.locator('.tld-workout.unknown')).toHaveCount(1)
      await expect(tue.locator('.tld-glyph.workoutUnknown')).toHaveCount(1)
      await expect(tue.getByTestId('timeline-entry').filter({ hasText: 'Weigh-in' })).toContainText('time not recorded')
      await expect(tueRow.locator('[data-kind="weighIn"]')).toHaveCount(0)

      // A meal: its details, then back.
      const soup = mon.getByRole('button', { name: /^Soup,/ })
      await soup.click()
      await expect(page.getByTestId('meal-details')).toBeVisible()
      await expect(page.getByTestId('waking-day')).toContainText('Mon')
      await page.keyboard.press('Escape')
      t = page.getByTestId('timeline-view')
      await expect(t).toBeVisible()
      await expect(mon.getByRole('button', { name: /^Soup,/ })).toBeFocused()
      // The 4-day choice is kept.
      await expect(t.getByTestId('timeline-span-4')).toBeChecked()

      // A workout.
      await mon.getByRole('button', { name: /^Pull,/ }).click()
      await expect(page.getByTestId('workout-details')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(mon.getByRole('button', { name: /^Pull,/ })).toBeFocused()

      // A weigh-in: its edit sheet, then back.
      await mon.getByRole('button', { name: /^Weigh-in/ }).click()
      await expect(page.getByTestId('weigh-in-sheet')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(mon.getByRole('button', { name: /^Weigh-in/ })).toBeFocused()

      // The wake: that night in the sleep editor.
      await mon.getByRole('button', { name: /^Woke up at 7:00 AM/ }).click()
      await expect(page.getByTestId('sleep-editor')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(mon.getByRole('button', { name: /^Woke up at 7:00 AM/ })).toBeFocused()

      // Closing the timeline: the day on screen before it opened, and focus on the Timeline link.
      await page.keyboard.press('Escape')
      await expect(t).toBeHidden()
      await expect(page.getByTestId('waking-day')).toContainText('Tue')
      await expect(page.getByTestId('open-timeline')).toBeFocused()
    })

    test('an edit made from the timeline shows in it straight away, and the More menu opens it too', async ({ page }) => {
      await seedOwn(page)
      await page.getByTestId('open-more').click()
      await page.getByTestId('more-timeline').click()
      const t = page.getByTestId('timeline-view')
      await expect(t).toBeVisible()
      await expectMarkersOnDrawn(t)
      const tue = t.getByTestId('timeline-day').filter({ hasText: 'Tue Oct 20' })
      await tue.getByRole('button', { name: /^Rice bowl,/ }).click()
      const details = page.getByTestId('meal-details')
      await expect(details).toBeVisible()
      await details.getByTestId('delete-meal').click()
      await details.getByTestId('delete-confirm-btn').click()
      await expect(t).toBeVisible()
      await expect(tue.getByTestId('timeline-entry').filter({ hasText: 'Rice bowl' })).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(t).toBeHidden()
      await expect(page.getByTestId('waking-day')).toContainText('Wed')
    })

    test('a night whose sleep start was not logged is its own hatched stretch to the closing wake, never time awake (the demo’s Monday)', async ({ page }) => {
      await openDemo(page)
      const t = await openTimeline(page)
      const monRow = t.getByTestId('timeline-row').filter({ hasText: /Mon\sOct\s19/ })
      await expect(monRow.getByTestId('tld-sleep')).toHaveCount(0)
      await expect(monRow.getByTestId('tld-unlogged')).toBeVisible()
      await expect(monRow.getByTestId('tld-sleep-length')).toHaveText(copy.timeline.unloggedNote)
      await expect(t.getByTestId('timeline-legend')).toContainText(copy.timeline.legend.unlogged)
      await expect(t.getByTestId('timeline-legend')).toContainText(copy.timeline.legend.ahead)
      // Its row in the list has the same hatched key as the drawing, not the solid asleep one.
      const monList = t.getByTestId('timeline-day').filter({ hasText: /Mon\sOct\s19/ })
      await expect(monList.locator('[data-kind="sleep"] .tld-glyph')).toHaveClass(/\bunlogged\b/)
      await expect(t.getByTestId('timeline-day').filter({ hasText: /Tue\sOct\s20/ }).locator('[data-kind="sleep"] .tld-glyph')).toHaveClass(/\bsleep\b/)
      // Only today, awake, has a dotted rest of the day; Monday and Tuesday have ended.
      await expect(monRow.getByTestId('tld-ahead')).toHaveCount(0)
      await expect(t.getByTestId('timeline-row').filter({ hasText: /Tue\sOct\s20/ }).getByTestId('tld-ahead')).toHaveCount(0)
      await expect(t.getByTestId('timeline-row').last().getByTestId('tld-ahead')).toHaveCount(1)
      const scale = Number(await t.getByTestId('timeline-drawing').getAttribute('data-scale-hours'))
      const g = await monRow.evaluate((r) => {
        const b = (sel: string) => r.querySelector(sel)!.getBoundingClientRect()
        const lastMeal = [...r.querySelectorAll('[data-kind="meal"]')].map((m) => m.getBoundingClientRect()).sort((a, z) => z.left - a.left)[0]
        return {
          strip: b('[data-testid="timeline-strip"]').toJSON(),
          stretch: b('[data-testid="tld-unlogged"]').toJSON(),
          closing: b('[data-kind="closingWake"]').toJSON(),
          track: b('.tld-track:not(.ahead)').toJSON(),
          lastMealCx: lastMeal.left + lastMeal.width / 2,
        }
      })
      // The stretch runs from the last meal (9:45 PM) to the closing wake, Tue 1:05 PM: 23 h 50 min after the 1:15 PM wake.
      const closingX = g.strip.left + ((23 + 50 / 60) / scale) * g.strip.width
      expect(Math.abs(g.stretch.right - closingX)).toBeLessThanOrEqual(1.5)
      expect(Math.abs(g.closing.right - closingX)).toBeLessThanOrEqual(1.5)
      expect(Math.abs(g.stretch.left - g.lastMealCx)).toBeLessThanOrEqual(1.5)
      // The recorded time awake stops where the stretch starts.
      expect(g.track.right).toBeLessThanOrEqual(g.stretch.left + 1.5)
      // The list says the same.
      const mon = t.getByTestId('timeline-day').filter({ hasText: 'Mon Oct 19' })
      await expect(mon.locator('[data-kind="sleep"]')).toContainText('Sleep start not logged')
      await expect(mon.locator('[data-kind="sleep"]')).toContainText(/until\sTue\s1:05\sPM/)
      // Tuesday's known night ends at its closing wake too.
      const tueRow = t.getByTestId('timeline-row').filter({ hasText: /Tue\sOct\s20/ })
      const tg = await tueRow.evaluate((r) => ({
        sleep: r.querySelector('[data-testid="tld-sleep"]')!.getBoundingClientRect().right,
        closing: r.querySelector('[data-kind="closingWake"]')!.getBoundingClientRect().right,
      }))
      expect(Math.abs(tg.sleep - tg.closing)).toBeLessThanOrEqual(1.5)
      // Today has no closing wake.
      await expect(t.getByTestId('timeline-row').last().locator('[data-kind="closingWake"]')).toHaveCount(0)
    })

    test('at 320 and 390 px every sleep shows its length, and no time, length or score breaks inside', async ({ page }) => {
      await openDemo(page)
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 800 })
        const t = await openTimeline(page)
        for (const span of [3, 4] as const) {
          await t.getByTestId(`timeline-span-${span}`).check()
          await settle(page)
          await sleepNotesShow(t, `demo, ${span} days at ${width}`)
          await valuesStayWhole(t, `demo, ${span} days at ${width}`)
        }
        await t.getByTestId('timeline-span-3').check()
        await page.keyboard.press('Escape')
        await expect(t).toBeHidden()
      }
    })

    test('a day that ended before its expected sleep has no "still ahead" track, and two days on one date are told apart', async ({ page }) => {
      // Sam logs a 2-hour sleep from noon to 2 PM as a night, so Monday has two waking days.
      const doc = {
        ...samOwn(),
        meals: [{ id: 'n1', name: 'Porridge', eatenAt: iso('2026-10-19T08:00'), source: 'label', kcal: 300, protein: null, carbs: null, fat: null }],
        sleeps: [
          { id: 'n0', sleepStart: iso('2026-10-18T23:00'), wake: iso('2026-10-19T07:00') },
          { id: 'n2', sleepStart: iso('2026-10-19T12:00'), wake: iso('2026-10-19T14:00') },
        ],
        workouts: [],
        weighIns: [],
      }
      await seedOwn(page, doc, new Date('2026-10-19T20:00:00-04:00'))
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 844 })
        const t = await openTimeline(page)
        await t.getByTestId('timeline-span-4').check()
        await expect(t.locator('.tld-row-name')).toHaveText([/^Mon\sOct\s19, from 7:00\sAM$/, /^Mon\sOct\s19, from 2:00\sPM · today$/])
        await expect(t.locator('.tld-day-name')).toHaveText([/^Mon\sOct\s19, from 7:00\sAM$/, /^Mon\sOct\s19, from 2:00\sPM · today$/])
        const [first, today] = [t.getByTestId('timeline-row').first(), t.getByTestId('timeline-row').last()]
        // The morning ended at 2 PM: its track stops at the closing wake, and its expected-sleep marker stands alone.
        await expect(first.getByTestId('tld-ahead')).toHaveCount(0)
        await expect(first.locator('[data-kind="expected"]')).toHaveCount(1)
        const g = await first.evaluate((r) => ({
          closing: r.querySelector('[data-kind="closingWake"]')!.getBoundingClientRect().right,
          tracks: [...r.querySelectorAll('.tld-track')].map((l) => l.getBoundingClientRect().right),
        }))
        for (const right of g.tracks) expect(right, `track ends by the closing wake at ${width}`).toBeLessThanOrEqual(g.closing + 1.5)
        // Today, awake, has its rest of the day dotted from now to expected sleep.
        await expect(today.getByTestId('tld-ahead')).toHaveCount(1)
        const a = await today.evaluate((r) => ({
          ahead: r.querySelector('[data-testid="tld-ahead"]')!.getBoundingClientRect().toJSON(),
          now: r.querySelector('[data-kind="now"]')!.getBoundingClientRect().toJSON(),
          expected: r.querySelector('[data-kind="expected"]')!.getBoundingClientRect().toJSON(),
        }))
        expect(Math.abs(a.ahead.left - (a.now.left + a.now.width / 2))).toBeLessThanOrEqual(1.5)
        expect(Math.abs(a.ahead.right - (a.expected.left + a.expected.width / 2))).toBeLessThanOrEqual(1.5)
        expect(await sideways(page), `no sideways scroll at ${width}`).toBeLessThanOrEqual(0)
        await page.keyboard.press('Escape')
        await expect(t).toBeHidden()
      }
    })

    test('opened on the time before the first wake time, it says when its two settings apply instead of offering them', async ({ page }) => {
      await seedOwn(page)
      for (let i = 0; i < 3; i++) await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('waking-day')).toContainText('Wake time not set')
      const t = await openTimeline(page)
      await expect(t.getByTestId('timeline-day')).toHaveCount(1)
      await expect(t.getByTestId('timeline-settings-later')).toHaveText(copy.timeline.settingsLater)
      await expect(t.getByTestId('timeline-span-3')).toHaveCount(0)
      await expect(t.getByTestId('timeline-usual')).toHaveCount(0)
      await page.keyboard.press('Escape')
      // From the first waking day on, both settings are there.
      await page.getByTestId('day-next').click()
      const t2 = await openTimeline(page)
      await expect(t2.getByTestId('timeline-settings-later')).toHaveCount(0)
      await expect(t2.getByTestId('timeline-span-3')).toBeChecked()
      await expect(t2.getByTestId('timeline-usual')).toBeVisible()
    })

    test('the 3 and 4 day choices are named by their visible words', async ({ page }) => {
      await openDemo(page)
      const t = await openTimeline(page)
      await expect(t.getByRole('radio', { name: '3 days', exact: true })).toBeChecked()
      await t.getByRole('radio', { name: '4 days', exact: true }).check()
      await expect(t.getByTestId('timeline-row')).toHaveCount(4)
    })

    test('with no wake time yet, nothing is drawn: no key to a drawing, and it says how to start one', async ({ page }) => {
      const doc = { ...samOwn(), sleeps: [], workouts: [], weighIns: [], meals: samOwn().meals.slice(5) }
      await seedOwn(page, doc)
      const t = await openTimeline(page)
      await expect(t.getByTestId('timeline-strip')).toHaveCount(0)
      await expect(t.getByTestId('timeline-legend')).toHaveCount(0)
      await expect(t).not.toContainText(copy.timeline.drawingNote)
      await expect(t.getByTestId('timeline-row')).toContainText('“Set wake time” on the dashboard')
      await expect(t.getByTestId('timeline-day')).toContainText('Eggs')
    })

    test('focus comes back beside an entry that changed or has gone: an edited wake, a deleted meal, a deleted night', async ({ page }) => {
      await openDemo(page)
      const t = await openTimeline(page)
      const wed = t.getByTestId('timeline-day').filter({ hasText: 'Wed Oct 21' })
      // Wednesday's wake moves an hour earlier: focus returns to that wake's row, now at 12:20 PM.
      await wed.getByRole('button', { name: /^Woke up at 1:20 PM/ }).click()
      const editor = page.getByTestId('sleep-editor')
      await expect(editor).toBeVisible()
      await editor.getByTestId('edit-wake-time-input').fill('12:20 PM')
      await editor.getByTestId('edit-night-save').click()
      if (await page.getByTestId('moves-save').isVisible()) await page.getByTestId('moves-save').click()
      await expect(t).toBeVisible()
      await expect(wed.getByRole('button', { name: /^Woke up at 12:20 PM/ })).toBeFocused()

      // A deleted meal: focus goes to the row after it.
      await wed.getByRole('button', { name: /^Pasta bake/ }).click()
      const details = page.getByTestId('meal-details')
      await details.getByTestId('delete-meal').click()
      await details.getByTestId('delete-confirm-btn').click()
      await expect(t).toBeVisible()
      await expect(wed.getByRole('button', { name: /^Chicken, rice and broccoli/ })).toBeFocused()

      // A deleted night (the one before Tuesday): Tuesday joins Monday, and focus goes to the row
      // after its wake, Tuesday's first meal.
      const tue = t.getByTestId('timeline-day').filter({ hasText: 'Tue Oct 20' })
      await tue.getByRole('button', { name: /^Woke up at 1:05 PM/ }).click()
      await expect(editor).toBeVisible()
      await editor.getByTestId('delete-night').click()
      // Confirmed from the keyboard, so the ring on the row focus comes back to shows.
      await page.getByTestId('delete-night-confirm').focus()
      await page.keyboard.press('Enter')
      await expect(t).toBeVisible()
      await expect(t.getByRole('button', { name: /^Bagel with cream cheese/ })).toBeFocused()
      expect(await t.getByRole('button', { name: /^Bagel with cream cheese/ }).evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid')
    })

    test('layout at 320, 390 and 1440 px: no sideways scrolling, values kept whole, focus rings and 44 px rows', async ({ page }) => {
      await seedOwn(page)
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await settle(page)
        expect(await sideways(page), `dashboard at ${width}`).toBeLessThanOrEqual(0)
        const link = page.getByTestId('open-timeline')
        const box = (await link.boundingBox())!
        expect(box.height, `"Timeline" hugs its word at ${width}`).toBeLessThan(32)
        await link.focus()
        await page.keyboard.press('Shift+Tab')
        await page.keyboard.press('Tab')
        await expect(link).toBeFocused()
        expect(await link.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid')
        await page.keyboard.press('Enter')
        const t = page.getByTestId('timeline-view')
        await expect(t).toBeVisible()
        await t.getByTestId('timeline-span-4').check()
        await settle(page)
        // The window holds the time before the first wake time: under 360 px a shorter wording keeps the sticky header small.
        const [wide, narrow] = [t.locator('.sheet-sub-wide'), t.locator('.sheet-sub-narrow')]
        await expect(wide).toHaveText('The 3 waking days to Wed Oct 21, and the time before your first wake time')
        await expect(narrow).toHaveText('3 waking days to Wed Oct 21, and the time before them')
        await expect(width < 360 ? narrow : wide).toBeVisible()
        await expect(width < 360 ? wide : narrow).toBeHidden()
        if (width < 360) {
          const lines = await t.locator('.sheet-sub').evaluate((e) => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight))
          expect(Math.round(lines), 'the short subtitle takes at most 2 lines at 320').toBeLessThanOrEqual(2)
        }
        expect(await t.evaluate((el) => el.scrollWidth - el.clientWidth), `timeline at ${width}`).toBeLessThanOrEqual(0)
        expect(await sideways(page), `page under the timeline at ${width}`).toBeLessThanOrEqual(0)
        // The drawing stays inside the sheet: every mark and label within its strip's width.
        const out = await t.getByTestId('timeline-row').evaluateAll((rows) =>
          rows.flatMap((r) => {
            const strip = r.querySelector('[data-testid="timeline-strip"]')
            if (!strip) return []
            const s = strip.getBoundingClientRect()
            return [...r.querySelectorAll('[data-testid="tld-mark"], [data-testid="tld-label"]')]
              .map((m) => m.getBoundingClientRect())
              .filter((b) => b.left < s.left - 8 || b.right > s.right + 8)
              .map((b) => `${b.left}-${b.right} outside ${s.left}-${s.right}`)
          }),
        )
        expect(out, `marks at ${width}`).toEqual([])
        // Values are numbers on one line; words in their place are plain text.
        for (const v of await t.locator('.tld-value').all()) {
          const cls = (await v.getAttribute('class')) ?? ''
          const style = await v.evaluate((e) => ({ ws: getComputedStyle(e).whiteSpace, weight: getComputedStyle(e).fontWeight }))
          expect(style.ws).toBe('nowrap')
          if (!cls.includes('num')) expect(style.weight, `${await v.innerText()} at ${width}`).toBe('400')
        }
        for (const s of await t.locator('.tld-entry.empty .tld-main, .tld-entry.noWake .tld-main').all()) {
          expect(await s.evaluate((e) => getComputedStyle(e).fontWeight)).toBe('400')
        }
        // Every time is readable: no raw ISO dates anywhere on the sheet.
        expect(await t.innerText()).not.toMatch(/\d{4}-\d{2}-\d{2}/)
        // Sleep lengths show over every drawn sleep, and times, lengths and scores stay whole.
        await sleepNotesShow(t, `own log at ${width}`)
        await valuesStayWhole(t, `own log at ${width}`)
        // An entry is a 44 px row whose focus ring shows, and stops clear of the sticky header.
        const entry = t.locator('.tld-open').last()
        await entry.focus()
        await page.keyboard.press('Shift+Tab')
        await page.keyboard.press('Tab')
        await expect(entry).toBeFocused()
        expect(await entry.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid')
        expect((await entry.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        const clear = await entry.evaluate((e) => {
          const head = e.closest('.sheet')!.querySelector('header')!.getBoundingClientRect()
          return e.getBoundingClientRect().top - head.bottom
        })
        expect(clear, `entry below the sheet header at ${width}`).toBeGreaterThanOrEqual(0)
        // The two choices and the setting fit.
        for (const c of [t.getByTestId('timeline-span-3'), t.getByTestId('timeline-span-4'), t.getByTestId('timeline-usual')]) {
          const b = (await c.boundingBox())!
          expect(b.x + b.width).toBeLessThanOrEqual(width)
        }
        if (look === 'panel') expect(await t.getByTestId('timeline-day').first().evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe('14px')
        if (look === 'night') expect(await t.getByTestId('timeline-day').first().evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe('solid')
        await page.keyboard.press('Escape')
        await expect(t).toBeHidden()
        await expect(link).toBeFocused()
      }
    })

    test('now and a meal with unknown calories differ in shape, in the drawing and in the legend, not only in colour', async ({ page }) => {
      // Today (Wed) holds a meal with unknown calories at 8:00 AM, and now is 10:00 AM.
      const doc = samOwn()
      doc.meals = doc.meals.map((m) => (m.id === 'm5' ? { ...m, source: null, kcal: null, protein: null, carbs: null, fat: null } : m))
      await seedOwn(page, doc)
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 844 })
        const t = await openTimeline(page)
        const today = t.getByTestId('timeline-row').last()
        const now = today.locator('[data-kind="now"]')
        const unknown = today.locator('.tld-meal.unknown')
        await expect(now).toHaveCount(1)
        await expect(unknown).toHaveCount(1)
        // The drawing: now is a triangle, the unknown meal a circle.
        expect(await now.evaluate((e) => [e.tagName, (e.getAttribute('points') ?? '').trim().split(/\s+/).length])).toEqual(['polygon', 3])
        expect(await unknown.evaluate((e) => e.tagName)).toBe('circle')
        // The legend's keys differ in shape too: a round key for the meal, a triangle (a top border between clear sides) for now.
        const key = (kind: string) =>
          t.locator(`.tld-legend-item[data-kind="${kind}"] .tld-key`).evaluate((e) => {
            const c = getComputedStyle(e)
            return { radius: c.borderTopLeftRadius, top: c.borderTopWidth, left: c.borderLeftColor }
          })
        const meal = await key('mealUnknown')
        const nowKey = await key('now')
        expect(meal.radius).toBe('50%')
        expect(nowKey.radius).toBe('0px')
        expect(nowKey.top).toBe('11px')
        expect(nowKey.left).toBe('rgba(0, 0, 0, 0)')
        // The list's glyph for now is the same triangle.
        expect(await t.locator('[data-kind="now"] .tld-glyph').evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe('11px')
        await page.keyboard.press('Escape')
        await expect(t).toBeHidden()
      }
    })

    test('the legend names only what the drawing holds: on an earlier day, no now and no rest of today', async ({ page }) => {
      await openDemo(page)
      const legendKinds = (t: Locator) => t.locator('.tld-legend-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))
      let t = await openTimeline(page)
      const today = await legendKinds(t)
      expect(today).toContain('now')
      expect(today).toContain('ahead')
      // The demo has no weigh-ins, so the legend has no weigh-in key.
      expect(today).not.toContain('weighIn')
      // Every key in the legend is drawn somewhere: each mark kind has a mark of that kind.
      for (const kind of ['meal', 'mealUnknown', 'workout', 'workoutUnknown']) {
        const drawn = await t.locator(kind.endsWith('Unknown') ? `.tld-${kind.replace('Unknown', '')}.unknown` : `.tld-${kind}:not(.unknown)`).count()
        expect(today.includes(kind), `${kind} in the legend only when drawn`).toBe(drawn > 0)
      }
      await page.keyboard.press('Escape')
      await expect(t).toBeHidden()
      await page.getByTestId('day-prev').click()
      t = await openTimeline(page)
      const earlier = await legendKinds(t)
      expect(earlier).not.toContain('now')
      expect(earlier).not.toContain('ahead')
      expect(earlier).toContain('wake')
      expect(earlier).toContain('expected')
      await expect(t.locator('[data-kind="now"]')).toHaveCount(0)
    })

    test('a meal opened from the timeline: its score comes back to its details, and its details back to the timeline', async ({ page }) => {
      await seedOwn(page)
      const t = await openTimeline(page)
      const mon = t.getByTestId('timeline-day').filter({ hasText: 'Mon Oct 19' })
      await t.getByTestId('timeline-span-4').check()
      await mon.getByRole('button', { name: /^Oats,/ }).click()
      const details = page.getByTestId('meal-details')
      await expect(details).toBeVisible()
      await details.getByTestId('details-score').click()
      const explain = page.getByTestId('explain-meal')
      await expect(explain).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(explain).toBeHidden()
      await expect(details).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(details).toBeHidden()
      await expect(t).toBeVisible()
      await expect(mon.getByRole('button', { name: /^Oats,/ })).toBeFocused()
      await expect(t.getByTestId('timeline-span-4')).toBeChecked()
    })

    test('choosing 16 h again puts the preset back: its hint returns, and Reset demo no longer lists it', async ({ page }) => {
      await openDemo(page)
      let t = await openTimeline(page)
      const hint = t.getByTestId('timeline-usual-hint')
      await t.getByTestId('timeline-usual').selectOption({ label: '15 h' })
      await expect(hint).not.toContainText('Preset to 16 h')
      await t.getByTestId('timeline-usual').selectOption({ label: '16 h' })
      await expect(hint).toContainText('Preset to 16 h until you change it.')
      await page.keyboard.press('Escape')
      await expect(t).toBeHidden()
      await page.getByTestId('open-more').click()
      await expect(page.getByTestId('more-resetDemo')).toBeVisible()
      await page.getByTestId('more-resetDemo').click()
      // The demo is as it started again, so Reset demo has nothing to list and asks nothing.
      await expect(page.getByText(copy.resetDemo.done)).toBeVisible()
      await expect(page.getByTestId('reset-demo-sheet')).toHaveCount(0)
      // A length other than the preset is still listed.
      t = await openTimeline(page)
      await t.getByTestId('timeline-usual').selectOption({ label: '17 h' })
      await page.keyboard.press('Escape')
      await page.getByTestId('open-more').click()
      await page.getByTestId('more-resetDemo').click()
      await expect(page.getByTestId('reset-demo-sheet')).toContainText('Sam’s usual day length changed')
    })
  })
}

/** Each time ("1:15 PM"), length ("16 h", "8 h 45 min", "50 min") and score ("Score 90") in the list's detail lines stays on one line. */
async function valuesStayWhole(t: Locator, what: string) {
  const r = await t.evaluate((sheet) => {
    const re = /\d{1,2}:\d{2}[\s\u00a0](?:AM|PM)|\d+[\s\u00a0]h(?:[\s\u00a0]\d+[\s\u00a0]min)?|\d+[\s\u00a0]min|Score[\s\u00a0]\d+/g
    let checked = 0
    const split: string[] = []
    for (const el of sheet.querySelectorAll('.tld-detail')) {
      const node = el.firstChild
      if (!node || node.nodeType !== Node.TEXT_NODE) continue
      const text = node.textContent ?? ''
      for (const m of text.matchAll(re)) {
        const range = document.createRange()
        range.setStart(node, m.index)
        range.setEnd(node, m.index + m[0].length)
        const tops = new Set([...range.getClientRects()].filter((b) => b.width > 0).map((b) => Math.round(b.top)))
        checked++
        if (tops.size > 1) split.push(`${m[0]} in "${text}"`)
      }
    }
    return { checked, split }
  })
  expect(r.checked, `${what}: values found`).toBeGreaterThan(5)
  expect(r.split, `${what}: values split across lines`).toEqual([])
}

/** Every drawn sleep (or stretch with no sleep start) has its words over it, shown in full inside the strip's width. */
async function sleepNotesShow(t: Locator, what: string) {
  const r = await t.getByTestId('timeline-row').evaluateAll((rows) =>
    rows.flatMap((row) => {
      const strip = row.querySelector('[data-testid="timeline-strip"]')
      const stretch = row.querySelector('[data-testid="tld-sleep"], [data-testid="tld-unlogged"]')
      if (!strip || !stretch) return []
      const note = row.querySelector<HTMLElement>('[data-testid="tld-sleep-length"]')
      if (!note) return [`${row.getAttribute('data-day')}: no note`]
      const s = strip.getBoundingClientRect()
      const n = note.getBoundingClientRect()
      const hidden = getComputedStyle(note).display === 'none' || n.width === 0
      const out = n.left < s.left - 0.5 || n.right > s.right + 0.5
      return hidden || out ? [`${row.getAttribute('data-day')}: ${note.textContent} ${hidden ? 'hidden' : 'outside the strip'}`] : []
    }),
  )
  expect(r, what).toEqual([])
}

/** Every drawn row has its wake and expected-sleep marks, 16 h apart; the rows not drawn have neither. */
async function expectMarkersOnDrawn(t: Locator) {
  const scale = Number(await t.getByTestId('timeline-drawing').getAttribute('data-scale-hours'))
  for (const row of await t.getByTestId('timeline-row').all()) {
    if ((await row.getByTestId('timeline-strip').count()) === 0) {
      await expect(row.locator('[data-kind="expected"]')).toHaveCount(0)
      continue
    }
    const g = await rowGeometry(row)
    expect(plain(await row.innerText()).length).toBeGreaterThan(0)
    expect(Math.abs(g.expected!.left - g.wake!.left - (16 / scale) * g.strip.width)).toBeLessThanOrEqual(1.5)
  }
}
