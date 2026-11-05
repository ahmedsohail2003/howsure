// spec.md > Screens > Copy checks: collect document.body.innerText (plus aria-label, title,
// placeholder and alt text) on every view and sheet, and apply the copy word rules
// (tests/wordRules.ts): "Estimate score" never "accuracy", "likely" never "for sure",
// "guarantee" only negated, no "exact" or "precise", no "gut health", and no leaked code values
// such as NaN, undefined or null where "unknown" belongs.
//
// Notices covered: a log from a newer version, an unreadable log (both with "export still
// works"), and "Can't save" when storage refuses writes, in the demo and in your own log.
//
// The people here are the fictional Sam: the demo week (fixtures/demo-week.json) and the frozen
// own log fixtures/saved/v1-mine.json.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { SOURCES } from '../../src/kernel/sources'
import { copy } from '../../src/ui/copy'
import { wordRuleHits } from '../wordRules'
import { E2E_KEYS } from './storage-keys'

const V1_MINE = readFileSync(fileURLToPath(new URL('../../fixtures/saved/v1-mine.json', import.meta.url)), 'utf8')

// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock).
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')
// Sam's Wednesday 2026-10-28, 8 PM, in the own-log fixture.
const MINE_NOW = new Date('2026-10-28T20:00:00-04:00')

/** Study titles may say "accuracy" (spec.md > Screens > Copy checks). */
const STUDY_TITLES = Object.values(SOURCES).flatMap((s) => (s.basis.cite ? [s.basis.cite] : []))

/** Collects the text of each view it is shown, then checks all of it against the word rules. */
class Sweep {
  readonly views: string[] = []
  readonly hits: string[] = []

  constructor(private readonly page: Page) {}

  async take(view: string) {
    // Open every "More detail" so its text is read too.
    const text = await this.page.evaluate(() => {
      for (const d of document.querySelectorAll('details')) d.open = true
      const parts = [document.title, document.body.innerText]
      for (const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')) {
        for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
          const v = el.getAttribute(a)
          if (v) parts.push(v)
        }
      }
      return parts.join('\n')
    })
    expect(text.trim().length, `${view} shows some text`).toBeGreaterThan(0)
    this.views.push(view)
    for (const h of wordRuleHits(text, STUDY_TITLES)) this.hits.push(`${view}: ${h.rule}: "${h.match}" in "…${h.context}…"`)
  }

  check(minViews: number) {
    expect(this.views.length, `views swept: ${this.views.join(', ')}`).toBeGreaterThanOrEqual(minViews)
    expect(this.hits).toEqual([])
  }
}

async function opened(page: Page, testId: string) {
  const sheet = page.getByTestId(testId)
  await expect(sheet).toBeVisible()
  return sheet
}

async function closeWithEsc(page: Page, testId: string) {
  await page.keyboard.press('Escape')
  await expect(page.getByTestId(testId)).toHaveCount(0)
}

async function seedAndOpen(page: Page, now: Date, items: Record<string, string>) {
  await page.clock.setFixedTime(now)
  await page.goto('/')
  await page.evaluate((entries) => {
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v)
  }, items)
  await page.reload()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function chooseFile(page: Page, name: string, text: string) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('import-data').click()])
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) })
}

