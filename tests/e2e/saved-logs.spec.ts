// Build-out item 1.1: saved logs load across format versions, and the tests keep their own storage.
// - The app under test uses the e2e namespace, so logs under the default keys in the same
//   browser origin are never read or written.
// - A version 1 own log saved today (the frozen fixture) opens with its meals.
// - A log saved by a newer version is reported and left exactly as it is.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { DEFAULT_KEYS } from '../../src/store/keys'
import { E2E_KEYS } from './storage-keys'

const V1_MINE = readFileSync(fileURLToPath(new URL('../../fixtures/saved/v1-mine.json', import.meta.url)), 'utf8')

// Sam's Wednesday 2026-10-28, 8 PM: woke 07:40, next sleep starts 23:50 (fixtures/saved/v1-mine.json).
const MINE_NOW = new Date('2026-10-28T20:00:00-04:00')

const NEWER_NOTICE =
  "This log was saved by a newer version of HowSure, so this version can't open it. It has been left as it was, and changes made now won't be saved over it."

async function seed(page: Page, items: Record<string, string>) {
  await page.evaluate((entries) => {
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v)
  }, items)
}

async function read(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key)
}

async function logMeal(page: Page, name: string, kcal: string) {
  await page.getByTestId('log-meal').click()
  const sheet = page.getByTestId('log-meal-sheet')
  await sheet.getByTestId('meal-name-input').fill(name)
  await sheet.getByTestId('source-label').check()
  await sheet.getByTestId('meal-kcal-input').fill(kcal)
  await sheet.getByTestId('save-meal').click()
  await expect(sheet).toBeHidden()
}

test.describe('item 1.1: saved logs upgrade safely', () => {
  test('the tests use their own keys and never touch logs saved under the default keys', async ({ page }) => {
    await page.clock.setFixedTime(MINE_NOW)
    await page.goto('/')
    const saved = { [DEFAULT_KEYS.demo]: 'saved demo', [DEFAULT_KEYS.mine]: 'saved own log', [DEFAULT_KEYS.active]: 'mine' }
    await seed(page, saved)
    await page.reload()

    // Nothing under the e2e keys yet, so the first-open screen shows, with no storage notice.
    await expect(page.getByTestId('first-open')).toBeVisible()
    await expect(page.locator('.storage-notice')).toHaveCount(0)
    await page.getByRole('button', { name: 'Start empty' }).click()
    await logMeal(page, 'Rice cakes', '70')

    expect(await read(page, E2E_KEYS.active)).toBe('mine')
    expect(JSON.parse((await read(page, E2E_KEYS.mine)) ?? 'null')?.meals?.[0]?.name).toBe('Rice cakes')
    for (const [k, v] of Object.entries(saved)) expect(await read(page, k)).toBe(v)
    const keys = await page.evaluate(() => Object.keys(localStorage).sort())
    expect(keys).toEqual([DEFAULT_KEYS.active, DEFAULT_KEYS.demo, DEFAULT_KEYS.mine, E2E_KEYS.active, E2E_KEYS.mine].sort())
  })

  test('a version 1 own log opens with its meals, and opening it changes nothing stored', async ({ page }) => {
    await page.clock.setFixedTime(MINE_NOW)
    await page.goto('/')
    await seed(page, { [E2E_KEYS.mine]: V1_MINE, [E2E_KEYS.active]: 'mine' })
    await page.reload()

    await expect(page.getByTestId('dashboard')).toBeVisible()
    await expect(page.locator('.storage-notice')).toHaveCount(0)
    const rows = page.getByTestId('meal-row')
    for (const name of ['Oats with blueberries', 'Leftover soup', 'Samosa from the office', 'Black coffee']) {
      await expect(rows.filter({ hasText: name })).toHaveCount(1)
    }
    expect(await read(page, E2E_KEYS.mine)).toBe(V1_MINE)
  })

  test('a log saved by a newer version is reported and left as it is', async ({ page }) => {
    const newer = JSON.stringify({ ...JSON.parse(V1_MINE), version: 99 })
    await page.clock.setFixedTime(MINE_NOW)
    await page.goto('/')
    await seed(page, { [E2E_KEYS.mine]: newer, [E2E_KEYS.active]: 'mine' })
    await page.reload()

    await expect(page.getByTestId('dashboard')).toBeVisible()
    await expect(page.getByTestId('storage-newer')).toHaveText(NEWER_NOTICE)
    await expect(page.getByTestId('storage-unreadable')).toHaveCount(0)
    await logMeal(page, 'Rice cakes', '70')
    await expect(page.getByTestId('meal-row').filter({ hasText: 'Rice cakes' })).toHaveCount(1)
    expect(await read(page, E2E_KEYS.mine)).toBe(newer)

    await page.reload()
    await expect(page.getByTestId('storage-newer')).toHaveText(NEWER_NOTICE)
    expect(await read(page, E2E_KEYS.mine)).toBe(newer)
  })
})
