// Build-out item 2.6 (slice 26; prd.md > Gym Log): "A logged session shows each set with its weight
// and type (warm-up, working or drop set), and survives a reload." Every journey runs once in each
// look this build offers (looks.ts): the numbers are worked out once (gymView.ts), and each look
// only draws them.
//
// The person is the fictional Sam (fixtures/demo-week.json); the push day is invented:
// Bench press: warm-up 40 kg × 10, working 80 kg × 8 and 80 kg × 7, and a drop set 60 kg × 10,
// then 45 kg × 8, then 30 kg × 6. Logged on Sam's Wednesday at 6:30 PM, then found from the gym
// log on a later date, after Sam sleeps and wakes on Thursday and two more days pass.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { LOOKS, startInLook } from './looks'
import { fillWhen } from './sleepFields'
import { E2E_KEYS } from './storage-keys'

// The demo clock starts at Thu 2026-10-22 01:30 local (spec.md > Clock).
const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00')
const TWO_DAYS = 2 * 24 * 60 * 60 * 1000

const PUSH_DAY_LINES = [
  ['Warm-up', '40 kg × 10'],
  ['Working', '80 kg × 8'],
  ['Working', '80 kg × 7'],
  ['Drop set', '60 kg × 10, then 45 kg × 8, then 30 kg × 6'],
]

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

/** Type one set: its type, weight and reps. */
async function fillSet(set: Locator, kind: 'warmup' | 'working' | 'drop', weight: string, reps: string) {
  await set.getByTestId('gym-set-kind').selectOption(kind)
  await set.getByTestId('gym-set-weight').fill(weight)
  await set.getByTestId('gym-set-reps').fill(reps)
}

/** The push day's Bench press, typed into the first exercise, using Add set and Add drop. */
async function typePushDay(sheet: Locator) {
  const ex = sheet.getByTestId('gym-exercise').first()
  await ex.getByTestId('gym-exercise-name').fill('Bench press')
  const sets = ex.getByTestId('gym-set')
  await fillSet(sets.nth(0), 'warmup', '40', '10')
  await ex.getByTestId('gym-add-set').click()
  // Add set copies the set above, and its weight box takes focus.
  await expect(sets.nth(1).getByTestId('gym-set-weight')).toBeFocused()
  await expect(sets.nth(1).getByTestId('gym-set-kind')).toHaveValue('warmup')
  await fillSet(sets.nth(1), 'working', '80', '8')
  await ex.getByTestId('gym-add-set').click()
  await expect(sets.nth(2).getByTestId('gym-set-kind')).toHaveValue('working')
  await expect(sets.nth(2).getByTestId('gym-set-weight')).toHaveValue('80')
  await sets.nth(2).getByTestId('gym-set-reps').fill('7')
  await ex.getByTestId('gym-add-set').click()
  await fillSet(sets.nth(3), 'drop', '60', '10')
  for (const [weight, reps] of [
    ['45', '8'],
    ['30', '6'],
  ]) {
    await sets.nth(3).getByTestId('gym-add-drop').click()
    const drop = sets.nth(3).getByTestId('gym-drop').last()
    await expect(drop.getByTestId('gym-drop-weight')).toBeFocused()
    await drop.getByTestId('gym-drop-weight').fill(weight)
    await drop.getByTestId('gym-drop-reps').fill(reps)
  }
  await expect(sets).toHaveCount(4)
  await expect(sets.nth(3).getByTestId('gym-drop')).toHaveCount(2)
}

/** Every set line of the session's first exercise, as [type, set]. */
async function setLines(scope: Locator): Promise<string[][]> {
  const lines = scope.getByTestId('gym-session-exercise').first().getByTestId('gym-set-line')
  const out: string[][] = []
  for (let i = 0; i < (await lines.count()); i++) {
    // No-break spaces keep "80 kg × 8" on one line; read them as spaces.
    const text = (await lines.nth(i).locator('.gym-set-text').innerText()).replace(/\u00a0/g, ' ')
    out.push([await lines.nth(i).locator('.gym-kind').innerText(), text])
  }
  return out
}

async function openGymLog(page: Page): Promise<Locator> {
  await page.getByTestId('open-more').click()
  await opened(page, 'more-menu')
  await page.getByTestId('more-gym').click()
  return opened(page, 'gym-log')
}

/** I'm going to sleep, then I woke up, with the times given (the demo clock moves there). */
async function sleepAndWake(page: Page, sleep: string, wake: string) {
  for (const when of [sleep, wake]) {
    await page.getByTestId('sleep-action').click()
    const sheet = await opened(page, 'sleep-sheet')
    await fillWhen(sheet, 'sleep', when)
    await sheet.getByTestId('sleep-save').click()
    await expect(sheet).toBeHidden()
  }
}


// Sam's own log for the layout checks: two weigh-ins and three invented gym sessions over ten days,
// the last one today with a long exercise name, a bodyweight set and a drop set.
const LAYOUT_NOW = new Date('2026-10-21T20:00:00-04:00')
function samGymLog(): string {
  const set = (kind: string, weightKg: number | null, reps: number, drops?: [number, number][]) =>
    drops ? { kind, weightKg, reps, drops: drops.map(([w, r]) => ({ weightKg: w, reps: r })) } : { kind, weightKg, reps }
  const gym = (id: string, name: string, startedAt: string, exercises: unknown[]) => ({
    id, name, startedAt, minutes: 60, kcal: 280, source: 'burn_device', gym: { unit: 'kg', exercises },
  })
  return JSON.stringify({
    version: 1,
    kind: 'mine',
    profile: { name: '', kind: 'guest' },
    meals: [{ id: 'm1', name: 'Oats with blueberries', eatenAt: '2026-10-21T08:10:00-04:00', source: 'weighed', kcal: 410, protein: 14, carbs: 68, fat: 9 }],
    sleeps: [
      { id: 's1', sleepStart: '2026-10-11T23:00:00-04:00', wake: '2026-10-12T06:40:00-04:00' },
      { id: 's2', sleepStart: '2026-10-20T23:20:00-04:00', wake: '2026-10-21T06:50:00-04:00' },
    ],
    workouts: [
      gym('g1', 'Push', '2026-10-12T18:00:00-04:00', [
        { name: 'Bench press', sets: [set('warmup', 40, 10), set('working', 75, 8)] },
        { name: 'Lateral raise', sets: [set('drop', 10, 12, [[6, 10]])] },
      ]),
      gym('g2', 'Pull', '2026-10-19T18:30:00-04:00', [{ name: 'Barbell row', sets: [set('working', 60, 10)] }]),
      gym('g3', 'Push', '2026-10-21T18:30:00-04:00', [
        { name: 'Bench press', sets: [set('warmup', 40, 10), set('working', 80, 8), set('working', 80, 7), set('drop', 60, 10, [[45, 8], [30, 6]])] },
        { name: 'Incline dumbbell press with a long name for wrapping', sets: [set('working', 24, 10)] },
        { name: 'Dips', sets: [set('working', null, 12)] },
        { name: 'Lateral raise', sets: [set('drop', 10, 12, [[6, 9]])] },
      ]),
    ],
    plates: [],
    weighIns: [{ id: 'wi1', at: '2026-10-21T07:05:00-04:00', kg: 72.4, unit: 'kg' }],
  })
}

