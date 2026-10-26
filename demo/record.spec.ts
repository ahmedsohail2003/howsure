// Silent draft capture of the demo, one short test per scene (the shot list in the tracker's
// CHECK file, scenes 1-3e). Each test gets a fresh browser context and its own video, so a
// crash costs one scene. Each test writes how many seconds of setup to trim from its clip.
// The assertions double as a check of Ahmed's hands-on script. No narration is written here.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'

const DEMO_NOW = new Date('2026-10-22T01:30:00-04:00') // spec.md > Clock

const beat = (page: Page, seconds: number) => page.waitForTimeout(seconds * 1000)

async function digits(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/,/g, '')
}

async function slowFill(locator: Locator, text: string) {
  await locator.fill('')
  await locator.pressSequentially(text, { delay: 90 })
}

let started = 0
test.beforeEach(async ({ page }) => {
  started = Date.now()
  await page.clock.setFixedTime(DEMO_NOW)
})

/** Open the demo off-camera, then record how much of the clip is setup. */
async function openDemo(page: Page, scene: string, opts: { improved?: boolean } = {}) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the fictional demo' }).click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
  // Later scenes continue the story: the pasta bake was already improved (2,380 · 92).
  if (opts.improved) await improvePastaBake(page, false)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  markTrim(scene)
}

function markTrim(scene: string) {
  mkdirSync('demo/out', { recursive: true })
  writeFileSync(`demo/out/${scene}.trim.json`, JSON.stringify({ scene, trimSeconds: (Date.now() - started) / 1000 }))
}

async function improvePastaBake(page: Page, slow: boolean) {
  await page.getByTestId('improve-entry').click()
  const sheet = page.getByTestId('log-meal-sheet')
  await expect(sheet.getByTestId('improve-note')).toContainText('860 kcal')
  if (slow) await beat(page, 4)
  await sheet.getByTestId('source-label').check()
  const fill = slow ? slowFill : (l: Locator, t: string) => l.fill(t)
  await fill(sheet.getByTestId('meal-kcal-input'), '860')
  await fill(sheet.getByTestId('meal-protein-input'), '42')
  await fill(sheet.getByTestId('meal-carbs-input'), '96')
  await fill(sheet.getByTestId('meal-fat-input'), '33')
  await sheet.getByTestId('edit-preview').scrollIntoViewIfNeeded()
  await expect(sheet.getByTestId('edit-preview').getByTestId('preview-day-score')).toHaveText('92')
  if (slow) await beat(page, 5)
  await sheet.getByTestId('save-meal').click()
  await expect(page.getByTestId('day-score')).toHaveText('Estimate score 92')
}

test('s1 first screen and the demo dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('first-open')).toBeVisible()
  markTrim('s1')
  await beat(page, 3)
  await page.getByRole('button', { name: 'Try the fictional demo' }).click()
  await expect(page.getByTestId('waking-day')).toContainText('Wed · awake since 1:20 PM')
  await expect(page.getByTestId('fictional-banner').first()).toBeVisible()
  await beat(page, 3)
})

test('s2 the headline', async ({ page }) => {
  await openDemo(page, 's2')
  expect(await digits(page.getByTestId('headline-kcal'))).toBe('2280')
  await expect(page.getByTestId('day-score')).toHaveText('Estimate score 83')
  expect(await digits(page.getByTestId('likely-range'))).toContain('1870–2780')
  expect(await digits(page.getByTestId('very-likely-range'))).toContain('1684–3087')
  await expect(page.getByTestId('biggest-line')).toContainText('Most uncertainty comes from Pasta bake (ready meal).')
  await beat(page, 12)
})

test('s3a tap the score, then More detail', async ({ page }) => {
  await openDemo(page, 's3a')
  await beat(page, 1)
  await page.getByTestId('day-score').click()
  await expect(page.getByTestId('day-score-sentence')).toBeVisible()
  await beat(page, 6)
  await page.getByRole('dialog').getByText('More detail').click()
  await expect(page.getByTestId('basis-cite').first()).toContainText('re-checked 2026-10-26')
  await beat(page, 3)
  await page.getByTestId('day-detail-table').scrollIntoViewIfNeeded()
  await beat(page, 4)
  await page.getByTestId('source-basis').last().scrollIntoViewIfNeeded()
  await beat(page, 5)
})

test('s3b improve the pasta bake from its label', async ({ page }) => {
  await openDemo(page, 's3b')
  await beat(page, 2)
  await improvePastaBake(page, true)
  expect(await digits(page.getByTestId('headline-kcal'))).toBe('2380')
  expect(await digits(page.getByTestId('likely-range'))).toContain('2153–2631')
  await expect(page.getByTestId('biggest-line')).toContainText('Apple and peanut butter')
  await beat(page, 6)
})

