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
//
// Build-out item 1.5.2: the whole sweep runs once in each look this build offers (looks.ts), as
// each look may draw different words around the same numbers.
//
// Build-out item 2.3: Save as a usual meal, Log a meal's Recent and Saved with the amount, the
// Logged line with Undo, and the Saved meals sheet, each with its messages.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { SOURCES } from '../../src/kernel/sources'
import { copy } from '../../src/ui/copy'
import { wordRuleHits } from '../wordRules'
import { LOOKS, startInLook } from './looks'
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

for (const { id: look, name: lookName } of LOOKS) {
  test.describe(`copy sweep in the ${lookName} look: the word rules hold on every view and sheet`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

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
      await pasta.getByTestId('meal-open').click()
      await (await opened(page, 'meal-details')).getByTestId('details-score').click()
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

      // Build-out item 2.3: Save as a usual meal, Recent and Saved with the amount, Logged with
      // Undo, and the Saved meals sheet with its messages.
      await page.getByTestId('meal-row').filter({ hasText: 'Chicken, rice and broccoli' }).getByTestId('meal-open').click()
      const chicken = await opened(page, 'meal-details')
      await chicken.getByTestId('save-usual-open').click()
      await chicken.getByTestId('save-usual-name').fill('')
      await chicken.getByTestId('save-usual-confirm').click()
      await expect(chicken.getByTestId('save-usual-error')).toBeVisible()
      await sweep.take('save as a usual meal, with its message')
      await chicken.getByTestId('save-usual-name').fill('Usual chicken bowl')
      await chicken.getByTestId('save-usual-confirm').click()
      await expect(chicken.getByTestId('saved-as')).toBeVisible()
      await sweep.take('saved as a usual meal')
      await closeWithEsc(page, 'meal-details')
      await page.getByTestId('log-meal').click()
      const quick = await opened(page, 'log-meal-sheet')
      await quick.getByTestId('amount-1.5').check()
      await expect(quick.getByTestId('quick-times').first()).toBeVisible()
      await sweep.take('log a meal: Recent, Saved and the amount')
      await quick.getByTestId('amount-other').check()
      await expect(quick.getByTestId('amount-needed')).toBeVisible()
      await sweep.take('log a meal: Other, still blank, with its hint')
      await quick.getByTestId('amount-other-input').fill('0')
      await expect(quick.getByTestId('amount-error')).toBeVisible()
      await sweep.take('log a meal: a typed amount, with its message')
      await quick.getByTestId('amount-1').check()
      await quick.getByTestId('quick-saved').getByTestId('quick-log-item').first().click()
      await expect(page.getByTestId('status-undo')).toBeVisible()
      await sweep.take('Logged, with Undo')
      await page.getByTestId('status-undo').click()
      await expect(page.getByTestId('status-undo')).toHaveCount(0)
      await sweep.take('after Undo')
      await page.getByTestId('open-more').click()
      await (await opened(page, 'more-menu')).getByTestId('more-savedMeals').click()
      const savedSheet = await opened(page, 'saved-meals-sheet')
      await sweep.take('Saved meals')
      await savedSheet.getByTestId('saved-rename').click()
      await savedSheet.getByTestId('saved-rename-input').fill('')
      await savedSheet.getByTestId('saved-rename-save').click()
      await expect(savedSheet.getByTestId('saved-rename-error')).toBeVisible()
      await sweep.take('Saved meals: rename, with its message')
      await savedSheet.getByTestId('saved-rename-cancel').click()
      await savedSheet.getByTestId('saved-delete').click()
      await expect(savedSheet.getByTestId('saved-delete-confirm')).toBeVisible()
      await sweep.take('Saved meals: delete confirmation')
      await savedSheet.getByTestId('saved-delete-keep').click()
      await closeWithEsc(page, 'saved-meals-sheet')

      await page.getByTestId('sleep-action').click()
      await opened(page, 'sleep-sheet')
      await sweep.take('sleep sheet')
      await closeWithEsc(page, 'sleep-sheet')

      await page.getByTestId('open-more').click()
      const menu = await opened(page, 'more-menu')
      await sweep.take('More menu')
      await menu.getByTestId('more-look').click()
      await opened(page, 'look-sheet')
      await sweep.take('Look sheet')
      await closeWithEsc(page, 'look-sheet')
      await page.getByTestId('open-more').click()
      await (await opened(page, 'more-menu')).getByTestId('more-targets').click()
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

      // Build-out item 2.1: Reset demo, after an edit (its confirmation), then its status line.
      await page.getByTestId('day-today').click()
      await page.getByTestId('meal-row').filter({ hasText: 'Lentil soup' }).getByTestId('meal-open').click()
      const soup = await opened(page, 'meal-details')
      await soup.getByTestId('delete-meal').click()
      await soup.getByTestId('delete-confirm-btn').click()
      await page.getByTestId('open-more').click()
      await (await opened(page, 'more-menu')).getByTestId('more-resetDemo').click()
      const reset = await opened(page, 'reset-demo-sheet')
      await sweep.take('Reset demo confirmation')
      await reset.getByTestId('reset-demo-confirm').click()
      await expect(page.getByTestId('status-note')).toHaveText(copy.resetDemo.done)
      await sweep.take('demo after Reset demo')

      sweep.check(31)
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

    test('an empty own log, Set wake time and the regroup preview', async ({ page }) => {
      const sweep = new Sweep(page)
      await page.clock.setFixedTime(new Date('2026-11-05T10:00:00-05:00'))
      await page.goto('/')
      await page.getByRole('button', { name: 'Start my log' }).click()
      await expect(page.getByTestId('empty-day')).toBeVisible()
      await sweep.take('empty own log')

      await page.getByTestId('sleep-action').click()
      await opened(page, 'sleep-sheet')
      await sweep.take('sleep sheet in an empty log')
      await closeWithEsc(page, 'sleep-sheet')

      // Build-out item 2.1: Set wake time, with its message for a time later than now.
      await page.getByTestId('set-wake').click()
      const wake = await opened(page, 'set-wake-sheet')
      await sweep.take('Set wake time')
      await wake.getByTestId('set-wake-time').fill('11:30')
      await wake.getByTestId('set-wake-save').click()
      await expect(wake.getByTestId('set-wake-error')).toBeVisible()
      await sweep.take('Set wake time, with its message')
      await closeWithEsc(page, 'set-wake-sheet')

      // A meal logged before the wake time is set, then the regroup preview.
      await page.getByTestId('log-meal').click()
      const logSheet = await opened(page, 'log-meal-sheet')
      // Build-out item 2.3: nothing to log again yet, so the sheet opens on the form alone.
      await expect(logSheet.getByTestId('meal-name-input')).toBeVisible()
      await expect(logSheet.getByTestId('quick-log')).toHaveCount(0)
      await sweep.take('log a meal in an empty log')
      await logSheet.getByTestId('meal-name-input').fill('Rice cake')
      await logSheet.getByTestId('source-label').check()
      await logSheet.getByTestId('meal-kcal-input').fill('35')
      await logSheet.getByTestId('save-meal').click()
      await expect(page.getByTestId('log-meal-sheet')).toHaveCount(0)
      await page.getByTestId('set-wake').click()
      await (await opened(page, 'set-wake-sheet')).getByTestId('set-wake-save').click()
      await opened(page, 'regroup-preview')
      await sweep.take('regroup preview')
      await closeWithEsc(page, 'regroup-preview')

      sweep.check(6)
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
      await page.getByRole('button', { name: 'Start my log' }).click()
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
}
