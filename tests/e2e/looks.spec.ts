// Build-out item 1.5.2: the looks. Every look this build offers (src/ui/looks.ts) shows the same
// numbers and offers the same actions and detail; only the presentation differs. The core
// journey runs once in each look, data-driven, so a look added to looks.ts is covered here
// without a new test. The choice is a device setting that applies at once and survives a reload.
//
// The people here are the fictional Sam (the demo week, fixtures/demo-week.json).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { E2E_KEYS } from './storage-keys'
import { BUILT_LOOKS, LOOKS, lookOnPage, startInLook } from './looks'

// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock).
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')

// G11 and G11b (spec.md > Maths Core: Estimates, Ranges and the Day).
const G11 = { kcal: '2280', score: 'Estimate score 83', likely: '1870–2780', veryLikely: '1684–3087' }
const G11B = { kcal: '2380', score: 'Estimate score 92' }

// Sam's own saved log (fixtures/saved/v1-mine.json), viewed on its Wednesday evening.
const V1_MINE = readFileSync(fileURLToPath(new URL('../../fixtures/saved/v1-mine.json', import.meta.url)), 'utf8')
const MINE_NOW = new Date('2026-10-28T20:00:00-04:00')

/** Text with thousands separators removed, so "1,870–2,780" reads as "1870–2780". */
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

function row(page: Page, name: string): Locator {
  return page.getByTestId('meal-row').filter({ hasText: name })
}

async function sleepAction(page: Page, button: string, when: string) {
  const action = page.getByTestId('sleep-action')
  await expect(action).toHaveText(button)
  await action.click()
  const sheet = await opened(page, 'sleep-sheet')
  await sheet.getByTestId('sleep-when-input').fill(when)
  await sheet.getByTestId('sleep-save').click()
  await expect(sheet).toBeHidden()
}

async function openLookSheet(page: Page): Promise<Locator> {
  await page.getByTestId('open-more').click()
  await (await opened(page, 'more-menu')).getByTestId('more-look').click()
  return opened(page, 'look-sheet')
}

