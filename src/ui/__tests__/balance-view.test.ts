// Build-out item 2.5b: the estimated deficit or surplus under the headline (balanceView.ts), worked
// out once for every look. The person is the fictional Sam (fixtures/demo-week.json), with made-up
// body details: 34 years, female, 168 cm, 64 kg, so resting burn is 10 × 64 + 6.25 × 168 − 5 × 34
// − 161 = 1,359 kcal a day (golden E1), with a 10% typical error (sd 135.9).
//
// Worked by hand:
// - Monday (wake Mon 1:15 PM, next wake Tue 1:05 PM: 23 h 50 min, 0.99306 of a day), mostly
//   sitting: everyday burn 1,359 × 1.2 × 0.99306 = 1,619.48, plus the Brisk walk 210 (device, sd 84)
//   = 1,829.48. Eaten 290 + 560 + 610 = 1,460 (sd √(29² + 117.6² + 48.8²) = 130.6). Balance
//   1,460 − 1,829.48 = −369.48: "Estimated deficit 369 kcal". sd √(130.6² + 84² + 161.95²) = 224.4,
//   so likely −369.48 ± 287.5 = 82–657 kcal deficit, and very likely −369.48 ± 439.7 runs from a
//   70 kcal surplus to an 809 kcal deficit.
// - Wednesday, the demo's current day (wake Wed 1:20 PM, now Thu 1:30 AM: 12 h 10 min, 0.50694 of
//   a day): everyday 1,359 × 1.2 × 0.50694 = 826.7; eaten 2,280 (G11, sd 381.2); balance 1,453.3,
//   "Estimated surplus 1,453 kcal so far".
import { describe, expect, it } from 'vitest'
import { demoDoc, demoStartIso } from '../../kernel/__tests__/helpers'
import type { BodyDetails, LogDoc } from '../../store/log'
import { balanceView, bodyValueInRange, fieldList, latestWeighIn, missingBodyFields } from '../balanceView'
import { buildDayViewFor } from '../dayView'
import { fmtPastWhen } from '../format'

const WED = '2026-10-21T13:20:00-04:00'
const MON = '2026-10-19T13:15:00-04:00'
const SAM: BodyDetails = { age: 34, sex: 'female', heightCm: 168, heightUnit: 'cm', weightKg: 64, weightUnit: 'kg' }

function withBody(body: BodyDetails | undefined, extra: Partial<LogDoc> = {}): LogDoc {
  return { ...demoDoc, profile: { ...demoDoc.profile, body }, ...extra }
}

function shown(doc: LogDoc, dayStart: string | null, now = demoStartIso) {
  const b = balanceView(doc, buildDayViewFor(doc, dayStart), now)
  if (b.kind !== 'shown') throw new Error(`expected the estimate, got ${b.kind}`)
  return b
}