// Sam's own log with many gym sessions, one every other day back from today (Wed Oct 21), for the
// gym log's paging: "Show 9 more" past the first 20.
function manySessionsLog(n: number): string {
  const doc = JSON.parse(samGymLog())
  const day = 24 * 60 * 60 * 1000
  const today = Date.parse('2026-10-21T18:00:00-04:00')
  doc.workouts = Array.from({ length: n }, (_, i) => ({
    id: `m${String(i).padStart(2, '0')}`,
    name: i % 2 === 0 ? 'Push' : 'Pull',
    startedAt: new Date(today - i * 2 * day).toISOString(),
    minutes: 50,
    kcal: 250,
    source: 'burn_device',
    gym: { unit: 'kg', exercises: [{ name: i % 2 === 0 ? 'Bench press' : 'Barbell row', sets: [{ kind: 'working', weightKg: 60 + (n - i), reps: 8 }] }] },
  }))
  return JSON.stringify(doc)
}

/** True when `el` sits fully below the open sheet's sticky header and above its pinned footer. */
async function clearOfSheetBars(page: Page, el: Locator): Promise<boolean> {
  return el.evaluate((node) => {
    const sheet = node.closest('[role="dialog"]')!
    const head = sheet.querySelector(':scope > header')!.getBoundingClientRect()
    const foot = sheet.querySelector(':scope > footer')?.getBoundingClientRect()
    const r = node.getBoundingClientRect()
    return r.top >= head.bottom - 0.5 && r.bottom <= (foot ? foot.top : window.innerHeight) + 0.5
  })
}

