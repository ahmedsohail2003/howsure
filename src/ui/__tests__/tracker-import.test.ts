// Build-out item 2.1b: the words around an imported tracker log (the Import preview, an imported
// meal's time and details), the header's line for a wake that is days old, and what an edit does
// to an imported meal's own figures. The bundle is the fictional one for Sam
// (fixtures/tracker-bundle-sam.json); expected lines are written from its contents by hand.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { convertTrackerBundle, trackerMealInfo, type TrackerReport } from '../../import/trackerBundle'
import type { Meal } from '../../kernel/types'
import { copy } from '../copy'
import { checkDraft, draftFromMeal } from '../editMeal'
import { mealTimeLabel } from '../MealList'
import { trackerErrorLine, trackerJoinedLine, trackerPreview, trackerSourceText } from '../trackerPreview'
import { applySource } from '../../kernel/estimate'
import { getSource } from '../../kernel/sources'
import { staleWakeDays } from '../wakeSet'
import { buildDayViewFor } from '../dayView'
import { timelinePoints } from '../nightTimeline'
import { buildSleepView, sleepDetailView } from '../sleepView'
import { longDayNote } from '../balanceView'
import { wordRuleHits } from '../../../tests/wordRules'
import { togetherPieces } from '../KeepTogether'
import { latestMealElsewhere, dayNav } from '../days'
import { fmtCalendarDate } from '../format'

const BUNDLE = JSON.parse(readFileSync(fileURLToPath(new URL('../../../fixtures/tracker-bundle-sam.json', import.meta.url)), 'utf8'))
const res = convertTrackerBundle(BUNDLE)
if (!res.ok) throw new Error('the fictional bundle should convert')
const { doc, report } = res
const meal = (id: string) => doc.meals.find((m) => m.id === `tracker-${id}`) as Meal