describe('balanceView: never guesses an input', () => {
  it('with no body details, invites adding all four in Profile', () => {
    const b = balanceView(withBody(undefined), buildDayViewFor(demoDoc, WED), demoStartIso)
    expect(b).toEqual({
      kind: 'invite',
      missing: ['age', 'sex', 'height', 'weight'],
      text: 'Add your age, sex, height and weight in Profile to see an estimated deficit or surplus.',
    })
  })

  it('names only what is missing, and says Sam’s in the demo', () => {
    const doc = withBody({ age: 34, sex: 'unspecified' })
    expect(balanceView(doc, buildDayViewFor(doc, WED), demoStartIso).kind).toBe('invite')
    expect(balanceView(doc, buildDayViewFor(doc, WED), demoStartIso, true)).toMatchObject({
      text: 'Add Sam’s height and weight to see an estimated deficit or surplus.',
    })
    expect(fieldList(['weight'])).toBe('weight')
    expect(missingBodyFields({ ...SAM, weightKg: undefined }, true)).toEqual([])
  })

  it('the activity level is not required: missing reads as the default, mostly sitting', () => {
    const b = shown(withBody(SAM), MON)
    expect(b.inputs).toMatchObject({ activity: 'sitting', activityDefault: true, factor: 1.2 })
  })

  it('needs a wake time on the provisional day', () => {
    const doc = withBody(SAM, { sleeps: [] })
    expect(balanceView(doc, buildDayViewFor(doc, null), demoStartIso)).toEqual({
      kind: 'needsWake',
      text: 'Estimated deficit or surplus: needs a wake time to count the day from.',
    })
  })

  it('does not count a current day whose wake is more than a day old up to now (build-out item 2.1b)', () => {
    const doc = withBody(SAM)
    // Wednesday's wake was 1:20 PM; at 1:20 PM Thursday it is exactly a day old and still counted.
    expect(shown(doc, WED, '2026-10-22T13:20:00-04:00').inputs.hours).toBe(24)
    // A minute later, and days later, the line says the next wake is needed instead of adding days of burn.
    for (const now of ['2026-10-22T13:21:00-04:00', '2026-10-25T09:00:00-04:00']) {
      expect(balanceView(doc, buildDayViewFor(doc, WED), now)).toEqual({
        kind: 'needsWake',
        text: 'Estimated deficit or surplus: not counted, as you woke up more than a day ago.',
      })
    }
    // An earlier day with its next wake is counted as before, whenever it is viewed.
    expect(shown(doc, MON, '2026-10-25T09:00:00-04:00').inputs.soFar).toBe(false)
  })

  it('does not count an earlier day that runs for more than 36 hours, as after setting today’s wake time days later', () => {
    // Wednesday woke 1:20 PM; the next wake is set on Sunday at 7:10 AM ("Set today’s wake time"),
    // so Wednesday now runs 89 h 50 min to its next wake. One day's meals against nearly four days
    // of resting burn would read as a huge deficit, so it is not counted.
    const sunday = { id: 'sleep-sun', sleepStart: null, wake: '2026-10-25T07:10:00-04:00' }
    const base = withBody(SAM)
    const doc = { ...base, sleeps: [...base.sleeps, sunday] }
    const now = '2026-10-25T07:15:00-04:00'
    expect(balanceView(doc, buildDayViewFor(doc, WED), now)).toEqual({
      kind: 'needsWake',
      text: 'Estimated deficit or surplus: not counted, as this day runs for more than 36 hours. A night may be missing.',
    })
    // A day of 36 hours exactly is still counted, as an earlier day of normal length is.
    const at36 = { ...sunday, wake: '2026-10-23T01:20:00-04:00' }
    const doc36 = { ...base, sleeps: [...base.sleeps, at36] }
    expect(shown(doc36, WED, now).inputs.hours).toBe(36)
    const at36plus = { ...sunday, wake: '2026-10-23T01:21:00-04:00' }
    const doc36plus = { ...base, sleeps: [...base.sleeps, at36plus] }
    expect(balanceView(doc36plus, buildDayViewFor(doc36plus, WED), now).kind).toBe('needsWake')
    expect(shown(doc, MON, now).inputs.soFar).toBe(false)
  })

  it('uses the header’s staleness rule: while asleep the current day is counted so far, up to 36 hours', () => {
    const base = withBody(SAM)
    // Wednesday woke 1:20 PM and went to sleep at 11 PM; at 1:30 PM Thursday it is still asleep.
    const asleep = { id: 'sleep-thu', sleepStart: '2026-10-21T23:00:00-04:00', wake: null }
    const doc = { ...base, sleeps: [...base.sleeps, asleep] }
    const b = shown(doc, WED, '2026-10-22T13:30:00-04:00')
    expect(b.inputs.soFar).toBe(true)
    // Asleep for days: more than 36 hours since the wake, so not counted.
    expect(balanceView(doc, buildDayViewFor(doc, WED), '2026-10-23T02:00:00-04:00')).toMatchObject({
      kind: 'needsWake',
      text: 'Estimated deficit or surplus: not counted, as this day runs for more than 36 hours. A night may be missing.',
    })
  })

  it('adds nothing on a day with no known calories eaten (never counted as 0 eaten): the headline already says so', () => {
    const doc = withBody(SAM, { meals: [] })
    expect(balanceView(doc, buildDayViewFor(doc, WED), demoStartIso)).toEqual({ kind: 'hidden' })
    // Nor on the provisional day with nothing eaten yet.
    const fresh = withBody(SAM, { meals: [], sleeps: [] })
    expect(balanceView(fresh, buildDayViewFor(fresh, null), demoStartIso)).toEqual({ kind: 'hidden' })
    // The invite still shows: it is about the missing details, not the day.
    const none = withBody(undefined, { meals: [] })
    expect(balanceView(none, buildDayViewFor(none, WED), demoStartIso).kind).toBe('invite')
  })

  it('treats values outside the form’s ranges as missing (only a hand-edited file holds them), so the invite shows', () => {
    const odd = withBody({ age: 1000, sex: 'male', heightCm: 1, weightKg: 1 })
    expect(balanceView(odd, buildDayViewFor(odd, MON), demoStartIso)).toMatchObject({
      kind: 'invite',
      missing: ['age', 'height', 'weight'],
    })
    expect(missingBodyFields({ ...SAM, age: 17 }, false)).toEqual(['age'])
    expect(missingBodyFields({ ...SAM, age: 121 }, false)).toEqual(['age'])
    expect(missingBodyFields({ ...SAM, heightCm: 99.9 }, false)).toEqual(['height'])
    expect(missingBodyFields({ ...SAM, heightCm: 250.1 }, false)).toEqual(['height'])
    expect(missingBodyFields({ ...SAM, weightKg: 300.1 }, false)).toEqual(['weight'])
    // The form's ends are in range, 66 lb (29.94 kg) included.
    expect(missingBodyFields({ ...SAM, age: 18, heightCm: 100, weightKg: 29.937 }, false)).toEqual([])
    expect(missingBodyFields({ ...SAM, age: 120, heightCm: 250, weightKg: 300 }, false)).toEqual([])
    expect(bodyValueInRange('weight', 29.9)).toBe(false)
  })

  it('treats an age that is not a whole number as missing (the form takes whole years only)', () => {
    expect(bodyValueInRange('age', 34.7)).toBe(false)
    expect(bodyValueInRange('age', 34)).toBe(true)
    const odd = withBody({ ...SAM, age: 34.7 })
    expect(balanceView(odd, buildDayViewFor(odd, MON), demoStartIso)).toMatchObject({ kind: 'invite', missing: ['age'] })
  })

  it('leaves the line out for a day whose counted-back age is below 18, never feeding the equation 17', () => {
    // Typed as 18 in October 2027: Sam's Monday in October 2026 is a whole year before, so 17.
    const young = withBody({ ...SAM, age: 18, ageSetOn: '2027-10-25' })
    expect(balanceView(young, buildDayViewFor(young, MON), demoStartIso)).toEqual({ kind: 'hidden' })
    // Typed as 19 then: 18 on Monday, inside the range, so it shows.
    const ok = withBody({ ...SAM, age: 19, ageSetOn: '2027-10-25' })
    expect(shown(ok, MON).inputs.age).toBe(18)
    // Moved on past 120 the same way.
    const old = withBody({ ...SAM, age: 120, ageSetOn: '2025-10-01' })
    expect(balanceView(old, buildDayViewFor(old, MON), demoStartIso)).toEqual({ kind: 'hidden' })
  })

  it('adds nothing on a day whose workouts all have unknown calories (never counted as 0 burned), as net says', () => {
    const doc = withBody(SAM)
    const unknownWalk = { ...doc, workouts: doc.workouts.map((w) => ({ ...w, kcal: null, source: null })) }
    const view = buildDayViewFor(unknownWalk, MON)
    expect(view.burned.status).toBe('all-unknown')
    expect(view.net).toBeNull()
    expect(balanceView(unknownWalk, view, demoStartIso)).toEqual({ kind: 'hidden' })
    // With one known workout beside the unknown one, the known one counts and the line says known entries only.
    const known = { ...doc.workouts[0], id: 'workout-known', name: 'Swim', kcal: 150, source: 'burn_device' as const }
    const partial = { ...unknownWalk, workouts: [...unknownWalk.workouts, known] }
    const b = shown(partial, MON)
    expect(b.workouts).toBe(150)
    expect(b.knownOnly).toBe(true)
    // A day with no workouts at all counts 0 workouts: Wednesday has none.
    expect(shown(doc, WED).workouts).toBe(0)
  })
})

