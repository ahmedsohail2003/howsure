// Build-out item 2.2 (checklist slice 6: Correct a sleep or wake time safely), covering every
// "- [ ]" under prd.md > Editing Sleep and Wake Times, plus the two gaps slice 6 left open: adding
// a missed night and deleting a wrong one.
//   - The editor opens from the header's wake time, Edit in the sleep section (the Night look's
//     timeline wake point), each night in the sleep detail, Add a missed night, and Set wake time
//     (for the whole night).
//   - "I woke at 8": a few taps plus the time, typed as shorthand and shown back with AM or PM.
//   - The order check: a wake before its sleep, a wake in the future and an overlap each show in
//     plain words next to the field, keep what was typed, and save nothing.
//   - The move warning: before an edit, an added night or a deletion changes an entry's waking
//     day, it lists what moves and to which day. Cancel changes nothing; Save and move applies it.
//     No warning when nothing moves.
//   - Adding a missed night splits a day that ran on because that night had no record.
//
// Every journey runs once in each look this build offers (looks.ts). The logs are the fictional
// Sam's, with invented foods and times; expected days and times are worked out by hand below.
import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Look } from '../../src/store/look'
import { LOOKS, startInLook } from './looks'
import { E2E_KEYS } from './storage-keys'

// Your own log runs on real time; the tests fix it at Thu 2026-11-05 10:00 in Toronto (EST).
const NOW = new Date('2026-11-05T10:00:00-05:00')
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')

function meal(id: string, name: string, eatenAt: string, kcal: number) {
  return { id, name, eatenAt, source: 'label', kcal, protein: null, carbs: null, fat: null }
}

function logOf(sleeps: unknown[], meals: unknown[]): string {
  return JSON.stringify({ version: 1, kind: 'mine', profile: { name: '', kind: 'guest' }, meals, sleeps, workouts: [], plates: [] })
}

// Three recorded nights. Thursday's day starts at 7:20 AM, so the 7:45 AM tea is on it.
const N1 = { id: 'n1', sleepStart: '2026-11-02T23:30:00-05:00', wake: '2026-11-03T07:00:00-05:00' }
const N2 = { id: 'n2', sleepStart: '2026-11-03T23:50:00-05:00', wake: '2026-11-04T07:10:00-05:00' }
const N3 = { id: 'n3', sleepStart: '2026-11-04T23:10:00-05:00', wake: '2026-11-05T07:20:00-05:00' }
const MEALS = [
  meal('m1', 'Porridge', '2026-11-03T08:00:00-05:00', 300),
  meal('m3', 'Rye toast', '2026-11-04T08:30:00-05:00', 220),
  meal('m4', 'Lentil salad', '2026-11-04T13:00:00-05:00', 450),
  meal('m5', 'Tea with milk', '2026-11-05T07:45:00-05:00', 40),
  meal('m6', 'Yogurt', '2026-11-05T08:30:00-05:00', 150),
]
const FULL_LOG = logOf([N1, N2, N3], MEALS)
// The same week as an imported log might have it: no record for the night before Wednesday, so
// Tuesday's day runs from Tue 7:00 AM until Thu 7:20 AM and holds Wednesday's meals too.
const GAP_LOG = logOf([N1, N3], MEALS)
// Asleep since Wed 11:10 PM, nothing logged after it yet: the "I woke up" path.
const ASLEEP_LOG = logOf([N1, N2, { id: 'n3', sleepStart: N3.sleepStart, wake: null }], MEALS.slice(0, 3))

async function read(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key)
}

async function stored(page: Page) {
  return JSON.parse((await read(page, E2E_KEYS.mine)) as string)
}