describe('the Import preview for a tracker bundle', () => {
  it('says what the file becomes and everything the conversion did', () => {
    const p = trackerPreview(report, '2026-10-20T12:00:00-04:00')
    expect(p.becomes).toEqual([
      '19 meals on 5 days',
      '5 nights of sleep',
      '2 weigh-ins',
      'From Mon 12 Oct to Sat 17 Oct',
      'Targets: 2,300 kcal and at least 140 g protein',
    ])
    expect(p.notes).toEqual([
      'All 19 meals’ times are approximate. Your tracker kept the day, not the time eaten, so HowSure placed each meal in its waking day by its type.',
      '16 of 19 meals keep your tracker’s figure for how sure they are. The others use HowSure’s figure for their source.',
      '3 meals have no source recorded. HowSure counts them as Description.',
      '2 descriptions were cut short in your tracker. They are kept as they are.',
      'The bed time on Fri 16 Oct didn’t fall between the wake-up before it and its own wake-up, so it was worked out from the wake time and hours asleep in the same record.',
      '1 of 2 weigh-ins has no recorded time, so it is placed on its date, just after that date’s wake-up (at noon with no wake-up that date), and marked approximate.',
      'Not imported: 1 plate waiting to be logged and your tracker’s sync notes.',
    ])
    expect(p.joined).toEqual(['Wed 14 Oct joins Tue 13 Oct'])
  })

  it('handles a file with no targets, skipped records and a date before the first wake', () => {
    const r: TrackerReport = {
      ...report,
      meals: 1,
      days: 1,
      approximateTimes: 1,
      ownErrors: 0,
      untagged: 1,
      truncated: 1,
      bedDerived: [],
      bedSkipped: ['2026-10-16'],
      lateWakeDates: ['2026-10-15'],
      afterExportDates: ['2026-10-18'],
      skippedMeals: 2,
      unreadableMeals: 1,
      skippedNights: 1,
      repeatedWakes: 2,
      repeatedDates: 1,
      weighins: 1,
      weighinsApproximate: 1,
      weighinsSkipped: 2,
      pending: 0,
      syncSkipped: false,
      targets: null,
      joined: [{ date: '2026-10-10', joinedTo: null }],
    }
    const p = trackerPreview(r)
    expect(p.becomes).toEqual(['1 meal on 1 day', '5 nights of sleep', '1 weigh-in', 'From Mon 12 Oct 2026 to Sat 17 Oct 2026', 'No targets in the file'])
    expect(p.notes).toEqual([
      'The meal’s time is approximate. Your tracker kept the day, not the time eaten, so HowSure placed each meal in its waking day by its type.',
      'The meal uses HowSure’s figure for its source, not your tracker’s figure for how sure it is.',
      '1 meal has no source recorded. HowSure counts it as Description.',
      '1 description was cut short in your tracker. It is kept as it is.',
      'The bed time on Fri 16 Oct 2026 didn’t fall between the wake-up before it and its own wake-up, and couldn’t be worked out, so it is not logged.',
      'The wake-up on Thu 15 Oct 2026 came in the evening, so some of that date’s meals show times after midnight. They stay on that date’s waking day.',
      '2 meals have no usable date, so they are left out.',
      '1 meal has a type, description or amount HowSure couldn’t read, so it is left out.',
      '1 night has no wake time with its time zone, so it is left out.',
      '2 nights repeat the wake time of another night, so they are left out.',
      '1 night has the same date as another night, so the one saved earlier is left out.',
      'Meals dated Sun 18 Oct 2026 are later than when the file was exported. They are kept on their own date.',
      'The weigh-in has no recorded time, so it is placed on its date, just after that date’s wake-up (at noon with no wake-up that date), and marked approximate.',
      '2 weigh-ins have no usable date or weight, so they are left out.',
    ])
    expect(p.joined).toEqual(['Sat 10 Oct 2026 comes before your first recorded wake-up'])
  })

  it('says when several dates before the first wake share one day and one total', () => {
    const two = trackerPreview({ ...report, joined: [{ date: '2026-10-10', joinedTo: null }, { date: '2026-10-11', joinedTo: null }] }, '2026-10-20T12:00:00-04:00')
    expect(two.notes).toContain(
      '2 dates come before your first recorded wake-up, so they show together as one day, with one total, until the nights between them are added.',
    )
    expect(two.joined).toEqual(['Sat 10 Oct comes before your first recorded wake-up', 'Sun 11 Oct comes before your first recorded wake-up'])
    // One such date is one day already: no note.
    const one = trackerPreview({ ...report, joined: [{ date: '2026-10-10', joinedTo: null }] }, '2026-10-20T12:00:00-04:00')
    expect(one.notes.some((n) => n.includes('show together as one day'))).toBe(false)
  })

  it('names dates by their own calendar day', () => {
    expect(fmtCalendarDate('2026-10-14', '2026-10-20T12:00:00-04:00')).toBe('Wed 14 Oct')
    expect(fmtCalendarDate('2026-11-01', '2026-10-20T12:00:00-04:00')).toBe('Sun 1 Nov')
    // Another year's date, or no now to compare with, shows its year.
    expect(fmtCalendarDate('2025-12-31', '2026-10-20T12:00:00-04:00')).toBe('Wed 31 Dec 2025')
    expect(fmtCalendarDate('2026-10-14')).toBe('Wed 14 Oct 2026')
    // Never a raw ISO date in a line a person reads.
    const lines = [...trackerPreview(report, '2026-10-20T12:00:00-04:00').becomes, ...trackerPreview(report, '2026-10-20T12:00:00-04:00').notes, ...trackerPreview(report, '2026-10-20T12:00:00-04:00').joined]
    expect(lines.filter((l) => /\d{4}-\d{2}-\d{2}/.test(l))).toEqual([])
  })

  it('obeys the word rules', () => {
    const p = trackerPreview(report)
    const text = [...p.becomes, ...p.notes, ...p.joined, ...Object.values(copy.trackerImport.codes)].join('\n')
    expect(wordRuleHits(text)).toEqual([])
  })
})