describe('balanceView: Sam’s Monday, a whole waking day with a workout', () => {
  const b = shown(withBody(SAM), MON)

  it('counts from the day’s wake to the next wake', () => {
    expect(b.inputs.soFar).toBe(false)
    expect(b.inputs.to).toBe('2026-10-20T13:05:00-04:00')
    expect(b.inputs.hours).toBeCloseTo(23 + 50 / 60, 9)
  })

  it('eaten 1,460 minus resting × 1.2 × share plus the walk: an estimated deficit of 369 kcal', () => {
    expect(b.resting.kcal).toBe(1359)
    expect(b.eaten).toBe(1460)
    expect(b.workouts).toBe(210)
    expect(Math.abs(b.est.everyday - 1619.5)).toBeLessThan(0.1)
    expect(Math.abs(b.est.burn - 1829.5)).toBeLessThan(0.1)
    expect(Math.abs(b.est.sd - 224.4)).toBeLessThan(0.1)
    expect(b.rounded).toBe(-369)
    expect(b.direction).toBe('deficit')
    expect(b.text).toBe('Estimated deficit 369 kcal')
  })

  it('writes its ranges on the deficit scale, across 0 when needed', () => {
    expect(b.likelyText).toBe('likely 82–657 kcal deficit')
    expect(b.veryLikelyText).toBe('very likely 70 kcal surplus to 809 kcal deficit')
    expect(b.likelyShort).toBe('likely 82–657 deficit')
    expect(b.knownOnly).toBe(false)
    expect(b.label).toBe('Estimated deficit 369 kcal, likely 82–657 kcal deficit. Opens how it is worked out.')
  })
})