for (const { id: look, name } of LOOKS) {
  test.describe(`the ${name} look`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('the core journey: the same numbers, explanations and actions', async ({ page }) => {
      test.setTimeout(90_000)
      await openDemo(page)
      expect(await lookOnPage(page)).toBe(look)

      // Sam's Wednesday.
      expect(await digits(page.getByTestId('headline-kcal'))).toBe(G11.kcal)
      await expect(page.getByTestId('day-score')).toHaveText(G11.score)
      expect(await digits(page.getByTestId('likely-range'))).toContain(G11.likely)
      expect(await digits(page.getByTestId('very-likely-range'))).toContain(G11.veryLikely)
      await expect(page.getByTestId('biggest-line')).toContainText('Most uncertainty comes from Pasta bake (ready meal)')

      // Tapping the score opens its explanation; the ranges open theirs.
      await page.getByTestId('day-score').click()
      await expect(await opened(page, 'explain-day')).toContainText("How sure is today's total?")
      await closeWithEsc(page, 'explain-day')
      await page.getByTestId('likely-range').click()
      expect(await digits((await opened(page, 'explain-ranges')).getByTestId('explain-likely'))).toContain(G11.likely)
      await closeWithEsc(page, 'explain-ranges')

      // Improve the pasta bake with the label values typed in.
      await page.getByTestId('improve-entry').click()
      const improve = await opened(page, 'log-meal-sheet')
      await expect(improve.getByRole('heading', { name: 'Improve: Pasta bake (ready meal)' })).toBeVisible()
      await improve.getByTestId('source-label').check()
      await improve.getByTestId('meal-kcal-input').fill('860')
      await improve.getByTestId('meal-protein-input').fill('42')
      await improve.getByTestId('meal-carbs-input').fill('96')
      await improve.getByTestId('meal-fat-input').fill('33')
      await improve.getByTestId('save-meal').click()
      await expect(improve).toBeHidden()
      expect(await digits(page.getByTestId('headline-kcal'))).toBe(G11B.kcal)
      await expect(page.getByTestId('day-score')).toHaveText(G11B.score)

      // Log a meal: name, how you know, calories.
      await page.getByTestId('log-meal').click()
      const log = await opened(page, 'log-meal-sheet')
      await log.getByTestId('meal-name-input').fill('Evening tea with milk')
      await log.getByTestId('source-label').check()
      await log.getByTestId('meal-kcal-input').fill('40')
      await log.getByTestId('save-meal').click()
      await expect(log).toBeHidden()
      await expect(page.getByTestId('meal-row')).toHaveCount(6)
      expect(await digits(page.getByTestId('headline-kcal'))).toBe('2420')

      // Open its details.
      await row(page, 'Evening tea with milk').getByTestId('meal-open').click()
      const details = await opened(page, 'meal-details')
      await expect(details.getByRole('heading', { name: 'Evening tea with milk' })).toBeVisible()
      await expect(details.getByTestId('details-kcal')).toHaveText('40 kcal')
      await closeWithEsc(page, 'meal-details')

      // Sleep at 4:40 AM, wake at 1:10 PM: a new, empty waking day; Previous returns to Wednesday.
      await sleepAction(page, 'I’m going to sleep', '2026-10-22T04:40')
      await sleepAction(page, 'I woke up', '2026-10-22T13:10')
      await expect(page.getByTestId('waking-day')).toHaveText('Thu · awake since 1:10 PM')
      await expect(page.getByTestId('empty-day')).toContainText('No meals logged yet')
      await expect(page.getByTestId('log-meal')).toHaveText('Log your first meal')
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 1:20 PM')
      await expect(row(page, 'Apple and peanut butter')).toContainText('Thu 12:40 AM')

      // More opens Targets, and in your own log Profile and privacy.
      await page.getByTestId('open-more').click()
      await (await opened(page, 'more-menu')).getByTestId('more-targets').click()
      await opened(page, 'targets-sheet')
      await closeWithEsc(page, 'targets-sheet')
      await page.getByTestId('log-switch').click()
      await expect(page.getByTestId('empty-day')).toBeVisible()
      await page.getByTestId('open-more').click()
      await (await opened(page, 'more-menu')).getByTestId('more-profile').click()
      await opened(page, 'profile-privacy')
      await closeWithEsc(page, 'profile-privacy')

      // Still in the same look after all of that.
      expect(await lookOnPage(page)).toBe(look)
    })

    test('Log a meal and the sleep button: pinned to the bottom on a phone, in the layout on a wider screen', async ({
      page,
    }) => {
      await openDemo(page)
      const bar = page.getByTestId('action-bar')
      const width = page.viewportSize()!.width
      const position = await bar.evaluate((e) => getComputedStyle(e).position)
      if (width < 640) {
        expect(position).toBe('fixed')
        const box = (await bar.boundingBox())!
        expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height)
        // Scrolled to the end, the last of the page sits above the bar, never under it.
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        const nav = (await page.getByTestId('day-nav').boundingBox())!
        const barNow = (await bar.boundingBox())!
        expect(nav.y + nav.height).toBeLessThanOrEqual(barNow.y + 0.5)
        // No sideways scrolling.
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      } else {
        expect(position).toBe('static')
      }
      // Reachable from the keyboard like any button.
      await page.getByTestId('log-meal').focus()
      await page.keyboard.press('Enter')
      await opened(page, 'log-meal-sheet')
    })

    test('on a phone, a control reached with Tab is never left under the pinned bar', async ({ page }) => {
      test.skip(page.viewportSize()!.width >= 640, 'the bar is pinned on a phone only')
      // Sam's own log with 14 more snacks, so the meal list runs well past the bottom of the screen.
      const log = JSON.parse(V1_MINE)
      for (let i = 1; i <= 14; i += 1) {
        log.meals.push({
          id: `snack-${i}`,
          name: i === 7 ? 'Snack with a long name that wraps onto a second line on a phone' : `Snack ${i}`,
          eatenAt: `2026-10-28T18:${String(i * 2).padStart(2, '0')}:00-04:00`,
          source: 'label',
          kcal: 100 + i,
          protein: 2,
          carbs: 15,
          fat: 3,
        })
      }
      await page.clock.setFixedTime(MINE_NOW)
      await page.goto('/')
      await page.evaluate(
        ([mineKey, mine, activeKey]) => {
          localStorage.setItem(mineKey, mine)
          localStorage.setItem(activeKey, 'mine')
        },
        [E2E_KEYS.mine, JSON.stringify(log), E2E_KEYS.active] as const,
      )
      await page.reload()
      await expect(page.getByTestId('dashboard')).toBeVisible()
      const rows = page.getByTestId('meal-open')
      await expect(rows).toHaveCount(18)

      // Tab from the top of the page to the last meal row; every control that takes focus outside
      // the bar must sit wholly above the bar's top edge.
      const bar = page.getByTestId('action-bar')
      await page.locator('body').focus()
      let reachedLast = false
      for (let i = 0; i < 80 && !reachedLast; i += 1) {
        await page.keyboard.press('Tab')
        const focus = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null
          if (!el || el === document.body) return null
          const r = el.getBoundingClientRect()
          const barTop = document.querySelector('[data-testid="action-bar"]')!.getBoundingClientRect().top
          return {
            label: el.getAttribute('aria-label') ?? el.textContent ?? '',
            inBar: !!el.closest('[data-testid="action-bar"]'),
            top: r.top,
            bottom: r.bottom,
            barTop,
            isLastRow: el === [...document.querySelectorAll('[data-testid="meal-open"]')].pop(),
          }
        })
        if (!focus || focus.inBar) continue
        expect(focus.top, focus.label).toBeGreaterThanOrEqual(0)
        expect(focus.bottom, focus.label).toBeLessThanOrEqual(focus.barTop + 0.5)
        reachedLast = focus.isLastRow
      }
      expect(reachedLast).toBe(true)
      await expect(rows.last()).toBeFocused()
      const last = (await rows.last().boundingBox())!
      expect(last.y + last.height).toBeLessThanOrEqual((await bar.boundingBox())!.y + 0.5)
    })

    test('choosing a look in the Look sheet applies it at once and survives a reload', async ({ page }) => {
      await openDemo(page)
      const sheet = await openLookSheet(page)
      await expect(sheet.getByRole('heading', { name: 'Look' })).toBeVisible()
      await expect(sheet.getByRole('radio')).toHaveCount(BUILT_LOOKS.length)
      await expect(sheet.getByRole('radio', { name, exact: true })).toBeChecked()

      for (const target of LOOKS) {
        const radio = sheet.getByRole('radio', { name: target.name, exact: true })
        await radio.check()
        await expect(radio).toBeChecked()
        await expect.poll(() => lookOnPage(page)).toBe(target.id)
        expect(await page.evaluate((key) => localStorage.getItem(key), E2E_KEYS.look)).toBe(target.id)

        await page.reload()
        await expect(page.getByTestId('dashboard')).toBeVisible()
        expect(await lookOnPage(page)).toBe(target.id)
        const again = await openLookSheet(page)
        await expect(again.getByRole('radio', { name: target.name, exact: true })).toBeChecked()
        await closeWithEsc(page, 'look-sheet')
        await openLookSheet(page)
      }
    })
  })
}

