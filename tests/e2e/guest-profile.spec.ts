// Build-out item 2.10 (checklist slice 9; prd.md > Guest Profile and Gamer-Tag Name): a new own log
// gets a readable random guest name such as "BraveKefir#4821", shown in the header, which opens
// Profile and privacy. There, "Reroll" rolls a new one (with Undo) and "Rename" takes a typed
// name of 1 to 16 letters or digits, refusing an empty one, one over 16 characters, and spaces or
// symbols, each with an inline message. The name survives a reload. The demo keeps Sam's name. An imported file keeps
// its own name; one with none, or one that can't be used, keeps yours. Opening your own log with
// nothing of it saved starts it as a new log with a name; Delete my data starts the emptied log
// again with a new name at once.
//
// Every journey runs once in each look this build offers (looks.ts). People and names here are
// the fictional Sam and invented ones.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { copy } from '../../src/ui/copy'
import { LOOKS, lookOnPage, startInLook } from './looks'
import { E2E_KEYS } from './storage-keys'

const NOW = new Date('2026-11-05T10:00:00-05:00')
const TAG = /^[A-Z][a-z]+[A-Z][a-z]+#\d{4}$/
const V1_MINE = readFileSync(fileURLToPath(new URL('../../fixtures/saved/v1-mine.json', import.meta.url)), 'utf8')
const MINE_NOW = new Date('2026-10-28T20:00:00-04:00')
// Sam's fixed guest name in the demo (fixtures/demo-week.json, spec.md > Demo Fixture).
const SAM_TAG = 'CalmLentil#3108'

async function read(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key)
}

async function savedName(page: Page): Promise<string | undefined> {
  const text = await read(page, E2E_KEYS.mine)
  return text === null ? undefined : (JSON.parse(text).profile.name as string)
}

async function startMine(page: Page) {
  await page.clock.setFixedTime(NOW)
  await page.goto('/')
  await page.getByTestId('start-mine').click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
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

async function openProfile(page: Page): Promise<Locator> {
  await page.getByTestId('open-profile').click()
  const panel = page.getByTestId('profile-privacy')
  await expect(panel).toBeVisible()
  return panel
}

async function closeProfile(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('profile-privacy')).toHaveCount(0)
}

/** The element is inside the window and not under the sheet's sticky header. */
async function expectInView(el: Locator) {
  const box = await el.evaluate((node) => {
    const r = node.getBoundingClientRect()
    const head = node.closest('.sheet')?.querySelector(':scope > header')?.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, headBottom: head?.bottom ?? 0, h: window.innerHeight }
  })
  expect(box.top).toBeGreaterThanOrEqual(box.headBottom - 1)
  expect(box.bottom).toBeLessThanOrEqual(box.h + 1)
}

/** A focus ring that hugs the control: a 2 px solid outline 2 px out. */
async function expectRing(el: Locator) {
  await expect(el).toBeFocused()
  const ring = await el.evaluate((b) => {
    const s = getComputedStyle(b)
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }
  })
  expect(ring.style).toBe('solid')
  expect(ring.width).toBeGreaterThanOrEqual(2)
}

async function rename(panel: Locator, typed: string) {
  await panel.getByTestId('guest-name-rename').click()
  await panel.getByTestId('guest-rename-input').fill(typed)
  await panel.getByTestId('guest-rename-save').click()
}

