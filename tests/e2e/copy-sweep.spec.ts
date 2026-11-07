// spec.md > Screens > Copy checks: collect document.body.innerText (plus aria-label, title,
// placeholder and alt text) on every view and sheet, and apply the copy word rules
// (tests/wordRules.ts): "Estimate score" never "accuracy", "likely" never "for sure",
// "guarantee" only negated, no "exact" or "precise", no "gut health", and no leaked code values
// such as NaN, undefined or null where "unknown" belongs.
//
// Notices covered: a log from a newer version, an unreadable log (both with "export still
// works"), and "Can't save" when storage refuses writes, in the demo and in your own log.
//
// The people here are the fictional Sam: the demo week (fixtures/demo-week.json), the frozen
// own log fixtures/saved/v1-mine.json and the tracker export fixtures/tracker-bundle-sam.json.
//
// Build-out item 1.5.2: the whole sweep runs once in each look this build offers (looks.ts), as
// each look may draw different words around the same numbers.
//
// Build-out item 2.3: Save as a usual meal, Log a meal's Recent and Saved with the amount, the
// Logged line with Undo, and the Saved meals sheet, each with its messages.
//
// Build-out item 2.5a: Log a workout with its messages, the net headline, eaten's and burned's
// details, a workout's details and delete confirmation, the net explanation, and a workout with
// unknown calories.
//
// Build-out item 2.5b: the line inviting body details (demo and own log), Body details with its
// messages, the estimated deficit or surplus under the eaten and the net headline, its
// explanation, the lines for a day with no wake time and with no known calories, and Body details
// in Profile and privacy.
// Build-out item 2.4: the dashboard's weight, Log weight with its messages, the weight details in
// kg and lb, editing a weigh-in (one with no recorded time too) and its delete confirmation.
//
// Build-out item 2.6: the gym log. Log a workout with Add gym sets, Log a gym session with its
// messages, Copy last session and Undo after Remove exercise, the dashboard's gym summary, a workout's sets in its details,
// the gym log empty, with a search and with no match, and Remove gym sets.
//
// Build-out item 2.7: the week view and every average's breakdown, in the demo (today and an
// earlier day) and in your own log (every kind of entry, no weigh-in in the week, and empty).
//
// Build-out item 2.9: each macro's detail (with a target, without one, and with a meal missing its
// value), the sleep details (today, an earlier day, and asleep), the foods stored on a meal and its
// lookup, the eaten detail with the target, and the meal score opened from its row.
//
// Build-out item 2.8: the timeline in 3 and 4 days with the usual day length set, a sleep going on
// and an earlier day in the demo, Reset demo naming the usual day length, your own log with every
// kind of entry, and a log with no wake time yet.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { SOURCES } from '../../src/kernel/sources'
import { copy } from '../../src/ui/copy'
import { wordRuleHits } from '../wordRules'
import { LOOKS, startInLook } from './looks'
import { E2E_KEYS } from './storage-keys'
import { samWednesday } from './tapLog'
import { samWeek } from './weekLog'

const V1_MINE = readFileSync(fileURLToPath(new URL('../../fixtures/saved/v1-mine.json', import.meta.url)), 'utf8')
// Build-out item 2.1b: the fictional tracker export for Sam (invented foods, times and numbers).
const TRACKER = readFileSync(fileURLToPath(new URL('../../fixtures/tracker-bundle-sam.json', import.meta.url)), 'utf8')

// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock).
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')
// Sam's Wednesday 2026-10-28, 8 PM, in the own-log fixture.
const MINE_NOW = new Date('2026-10-28T20:00:00-04:00')