test.describe('the Look sheet and the saved look', () => {
  test('lists each look with its name, one plain line and a preview, and works from the keyboard', async ({ page }) => {
    await openDemo(page)
    const sheet = await openLookSheet(page)
    await expect(sheet.getByTestId('fictional-banner')).toBeVisible()
    for (const l of LOOKS) {
      const option = sheet.getByTestId(`look-${l.id}`)
      await expect(option).toContainText(l.name)
      await expect(option).toContainText(l.description)
      await expect(option.locator('.look-preview')).toHaveAttribute('aria-hidden', 'true')
      await expect(sheet.getByRole('radio', { name: l.name, exact: true })).toHaveAccessibleDescription(l.description)
    }
    // Close has focus first; Tab reaches the checked look, and Esc gives focus back to the dashboard.
    await expect(sheet.getByRole('button', { name: 'Close' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(sheet.getByRole('radio', { checked: true })).toBeFocused()
    await closeWithEsc(page, 'look-sheet')
  })

  test('the saved look is applied before the first render, so a reload never flashes another look', async ({ page }) => {
    // Record the look on <html> at the moment the app first draws into #root.
    await page.addInitScript(() => {
      const w = window as unknown as { lookAtFirstRender?: string | null }
      const watch = new MutationObserver(() => {
        const root = document.getElementById('root')
        if (root && root.firstChild && w.lookAtFirstRender === undefined) {
          w.lookAtFirstRender = document.documentElement.dataset.look ?? null
          watch.disconnect()
        }
      })
      watch.observe(document, { childList: true, subtree: true })
    })
    const last = BUILT_LOOKS[BUILT_LOOKS.length - 1]
    await startInLook(page, last)
    await openDemo(page)
    await page.reload()
    await expect(page.getByTestId('dashboard')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { lookAtFirstRender?: string }).lookAtFirstRender)).toBe(last)
  })

  test('an unknown saved look falls back to Journal without crashing, and is left as it is', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'sepia'), E2E_KEYS.look)
    await openDemo(page)
    expect(await lookOnPage(page)).toBe('journal')
    expect(await digits(page.getByTestId('headline-kcal'))).toBe(G11.kcal)
    expect(await page.evaluate((key) => localStorage.getItem(key), E2E_KEYS.look)).toBe('sepia')
  })

  test('the look is not part of a log: switching logs and deleting your own log keep it', async ({ page }) => {
    const saved = BUILT_LOOKS[BUILT_LOOKS.length - 1]
    await startInLook(page, saved)
    await openDemo(page)
    const demoDoc = await page.evaluate((key) => localStorage.getItem(key) ?? '', E2E_KEYS.demo)
    expect(demoDoc).not.toMatch(/"look"/)

    await page.getByTestId('log-switch').click()
    await expect(page.getByTestId('empty-day')).toBeVisible()
    expect(await lookOnPage(page)).toBe(saved)
    await page.getByTestId('open-profile').click()
    const panel = await opened(page, 'profile-privacy')
    await panel.getByTestId('delete-data').click()
    await panel.getByTestId('delete-data-confirm-btn').click()
    await expect(panel).toContainText('Deleted. Your log on this device is now empty.')
    expect(await page.evaluate((key) => localStorage.getItem(key), E2E_KEYS.look)).toBe(saved)
    expect(await lookOnPage(page)).toBe(saved)
  })

  test('with storage refusing writes, the Look sheet still works, a chosen look applies, and the notice shows', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      }
    })
    await openDemo(page)
    // Nothing could be saved, so the page starts in Journal.
    expect(await lookOnPage(page)).toBe('journal')
    const sheet = await openLookSheet(page)
    await expect(sheet.getByRole('radio', { name: 'Journal', exact: true })).toBeChecked()
    // Each other look this build offers applies in memory, then Journal again.
    for (const target of [...LOOKS.filter((l) => l.id !== 'journal'), LOOKS[0]]) {
      const radio = sheet.getByRole('radio', { name: target.name, exact: true })
      await radio.check()
      await expect(radio).toBeChecked()
      expect(await lookOnPage(page)).toBe(target.id)
    }
    await closeWithEsc(page, 'look-sheet')
    await expect(page.getByTestId('storage-blocked')).toBeVisible()
    expect(await digits(page.getByTestId('headline-kcal'))).toBe(G11.kcal)
  })
})