describe('an imported meal', () => {
  it('reads its time as approximate', () => {
    const yogurt = meal('3000101')
    expect(mealTimeLabel(yogurt, '2026-10-12T07:00:00-04:00')).toMatch(/^about 9:30 AM$/)
    expect(mealTimeLabel({ ...yogurt, timeApproximate: undefined }, '2026-10-12T07:00:00-04:00')).toBe('9:30 AM')
  })

  it('names the tracker’s source in its own terms', () => {
    expect(trackerSourceText(trackerMealInfo(meal('3000102'))!)).toBe('Estimated from a photo, with the restaurant or dish identified')
    expect(trackerSourceText(trackerMealInfo(meal('3000106'))!)).toBe('Local restaurant meal, looked up in a food database')
    expect(trackerSourceText(trackerMealInfo(meal('3000109'))!)).toBe('No source recorded')
    expect(trackerSourceText(trackerMealInfo(meal('3000111'))!)).toBe('“FRUITBOWL”, a code HowSure doesn’t know, so no source recorded')
    expect(trackerMealInfo({ imported: undefined })).toBeNull()
    expect(trackerMealInfo({ imported: { from: 'elsewhere' } })).toBeNull()
  })

  it('keeps its own typical error through an edit to its name or note, and drops it with a new source or calories', () => {
    const soup = meal('3000102')
    const renamed = checkDraft({ ...draftFromMeal(soup), name: 'Soup and roll', note: 'Big bowl' }, soup).meal
    expect(renamed?.typicalError).toBe(0.3)
    expect(renamed?.timeApproximate).toBe(true)
    expect(renamed?.imported).toEqual(soup.imported)
    expect(checkDraft({ ...draftFromMeal(soup), source: 'label' }, soup).meal?.typicalError).toBeUndefined()
    expect(checkDraft({ ...draftFromMeal(soup), kcal: '560' }, soup).meal?.typicalError).toBeUndefined()
    // A time the person set is no longer approximate.
    const moved = checkDraft({ ...draftFromMeal(soup), eatenAtLocal: '2026-10-12T13:00' }, soup).meal
    expect(moved?.timeApproximate).toBeUndefined()
  })

  it('says truly why HowSure’s figure applies after an edit or Improve drops the tracker’s figure', () => {
    // Fictional meal 3000112: a photo estimate the tracker put at 71, so its own figure is 29%.
    const gnocchi = meal('3000112')
    const photo = getSource('photo')
    expect(trackerErrorLine(gnocchi, trackerMealInfo(gnocchi)!, photo)).toBe(
      'This meal’s typical error is your tracker’s figure for it. HowSure’s figure for Photo estimate is 46%.',
    )
    // New calories: the tracker's figure no longer fits, and the line says so, with the old figure beside it.
    const edited = checkDraft({ ...draftFromMeal(gnocchi), kcal: '720' }, gnocchi).meal as Meal
    expect(edited.typicalError).toBeUndefined()
    expect(trackerMealInfo(edited)?.trackerError).toBeCloseTo(0.29, 12)
    const changed = 'Its calories or source changed since the import, so HowSure’s figure for its source applies. Your tracker’s figure for it was 29%.'
    expect(trackerErrorLine(edited, trackerMealInfo(edited)!, photo)).toBe(changed)
    // Improve switches the source the same way.
    const improved = applySource([gnocchi], gnocchi.id, 'label')[0]
    expect(trackerErrorLine(improved, trackerMealInfo(improved)!, getSource('label'))).toBe(changed)
    // A meal whose tracker had no usable figure says that instead.
    const untagged = meal('3000109')
    expect(trackerMealInfo(untagged)?.trackerError).toBeNull()
    expect(trackerErrorLine(untagged, trackerMealInfo(untagged)!, getSource('description'))).toBe(
      'Your tracker had no usable figure for this meal, so HowSure’s figure for its source applies.',
    )
  })
})

