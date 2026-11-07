// Build-out item 2.9: every number on the dashboard opens its detail, in every look.
//
// The tap-through test reads the dashboard as it is drawn and finds every piece of visible figure
// text (FIGURE below), except inside a name the person typed (marked data-name: a guest name, or a
// meal's name inside a sentence; a meal's own row opens its details, so its name there counts). Each one must sit inside an element marked data-opens, which names the test
// id of what a tap on it opens ("expand" for a disclosure that shows more in place). A number
// without it fails the test by name, so a number added later without a detail is caught. Then the
// test taps each number where it is drawn (a real tap at the middle of its text, not a click on a
// chosen element), checks that what it names opens, and closes it again. Text inside a closed
// disclosure is not drawn, so it is not read there; a second test opens every disclosure and reads
// what is in them. A figure is a digit, or a word standing for a figure ("unknown", "not logged").
//
// It runs on the demo's Wednesday (calories eaten as the headline), Monday (a workout, so net),
// Friday (a meal with unknown calories), and an invented own log for Sam whose Wednesday has a
// number of every kind (net known entries only, a gym session, weigh-ins, the estimated deficit
// or surplus, macros with a missing value), awake and asleep. Night's macro chip is opened too.
//
// Then the journeys of item 2.9, in every look: a macro's detail, the sleep details, the foods
// stored on a meal and its lookup, and the meal row's score opening its explanation in one tap
// while the rest of the row opens the meal's details. And their layout at 320, 390 and 1440 px.
//
// The people here are the fictional Sam: the demo week (fixtures/demo-week.json) and tapLog.ts.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { LOOKS, startInLook } from './looks'
import { E2E_KEYS } from './storage-keys'
import { samNoBedtime, samWednesday } from './tapLog'

// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock).
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')
const SAM_NOW = new Date('2026-10-21T20:00:00-04:00')
const SAM_ASLEEP_NOW = new Date('2026-10-22T02:00:00-04:00')

/** Every detail a dashboard number may open, by its test id. */
const DETAILS = [
  'eaten-sheet',
  'workouts-sheet',
  'explain-ranges',
  'explain-net',
  'explain-day',
  'explain-balance',
  'explain-meal',
  'targets-sheet',
  'macro-details',
  'meal-details',
  'workout-details',
  'weight-details',
  'sleep-details',
  'sleep-editor',
]

/** Text with its no-break spaces read as plain ones, and its word joiners (U+2060) dropped. */
const plain = (s: string) => s.replace(/ /g, ' ').replace(/⁠/g, '')

/** Open the demo on its first day; a page that already has it open goes straight to it. */
async function openDemo(page: Page) {
  await page.clock.setFixedTime(DEMO_NOW)
  await page.goto('/')
  const tryDemo = page.getByRole('button', { name: 'Try the fictional demo' })
  await expect(tryDemo.or(page.getByTestId('dashboard'))).toBeVisible()
  if (await tryDemo.isVisible()) await tryDemo.click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

async function seedOwn(page: Page, doc: unknown, now: Date) {
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

async function opened(page: Page, testId: string): Promise<Locator> {
  const sheet = page.getByTestId(testId)
  await expect(sheet).toBeVisible()
  return sheet
}

async function closeWithEsc(page: Page, testId: string) {
  await page.keyboard.press('Escape')
  await expect(page.getByTestId(testId)).toHaveCount(0)
}

async function settle(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
}

function row(page: Page, name: string): Locator {
  return page.getByTestId('meal-row').filter({ hasText: name })
}

async function showDay(page: Page, steps: number) {
  for (let i = 0; i < steps; i += 1) await page.getByTestId('day-prev').click()
}

interface Found {
  text: string
  opens: string | null
  /** Inside a list marked data-detail: an opened disclosure's body, which is itself the detail. */
  inDetail: boolean
}

/**
 * A number, or the words that stand for an entry's number that is not known ("unknown", "not
 * logged"): each of these is a figure on the dashboard and must open its detail too. "Not available
 * yet" is not one: it says there is nothing logged yet, so there is no detail behind it.
 */
const FIGURE = /\d|\bunknown\b|\bnot logged\b/i

/**
 * Every visible figure (FIGURE: a digit, or "unknown" and the like) inside `scope` (the dashboard by default), with what
 * its nearest data-opens says it opens (null when nothing does). Text that is hidden from sight
 * (visually-hidden, inside a closed disclosure, or not drawn) is left out. Each one is numbered on
 * the page, so it can be tapped by its number afterwards.
 */
async function findNumbers(page: Page, scope = '[data-testid="dashboard"]'): Promise<Found[]> {
  return page.evaluate(([sel, src]) => {
    const root = document.querySelector(sel)
    if (!root) return []
    const nodes: Text[] = []
    const out: { text: string; opens: string | null; inDetail: boolean }[] = []
    const figure = new RegExp(src, 'i')
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const t = walker.currentNode as Text
      if (!figure.test(t.data)) continue
      const el = t.parentElement as HTMLElement
      if (el.closest('.visually-hidden')) continue
      // A name the person typed (data-name) may hold a digit; it is not a number.
      if (el.closest('[data-name]')) continue
      // A closed disclosure's content is not drawn (Chrome still gives it boxes).
      const d = el.closest('details')
      if (d && !d.open && !el.closest('summary')) continue
      if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue
      const range = document.createRange()
      range.selectNodeContents(t)
      if (![...range.getClientRects()].some((r) => r.width > 0 && r.height > 0)) continue
      if (getComputedStyle(el).visibility !== 'visible') continue
      nodes.push(t)
      out.push({ text: t.data.trim(), opens: el.closest<HTMLElement>('[data-opens]')?.dataset.opens ?? null, inDetail: el.closest('[data-detail]') !== null })
    }
    ;(window as unknown as { __numbers: Text[] }).__numbers = nodes
    return out
  }, [scope, FIGURE.source] as const)
}

/** Bring number `i` to the middle of the window and say where its text is drawn now. */
async function pointOf(page: Page, i: number): Promise<{ x: number; y: number }> {
  return page.evaluate((i) => {
    const t = (window as unknown as { __numbers: Text[] }).__numbers[i]
    ;(t.parentElement as HTMLElement).scrollIntoView({ block: 'center' })
    const range = document.createRange()
    range.selectNodeContents(t)
    const r = [...range.getClientRects()].find((r) => r.width > 0 && r.height > 0) as DOMRect
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, i)
}

/**
 * The tap-through: every number has a detail, and a tap on it opens that detail. Returns what was
 * tapped, so a caller can check that the numbers it expects were among them.
 */
async function tapThrough(page: Page, scope?: string): Promise<Found[]> {
  const found = await findNumbers(page, scope)
  expect(found.length).toBeGreaterThan(0)
  // Every number names its detail; a number with none fails here, by its text.
  expect(found.filter((f) => f.opens === null).map((f) => f.text)).toEqual([])
  for (const [i, f] of found.entries()) {
    expect([...DETAILS, 'expand'], `"${f.text}" names a detail this test knows`).toContain(f.opens)
    const { x, y } = await pointOf(page, i)
    if (f.opens === 'expand') {
      // A disclosure: the tap shows more in place, and a second tap folds it again.
      const owner = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('summary, [aria-expanded]')
        return el ? (el.tagName === 'SUMMARY' ? 'summary' : 'button') : null
      }, { x, y })
      expect(owner, `"${f.text}" is drawn on its disclosure`).not.toBeNull()
      const state = () =>
        page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('summary, [aria-expanded]')
          if (!el) return null
          return el.tagName === 'SUMMARY' ? (el.parentElement as HTMLDetailsElement).open : el.getAttribute('aria-expanded') === 'true'
        }, { x, y })
      expect(await state()).toBe(false)
      await page.mouse.click(x, y)
      await expect.poll(state, { message: `"${f.text}" opens in place` }).toBe(true)
      await page.mouse.click(x, y)
      await expect.poll(state).toBe(false)
      continue
    }
    await page.mouse.click(x, y)
    const sheet = page.getByTestId(f.opens as string)
    await expect(sheet, `a tap on "${f.text}" opens ${f.opens}`).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  return found
}

