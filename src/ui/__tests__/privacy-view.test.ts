// Build-out item 1.2: the Profile and privacy panel's words that depend on a log. Expected text
// is written by hand from copy.ts and the counts given.
import { describe, expect, it } from 'vitest'
import type { LogSummary } from '../../store/transfer'
import { deleteItems, hasContent, holdsText, joinList, replacesText, spanText } from '../privacyView'

const SAM: LogSummary = {
  name: 'Sam',
  meals: 6,
  nights: 3,
  workouts: 1,
  plates: 1,
  savedMeals: 0,
  weighIns: 0,
  first: '2026-10-28T07:40:00-04:00',
  last: '2026-11-03T23:30:00+00:00',
}

const EMPTY: LogSummary = { name: '', meals: 0, nights: 0, workouts: 0, plates: 0, savedMeals: 0, weighIns: 0, first: null, last: null }
const NONE = { backups: 0, original: false }

describe('privacy panel words', () => {
  it('joins lists in plain English', () => {
    expect(joinList([])).toBe('')
    expect(joinList(['a'])).toBe('a')
    expect(joinList(['a', 'b'])).toBe('a and b')
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c')
  })

  it('says what a log holds, with workouts and plates only when there are some', () => {
    expect(holdsText(SAM)).toBe('6 meals, 3 nights of sleep, 1 workout and 1 saved plate')
    expect(holdsText({ ...SAM, meals: 1, nights: 1, workouts: 0, plates: 0 })).toBe('1 meal and 1 night of sleep')
    expect(holdsText(EMPTY)).toBe('0 meals and 0 nights of sleep')
  })

  it('counts saved meals (build-out item 2.3) only when there are some', () => {
    expect(holdsText({ ...SAM, savedMeals: 2 })).toBe('6 meals, 3 nights of sleep, 1 workout, 1 saved plate and 2 saved meals')
    expect(holdsText({ ...EMPTY, savedMeals: 1 })).toBe('0 meals, 0 nights of sleep and 1 saved meal')
    expect(hasContent({ ...EMPTY, savedMeals: 1 })).toBe(true)
    expect(deleteItems({ ...EMPTY, savedMeals: 3 }, null, NONE)).toContain('3 saved meals')
  })

  it('counts weigh-ins (build-out item 2.4) only when there are some', () => {
    expect(holdsText({ ...SAM, weighIns: 1 })).toBe('6 meals, 3 nights of sleep, 1 workout, 1 saved plate and 1 weigh-in')
    expect(holdsText({ ...EMPTY, weighIns: 10 })).toBe('0 meals, 0 nights of sleep and 10 weigh-ins')
    expect(hasContent({ ...EMPTY, weighIns: 1 })).toBe(true)
    expect(deleteItems({ ...EMPTY, weighIns: 4 }, null, NONE)).toContain('4 weigh-ins')
  })

  it('gives the span in local dates (Toronto: 23:30 UTC on Nov 3 is 18:30 on Nov 3)', () => {
    expect(spanText(SAM, '2026-11-05T09:00:00-05:00')).toBe('From Wed 28 Oct to Tue 3 Nov')
    expect(spanText({ ...SAM, last: SAM.first }, '2026-11-05T09:00:00-05:00')).toBe('On Wed 28 Oct')
    // In another year, or with no now to compare with, the year is shown.
    expect(spanText(SAM, '2027-01-02T09:00:00-05:00')).toBe('From Wed 28 Oct 2026 to Tue 3 Nov 2026')
    expect(spanText(SAM)).toBe('From Wed 28 Oct 2026 to Tue 3 Nov 2026')
    expect(spanText(EMPTY)).toBe('No meals or sleep logged yet.')
  })

  it('says what an Import replaces, naming the guest name, targets and settings as Delete does', () => {
    expect(replacesText(SAM)).toBe(
      'Importing replaces your log on this device, which holds 6 meals, 3 nights of sleep, 1 workout and 1 saved plate, and your guest name, targets, body details and settings. HowSure keeps a copy of it, which you can export from this panel.',
    )
    // An empty log with a generated name (build-out item 2.10), which a named file replaces.
    expect(replacesText({ ...EMPTY, name: 'SwiftOtter#0042' })).toBe(
      'Importing replaces your guest name, targets, body details and settings on this device. Your log has no meals or sleep yet.',
    )
    // After a failed save, the kept copy may lack what is on screen: export first.
    expect(replacesText(SAM, false)).toBe(
      "Importing replaces your log on this device, which holds 6 meals, 3 nights of sleep, 1 workout and 1 saved plate, and your guest name, targets, body details and settings. Some changes couldn’t be saved, so the copy HowSure keeps may not have them. Export your log first if you want to keep it.",
    )
    expect(replacesText(EMPTY, false)).toBe(replacesText(EMPTY))
  })

  it('leaves the guest name out of what an Import replaces when it is kept, or there is none (item 2.10)', () => {
    // The file has no usable name, so yours is kept.
    expect(replacesText(SAM, true, false)).toBe(
      'Importing replaces your log on this device, which holds 6 meals, 3 nights of sleep, 1 workout and 1 saved plate, and your targets, body details and settings. HowSure keeps a copy of it, which you can export from this panel.',
    )
    expect(replacesText(SAM, false, false)).toBe(
      "Importing replaces your log on this device, which holds 6 meals, 3 nights of sleep, 1 workout and 1 saved plate, and your targets, body details and settings. Some changes couldn’t be saved, so the copy HowSure keeps may not have them. Export your log first if you want to keep it.",
    )
    expect(replacesText({ ...EMPTY, name: 'SwiftOtter#0042' }, true, false)).toBe(
      'Importing replaces your targets, body details and settings on this device. Your log has no meals or sleep yet.',
    )
    // Your log has no name, so there is none to replace, whatever the file holds.
    expect(replacesText(EMPTY)).toBe('Importing replaces your targets, body details and settings on this device. Your log has no meals or sleep yet.')
    expect(replacesText({ ...SAM, name: '' })).not.toMatch(/guest name/)
    for (const text of [replacesText(SAM, true, false), replacesText(EMPTY), replacesText({ ...SAM, name: '' }, false)]) expect(text).not.toMatch(/guest name/)
    expect(hasContent(EMPTY)).toBe(false)
    expect(hasContent({ ...EMPTY, plates: 1 })).toBe(true)
  })

  it('lists what Delete removes', () => {
    expect(deleteItems(SAM, null, NONE)).toEqual([
      '6 meals',
      '3 nights of sleep',
      '1 workout',
      '1 saved plate',
      'your guest name, targets, body details and settings',
    ])
    expect(deleteItems({ ...EMPTY, name: 'SwiftOtter#0042' }, null, { backups: 1, original: false })).toEqual([
      '0 meals',
      '0 nights of sleep',
      'your guest name, targets, body details and settings',
      '1 older copy, kept when the saved format was updated or an import replaced your log',
    ])
    // A log with no guest name (one saved before names existed) has none to delete, so the list
    // leaves it out, as the Import preview does.
    expect(deleteItems({ ...SAM, name: '' }, null, NONE)).toEqual([
      '6 meals',
      '3 nights of sleep',
      '1 workout',
      '1 saved plate',
      'your targets, body details and settings',
    ])
  })

  it('when the saved copy cannot be read, names it, and what is on screen was never saved', () => {
    for (const problem of ['unreadable', 'newer'] as const) {
      expect(deleteItems(EMPTY, problem, { backups: 2, original: false })).toEqual([
        "your saved log, which this version of HowSure can't read",
        '2 older copies, kept when the saved format was updated or an import replaced your log',
      ])
      expect(deleteItems({ ...EMPTY, meals: 2 }, problem, NONE)).toEqual([
        "your saved log, which this version of HowSure can't read",
        '2 meals and 0 nights of sleep on screen, which were never saved',
      ])
    }
  })

  it('names the original older-format copy when it was never backed up', () => {
    expect(deleteItems(SAM, 'notBackedUp', { backups: 1, original: true })).toEqual([
      '6 meals',
      '3 nights of sleep',
      '1 workout',
      '1 saved plate',
      'your guest name, targets, body details and settings',
      'the older-format copy of your saved log, which was never backed up',
      '1 older copy, kept when the saved format was updated or an import replaced your log',
    ])
  })
})