describe('a joined meal’s details stay true after it moves', () => {
  const NOW = '2026-10-17T09:00:00-04:00'
  // Fictional meal 3000112 is filed under Wed 14 Oct, which has no sleep record, so it is joined
  // to Tue 13 Oct's waking day.
  it('says which waking day it shows on while that is still true', () => {
    const gnocchi = meal('3000112')
    expect(trackerJoinedLine(gnocchi, trackerMealInfo(gnocchi)!, doc.sleeps, NOW)).toBe(
      'Filed under Wed 14 Oct in your tracker, which has no sleep recorded for that date. It shows on Tue 13 Oct’s waking day until that night is added.',
    )
    // A meal on its own date's waking day has no such line.
    expect(trackerJoinedLine(meal('3000105'), trackerMealInfo(meal('3000105'))!, doc.sleeps, NOW)).toBeNull()
  })

  it('says only where the tracker filed it once an edit moves it to another waking day', () => {
    const gnocchi = meal('3000112')
    const moved = checkDraft({ ...draftFromMeal(gnocchi), eatenAtLocal: '2026-10-15T12:00' }, gnocchi).meal as Meal
    expect(trackerJoinedLine(moved, trackerMealInfo(moved)!, doc.sleeps, NOW)).toBe('Filed under Wed 14 Oct in your tracker.')
  })

  it('says only where the tracker filed it once a wake is added on its own date', () => {
    const gnocchi = meal('3000112')
    const wednesday = { id: 'sleep-wed', sleepStart: null, wake: '2026-10-14T07:05:00-04:00' }
    expect(trackerJoinedLine(gnocchi, trackerMealInfo(gnocchi)!, [...doc.sleeps, wednesday], NOW)).toBe(
      'Filed under Wed 14 Oct in your tracker.',
    )
  })

  it('before the first wake: says so only while it is still before the first wake', () => {
    const early = { ...meal('3000101'), imported: { ...meal('3000101').imported, joinedTo: null } } as Meal
    const info = trackerMealInfo(early)!
    const noEarlier = doc.sleeps // the first wake is Mon 12 Oct 7:00 AM
    const before = { ...early, eatenAt: '2026-10-12T06:00:00-04:00' }
    expect(trackerJoinedLine(before, info, noEarlier, NOW)).toBe('Filed under Mon 12 Oct in your tracker, before your first recorded wake-up.')
    expect(trackerJoinedLine(early, info, noEarlier, NOW)).toBe('Filed under Mon 12 Oct in your tracker.')
  })
})

describe('a wake that is days old', () => {
  const awake = { kind: 'awake', since: '2026-10-17T08:00:00-04:00', recordId: 'x' } as const
  it('counts whole days once it is more than a day old', () => {
    expect(staleWakeDays('2026-10-17T08:00:00-04:00', '2026-10-18T08:00:00-04:00', awake)).toBeNull()
    expect(staleWakeDays('2026-10-17T08:00:00-04:00', '2026-10-18T08:01:00-04:00', awake)).toBe(1)
    expect(staleWakeDays('2026-10-17T08:00:00-04:00', '2026-10-20T12:00:00-04:00', awake)).toBe(3)
  })

  it('says nothing for the provisional day or while asleep', () => {
    expect(staleWakeDays(null, '2026-10-20T12:00:00-04:00', awake)).toBeNull()
    const asleep = { kind: 'asleep', since: '2026-10-17T23:00:00-04:00', recordId: 'x' } as const
    expect(staleWakeDays('2026-10-17T08:00:00-04:00', '2026-10-20T12:00:00-04:00', asleep)).toBeNull()
  })

  it('reads as when the last wake-up was', () => {
    expect(copy.header.lastWake('Sat 17 Oct', '8:00 AM', copy.header.daysAgo(3))).toBe('Last wake\u2011up Sat 17 Oct, 8:00 AM · 3 days ago')
    expect(copy.header.daysAgo(1)).toBe('1 day ago')
  })
})