function opensOf(found: Found[], text: string | RegExp): string[] {
  return found.filter((f) => (typeof text === 'string' ? plain(f.text) === text : text.test(plain(f.text)))).map((f) => f.opens as string)
}

for (const look of LOOKS) {
  test.describe(`${look.name} look: every dashboard number opens its detail`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look.id)
    })

    test('the demo’s Wednesday: the headline, ranges, score, target, macros, meals and sleep', async ({ page }) => {
      await openDemo(page)
      const found = await tapThrough(page)
      expect(opensOf(found, '2,280')).toEqual(['eaten-sheet'])
      expect(opensOf(found, look.id === 'night' ? 'score 54' : look.id === 'panel' ? 'Estimate score 54 · biggest uncertainty' : 'Score 54')).toEqual([
        'explain-meal',
      ])
      expect(opensOf(found, '760 kcal')).toEqual(['meal-details'])
      expect(opensOf(found, /8 h 45 min/)).toEqual(['sleep-details'])
      expect(opensOf(found, /8 h 49 min/)).toEqual(['sleep-details'])
      if (look.id === 'night') {
        expect(opensOf(found, /^P 124/)).toEqual(['expand'])
        // The macros under the opened chip open their detail too.
        await page.getByTestId('macro-chip').click()
        const inGrid = await tapThrough(page, '[data-testid="night-macros"]')
        expect(opensOf(inGrid, '124 g')).toEqual(['macro-details'])
        expect(opensOf(inGrid, 'Target 130 g')).toEqual(['macro-details'])
      } else {
        expect(opensOf(found, '124 g')).toEqual(['macro-details'])
        expect(opensOf(found, '272 g')).toEqual(['macro-details'])
      }
    })

    test('the demo’s Monday (net, with a workout) and Friday (a meal with unknown calories)', async ({ page }) => {
      await openDemo(page)
      await showDay(page, 2)
      await expect(page.getByTestId('headline')).toHaveAttribute('data-mode', 'net')
      const mon = await tapThrough(page)
      expect(opensOf(mon, '1,250')).toEqual(['explain-net'])
      expect(opensOf(mon, /210 kcal/).length).toBeGreaterThan(0)
      await showDay(page, 3)
      await expect(page.getByTestId('unknown-count')).toBeVisible()
      const fri = await tapThrough(page)
      expect(opensOf(fri, '1 meal with unknown calories')).toEqual(['eaten-sheet'])
    })

    test('Sam’s own Wednesday: net known entries only, gym, weight, the estimate and missing macros; then asleep', async ({ page }) => {
      await seedOwn(page, samWednesday(), SAM_NOW)
      await expect(page.getByTestId('gym-summary')).toBeVisible()
      await expect(page.getByTestId('balance')).toBeVisible()
      const own = await tapThrough(page)
      expect(opensOf(own, '1 workout with unknown calories burned')).toEqual(['workouts-sheet'])
      expect(opensOf(own, /^71\.6/)).toEqual(['weight-details'])
      if (look.id !== 'night') expect(opensOf(own, '1 entry missing')).toEqual(['macro-details'])

      await seedOwn(page, samWednesday(true), SAM_ASLEEP_NOW)
      const asleep = await tapThrough(page)
      expect(opensOf(asleep, /11:40 PM/).length).toBeGreaterThan(0)
    })

    // A disclosure's body is drawn only once it is opened, so the scan above does not read it. Here
    // every disclosure on the dashboard is opened: each figure in it must open a detail too, or sit
    // in a list marked data-detail, one that is itself the detail its disclosure opens (each night,
    // with its own Edit). A figure added inside a disclosure with neither fails here.
    test('every disclosure opened: each figure in it opens a detail, or is in the list that is the detail', async ({ page }) => {
      for (const [doc, now] of [[null, DEMO_NOW], [samWednesday(), SAM_NOW], [samWednesday(true), SAM_ASLEEP_NOW]] as const) {
        if (doc === null) await openDemo(page)
        else await seedOwn(page, doc, now)
        const count = await page.locator('[data-testid="dashboard"] details').evaluateAll((ds) => {
          for (const d of ds) (d as HTMLDetailsElement).open = true
          return ds.length
        })
        expect(count).toBeGreaterThan(0)
        const found = await findNumbers(page)
        expect(found.filter((f) => f.inDetail).length, 'the opened disclosures were read').toBeGreaterThan(0)
        expect(found.filter((f) => f.opens === null && !f.inDetail).map((f) => f.text)).toEqual([])
        // A list may stand as its own detail only inside a disclosure.
        const stray = await page.locator('[data-testid="dashboard"] [data-detail]').evaluateAll((els) => els.filter((e) => !e.closest('details')).length)
        expect(stray).toBe(0)
      }
    })
  })
}