for (const { id: look, name: lookName } of LOOKS) {
  test.describe(`item 2.10 in the ${lookName} look: the guest name`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('a new own log gets a readable generated name in the header, which opens Profile and privacy, and it survives a reload', async ({ page }) => {
      await startMine(page)
      expect(await lookOnPage(page)).toBe(look)
      const header = page.getByTestId('header-name')
      const name = (await header.innerText()).trim()
      expect(name).toMatch(TAG)
      expect(name.length).toBeLessThanOrEqual(16)
      // Saved at once, so a reload shows the same name.
      expect(await savedName(page)).toBe(name)
      // The spoken name starts with the words shown, in order, so saying them matches (label in name).
      await expect(page.getByTestId('open-profile')).toHaveAccessibleName(`${name}, Profile and privacy`)
      await expect(page.getByTestId('open-profile')).toHaveText(new RegExp(`^${name}\\s*Profile and privacy$`))

      const panel = await openProfile(page)
      await expect(panel.getByTestId('guest-name')).toHaveText(name)
      await expect(panel.getByTestId('guest-name-label')).toHaveText('Guest: saved on this device only')
      await expect(panel.getByTestId('guest-name-pick')).toHaveText('Reroll')
      await expect(panel.getByTestId('guest-name-rename')).toHaveText('Rename')
      await closeProfile(page)
      await expect(page.getByTestId('open-profile')).toBeFocused()

      await page.reload()
      await expect(page.getByTestId('header-name')).toHaveText(name)
    })

    test('"Reroll" gives a new name, with Undo, and the new name survives a reload', async ({ page }) => {
      await startMine(page)
      const first = (await page.getByTestId('header-name').innerText()).trim()
      const panel = await openProfile(page)
      const pick = panel.getByTestId('guest-name-pick')
      await pick.click()
      const second = (await panel.getByTestId('guest-name').innerText()).trim()
      expect(second).toMatch(TAG)
      expect(second).not.toBe(first)
      const status = panel.getByTestId('guest-name-status')
      await expect(status).toHaveText(`Your name is now ${second}. It was ${first}.`)
      await expectInView(status)
      // Focus stays on the button pressed, so pressing again picks again.
      await expect(pick).toBeFocused()
      expect(await savedName(page)).toBe(second)
      // Undo comes right after Reroll, so Tab reaches it next, then Rename.
      await page.keyboard.press('Tab')
      await expect(panel.getByTestId('guest-name-undo')).toBeFocused()
      await expectRing(panel.getByTestId('guest-name-undo'))
      await page.keyboard.press('Tab')
      await expect(panel.getByTestId('guest-name-rename')).toBeFocused()
      await pick.focus()

      // Undo brings the name back and goes; focus moves to Reroll.
      await panel.getByTestId('guest-name-undo').click()
      await expect(panel.getByTestId('guest-name')).toHaveText(first)
      await expect(status).toHaveText(`Your name is back to ${first}.`)
      await expect(panel.getByTestId('guest-name-undo')).toHaveCount(0)
      await expect(pick).toBeFocused()
      expect(await savedName(page)).toBe(first)

      await pick.click()
      const third = (await panel.getByTestId('guest-name').innerText()).trim()
      expect(third).not.toBe(first)
      await closeProfile(page)
      await expect(page.getByTestId('header-name')).toHaveText(third)
      await page.reload()
      await expect(page.getByTestId('header-name')).toHaveText(third)
    })

    test('"Rename" takes a name of letters and digits, trimmed, and it survives a reload', async ({ page }) => {
      await startMine(page)
      const first = (await savedName(page))!
      const panel = await openProfile(page)
      await panel.getByTestId('guest-name-rename').click()
      const input = panel.getByTestId('guest-rename-input')
      await expect(input).toBeFocused()
      // The field holds the current name, all selected, so typing replaces it.
      await expect(input).toHaveValue(first)
      expect(await input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, first.length])
      // Saved as it was, nothing changes (a generated name holds "#", which a typed one can't).
      await input.press('Enter')
      await expect(panel.getByTestId('guest-rename-form')).toHaveCount(0)
      await expect(panel.getByTestId('guest-name')).toHaveText(first)
      await expect(panel.getByTestId('guest-name-status')).toHaveText('')
      await expect(panel.getByTestId('guest-rename-error')).toHaveCount(0)
      expect(await savedName(page)).toBe(first)
      await panel.getByTestId('guest-name-rename').click()
      await input.fill('  Sam2026 ')
      await input.press('Enter')
      await expect(panel.getByTestId('guest-name')).toHaveText('Sam2026')
      await expect(panel.getByTestId('guest-name-status')).toHaveText('Your name is now Sam2026.')
      await expect(panel.getByTestId('guest-rename-form')).toHaveCount(0)
      // Focus comes back to Rename, with its ring.
      await expectRing(panel.getByTestId('guest-name-rename'))
      expect(await savedName(page)).toBe('Sam2026')
      await closeProfile(page)
      await expect(page.getByTestId('header-name')).toHaveText('Sam2026')
      await page.reload()
      await expect(page.getByTestId('header-name')).toHaveText('Sam2026')
      // A typed name has no Undo: it is the name the person chose.
      const again = await openProfile(page)
      await expect(again.getByTestId('guest-name')).toHaveText('Sam2026')
      await expect(again.getByTestId('guest-name-undo')).toHaveCount(0)
      // A small change needs no retyping: the field starts with the name.
      await again.getByTestId('guest-name-rename').click()
      const field = again.getByTestId('guest-rename-input')
      await expect(field).toHaveValue('Sam2026')
      await field.press('End')
      await field.press('Backspace')
      await field.pressSequentially('7')
      await field.press('Enter')
      await expect(again.getByTestId('guest-name')).toHaveText('Sam2027')
      expect(await savedName(page)).toBe('Sam2027')
    })

    test('"Rename" refuses an empty name, one of 17 characters, and spaces or symbols, beside the field', async ({ page }) => {
      await startMine(page)
      const before = await savedName(page)
      const panel = await openProfile(page)
      const input = panel.getByTestId('guest-rename-input')
      const error = panel.getByTestId('guest-rename-error')
      const cases: [string, string][] = [
        ['', copy.guestName.errors.empty],
        ['    ', copy.guestName.errors.empty],
        ['SamTheLentilLover', copy.guestName.errors.tooLong(16)],
        ['Sam 2026', copy.guestName.errors.characters(' ')],
        ['BraveKefir#4821', copy.guestName.errors.characters('#')],
        ['Sam_2026', copy.guestName.errors.characters('_')],
        ['Sam-2026', copy.guestName.errors.characters('-')],
      ]
      expect(cases[2]![0]).toHaveLength(17)
      await panel.getByTestId('guest-name-rename').click()
      for (const [typed, message] of cases) {
        await input.fill(typed)
        await panel.getByTestId('guest-rename-save').click()
        await expect(error).toHaveText(message)
        await expect(input).toHaveAttribute('aria-invalid', 'true')
        await expect(input).toHaveAttribute('aria-describedby', /-error/)
        // The message is in view, under the field, and focus is back in the field to fix it.
        await expectInView(error)
        await expect(input).toBeFocused()
        // Nothing was saved.
        expect(await savedName(page)).toBe(before)
      }
      // Typing again clears the message until the next Save.
      await input.fill('Sam')
      await expect(error).toHaveCount(0)
      await expect(input).not.toHaveAttribute('aria-invalid', 'true')
      // 16 characters is the most, and is accepted.
      await input.fill('SamTheLentilLove')
      await panel.getByTestId('guest-rename-save').click()
      await expect(panel.getByTestId('guest-name')).toHaveText('SamTheLentilLove')
      // Any letters and digits are taken: there is no word list (the name is shown only to you).
      for (const ok of ['Nazim', 'Allcock', 'Ana123', 'Zoë2026']) {
        await rename(panel, ok)
        await expect(panel.getByTestId('guest-name')).toHaveText(ok)
        await expect(panel.getByTestId('guest-rename-error')).toHaveCount(0)
        expect(await savedName(page)).toBe(ok)
      }
    })

    test('Cancel keeps the name and brings focus back to Rename', async ({ page }) => {
      await startMine(page)
      const name = await savedName(page)
      const panel = await openProfile(page)
      await panel.getByTestId('guest-name-rename').click()
      await panel.getByTestId('guest-rename-input').fill('Sam2026')
      // By keyboard, so the ring shows (a mouse click leaves :focus-visible off, as browsers do).
      await panel.getByTestId('guest-rename-cancel').focus()
      await page.keyboard.press('Enter')
      await expect(panel.getByTestId('guest-rename-form')).toHaveCount(0)
      await expect(panel.getByTestId('guest-name')).toHaveText(name!)
      await expectRing(panel.getByTestId('guest-name-rename'))
      expect(await savedName(page)).toBe(name)
    })

    test('the demo keeps Sam’s fixed name (spec.md > Demo Fixture) in the header, as text, with no Rename or Reroll', async ({ page }) => {
      await page.clock.setFixedTime(NOW)
      await page.goto('/')
      await page.getByTestId('try-demo').click()
      await expect(page.getByTestId('dashboard')).toBeVisible()
      const demoName = page.getByTestId('demo-name')
      await expect(page.getByTestId('header-name')).toHaveText(SAM_TAG)
      await expect(demoName).toContainText(copy.header.demoNameNote)
      await expect(demoName.locator('button')).toHaveCount(0)
      await expect(page.getByTestId('open-profile')).toHaveCount(0)
      await expect(page.getByTestId('guest-name-pick')).toHaveCount(0)
      // Opening your own log from the demo starts it with a generated name; the demo stays Sam's.
      await page.getByTestId('log-switch').click()
      await expect(page.getByTestId('header-name')).toHaveText(TAG)
      const mine = await savedName(page)
      await page.getByTestId('log-switch').click()
      await expect(page.getByTestId('header-name')).toHaveText(SAM_TAG)
      expect(JSON.parse((await read(page, E2E_KEYS.demo)) as string).profile.name).toBe(SAM_TAG)
      await page.getByTestId('log-switch').click()
      await expect(page.getByTestId('header-name')).toHaveText(mine!)
    })

    test('a log saved with no name keeps none until you pick one; it is not given one behind your back', async ({ page }) => {
      const unnamed = JSON.stringify({ ...JSON.parse(V1_MINE), profile: { name: '', kind: 'guest' } })
      await seedAndOpen(page, MINE_NOW, { [E2E_KEYS.mine]: unnamed, [E2E_KEYS.active]: 'mine' })
      await expect(page.getByTestId('header-name')).toHaveText(copy.header.yourLog)
      expect(await read(page, E2E_KEYS.mine)).toBe(unnamed)
      const panel = await openProfile(page)
      await expect(panel.getByTestId('guest-name')).toHaveText(copy.guestName.none)
      // A status line in normal weight, not a name.
      expect(await panel.getByTestId('guest-name').evaluate((el) => getComputedStyle(el).fontWeight)).toBe('400')
      await expect(panel.getByTestId('guest-name-pick')).toHaveText(copy.guestName.pickFirst)
      await expect(panel.getByTestId('guest-name-rename')).toHaveText(copy.guestName.renameFirst)
      // Nothing is saved for "saved on this device only" to describe until there is a name.
      await expect(panel.getByTestId('guest-name-label')).toHaveCount(0)
      // An empty name: there is no current name to keep, so the message doesn't offer to keep one.
      await panel.getByTestId('guest-name-rename').click()
      await expect(panel.getByTestId('guest-rename-input')).toHaveValue('')
      await panel.getByTestId('guest-rename-save').click()
      await expect(panel.getByTestId('guest-rename-error')).toHaveText('Type a name, or press “Cancel”.')
      await panel.getByTestId('guest-rename-cancel').click()
      expect(await read(page, E2E_KEYS.mine)).toBe(unnamed)
      await panel.getByTestId('guest-name-pick').click()
      const picked = (await panel.getByTestId('guest-name').innerText()).trim()
      expect(picked).toMatch(TAG)
      await expect(panel.getByTestId('guest-name-status')).toHaveText(`Your name is now ${picked}.`)
      await expect(panel.getByTestId('guest-name-undo')).toHaveCount(0)
      await expect(panel.getByTestId('guest-name-label')).toHaveText('Guest: saved on this device only')
      // Only the name changed: the meals and nights are as they were.
      const saved = JSON.parse((await read(page, E2E_KEYS.mine)) as string)
      expect({ ...saved, profile: { ...saved.profile, name: '' } }).toEqual(JSON.parse(unnamed))
    })

    test('an imported file keeps its own name; one with none keeps yours, and the preview says so', async ({ page }) => {
      await startMine(page)
      const mine = (await savedName(page))!
      const panel = await openProfile(page)
      const choose = async (name: string, text: string) => {
        const [chooser] = await Promise.all([page.waitForEvent('filechooser'), panel.getByTestId('import-data').click()])
        await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) })
        await expect(panel.getByTestId('import-preview')).toBeVisible()
      }
      // Sam's export, with no name in it.
      const unnamed = JSON.stringify({ ...JSON.parse(V1_MINE), profile: { ...JSON.parse(V1_MINE).profile, name: '' } })
      await choose('howsure-log.json', unnamed)
      const nameLine = panel.getByTestId('import-preview-name')
      await expect(nameLine).toHaveText(copy.privacy.previewNameKept(mine))
      await expect(nameLine).toHaveText(`Guest name after import: ${mine}, your current one. The file has none.`)
      // Not listed as something the file holds, and not among what the import replaces.
      expect(await nameLine.evaluate((el) => el.tagName)).toBe('P')
      await expect(panel.getByTestId('import-preview-holds')).not.toContainText('Guest name')
      await expect(panel.getByTestId('import-preview-replaces')).toHaveText(
        'Importing replaces your targets, body details and settings on this device. Your log has no meals or sleep yet.',
      )
      await panel.getByTestId('import-confirm').click()
      await expect(panel.getByTestId('privacy-status')).toBeVisible()
      await expect(panel.getByTestId('guest-name')).toHaveText(mine)
      expect(await savedName(page)).toBe(mine)

      // A hand-edited file whose name Rename would refuse: yours is kept, and the preview says why.
      const refused = JSON.stringify({ ...JSON.parse(V1_MINE), profile: { ...JSON.parse(V1_MINE).profile, name: 'Sam the lentil lover' } })
      await choose('howsure-log.json', refused)
      await expect(nameLine).toHaveText(copy.privacy.previewNameRefusedKept(mine, 16))
      await expect(panel.getByTestId('import-preview')).not.toContainText('Sam the lentil lover')
      await expect(panel.getByTestId('import-preview-replaces')).not.toContainText('guest name')
      await panel.getByTestId('import-cancel').click()

      // Sam's export with its name: the file's name is kept, listed with what the file holds, and
      // the import replaces yours.
      await choose('howsure-log.json', V1_MINE)
      await expect(panel.getByTestId('import-preview-holds').getByTestId('import-preview-name')).toHaveText(copy.privacy.previewName('Sam'))
      await expect(panel.getByTestId('import-preview-replaces')).toContainText('your guest name, targets, body details and settings')
      await panel.getByTestId('import-confirm').click()
      await expect(panel.getByTestId('guest-name')).toHaveText('Sam')
      await closeProfile(page)
      await page.reload()
      await expect(page.getByTestId('header-name')).toHaveText('Sam')

      // The same file again: its name is the one you have, so the import doesn't say it replaces it.
      const again = await openProfile(page)
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), again.getByTestId('import-data').click()])
      await chooser.setFiles({ name: 'howsure-log.json', mimeType: 'application/json', buffer: Buffer.from(V1_MINE) })
      await expect(again.getByTestId('import-preview')).toBeVisible()
      await expect(again.getByTestId('import-preview-holds').getByTestId('import-preview-name')).toHaveText(copy.privacy.previewName('Sam'))
      await expect(again.getByTestId('import-preview-replaces')).toContainText('your targets, body details and settings')
      await expect(again.getByTestId('import-preview-replaces')).not.toContainText('guest name')
    })

    test('after Delete my data the emptied log starts again at once with a new generated name, which the next save keeps', async ({ page }) => {
      await startMine(page)
      const first = (await savedName(page))!
      const deleteMine = async () => {
        const panel = await openProfile(page)
        await panel.getByTestId('delete-data').click()
        await panel.getByTestId('delete-data-confirm-btn').click()
        await expect(panel.getByTestId('privacy-status')).toHaveText(copy.privacy.deleted)
        // Nothing of the log is left on the device, but the log on screen has a new name at once.
        expect(await read(page, E2E_KEYS.mine)).toBeNull()
        const named = (await panel.getByTestId('guest-name').innerText()).trim()
        expect(named).toMatch(TAG)
        // It is not saved, so it is not called saved: the section says when it will be.
        await expect(panel.getByTestId('guest-name-label')).toHaveCount(0)
        await expect(panel.getByTestId('guest-name-not-saved')).toHaveText(copy.guestName.notSavedYet)
        await expect(panel.getByTestId('guest-name-not-saved')).toBeVisible()
        await expect(panel.getByTestId('guest-name-not-saved')).toContainText('Until then, a reload picks another name.')
        // The next section says so too: nothing of the log is kept yet.
        await expect(panel.getByTestId('privacy-saved-detail')).toHaveText(copy.privacy.savedHereDetailNotYet)
        await expect(panel.getByTestId('guest-name-pick')).toHaveText(copy.guestName.reroll)
        await closeProfile(page)
        await expect(page.getByTestId('header-name')).toHaveText(named)
        expect(await read(page, E2E_KEYS.mine)).toBeNull()
        return named
      }
      const second = await deleteMine()
      expect(second).not.toBe(first)
      // Logging a meal before a reload saves the log with that name, so it is never left unnamed.
      await page.getByTestId('log-meal').click()
      const sheet = page.getByTestId('log-meal-sheet')
      await expect(sheet).toBeVisible()
      await sheet.getByTestId('meal-name-input').fill('Lentil soup')
      await sheet.getByTestId('source-label').check()
      await sheet.getByTestId('meal-kcal-input').fill('420')
      await sheet.getByTestId('save-meal').click()
      await expect(sheet).toBeHidden()
      expect(await savedName(page)).toBe(second)
      // The meal saved the log, name and all, so Profile now calls the name saved.
      const afterMeal = await openProfile(page)
      await expect(afterMeal.getByTestId('guest-name')).toHaveText(second)
      await expect(afterMeal.getByTestId('guest-name-label')).toHaveText(copy.guestName.label)
      await expect(afterMeal.getByTestId('guest-name-not-saved')).toHaveCount(0)
      await expect(afterMeal.getByTestId('privacy-saved-detail')).toHaveText(copy.privacy.savedHereDetail)
      await closeProfile(page)
      await page.reload()
      await expect(page.getByTestId('header-name')).toHaveText(second)
      expect(await savedName(page)).toBe(second)

      // The demo and back keeps the new name (it is the log in memory), and the first save keeps it.
      const third = await deleteMine()
      await page.getByTestId('log-switch').click()
      await expect(page.getByTestId('header-name')).toHaveText(SAM_TAG)
      expect(await read(page, E2E_KEYS.mine)).toBeNull()
      await page.getByTestId('log-switch').click()
      await expect(page.getByTestId('header-name')).toHaveText(third)
      const panel = await openProfile(page)
      await expect(panel.getByTestId('guest-name-not-saved')).toHaveText(copy.guestName.notSavedYet)
      await panel.getByTestId('guest-name-pick').click()
      const fourth = (await panel.getByTestId('guest-name').innerText()).trim()
      expect(fourth).toMatch(TAG)
      expect(await savedName(page)).toBe(fourth)
      // Reroll saved it, so now it is labelled saved, and the "not saved yet" line is gone.
      await expect(panel.getByTestId('guest-name-label')).toHaveText(copy.guestName.label)
      await expect(panel.getByTestId('guest-name-not-saved')).toHaveCount(0)
      await closeProfile(page)

      // A reload with nothing saved since Delete starts the log as a new log, saved at once.
      const unsaved = await deleteMine()
      await page.reload()
      const fifth = (await page.getByTestId('header-name').innerText()).trim()
      expect(fifth).toMatch(TAG)
      // As the "Not saved yet" line says, the reload picked another name.
      expect(fifth).not.toBe(unsaved)
      expect(await savedName(page)).toBe(fifth)
      await page.reload()
      await expect(page.getByTestId('header-name')).toHaveText(fifth)
    })

    test('the Delete confirmation leaves out the guest name when the log has none', async ({ page }) => {
      const unnamed = JSON.stringify({ ...JSON.parse(V1_MINE), profile: { name: '', kind: 'guest' } })
      await seedAndOpen(page, MINE_NOW, { [E2E_KEYS.mine]: unnamed, [E2E_KEYS.active]: 'mine' })
      const panel = await openProfile(page)
      await panel.getByTestId('delete-data').click()
      const confirm = panel.getByTestId('delete-data-confirm')
      await expect(confirm).toContainText('your targets, body details and settings')
      await expect(confirm).not.toContainText('guest name')
      await panel.getByTestId('delete-data-keep').click()
      await closeProfile(page)
      // With a name, it is listed.
      await page.evaluate(() => localStorage.clear())
      await startMine(page)
      const named = await openProfile(page)
      await named.getByTestId('delete-data').click()
      await expect(named.getByTestId('delete-data-confirm')).toContainText('your guest name, targets, body details and settings')
    })
  })

  test(`item 2.10 in the ${lookName} look: the name, Profile and a validation error fit at 320, 390 and 1440 px`, async ({ page }) => {
    await startInLook(page, look)
    await startMine(page)
    const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    const sheetSideways = () =>
      page.evaluate(() => {
        const s = document.querySelector<HTMLElement>('.sheet')
        return s ? s.scrollWidth - s.clientWidth : 0
      })
    for (const size of [
      { width: 320, height: 640 },
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(size)
      // The widest name allowed: 16 capital Ws.
      const panel = await openProfile(page)
      await rename(panel, 'WWWWWWWWWWWWWWWW')
      await expect(panel.getByTestId('guest-name')).toHaveText('WWWWWWWWWWWWWWWW')
      expect(await sheetSideways()).toBeLessThanOrEqual(0)
      // A validation error.
      await panel.getByTestId('guest-name-rename').click()
      await panel.getByTestId('guest-rename-input').fill('Sam 2026 and more')
      await panel.getByTestId('guest-rename-save').click()
      await expect(panel.getByTestId('guest-rename-error')).toBeVisible()
      expect(await sheetSideways()).toBeLessThanOrEqual(0)
      // The two buttons and the form's buttons are 44 px tall.
      for (const id of ['guest-rename-save', 'guest-rename-cancel']) {
        expect((await panel.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44)
      }
      await panel.getByTestId('guest-rename-cancel').click()
      for (const id of ['guest-name-pick', 'guest-name-rename']) {
        expect((await panel.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44)
      }
      await closeProfile(page)
      // The header holds the long name without sideways scrolling, and its button is 44 px tall.
      await expect(page.getByTestId('header-name')).toHaveText('WWWWWWWWWWWWWWWW')
      expect(await sideways()).toBeLessThanOrEqual(0)
      expect((await page.getByTestId('open-profile').boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await page.getByTestId('open-profile').focus()
      await expectRing(page.getByTestId('open-profile'))
    }
  })
}