test.describe('the Journal look in detail', () => {
  test.beforeEach(async ({ page }) => {
    await startInLook(page, 'journal')
  })

  test('one labelled range bar, drawn for the eye, with every number in its text legend', async ({ page }) => {
    await openDemo(page)
    const bar = page.getByTestId('range-bar')
    await expect(bar).toBeVisible()
    await expect(bar).toHaveAttribute('aria-hidden', 'true')
    await expect(page.getByTestId('best-estimate')).toHaveText(/Best estimate\s*2,280 kcal/)
    await expect(page.getByTestId('range-target')).toHaveText(/Target\s*2,400 kcal/)
    // The bar and legend are one button that opens the range explanation.
    await expect(page.getByTestId('ranges')).toHaveAccessibleName(/Likely 1,870–2,780 kcal/)
    // The score is a small pill beside the target, and the headline dominates.
    const headline = await page.locator('.headline-number').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
    expect(headline).toBe(52)
    const pill = (await page.getByTestId('day-score').boundingBox())!
    const target = (await page.getByTestId('headline-target').boundingBox())!
    expect(Math.abs(pill.y + pill.height / 2 - (target.y + target.height / 2))).toBeLessThan(4)
    expect(target.x).toBeGreaterThan(pill.x + pill.width)
  })

  test('meal rows are one button each, with the score as plain text', async ({ page }) => {
    await openDemo(page)
    const pasta = row(page, 'Pasta bake (ready meal)')
    await expect(pasta.getByRole('button')).toHaveCount(1)
    await expect(pasta.getByTestId('meal-score')).toHaveText('Score 54')
    await expect(pasta.getByRole('button')).toHaveAccessibleName(
      'Pasta bake (ready meal), 5:30 PM · Photo estimate, 760 kcal, Estimate score 54. Opens the meal details.',
    )
    // Tapping the score text opens the meal's details, like the rest of the row.
    await pasta.getByTestId('meal-score').click()
    await expect(page.getByTestId('meal-details').getByTestId('details-score')).toHaveText('Estimate score 54')
  })

  test('an incomplete day draws no bar and says why; a day with no known calories draws none either', async ({ page }) => {
    await openDemo(page)
    for (let i = 0; i < 7 && (await page.getByTestId('day-status').count()) === 0; i += 1) {
      await page.getByTestId('day-prev').click()
    }
    await expect(page.getByTestId('day-status')).toContainText('Known meals only — incomplete day')
    await expect(page.getByTestId('range-bar')).toHaveCount(0)
    await expect(page.getByTestId('best-estimate')).toHaveCount(0)
    await expect(page.getByTestId('ranges-known-only')).toHaveText(
      'These ranges cover the known meals only, so no bar is drawn until every meal has calories.',
    )
    expect(await digits(page.getByTestId('likely-range'))).toMatch(/\d+–\d+ kcal/)

    await page.getByTestId('day-today').click()
    await page.getByTestId('log-switch').click()
    await expect(page.getByTestId('empty-day')).toBeVisible()
    await expect(page.getByTestId('range-bar')).toHaveCount(0)
    await expect(page.getByTestId('likely-range')).toContainText('Not available yet')
  })

  test('the biggest uncertainty is one line with a short Improve link, and no amber box', async ({ page }) => {
    await openDemo(page)
    const line = page.locator('.uncertainty-line')
    await expect(line).toHaveText('Most uncertainty comes from Pasta bake (ready meal). Improve ›')
    await expect(page.getByTestId('improve-entry')).toHaveAccessibleName('Improve that entry')
    await expect(line).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(line).toHaveCSS('border-left-width', '0px')
  })

  test('a wide screen puts the day on the left and the meals and sleep on the right', async ({ page }) => {
    await openDemo(page)
    const day = (await page.getByTestId('dash-col-day').boundingBox())!
    const list = (await page.getByTestId('dash-col-list').boundingBox())!
    if (page.viewportSize()!.width >= 960) {
      expect(list.x).toBeGreaterThan(day.x + day.width - 1)
      expect(Math.abs(list.y - day.y)).toBeLessThan(2)
    } else {
      expect(list.y).toBeGreaterThanOrEqual(day.y + day.height - 1)
    }
  })

  test('sheets open with a short depth tilt, and none under reduced motion', async ({ page }) => {
    await openDemo(page)
    await page.getByTestId('day-score').click()
    const sheet = await opened(page, 'explain-day')
    const anim = await sheet.evaluate((e) => {
      const s = getComputedStyle(e)
      return { name: s.animationName, duration: parseFloat(s.animationDuration) }
    })
    expect(anim.name).toBe('sheet-in')
    expect(anim.duration).toBeLessThanOrEqual(0.15)
    await closeWithEsc(page, 'explain-day')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByTestId('day-score').click()
    expect(await (await opened(page, 'explain-day')).evaluate((e) => getComputedStyle(e).animationName)).toBe('none')
  })
})