for (const look of LOOKS) {
  test.describe(`${look.name} look: the details item 2.9 adds`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look.id)
    })

    test('a macro opens its detail: meals, how a missing value is handled, no range yet, the target', async ({ page }) => {
      await openDemo(page)
      if (look.id === 'night') await page.getByTestId('macro-chip').click()
      const protein = page.getByTestId('macro-protein')
      await expect(protein).toHaveAccessibleName('Protein 124 g. Opens the protein detail.')
      await protein.click()
      const sheet = await opened(page, 'macro-details')
      await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Protein')
      await expect(sheet.getByTestId('macro-detail-total')).toHaveText('124 g')
      await expect(sheet.getByTestId('macro-detail-missing')).toHaveCount(0)
      await expect(sheet.getByTestId('macro-detail-target')).toHaveText('130 g')
      await expect(sheet.getByTestId('macro-detail-target-share')).toHaveText('The day’s total is 95% of it.')
      await expect(sheet.getByTestId('macro-detail-range')).toHaveText(
        'No range yet: ranges cover calories only for now. This total adds up the values entered for each meal.',
      )
      await expect(sheet.getByTestId('macro-detail-unknowns')).toHaveText(
        'A meal with no protein value is left out of the total and counted as missing, never as 0 g.',
      )
      // Each meal's own value with how you know it; the five add up to the total.
      const meals = sheet.getByTestId('macro-detail-meal')
      await expect(meals).toHaveCount(5)
      await expect(meals.nth(0)).toContainText('Kefir with oats and blueberries')
      await expect(meals.nth(0)).toContainText('1:50 PM · Nutrition label (typed)')
      await expect(meals.nth(0).getByTestId('macro-detail-meal-value')).toHaveText('20 g')
      await expect(meals.nth(0).getByTestId('macro-detail-meal-share')).toHaveText('16%')
      await expect(meals.nth(0).getByRole('button')).toHaveAccessibleName(
        'Kefir with oats and blueberries, 1:50 PM · Nutrition label (typed), 20 g, 16% of the known total. Opens the meal details.',
      )
      const values = await sheet.getByTestId('macro-detail-meal-value').allInnerTexts()
      expect(values.map((v) => Number(v.replace(' g', ''))).reduce((a, b) => a + b, 0)).toBe(124)
      // A meal opens its details; closing them comes back to the macro.
      await meals.nth(1).getByRole('button').click()
      const details = await opened(page, 'meal-details')
      await expect(details.getByRole('heading', { level: 2 })).toHaveText('Pasta bake (ready meal)')
      await closeWithEsc(page, 'meal-details')
      await opened(page, 'macro-details')
      // Change targets opens the editor, and Cancel comes back here.
      await page.getByTestId('macro-detail-targets').click()
      await opened(page, 'targets-sheet')
      await closeWithEsc(page, 'targets-sheet')
      await opened(page, 'macro-details')
      await closeWithEsc(page, 'macro-details')

      // Carbs: no target set, so it says so and offers Set targets.
      if (look.id === 'night' && !(await page.getByTestId('night-macros').isVisible())) await page.getByTestId('macro-chip').click()
      await page.getByTestId('macro-carbs').click()
      const carbs = await opened(page, 'macro-details')
      await expect(carbs.getByTestId('macro-detail-target')).toHaveText('No carbs target set.')
      await expect(carbs.getByTestId('macro-detail-target-share')).toHaveCount(0)
      await expect(carbs.getByTestId('macro-detail-targets')).toHaveText('Set targets')
    })

    test('a macro with a meal missing its value says the total is a floor, and never counts it as 0', async ({ page }) => {
      await seedOwn(page, samWednesday(), SAM_NOW)
      if (look.id === 'night') await page.getByTestId('macro-chip').click()
      await page.getByTestId('macro-carbs').click()
      const sheet = await opened(page, 'macro-details')
      await expect(sheet.getByTestId('macro-detail-total')).toHaveText('87 g')
      await expect(sheet.getByTestId('macro-detail-missing')).toContainText(
        '1 meal has no carbs value, so the day’s total is at least 87 g.',
      )
      await expect(sheet.getByTestId('macro-detail-target-share')).toHaveText(
        'The day’s total is at least 34% of it: the meals with no value could add more.',
      )
      const curry = sheet.getByTestId('macro-detail-meal').filter({ hasText: 'Chickpea curry' })
      await expect(curry.getByTestId('macro-detail-meal-value')).toHaveText('no value')
      await expect(curry.getByTestId('macro-detail-meal-share')).toHaveCount(0)
    })

    test('last night and the 7-night average open the sleep details; Edit there comes back to them', async ({ page }) => {
      await openDemo(page)
      const lastNight = page.getByTestId(look.id === 'night' ? 'tl-wake' : 'sleep-section').getByTestId('last-night')
      await expect(lastNight).toHaveText(look.id === 'night' ? 'slept 8 h 45 min' : '8 h 45 min')
      await lastNight.click()
      const sheet = await opened(page, 'sleep-details')
      await expect(sheet.locator('.sheet-sub')).toHaveText('The nights up to the wake on Wed Oct 21, 1:20 PM')
      await expect(sheet.getByTestId('sleep-detail-now')).toHaveText(/Now\s*Awake/)
      await expect(sheet.getByTestId('sleep-detail-last-label')).toHaveText('Last night')
      await expect(sheet.getByTestId('sleep-detail-length')).toHaveText('8 h 45 min')
      await expect(sheet.getByTestId('sleep-detail-length')).toHaveClass(/big-figure/)
      await expect(sheet.getByTestId('sleep-detail-last')).toHaveText(/Went to sleep\s*Wed 4:35 AM\s*Woke\s*Wed 1:20 PM/)
      await expect(sheet.getByTestId('sleep-detail-average')).toHaveText('8 h 49 min')
      await expect(sheet.getByTestId('sleep-detail-count')).toHaveText('6 of 7 nights')
      await expect(sheet).toContainText('A night with either time not logged is left out, never counted as 0.')
      await expect(sheet.getByTestId('sleep-detail-source')).toHaveText('From the sleep and wake times in this log.')
      // Each night is listed with its Edit; the night with no sleep time says so.
      await expect(sheet.getByTestId('night-row')).toHaveCount(7)
      await expect(sheet.getByTestId('night-row').filter({ hasText: 'Night before Tue' })).toContainText('not logged')
      // Edit opens the editor on that night; closing it comes back to the sleep details.
      await sheet.getByTestId('sleep-detail-edit').click()
      await opened(page, 'sleep-editor')
      await closeWithEsc(page, 'sleep-editor')
      await opened(page, 'sleep-details')
      await closeWithEsc(page, 'sleep-details')
      // Focus is back on what opened it: the figure on Night's point, the rows' button elsewhere.
      await expect(look.id === 'night' ? lastNight : page.getByTestId('sleep-open')).toBeFocused()

      // The 7-night average opens the same details.
      const avg = page.getByTestId(look.id === 'night' ? 'timeline' : 'sleep-section').getByTestId('sleep-average').first()
      await avg.click()
      await opened(page, 'sleep-details')
      await closeWithEsc(page, 'sleep-details')

      // On an earlier day it names that day's night, and says nothing about now.
      await showDay(page, 1)
      await page.getByTestId(look.id === 'night' ? 'tl-wake' : 'sleep-section').getByTestId('last-night').click()
      const tue = await opened(page, 'sleep-details')
      await expect(tue.getByTestId('sleep-detail-now')).toHaveCount(0)
      await expect(tue.getByTestId('sleep-detail-last-label')).toHaveText('Night before this day')
      await expect(tue.getByTestId('sleep-detail-length')).toHaveText('not logged')
      await expect(tue.getByTestId('sleep-detail-last')).toHaveText(/Went to sleep\s*not logged\s*Woke\s*Tue 1:05 PM/)
      await expect(tue.getByTestId('sleep-detail-edit')).toHaveText('Edit the night before Tue')
    })

    test('saving a night from the sleep details comes back to them, with the change in them', async ({ page }) => {
      await seedOwn(page, samWednesday(), SAM_NOW)
      await page.getByTestId(look.id === 'night' ? 'tl-wake' : 'sleep-section').getByTestId('last-night').click()
      const sheet = await opened(page, 'sleep-details')
      await expect(sheet.getByTestId('sleep-detail-length')).toHaveText('7 h 50 min')
      await sheet.getByTestId('sleep-detail-edit').click()
      const editor = await opened(page, 'sleep-editor')
      await editor.getByTestId('edit-sleep-time-input').fill('11:40 pm')
      await editor.getByTestId('edit-sleep-time-input').press('Tab')
      await editor.getByTestId('edit-night-save').click()
      const back = await opened(page, 'sleep-details')
      await expect(back.getByTestId('sleep-detail-length')).toHaveText('7 h 20 min')
    })

    test('a meal’s details list the foods stored on it with their amounts, and where its values come from', async ({ page }) => {
      await openDemo(page)
      await row(page, 'Kefir with oats and blueberries').getByTestId('meal-open').click()
      const sheet = await opened(page, 'meal-details')
      const foods = sheet.getByTestId('meal-foods')
      await expect(foods.getByRole('heading')).toHaveText('Foods in this meal')
      await expect(foods.getByTestId('meal-food')).toHaveText([/kefir\s*6 oz/, /rolled oats\s*1 serving/, /blueberries\s*1 serving/])
      // No food here lists fiber, so the note says nothing of it.
      await expect(foods.getByTestId('meal-foods-note')).toHaveText(
        'Listed as parts of the meal. The calories and macros above are the meal’s own totals, from how you know them: Nutrition label (typed). No food here has its own calories or macros. This list is kept as it was saved with the meal: “Edit” does not change it yet.',
      )
      await closeWithEsc(page, 'meal-details')

      // A meal with no foods stored shows no foods section.
      await row(page, 'Pasta bake (ready meal)').getByTestId('meal-open').click()
      await expect((await opened(page, 'meal-details')).getByTestId('meal-foods')).toHaveCount(0)
      await closeWithEsc(page, 'meal-details')

      // The saved barcode lookup on Tuesday says how much was eaten.
      await showDay(page, 1)
      await row(page, 'Granola bar').getByTestId('meal-open').click()
      const bar = await opened(page, 'meal-details')
      // With no foods stored, the section is the lookup alone, and is named so.
      await expect(bar.getByTestId('meal-foods').getByRole('heading')).toHaveText('Lookup')
      await expect(bar.getByTestId('meal-lookup')).toHaveText('Barcode lookup · saved result · whole package')
      await expect(bar.getByTestId('meal-lookup-unused')).toHaveCount(0)
    })

    test('after an edit of how you know a meal’s values, its lookup says it is not used now', async ({ page }) => {
      await openDemo(page)
      await showDay(page, 1)
      await row(page, 'Granola bar').getByTestId('meal-open').click()
      const sheet = await opened(page, 'meal-details')
      await expect(sheet.getByTestId('meal-lookup-unused')).toHaveCount(0)
      await sheet.getByTestId('edit-meal').click()
      const edit = await opened(page, 'log-meal-sheet')
      await edit.getByTestId('source-photo').check()
      await edit.getByTestId('save-meal').click()
      await row(page, 'Granola bar').getByTestId('meal-open').click()
      const after = await opened(page, 'meal-details')
      await expect(after.getByTestId('details-source')).toContainText('Photo estimate')
      // The stored lookup is kept (nothing is wiped), and said plainly to be unused now.
      await expect(after.getByTestId('meal-lookup')).toContainText('Barcode lookup · saved result · whole package')
      await expect(after.getByTestId('meal-lookup-unused')).toHaveText('Not used now: this meal’s values come from Photo estimate, not from this lookup.')
      // Set apart from the lookup's own lines: a callout, with a gap above it.
      await expect(after.getByTestId('meal-lookup-unused')).toHaveClass(/callout/)
      const gap = await after.getByTestId('meal-lookup-unused').evaluate((u) => {
        const parts = (u.parentElement as Element).querySelector('[data-testid="meal-lookup-parts"]') as Element
        return u.getBoundingClientRect().top - parts.getBoundingClientRect().bottom
      })
      expect(gap).toBeGreaterThanOrEqual(6)
      // (A looked-up label is set only by a lookup, so the way back is covered by the unit test.)
    })

    test('the foods note follows an edit of how you know the meal’s values', async ({ page }) => {
      await seedOwn(page, samWednesday(), SAM_NOW)
      await row(page, 'Overnight oats').getByTestId('meal-open').click()
      const sheet = await opened(page, 'meal-details')
      await expect(sheet.getByTestId('meal-food')).toHaveText([/rolled oats\s*50 g\s*fiber 10 g per 100 g/, /milk\s*8 oz/, /raspberries\s*1 serving/])
      await expect(sheet.getByTestId('meal-foods-note')).toContainText('from how you know them: Nutrition label (typed).')
      // The oats list fiber, which has no source of its own: the note says so.
      await expect(sheet.getByTestId('meal-foods-note')).toContainText('Fiber per 100 g is as it was saved with the food, with no source saved for it.')
      await sheet.getByTestId('edit-meal').click()
      const edit = await opened(page, 'log-meal-sheet')
      await edit.getByTestId('source-weighed').check()
      await edit.getByTestId('save-meal').click()
      await row(page, 'Overnight oats').getByTestId('meal-open').click()
      const after = await opened(page, 'meal-details')
      await expect(after.getByTestId('meal-foods-note')).toContainText('from how you know them: Weighed.')
      await expect(after.getByTestId('meal-food')).toHaveCount(3)
      await closeWithEsc(page, 'meal-details')
      // A lookup's fetch date is written out, never as a raw date.
      await row(page, 'Cereal bar').getByTestId('meal-open').click()
      const bar = await opened(page, 'meal-details')
      await expect(bar.getByTestId('meal-lookup')).toHaveText(/Barcode lookup · saved result · whole package \(45 g\) · fetched Fri Oct 2/)
      // Each part keeps its dot after it: no line of the lookup starts with "·".
      const starts = await bar.getByTestId('meal-lookup-parts').evaluate((p) => {
        const lefts = new Map<number, string>()
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const t = walker.currentNode as Text
          for (let i = 0; i < t.data.length; i += 1) {
            if (t.data[i] === ' ') continue
            const r = document.createRange()
            r.setStart(t, i)
            r.setEnd(t, i + 1)
            const box = r.getBoundingClientRect()
            const top = Math.round(box.top)
            if (!lefts.has(top)) lefts.set(top, t.data[i])
          }
        }
        return [...lefts.values()]
      })
      expect(starts).not.toContain('·')
    })

    test('a meal row has two targets: the score opens its explanation in one tap, the rest of the row the meal’s details', async ({ page }) => {
      await openDemo(page)
      const pasta = row(page, 'Pasta bake (ready meal)')
      // Two targets for the meal (Night also puts Improve on the biggest uncertainty's own point).
      await expect(pasta.getByRole('button')).toHaveCount(look.id === 'night' ? 3 : 2)
      if (look.id === 'night') await expect(pasta.getByRole('button').nth(2)).toHaveAttribute('data-testid', 'improve-entry')
      await expect(pasta.getByTestId('meal-open')).toHaveAccessibleName(
        look.id === 'panel'
          ? 'Pasta bake (ready meal), 5:30 PM · Photo estimate, 760 kcal, Estimate score 54 · biggest uncertainty. Opens the meal details.'
          : look.id === 'night'
            ? 'Pasta bake (ready meal), 5:30 PM · Photo estimate, 760 kcal, Estimate score 54 · biggest uncertainty. Opens the meal details.'
            : 'Pasta bake (ready meal), 5:30 PM · Photo estimate, 760 kcal, Estimate score 54. Opens the meal details.',
      )
      const score = pasta.getByTestId('meal-score')
      await expect(score).toHaveAccessibleName(
        look.id === 'journal'
          ? 'Pasta bake (ready meal): Estimate score 54. Opens the score explanation.'
          : 'Pasta bake (ready meal): Estimate score 54 · biggest uncertainty. Opens the score explanation.',
      )
      // One tap on the score: its explanation, with the meal's own numbers.
      await score.click()
      const explain = await opened(page, 'explain-meal')
      await expect(explain.getByRole('heading', { level: 2 })).toHaveText('How sure: Pasta bake (ready meal)')
      await expect(explain.getByTestId('meal-score-sentence')).toContainText('A 54% estimate score')
      await closeWithEsc(page, 'explain-meal')
      await expect(score).toBeFocused()
      // A tap on the calories, the time or the name opens the meal's details.
      for (const part of [pasta.locator('.meal-kcal'), look.id === 'night' ? pasta.locator('.tl-time') : pasta.locator('.meal-meta'), pasta.locator('.meal-name')]) {
        const box = (await part.boundingBox())!
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        await opened(page, 'meal-details')
        await closeWithEsc(page, 'meal-details')
      }
      // By keyboard: the row's button, then its score.
      await pasta.getByTestId('meal-open').focus()
      await page.keyboard.press('Tab')
      await expect(score).toBeFocused()
      await page.keyboard.press('Enter')
      await opened(page, 'explain-meal')
      await closeWithEsc(page, 'explain-meal')
      // A meal with no score has one target only.
      await showDay(page, 5)
      const unknown = page.getByTestId('meal-row').filter({ hasText: 'unknown' }).first()
      await expect(unknown.getByRole('button')).toHaveCount(1)
      await expect(unknown.getByTestId('meal-score')).toHaveText(look.id === 'night' ? 'no estimate score' : 'No estimate score')
    })

    test('the eaten detail behind the headline gives the target and the best estimate’s share of it', async ({ page }) => {
      await openDemo(page)
      await page.getByTestId(look.id === 'panel' ? 'target-ring' : 'headline-open').click()
      const sheet = await opened(page, 'eaten-sheet')
      await expect(sheet.getByTestId('eaten-total')).toHaveText('2,280 kcal')
      await expect(sheet.getByTestId('eaten-target')).toContainText('2,400 kcal')
      await expect(sheet.getByTestId('eaten-target-share')).toHaveText('The best estimate is 95% of it.')
      // Each row's score opens its explanation here too.
      await sheet.getByTestId('meal-row').filter({ hasText: 'Pasta bake' }).getByTestId('meal-score').click()
      await opened(page, 'explain-meal')
    })
  })
}