// Build-out item 2.4: Sam's golden weigh-ins, seen on Wed 2026-10-21 at 8 PM.
const WEIGHT_GOLDEN = JSON.parse(readFileSync(fileURLToPath(new URL('../../fixtures/golden-weight.json', import.meta.url)), 'utf8')) as {
  weighIns: { id: string; at: string; kg: number; unit: 'kg' | 'lb' }[]
}
const WEIGHT_NOW = new Date('2026-10-21T20:00:00-04:00')

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
      // About 45 views and sheets in one walk-through.
      test.setTimeout(180_000)
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

      // Build-out item 2.5a: Log a workout with its messages, the net headline, eaten's and burned's
      // details, a workout's details and its delete confirmation, the net explanation, and a
      // workout with unknown calories.
      await page.getByTestId('day-today').click()
      await page.getByTestId('log-workout').click()
      const workoutSheet = await opened(page, 'workout-sheet')
      await workoutSheet.getByTestId('workout-kcal-input').fill('300')
      await workoutSheet.getByTestId('workout-minutes-input').fill('0')
      await workoutSheet.getByTestId('workout-name-input').focus()
      await workoutSheet.getByTestId('workout-name-input').blur()
      await expect(workoutSheet.getByTestId('workout-source-hint')).toBeVisible()
      await expect(workoutSheet.getByTestId('workout-minutes-error')).toBeVisible()
      await sweep.take('log a workout, with its messages')
      await workoutSheet.getByTestId('workout-name-input').fill('Evening run')
      await workoutSheet.getByTestId('source-burn_guess').check()
      await workoutSheet.getByTestId('workout-minutes-input').fill('35')
      await expect(workoutSheet.getByTestId('workout-range-preview')).toBeVisible()
      await sweep.take('log a workout, filled in, with its ranges')
      await workoutSheet.getByTestId('save-workout').click()
      await expect(page.getByTestId('headline')).toHaveAttribute('data-mode', 'net')
      await sweep.take('demo dashboard with net calories')
      await page.getByTestId('ranges').click()
      await opened(page, 'explain-net')
      await sweep.take('net explanation')
      await closeWithEsc(page, 'explain-net')
      await page.getByTestId('headline-eaten').click()
      await opened(page, 'eaten-sheet')
      await sweep.take('eaten: the meals')
      await closeWithEsc(page, 'eaten-sheet')
      await page.getByTestId('headline-burned').click()
      const burnedSheet = await opened(page, 'workouts-sheet')
      await sweep.take('burned: the workouts')
      await burnedSheet.getByTestId('workout-open').first().click()
      const workoutDetails = await opened(page, 'workout-details')
      await sweep.take('workout details')
      await workoutDetails.getByTestId('delete-workout').click()
      await expect(workoutDetails.getByTestId('workout-delete-confirm')).toBeVisible()
      await sweep.take('workout delete confirmation')
      await workoutDetails.getByTestId('workout-delete-keep').click()
      await workoutDetails.getByTestId('edit-workout').click()
      await opened(page, 'workout-sheet')
      await sweep.take('edit workout')
      await closeWithEsc(page, 'workout-sheet')
      await page.getByTestId('log-workout').click()
      const unknownSheet = await opened(page, 'workout-sheet')
      await unknownSheet.getByTestId('workout-name-input').fill('Swim')
      await unknownSheet.getByTestId('save-workout').click()
      await expect(page.getByTestId('missing-workout')).toBeVisible()
      await sweep.take('net with a workout of unknown calories')
      await page.getByTestId('missing-workout').getByRole('button', { name: 'Swim' }).click()
      await expect((await opened(page, 'workout-details')).getByTestId('workout-unknown')).toBeVisible()
      await sweep.take('details of a workout with unknown calories')
      await closeWithEsc(page, 'workout-details')

      // Build-out item 2.1: Reset demo, after an edit (its confirmation), then its status line.
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

      sweep.check(43)
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

    test('the guest name (item 2.10): the header, Profile with Reroll and Rename, each Rename message, no name yet', async ({ page }) => {
      const sweep = new Sweep(page)
      await page.clock.setFixedTime(MINE_NOW)
      await page.goto('/')
      await page.getByTestId('start-mine').click()
      await expect(page.getByTestId('header-name')).toBeVisible()
      await sweep.take('own log header with its generated name')

      await page.getByTestId('open-profile').click()
      const panel = await opened(page, 'profile-privacy')
      await sweep.take('Profile and privacy with the guest name')
      await panel.getByTestId('guest-name-pick').click()
      await expect(panel.getByTestId('guest-name-undo')).toBeVisible()
      await sweep.take('after Reroll, with Undo')
      await panel.getByTestId('guest-name-undo').click()
      await sweep.take('after Undo')
      await panel.getByTestId('guest-name-rename').click()
      await sweep.take('Rename form')
      for (const typed of ['', 'SamTheLentilLover', 'Sam 2026', 'BraveKefir#4821', 'Sam_2026']) {
        await panel.getByTestId('guest-rename-input').fill(typed)
        await panel.getByTestId('guest-rename-save').click()
        await expect(panel.getByTestId('guest-rename-error')).toBeVisible()
        await sweep.take(`Rename refused: "${typed}"`)
      }
      await panel.getByTestId('guest-rename-input').fill('Sam2026')
      await panel.getByTestId('guest-rename-save').click()
      await sweep.take('after Rename')
      await chooseFile(page, 'howsure-log.json', JSON.stringify({ ...JSON.parse(V1_MINE), profile: { name: '', kind: 'guest' } }))
      await expect(panel.getByTestId('import-preview-name')).toBeVisible()
      await sweep.take('Import preview of a file with no name')
      await panel.getByTestId('import-cancel').click()
      await chooseFile(page, 'howsure-log.json', JSON.stringify({ ...JSON.parse(V1_MINE), profile: { name: 'Sam the lentil lover', kind: 'guest' } }))
      await expect(panel.getByTestId('import-preview-name')).toBeVisible()
      await sweep.take('Import preview of a file whose name can’t be used')
      await panel.getByTestId('import-cancel').click()
      await chooseFile(page, 'howsure-log.json', V1_MINE)
      await panel.getByTestId('import-confirm').click()
      await expect(panel.getByTestId('guest-name')).toHaveText('Sam')
      await chooseFile(page, 'howsure-log.json', V1_MINE)
      await expect(panel.getByTestId('import-preview-replaces')).not.toContainText('guest name')
      await sweep.take('Import preview of a file with the name you have')
      await panel.getByTestId('import-cancel').click()
      await panel.getByTestId('delete-data').click()
      await sweep.take('Delete confirmation, with the guest name')
      await panel.getByTestId('delete-data-confirm-btn').click()
      await expect(panel.getByTestId('guest-name')).toHaveText(/^[A-Z][a-z]+[A-Z][a-z]+#\d{4}$/)
      await expect(panel.getByTestId('guest-name-not-saved')).toBeVisible()
      await sweep.take('Profile after Delete my data, with a new name not saved yet')
      await closeWithEsc(page, 'profile-privacy')

      // A log saved before names existed has none yet.
      const unnamed = JSON.stringify({ ...JSON.parse(V1_MINE), profile: { name: '', kind: 'guest' } })
      await page.evaluate(([k, v]) => localStorage.setItem(k, v), [E2E_KEYS.mine, unnamed] as const)
      await page.reload()
      await page.getByTestId('open-profile').click()
      const unnamedPanel = await opened(page, 'profile-privacy')
      await expect(unnamedPanel.getByTestId('guest-name')).toHaveText(copy.guestName.none)
      await sweep.take('Profile with no name yet')
      await unnamedPanel.getByTestId('guest-name-rename').click()
      await unnamedPanel.getByTestId('guest-rename-save').click()
      await expect(unnamedPanel.getByTestId('guest-rename-error')).toBeVisible()
      await sweep.take('Rename refused with no name yet: empty')
      await unnamedPanel.getByTestId('guest-rename-cancel').click()
      await unnamedPanel.getByTestId('delete-data').click()
      await expect(unnamedPanel.getByTestId('delete-data-confirm')).not.toContainText('guest name')
      await sweep.take('Delete confirmation, with no guest name')
      await unnamedPanel.getByTestId('delete-data-keep').click()
      await closeWithEsc(page, 'profile-privacy')

      await page.getByTestId('log-switch').click()
      await expect(page.getByTestId('demo-name')).toBeVisible()
      await sweep.take('demo header with Sam’s fixed name')

      sweep.check(20)
    })

    test('body details and the estimated deficit or surplus, in the demo and in your own log', async ({ page }) => {
      test.setTimeout(120_000)
      const sweep = new Sweep(page)
      await page.clock.setFixedTime(DEMO_NOW)
      await page.goto('/')
      await page.getByRole('button', { name: 'Try the fictional demo' }).click()
      await expect(page.getByTestId('balance-invite')).toBeVisible()
      await sweep.take('demo dashboard, inviting body details')

      await page.getByTestId('balance-invite').click()
      const body = await opened(page, 'body-sheet')
      await sweep.take('Body details')
      await body.getByTestId('body-age-input').fill('17')
      await body.getByTestId('body-height-cm-input').fill('99')
      await body.getByTestId('body-weight-input').fill('20')
      await body.getByTestId('body-sex-unspecified').check()
      await sweep.take('Body details, with its messages')
      await body.getByTestId('body-height-unit-ftin').check()
      await body.getByTestId('body-height-in-input').fill('12')
      await body.getByTestId('body-weight-unit-lb').check()
      await sweep.take('Body details in feet, inches and pounds, with its messages')
      await body.getByTestId('body-age-input').fill('34')
      await body.getByTestId('body-height-ft-input').fill('5')
      await body.getByTestId('body-height-in-input').fill('6')
      await body.getByTestId('body-weight-input').fill('141')
      await body.getByTestId('body-activity-moderate').check()
      await body.getByTestId('save-body').click()
      await expect(page.getByTestId('balance')).toBeVisible()
      await sweep.take('demo dashboard with an estimated surplus')

      await page.getByTestId('balance').click()
      await opened(page, 'explain-balance')
      await sweep.take('deficit or surplus explanation, prefer not to say')
      await closeWithEsc(page, 'explain-balance')

      await page.getByTestId('day-prev').click()
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('balance')).toBeVisible()
      await sweep.take('an earlier day with net and an estimated deficit')
      await page.getByTestId('balance').click()
      await opened(page, 'explain-balance')
      await sweep.take('deficit or surplus explanation, an earlier day')
      await closeWithEsc(page, 'explain-balance')

      // Your own log, with no body details, then with them in Profile and privacy.
      await seedAndOpen(page, MINE_NOW, { [E2E_KEYS.mine]: V1_MINE, [E2E_KEYS.active]: 'mine' })
      await expect(page.getByTestId('balance-invite')).toBeVisible()
      await sweep.take('own log dashboard, inviting body details')
      await page.getByTestId('open-profile').click()
      const panel = await opened(page, 'profile-privacy')
      await panel.getByTestId('edit-body').click()
      const mine = await opened(page, 'body-sheet')
      await sweep.take('Body details in your own log')
      await mine.getByTestId('body-age-input').fill('34')
      await mine.getByTestId('body-sex-female').check()
      await mine.getByTestId('body-height-cm-input').fill('168')
      await mine.getByTestId('body-weight-input').fill('64')
      await mine.getByTestId('save-body').click()
      await expect(panel.getByTestId('privacy-body-summary')).toContainText('168 cm')
      await sweep.take('Profile and privacy with body details')
      await closeWithEsc(page, 'profile-privacy')
      await sweep.take('own log dashboard with an estimated deficit or surplus, known entries only')
      await page.getByTestId('balance').click()
      await opened(page, 'explain-balance')
      await sweep.take('deficit or surplus explanation, known entries only')
      await closeWithEsc(page, 'explain-balance')

      // A new own log with body details: no wake time yet, then a day with no known calories.
      await page.evaluate(() => localStorage.clear())
      await page.clock.setFixedTime(new Date('2026-11-05T10:00:00-05:00'))
      await page.reload()
      await page.getByRole('button', { name: 'Start my log' }).click()
      await page.getByTestId('open-more').click()
      await (await opened(page, 'more-menu')).getByTestId('more-body').click()
      const fresh = await opened(page, 'body-sheet')
      await fresh.getByTestId('body-age-input').fill('34')
      await fresh.getByTestId('body-sex-male').check()
      await fresh.getByTestId('body-height-cm-input').fill('180')
      await fresh.getByTestId('body-weight-input').fill('80')
      await fresh.getByTestId('save-body').click()
      // Nothing eaten yet: the headline says it is not available, and the line adds nothing.
      await expect(page.getByTestId('headline')).toBeVisible()
      await expect(page.getByTestId('balance-na')).toHaveCount(0)
      await expect(page.getByTestId('balance')).toHaveCount(0)
      await sweep.take('own log with body details and nothing logged yet')
      // A meal before any wake time: the day has nothing to count burn from, and says so.
      await page.getByTestId('log-meal').click()
      const meal = await opened(page, 'log-meal-sheet')
      await meal.getByTestId('meal-name-input').fill('Oat porridge')
      await meal.getByTestId('source-label').check()
      await meal.getByTestId('meal-kcal-input').fill('320')
      await meal.getByTestId('save-meal').click()
      await expect(meal).toBeHidden()
      await expect(page.getByTestId('balance-na')).toHaveText(copy.balance.needsWake)
      await sweep.take('own log with no wake time yet')

      sweep.check(15)
    })

    test('weight (build-out item 2.4): the dashboard, Log weight with its messages, the details, edit and delete', async ({ page }) => {
      const sweep = new Sweep(page)
      // Sam's golden weigh-ins (fixtures/golden-weight.json), one of them imported with no recorded time.
      const weighIns = WEIGHT_GOLDEN.weighIns.map((w) => ({ id: w.id, at: w.at, kg: w.kg, unit: w.unit }))
      weighIns[1] = { ...weighIns[1], at: '2026-10-02T12:00:00-04:00', timeApproximate: true, bodyFatPct: 22.1, note: 'From the old tracker' } as (typeof weighIns)[number]
      const log = { version: 1, kind: 'mine', profile: { name: '', kind: 'guest' }, meals: [], sleeps: [], workouts: [], plates: [], weighIns }
      await seedAndOpen(page, WEIGHT_NOW, { [E2E_KEYS.mine]: JSON.stringify(log), [E2E_KEYS.active]: 'mine' })
      await expect(page.getByTestId('weight-rate')).toBeVisible()
      await sweep.take('dashboard with a weight trend')

      await page.getByTestId('log-weight').click()
      const sheet = await opened(page, 'weigh-in-sheet')
      await sweep.take('Log weight')
      await sheet.getByTestId('weigh-in-weight').fill('abc')
      await sheet.getByTestId('weigh-in-body-fat').fill('120')
      await sheet.getByTestId('weigh-in-when').fill('2026-10-21T21:00')
      await expect(sheet.getByTestId('weigh-in-when-error')).toBeVisible()
      await sweep.take('Log weight, with its messages')
      await sheet.getByTestId('weigh-in-weight').fill('900')
      await sheet.getByTestId('weigh-in-unit-lb').check()
      await sweep.take('Log weight, out of range in lb')
      await closeWithEsc(page, 'weigh-in-sheet')

      await page.getByTestId('weight-open').click()
      const details = await opened(page, 'weight-details')
      await sweep.take('weight details')
      await details.getByTestId('weight-show-lb').check()
      await sweep.take('weight details in lb')
      await details.getByTestId('weigh-in-row').last().click()
      await opened(page, 'weigh-in-sheet')
      await sweep.take('edit a weigh-in')
      await page.keyboard.press('Escape')
      await opened(page, 'weight-details')
      await page.getByTestId('weigh-in-row').nth(8).click()
      const approx = await opened(page, 'weigh-in-sheet')
      await sweep.take('edit an imported weigh-in with no recorded time')
      await approx.getByTestId('weigh-in-delete').click()
      await expect(approx.getByTestId('weigh-in-delete-confirm')).toBeVisible()
      await sweep.take('weigh-in delete confirmation')
      await closeWithEsc(page, 'weigh-in-sheet')
      await closeWithEsc(page, 'weight-details')

      // An earlier day with no weigh-in, and a log whose trend still needs more.
      await seedAndOpen(page, WEIGHT_NOW, {
        [E2E_KEYS.mine]: JSON.stringify({ ...log, weighIns: weighIns.slice(8) }),
        [E2E_KEYS.active]: 'mine',
      })
      await sweep.take('dashboard, trend needs more weigh-ins')
      await page.getByTestId('weight-open').click()
      await opened(page, 'weight-details')
      await sweep.take('weight details, trend needs more weigh-ins')
      await closeWithEsc(page, 'weight-details')

      // An earlier day: the details say they stand at the end of it, and Log weight starts on it.
      const sleeps = [
        { id: 's1', sleepStart: '2026-10-18T23:00:00-04:00', wake: '2026-10-19T06:30:00-04:00' },
        { id: 's2', sleepStart: '2026-10-19T23:10:00-04:00', wake: '2026-10-20T07:00:00-04:00' },
        { id: 's3', sleepStart: '2026-10-20T23:20:00-04:00', wake: '2026-10-21T06:50:00-04:00' },
      ]
      await seedAndOpen(page, WEIGHT_NOW, { [E2E_KEYS.mine]: JSON.stringify({ ...log, sleeps }), [E2E_KEYS.active]: 'mine' })
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('weight-day')).toHaveText('No weigh-in that day')
      await sweep.take('dashboard, an earlier day with no weigh-in')
      await page.getByTestId('weight-open').click()
      const earlier = await opened(page, 'weight-details')
      await expect(earlier.getByTestId('weight-as-of')).toBeVisible()
      await sweep.take('weight details on an earlier day')
      await earlier.getByTestId('weight-details-log').click()
      await opened(page, 'weigh-in-sheet')
      await sweep.take('Log weight on an earlier day')
      await closeWithEsc(page, 'weigh-in-sheet')
      await closeWithEsc(page, 'weight-details')

      // Ten days after the last weigh-in: no 7-day average, today and on the earlier day.
      const later = new Date('2026-10-31T10:00:00-04:00')
      const laterSleeps = [...sleeps, { id: 's4', sleepStart: '2026-10-30T23:00:00-04:00', wake: '2026-10-31T07:00:00-04:00' }]
      await seedAndOpen(page, later, { [E2E_KEYS.mine]: JSON.stringify({ ...log, sleeps: laterSleeps }), [E2E_KEYS.active]: 'mine' })
      await expect(page.getByTestId('weight-average-value')).toBeVisible()
      await sweep.take('dashboard, no weigh-ins in the last 7 days')
      await page.getByTestId('weight-open').click()
      await opened(page, 'weight-details')
      await sweep.take('weight details, no weigh-ins in the last 7 days')
      await closeWithEsc(page, 'weight-details')
      await page.getByTestId('day-prev').click()
      await sweep.take('dashboard, an earlier day with no weigh-ins in its 7 days')
      await page.getByTestId('weight-open').click()
      await opened(page, 'weight-details')
      await sweep.take('weight details, an earlier day that ran on for days')
      await closeWithEsc(page, 'weight-details')

      // Six weigh-ins over two and a half days: the trend waits for a 4-day span.
      const burst = ['19T08:00', '19T18:00', '20T08:00', '20T18:00', '21T08:00', '21T18:00'].map((t, i) => ({
        id: `b${i}`,
        at: `2026-10-${t}:00-04:00`,
        kg: 80 + (i % 2),
        unit: 'kg',
      }))
      await seedAndOpen(page, WEIGHT_NOW, { [E2E_KEYS.mine]: JSON.stringify({ ...log, sleeps, weighIns: burst }), [E2E_KEYS.active]: 'mine' })
      await expect(page.getByTestId('weight-rate')).toHaveText(copy.weight.trendNeedsSpan)
      await sweep.take('dashboard, trend waits for a 4-day span')

      // A wake time corrected past this morning's weigh-in: the move warning lists it.
      await page.getByTestId('waking-day').click()
      const editor = await opened(page, 'sleep-editor')
      await editor.getByTestId('edit-wake-time-input').fill('8:30')
      await editor.getByTestId('edit-night-save').click()
      const warning = await opened(page, 'move-warning')
      await expect(warning.getByTestId('move-entry').filter({ hasText: 'weigh-in' }).first()).toBeVisible()
      await sweep.take('move warning with a weigh-in')

      sweep.check(20)
    })

    // Build-out item 2.1b: a tracker export (the fictional bundle for Sam), its preview, the
    // imported log with its wake days old, a joined day, an imported meal and its explanation.
    test('a tracker export: Import preview, the imported log and an imported meal', async ({ page }) => {
      test.setTimeout(90_000)
      const sweep = new Sweep(page)
      await page.clock.setFixedTime(new Date('2026-10-20T12:00:00-04:00'))
      await page.goto('/')
      await page.getByRole('button', { name: 'Start my log' }).click()
      await page.getByTestId('open-profile').click()
      const panel = await opened(page, 'profile-privacy')
      await chooseFile(page, 'tracker-v2.json', JSON.stringify({ ...JSON.parse(TRACKER), formatVersion: 2 }))
      await expect(panel.getByTestId('privacy-error')).toBeVisible()
      await sweep.take('tracker export refused')
      await chooseFile(page, 'tracker-bundle-sam.json', TRACKER)
      await expect(panel.getByTestId('import-preview-notes')).toBeVisible()
      await sweep.take('tracker Import preview')
      await panel.getByTestId('import-confirm').click()
      await expect(panel.getByTestId('privacy-status')).toBeVisible()
      await sweep.take('tracker imported')
      await closeWithEsc(page, 'profile-privacy')

      await expect(page.getByTestId('stale-wake')).toBeVisible()
      await sweep.take('imported log, last wake-up days old')
      await page.getByTestId('set-today-wake').click()
      await opened(page, 'sleep-sheet')
      await sweep.take('set today’s wake time')
      await closeWithEsc(page, 'sleep-sheet')

      for (let i = 0; i < 3; i += 1) await page.getByTestId('day-prev').click()
      await sweep.take('imported day with a date joined to it')
      await page.getByTestId('meal-row').filter({ hasText: 'Baked gnocchi' }).getByTestId('meal-open').click()
      const details = await opened(page, 'meal-details')
      await expect(details.getByTestId('details-imported')).toBeVisible()
      await sweep.take('imported meal details')
      await details.getByTestId('details-score').click()
      await opened(page, 'explain-meal')
      await sweep.take('imported meal score explanation')
      await closeWithEsc(page, 'explain-meal')
      await page.getByTestId('meal-row').filter({ hasText: 'Rice and beans' }).getByTestId('meal-open').click()
      await opened(page, 'meal-details')
      await sweep.take('imported meal with no source recorded')
      await closeWithEsc(page, 'meal-details')
      await page.getByTestId('day-score').click()
      await opened(page, 'explain-day')
      await sweep.take('imported day score explanation')
      await closeWithEsc(page, 'explain-day')

      // An empty current day whose latest meals are days back points at them.
      await page.getByTestId('open-profile').click()
      await opened(page, 'profile-privacy')
      const json = JSON.parse(TRACKER)
      json.meals = json.meals.filter((m: { data: { date: string } }) => m.data.date !== '2026-10-16')
      await chooseFile(page, 'tracker-bundle-sam.json', JSON.stringify(json))
      await page.getByTestId('import-confirm').click()
      await closeWithEsc(page, 'profile-privacy')
      await expect(page.getByTestId('latest-meal')).toBeVisible()
      await sweep.take('imported log, latest meals days back')

      sweep.check(11)
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

    test('the sleep and wake editor: the night, its messages, the move warning, deleting and a missed night', async ({ page }) => {
      // Build-out item 2.2, in the demo (Sam's week).
      const sweep = new Sweep(page)
      await page.clock.setFixedTime(DEMO_NOW)
      await page.goto('/')
      await page.getByRole('button', { name: 'Try the fictional demo' }).click()
      await page.getByTestId('waking-day').click()
      const editor = await opened(page, 'sleep-editor')
      await editor.getByTestId('edit-wake-time-input').fill('8')
      await sweep.take('sleep editor, with a time shown back')

      await editor.getByTestId('edit-wake-time-input').fill('4 am')
      await editor.getByTestId('edit-night-save').click()
      await expect(editor.getByTestId('edit-wake-error')).toBeVisible()
      await editor.getByTestId('edit-sleep-time-input').fill('later')
      await editor.getByTestId('edit-night-save').click()
      await expect(editor.getByTestId('edit-sleep-error')).toBeVisible()
      await sweep.take('sleep editor, with its order-check messages')

      await editor.getByTestId('edit-sleep-time-input').fill('4:35 am')
      await editor.getByTestId('edit-wake-time-input').fill('6 pm')
      await editor.getByTestId('edit-night-save').click()
      const warning = await opened(page, 'move-warning')
      await sweep.take('move warning')
      await warning.getByTestId('moves-back').click()

      await (await opened(page, 'sleep-editor')).getByTestId('delete-night').click()
      const del = await opened(page, 'delete-night-sheet')
      await sweep.take('delete a night')
      await del.getByTestId('delete-night-keep').click()

      await (await opened(page, 'sleep-editor')).getByTestId('editor-add-night').click()
      const add = await opened(page, 'sleep-editor')
      await expect(add.locator('.sheet-title')).toHaveText(copy.sleepEditor.titleAdd)
      await add.getByTestId('edit-night-save').click()
      await expect(add.getByTestId('edit-wake-error')).toBeVisible()
      await sweep.take('add a missed night, with its message')
      // A mistyped year: the demo's dates stop a day after its clock.
      await add.getByTestId('edit-wake-date-input').fill('2062-10-22')
      await add.getByTestId('edit-wake-time-input').fill('7')
      await add.getByTestId('edit-night-save').click()
      await expect(add.getByTestId('edit-wake-error')).toHaveText(copy.sleepEditor.errors.demoDateLimit('Fri Oct 23'))
      await sweep.take('add a missed night, past the demo’s dates')
      await closeWithEsc(page, 'sleep-editor')

      sweep.check(6)
    })

    test('the sleep editor and "I woke up" in your own log: a night since may be missing, and what moves', async ({ page }) => {
      // Build-out item 2.2, with the fictional Sam's own log: nights up to Tue 7:00 AM, now Wed 8:00 PM.
      const sweep = new Sweep(page)
      const meal = (id: string, name: string, eatenAt: string, kcal: number) => ({ id, name, eatenAt, source: 'label', kcal, protein: null, carbs: null, fat: null })
      const doc = {
        version: 1,
        kind: 'mine',
        profile: { name: '', kind: 'guest' },
        meals: [meal('a', 'Porridge', '2026-10-27T08:00:00-04:00', 300), meal('b', 'Rye toast', '2026-10-28T08:30:00-04:00', 220)],
        sleeps: [{ id: 'n1', sleepStart: '2026-10-26T23:30:00-04:00', wake: '2026-10-27T07:00:00-04:00' }],
        workouts: [{ id: 'w', name: 'Stretching', startedAt: '2026-10-28T07:30:00-04:00', minutes: 15, kcal: 40, source: 'burn_device' }],
        plates: [],
      }
      await seedAndOpen(page, MINE_NOW, { [E2E_KEYS.mine]: JSON.stringify(doc), [E2E_KEYS.active]: 'mine' })
      await page.getByTestId('waking-day').click()
      const editor = await opened(page, 'sleep-editor')
      await expect(editor.getByTestId('editor-missed-hint')).toBeVisible()
      await sweep.take('sleep editor, a night since may be missing')
      await closeWithEsc(page, 'sleep-editor')

      // Asleep since Tue 11:00 PM: "I woke up" at 7 AM moves the toast and the stretch to the new day.
      await seedAndOpen(page, MINE_NOW, {
        [E2E_KEYS.mine]: JSON.stringify({ ...doc, sleeps: [...doc.sleeps, { id: 'n2', sleepStart: '2026-10-27T23:00:00-04:00', wake: null }] }),
        [E2E_KEYS.active]: 'mine',
      })
      await page.getByTestId('sleep-action').click()
      const sheet = await opened(page, 'sleep-sheet')
      await sheet.getByTestId('sleep-time-input').fill('7')
      await expect(sheet.getByTestId('sleep-moves').getByTestId('move-entry')).toHaveCount(2)
      await sweep.take('"I woke up", with the entries that move')
      await closeWithEsc(page, 'sleep-sheet')

      sweep.check(2)
    })

    test('the gym log: its sheets, messages, summary and search (build-out item 2.6)', async ({ page }) => {
      const sweep = new Sweep(page)
      await page.clock.setFixedTime(DEMO_NOW)
      await page.goto('/')
      await page.getByRole('button', { name: 'Try the fictional demo' }).click()
      await expect(page.getByTestId('dashboard')).toBeVisible()

      await page.getByTestId('open-more').click()
      await page.getByTestId('more-gym').click()
      const empty = await opened(page, 'gym-log')
      await expect(empty.getByTestId('gym-log-none')).toBeVisible()
      await sweep.take('gym log, empty')

      await page.getByTestId('gym-log-new').click()
      let sheet = await opened(page, 'workout-sheet')
      await sweep.take('log a gym session')
      const ex = sheet.getByTestId('gym-exercise').first()
      const set = ex.getByTestId('gym-set').first()
      await ex.getByTestId('gym-exercise-name').focus()
      await set.getByTestId('gym-set-weight').fill('0')
      await set.getByTestId('gym-set-reps').focus()
      await set.getByTestId('gym-set-reps').blur()
      await expect(ex.getByTestId('gym-error')).toHaveCount(3)
      await expect(sheet.getByTestId('gym-fix-to-save')).toBeVisible()
      await sweep.take('log a gym session, with its messages')
      await sheet.getByTestId('workout-name-input').fill('Push')
      await ex.getByTestId('gym-exercise-name').fill('Bench press')
      await set.getByTestId('gym-set-kind').selectOption('drop')
      await set.getByTestId('gym-set-weight').fill('60')
      await set.getByTestId('gym-set-reps').fill('10')
      await set.getByTestId('gym-add-drop').click()
      await set.getByTestId('gym-drop-weight').fill('70')
      await set.getByTestId('gym-drop-reps').fill('6')
      await expect(set.getByTestId('gym-note')).toBeVisible()
      await sheet.getByTestId('gym-add-exercise').click()
      await sheet.getByTestId('gym-exercise').nth(1).getByTestId('gym-exercise-name').fill('Dips')
      await sheet.getByTestId('gym-exercise').nth(1).getByTestId('gym-set-reps').fill('12')
      await sweep.take('log a gym session, filled in, with a drop that is not lighter')
      await sheet.getByTestId('save-workout').click()
      await opened(page, 'gym-log')
      await sweep.take('gym log, one session')

      await page.getByTestId('gym-log-new').click()
      sheet = await opened(page, 'workout-sheet')
      await expect(sheet.getByTestId('gym-copy-last')).toBeVisible()
      await sweep.take('log a gym session, with Copy last session')
      await sheet.getByTestId('gym-copy-last').click()
      await sheet.getByTestId('gym-unit-lb').check()
      await sweep.take('log a gym session, copied, in lb')
      await sheet.getByTestId('gym-remove-exercise').first().click()
      await expect(sheet.getByTestId('gym-removed-exercise')).toBeVisible()
      await sweep.take('log a gym session, an exercise removed, with Undo')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('workout-sheet')).toHaveCount(0)

      const log = await opened(page, 'gym-log')
      await log.getByTestId('gym-search').fill('dip')
      await sweep.take('gym log, a search')
      await log.getByTestId('gym-search').fill('squat')
      await expect(log.getByTestId('gym-log-status')).toBeVisible()
      await sweep.take('gym log, no match')
      await log.getByTestId('gym-search').fill('')
      await log.getByTestId('gym-log-open').click()
      await opened(page, 'workout-details')
      await sweep.take('a gym session’s details, from the gym log')
      await closeWithEsc(page, 'workout-details')
      await closeWithEsc(page, 'gym-log')

      await expect(page.getByTestId('gym-summary')).toBeVisible()
      await sweep.take('dashboard with a gym session')
      await page.getByTestId('gym-summary-session').getByRole('button').click()
      await (await opened(page, 'workout-details')).getByTestId('edit-workout').click()
      sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('gym-remove').click()
      await expect(sheet.getByTestId('gym-removed')).toBeVisible()
      await sweep.take('edit a gym session, gym sets to be removed')
      await closeWithEsc(page, 'workout-sheet')

      await page.getByTestId('log-workout').click()
      await opened(page, 'workout-sheet')
      await expect(page.getByTestId('gym-add')).toBeVisible()
      await sweep.take('log a workout, with Add gym sets')
      await closeWithEsc(page, 'workout-sheet')

      sweep.check(14)
    })

    test('the week view and every breakdown (build-out item 2.7), in the demo and in your own log', async ({ page }) => {
      test.setTimeout(180_000)
      const sweep = new Sweep(page)

      /** The week, then each average's day-by-day breakdown. */
      async function sweepWeek(label: string) {
        await page.getByTestId('open-week').click()
        const week = await opened(page, 'week-view')
        await sweep.take(`${label}: the week`)
        const ids = await week.getByTestId('week-stat').evaluateAll((els) => els.map((e) => e.getAttribute('data-stat') as string))
        for (const id of ids) {
          await week.getByTestId(`week-row-${id}`).click()
          await opened(page, 'week-breakdown')
          await sweep.take(`${label}: the ${id} breakdown`)
          await closeWithEsc(page, 'week-breakdown')
        }
        await closeWithEsc(page, 'week-view')
        return ids.length
      }

      await page.clock.setFixedTime(DEMO_NOW)
      await page.goto('/')
      await page.getByRole('button', { name: 'Try the fictional demo' }).click()
      await expect(page.getByTestId('dashboard')).toBeVisible()
      const demoRows = await sweepWeek('demo')
      // An earlier day: the week ends there, with no day still going.
      await page.getByTestId('day-prev').click()
      await page.getByTestId('open-week').click()
      await opened(page, 'week-view')
      await sweep.take('demo: the week to an earlier day')
      await closeWithEsc(page, 'week-view')

      // Your own log with every kind of entry: weight, body fat, gym sets and the deficit or surplus too.
      await seedAndOpen(page, new Date('2026-10-21T20:00:00-04:00'), { [E2E_KEYS.mine]: JSON.stringify(samWeek()), [E2E_KEYS.active]: 'mine' })
      const mineRows = await sweepWeek('own log')
      // No weigh-in in these days, and an empty log: the rows say so in words.
      await seedAndOpen(page, new Date('2026-10-21T20:00:00-04:00'), {
        [E2E_KEYS.mine]: JSON.stringify({ ...samWeek(), weighIns: [{ id: 'old', at: '2026-10-01T07:10:00-04:00', kg: 72.5, unit: 'kg' }] }),
        [E2E_KEYS.active]: 'mine',
      })
      await page.getByTestId('open-week').click()
      await opened(page, 'week-view')
      await sweep.take('own log: the week with no weigh-in in it')
      await closeWithEsc(page, 'week-view')
      await seedAndOpen(page, new Date('2026-10-21T20:00:00-04:00'), {
        [E2E_KEYS.mine]: JSON.stringify({ version: 1, kind: 'mine', profile: { name: '', kind: 'guest' }, meals: [], sleeps: [], workouts: [], plates: [] }),
        [E2E_KEYS.active]: 'mine',
      })
      await page.getByTestId('open-week').click()
      await opened(page, 'week-view')
      await sweep.take('an empty log: the week')
      await closeWithEsc(page, 'week-view')
      sweep.check(demoRows + mineRows + 5)
    })

    test('the details every dashboard number opens (build-out item 2.9), in the demo and in your own log', async ({ page }) => {
      test.setTimeout(120_000)
      const sweep = new Sweep(page)
      await page.clock.setFixedTime(DEMO_NOW)
      await page.goto('/')
      await page.getByRole('button', { name: 'Try the fictional demo' }).click()
      await expect(page.getByTestId('dashboard')).toBeVisible()
      const macro = async (key: string) => {
        if (look === 'night' && !(await page.getByTestId('night-macros').isVisible())) await page.getByTestId('macro-chip').click()
        await page.getByTestId(`macro-${key}`).click()
        await opened(page, 'macro-details')
      }
      await macro('protein')
      await sweep.take('protein detail, with a target')
      await closeWithEsc(page, 'macro-details')
      await macro('carbs')
      await sweep.take('carbs detail, no target')
      await closeWithEsc(page, 'macro-details')
      await page.getByTestId(look === 'night' ? 'tl-wake' : 'sleep-section').getByTestId('last-night').click()
      await opened(page, 'sleep-details')
      await sweep.take('sleep details')
      await closeWithEsc(page, 'sleep-details')
      await page.getByTestId('meal-row').filter({ hasText: 'Kefir with oats and blueberries' }).getByTestId('meal-open').click()
      await expect((await opened(page, 'meal-details')).getByTestId('meal-foods')).toBeVisible()
      await sweep.take('meal details with its foods')
      await closeWithEsc(page, 'meal-details')
      await page.getByTestId('meal-row').filter({ hasText: 'Pasta bake (ready meal)' }).getByTestId('meal-score').click()
      await opened(page, 'explain-meal')
      await sweep.take('meal score explanation, from its row')
      await closeWithEsc(page, 'explain-meal')
      await page.getByTestId(look === 'panel' ? 'target-ring' : 'headline-open').click()
      await expect((await opened(page, 'eaten-sheet')).getByTestId('eaten-target-share')).toBeVisible()
      await sweep.take('eaten detail with the target')
      await closeWithEsc(page, 'eaten-sheet')
      await page.getByTestId('day-prev').click()
      await page.getByTestId('meal-row').filter({ hasText: 'Granola bar' }).getByTestId('meal-open').click()
      await expect((await opened(page, 'meal-details')).getByTestId('meal-lookup')).toBeVisible()
      await sweep.take('meal details with a saved lookup')
      await closeWithEsc(page, 'meal-details')
      await page.getByTestId(look === 'night' ? 'tl-wake' : 'sleep-section').getByTestId('last-night').click()
      await opened(page, 'sleep-details')
      await sweep.take('sleep details, an earlier day with a night not logged')
      await closeWithEsc(page, 'sleep-details')

      await seedAndOpen(page, new Date('2026-10-22T02:00:00-04:00'), {
        [E2E_KEYS.mine]: JSON.stringify(samWednesday(true)),
        [E2E_KEYS.active]: 'mine',
      })
      await macro('carbs')
      await sweep.take('carbs detail, a meal missing its value')
      await closeWithEsc(page, 'macro-details')
      await page.getByTestId(look === 'night' ? 'tl-wake' : 'sleep-section').getByTestId('last-night').click()
      await opened(page, 'sleep-details')
      await sweep.take('sleep details while asleep')
      await closeWithEsc(page, 'sleep-details')
      await page.getByTestId('meal-row').filter({ hasText: 'Cereal bar' }).getByTestId('meal-open').click()
      await opened(page, 'meal-details')
      await sweep.take('meal details with a lookup that has its grams and date')
      sweep.check(11)
    })

    test('the timeline (build-out item 2.8): 3 and 4 days, a sleep going on, your own log with every kind of entry, and no wake time yet', async ({ page }) => {
      test.setTimeout(120_000)
      const sweep = new Sweep(page)
      /** The timeline in 3 days, then 4, then the usual day length changed. */
      async function sweepTimeline(label: string) {
        await page.getByTestId('open-timeline').click()
        const t = await opened(page, 'timeline-view')
        await sweep.take(`${label}: the timeline, 3 days`)
        await t.getByTestId('timeline-span-4').check()
        await sweep.take(`${label}: the timeline, 4 days`)
        await t.getByTestId('timeline-usual').selectOption({ label: '15 h 30 min' })
        await sweep.take(`${label}: the timeline with the usual day length set`)
        await t.getByTestId('timeline-span-3').check()
        await closeWithEsc(page, 'timeline-view')
      }

      await page.clock.setFixedTime(DEMO_NOW)
      await page.goto('/')
      await page.getByRole('button', { name: 'Try the fictional demo' }).click()
      await expect(page.getByTestId('dashboard')).toBeVisible()
      await sweepTimeline('demo')
      // Reset demo now lists the usual day length among the changes.
      await page.getByTestId('open-more').click()
      await page.getByTestId('more-resetDemo').click()
      await opened(page, 'reset-demo-sheet')
      await sweep.take('demo: Reset demo with the usual day length changed')
      await closeWithEsc(page, 'reset-demo-sheet')
      // A sleep going on: the timeline's "so far".
      await page.getByTestId('sleep-action').click()
      const sleep = await opened(page, 'sleep-sheet')
      await sleep.getByTestId('sleep-time-input').fill('1:00 AM')
      await sleep.getByTestId('sleep-save').click()
      await expect(sleep).toBeHidden()
      await page.getByTestId('open-timeline').click()
      await opened(page, 'timeline-view')
      await sweep.take('demo: the timeline with a sleep going on')
      await closeWithEsc(page, 'timeline-view')
      // An earlier day.
      await page.getByTestId('day-prev').click()
      await page.getByTestId('open-timeline').click()
      await opened(page, 'timeline-view')
      await sweep.take('demo: the timeline to an earlier day')
      await closeWithEsc(page, 'timeline-view')

      // Your own log with every kind of entry: weigh-ins with body fat, a gym session, a workout and a meal with unknown calories.
      await seedAndOpen(page, new Date('2026-10-21T20:00:00-04:00'), { [E2E_KEYS.mine]: JSON.stringify(samWeek()), [E2E_KEYS.active]: 'mine' })
      await sweepTimeline('own log')
      // No wake time yet: the one day, listed and not drawn.
      await seedAndOpen(page, new Date('2026-10-21T20:00:00-04:00'), {
        [E2E_KEYS.mine]: JSON.stringify({
          version: 1, kind: 'mine', profile: { name: '', kind: 'guest' },
          meals: [{ id: 'm1', name: 'Toast', eatenAt: '2026-10-21T08:00:00-04:00', source: 'label', kcal: 200, protein: null, carbs: null, fat: null }],
          sleeps: [], workouts: [], plates: [],
        }),
        [E2E_KEYS.active]: 'mine',
      })
      await page.getByTestId('open-timeline').click()
      await opened(page, 'timeline-view')
      await sweep.take('own log with no wake time: the timeline')
      await closeWithEsc(page, 'timeline-view')
      sweep.check(10)
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