// Build-out item 1.5.2b: the Panel look (direction B, instrument panel). The same numbers as
// Journal, as tiles and rings. The ring shows the best estimate only, as a share of a target the
// person set, and never looks surer than the day is.
test.describe('the Panel look in detail', () => {
  test.beforeEach(async ({ page }) => {
    await startInLook(page, 'panel')
  })

  async function setKcalTarget(page: Page, value: string) {
    await page.getByTestId('open-more').click()
    await (await opened(page, 'more-menu')).getByTestId('more-targets').click()
    const sheet = await opened(page, 'targets-sheet')
    await sheet.getByTestId('target-kcal-input').fill(value)
    await sheet.getByTestId('save-targets').click()
    await expect(sheet).toBeHidden()
  }

  async function toIncompleteDay(page: Page) {
    for (let i = 0; i < 7 && (await page.getByTestId('day-status').count()) === 0; i += 1) {
      await page.getByTestId('day-prev').click()
    }
    await expect(page.getByTestId('day-status')).toContainText('Known meals only — incomplete day')
  }

  test('the headline sits in a target ring showing the best estimate as a share of the target, with ranges and score beside it', async ({
    page,
  }) => {
    await openDemo(page)
    const ring = page.getByTestId('target-ring')
    // 2,280 of Sam's 2,400 kcal target is 95%: the ring is filled that far, and says so in words.
    await expect(ring).toHaveAttribute('data-fill', '95')
    await expect(ring.locator('svg')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.getByTestId('ring-words')).toHaveText('95% of 2,400 kcal daily target')
    await expect(page.getByTestId('ring-note')).toHaveText('The ring shows the best estimate only.')
    expect(await digits(ring.getByTestId('headline-kcal'))).toBe(G11.kcal)

    // Both ranges and the score sit beside the ring, each one tap from its explanation.
    const ringBox = (await ring.boundingBox())!
    for (const id of ['likely-range', 'very-likely-range', 'day-score']) {
      expect((await page.getByTestId(id).boundingBox())!.x, id).toBeGreaterThan(ringBox.x + ringBox.width - 1)
    }
    await expect(page.getByTestId('ranges')).toHaveAccessibleName(/Likely 1,870–2,780 kcal Very likely 1,684–3,087 kcal/)
    await page.getByTestId('very-likely-range').click()
    expect(await digits((await opened(page, 'explain-ranges')).getByTestId('explain-very-likely'))).toContain(G11.veryLikely)
    await closeWithEsc(page, 'explain-ranges')

    // The headline is still the largest number on the screen.
    const size = (sel: string) => page.locator(sel).first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
    const headline = await size('.headline-number')
    for (const sel of ['.range-value', '.macro-value', '.meal-kcal', '.score-btn']) expect(headline, sel).toBeGreaterThan(await size(sel))
  })

  test('with no calorie target the ring is not filled, says "No target" and opens the targets editor; over the target it says the real share', async ({
    page,
  }) => {
    await openDemo(page)
    await setKcalTarget(page, '')
    const ring = page.getByTestId('target-ring')
    await expect(ring).toHaveAttribute('data-fill', 'none')
    await expect(ring.locator('.ring-fill')).toHaveCount(0)
    await expect(page.getByTestId('ring-words')).toHaveText('No target')
    await expect(page.getByTestId('ring-note')).toHaveCount(0)
    // The numbers are all still there.
    expect(await digits(page.getByTestId('headline-kcal'))).toBe(G11.kcal)
    expect(await digits(page.getByTestId('likely-range'))).toContain(G11.likely)

    await page.getByTestId('ring-set-target').click()
    const sheet = await opened(page, 'targets-sheet')
    await expect(sheet.getByTestId('target-kcal-input')).toHaveValue('')
    await sheet.getByTestId('target-kcal-input').fill('2000')
    await sheet.getByTestId('save-targets').click()
    await expect(sheet).toBeHidden()

    // 2,280 of 2,000 is 114%: the ring is full, and the words never hide going over.
    await expect(ring).toHaveAttribute('data-fill', '100')
    await expect(page.getByTestId('ring-words')).toHaveText('114% of 2,000 kcal daily target')
    await expect(page.getByTestId('ring-set-target')).toHaveCount(0)
  })

  test('an incomplete day and a day with no known calories never fill the ring, and say why in words', async ({ page }) => {
    await openDemo(page)
    await toIncompleteDay(page)
    const ring = page.getByTestId('target-ring')
    await expect(ring).toHaveAttribute('data-fill', 'none')
    await expect(ring.locator('.ring-fill')).toHaveCount(0)
    await expect(page.locator('.headline-label')).toHaveText('Calories, known meals only')
    await expect(page.getByTestId('ring-words')).toHaveText('Target 2,400')
    await expect(page.getByTestId('ring-known-only')).toHaveText('The ring is not filled until every meal has calories.')
    await expect(page.getByTestId('ranges-known-only')).toHaveText('These ranges cover the known meals only.')
    await expect(page.getByTestId('unknown-count')).toHaveText('1 meal with unknown calories')
    expect(await digits(page.getByTestId('likely-range'))).toMatch(/\d+–\d+ kcal/)

    await page.getByTestId('day-today').click()
    await page.getByTestId('log-switch').click()
    await expect(page.getByTestId('empty-day')).toBeVisible()
    await expect(page.getByTestId('headline-kcal')).toHaveText('Not available yet')
    await expect(ring).toHaveAttribute('data-fill', 'none')
    await expect(page.getByTestId('ring-words')).toHaveText('No target')
    await expect(page.getByTestId('likely-range')).toContainText('Not available yet')
    await expect(page.getByTestId('day-score-na')).toHaveText('Estimate score: Not available yet')
    await expect(page.getByTestId('ring-set-target')).toBeVisible()
  })

  test('macros are mini rings, filled only when that macro has a target and no entry is missing', async ({ page }) => {
    await openDemo(page)
    // Protein 124 g of a 130 g target.
    const protein = page.getByTestId('macro-protein')
    expect(Number(await protein.getAttribute('data-fill'))).toBeCloseTo((124 * 100) / 130, 1)
    await expect(protein.getByTestId('macro-protein-target')).toHaveText('Target 130 g')
    for (const k of ['carbs', 'fat']) {
      await expect(page.getByTestId(`macro-${k}`)).toHaveAttribute('data-fill', 'none')
      await expect(page.getByTestId(`macro-${k}`).locator('.ring-fill')).toHaveCount(0)
      await expect(page.getByTestId(`macro-${k}-no-target`)).toHaveText('no target')
    }

    // An entry is missing its protein: the known total is only part of the day, so no fill.
    await toIncompleteDay(page)
    await expect(protein).toHaveAttribute('data-fill', 'none')
    await expect(protein).toContainText('1 entry missing')
    await expect(protein.getByTestId('macro-protein-target')).toHaveText('Target 130 g')
  })

  test('meal rows get a thin score bar and the score in words; amber marks only the biggest uncertainty, with its share', async ({
    page,
  }) => {
    await openDemo(page)
    const kefir = row(page, 'Kefir with oats and blueberries')
    await expect(kefir.getByRole('button')).toHaveCount(1)
    await expect(kefir.getByTestId('meal-score')).toHaveText('Estimate score 90')
    await expect(kefir.getByTestId('score-bar')).toHaveAttribute('aria-hidden', 'true')
    const bar = (await kefir.getByTestId('score-bar').boundingBox())!
    const fill = (await kefir.locator('.score-fill').boundingBox())!
    expect(fill.width / bar.width).toBeCloseTo(0.9, 2)
    await expect(kefir.locator('.score-fill')).toHaveCSS('background-color', 'rgb(47, 127, 122)')

    const pasta = row(page, 'Pasta bake (ready meal)')
    await expect(pasta.getByTestId('meal-score')).toHaveText('Estimate score 54 · biggest uncertainty')
    await expect(pasta.locator('.score-fill')).toHaveCSS('background-color', 'rgb(183, 121, 31)')
    await expect(pasta.getByRole('button')).toHaveAccessibleName(
      'Pasta bake (ready meal), 5:30 PM · Photo estimate, 760 kcal, Estimate score 54 · biggest uncertainty. Opens the meal details.',
    )
    // Amber on one row only.
    await expect(page.locator('.score-fill.biggest')).toHaveCount(1)
    await expect(page.locator('.meal-score.biggest')).toHaveCount(1)

    // The biggest-uncertainty tile: its share is the one the explanation already lists.
    await expect(page.getByTestId('biggest-line')).toHaveText('Most uncertainty comes from Pasta bake (ready meal).')
    const share = await page.getByTestId('biggest-share').innerText()
    expect(share).toMatch(/^\d+% of the day’s uncertainty$/)
    await expect(page.getByTestId('improve-entry')).toHaveAccessibleName('Improve that entry')
    const pastaId = await pasta.getAttribute('data-meal-id')
    await page.getByTestId('day-score').click()
    const explain = await opened(page, 'explain-day')
    const listed = await explain.locator(`[data-testid="contribution"][data-meal-id="${pastaId}"] .contrib-head .num`).innerText()
    expect(share.startsWith(`${listed} `)).toBe(true)
    await closeWithEsc(page, 'explain-day')

    // Tapping a row still opens the meal's details.
    await pasta.getByTestId('meal-score').click()
    await expect(page.getByTestId('meal-details').getByTestId('details-score')).toHaveText('Estimate score 54')
  })

  test('tiles are rounded with a light shadow; rings fill in and rows tilt when pressed, within 300 ms, and not under reduced motion', async ({
    page,
  }) => {
    await openDemo(page)
    const hero = page.locator('.panel-hero')
    await expect(hero).toHaveCSS('border-top-left-radius', '16px')
    expect(await hero.evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe('none')

    const ringFill = page.getByTestId('target-ring').locator('.ring-fill')
    const anim = await ringFill.evaluate((e) => {
      const s = getComputedStyle(e)
      return { name: s.animationName, duration: parseFloat(s.animationDuration), transition: parseFloat(s.transitionDuration) }
    })
    expect(anim.name).toBe('ring-in')
    expect(anim.duration).toBeGreaterThan(0)
    expect(anim.duration).toBeLessThanOrEqual(0.3)
    expect(anim.transition).toBeLessThanOrEqual(0.3)

    const kefir = row(page, 'Kefir with oats and blueberries').getByTestId('meal-open')
    expect(await kefir.evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration))).toBeLessThanOrEqual(0.3)
    const pressed = async () => {
      await kefir.scrollIntoViewIfNeeded()
      const box = (await kefir.boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      const transform = await kefir.evaluate((e) => getComputedStyle(e).transform)
      await page.mouse.up()
      await closeWithEsc(page, 'meal-details')
      return transform
    }
    expect(await pressed()).not.toBe('none')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.getByTestId('dashboard')).toBeVisible()
    expect(await ringFill.evaluate((e) => getComputedStyle(e).animationName)).toBe('none')
    expect(await ringFill.evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration))).toBe(0)
    expect(await pressed()).toBe('none')
  })

  test('a wide screen flows the tiles into two columns, and three on the widest; a phone never scrolls sideways', async ({ page }) => {
    await openDemo(page)
    const box = async (id: string) => (await page.getByTestId(id).boundingBox())!

    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    expect((await box('meal-list')).y).toBeGreaterThan((await box('target-ring')).y)

    // Two columns: the day on the left, the action bar, meals and sleep on the right.
    await page.setViewportSize({ width: 1100, height: 900 })
    const day2 = await box('dash-col-day')
    const list2 = await box('dash-col-list')
    expect(list2.x).toBeGreaterThan(day2.x + day2.width - 1)
    expect((await box('sleep-section')).y).toBeGreaterThan((await box('meal-list')).y)

    // Three columns: the day; the meals; sleep and the day controls.
    await page.setViewportSize({ width: 1440, height: 900 })
    const ring = await box('target-ring')
    const meals = await box('meal-list')
    const sleep = await box('sleep-section')
    expect(meals.x).toBeGreaterThan(ring.x + ring.width)
    expect(sleep.x).toBeGreaterThan(meals.x + meals.width)
    expect(Math.abs(sleep.y - meals.y)).toBeLessThan(80)
    expect((await box('day-nav')).y).toBeGreaterThan(sleep.y + sleep.height - 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
  })
})