for (const look of LOOKS) {
  test.describe(`${look.name} look: item 2.9's figures agree, its back-chains hold, and its names and styles say what each thing is`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look.id)
    })

    /** Sam's Wednesday with the oats at 18.4 g protein, so the day's protein is 44.4 g. */
    function samTenth() {
      const doc = samWednesday()
      doc.meals[0].protein = 18.4
      return doc
    }

    async function openProtein(page: Page) {
      if (look.id === 'night' && !(await page.getByTestId('night-macros').isVisible())) await page.getByTestId('macro-chip').click()
      await page.getByTestId('macro-protein').click()
      return opened(page, 'macro-details')
    }

    test('a macro total given to a tenth says how the dashboard shows it', async ({ page }) => {
      await seedOwn(page, samTenth(), SAM_NOW)
      if (look.id === 'night') await page.getByTestId('macro-chip').click()
      await expect(page.getByTestId('macro-protein')).toHaveAccessibleName('Protein 44 g. Opens the protein detail.')
      const sheet = await openProtein(page)
      await expect(sheet.getByTestId('macro-detail-total')).toHaveText('44.4 g')
      await expect(sheet.getByTestId('macro-detail-rounded')).toHaveText('Shown on the dashboard as 44 g, rounded to the gram.')
      await closeWithEsc(page, 'macro-details')
      // A whole-gram total is the same on both, so no line.
      await page.getByTestId('macro-fat').click()
      await expect((await opened(page, 'macro-details')).getByTestId('macro-detail-rounded')).toHaveCount(0)
    })

    test('a meal opened from a macro’s detail goes back to it after Edit’s Cancel, Edit’s Save and Delete', async ({ page }) => {
      await seedOwn(page, samWednesday(), SAM_NOW)
      let sheet = await openProtein(page)
      await expect(sheet.getByTestId('macro-detail-meal')).toHaveCount(3)
      // Edit, then Cancel: back on the meal's details, then Close: back on the macro.
      await sheet.getByTestId('macro-detail-meal').filter({ hasText: 'Overnight oats' }).getByRole('button').click()
      await (await opened(page, 'meal-details')).getByTestId('edit-meal').click()
      await (await opened(page, 'log-meal-sheet')).getByTestId('cancel-meal').click()
      await expect(page.getByTestId('log-meal-sheet')).toHaveCount(0)
      await expect((await opened(page, 'meal-details')).getByRole('heading', { level: 2 })).toHaveText('Overnight oats')
      await closeWithEsc(page, 'meal-details')
      sheet = await opened(page, 'macro-details')
      // Edit, then Save: the meal's details with the change, then the macro with it.
      await sheet.getByTestId('macro-detail-meal').filter({ hasText: 'Cereal bar' }).getByRole('button').click()
      await (await opened(page, 'meal-details')).getByTestId('edit-meal').click()
      const edit = await opened(page, 'log-meal-sheet')
      await edit.getByTestId('meal-protein-input').fill('6')
      await edit.getByTestId('save-meal').click()
      await expect(page.getByTestId('log-meal-sheet')).toHaveCount(0)
      await opened(page, 'meal-details')
      await closeWithEsc(page, 'meal-details')
      sheet = await opened(page, 'macro-details')
      await expect(sheet.getByTestId('macro-detail-total')).toHaveText('46 g')
      // Delete: back on the macro, without the meal.
      await sheet.getByTestId('macro-detail-meal').filter({ hasText: 'Cereal bar' }).getByRole('button').click()
      const details = await opened(page, 'meal-details')
      await details.getByTestId('delete-meal').click()
      await details.getByTestId('delete-confirm-btn').click()
      sheet = await opened(page, 'macro-details')
      await expect(sheet.getByTestId('macro-detail-meal')).toHaveCount(2)
      await expect(sheet.getByTestId('macro-detail-total')).toHaveText('40 g')
    })

    test('deleting a day’s last meal from a macro’s detail leaves it saying no meals are logged, never 0 g', async ({ page }) => {
      const doc = samWednesday()
      doc.meals = doc.meals.filter((m) => m.id === 'm-oats')
      await seedOwn(page, doc, SAM_NOW)
      let sheet = await openProtein(page)
      await expect(sheet.getByTestId('macro-detail-total')).toHaveText('18 g')
      await sheet.getByTestId('macro-detail-meal').getByRole('button').click()
      const details = await opened(page, 'meal-details')
      await details.getByTestId('delete-meal').click()
      await details.getByTestId('delete-confirm-btn').click()
      sheet = await opened(page, 'macro-details')
      const total = sheet.getByTestId('macro-detail-total')
      await expect(total).toHaveText('No meals logged')
      // A status in the figure slot: plain, normal-weight text, not the number style.
      const style = await total.evaluate((el) => ({ cls: el.className, weight: getComputedStyle(el).fontWeight, numeric: getComputedStyle(el).fontVariantNumeric }))
      expect(style.cls).not.toContain('num')
      expect(style.cls).not.toContain('big-figure')
      expect(style.weight).toBe('400')
      expect(style.numeric).not.toContain('tabular-nums')
      await expect(sheet.locator('.sheet-sub')).toHaveCount(0)
      await expect(sheet.getByTestId('macro-detail-no-meals')).toHaveText('No meals are logged on this day, so there is no total yet.')
      await expect(sheet.getByTestId('macro-detail-meal')).toHaveCount(0)
      await expect(sheet.getByTestId('macro-detail-missing')).toHaveCount(0)
      await expect(sheet.getByTestId('macro-detail-target')).toHaveText('120 g')
      await expect(sheet.getByTestId('macro-detail-target-share')).toHaveText('Not compared while no meals are logged.')
      await expect(sheet.locator('.big-figure')).toHaveCount(0)
    })

    test('a meal’s score opened from its details, opened from a macro’s detail, goes back along the same way', async ({ page }) => {
      await seedOwn(page, samWednesday(), SAM_NOW)
      const sheet = await openProtein(page)
      await sheet.getByTestId('macro-detail-meal').filter({ hasText: 'Overnight oats' }).getByRole('button').click()
      await (await opened(page, 'meal-details')).getByTestId('details-score').click()
      await opened(page, 'explain-meal')
      await closeWithEsc(page, 'explain-meal')
      await expect((await opened(page, 'meal-details')).getByRole('heading', { level: 2 })).toHaveText('Overnight oats')
      await closeWithEsc(page, 'meal-details')
      await opened(page, 'macro-details')
      await closeWithEsc(page, 'macro-details')
      // From the dashboard, the score's explanation still closes to the dashboard.
      await row(page, 'Overnight oats').getByTestId('meal-open').click()
      await (await opened(page, 'meal-details')).getByTestId('details-score').click()
      await closeWithEsc(page, 'explain-meal')
      await expect(page.getByTestId('meal-details')).toHaveCount(0)
    })

    test('the sleep details: a missing length and an average not available yet are plain status text, not bold figures', async ({ page }) => {
      await seedOwn(page, samNoBedtime(), SAM_NOW)
      if (look.id !== 'night') {
        await expect(page.getByTestId('sleep-open')).toHaveAccessibleName(
          `${(await page.getByTestId('last-night-label').textContent())!.trim()} not logged, 7-night average not available yet, 0 of 1 night. Opens the sleep details.`,
        )
      }
      await page.getByTestId(look.id === 'night' ? 'tl-now' : 'sleep-open').click()
      const sheet = await opened(page, 'sleep-details')
      for (const [id, text] of [
        ['sleep-detail-length', 'not logged'],
        ['sleep-detail-average', 'Not available yet'],
      ] as const) {
        const el = sheet.getByTestId(id)
        await expect(el).toHaveText(text)
        const st = await el.evaluate((e) => ({ cls: e.className, weight: getComputedStyle(e).fontWeight, numeric: getComputedStyle(e).fontVariantNumeric }))
        expect(st.cls).not.toContain('num')
        expect(st.cls).not.toContain('details-unknown-title')
        expect(st.weight).toBe('400')
        expect(st.numeric).not.toContain('tabular-nums')
      }
    })

    test('the sleep rows’ spoken name gives both figures, then what opens', async ({ page }) => {
      await seedOwn(page, samWednesday(), SAM_NOW)
      if (look.id === 'night') {
        // Night: each sleep figure on the timeline, and its point for now, says what it shows, then a
        // plain full stop before what opens.
        const opens = page.locator('[data-opens="sleep-details"]:visible')
        expect(await opens.count()).toBeGreaterThan(0)
        for (const b of await opens.all()) {
          const visible = plain((await b.textContent())!).replace(/\s+/g, ' ').trim()
          expect(visible.length).toBeGreaterThan(0)
          await expect(b).toHaveAccessibleName(/^\S.*[^ .]\. Opens the sleep details\.$/)
        }
        await expect(page.getByTestId('tl-now')).toHaveAccessibleName(/7-night avg .+\. Opens the sleep details\.$/)
        return
      }
      const label = (await page.getByTestId('last-night-label').textContent())!.trim()
      const last = (await page.getByTestId('last-night').textContent())!.trim()
      await expect(page.getByTestId('sleep-open')).toHaveAccessibleName(
        plain(`${label} ${last}, 7-night average ${(await page.getByTestId('sleep-average').locator('.sleep-duration').textContent())!.trim()}, 6 of 7 nights. Opens the sleep details.`),
      )
    })

    test('the sleep details on a log with no wake time yet do not point at a wake time', async ({ page }) => {
      const doc = samNoBedtime()
      doc.sleeps = []
      await seedOwn(page, doc, SAM_NOW)
      await page.getByTestId(look.id === 'night' ? 'tl-now' : 'sleep-open').click()
      const sheet = await opened(page, 'sleep-details')
      await expect(sheet.locator('.sheet-sub')).toHaveText('This day has no wake time yet')
      await expect(sheet.getByTestId('sleep-detail-last')).toHaveText('No night is logged yet.')
    })

    test('names say what is unknown and what opens; a workout’s score is plain text, not a meal score’s link', async ({ page }) => {
      // The demo's Friday: a meal with unknown calories, listed under Missing information.
      await openDemo(page)
      await showDay(page, 5)
      const meal = page.getByTestId('missing-info').getByTestId('missing-meal').getByRole('button')
      const name = (await meal.textContent())!.trim()
      expect(name.length).toBeGreaterThan(0)
      await expect(meal).toHaveAccessibleName(`${name}, calories unknown. Opens the meal details.`)

      await seedOwn(page, samWednesday(), SAM_NOW)
      await expect(page.getByTestId('missing-workout').getByRole('button')).toHaveAccessibleName(
        'Swim, calories burned unknown. Opens the workout details.',
      )
      // A workout row opens its details as a whole: its score has the meta's soft ink and no underline.
      const push = page.getByTestId('workout-row').filter({ hasText: 'Push' })
      const style = await push.evaluate((r) => {
        const score = getComputedStyle(r.querySelector('[data-testid="workout-score"]') as Element)
        const meta = getComputedStyle(r.querySelector('.meal-meta, .tl-meta') as Element)
        return { score: score.color, meta: meta.color, line: score.textDecorationLine }
      })
      expect(style.score).toBe(style.meta)
      expect(style.line).toBe('none')
      // A meal's score is its own underlined button.
      const oatsScore = row(page, 'Overnight oats').getByTestId('meal-score')
      await expect(oatsScore).toHaveJSProperty('tagName', 'BUTTON')
      expect(await oatsScore.evaluate((b) => getComputedStyle(b).textDecorationLine)).toBe('underline')

    })

    if (look.id === 'panel') {
      test('Panel: the ring’s spoken names end in a plain full stop; pressing a meal’s score does not tilt its row', async ({ page }) => {
        await openDemo(page)
        await expect(page.getByTestId('target-ring')).toHaveAccessibleName('2,280 kcal, 95% of 2,400 kcal daily target. Opens the meals behind it.')
        await showDay(page, 2)
        await expect(page.getByTestId('target-ring')).toHaveAccessibleName('1,250 kcal net. Opens how net is worked out.')
        await expect(page.getByTestId('ring-caption')).toHaveAccessibleName('Ring: eaten, 60% of 2,400 kcal daily target. Opens the meals behind it.')
        await page.getByTestId('day-next').click()
        await page.getByTestId('day-next').click()

        const pasta = row(page, 'Pasta bake (ready meal)')
        const line = pasta.locator('.meal-open.meal-line')
        const pressed = async (target: Locator) => {
          await target.scrollIntoViewIfNeeded()
          const box = (await target.boundingBox())!
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
          await page.mouse.down()
          await page.waitForTimeout(250)
          const t = await line.evaluate((el) => getComputedStyle(el).transform)
          await page.mouse.move(0, 0)
          await page.mouse.up()
          return t
        }
        expect(await pressed(pasta.getByTestId('meal-score'))).toBe('none')
        expect(await pressed(pasta.locator('.meal-name'))).not.toBe('none')
      })
    }
  })
}