test.describe('copy sweep: the word rules hold on every view and sheet', () => {
  test('the first-open screen and the whole demo', async ({ page }) => {
    // About 30 views and sheets in one walk-through.
    test.setTimeout(120_000)
    const sweep = new Sweep(page)
    await page.clock.setFixedTime(DEMO_NOW)
    await page.goto('/')
    await expect(page.getByTestId('first-open')).toBeVisible()
    await sweep.take('first open')

    await page.getByRole('button', { name: 'Try the fictional demo' }).click()
    await expect(page.getByTestId('dashboard')).toBeVisible()
    await sweep.take('demo dashboard')

    await page.getByTestId('day-score').click()
    await opened(page, 'explain-day')
    await sweep.take('day score explanation')
    await closeWithEsc(page, 'explain-day')

    await page.getByTestId('likely-range').click()
    await opened(page, 'explain-ranges')
    await sweep.take('ranges explanation')
    await closeWithEsc(page, 'explain-ranges')

    const pasta = page.getByTestId('meal-row').filter({ hasText: 'Pasta bake (ready meal)' })
    await pasta.getByTestId('meal-score').click()
    await opened(page, 'explain-meal')
    await sweep.take('meal score explanation')
    await closeWithEsc(page, 'explain-meal')

    await pasta.getByTestId('meal-open').click()
    const details = await opened(page, 'meal-details')
    await sweep.take('meal details')
    await details.getByTestId('delete-meal').click()
    await expect(details.getByTestId('delete-confirm')).toBeVisible()
    await sweep.take('meal delete confirmation')
    await details.getByTestId('delete-keep').click()
    await details.getByTestId('edit-meal').click()
    await opened(page, 'log-meal-sheet')
    await sweep.take('edit meal')
    await closeWithEsc(page, 'log-meal-sheet')

    await page.getByTestId('improve-entry').click()
    const improve = await opened(page, 'log-meal-sheet')
    await expect(improve.getByTestId('edit-preview')).toBeVisible()
    await sweep.take('improve that entry, with the before/after preview')
    await closeWithEsc(page, 'log-meal-sheet')

    await page.getByTestId('log-meal').click()
    const logSheet = await opened(page, 'log-meal-sheet')
    await logSheet.getByTestId('meal-kcal-input').fill('abc')
    await expect(logSheet.getByTestId('kcal-error')).toBeVisible()
    await sweep.take('log a meal, with its messages')
    await closeWithEsc(page, 'log-meal-sheet')

    await page.getByTestId('sleep-action').click()
    await opened(page, 'sleep-sheet')
    await sweep.take('sleep sheet')
    await closeWithEsc(page, 'sleep-sheet')

    await page.getByTestId('open-more').click()
    const menu = await opened(page, 'more-menu')
    await sweep.take('More menu')
    await menu.getByTestId('more-targets').click()
    const targets = await opened(page, 'targets-sheet')
    await targets.getByTestId('target-kcal-input').fill('-5')
    await expect(targets.getByTestId('target-kcal-error')).toBeVisible()
    await sweep.take('targets editor, with its message')
    await targets.getByTestId('cancel-targets').click()
    await expect(page.getByTestId('targets-sheet')).toHaveCount(0)

    await page.getByTestId('open-more').click()
    await (await opened(page, 'more-menu')).getByTestId('more-fullScreen').click()
    await expect(page.getByTestId('full-screen-exit')).toBeVisible()
    await sweep.take('full-screen view')
    await page.getByTestId('full-screen-exit').click()
    await expect(page.getByTestId('full-screen-exit')).toHaveCount(0)

    // Every earlier day of the week, and the details of a meal with unknown calories.
    let openedUnknown = false
    for (let i = 0; i < 8 && (await page.getByTestId('day-prev').isEnabled()); i += 1) {
      await page.getByTestId('day-prev').click()
      await sweep.take(`demo day -${i + 1}`)
      const unknownRow = page.getByTestId('meal-row').filter({ has: page.locator('.meal-kcal.unknown') })
      if (!openedUnknown && (await unknownRow.count()) > 0) {
        await unknownRow.first().getByTestId('meal-open').click()
        await expect((await opened(page, 'meal-details')).getByTestId('details-unknown')).toBeVisible()
        await sweep.take('details of a meal with unknown calories')
        await closeWithEsc(page, 'meal-details')
        openedUnknown = true
      }
    }
    expect(openedUnknown, 'the demo week has a meal with unknown calories').toBe(true)

    sweep.check(20)
  })

  test('your own log: dashboard, Profile and privacy, Delete and Import', async ({ page }) => {
    const sweep = new Sweep(page)
    await seedAndOpen(page, MINE_NOW, { [E2E_KEYS.mine]: V1_MINE, [E2E_KEYS.active]: 'mine' })
    await sweep.take('own log dashboard')

    await page.getByTestId('open-profile').click()
    const panel = await opened(page, 'profile-privacy')
    await sweep.take('Profile and privacy')

    await panel.getByTestId('delete-data').click()
    await expect(panel.getByTestId('delete-data-confirm')).toBeVisible()
    await sweep.take('Delete confirmation')
    await panel.getByTestId('delete-data-keep').click()

    await chooseFile(page, 'howsure-log.json', V1_MINE)
    await expect(panel.getByTestId('import-preview')).toBeVisible()
    await sweep.take('Import preview')
    await panel.getByTestId('import-cancel').click()

    await chooseFile(page, 'notes.json', 'meals: oats')
    await expect(panel.getByTestId('import-preview')).toHaveCount(0)
    await sweep.take('Import refused')
    await closeWithEsc(page, 'profile-privacy')

    sweep.check(5)
  })

  test('an empty own log', async ({ page }) => {
    const sweep = new Sweep(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Start empty' }).click()
    await expect(page.getByTestId('empty-day')).toBeVisible()
    await sweep.take('empty own log')

    await page.getByTestId('sleep-action').click()
    await opened(page, 'sleep-sheet')
    await sweep.take('sleep sheet in an empty log')
    await closeWithEsc(page, 'sleep-sheet')

    sweep.check(2)
  })

  test('the saved-log notices: newer version and unreadable', async ({ page }) => {
    const sweep = new Sweep(page)
    await seedAndOpen(page, MINE_NOW, {
      [E2E_KEYS.mine]: JSON.stringify({ ...JSON.parse(V1_MINE), version: 99 }),
      [E2E_KEYS.active]: 'mine',
    })
    await expect(page.getByTestId('storage-newer')).toBeVisible()
    await expect(page.getByTestId('storage-export-still-works')).toBeVisible()
    await sweep.take('log from a newer version')

    await seedAndOpen(page, MINE_NOW, { [E2E_KEYS.mine]: '{"version": 1, "meals": "oats"', [E2E_KEYS.active]: 'mine' })
    await expect(page.getByTestId('storage-unreadable')).toBeVisible()
    await expect(page.getByTestId('storage-export-still-works')).toBeVisible()
    await sweep.take('unreadable saved log')

    sweep.check(2)
  })

  test('the "Can\'t save" notice: storage refusing writes, in the demo and in your own log', async ({ page }) => {
    // The device won't save (full or blocked); the app keeps working in memory and says so.
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      }
    })
    const sweep = new Sweep(page)
    await page.clock.setFixedTime(DEMO_NOW)
    await page.goto('/')
    await expect(page.getByTestId('first-open')).toBeVisible()
    await expect(page.getByTestId('storage-blocked')).toHaveText(copy.storage.blocked)
    await sweep.take('first open, storage blocked')

    await page.getByRole('button', { name: 'Try the fictional demo' }).click()
    await expect(page.getByTestId('dashboard')).toBeVisible()
    await expect(page.getByTestId('storage-blocked')).toBeVisible()
    await sweep.take('demo, storage blocked')

    await page.reload()
    await page.getByRole('button', { name: 'Start empty' }).click()
    await expect(page.getByTestId('empty-day')).toBeVisible()
    // In your own log the notice also points to Export.
    await expect(page.getByTestId('storage-blocked')).toHaveText(`${copy.storage.blocked} ${copy.storage.exportToKeep}`)
    await sweep.take('own log, storage blocked')

    await page.getByTestId('open-profile').click()
    await opened(page, 'profile-privacy')
    await sweep.take('Profile and privacy, storage blocked')
    await closeWithEsc(page, 'profile-privacy')

    sweep.check(4)
  })
})
