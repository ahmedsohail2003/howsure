// Build-out item 1.2: Export, Import and Delete for your own log, from Profile and privacy
// (prd.md > Privacy Panel, spec.md > Store > Export / Delete).
// Done when: export, delete, import returns the identical log, and it survives a reload.
//
// Expected values are written by hand from the frozen fixture fixtures/saved/v1-mine.json
// (fictional Sam): 6 meals, 3 sleep records, 1 workout, 1 plate, guest name "Sam", times from
// Wed 2026-10-28 07:40 to Tue 2026-11-03 18:30 Toronto time.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { E2E_KEYS } from './storage-keys'

const fixturePath = (name: string) => fileURLToPath(new URL(`../../fixtures/saved/${name}`, import.meta.url))
const V1_MINE = readFileSync(fixturePath('v1-mine.json'), 'utf8')
const V1_DEMO = readFileSync(fixturePath('v1-demo.json'), 'utf8')

// Sam's Wednesday 2026-10-28, 8 PM: woke 07:40 (fixtures/saved/v1-mine.json).
const MINE_NOW = new Date('2026-10-28T20:00:00-04:00')
const FILE_NAME = 'howsure-log-2026-10-28.json'
const SAM_MEALS = ['Oats with blueberries', 'Leftover soup', 'Samosa from the office', 'Black coffee']
// Build-out item 2.4 counts the fixture's one weigh-in too.
const HOLDS = '6 meals, 3 nights of sleep, 1 workout, 1 saved plate and 1 weigh-in'

async function seed(page: Page, items: Record<string, string>) {
  await page.evaluate((entries) => {
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v)
  }, items)
}

async function read(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key)
}

async function start(page: Page, items: Record<string, string>) {
  await page.clock.setFixedTime(MINE_NOW)
  await page.goto('/')
  await seed(page, items)
  await page.reload()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function openPanel(page: Page) {
  await page.getByTestId('open-profile').click()
  const panel = page.getByTestId('profile-privacy')
  await expect(panel).toBeVisible()
  return panel
}

/** Export, and keep the download under the name the app gave it (in this test's output folder). */
async function exportFile(page: Page): Promise<{ name: string; path: string; text: string }> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-data').click()])
  const name = download.suggestedFilename()
  const path = test.info().outputPath(name)
  await download.saveAs(path)
  return { name, path, text: readFileSync(path, 'utf8') }
}

async function chooseFile(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('import-data').click()])
  await chooser.setFiles(file)
}

const jsonFile = (name: string, text: string) => ({ name, mimeType: 'application/json', buffer: Buffer.from(text) })

