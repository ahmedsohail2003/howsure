// Build-out item 2.8 (checklist slice 18; prd.md > 3-Day Timeline): the expected-sleep rule.
// "Expected sleep is marked at wake time + your usual day length, preset to 16 h ... and editable,
// labelled 'your setting, not advice'." Expected values are worked out by hand from the times below
// (the tests run in America/Toronto, tests/vitest.setup.ts). The people are the fictional Sam.
import { describe, expect, it } from 'vitest'
import { toLocalIso } from '../../clock'
import {
  DEFAULT_USUAL_DAY_HOURS,
  expectedSleepMs,
  isUsualDayHours,
  USUAL_DAY_MAX_HOURS,
  USUAL_DAY_MIN_HOURS,
  usualDayHours,
} from '../sleepday'

const at = (wake: string, hours: number) => toLocalIso(expectedSleepMs(wake, hours))

describe('the usual day length', () => {
  it('is preset to 16 h until one is saved', () => {
    expect(DEFAULT_USUAL_DAY_HOURS).toBe(16)
    expect(usualDayHours(undefined)).toBe(16)
  })

  it('uses a saved length within 6 to 23 h, half hours included', () => {
    expect([USUAL_DAY_MIN_HOURS, USUAL_DAY_MAX_HOURS]).toEqual([6, 23])
    for (const h of [6, 15, 15.5, 17, 23]) expect(usualDayHours(h)).toBe(h)
  })

  it('never uses a value outside the range, or one that is not a number: the preset stands', () => {
    for (const bad of [5.5, 23.5, 0, -16, Number.NaN, Number.POSITIVE_INFINITY, '16', null]) {
      expect(isUsualDayHours(bad)).toBe(false)
      expect(usualDayHours(bad)).toBe(16)
    }
  })
})

describe('expected sleep: the wake plus the usual day length', () => {
  it('with the 16 h preset, sits 16 h after the wake: Wed 1:20 PM gives Thu 5:20 AM', () => {
    expect(at('2026-10-21T13:20:00-04:00', 16)).toBe('2026-10-22T05:20:00-04:00')
    expect(expectedSleepMs('2026-10-21T13:20:00-04:00', 16) - Date.parse('2026-10-21T13:20:00-04:00')).toBe(16 * 3_600_000)
  })

  it('follows the setting: 15 h after a 7:00 AM wake is 10:00 PM the same day, 17 h 30 min is 12:30 AM the next', () => {
    expect(at('2026-10-20T07:00:00-04:00', 15)).toBe('2026-10-20T22:00:00-04:00')
    expect(at('2026-10-20T07:00:00-04:00', 17.5)).toBe('2026-10-21T00:30:00-04:00')
  })

  it('moves with the wake, never a fixed clock time: a later wake gives a later marker', () => {
    expect(at('2026-10-19T09:45:00-04:00', 16)).toBe('2026-10-20T01:45:00-04:00')
    expect(at('2026-10-20T06:10:00-04:00', 16)).toBe('2026-10-20T22:10:00-04:00')
  })

  it('counts hours that pass: across the clock change (Sun Nov 1, 2026) 16 h after Sat 1:00 PM shows 4:00 AM', () => {
    // 13:00 EDT (-04:00) + 16 h = 05:00 EDT, which is 04:00 EST (-05:00) once the clocks go back.
    expect(at('2026-10-31T13:00:00-04:00', 16)).toBe('2026-11-01T04:00:00-05:00')
  })

  it('reads the wake as stored, offset included', () => {
    expect(expectedSleepMs('2026-10-21T17:20:00Z', 16)).toBe(Date.parse('2026-10-22T09:20:00Z'))
  })
})