describe('balanceView: the current day counts up to now ("so far")', () => {
  it('Wednesday at Thu 1:30 AM: 12 h 10 min counted, an estimated surplus so far', () => {
    const b = shown(withBody(SAM), WED)
    expect(b.inputs.soFar).toBe(true)
    expect(b.inputs.to).toBe(demoStartIso)
    expect(b.inputs.hours).toBeCloseTo(12 + 10 / 60, 9)
    expect(Math.abs(b.est.everyday - 826.7)).toBeLessThan(0.1)
    expect(b.text).toBe('Estimated surplus 1,453 kcal so far')
    expect(b.likelyText).toMatch(/^likely [\d,]+–[\d,]+ kcal surplus$/)
  })

  it('never counts burn past now, even with a next wake logged ahead of the clock', () => {
    const b = shown(withBody(SAM), MON, '2026-10-20T08:00:00-04:00')
    expect(b.inputs.soFar).toBe(true)
    expect(b.inputs.to).toBe('2026-10-20T08:00:00-04:00')
    expect(b.inputs.hours).toBeCloseTo(18.75, 9)
    expect(b.text).toMatch(/ so far$/)
  })

  it('the same day later on counts more burn, so the surplus shrinks', () => {
    const later = shown(withBody(SAM), WED, '2026-10-22T09:30:00-04:00')
    expect(later.inputs.hours).toBeCloseTo(20 + 10 / 60, 9)
    expect(later.rounded).toBeLessThan(shown(withBody(SAM), WED).rounded)
  })
})