test.describe('item 1.2: export, import and delete your own log', () => {
  test('export, delete, import returns the identical log, and it survives a reload', async ({ page }) => {
    await start(page, { [E2E_KEYS.mine]: V1_MINE, [E2E_KEYS.demo]: V1_DEMO, [E2E_KEYS.active]: 'mine' })
    const original = JSON.parse(V1_MINE)

    // The guest name opens Profile and privacy.
    await expect(page.getByTestId('open-profile')).toContainText('Sam')
    await expect(page.getByTestId('open-profile')).toContainText('Profile and privacy')
    let panel = await openPanel(page)
    await expect(panel.getByTestId('privacy-saved-here')).toHaveText('Saved on this device only')

    // Export: one JSON file holding the stored document with its version.
    const exported = await exportFile(page)
    expect(exported.name).toBe(FILE_NAME)
    expect(JSON.parse(exported.text)).toStrictEqual(original)
    await expect(panel.getByTestId('privacy-status')).toHaveText(`Export ready: ${FILE_NAME}`)

    // Delete: a confirmation that says what goes, with focus on it; the demo is untouched.
    await panel.getByTestId('delete-data').click()
    const confirm = panel.getByTestId('delete-data-confirm')
    await expect(confirm.getByRole('heading', { name: 'Delete your log from this device?' })).toBeFocused()
    await expect(confirm.getByTestId('delete-data-items').getByRole('listitem')).toHaveText([
      '6 meals',
      '3 nights of sleep',
      '1 workout',
      '1 saved plate',
      '1 weigh-in',
      'your guest name, targets, body details and settings',
    ])
    await expect(confirm).toContainText('The fictional demo is not affected.')
    await confirm.getByTestId('delete-data-confirm-btn').click()
    await expect(panel.getByTestId('privacy-status')).toHaveText('Deleted. Your log on this device is now empty.')
    await expect(panel.getByTestId('privacy-status')).toBeFocused()
    expect(await read(page, E2E_KEYS.mine)).toBeNull()
    expect(await read(page, E2E_KEYS.demo)).toBe(V1_DEMO)

    // Afterwards the app shows an empty own log, also after a reload.
    await panel.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByTestId('empty-day')).toBeVisible()
    await expect(page.getByTestId('meal-row')).toHaveCount(0)
    // Build-out item 2.10: the emptied log starts again at once with a new generated name (not
    // Sam's), which nothing has saved yet.
    await expect(page.getByTestId('open-profile')).not.toContainText('Sam')
    await expect(page.getByTestId('header-name')).toHaveText(/^[A-Z][a-z]+[A-Z][a-z]+#\d{4}$/)
    expect(await read(page, E2E_KEYS.mine)).toBeNull()
    await page.reload()
    await expect(page.getByTestId('empty-day')).toBeVisible()
    await expect(page.locator('.storage-notice')).toHaveCount(0)
    // Build-out item 2.10: opened again with nothing saved, it starts as a new log, saved with a
    // generated guest name and nothing else.
    const fresh = JSON.parse((await read(page, E2E_KEYS.mine)) ?? 'null')
    expect(fresh).toMatchObject({ kind: 'mine', meals: [], sleeps: [], workouts: [], plates: [] })
    expect(fresh.profile).toEqual({ name: expect.stringMatching(/^[A-Z][a-z]+[A-Z][a-z]+#\d{4}$/), kind: 'guest' })
    await expect(page.getByTestId('header-name')).toHaveText(fresh.profile.name)

    // Import the exported file: a preview first, then the confirmation.
    panel = await openPanel(page)
    await chooseFile(page, exported.path)
    const preview = panel.getByTestId('import-preview')
    await expect(preview.getByRole('heading', { name: 'Check before importing' })).toBeFocused()
    await expect(preview).toContainText(`File: ${FILE_NAME}`)
    await expect(preview.getByTestId('import-preview-holds').getByRole('listitem')).toHaveText([
      'Guest name: Sam',
      HOLDS,
      'From Wed 28 Oct to Tue 3 Nov',
    ])
    await expect(preview.getByTestId('import-preview-replaces')).toHaveText(
      'Importing replaces your guest name, targets, body details and settings on this device. Your log has no meals or sleep yet.',
    )
    // Nothing is written until the person confirms.
    expect(JSON.parse((await read(page, E2E_KEYS.mine)) ?? 'null')).toStrictEqual(fresh)
    await preview.getByTestId('import-confirm').click()
    await expect(panel.getByTestId('privacy-status')).toHaveText(`Imported. Your log now holds ${HOLDS}.`)

    // The identical log: meals, sleeps, profile, settings and every other key.
    const imported = JSON.parse((await read(page, E2E_KEYS.mine)) ?? 'null')
    expect(imported).toStrictEqual(original)
    expect(imported.meals).toStrictEqual(original.meals)
    expect(imported.sleeps).toStrictEqual(original.sleeps)
    expect(imported.profile).toStrictEqual(original.profile)
    expect(imported.settings).toStrictEqual(original.settings)
    expect(await read(page, E2E_KEYS.demo)).toBe(V1_DEMO)

    await panel.getByRole('button', { name: 'Close' }).click()
    for (const name of SAM_MEALS) await expect(page.getByTestId('meal-row').filter({ hasText: name })).toHaveCount(1)
    await expect(page.getByTestId('open-profile')).toContainText('Sam')

    // Survives a reload, unchanged.
    await page.reload()
    for (const name of SAM_MEALS) await expect(page.getByTestId('meal-row').filter({ hasText: name })).toHaveCount(1)
    expect(JSON.parse((await read(page, E2E_KEYS.mine)) ?? 'null')).toStrictEqual(original)
  })

  test('a file Import cannot use is refused with a plain message, and nothing changes', async ({ page }) => {
    await start(page, { [E2E_KEYS.mine]: V1_MINE, [E2E_KEYS.active]: 'mine' })
    const panel = await openPanel(page)
    const error = panel.getByTestId('privacy-error')

    await chooseFile(page, jsonFile('howsure-demo.json', V1_DEMO))
    await expect(error).toHaveText(
      "This file holds the fictional demo, not your own log, so it wasn't imported. Nothing was changed. Choose an export of your own log.",
    )
    await expect(panel.getByTestId('import-preview')).toHaveCount(0)

    await chooseFile(page, jsonFile('from-later.json', JSON.stringify({ ...JSON.parse(V1_MINE), version: 99 })))
    await expect(error).toHaveText(
      "This file was saved by a newer version of HowSure, so this version can't read it. Nothing was changed. Open it in the newer version, or update HowSure and try again.",
    )

    await chooseFile(page, jsonFile('notes.json', 'meals: oats'))
    await expect(error).toHaveText(
      "HowSure couldn't read this file as a log. Nothing was changed. Choose the file Export made, named like howsure-log-2026-11-05.json.",
    )
    expect(await read(page, E2E_KEYS.mine)).toBe(V1_MINE)

    // A good file, then Cancel at the preview: nothing changes, and focus returns to the button.
    const other = { ...JSON.parse(V1_MINE), meals: [] }
    await chooseFile(page, jsonFile('other.json', JSON.stringify(other)))
    const preview = panel.getByTestId('import-preview')
    // Build-out item 2.10: the file's guest name is Sam, the one you have, so the import does not
    // say it replaces it.
    await expect(preview.getByTestId('import-preview-replaces')).toHaveText(
      `Importing replaces your log on this device, which holds ${HOLDS}, and your targets, body details and settings. HowSure keeps a copy of it, which you can export from this panel.`,
    )
    await preview.getByTestId('import-cancel').click()
    await expect(panel.getByTestId('import-data')).toBeFocused()
    expect(await read(page, E2E_KEYS.mine)).toBe(V1_MINE)

    // Keep my log at the Delete confirmation also changes nothing.
    await panel.getByTestId('delete-data').click()
    await panel.getByTestId('delete-data-keep').click()
    await expect(panel.getByTestId('delete-data')).toBeFocused()
    expect(await read(page, E2E_KEYS.mine)).toBe(V1_MINE)
  })

  test('a saved log this version cannot read still exports as it is, and can be deleted', async ({ page }) => {
    const junk = '{"version":1,"kind":"mine","meals":['
    const older = `${E2E_KEYS.mine}.backup-v0`
    await start(page, { [E2E_KEYS.mine]: junk, [older]: '{"version":0}', [E2E_KEYS.active]: 'mine' })
    await expect(page.getByTestId('storage-unreadable')).toBeVisible()
    await expect(page.getByTestId('storage-export-still-works')).toHaveText('You can still export it from Profile and privacy.')

    const panel = await openPanel(page)
    const exported = await exportFile(page)
    expect(exported.text).toBe(junk)

    // The older copy kept by a format upgrade can be exported too, unchanged.
    const [download] = await Promise.all([page.waitForEvent('download'), panel.getByTestId('export-older-copies').click()])
    expect(download.suggestedFilename()).toBe('howsure-older-copies-2026-10-28.json')
    expect(JSON.parse(readFileSync(await download.path(), 'utf8'))).toEqual({
      app: 'HowSure',
      olderCopies: [{ key: older, text: '{"version":0}' }],
    })

    // Import would replace it, so it is held back until it is exported and deleted.
    await expect(panel.getByTestId('import-data')).toBeDisabled()
    await expect(panel.getByTestId('import-blocked')).toContainText('Export it first to keep a copy, then delete it, then import.')

    await panel.getByTestId('delete-data').click()
    await expect(panel.getByTestId('delete-data-items').getByRole('listitem')).toHaveText([
      "your saved log, which this version of HowSure can't read",
      '1 older copy, kept when the saved format was updated or an import replaced your log',
    ])
    await panel.getByTestId('delete-data-confirm-btn').click()
    await expect(panel.getByTestId('privacy-status')).toHaveText('Deleted. Your log on this device is now empty.')
    expect(await read(page, E2E_KEYS.mine)).toBeNull()
    expect(await read(page, older)).toBeNull()
    await expect(panel.getByTestId('import-data')).toBeEnabled()
    await expect(page.getByTestId('storage-unreadable')).toHaveCount(0)

    // New changes now save, and a reload shows the empty log with no notice.
    await page.reload()
    await expect(page.getByTestId('empty-day')).toBeVisible()
    await expect(page.locator('.storage-notice')).toHaveCount(0)
  })

  test('with storage blocked, Delete clears the log on screen and says why, without asking to try again', async ({ page }) => {
    // The browser refuses localStorage altogether (as some privacy settings do).
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError')
        },
      })
    })
    await page.clock.setFixedTime(MINE_NOW)
    await page.goto('/')
    await page.getByRole('button', { name: 'Start my log' }).click()
    await expect(page.getByTestId('dashboard')).toBeVisible()

    const panel = await openPanel(page)
    await panel.getByTestId('delete-data').click()
    await panel.getByTestId('delete-data-confirm-btn').click()
    await expect(panel.getByTestId('privacy-status')).toHaveText(
      "Cleared. Your log on screen is now empty. This browser isn't letting HowSure use its storage right now, so there was no saved copy it could reach.",
    )
    await expect(panel.getByTestId('privacy-error')).toHaveCount(0)
    await panel.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByTestId('empty-day')).toBeVisible()
  })

  test('the panel belongs to your own log: the demo has no way into it', async ({ page }) => {
    await start(page, { [E2E_KEYS.demo]: V1_DEMO, [E2E_KEYS.active]: 'demo' })
    await expect(page.getByTestId('fictional-banner').first()).toBeVisible()
    await expect(page.getByTestId('open-profile')).toHaveCount(0)
  })
})