describe('the Night timeline of a day whose wake is days old', () => {
  it('gives now its weekday only once the wake is more than a day old', () => {
    const sat = '2026-10-17T08:00:00-04:00'
    const view = buildDayViewFor(doc, sat)
    const sleep = buildSleepView(doc.sleeps, sat)
    expect(timelinePoints(view, sleep, '2026-10-20T12:00:00-04:00').at(-1)).toEqual({ kind: 'now', at: '2026-10-20T12:00:00-04:00', laterDate: true })
    expect(timelinePoints(view, sleep, '2026-10-18T01:30:00-04:00').at(-1)).toEqual({ kind: 'now', at: '2026-10-18T01:30:00-04:00', laterDate: false })
  })
})

describe('dates and times stay whole when a line wraps', () => {
  it('picks out each date with its weekday, each time and each "days ago"', () => {
    const line = copy.header.lastWake('Wed 4 Nov', '11:35 AM', copy.header.daysAgo(1))
    expect(togetherPieces(line)).toEqual(['Wed 4 Nov', '11:35 AM', '1 day ago'])
    expect(togetherPieces(copy.header.lastWake('Sat 17 Oct', '8:00 AM', copy.header.daysAgo(3)))).toEqual(['Sat 17 Oct', '8:00 AM', '3 days ago'])
    // A count stays with its noun: "2 weigh-ins" never splits between the number and the word.
    expect(togetherPieces(copy.privacy.weighIns(2))).toEqual(['2 weigh-ins'])
    expect(togetherPieces(copy.privacy.weighIns(1))).toEqual(['1 weigh-in'])
    expect(togetherPieces(copy.privacy.span('Mon 12 Oct 2025', 'Sat 17 Oct'))).toEqual(['Mon 12 Oct 2025', 'Sat 17 Oct'])
    expect(togetherPieces(copy.privacy.span('2026-10-12', '2026-10-17'))).toEqual(['2026-10-12', '2026-10-17'])
    expect(togetherPieces('No dates here')).toEqual([])
  })
})

describe('an empty day in a log whose meals are days back', () => {
  it('points at the waking day of the latest meal only when it is more than a day away', () => {
    const now = '2026-10-20T12:00:00-04:00'
    const nav = dayNav(doc, null, now)
    const sat = '2026-10-17T08:00:00-04:00'
    expect(nav.current).toBe(sat)
    // Saturday is empty; the latest meals are on Friday, the day just before it: not offered.
    expect(latestMealElsewhere(doc, nav.days, sat, true)).toBeUndefined()
    // With Friday's meals gone, the latest is Thursday's day, two days back: offered.
    const fri = '2026-10-16T07:30:00-04:00'
    const noFri = { ...doc, meals: doc.meals.filter((m) => buildDayViewFor(doc, fri).meals.every((f) => f.id !== m.id)) }
    const latest = latestMealElsewhere(noFri, dayNav(noFri, null, now).days, sat, true)
    expect(latest).toEqual({ day: '2026-10-15T06:45:00-04:00', at: '2026-10-15T06:45:00-04:00' })
    expect(latestMealElsewhere(noFri, dayNav(noFri, null, now).days, sat, false)).toBeUndefined()
    expect(copy.emptyDay.lastMeal('Thu 15 Oct')).toBe('Last meal logged: Thu 15 Oct')
  })

  it('never points an earlier day at a meal logged after it', () => {
    // Two nights with nothing logged, before the first meal date: their days come before every meal.
    const early = {
      ...doc,
      sleeps: [
        { id: 'early-1', sleepStart: '2026-10-08T23:00:00-04:00', wake: '2026-10-09T07:00:00-04:00' },
        { id: 'early-2', sleepStart: '2026-10-09T23:00:00-04:00', wake: '2026-10-10T07:00:00-04:00' },
        ...doc.sleeps,
      ],
    }
    const now = '2026-10-20T12:00:00-04:00'
    const nav = dayNav(early, null, now)
    const fri9 = '2026-10-09T07:00:00-04:00'
    expect(nav.days).toContain(fri9)
    expect(buildDayViewFor(early, fri9).meals).toEqual([])
    // Fri 9 Oct is empty and every meal is a week later: no "Last meal logged" link there.
    expect(latestMealElsewhere(early, nav.days, fri9, true)).toBeUndefined()
    expect(latestMealElsewhere(early, nav.days, '2026-10-10T07:00:00-04:00', true)).toBeUndefined()
  })
})

