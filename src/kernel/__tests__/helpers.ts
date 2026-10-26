// Shared test helpers (not a test file: vitest only collects *.test.ts).
import { expect } from 'vitest'
import demoJson from '../../../fixtures/demo-week.json'
import { toLocalIso } from '../../clock'
import { demoLog } from '../../store/log'
import type { DemoFixture, Meal, MealSourceId, Range } from '../types'

/** The fixture as stored: every time a wall-clock string with no offset (spec.md > Clock). */
export const demo = demoJson as unknown as DemoFixture

const started = demoLog()
/** The demo as the app loads it: every time converted to a local-offset ISO string. */
export const demoDoc = started.doc
/** The demo clock's first now (Thu 2026-10-22 01:30 local), as a local-offset ISO string. */
export const demoStartIso = toLocalIso(started.clockStartMs)

let seq = 0
export function meal(
  source: MealSourceId,
  kcal: number | null,
  over: Partial<Meal> = {},
): Meal {
  seq += 1
  return {
    id: `m${String(seq).padStart(3, '0')}`,
    name: `meal ${seq}`,
    eatenAt: '2026-10-21T12:00:00-04:00',
    source,
    kcal,
    protein: null,
    carbs: null,
    fat: null,
    ...over,
  }
}

/** Range ends after Math.round, within +-1 kcal of the spec table. */
export function expectRange(r: Range | null, lo: number, hi: number): void {
  expect(r).not.toBeNull()
  const got = r as Range
  expect(Math.abs(Math.round(got.lo) - lo), `lo ${got.lo} vs ${lo}`).toBeLessThanOrEqual(1)
  expect(Math.abs(Math.round(got.hi) - hi), `hi ${got.hi} vs ${hi}`).toBeLessThanOrEqual(1)
}

/** e within +-0.01 percentage points of the spec table's percent. */
export function expectEPercent(e: number | null, pct: number): void {
  expect(e).not.toBeNull()
  expect(Math.abs((e as number) * 100 - pct), `e ${(e as number) * 100}% vs ${pct}%`).toBeLessThanOrEqual(
    0.01 + 1e-9,
  )
}