const SIZES = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]

for (const look of LOOKS) {
  test(`${look.name} look: the new targets and sheets fit at 320, 390 and 1440 px, with rings that hug and 44 px taps`, async ({ page }) => {
    await startInLook(page, look.id)
    for (const size of SIZES) {
      await page.setViewportSize(size)
      await openDemo(page)
      const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(await sideways()).toBeLessThanOrEqual(0)

      // The score button: its box hugs its words, its focus ring hugs the box, and a 44 px tall run
      // of taps reaches it; the row's calories above it still open the meal.
      const pasta = row(page, 'Pasta bake (ready meal)')
      const score = pasta.getByTestId('meal-score')
      await score.evaluate((b) => b.scrollIntoView({ block: 'center' }))
      const tap = await score.evaluate((b) => {
        const r = b.getBoundingClientRect()
        const cx = r.left + r.width / 2
        let best = 0
        let cur = 0
        for (let v = r.top - 30; v <= r.bottom + 30; v += 0.5) {
          cur = b.contains(document.elementFromPoint(cx, v)) ? cur + 0.5 : 0
          best = Math.max(best, cur)
        }
        return { height: r.height, tall: best + 0.5 }
      })
      expect(tap.height).toBeLessThan(30)
      expect(tap.tall).toBeGreaterThanOrEqual(44)
      const kcal = (await pasta.locator('.meal-kcal').boundingBox())!
      const atKcal = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid'), {
        x: kcal.x + kcal.width / 2,
        y: kcal.y + kcal.height / 2,
      })
      expect(atKcal).toBe('meal-open')
      // On every row, the score's tap layer ends inside its own row, so the top edge of the next
      // row opens the next meal, never this one's score; and the score has no z-index of its own,
      // so a sticky sheet header or footer stays above it (checked in a sheet below).
      const spill = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-testid="dashboard"] button.meal-score-btn')].map((b) => {
          const r = b.getBoundingClientRect()
          const line = (b.closest('.meal-line') as HTMLElement).getBoundingClientRect()
          const after = getComputedStyle(b, '::after')
          return { past: Math.round(r.bottom - parseFloat(after.bottom) - line.bottom), z: getComputedStyle(b).zIndex }
        }),
      )
      expect(spill.length).toBeGreaterThan(0)
      for (const sp of spill) {
        expect(sp.past).toBeLessThanOrEqual(0)
        expect(sp.z).toBe('auto')
      }
      await score.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      await expect(score).toBeFocused()
      const ring = await score.evaluate((b) => {
        const s = getComputedStyle(b)
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), offset: parseFloat(s.outlineOffset) }
      })
      expect(ring).toEqual({ style: 'solid', width: 2, offset: 2 })

      // The row's own button draws its ring around the whole row (its tap layer).
      const open = pasta.getByTestId('meal-open')
      await open.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(open).toBeFocused()
      const rowRing = await open.evaluate((b) => {
        const s = getComputedStyle(b, '::after')
        const line = b.closest('.meal-line') as HTMLElement
        const a = line.getBoundingClientRect()
        return { style: s.outlineStyle, inset: s.inset, lineHeight: a.height }
      })
      expect(rowRing.style).toBe('solid')
      expect(rowRing.inset).toBe('0px')
      expect(rowRing.lineHeight).toBeGreaterThanOrEqual(44)

      // The new sheets fit: the macro, the sleep details and the meal's foods.
      const sheets: [string, () => Promise<void>][] = [
        [
          'macro-details',
          async () => {
            if (look.id === 'night') await page.getByTestId('macro-chip').click()
            await page.getByTestId('macro-protein').click()
          },
        ],
        ['sleep-details', () => page.getByTestId(look.id === 'night' ? 'tl-wake' : 'sleep-section').getByTestId('last-night').click()],
        ['meal-details', () => row(page, 'Kefir with oats and blueberries').getByTestId('meal-open').click()],
        ['eaten-sheet', () => page.getByTestId(look.id === 'panel' ? 'target-ring' : 'headline-open').click()],
      ]
      for (const [id, open] of sheets) {
        await open()
        const sheet = await opened(page, id)
        await settle(page)
        expect(await sheet.evaluate((e) => e.scrollWidth - e.clientWidth), `${id} at ${size.width}`).toBeLessThanOrEqual(0)
        expect(await sideways()).toBeLessThanOrEqual(0)
        await closeWithEsc(page, id)
      }

      // The Eaten sheet's meal list scrolls under the sheet's sticky header: wherever a score button
      // passes under it, a tap there lands on the header, never on the score.
      await page.setViewportSize({ width: size.width, height: 480 })
      await page.getByTestId(look.id === 'panel' ? 'target-ring' : 'headline-open').click()
      const eaten = await opened(page, 'eaten-sheet')
      await settle(page)
      const under = await eaten.evaluate(async (dialog) => {
        const header = dialog.querySelector('.sheet > header, header') as HTMLElement
        const scroller = [dialog, ...dialog.querySelectorAll<HTMLElement>('*')].find((e) => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible') as HTMLElement
        const h = header.getBoundingClientRect()
        let checked = 0
        const wrong: string[] = []
        for (let top = 0; top <= scroller.scrollHeight; top += 12) {
          scroller.scrollTop = top
          await new Promise((r) => requestAnimationFrame(() => r(null)))
          for (const b of dialog.querySelectorAll<HTMLElement>('button.meal-score-btn')) {
            const r = b.getBoundingClientRect()
            const y = r.top + r.height / 2
            if (y <= h.top + 1 || y >= h.bottom - 1) continue
            checked += 1
            const hit = document.elementFromPoint(r.left + r.width / 2, y)
            if (!header.contains(hit)) wrong.push(`${b.textContent} at ${top}`)
          }
        }
        return { checked, wrong }
      })
      expect(under.checked, 'a score passed under the header').toBeGreaterThan(0)
      expect(under.wrong).toEqual([])
      await closeWithEsc(page, 'eaten-sheet')
      await page.setViewportSize(size)

      // Small text buttons reach 44 px with a layer, and the larger ones are 44 px tall themselves.
      const small: Locator[] = []
      const large: Locator[] = []
      if (look.id === 'journal') small.push(page.getByTestId('headline-target'))
      if (look.id === 'panel') small.push(page.getByTestId('biggest-share'))
      if (look.id === 'night') {
        small.push(page.getByTestId('tl-wake').getByTestId('last-night'))
        large.push(page.getByTestId('tl-now'))
      } else {
        large.push(page.getByTestId('sleep-open'), page.getByTestId('macro-protein'))
      }
      for (const b of small) {
        const r = await b.evaluate((el) => {
          el.scrollIntoView({ block: 'center' })
          const after = getComputedStyle(el, '::after')
          return { box: el.getBoundingClientRect().height, layer: after.content === 'none' ? 0 : parseFloat(after.height) }
        })
        expect(Math.max(r.box, r.layer)).toBeGreaterThanOrEqual(44)
      }
      for (const b of large) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }

    // A new log's first night with no bedtime: the average is "Not available yet · 0 of 1 night".
    // It wraps inside the sleep section (or the Night point) at 320 px, never running past it.
    await page.setViewportSize({ width: 320, height: 640 })
    await seedOwn(page, samNoBedtime(), SAM_NOW)
    const avg = page.getByTestId('sleep-average')
    await expect(avg).toContainText(/not available yet/i)
    if (look.id !== 'night') await expect(page.getByTestId('night-count')).toHaveText(' · 0 of 1 night')
    const fit = await avg.evaluate((el) => {
      const box = (el.closest('.sleep-open, .section, .tl-point') as HTMLElement).getBoundingClientRect()
      const r = el.getBoundingClientRect()
      return { right: Math.round(r.right - box.right), sideways: document.documentElement.scrollWidth - window.innerWidth }
    })
    expect(fit.right).toBeLessThanOrEqual(0)
    expect(fit.sideways).toBeLessThanOrEqual(0)
    // "Not available yet" is a status: plain text, not the number style of a duration.
    if (look.id !== 'night') {
      const na = await avg.evaluate((el) => {
        const t = el.querySelector('.sleep-na') as Element
        return { cls: el.className, numeric: getComputedStyle(t).fontVariantNumeric, size: getComputedStyle(t).fontSize, weight: getComputedStyle(t).fontWeight }
      })
      expect(na.cls).not.toContain('num')
      expect(na.numeric).not.toContain('tabular-nums')
      expect(na).toMatchObject({ size: '14px', weight: '400' })
    }

    // Journal and Panel: where the average and its count do not fit side by side, the count goes
    // on its own line and its separator is not drawn, so no line ends in " ·". Where they fit, one line.
    if (look.id !== 'night') {
      for (const size of SIZES) {
        await page.setViewportSize(size)
        await seedOwn(page, samWednesday(), SAM_NOW)
        await expect(page.getByTestId('night-count')).toHaveText(' · 6 of 7 nights')
        const r = await page.getByTestId('sleep-section').getByTestId('sleep-average').evaluate((el) => {
          const dur = (el.querySelector('.sleep-duration') as Element).getBoundingClientRect()
          const words = (el.querySelector('.sleep-count-words') as Element).getBoundingClientRect()
          const sep = el.querySelector('.sleep-sep') as Element
          const sepShown = getComputedStyle(sep).display !== 'none'
          const sepBox = sep.getBoundingClientRect()
          return { stacked: words.top >= dur.bottom - 1, sepShown, sepWithWords: !sepShown || Math.abs(sepBox.top - words.top) < 4, sepAfterDur: !sepShown || Math.abs(sepBox.top - dur.top) < 4 }
        })
        // Either one line (separator drawn between them) or stacked with no separator.
        expect(r.stacked ? !r.sepShown : r.sepShown && r.sepWithWords && r.sepAfterDur, JSON.stringify({ size, ...r })).toBe(true)
        if (size.width === 320) expect(r.stacked).toBe(true)
        if (size.width === 1440 && look.id === 'journal') expect(r.stacked).toBe(false)
      }
    }
  })
}