describe('balanceView: inputs', () => {
  it('prefer not to say widens the range', () => {
    const female = shown(withBody(SAM), MON)
    const unspecified = shown(withBody({ ...SAM, sex: 'unspecified' }), MON)
    expect(unspecified.resting.kcal).toBe(1359 + 83)
    expect(unspecified.est.sd).toBeGreaterThan(female.est.sd)
  })

  it('a higher activity level burns more', () => {
    const sitting = shown(withBody(SAM), MON)
    const moderate = shown(withBody({ ...SAM, activity: 'moderate' }), MON)
    expect(moderate.inputs).toMatchObject({ activity: 'moderate', activityDefault: false, factor: 1.55 })
    expect(moderate.est.everyday / sitting.est.everyday).toBeCloseTo(1.55 / 1.2, 9)
  })

  it('moves the age on by the whole years since it was typed', () => {
    const b = shown(withBody({ ...SAM, ageSetOn: '2024-10-01' }), MON)
    expect(b.inputs.age).toBe(36)
    expect(b.resting.kcal).toBe(1359 - 10)
  })

  it('uses the latest weigh-in up to the day’s end in place of the typed weight', () => {
    const weighIns = [
      { id: 'w1', at: '2026-10-19T08:00:00-04:00', kg: 66 },
      { id: 'w2', at: '2026-10-20T08:00:00-04:00', kg: 65 },
      // After Monday's day ends (Tue 1:05 PM): not used for Monday.
      { id: 'w3', at: '2026-10-21T08:00:00-04:00', kg: 99 },
      { id: 'bad', at: 'not a time', kg: 70 },
    ]
    const doc = { ...withBody(SAM), weighIns } as LogDoc
    const b = shown(doc, MON)
    expect(b.inputs.weightKg).toBe(65)
    expect(b.inputs.weightFrom).toEqual({ from: 'weighIn', at: '2026-10-20T08:00:00-04:00', approx: false, when: 'Tue 8:00 AM' })
    expect(b.resting.kcal).toBe(1359 + 10)
    expect(latestWeighIn(doc, '2026-10-19T00:00:00-04:00')).toBeNull()
    // A weigh-in also stands in for a weight never typed.
    const noTyped = { ...withBody({ ...SAM, weightKg: undefined }), weighIns } as LogDoc
    expect(balanceView(noTyped, buildDayViewFor(noTyped, MON), demoStartIso).kind).toBe('shown')
  })

  it('names an older weigh-in by its date, and leaves out a time that was not recorded', () => {
    const weighIns = [
      { id: 'w-old', at: '2026-09-22T07:10:00-04:00', kg: 66 },
      { id: 'w-date', at: '2026-09-29T12:00:00-04:00', kg: 65, timeApproximate: true },
      { id: 'w-odd', at: '2026-10-01T08:00:00-04:00', kg: 5 },
    ]
    const doc = { ...withBody(SAM), weighIns } as LogDoc
    // The weigh-in of 5 kg is outside the form's range, so it is skipped.
    expect(latestWeighIn(doc, '2026-10-02T00:00:00-04:00')).toEqual({ kg: 65, at: '2026-09-29T12:00:00-04:00', approx: true })
    expect(shown(doc, MON).inputs.weightFrom).toEqual({
      from: 'weighIn',
      at: '2026-09-29T12:00:00-04:00',
      approx: true,
      when: 'Tue 29 Sep',
    })
    const timed = { ...withBody(SAM), weighIns: weighIns.slice(0, 1) } as LogDoc
    expect(shown(timed, MON).inputs.weightFrom).toMatchObject({ when: 'Tue 22 Sep, 7:10 AM' })
  })

  it('leaves out a meal with unknown calories and says known entries only', () => {
    const doc = withBody(SAM)
    const unknown = { ...doc.meals[0], id: 'm-unknown', kcal: null, source: null, eatenAt: '2026-10-19T15:00:00-04:00' }
    const withUnknown = { ...doc, meals: [...doc.meals, unknown] }
    const b = shown(withUnknown, MON)
    expect(b.knownOnly).toBe(true)
    expect(b.eaten).toBe(1460)
    expect(b.label).toContain('Known entries only')
  })
})

describe('fmtPastWhen: when a past entry was, plain enough to tell the day', () => {
  const now = '2026-11-05T12:00:00-05:00'
  it('uses the weekday within the last six days, else the date, with the year when not this year', () => {
    expect(fmtPastWhen('2026-11-05T07:10:00-05:00', now)).toBe('Thu 7:10 AM')
    expect(fmtPastWhen('2026-10-30T07:10:00-04:00', now)).toBe('Fri 7:10 AM')
    expect(fmtPastWhen('2026-10-29T07:10:00-04:00', now)).toBe('Thu 29 Oct, 7:10 AM')
    expect(fmtPastWhen('2025-12-30T07:10:00-05:00', now)).toBe('Tue 30 Dec 2025, 7:10 AM')
    // No recorded time: the date only, even this week.
    expect(fmtPastWhen('2026-11-03T12:00:00-05:00', now, false)).toBe('Tue 3 Nov')
  })
})