test('s3c log a meal honestly', async ({ page }) => {
  await openDemo(page, 's3c', { improved: true })
  await beat(page, 1)
  await page.getByTestId('log-meal').click()
  const log = page.getByTestId('log-meal-sheet')
  await slowFill(log.getByTestId('meal-name-input'), 'Test snack')
  await slowFill(log.getByTestId('meal-kcal-input'), 'abc')
  await expect(log.getByTestId('kcal-error')).toHaveText('Use digits, e.g. 1501 or 13.9')
  await expect(log.getByTestId('save-meal')).toBeDisabled()
  await beat(page, 3)
  await log.getByTestId('meal-kcal-input').fill('')
  await beat(page, 1)
  await log.getByTestId('save-meal').click()
  await expect(page.getByTestId('day-status')).toContainText('Known meals only — incomplete day')
  await expect(page.getByTestId('missing-info')).toContainText('Test snack')
  await page.getByTestId('missing-info').scrollIntoViewIfNeeded()
  await beat(page, 5)
})

test('s3d days follow sleep', async ({ page }) => {
  await openDemo(page, 's3d', { improved: true })
  await page.getByTestId('meal-list').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('meal-list')).toContainText('Apple and peanut butter')
  await beat(page, 3)
  await page.getByTestId('sleep-section').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('night-count')).toContainText('6 of 7 nights')
  await beat(page, 3)
  await page.getByTestId('sleep-action').click()
  await page.getByTestId('sleep-sheet').getByTestId('sleep-when-input').fill('2026-10-22T04:40')
  await beat(page, 1)
  await page.getByTestId('sleep-sheet').getByTestId('sleep-save').click()
  await expect(page.getByTestId('sleep-action')).toHaveText('I woke up')
  await beat(page, 2)
  await page.getByTestId('sleep-action').click()
  await page.getByTestId('sleep-sheet').getByTestId('sleep-when-input').fill('2026-10-22T13:10')
  await beat(page, 1)
  await page.getByTestId('sleep-sheet').getByTestId('sleep-save').click()
  await expect(page.getByTestId('empty-day')).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  await beat(page, 3)
  await page.getByTestId('day-prev').click()
  expect(await digits(page.getByTestId('headline-kcal'))).toBe('2380')
  await beat(page, 3)
})

test('s3e reload, then your own log', async ({ page }) => {
  await openDemo(page, 's3e', { improved: true })
  await beat(page, 1)
  await page.reload()
  expect(await digits(page.getByTestId('headline-kcal'))).toBe('2380')
  await beat(page, 2)
  await page.getByTestId('log-switch').click()
  await expect(page.getByTestId('fictional-banner')).toHaveCount(0)
  await beat(page, 3)
  await page.getByTestId('log-switch').click()
  await expect(page.getByTestId('fictional-banner').first()).toBeVisible()
  await beat(page, 2)
})

// Scenes 4-6: static pages rendered from the repo's own documents (no new claims).
const REPO_URL = process.env.REPO_URL ?? 'Repository link in the description'

function esc(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function section(file: string, heading: string): string {
  const text = readFileSync(file, 'utf8')
  const start = text.indexOf(heading)
  if (start < 0) throw new Error(`${heading} not found in ${file}`)
  const level = heading.match(/^#+/)?.[0] ?? '##'
  const rest = text.slice(start + heading.length)
  const next = rest.search(new RegExp(`\n${level} `))
  return (heading + (next < 0 ? rest : rest.slice(0, next))).trim()
}

function card(inner: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#FAF7F2;color:#2B2B2B;font:20px/1.5 "Segoe UI",system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
    main{max-width:1100px;padding:40px 56px}
    pre{white-space:pre-wrap;font:17px/1.45 "Segoe UI",system-ui,sans-serif;background:#fff;border:1px solid #E6E0D6;border-radius:10px;padding:24px 28px;margin:0}
    .muted{color:#5E5A55;font-size:16px;margin:0 0 12px}
    .big{font-size:56px;font-weight:600;margin:0 0 12px}
    h1{font-size:34px;margin:0 0 16px}
  </style></head><body><main>${inner}</main></body></html>`
}

test('s4 how the skill pack shaped it', async ({ page }) => {
  markTrim('s4')
  const slices = readFileSync('devpost/checklist.md', 'utf8')
    .split('\n')
    .filter((l) => /^- \[[x ]\] \*\*\d+\./.test(l))
    .slice(0, 7)
    .join('\n')
  const docs: [string, string][] = [
    ['devpost/scope.md', section('devpost/scope.md', '## The Unique Kernel')],
    ['devpost/prd.md', section('devpost/prd.md', '## Look and Feel')],
    ['devpost/checklist.md — Tier 1 slices, each verified by its own tests before the next', slices],
  ]
  for (const [name, text] of docs) {
    await page.setContent(card(`<p class="muted">${esc(name)}</p><pre>${esc(text)}</pre>`))
    await beat(page, 9)
  }
})

test('s5 honest limitations and roadmap', async ({ page }) => {
  markTrim('s5')
  await page.setContent(card(`<p class="muted">README.md</p><pre>${esc(section('README.md', '## Honest limitations'))}</pre>`))
  await beat(page, 7)
  await page.setContent(card(`<p class="muted">README.md</p><pre>${esc(section('README.md', '## Roadmap'))}</pre>`))
  await beat(page, 6)
})

test('s6 end card', async ({ page }) => {
  markTrim('s6')
  await page.setContent(card(`<p class="big">HowSure</p><p>${esc(REPO_URL)}</p><p class="muted">Built with the Devpost Learn Skill Pack</p>`))
  await beat(page, 5)
})