async function seedOwn(page: Page, doc: string) {
  await page.clock.setFixedTime(LAYOUT_NOW)
  await page.goto('/')
  await page.evaluate(
    ([k, v, a]) => {
      localStorage.setItem(k, v)
      localStorage.setItem(a, 'mine')
    },
    [E2E_KEYS.mine, doc, E2E_KEYS.active] as const,
  )
  await page.reload()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

/**
 * A control's own box and its tap target: the box's height (its focus ring hugs it), and how tall a
 * run of points through its centre-left reaches it, 20 px above and below.
 */
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

for (const { id: look, name: lookName } of LOOKS) {
  test.describe(`item 2.6 in the ${lookName} look: the gym log`, () => {
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('a session with a warm-up, two working sets and a drop set with drops survives a reload, and is found from the gym log on a later date', async ({
      page,
    }) => {
      await openDemo(page)
      // No gym session on the day: no gym section at all.
      await expect(page.getByTestId('gym-summary')).toHaveCount(0)

      await page.getByTestId('log-workout').click()
      const sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('workout-name-input').fill('Push')
      await sheet.getByTestId('gym-add').click()
      await expect(sheet.getByTestId('gym-editor')).toBeVisible()
      // The button goes; focus moves to the first exercise's name.
      await expect(sheet.getByTestId('gym-exercise-name')).toBeFocused()
      // Nothing logged before, so there is nothing to copy.
      await expect(sheet.getByTestId('gym-copy-last')).toHaveCount(0)
      await expect(sheet.getByTestId('gym-unit-kg')).toBeChecked()
      await typePushDay(sheet)
      await sheet.getByTestId('source-burn_device').check()
      await sheet.getByTestId('workout-kcal-input').fill('250')
      await sheet.getByTestId('workout-when-input').fill('2026-10-21T18:30')
      await sheet.getByTestId('save-workout').click()
      await expect(sheet).toBeHidden()

      // The dashboard: below the day's other sections, the session with its top working set.
      const summary = page.getByTestId('gym-summary')
      await expect(summary).toBeVisible()
      await expect(summary.getByRole('heading', { name: 'Gym' })).toBeVisible()
      const row = summary.getByTestId('gym-summary-session')
      await expect(row).toHaveCount(1)
      await expect(row).toContainText('Push')
      await expect(row).toContainText('6:30 PM · 1 exercise · 4 sets')
      await expect(row.getByTestId('gym-summary-exercise')).toHaveText(['Bench press4 sets · Top working set 80 kg × 8'])
      // The row's accessible name replaces its text, so each exercise's line is in it too.
      await expect(row.getByRole('button')).toHaveAccessibleName(
        /^Push, 6:30\sPM · 1 exercise · 4 sets\. Bench press: 4 sets · Top working set 80\skg\s×\s8\. Opens the workout details/,
      )
      // Its own place: it never sits over the meals (Panel's wide screen puts it in the workouts' column).
      const g = (await summary.boundingBox())!
      const m = (await page.getByTestId('meal-list').boundingBox())!
      const overlaps = g.x < m.x + m.width && m.x < g.x + g.width && g.y < m.y + m.height && m.y < g.y + g.height
      expect(overlaps).toBe(false)
      // It is a workout like any other: burned counts its calories.
      await expect(page.getByTestId('workout-row').filter({ hasText: 'Push' })).toHaveCount(1)

      // One tap: the workout's details with every set, its type in words.
      await row.getByRole('button').click()
      let details = await opened(page, 'workout-details')
      await expect(details.getByRole('heading', { name: 'Push' })).toBeVisible()
      await expect(details.getByTestId('workout-gym')).toContainText('1 exercise · 4 sets (1 warm-up, 2 working, 1 drop set)')
      expect(await setLines(details)).toEqual(PUSH_DAY_LINES)
      await expect(details.getByTestId('gym-best-before')).toHaveText('Previous best: none, first time logged')
      await page.keyboard.press('Escape')
      await expect(details).toBeHidden()

      // It survives a reload.
      await page.reload()
      await expect(page.getByTestId('gym-summary').getByTestId('gym-summary-session')).toContainText('Push')

      // A later date: Sam sleeps, wakes on Thursday, and two more days pass.
      await sleepAndWake(page, '2026-10-22T04:40', '2026-10-22T13:10')
      await page.clock.setFixedTime(new Date(DEMO_NOW.getTime() + TWO_DAYS))
      await page.reload()
      await expect(page.getByTestId('dashboard')).toBeVisible()
      await expect(page.getByTestId('waking-day')).toContainText('Thu')
      await expect(page.getByTestId('gym-summary')).toHaveCount(0)

      // Found from the gym log, by exercise and by split; a search with no match says so.
      const log = await openGymLog(page)
      await expect(log.getByRole('heading', { name: 'Gym log' })).toBeVisible()
      await expect(log).toContainText('1 gym session')
      const search = log.getByTestId('gym-search')
      await search.fill('squat')
      await expect(log.getByTestId('gym-log-session')).toHaveCount(0)
      await expect(log.getByTestId('gym-log-status')).toHaveText('No gym session has “squat” as its split or an exercise.')
      await search.fill('BENCH')
      await expect(log.getByTestId('gym-log-session')).toHaveCount(1)
      await search.fill('push')
      const found = log.getByTestId('gym-log-session')
      await expect(found).toHaveCount(1)
      await expect(found.getByTestId('gym-log-open')).toHaveText('Push')
      // A history across many dates: each session gives its calendar date.
      await expect(found.locator('.gym-log-when')).toHaveText('Wed Oct 21, 6:30 PM')
      expect(await setLines(found)).toEqual(PUSH_DAY_LINES)

      // Its details from there give the date, and closing goes back to the gym log with the search kept.
      await found.getByTestId('gym-log-open').click()
      details = await opened(page, 'workout-details')
      await expect(details).toContainText('Device or watch estimate · Wed Oct 21, 6:30 PM')
      await expect(details.getByTestId('workout-started')).toContainText('Wed Oct 21, 6:30 PM')
      await page.keyboard.press('Escape')
      await expect(await opened(page, 'gym-log')).toBeVisible()
      await expect(page.getByTestId('gym-search')).toHaveValue('push')
    })

    test('Copy last session starts the next one from the previous exercises, and each exercise shows its best working set from earlier sessions', async ({
      page,
    }) => {
      await openDemo(page)
      // Monday's push day, logged from the gym log.
      let log = await openGymLog(page)
      await expect(log.getByTestId('gym-log-none')).toBeVisible()
      await log.getByRole('button', { name: 'Log a gym session' }).click()
      let sheet = await opened(page, 'workout-sheet')
      await expect(sheet.getByRole('heading', { name: 'Log a gym session' })).toBeVisible()
      // Nothing to copy yet: focus starts in the blank workout name.
      await expect(sheet.getByTestId('workout-name-input')).toBeFocused()
      await sheet.getByTestId('workout-name-input').fill('Push')
      await typePushDay(sheet)
      await sheet.getByTestId('workout-when-input').fill('2026-10-19T18:00')
      await sheet.getByTestId('save-workout').click()
      // Saved from the gym log: back to it, now with the session.
      log = await opened(page, 'gym-log')
      await expect(log.getByTestId('gym-log-session')).toHaveCount(1)

      // Then one now (Thu 1:30 AM, still Wednesday's waking day): Copy last session, then a heavier second working set.
      await log.getByRole('button', { name: 'Log a gym session' }).click()
      sheet = await opened(page, 'workout-sheet')
      // With a session to copy, focus starts on "Copy last session", the quickest start.
      await expect(sheet.getByTestId('gym-copy-last')).toBeFocused()
      await expect(sheet.getByTestId('gym-copy-from')).toHaveText('Starts from Push, Mon Oct 19: 1 exercise.')
      await sheet.getByTestId('gym-copy-last').click()
      await expect(sheet.getByTestId('workout-name-input')).toHaveValue('Push')
      await expect(sheet.getByTestId('gym-copied')).toHaveText('Copied from Push, Mon Oct 19. Change anything before saving.')
      const sets = sheet.getByTestId('gym-exercise').first().getByTestId('gym-set')
      await expect(sets).toHaveCount(4)
      await expect(sets.nth(3).getByTestId('gym-drop')).toHaveCount(2)
      await expect(sheet.getByTestId('gym-best')).toHaveText('Previous best: 80 kg × 8 (Mon Oct 19)')
      // Switching the unit converts the weights typed, and the previous best with them; back again, as typed.
      await sheet.getByTestId('gym-unit-lb').check()
      await expect(sets.nth(1).getByTestId('gym-set-weight')).toHaveValue('176.37')
      await expect(sets.nth(3).getByTestId('gym-drop').nth(0).getByTestId('gym-drop-weight')).toHaveValue('99.21')
      await expect(sheet.getByTestId('gym-best')).toHaveText('Previous best: 176.37 lb × 8 (Mon Oct 19)')
      await expect(sets.nth(1).getByTestId('gym-set-weight')).toHaveAttribute('aria-label', 'Set 2 weight (lb)')
      await sheet.getByTestId('gym-unit-kg').check()
      await expect(sets.nth(1).getByTestId('gym-set-weight')).toHaveValue('80')
      await sets.nth(1).getByTestId('gym-set-weight').fill('82.5')
      await sheet.getByTestId('save-workout').click()
      log = await opened(page, 'gym-log')

      // Newest first; the new session names Monday's best, Monday's is the first time.
      const sessions = log.getByTestId('gym-log-session')
      await expect(sessions).toHaveCount(2)
      await expect(sessions.nth(0).locator('.gym-log-when')).toHaveText('Thu Oct 22, 1:30 AM')
      await expect(sessions.nth(0).getByTestId('gym-best-before')).toHaveText('Previous best: 80 kg × 8 (Mon Oct 19)')
      await expect(sessions.nth(1).locator('.gym-log-when')).toHaveText('Mon Oct 19, 6:00 PM')
      await expect(sessions.nth(1).getByTestId('gym-best-before')).toHaveText('Previous best: none, first time logged')
      // Saved from the gym log: focus is back inside it, where it can be seen.
      await expect(log.locator(':focus')).toBeVisible()
      await page.keyboard.press('Escape')

      // Today's session (the new one started at now, on Wednesday's waking day) is on the dashboard.
      await expect(page.getByTestId('gym-summary').getByTestId('gym-summary-exercise')).toHaveText([
        'Bench press4 sets · Top working set 82.5 kg × 8',
      ])

      // Remove gym sets says what Save will do, and Keep the gym sets takes it back.
      await page.getByTestId('gym-summary').getByTestId('gym-summary-session').getByRole('button').click()
      await (await opened(page, 'workout-details')).getByTestId('edit-workout').click()
      sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('gym-remove').click()
      await expect(sheet.getByTestId('gym-removed')).toHaveText(/The gym sets will be removed when you save\./)
      await expect(sheet.getByTestId('gym-keep')).toBeFocused()
      await sheet.getByTestId('gym-keep').click()
      await expect(sheet.getByTestId('gym-exercise')).toHaveCount(1)
      await sheet.getByTestId('gym-remove').click()
      await sheet.getByTestId('save-workout').click()
      await expect(sheet).toBeHidden()
      // The workout stays; with no gym sets left, the gym section goes.
      await expect(page.getByTestId('gym-summary')).toHaveCount(0)
      log = await openGymLog(page)
      await expect(log.getByTestId('gym-log-session')).toHaveCount(1)
    })

    test('a set needs its reps, a weight of 0 is refused, and a drop heavier than the weight before it is pointed out', async ({ page }) => {
      await openDemo(page)
      await page.getByTestId('log-workout').click()
      const sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('workout-name-input').fill('Legs')
      await sheet.getByTestId('gym-add').click()
      const ex = sheet.getByTestId('gym-exercise').first()
      // Focus is in the blank exercise name. Pressing Add set from there adds the set: the name's
      // message waits until the press is over, so it can't move the button from under the pointer.
      await expect(ex.getByTestId('gym-exercise-name')).toBeFocused()
      await ex.getByTestId('gym-add-set').click()
      await expect(ex.getByTestId('gym-set')).toHaveCount(2)
      await expect(ex.getByTestId('gym-error')).toHaveText(['Name the exercise.'])
      await ex.getByTestId('gym-remove-set').nth(1).click()
      await expect(ex.getByTestId('gym-set')).toHaveCount(1)
      await ex.getByTestId('gym-exercise-name').fill('Squat')
      const set = ex.getByTestId('gym-set').first()
      await set.getByTestId('gym-set-weight').fill('0')
      await set.getByTestId('gym-set-reps').focus()
      await set.getByTestId('gym-set-reps').blur()
      await expect(set.getByTestId('gym-error')).toHaveText([
        'A weight of 0 isn’t used. Leave it blank for a set with no weight.',
        'Type the reps.',
      ])
      await expect(sheet.getByTestId('gym-fix-to-save')).toBeVisible()
      await expect(sheet.getByTestId('save-workout')).toBeDisabled()
      await fillSet(set, 'drop', '100', '5')
      await set.getByTestId('gym-add-drop').click()
      await set.getByTestId('gym-drop-weight').fill('110')
      await set.getByTestId('gym-drop-reps').fill('4')
      await expect(set.getByTestId('gym-note')).toHaveText('This drop isn’t lighter than the weight before it.')
      // Pointed out, not refused.
      await expect(sheet.getByTestId('save-workout')).toBeEnabled()
      await expect(sheet.getByTestId('gym-fix-to-save')).toHaveCount(0)
    })
    test('Enter in a gym box moves to the next box and never closes the sheet; the "To save…" line waits until a box is left', async ({
      page,
    }) => {
      await openDemo(page)
      await page.getByTestId('log-workout').click()
      const sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('workout-name-input').fill('Legs')
      await sheet.getByTestId('gym-add').click()
      const ex = sheet.getByTestId('gym-exercise').first()
      const set = ex.getByTestId('gym-set').first()
      const name = ex.getByTestId('gym-exercise-name')
      await expect(name).toBeFocused()
      await expect(name).toHaveAttribute('enterkeyhint', 'next')
      await page.keyboard.type('Squat')
      await page.keyboard.press('Enter')
      // Enter skips the type list and goes on to the weight.
      await expect(set.getByTestId('gym-set-weight')).toBeFocused()
      await page.keyboard.type('100')
      // Still typing the first set: no "To save…" line yet.
      await expect(sheet.getByTestId('gym-fix-to-save')).toHaveCount(0)
      await page.keyboard.press('Enter')
      await expect(set.getByTestId('gym-set-reps')).toBeFocused()
      await expect(sheet.getByTestId('gym-fix-to-save')).toHaveCount(0)
      // Enter from the last box, with its reps still blank: on to "Add set"; the box was left
      // with a problem, so its line and the "To save…" line show. The sheet stays open.
      await page.keyboard.press('Enter')
      await expect(ex.getByTestId('gym-add-set')).toBeFocused()
      await expect(set.getByTestId('gym-error')).toHaveText('Type the reps.')
      await expect(sheet.getByTestId('gym-fix-to-save')).toBeVisible()
      await set.getByTestId('gym-set-reps').fill('5')
      await expect(sheet.getByTestId('gym-fix-to-save')).toHaveCount(0)
      await expect(sheet.getByTestId('save-workout')).toBeEnabled()
      // Now the form could save, and Enter still only moves on: nothing is saved, the sheet stays.
      await page.keyboard.press('Enter')
      await expect(ex.getByTestId('gym-add-set')).toBeFocused()
      await expect(sheet).toBeVisible()
      // Enter on "Add set" adds the next set (a copy of the one above), focus in its weight.
      await page.keyboard.press('Enter')
      await expect(ex.getByTestId('gym-set')).toHaveCount(2)
      await expect(ex.getByTestId('gym-set').nth(1).getByTestId('gym-set-weight')).toBeFocused()
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
      await expect(sheet).toBeVisible()
      // Nothing saved yet.
      await expect(page.getByTestId('gym-summary')).toHaveCount(0)

      // Leaving the gym sets with a set half typed shows the "To save…" line, so Save never waits
      // unexplained.
      await ex.getByTestId('gym-add-set').click()
      const third = ex.getByTestId('gym-set').nth(2)
      await third.getByTestId('gym-set-reps').fill('')
      await expect(sheet.getByTestId('gym-fix-to-save')).toHaveCount(0)
      await sheet.getByTestId('workout-kcal-input').click()
      await expect(sheet.getByTestId('gym-fix-to-save')).toBeVisible()
      await expect(sheet.getByTestId('save-workout')).toBeDisabled()
    })

    test('a split name with no spaces wraps in the gym log, its details and the dashboard: nothing scrolls sideways', async ({ page }) => {
      const long = 'PushPullLegsUpperLowerFullBodyHypertrophyStrengthBlockWeekNine'
      await page.setViewportSize({ width: 320, height: 640 })
      await seedOwn(page, samGymLog().replace('"g3","name":"Push"', `"g3","name":"${long}"`))
      await expect(page.getByTestId('gym-summary')).toContainText(long)
      expect(await sideways(page), 'dashboard').toBeLessThanOrEqual(0)
      const log = await openGymLog(page)
      const split = log.getByTestId('gym-log-open').first()
      await expect(split).toHaveText(long)
      expect(await log.evaluate((el) => el.scrollWidth - el.clientWidth), 'gym log').toBeLessThanOrEqual(0)
      // The name's whole width is inside the sheet.
      const box = (await split.boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(320)
      await split.click()
      const details = await opened(page, 'workout-details')
      expect(await details.evaluate((el) => el.scrollWidth - el.clientWidth), 'details').toBeLessThanOrEqual(0)
      const title = (await details.locator('.sheet-title').boundingBox())!
      expect(title.x + title.width).toBeLessThanOrEqual(320)
    })

    test('Save never waits without saying why: a blank workout name shows its message once the gym sets are typed into', async ({ page }) => {
      await openDemo(page)
      // Log a gym session: the sheet opens with the gym sets, focus in the blank workout name,
      // nothing typed and no message yet.
      let log = await openGymLog(page)
      await log.getByTestId('gym-log-new').click()
      let sheet = await opened(page, 'workout-sheet')
      await expect(sheet.getByTestId('workout-name-input')).toBeFocused()
      await expect(sheet.getByTestId('workout-name-error')).toHaveCount(0)
      const ex = sheet.getByTestId('gym-exercise').first()
      await ex.getByTestId('gym-exercise-name').fill('Squat')
      await ex.getByTestId('gym-set-reps').fill('5')
      // The sets are fine, so the "To save…" line does not show; the workout name's message does.
      await expect(sheet.getByTestId('gym-fix-to-save')).toHaveCount(0)
      await expect(sheet.getByTestId('save-workout')).toBeDisabled()
      await expect(sheet.getByTestId('workout-name-error')).toBeVisible()
      // Remove gym sets: the title no longer says it logs a gym session.
      await sheet.getByTestId('gym-remove').click()
      await expect(sheet.getByRole('heading', { name: 'Log a workout' })).toBeVisible()
      await page.keyboard.press('Escape')
      log = await opened(page, 'gym-log')
      await page.keyboard.press('Escape')

      // Log a workout > Add gym sets: the same.
      await page.getByTestId('log-workout').click()
      sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('gym-add').click()
      await expect(sheet.getByTestId('workout-name-error')).toHaveCount(0)
      await sheet.getByTestId('gym-exercise').first().getByTestId('gym-exercise-name').fill('Squat')
      await expect(sheet.getByTestId('workout-name-error')).toBeVisible()
    })

    test('Remove exercise on one with sets typed offers Undo, which puts it back in the unit now chosen', async ({ page }) => {
      await openDemo(page)
      await page.getByTestId('log-workout').click()
      const sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('workout-name-input').fill('Push')
      await sheet.getByTestId('gym-add').click()
      const exercises = sheet.getByTestId('gym-exercise')
      await exercises.first().getByTestId('gym-exercise-name').fill('Bench press')
      await fillSet(exercises.first().getByTestId('gym-set').first(), 'working', '80', '8')
      await exercises.first().getByTestId('gym-add-set').click()
      // Each Add set names its exercise for a screen reader.
      await expect(exercises.first().getByTestId('gym-add-set')).toHaveAttribute('aria-label', 'Add a set to Bench press')
      await sheet.getByTestId('gym-add-exercise').click()
      await exercises.nth(1).getByTestId('gym-exercise-name').fill('Dips')
      await exercises.nth(1).getByTestId('gym-set-reps').fill('12')
      await expect(exercises.nth(1).getByTestId('gym-add-set')).toHaveAttribute('aria-label', 'Add a set to Dips')

      await exercises.first().getByTestId('gym-remove-exercise').click()
      await expect(exercises).toHaveCount(1)
      const undoLine = sheet.getByTestId('gym-removed-exercise')
      await expect(undoLine).toContainText('Removed Bench press, with 2 sets.')
      const undo = sheet.getByTestId('gym-undo-remove')
      await expect(undo).toBeFocused()
      await expect(undo).toHaveAttribute('aria-label', 'Undo: put back Bench press')
      expect(await clearOfSheetBars(page, undo)).toBe(true)
      // Switch the unit, then Undo: Bench press is back first, its 80 kg now read in lb.
      await sheet.getByTestId('gym-unit-lb').check()
      await undo.click()
      await expect(undoLine).toHaveCount(0)
      await expect(exercises).toHaveCount(2)
      await expect(exercises.first().getByTestId('gym-exercise-name')).toHaveValue('Bench press')
      await expect(exercises.first().getByTestId('gym-exercise-name')).toBeFocused()
      for (const box of await exercises.first().getByTestId('gym-set-weight').all()) await expect(box).toHaveValue('176.37')
      // A blank exercise just goes, with nothing to undo; focus stays on Add exercise.
      await sheet.getByTestId('gym-add-exercise').click()
      await exercises.nth(2).getByTestId('gym-remove-exercise').click()
      await expect(exercises).toHaveCount(2)
      await expect(undoLine).toHaveCount(0)
      await expect(sheet.getByTestId('gym-add-exercise')).toBeFocused()
    })

    test('a session in lb leaves the weight log in kg; gym weights then show in lb, and the next session starts in lb', async ({ page }) => {
      await seedOwn(page, samGymLog())
      const weight = page.getByTestId('weight-section')
      await expect(weight).toContainText('kg')
      await page.getByTestId('log-workout').click()
      let sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('workout-name-input').fill('Legs')
      await sheet.getByTestId('gym-add').click()
      await expect(sheet.getByTestId('gym-unit-kg')).toBeChecked()
      // The hint says what the unit changes, and what it leaves alone.
      await expect(sheet.getByTestId('gym-editor')).toContainText(
        'Changing the unit converts the weights already typed. The gym log shows weights in the unit of your latest session; your weigh-ins keep their own unit.',
      )
      await sheet.getByTestId('gym-unit-lb').check()
      const ex = sheet.getByTestId('gym-exercise').first()
      await ex.getByTestId('gym-exercise-name').fill('Squat')
      await fillSet(ex.getByTestId('gym-set').first(), 'working', '225', '5')
      await sheet.getByTestId('workout-when-input').fill('2026-10-21T19:30')
      await sheet.getByTestId('save-workout').click()
      await expect(sheet).toBeHidden()

      // The weight section still reads kg.
      await expect(weight).toContainText('kg')
      await expect(weight).not.toContainText(/\blb\b/)
      // Gym weights read lb: the new session as typed, the earlier one converted.
      const summary = page.getByTestId('gym-summary')
      await expect(summary.getByTestId('gym-summary-exercise').filter({ hasText: 'Squat' })).toContainText('225 lb × 5')
      await expect(summary.getByTestId('gym-summary-exercise').filter({ hasText: 'Bench press' })).toContainText('176.37 lb × 8')
      // The next session starts in lb.
      await page.getByTestId('log-workout').click()
      sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('gym-add').click()
      await expect(sheet.getByTestId('gym-unit-lb')).toBeChecked()
      await page.keyboard.press('Escape')
      // And after a reload, the same.
      await page.reload()
      await expect(page.getByTestId('weight-section')).not.toContainText(/\blb\b/)
    })

    test('previous best says when an exercise was logged before with no working set, rather than a first time', async ({ page }) => {
      await seedOwn(page, samGymLog())
      await page.getByTestId('gym-open-log').click()
      const log = await opened(page, 'gym-log')
      const raises = log.getByTestId('gym-log-session').first().getByTestId('gym-session-exercise').filter({ hasText: 'Lateral raise' })
      await expect(raises.getByTestId('gym-best-before')).toHaveText('Previous best: none yet (no earlier working set)')
      // In Oct 12's session it was the first time.
      const first = log.getByTestId('gym-log-session').last().getByTestId('gym-session-exercise').filter({ hasText: 'Lateral raise' })
      await expect(first.getByTestId('gym-best-before')).toHaveText('Previous best: none, first time logged')
      // The editor says the same as soon as the name is typed.
      await log.getByTestId('gym-log-new').click()
      const sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('gym-exercise-name').fill('lateral raise')
      await expect(sheet.getByTestId('gym-best')).toHaveText('Previous best: none yet (no earlier working set)')
    })

    test('coming back from a session opened in the gym log keeps the place: the sessions shown, and focus on that session', async ({ page }) => {
      await seedOwn(page, manySessionsLog(29))
      await page.getByTestId('gym-open-log').click()
      let log = await opened(page, 'gym-log')
      const rows = log.getByTestId('gym-log-session')
      await expect(rows).toHaveCount(20)
      // "Show 9 more" by keyboard: the button goes (the last page), and focus moves to the first
      // session it brought in, so Escape and Tab still work inside the sheet.
      await log.getByTestId('gym-log-more').focus()
      await page.keyboard.press('Enter')
      await expect(rows).toHaveCount(29)
      await expect(log.getByTestId('gym-log-more')).toHaveCount(0)
      await expect(rows.nth(20).getByTestId('gym-log-open')).toBeFocused()
      await expect(rows.nth(20).getByTestId('gym-log-open')).toBeInViewport()
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement?.closest('[data-testid="gym-log"]') !== null)).toBe(true)
      const id = await rows.nth(24).getAttribute('data-workout-id')
      const openButton = () => page.getByTestId('gym-log').locator(`[data-workout-id="${id}"] [data-testid="gym-log-open"]`)
      const expectBackAtRow = async () => {
        log = await opened(page, 'gym-log')
        await expect(rows).toHaveCount(29)
        await expect(openButton()).toBeFocused()
        await expect(openButton()).toBeInViewport()
        expect(await clearOfSheetBars(page, openButton())).toBe(true)
      }

      // Escape.
      await openButton().click()
      await opened(page, 'workout-details')
      await page.keyboard.press('Escape')
      await expectBackAtRow()
      // Close.
      await openButton().click()
      await page.getByTestId('workout-details').getByRole('button', { name: 'Close' }).click()
      await expectBackAtRow()
      // Edit, then Save.
      await openButton().click()
      await (await opened(page, 'workout-details')).getByTestId('edit-workout').click()
      const sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('workout-kcal-input').fill('260')
      await sheet.getByTestId('save-workout').click()
      await expectBackAtRow()

      // Opened afresh, the gym log starts again at its first page, with an empty search: from More,
      // and from the dashboard's "Gym log".
      await page.getByTestId('gym-search').fill('row')
      await expect(page.getByTestId('gym-log-status')).toHaveText('14 of 29 sessions match.')
      await page.keyboard.press('Escape')
      await expect(log).toBeHidden()
      await openGymLog(page)
      await expect(page.getByTestId('gym-search')).toHaveValue('')
      await expect(rows).toHaveCount(20)
      await page.getByTestId('gym-search').fill('bench')
      await page.keyboard.press('Escape')
      await page.getByTestId('gym-open-log').click()
      await expect(page.getByTestId('gym-search')).toHaveValue('')
      await expect(page.getByTestId('gym-log-status')).toHaveText('')
      await expect(rows).toHaveCount(20)
    })

    test('Add gym sets with an earlier session to copy: focus goes to "Copy last session", in view below the sheet’s header', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 })
      await seedOwn(page, samGymLog())
      await page.getByTestId('log-workout').click()
      const sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('gym-add').click()
      const copyLast = sheet.getByTestId('gym-copy-last')
      await expect(copyLast).toBeFocused()
      expect(await clearOfSheetBars(page, copyLast)).toBe(true)
    })

    test('layout at 320, 390 and 1440 px: right below weight, no sideways scrolling, sentences in text style, 44 px remove buttons', async ({
      page,
    }) => {
      await seedOwn(page, samGymLog())
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
        const gymBox = (await page.getByTestId('gym-summary').boundingBox())!
        const weightBox = (await page.getByTestId('weight-section').boundingBox())!
        const sleepBox = (await page.getByTestId('sleep-section').boundingBox())!
        // Right below weight, in the same column (Panel's wide grid places it there explicitly).
        expect(gymBox.y, `gym under weight at ${width}`).toBeGreaterThanOrEqual(weightBox.y + weightBox.height - 1)
        expect(Math.abs(gymBox.x - weightBox.x), `gym in weight's column at ${width}`).toBeLessThan(2)
        const next = await page.getByTestId('weight-section').evaluate((el) => el.nextElementSibling?.getAttribute('data-testid'))
        expect(next).toBe('gym-summary')
        if (look === 'night') {
          // Night: the timeline and its "Each night" stay together, above both.
          expect(gymBox.y).toBeGreaterThan(sleepBox.y + sleepBox.height)
        } else {
          expect(sleepBox.y, `sleep under gym at ${width}`).toBeGreaterThanOrEqual(gymBox.y + gymBox.height - 1)
        }
        expect(await sideways(page), `dashboard at ${width}`).toBeLessThanOrEqual(0)
        // "Gym log" beside the section title: its box hugs the words, its tap target is 44 px tall,
        // and its focus ring shows.
        const openLog = page.getByTestId('gym-open-log')
        const openHit = await tapTarget(openLog)
        expect(openHit.height, `"Gym log" hugs its words at ${width}`).toBeLessThan(32)
        expect(openHit.tall, `"Gym log" is 44 px tall to tap at ${width}`).toBeGreaterThanOrEqual(44)
        await openLog.focus()
        await page.keyboard.press('Shift+Tab')
        await page.keyboard.press('Tab')
        await expect(openLog).toBeFocused()
        expect(await openLog.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid')
        if (look === 'night') {
          // Night: each session in a framed block, like Weight's summary right above it.
          const frame = await page.getByTestId('gym-summary-session').first().getByRole('button').evaluate((e) => getComputedStyle(e).borderTopStyle)
          expect(frame).toBe('solid')
        }
        // Sentences are not set as numbers.
        for (const el of await page.getByTestId('gym-summary-exercise').locator('.gym-ex-text').all()) {
          expect(await el.evaluate((e) => getComputedStyle(e).fontVariantNumeric)).not.toContain('tabular-nums')
        }
        // One rhythm: every exercise's sets sit under its name, short name or long.
        for (const ex of await page.getByTestId('gym-summary-exercise').all()) {
          const nameBox = (await ex.locator('.gym-ex-name').boundingBox())!
          const textBox = (await ex.locator('.gym-ex-text').boundingBox())!
          expect(textBox.y, `sets under the name at ${width}`).toBeGreaterThanOrEqual(nameBox.y + nameBox.height - 1)
        }

        await page.getByTestId('gym-open-log').click()
        const log = await opened(page, 'gym-log')
        expect(await sideways(page), `gym log at ${width}`).toBeLessThanOrEqual(0)
        const best = log.getByTestId('gym-best-before').first()
        await expect(best).toHaveText('Previous best: 75 kg × 8 (Mon Oct 12)')
        expect(await best.evaluate((e) => getComputedStyle(e).fontVariantNumeric)).not.toContain('tabular-nums')
        expect(await best.evaluate((e) => getComputedStyle(e).fontWeight)).toBe('400')
        // The set's type is a word, not a number: number styling only on the set itself.
        for (const kind of await log.locator('.gym-kind').all()) {
          expect(await kind.evaluate((e) => getComputedStyle(e).fontVariantNumeric)).not.toContain('tabular-nums')
        }
        expect(await log.locator('.gym-set-text').first().evaluate((e) => getComputedStyle(e).fontVariantNumeric)).toContain('tabular-nums')
        // A set with no weight logged is words: no number styling.
        const noWeight = log.locator('.gym-set-text', { hasText: 'no weight logged' }).first()
        await expect(noWeight).toBeVisible()
        expect(await noWeight.evaluate((e) => getComputedStyle(e).fontVariantNumeric)).not.toContain('tabular-nums')
        // The split's link: its box hugs the words, its tap target reaches 44 px tall.
        const split = log.getByTestId('gym-log-open').first()
        const splitHit = await split.evaluate((b) => {
          const r = b.getBoundingClientRect()
          const cx = r.left + Math.min(r.width, 44) / 2
          let tall = 0
          for (let v = r.top - 20; v <= r.bottom + 20; v += 0.5) if (b.contains(document.elementFromPoint(cx, v))) tall += 0.5
          return { height: r.height, tall: tall + 0.5 }
        })
        expect(splitHit.height, `split link hugs its words at ${width}`).toBeLessThan(32)
        expect(splitHit.tall, `split link is 44 px tall to tap at ${width}`).toBeGreaterThanOrEqual(44)
        // Each set's value stays on one line ("80 kg × 8"); the drop set breaks only between parts.
        for (const line of await log.locator('.gym-set-text').all()) {
          const text = (await line.textContent()) ?? ''
          // No ordinary space beside a number, a unit or the ×: "80 kg × 8" and "12 reps" hold together.
          expect(text, `"${text}" can break inside a value`).not.toMatch(/\d (kg|lb|×|reps?)|(kg|lb) ×|× \d/)
        }
        await log.getByTestId('gym-log-open').first().click()
        await (await opened(page, 'workout-details')).getByTestId('edit-workout').click()
        const sheet = await opened(page, 'workout-sheet')
        expect(await sideways(page), `editor at ${width}`).toBeLessThanOrEqual(0)
        // Every remove button is a 44 px target, even where its box narrows.
        const x = sheet.getByTestId('gym-remove-set').first()
        // Centred in the sheet, clear of its sticky head and footer, once the sheet has
        // finished opening (its short entrance scales it).
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
        await x.evaluate((b) => b.scrollIntoView({ block: 'center' }))
        const hit = await x.evaluate((b) => {
          const r = b.getBoundingClientRect()
          const cy = r.top + r.height / 2
          const cx = r.left + r.width / 2
          // The widest and tallest runs of points that reach the button, through its box.
          const run = (from: number, to: number, at: (v: number) => Element | null) => {
            let best = 0
            let cur = 0
            // Half-pixel steps, since a box can start between pixels.
            for (let v = from; v <= to; v += 0.5) {
              cur = b.contains(at(v)) ? cur + 0.5 : 0
              best = Math.max(best, cur)
            }
            return best + 0.5
          }
          const wide = run(r.left - 12, r.right + 12, (v) => document.elementFromPoint(v, cy))
          const tall = run(r.top - 12, r.bottom + 12, (v) => document.elementFromPoint(cx, v))
          return { wide, tall }
        })
        expect(hit.wide, `remove set is 44 px wide to tap at ${width}`).toBeGreaterThanOrEqual(44)
        expect(hit.tall, `remove set is 44 px tall to tap at ${width}`).toBeGreaterThanOrEqual(44)
        // Add drop: its focus ring hugs the words, and its tap area still reaches 44 px.
        const addDrop = sheet.getByTestId('gym-add-drop').first()
        await addDrop.evaluate((b) => b.scrollIntoView({ block: 'center' }))
        await addDrop.focus()
        await page.keyboard.press('Shift+Tab')
        await page.keyboard.press('Tab')
        await expect(addDrop).toBeFocused()
        const drop = await addDrop.evaluate((b) => {
          const r = b.getBoundingClientRect()
          const cx = r.left + Math.min(r.width, 44) / 2
          let tall = 0
          for (let v = r.top - 20; v <= r.bottom + 20; v += 0.5) if (b.contains(document.elementFromPoint(cx, v))) tall += 0.5
          return { height: r.height, tall: tall + 0.5, ring: getComputedStyle(b).outlineStyle }
        })
        expect(drop.height, `Add drop's box hugs its words at ${width}`).toBeLessThan(32)
        expect(drop.tall, `Add drop is 44 px tall to tap at ${width}`).toBeGreaterThanOrEqual(44)
        expect(drop.ring).toBe('solid')
        // Add set, Remove exercise and Remove gym sets keep the quiet button's box, with a 44 px
        // tap target.
        for (const tid of ['gym-add-set', 'gym-remove-exercise', 'gym-remove']) {
          const t = await tapTarget(sheet.getByTestId(tid).first())
          expect(t.height, `${tid}'s box at ${width}`).toBeLessThan(40)
          expect(t.tall, `${tid} is 44 px tall to tap at ${width}`).toBeGreaterThanOrEqual(44)
        }
        // The column heads never run into each other (a head may wrap onto two lines).
        const clash = await sheet.locator('.gym-set-head > span').evaluateAll((spans) => {
          const lines = spans
            .filter((s) => getComputedStyle(s).visibility !== 'hidden' && s.textContent)
            .map((s) => {
              const range = document.createRange()
              range.selectNodeContents(s)
              return [...range.getClientRects()]
            })
          for (let i = 1; i < lines.length; i++)
            for (const a of lines[i - 1])
              for (const b of lines[i]) if (a.top < b.bottom && b.top < a.bottom && b.left <= a.right) return true
          return false
        })
        expect(clash, `column heads apart at ${width}`).toBe(false)
        // In lb, the weights the app fills in itself (80 kg reads 176.37 lb, 24 kg reads 52.91 lb)
        // show whole in their boxes, and so do the reps; the sheet never scrolls sideways.
        await sheet.getByTestId('gym-unit-lb').check()
        await expect(sheet.getByTestId('gym-set-weight').nth(1)).toHaveValue('176.37')
        const clipped = await sheet
          .locator('[data-testid="gym-set-weight"], [data-testid="gym-drop-weight"], [data-testid="gym-set-reps"], [data-testid="gym-drop-reps"]')
          .evaluateAll((els) => (els as HTMLInputElement[]).filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.value))
        expect(clipped, `boxes cut off at ${width}`).toEqual([])
        expect(await sheet.evaluate((el) => el.scrollWidth - el.clientWidth), `editor sheet at ${width}`).toBeLessThanOrEqual(0)
        await page.keyboard.press('Escape')
        await expect(sheet).toBeHidden()
        await page.keyboard.press('Escape')
        await expect(page.getByTestId('gym-log')).toBeHidden()
      }
    })
  })

  test.describe(`item 2.6 in the ${lookName} look on a touch screen`, () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
    test.beforeEach(async ({ page }) => {
      await startInLook(page, look)
    })

    test('a tap on "Add set" or "Add drop" from a box about to show its message is never lost', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'phone-390x844', 'the touch run sets its own phone screen; once is enough')
      await openDemo(page)
      await page.getByTestId('log-workout').tap()
      const sheet = await opened(page, 'workout-sheet')
      await sheet.getByTestId('workout-name-input').fill('Legs')
      await sheet.getByTestId('gym-add').tap()
      const ex = sheet.getByTestId('gym-exercise').first()
      const sets = ex.getByTestId('gym-set')
      // From the blank exercise name: the message shows, and the set is added.
      await expect(ex.getByTestId('gym-exercise-name')).toBeFocused()
      await ex.getByTestId('gym-add-set').tap()
      await expect(sets).toHaveCount(2)
      await expect(ex.getByTestId('gym-error').first()).toHaveText('Name the exercise.')
      // From a blank reps box, several times over: each tap adds its set.
      for (let n = 3; n <= 5; n++) {
        await sets.nth(n - 2).getByTestId('gym-set-reps').tap()
        await expect(sets.nth(n - 2).getByTestId('gym-set-reps')).toBeFocused()
        await ex.getByTestId('gym-add-set').tap()
        await expect(sets).toHaveCount(n)
        await expect(sets.nth(n - 2).getByTestId('gym-error')).toHaveText('Type the reps.')
      }
      // From a weight of 0: "Add drop" adds its drop.
      const drop = sets.nth(4)
      await drop.getByTestId('gym-set-kind').selectOption('drop')
      await drop.getByTestId('gym-set-weight').tap()
      await drop.getByTestId('gym-set-weight').fill('0')
      await drop.getByTestId('gym-add-drop').tap()
      await expect(drop.getByTestId('gym-drop')).toHaveCount(1)
      await expect(drop.getByTestId('gym-error').first()).toHaveText('A weight of 0 isn’t used. Leave it blank for a set with no weight.')
      // From the new drop's blank reps: another drop.
      await drop.getByTestId('gym-drop-reps').first().tap()
      await drop.getByTestId('gym-add-drop').tap()
      await expect(drop.getByTestId('gym-drop')).toHaveCount(2)
    })
  })
}