describe('words for a meal with its own typical error and a day that isn’t today', () => {
  it('says the figure is the meal’s, not the source’s', () => {
    expect(copy.explainMeal.sentenceOwn('71', '29')).toContain('this meal is assigned a typical error of about 29%, your tracker’s figure for it.')
    expect(copy.explainDay.titleOtherDay).toBe("How sure is this day's total?")
    expect(copy.night.nowNoSleep('Tue 12:00 PM')).toBe('Tue 12:00 PM · no sleep logged since this wake\u2011up')
    expect(copy.sleep.noSleepSinceWake).toBe('No sleep logged since this wake\u2011up')
    // The hint names the sleep button by its own label, so a rename carries through.
    expect(copy.header.staleHint(copy.sleep.goingToSleep)).toBe('To add last night, use “I’m going to sleep” and set when you went to bed.')
  })

  it('counts meals keeping the tracker’s figure in plain words at every edge', () => {
    expect(copy.trackerImport.ownErrors(1, 1)).toBe('The meal keeps your tracker’s figure for how sure it is.')
    expect(copy.trackerImport.ownErrors(5, 5)).toBe('All 5 meals keep your tracker’s figure for how sure they are.')
    expect(copy.trackerImport.ownErrors(0, 4)).toBe(
      'All 4 meals use HowSure’s figure for their source, not your tracker’s figure for how sure they are.',
    )
    expect(copy.trackerImport.ownErrors(3, 4)).toBe(
      '3 of 4 meals keep your tracker’s figure for how sure they are. The others use HowSure’s figure for their source.',
    )
  })
})


describe('a day that ran for more than 36 hours says so (a date joined to it)', () => {
  const now = '2026-10-20T12:00:00-04:00'
  it('names how long Tuesday ran, with Wednesday joined to it, and says nothing on a day of ordinary length', () => {
    const tue = buildDayViewFor(doc, '2026-10-13T07:15:00-04:00')
    expect(longDayNote(doc, tue, now)).toBe(
      'This day ran for 47 h 30 min to its next wake-up, so a night may be missing. Its meals and total cover all of that time, more than one day.',
    )
    expect(longDayNote(doc, buildDayViewFor(doc, '2026-10-12T07:00:00-04:00'), now)).toBeNull()
    // The current day, still going on, three days old: the header speaks for it, not this note.
    expect(longDayNote(doc, buildDayViewFor(doc, '2026-10-17T08:00:00-04:00'), now)).toBeNull()
    // With no meals there is no total to read wrongly.
    expect(longDayNote({ ...doc, meals: [] }, buildDayViewFor({ ...doc, meals: [] }, '2026-10-13T07:15:00-04:00'), now)).toBeNull()
  })
})

describe('now’s sleep status in the sleep details, while the current day’s wake is days old', () => {
  it('says no sleep was logged since, never "Awake", on the current day', () => {
    const now = '2026-10-20T12:00:00-04:00'
    const sleep = buildSleepView(doc.sleeps, '2026-10-17T08:00:00-04:00')
    expect(sleepDetailView(sleep, true, now).now).toBe('No sleep logged since this wake‑up')
    // A day after the wake, it is "Awake" as usual.
    expect(sleepDetailView(sleep, true, '2026-10-17T20:00:00-04:00').now).toBe('Awake')
  })
})