async function openOwnLog(page: Page, log: string) {
  await page.clock.setFixedTime(NOW)
  await page.goto('/')
  await page.evaluate(
    ([k, v, a]) => {
      localStorage.setItem(k, v)
      localStorage.setItem(a, 'mine')
    },
    [E2E_KEYS.mine, log, E2E_KEYS.active] as const,
  )
  await page.reload()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function opened(page: Page, testId: string): Promise<Locator> {
  const sheet = page.getByTestId(testId)
  await expect(sheet).toBeVisible()
  return sheet
}

async function dayMealNames(page: Page): Promise<string[]> {
  return page.getByTestId('meal-row').locator('.meal-name').allInnerTexts()
}

/** Edit in the sleep section; the Night look draws last night on the timeline's wake point instead. */
async function editFromSleepSection(page: Page, look: Look) {
  if (look === 'night') await page.getByTestId('tl-wake').getByTestId('tl-edit').click()
  else await page.getByTestId('sleep-section').getByTestId('sleep-edit').click()
}

/**
 * Every date, time and length in `box`'s sentences sits on one line: each kept-together piece has
 * one line box, and there is one for every time in the text, so "Thu 7:20 AM" never ends a line
 * at "7:20" with "AM" on the next.
 */
async function timesStayWhole(box: Locator, what: string) {
  const r = await box.evaluate((el) => {
    const pieces = [...el.querySelectorAll('.keep-together')]
    const times = (el.textContent ?? '').match(/\d{1,2}:\d{2} (AM|PM)/g) ?? []
    const timesKept = pieces.map((p) => (p.textContent ?? '').match(/\d{1,2}:\d{2} (AM|PM)/g)?.length ?? 0).reduce((a, b) => a + b, 0)
    return {
      split: pieces.filter((p) => p.getClientRects().length !== 1).map((p) => p.textContent),
      times: times.length,
      timesKept,
    }
  })
  expect(r.split, `${what}: pieces split across lines`).toEqual([])
  expect(r.timesKept, `${what}: every time is kept together`).toBe(r.times)
}

/** Opens "Each night" in the sleep section. */
async function openNights(page: Page): Promise<Locator> {
  const nights = page.getByTestId('sleep-nights')
  if (!(await nights.evaluate((d) => (d as HTMLDetailsElement).open))) await nights.locator('summary').click()
  return nights
}

for (const { id: look, name: lookName } of LOOKS) {
  test.describe(`the sleep and wake editor in the ${lookName} look`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('"I woke at 8": tap the wake time, type 8, and see which meal moves before saving', async ({ page }) => {
      await openOwnLog(page, FULL_LOG)
      const header = page.getByTestId('waking-day')
      await expect(header).toHaveText('Thu · awake since 7:20 AM')
      await expect(header).toHaveAccessibleName('Thu · awake since 7:20 AM, edit the wake time')
      expect(await dayMealNames(page)).toEqual(['Tea with milk', 'Yogurt'])

      // The editor opens on the night that started the day, with explicit dates and times.
      await header.click()
      const editor = await opened(page, 'sleep-editor')
      await expect(editor.locator('.sheet-title')).toHaveText('Edit this night')
      await expect(editor.getByTestId('sleep-editor-intro')).toHaveText(
        'The night before Thu Nov 5. Change either time. A blank sleep time means it wasn’t logged.',
      )
      await expect(editor.getByTestId('edit-sleep-date-input')).toHaveValue('2026-11-04')
      await expect(editor.getByTestId('edit-sleep-time-input')).toHaveValue('11:10 PM')
      await expect(editor.getByTestId('edit-wake-date-input')).toHaveValue('2026-11-05')
      await expect(editor.getByTestId('edit-wake-time-input')).toHaveValue('7:20 AM')
      await expect(editor.getByTestId('edit-length')).toHaveText('8 h 10 min of sleep.')

      // Shorthand, shown back with AM and how to get the evening; tidied once the field is left.
      const wakeTime = editor.getByTestId('edit-wake-time-input')
      await wakeTime.fill('8')
      await expect(editor.getByTestId('edit-wake-readback')).toHaveText('Reads as Thu 8:00 AM. Type pm for the evening.')
      await expect(editor.getByTestId('edit-length')).toHaveText('8 h 50 min of sleep.')
      await wakeTime.blur()
      await expect(wakeTime).toHaveValue('8:00 AM')
      await expect(editor.getByTestId('edit-wake-readback')).toHaveText('Reads as Thu 8:00 AM.')

      // Save first lists what would move: the 7:45 AM tea, from Thursday's day back to Wednesday's.
      await editor.getByTestId('edit-night-save').click()
      const warning = await opened(page, 'move-warning')
      await expect(warning.locator('.sheet-title')).toHaveText('Entries that change day')
      await expect(warning.getByTestId('move-group').locator('h3')).toHaveText(
        'From Thu’s day (woke 7:20 AM) to Wed’s day (woke 7:10 AM)',
      )
      await expect(warning.getByTestId('move-entry')).toHaveText(['Thu 7:45 AMTea with milk40 kcal'])
      expect(await read(page, E2E_KEYS.mine)).toBe(FULL_LOG)

      // Change the times goes back with what was typed kept.
      await warning.getByTestId('moves-back').click()
      const back = await opened(page, 'sleep-editor')
      await expect(back.getByTestId('edit-wake-time-input')).toHaveValue('8:00 AM')

      // Cancel (Close on the warning): nothing changes, on screen or on the device.
      await back.getByTestId('edit-night-save').click()
      await opened(page, 'move-warning')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('move-warning')).toHaveCount(0)
      await expect(header).toHaveText('Thu · awake since 7:20 AM')
      expect(await read(page, E2E_KEYS.mine)).toBe(FULL_LOG)

      // Save and move: the day now starts at 8:00 AM and the tea is on Wednesday.
      await header.click()
      const again = await opened(page, 'sleep-editor')
      await again.getByTestId('edit-wake-time-input').fill('8')
      await again.getByTestId('edit-wake-time-input').press('Enter')
      await (await opened(page, 'move-warning')).getByTestId('moves-save').click()
      await expect(page.getByTestId('move-warning')).toHaveCount(0)
      await expect(header).toHaveText('Thu · awake since 8:00 AM')
      expect(await dayMealNames(page)).toEqual(['Yogurt'])
      const saved = await stored(page)
      expect(saved.sleeps).toEqual([N1, N2, { ...N3, wake: '2026-11-05T08:00:00-05:00' }])
      expect(saved.meals).toEqual(MEALS)
      await page.getByTestId('day-prev').click()
      await expect(header).toHaveText('Wed · awake since 7:10 AM')
      expect(await dayMealNames(page)).toEqual(['Rye toast', 'Lentil salad', 'Tea with milk'])

      await page.reload()
      await expect(header).toHaveText('Thu · awake since 8:00 AM')
    })

    test('"I woke at 8" by keyboard: the editor opens on the wake time, ready to type over', async ({ page }) => {
      await openOwnLog(page, FULL_LOG)
      const header = page.getByTestId('waking-day')
      await header.focus()
      await page.keyboard.press('Enter')
      const editor = await opened(page, 'sleep-editor')
      const wakeTime = editor.getByTestId('edit-wake-time-input')
      // First focus is the wake time, its text selected, so typing 8 replaces 7:20 AM.
      await expect(wakeTime).toBeFocused()
      await page.keyboard.type('8')
      await expect(wakeTime).toHaveValue('8')
      await expect(editor.getByTestId('edit-wake-readback')).toHaveText('Reads as Thu 8:00 AM. Type pm for the evening.')
      // Enter saves: the tea would move, so the warning comes first.
      await page.keyboard.press('Enter')
      await expect(await opened(page, 'move-warning')).toBeVisible()
      // "Change the times" goes back to the form, on the wake time again; nothing was saved.
      await page.getByTestId('move-warning').getByTestId('moves-back').click()
      await expect((await opened(page, 'sleep-editor')).getByTestId('edit-wake-time-input')).toBeFocused()
      await page.keyboard.press('Escape')
      expect(await read(page, E2E_KEYS.mine)).toBe(FULL_LOG)
      // A new night opens on its sleep time, the first thing to fill in.
      await (await openNights(page)).getByTestId('add-night').click()
      await expect((await opened(page, 'sleep-editor')).getByTestId('edit-sleep-time-input')).toBeFocused()
    })

    test('"I woke up" takes shorthand too: type 8, Save, and the new day starts at 8:00 AM', async ({ page }) => {
      await openOwnLog(page, ASLEEP_LOG)
      const openIntro =
        'The sleep that started Wed 11:10 PM and is still going on. Type the wake time to end it, or change when it started.'
      if (look !== 'night') {
        // The head's Edit sits beside "Asleep since Wed 11:10 PM" and opens that sleep, not the night before.
        const head = page.getByTestId('sleep-section').getByTestId('sleep-edit')
        await expect(page.getByTestId('sleep-status')).toHaveText('Asleep since Wed 11:10 PM')
        await expect(head).toHaveText('Edit this sleep')
        await head.click()
        const fromHead = await opened(page, 'sleep-editor')
        await expect(fromHead.getByTestId('sleep-editor-intro')).toHaveText(openIntro)
        await expect(fromHead.getByTestId('edit-sleep-time-input')).toHaveValue('11:10 PM')
        await expect(fromHead.getByTestId('edit-wake-time-input')).toHaveValue('')
        await page.keyboard.press('Escape')
      }
      // The sleep still going on can be corrected too: in Each night, or (Night) the timeline's end.
      if (look === 'night') {
        await expect(page.getByTestId('tl-end').getByTestId('tl-edit-cue')).toHaveText('Edit')
        // Named by the sleep it opens, not by everything on its row (the 7-night average too).
        await expect(page.getByTestId('tl-end').getByTestId('tl-edit')).toHaveAccessibleName('Edit the sleep since Wed 11:10 PM')
        await page.getByTestId('tl-end').getByTestId('tl-edit').click()
      } else await (await openNights(page)).getByTestId('night-open-row').getByTestId('night-edit').click()
      const open = await opened(page, 'sleep-editor')
      // Titled like the button that opens it: a sleep still going on is not yet a night.
      await expect(open.locator('.sheet-title')).toHaveText('Edit this sleep')
      await expect(open.getByTestId('sleep-editor-intro')).toHaveText(openIntro)
      await expect(open.getByTestId('edit-sleep-time-input')).toHaveValue('11:10 PM')
      await expect(open.getByTestId('edit-wake-time-input')).toHaveValue('')
      await expect(open.getByTestId('edit-wake-hint')).toHaveText('Blank: still asleep, so this must be the latest night.')
      await page.keyboard.press('Escape')

      await page.getByTestId('sleep-action').click()
      const sheet = await opened(page, 'sleep-sheet')
      await expect(sheet.getByTestId('sleep-date-input')).toHaveValue('2026-11-05')
      await expect(sheet.getByTestId('sleep-time-input')).toHaveValue('10:00 AM')
      await sheet.getByTestId('sleep-time-input').fill('8')
      await expect(sheet.getByTestId('sleep-readback')).toHaveText('Reads as Thu 8:00 AM. Type pm for the evening.')
      await sheet.getByTestId('sleep-time-input').press('Enter')
      await expect(page.getByTestId('sleep-sheet')).toHaveCount(0)
      await expect(page.getByTestId('waking-day')).toHaveText('Thu · awake since 8:00 AM')
      expect((await stored(page)).sleeps[2]).toEqual({ id: 'n3', sleepStart: N3.sleepStart, wake: '2026-11-05T08:00:00-05:00' })
    })

    test('"I woke up" lists every entry that moves to the new day, workouts too, before Save', async ({ page }) => {
      // Asleep since Wed 11:10 PM, with a tea at Thu 7:45 AM and a walk at Thu 8:15 AM logged on Wednesday's day.
      const walk = { id: 'w1', name: 'Morning walk', startedAt: '2026-11-05T08:15:00-05:00', minutes: 30, kcal: 120, source: 'burn_device' }
      const log = JSON.parse(logOf([N1, N2, { id: 'n3', sleepStart: N3.sleepStart, wake: null }], [...MEALS.slice(0, 3), MEALS[3]]))
      log.workouts = [walk]
      const text = JSON.stringify(log)
      await openOwnLog(page, text)
      await page.getByTestId('sleep-action').click()
      const sheet = await opened(page, 'sleep-sheet')
      // Filled in with now (10:00 AM): the hint says so until the time is changed.
      await expect(sheet.getByTestId('sleep-hint')).toHaveText('Starts at now. Change it if it was another time.')
      await expect(sheet.getByTestId('sleep-effect')).toHaveText('This starts a new, empty waking day.')
      await sheet.getByTestId('sleep-time-input').fill('7')
      await expect(sheet.getByTestId('sleep-hint')).toHaveCount(0)
      // The same list as the editor's move warning: where they move from and to, each with its time.
      const moves = sheet.getByTestId('sleep-moves')
      await expect(moves.getByTestId('sleep-moves-intro')).toHaveText('These entries are after that time, so they move to the new day:')
      await expect(moves.getByTestId('move-group').locator('h3')).toHaveText('From Wed’s day (woke 7:10 AM) to Thu’s day (woke 7:00 AM)')
      await expect(moves.getByTestId('move-entry')).toHaveText(['Thu 7:45 AMTea with milk40 kcal', 'Thu 8:15 AMMorning walkworkout'])
      // The new day is not empty, so the line above the list does not say it is.
      await expect(sheet.getByTestId('sleep-effect')).toHaveText('This starts a new waking day.')
      // Both are before 9:00 AM, so a 9:00 wake moves nothing and says nothing.
      await sheet.getByTestId('sleep-time-input').fill('9')
      await expect(sheet.getByTestId('sleep-moves')).toHaveCount(0)
      await expect(sheet.getByTestId('sleep-effect')).toHaveText('This starts a new, empty waking day.')
      await page.keyboard.press('Escape')
      expect(await read(page, E2E_KEYS.mine)).toBe(text)
    })

    test('"I woke at 8" with nothing logged for last night: the editor points to Add a missed night', async ({ page }) => {
      // Nights up to Wed 7:10 AM only, now Thu 10:00 AM: Wednesday's day runs on and holds Thursday's tea and yogurt.
      const log = logOf([N1, N2], MEALS)
      await openOwnLog(page, log)
      await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 7:10 AM')
      // Today is Thursday, so the night that started this day is named by its day, not "last night".
      if (look !== 'night') {
        await expect(page.getByTestId('sleep-section').getByTestId('sleep-edit')).toHaveText('Edit the night before Wed')
        // The row under it agrees: the same night, named by its day, never "Last night".
        await expect(page.getByTestId('sleep-section').getByTestId('last-night-label')).toHaveText('Night before Wed')
      }
      await page.getByTestId('waking-day').click()
      const editor = await opened(page, 'sleep-editor')
      await expect(editor.getByTestId('editor-missed-hint')).toHaveText('Slept since Wed? Add that night with “Add a missed night” below.')
      await editor.getByTestId('editor-add-night').click()
      const add = await opened(page, 'sleep-editor')
      await expect(add.locator('.sheet-title')).toHaveText('Add a missed night')
      await expect(add.getByTestId('editor-missed-hint')).toHaveCount(0)
      // It starts on today, the day after Wednesday's wake; type 8 and Save.
      await expect(add.getByTestId('edit-wake-date-input')).toHaveValue('2026-11-05')
      await add.getByTestId('edit-wake-time-input').fill('8')
      await expect(add.getByTestId('edit-wake-readback')).toHaveText('Reads as Thu 8:00 AM. Type pm for the evening.')
      await add.getByTestId('edit-night-save').click()
      // The 8:30 AM yogurt moves to the new day; the 7:45 AM tea stays on Wednesday's.
      const warning = await opened(page, 'move-warning')
      await expect(warning.getByTestId('move-group').locator('h3')).toHaveText('From Wed’s day (woke 7:10 AM) to Thu’s day (woke 8:00 AM)')
      await expect(warning.getByTestId('move-entry')).toHaveText(['Thu 8:30 AMYogurt150 kcal'])
      expect(await read(page, E2E_KEYS.mine)).toBe(log)
      await warning.getByTestId('moves-save').click()
      await expect(page.getByTestId('waking-day')).toHaveText('Thu · awake since 8:00 AM')
      expect(await dayMealNames(page)).toEqual(['Yogurt'])
      if (look !== 'night') await expect(page.getByTestId('sleep-section').getByTestId('last-night-label')).toHaveText('Last night')
      // The latest night now woke today, so the hint is gone.
      await page.getByTestId('waking-day').click()
      await expect((await opened(page, 'sleep-editor')).getByTestId('editor-missed-hint')).toHaveCount(0)
    })

    test('layout: the header wake time hugs its focus ring with a 44 px target, and the sleep head fits at 320 px', async ({ page }) => {
      await openOwnLog(page, FULL_LOG)
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        // The button's own box is the text (one line, two at 320), so the focus ring hugs it; the tap
        // target (::after) runs 4 px above and 20 px below, all inside the header.
        const m = await page.evaluate(() => {
          const b = document.querySelector('[data-testid="waking-day"]') as HTMLElement
          const r = b.getBoundingClientRect()
          const header = (document.querySelector('.app-header') as HTMLElement).getBoundingClientRect()
          const hit = (y: number) => document.elementFromPoint(r.left + 6, y)?.closest('[data-testid="waking-day"]') !== null
          const covered: boolean[] = []
          for (let y = r.top - 3; y <= r.bottom + 19; y += 2) covered.push(hit(y))
          return {
            lineHeight: parseFloat(getComputedStyle(b).lineHeight) || 20,
            height: r.height,
            covered: covered.every(Boolean),
            above: hit(r.top - 6),
            below: hit(r.bottom + 22),
            inHeader: r.bottom + 20 <= header.bottom + 0.5,
          }
        })
        expect(m.height, `wake button height at ${width}`).toBeLessThanOrEqual(width === 320 ? 2 * m.lineHeight + 2 : m.lineHeight + 2)
        expect(m.covered, `44 px target at ${width}`).toBe(true)
        expect(m.above, `target stops under Profile and privacy at ${width}`).toBe(false)
        expect(m.below, `target stops 20 px below at ${width}`).toBe(false)
        expect(m.inHeader, `target inside the header at ${width}`).toBe(true)
      }

      // An earlier day at 320 px: "Edit the night before Wed" wraps under the status instead of
      // running past the section, and nothing scrolls sideways.
      await page.setViewportSize({ width: 320, height: 640 })
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 7:10 AM')
      if (look !== 'night') {
        const edit = page.getByTestId('sleep-section').getByTestId('sleep-edit')
        await expect(edit).toHaveText('Edit the night before Wed')
        const fits = await page.evaluate(() => {
          const sec = (document.querySelector('[data-testid="sleep-section"]') as HTMLElement).getBoundingClientRect()
          const e = (document.querySelector('[data-testid="sleep-edit"]') as HTMLElement).getBoundingClientRect()
          return e.right <= sec.right + 0.5 && e.left >= sec.left - 0.5
        })
        expect(fits).toBe(true)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    })

    test('layout: each Edit in the sleep section hugs its focus ring, with a 44 px tap target', async ({ page }) => {
      await openOwnLog(page, FULL_LOG)
      if (look === 'night') {
        // Nothing splits the timeline from its own "Each night": the sleep section comes straight after it.
        const next = await page.getByTestId('timeline').evaluate((t) => t.nextElementSibling?.getAttribute('data-testid'))
        expect(next).toBe('sleep-section')
      }
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await openNights(page)
        const ids = look === 'night' ? ['night-edit'] : ['sleep-edit', 'night-edit']
        for (const id of ids) {
          const edit = page.getByTestId('sleep-section').getByTestId(id).first()
          // Reached by the keyboard, as a keyboard user would, so the focus ring shows.
          await edit.focus()
          await page.keyboard.press('Tab')
          await page.keyboard.press('Shift+Tab')
          await expect(edit).toBeFocused()
          const m = await edit.evaluate((b) => {
            const r = b.getBoundingClientRect()
            const x = r.left + r.width / 2
            const cy = r.top + r.height / 2
            // 44 px tall: its own target covers 14 px each side of the line, and the rest reaches
            // the next night's Edit where two rows' targets meet (rows are under 44 px apart).
            const at = (y: number) => document.elementFromPoint(x, y)
            const covered: boolean[] = []
            for (let y = cy - 21; y <= cy + 21; y += 2) {
              const e = at(y)
              covered.push(Math.abs(y - cy) <= 14 ? e === b : e === b || (e?.matches('.night-edit, .sleep-edit') ?? false))
            }
            // 44 px wide from its right edge, even for the short word "Edit".
            const wide = document.elementFromPoint(r.right - 42, cy) === b
            return {
              lineHeight: parseFloat(getComputedStyle(b).lineHeight) || 21,
              height: r.height,
              covered: covered.every(Boolean),
              wide,
              ring: getComputedStyle(b).outlineStyle,
            }
          })
          expect(m.height, `${id} hugs its words at ${width}`).toBeLessThanOrEqual(m.lineHeight + 2)
          expect(m.covered, `${id} 44 px tall target at ${width}`).toBe(true)
          expect(m.wide, `${id} 44 px wide target at ${width}`).toBe(true)
          expect(m.ring, `${id} shows its focus ring at ${width}`).toBe('solid')
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      }
    })

    test('the order check: each problem next to its field, what was typed kept, nothing saved', async ({ page }) => {
      await openOwnLog(page, FULL_LOG)
      if (look === 'night') await expect(page.getByTestId('tl-wake').getByTestId('tl-edit-cue')).toBeVisible()
      else await expect(page.getByTestId('sleep-section').getByTestId('sleep-edit')).toHaveText('Edit last night')
      await editFromSleepSection(page, look)
      const editor = await opened(page, 'sleep-editor')
      await expect(editor.getByTestId('edit-wake-time-input')).toHaveValue('7:20 AM')

      // A wake before its sleep start.
      await editor.getByTestId('edit-wake-date-input').fill('2026-11-04')
      await editor.getByTestId('edit-wake-time-input').fill('10 pm')
      await editor.getByTestId('edit-night-save').click()
      await expect(editor.getByTestId('edit-wake-error')).toHaveText(
        'Waking up has to come after going to sleep (Wed 11:10 PM). Nothing was saved; change the time and try again.',
      )
      await expect(editor.getByTestId('edit-wake-time-input')).toHaveAttribute('aria-invalid', 'true')
      await expect(editor.getByTestId('edit-wake-date-input')).toHaveValue('2026-11-04')
      await expect(editor.getByTestId('edit-wake-time-input')).toHaveValue('10:00 PM')
      await expect(editor.getByTestId('edit-sleep-error')).toHaveCount(0)
      expect(await read(page, E2E_KEYS.mine)).toBe(FULL_LOG)

      // A wake time in the future (now is Thu 10:00 AM).
      await editor.getByTestId('edit-wake-date-input').fill('2026-11-05')
      await editor.getByTestId('edit-wake-time-input').fill('11:30')
      await editor.getByTestId('edit-night-save').click()
      await expect(editor.getByTestId('edit-wake-error')).toHaveText('That time is later than now. Pick a time up to now.')
      // The time is what is wrong here, so it is the field marked.
      await expect(editor.getByTestId('edit-wake-time-input')).toHaveAttribute('aria-invalid', 'true')
      await expect(editor.getByTestId('edit-wake-date-input')).not.toHaveAttribute('aria-invalid')
      // A date after today: the same message, with the date marked instead of the time.
      await editor.getByTestId('edit-wake-date-input').fill('2026-11-06')
      await editor.getByTestId('edit-wake-time-input').fill('7:20 am')
      await expect(editor.getByTestId('edit-wake-error')).toHaveText('That time is later than now. Pick a time up to now.')
      await expect(editor.getByTestId('edit-wake-date-input')).toHaveAttribute('aria-invalid', 'true')
      await expect(editor.getByTestId('edit-wake-time-input')).not.toHaveAttribute('aria-invalid')
      await editor.getByTestId('edit-wake-date-input').fill('2026-11-05')

      // A sleep start before the night before's wake (Wed 7:10 AM): on the sleep field.
      await editor.getByTestId('edit-wake-time-input').fill('7:20 am')
      await editor.getByTestId('edit-sleep-time-input').fill('6:50 am')
      await editor.getByTestId('edit-night-save').click()
      await expect(editor.getByTestId('edit-sleep-error')).toHaveText(
        'Going to sleep has to come after the last wake time (Wed Nov 4, 7:10 AM). Nothing was saved; change the time and try again.',
      )
      await expect(editor.getByTestId('edit-wake-error')).toHaveCount(0)

      // Something that isn't a time.
      await editor.getByTestId('edit-sleep-time-input').fill('late')
      await editor.getByTestId('edit-night-save').click()
      await expect(editor.getByTestId('edit-sleep-error')).toHaveText('Type a time like 8, 8am, 8:15 pm or 20:30.')
      await expect(editor.getByTestId('edit-sleep-time-input')).toHaveValue('late')
      await page.keyboard.press('Escape')
      expect(await read(page, E2E_KEYS.mine)).toBe(FULL_LOG)

      // A new night that runs into a recorded one names it.
      await (await openNights(page)).getByTestId('add-night').click()
      const add = await opened(page, 'sleep-editor')
      await expect(add.locator('.sheet-title')).toHaveText('Add a missed night')
      // No gap between this log's nights and today has its wake, so it starts on the day before the
      // earliest wake (Mon Nov 2), never on a date that already has one; nothing else is offered.
      await expect(add.getByTestId('edit-wake-date-input')).toHaveValue('2026-11-02')
      await expect(add.locator('.editor-more')).toHaveCount(0)
      await add.getByTestId('edit-wake-date-input').fill('2026-11-05')
      await add.getByTestId('edit-sleep-time-input').fill('22:00')
      await add.getByTestId('edit-wake-time-input').fill('6')
      await add.getByTestId('edit-night-save').click()
      await expect(add.getByTestId('edit-wake-error')).toHaveText(
        'That overlaps another recorded night (Wed Nov 4, 11:10 PM to Thu 7:20 AM). Nothing was saved.',
      )
      await page.keyboard.press('Escape')
      expect(await read(page, E2E_KEYS.mine)).toBe(FULL_LOG)

      // A sleep date before 2000 is refused under the sleep field, not the wake.
      await editFromSleepSection(page, look)
      const old = await opened(page, 'sleep-editor')
      await old.getByTestId('edit-sleep-date-input').fill('1999-12-31')
      await old.getByTestId('edit-night-save').click()
      await expect(old.getByTestId('edit-sleep-error')).toHaveText('Pick a date in 2000 or later.')
      await expect(old.getByTestId('edit-wake-error')).toHaveCount(0)
      await page.keyboard.press('Escape')

      // A bare 11 for the sleep reads as 11:00 AM: the length line asks to check AM and PM.
      await editFromSleepSection(page, look)
      const long = await opened(page, 'sleep-editor')
      await long.getByTestId('edit-sleep-time-input').fill('11')
      await expect(long.getByTestId('edit-sleep-readback')).toHaveText('Reads as Wed 11:00 AM. Type pm for the evening.')
      await expect(long.getByTestId('edit-length')).toHaveText('20 h 20 min of sleep. That is a long night. Check AM and PM on both times.')
      await page.keyboard.press('Escape')
      expect(await read(page, E2E_KEYS.mine)).toBe(FULL_LOG)
    })

    test('a missed night splits a day that ran on because that night had no record', async ({ page }) => {
      await openOwnLog(page, GAP_LOG)
      // Tuesday's day runs on to Thursday's wake, so it holds Wednesday's meals too.
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('waking-day')).toHaveText('Tue · awake since 7:00 AM')
      expect(await dayMealNames(page)).toEqual(['Porridge', 'Rye toast', 'Lentil salad'])

      await (await openNights(page)).getByTestId('add-night').click()
      const add = await opened(page, 'sleep-editor')
      await expect(add.locator('.sheet-title')).toHaveText('Add a missed night')
      // It starts on the day after the day on screen; the sleep date follows the wake.
      await expect(add.getByTestId('edit-wake-date-input')).toHaveValue('2026-11-04')
      await expect(add.getByTestId('edit-sleep-date-input')).toHaveValue('2026-11-03')
      await add.getByTestId('edit-sleep-time-input').fill('11:45 pm')
      await add.getByTestId('edit-wake-time-input').fill('7:40')
      await expect(add.getByTestId('edit-sleep-readback')).toHaveText('Reads as Tue 11:45 PM.')
      await expect(add.getByTestId('edit-wake-readback')).toHaveText('Reads as Wed 7:40 AM. Type pm for the evening.')
      await expect(add.getByTestId('edit-length')).toHaveText('7 h 55 min of sleep.')
      await add.getByTestId('edit-night-save').click()

      // Wednesday's two meals move from Tuesday's day to the new Wednesday day; Porridge stays.
      const warning = await opened(page, 'move-warning')
      await expect(warning.getByTestId('move-group').locator('h3')).toHaveText(
        'From Tue’s day (woke 7:00 AM) to Wed’s day (woke 7:40 AM)',
      )
      await expect(warning.getByTestId('move-entry')).toHaveText(['Wed 8:30 AMRye toast220 kcal', 'Wed 1:00 PMLentil salad450 kcal'])
      await warning.getByTestId('moves-save').click()
      await expect(page.getByTestId('move-warning')).toHaveCount(0)

      await expect(page.getByTestId('waking-day')).toHaveText('Tue · awake since 7:00 AM')
      expect(await dayMealNames(page)).toEqual(['Porridge'])
      await page.getByTestId('day-next').click()
      await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 7:40 AM')
      expect(await dayMealNames(page)).toEqual(['Rye toast', 'Lentil salad'])
      const saved = await stored(page)
      expect(saved.sleeps).toHaveLength(3)
      expect(saved.sleeps[2]).toEqual({ id: expect.any(String), sleepStart: '2026-11-03T23:45:00-05:00', wake: '2026-11-04T07:40:00-05:00' })
      expect(saved.meals).toEqual(MEALS)
    })

    test('from today, Add a missed night starts on the gap; two nights on the same weekday show their dates', async ({ page }) => {
      // Nights waking Tue Oct 27, Tue Nov 3 and Thu Nov 5: nothing recorded for Wed Nov 4.
      const lastWeek = { id: 'n0', sleepStart: '2026-10-26T23:00:00-05:00', wake: '2026-10-27T06:50:00-05:00' }
      await openOwnLog(page, logOf([lastWeek, N1, N3], MEALS))
      const nights = await openNights(page)
      await expect(nights.getByTestId('night-row').locator('.k')).toHaveText([
        'Night before Thu',
        'Night before Tue Nov 3',
        'Night before Tue Oct 27',
      ])
      await expect(nights.getByTestId('night-edit').nth(1)).toHaveAccessibleName('Edit the night before Tue Nov 3')
      await nights.getByTestId('add-night').click()
      const add = await opened(page, 'sleep-editor')
      // Today already has its wake, so it starts on Wed Nov 4, the day with no wake recorded.
      await expect(add.getByTestId('edit-wake-date-input')).toHaveValue('2026-11-04')
      await expect(add.getByTestId('edit-sleep-date-input')).toHaveValue('2026-11-03')
    })

    test('delete a wrong night, after a confirmation that lists what moves; Keep it changes nothing', async ({ page }) => {
      await openOwnLog(page, FULL_LOG)
      const nights = await openNights(page)
      await expect(nights.getByTestId('night-row')).toHaveCount(3)
      const thu = nights.getByTestId('night-row').filter({ hasText: 'Night before Thu' })
      await expect(thu.getByTestId('night-edit')).toHaveAccessibleName('Edit the night before Thu')
      await thu.getByTestId('night-edit').click()
      const editor = await opened(page, 'sleep-editor')
      await expect(editor.getByTestId('edit-wake-time-input')).toHaveValue('7:20 AM')
      await editor.getByTestId('delete-night').click()

      const confirm = await opened(page, 'delete-night-sheet')
      await expect(confirm.locator('.sheet-title')).toHaveText('Delete this night?')
      await expect(confirm.getByTestId('delete-night-range')).toHaveText('The night Wed Nov 4, 11:10 PM to Thu 7:20 AM will be removed.')
      // The list has its own lead-in, like the move warning's; "No entries change day." is not shown.
      await expect(confirm.getByTestId('delete-moves-intro')).toHaveText(
        'Deleting it moves these entries to another waking day. Each keeps its own date and time.',
      )
      await expect(confirm.getByTestId('delete-no-moves')).toHaveCount(0)
      await expect(confirm.getByTestId('move-group').locator('h3')).toHaveText('From Thu’s day (woke 7:20 AM) to Wed’s day (woke 7:10 AM)')
      await expect(confirm.getByTestId('move-entry')).toHaveText(['Thu 7:45 AMTea with milk40 kcal', 'Thu 8:30 AMYogurt150 kcal'])

      await confirm.getByTestId('delete-night-keep').click()
      await opened(page, 'sleep-editor')
      expect(await read(page, E2E_KEYS.mine)).toBe(FULL_LOG)
      await page.getByTestId('delete-night').click()
      await (await opened(page, 'delete-night-sheet')).getByTestId('delete-night-confirm').click()
      await expect(page.getByTestId('delete-night-sheet')).toHaveCount(0)

      await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 7:10 AM')
      expect(await dayMealNames(page)).toEqual(['Rye toast', 'Lentil salad', 'Tea with milk', 'Yogurt'])
      const saved = await stored(page)
      expect(saved.sleeps).toEqual([N1, N2])
      expect(saved.meals).toEqual(MEALS)
    })

    test('no warning when nothing moves: a new sleep time saves straight away', async ({ page }) => {
      await openOwnLog(page, FULL_LOG)
      await page.getByTestId('waking-day').click()
      const editor = await opened(page, 'sleep-editor')
      await editor.getByTestId('edit-sleep-time-input').fill('22:40')
      await expect(editor.getByTestId('edit-length')).toHaveText('8 h 40 min of sleep.')
      await editor.getByTestId('edit-night-save').click()
      await expect(page.getByTestId('sleep-editor')).toHaveCount(0)
      await expect(page.getByTestId('move-warning')).toHaveCount(0)
      expect((await stored(page)).sleeps[2]).toEqual({ ...N3, sleepStart: '2026-11-04T22:40:00-05:00' })
      if (look !== 'night') await expect(page.getByTestId('last-night')).toHaveText('8 h 40 min')
      else await expect(page.getByTestId('tl-wake').getByTestId('last-night')).toHaveText('slept 8 h 40 min')
    })

    test('from Set wake time, the whole night: the move warning lists what leaves the day with no wake time', async ({ page }) => {
      // No night recorded yet: every meal waits in the day with no wake time.
      await openOwnLog(page, logOf([], MEALS.slice(2)))
      await page.getByTestId('set-wake').click()
      const setWake = await opened(page, 'set-wake-sheet')
      const addNight = setWake.getByTestId('set-wake-add-night')
      await expect(addNight).toHaveText('Add the whole night instead')
      // Its box hugs the words (so does the focus ring) and its tap target is 44 px tall, centred.
      const t = await addNight.evaluate((b) => {
        const r = b.getBoundingClientRect()
        const x = r.left + 10
        const cy = r.top + r.height / 2
        const hits: boolean[] = []
        for (let y = cy - 21; y <= cy + 21; y += 3) hits.push(document.elementFromPoint(x, y) === b)
        return { height: r.height, lineHeight: parseFloat(getComputedStyle(b).lineHeight) || 24, covered: hits.every(Boolean) }
      })
      expect(t.height).toBeLessThanOrEqual(t.lineHeight + 2)
      expect(t.covered).toBe(true)
      await addNight.click()
      const add = await opened(page, 'sleep-editor')
      await expect(add.locator('.sheet-title')).toHaveText('Add a missed night')
      await expect(add.getByTestId('edit-wake-date-input')).toHaveValue('2026-11-05')
      await add.getByTestId('edit-sleep-time-input').fill('11:30 pm')
      await add.getByTestId('edit-wake-time-input').fill('7')
      await expect(add.getByTestId('edit-sleep-date-input')).toHaveValue('2026-11-04')
      await add.getByTestId('edit-night-save').click()
      // Tea (7:45 AM) and Yogurt (8:30 AM) move into the new day; Wednesday's meals stay before it.
      const warning = await opened(page, 'move-warning')
      await expect(warning.getByTestId('move-group').locator('h3')).toHaveText(
        'From the day with no wake time to Thu’s day (woke 7:00 AM)',
      )
      await expect(warning.getByTestId('move-entry')).toHaveText(['Thu 7:45 AMTea with milk40 kcal', 'Thu 8:30 AMYogurt150 kcal'])
      await warning.getByTestId('moves-save').click()
      await expect(page.getByTestId('waking-day')).toHaveText('Thu · awake since 7:00 AM')
      expect(await dayMealNames(page)).toEqual(['Tea with milk', 'Yogurt'])
      expect((await stored(page)).sleeps).toEqual([
        { id: expect.any(String), sleepStart: '2026-11-04T23:30:00-05:00', wake: '2026-11-05T07:00:00-05:00' },
      ])
    })

    test('times in the editor’s sentences never split from their AM or PM, at 320 and 390 px', async ({ page }) => {
      await openOwnLog(page, FULL_LOG)
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: width === 320 ? 640 : 844 })
        // The order-check message (a wake before its sleep at Wed 11:10 PM).
        await page.getByTestId('waking-day').click()
        const editor = await opened(page, 'sleep-editor')
        await editor.getByTestId('edit-wake-date-input').fill('2026-11-04')
        await editor.getByTestId('edit-wake-time-input').fill('10 pm')
        await editor.getByTestId('edit-night-save').click()
        await expect(editor.getByTestId('edit-wake-error')).toContainText('(Wed 11:10 PM)')
        await timesStayWhole(editor.getByTestId('edit-wake-error'), `order check at ${width}`)
        await timesStayWhole(editor.getByTestId('sleep-editor-intro'), `intro at ${width}`)
        // The overlap message names a whole night.
        await editor.getByTestId('edit-wake-date-input').fill('2026-11-05')
        await editor.getByTestId('edit-wake-time-input').fill('7:20 am')
        await editor.getByTestId('edit-sleep-date-input').fill('2026-11-03')
        await editor.getByTestId('edit-sleep-time-input').fill('11:30 pm')
        await editor.getByTestId('edit-night-save').click()
        await expect(editor.locator('.field-error')).toContainText('Tue Nov 3, 11:50 PM to Wed 7:10 AM')
        await timesStayWhole(editor.locator('.field-error'), `overlap at ${width}`)
        // The delete confirmation and its move list.
        await editor.getByTestId('edit-sleep-date-input').fill('2026-11-04')
        await editor.getByTestId('edit-sleep-time-input').fill('11:10 pm')
        await editor.getByTestId('delete-night').click()
        const confirm = await opened(page, 'delete-night-sheet')
        await timesStayWhole(confirm.getByTestId('delete-night-range'), `delete line at ${width}`)
        await timesStayWhole(confirm.getByTestId('move-group').locator('h3'), `move heading at ${width}`)
        await page.keyboard.press('Escape')
        await expect(page.getByTestId('delete-night-sheet')).toHaveCount(0)
      }
      expect(await read(page, E2E_KEYS.mine)).toBe(FULL_LOG)
    })

    test('Add a missed night from an earlier day never starts on a date that already has a wake', async ({ page }) => {
      await openOwnLog(page, FULL_LOG)
      await page.getByTestId('day-prev').click()
      await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 7:10 AM')
      await page.getByTestId('waking-day').click()
      await (await opened(page, 'sleep-editor')).getByTestId('editor-add-night').click()
      const add = await opened(page, 'sleep-editor')
      await expect(add.locator('.sheet-title')).toHaveText('Add a missed night')
      // Thu Nov 5 (the day after Wednesday) already has its 7:20 AM wake and the log has no gap, so
      // it starts on Mon Nov 2, the day before the earliest wake; 7 AM there saves with no clash.
      await expect(add.getByTestId('edit-wake-date-input')).toHaveValue('2026-11-02')
      await add.getByTestId('edit-wake-time-input').fill('7')
      await add.getByTestId('edit-night-save').click()
      await expect(page.getByTestId('sleep-editor')).toHaveCount(0)
      expect((await stored(page)).sleeps).toHaveLength(4)
    })

    test('in the demo, a date past its limit shows only the limit, not the line about moving forward', async ({ page }) => {
      await page.clock.setFixedTime(DEMO_NOW)
      await page.goto('/')
      await page.getByRole('button', { name: 'Try the fictional demo' }).click()
      await expect(page.getByTestId('dashboard')).toBeVisible()
      await page.getByTestId('waking-day').click()
      const editor = await opened(page, 'sleep-editor')
      const wakeDate = await editor.getByTestId('edit-wake-date-input').inputValue()
      const max = await editor.getByTestId('edit-wake-date-input').getAttribute('max')
      // A wake at 11:00 PM on the demo's last allowed date is later than its clock: it moves forward.
      await editor.getByTestId('edit-wake-date-input').fill(max as string)
      await editor.getByTestId('edit-wake-time-input').fill('11 pm')
      await expect(editor.getByTestId('edit-demo-advance')).toHaveText('This is later than the demo’s clock, so the demo moves forward to it.')
      // A mistyped year: the limit says what to pick, and nothing claims the demo moves to 2062.
      await editor.getByTestId('edit-wake-date-input').fill(`2062${(max as string).slice(4)}`)
      await expect(editor.getByTestId('edit-demo-advance')).toHaveCount(0)
      await editor.getByTestId('edit-night-save').click()
      await expect(editor.getByTestId('edit-wake-error')).toContainText('In the demo, pick a date up to')
      await expect(editor.getByTestId('edit-demo-advance')).toHaveCount(0)
      // Back within the limit, the line returns.
      await editor.getByTestId('edit-wake-date-input').fill(max as string)
      await expect(editor.getByTestId('edit-wake-error')).toHaveCount(0)
      await expect(editor.getByTestId('edit-demo-advance')).toBeVisible()
      expect(wakeDate <= (max as string)).toBe(true)
    })

    test('in the demo, Wednesday’s wake moved to 6 PM names the meals that would move first', async ({ page }) => {
      await page.clock.setFixedTime(DEMO_NOW)
      await page.goto('/')
      await page.getByRole('button', { name: 'Try the fictional demo' }).click()
      await expect(page.getByTestId('dashboard')).toBeVisible()
      // From the previous day's sleep section too: it opens that day's own night.
      await page.getByTestId('day-prev').click()
      await editFromSleepSection(page, look)
      const tue = await opened(page, 'sleep-editor')
      await expect(tue).toContainText('Sample person — fictional')
      await expect(tue.getByTestId('edit-sleep-time-input')).toHaveValue('')
      await expect(tue.getByTestId('edit-sleep-hint')).toHaveText('Blank: the sleep time isn’t logged.')
      await expect(tue.getByTestId('edit-wake-date-input')).toHaveValue('2026-10-20')
      await expect(tue.getByTestId('edit-wake-time-input')).toHaveValue('1:05 PM')
      await page.keyboard.press('Escape')
      if (look === 'night') {
        // The timeline's last point, when Sam went to sleep, opens the night that closed Tuesday.
        await page.getByTestId('tl-end').getByTestId('tl-edit').click()
        const closing = await opened(page, 'sleep-editor')
        await expect(closing.getByTestId('edit-sleep-time-input')).toHaveValue('4:35 AM')
        await expect(closing.getByTestId('edit-wake-time-input')).toHaveValue('1:20 PM')
        await page.keyboard.press('Escape')
      }

      await page.getByTestId('day-today').click()
      await page.getByTestId('waking-day').click()
      const editor = await opened(page, 'sleep-editor')
      await editor.getByTestId('edit-wake-time-input').fill('6 pm')
      await editor.getByTestId('edit-night-save').click()
      const warning = await opened(page, 'move-warning')
      await expect(warning.getByTestId('move-group').locator('h3')).toHaveText('From Wed’s day (woke 1:20 PM) to Tue’s day (woke 1:05 PM)')
      await expect(warning.getByTestId('move-entry')).toHaveText([
        'Wed 1:50 PMKefir with oats and blueberries410 kcal',
        'Wed 5:30 PMPasta bake (ready meal)760 kcal',
      ])
      await warning.getByTestId('moves-save').click()
      await expect(page.getByTestId('waking-day')).toHaveText('Wed · awake since 6:00 PM')
      expect(await dayMealNames(page)).toEqual(['Chicken, rice and broccoli', 'Lentil soup from the café', 'Apple and peanut butter'])
    })
  })
}
