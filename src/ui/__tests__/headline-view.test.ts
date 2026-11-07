// Build-out item 2.5a (slice 10): what the headline shows, worked out once for every look
// (headlineView.ts), the workout form's checks (editWorkout.ts), the net range bar (rangeBar.ts)
// and workouts on the Night timeline (nightTimeline.ts). The person is the fictional Sam: his
// Wednesday is G11 (2,280 kcal, score 83). By hand: a 300 kcal rough guess has sd 150; net is
// 1,980 with sd √(381.2² + 150²) = 409.7, so likely 1,455–2,505 and very likely 1,177–2,783.
import { describe, expect, it } from 'vitest'
import { demoDoc, demoStartIso } from '../../kernel/__tests__/helpers'
import type { Workout } from '../../kernel/types'
import type { LogDoc } from '../../store/log'
import { buildDayViewFor } from '../dayView'
import { blankWorkout, checkWorkoutDraft, draftFromWorkout, withoutWorkout, withWorkout } from '../editWorkout'
import { fmtSigned, fmtSignedRange, fmtSignedRangeShort } from '../format'
import { headlineView } from '../headlineView'
import { timelinePoints } from '../nightTimeline'
import { rangeBarGeometry } from '../rangeBar'
import { buildSleepView } from '../sleepView'

const WED = '2026-10-21T13:20:00-04:00'
const MON = '2026-10-19T13:15:00-04:00'
const FRI = '2026-10-16T13:25:00-04:00'
const run: Workout = {
  id: 'w-run',
  name: 'Evening run',
  startedAt: '2026-10-22T01:00:00-04:00',
  minutes: 35,
  kcal: 300,
  source: 'burn_guess',
}

function withWorkouts(...workouts: Workout[]): LogDoc {
  return { ...demoDoc, workouts: [...demoDoc.workouts, ...workouts] }
}

describe('headlineView: calories eaten with no workout', () => {
  const hv = headlineView(buildDayViewFor(demoDoc, WED))

  it('is the Tier 1 headline: G11, its lognormal ranges and the plain score', () => {
    expect(hv).toMatchObject({
      net: false,
      label: 'Calories today',
      value: 2280,
      valueText: '2,280',
      likelyText: '1,870–2,780 kcal',
      veryLikelyText: '1,684–3,087 kcal',
      explain: { mode: 'ranges' },
      bar: true,
      barTarget: true,
      score: 83,
      scoreText: 'Estimate score 83',
      status: null,
      ringValue: 2280,
    })
  })

  it('build-out item 2.9: the number opens the meals behind it, named so', () => {
    expect(hv.numberOpen).toEqual({ mode: 'eaten' })
    expect(hv.numberLabel).toBe('Calories today 2,280 kcal. Opens the meals behind it.')
  })

  it('build-out item 2.9: an unknown count opens the meals it counts', () => {
    const fri = headlineView(buildDayViewFor(demoDoc, FRI), false)
    expect(fri.status?.counts).toEqual([
      { kind: 'meals', text: '1 meal with unknown calories', open: { mode: 'eaten' }, label: '1 meal with unknown calories. Opens the meals.' },
    ])
  })

  it('on an earlier day says "that day"', () => {
    expect(headlineView(buildDayViewFor(demoDoc, WED), false).label).toBe('Calories that day')
  })
})

describe('headlineView: net calories once the day has a workout', () => {
  const view = buildDayViewFor(withWorkouts(run), WED)
  const hv = headlineView(view)

  it('net = eaten − burned with normal ranges; the score stays the eaten one, labelled so', () => {
    expect(view.workouts.map((w) => w.id)).toEqual(['w-run'])
    expect(hv).toMatchObject({
      net: true,
      label: 'Net calories today',
      value: 1980,
      valueText: '1,980',
      likelyText: '1,455–2,505 kcal',
      veryLikelyText: '1,177–2,783 kcal',
      explain: { mode: 'net' },
      bar: true,
      barTarget: false,
      score: 83,
      scoreText: 'Eaten: estimate score 83',
      status: null,
    })
    expect(view.day.score).toBe(buildDayViewFor(demoDoc, WED).day.score)
  })

  it('eaten and burned as single numbers, each saying what it opens', () => {
    expect(hv.eaten).toEqual({ value: 2280, text: '2,280 kcal', label: 'Eaten 2,280 kcal. Opens the meals.' })
    expect(hv.burned).toEqual({ value: 300, text: '300 kcal', label: 'Burned 300 kcal. Opens the workouts.' })
  })

  it('build-out item 2.9: the net number opens how net is worked out', () => {
    expect(hv.numberOpen).toEqual({ mode: 'net' })
    expect(hv.numberLabel).toBe('Net calories today 1,980 kcal. Opens how net is worked out.')
  })

  it('the Panel ring keeps comparing calories eaten with the target', () => {
    expect(hv.ringValue).toBe(2280)
  })

  it('the demo’s Monday walk makes Monday net: 1,460 − 210 = 1,250', () => {
    const mon = headlineView(buildDayViewFor(demoDoc, MON), false)
    expect(mon).toMatchObject({ net: true, label: 'Net calories that day', value: 1250 })
    expect(mon.burned.text).toBe('210 kcal')
  })

  it('a workout with unknown calories: net waits, burned says unknown, and it is counted in words', () => {
    const swim: Workout = { ...run, id: 'w-swim', name: 'Swim', kcal: null, source: null }
    const only = headlineView(buildDayViewFor(withWorkouts(swim), WED))
    expect(only).toMatchObject({ net: true, value: null, likelyText: null, bar: false })
    expect(only.burned.text).toBe('unknown')
    expect(only.status).toEqual({ pill: null, counts: [{ kind: 'workouts', text: '1 workout with unknown calories burned', open: { mode: 'workouts' }, label: '1 workout with unknown calories burned. Opens the workouts.' }] })
    const both = headlineView(buildDayViewFor(withWorkouts(swim, run), WED))
    expect(both).toMatchObject({ value: 1980, knownOnly: true, label: 'Net calories, known entries only', bar: false })
    expect(both.status).toEqual({ pill: 'Known entries only — incomplete day', counts: [{ kind: 'workouts', text: '1 workout with unknown calories burned', open: { mode: 'workouts' }, label: '1 workout with unknown calories burned. Opens the workouts.' }] })
  })

  it('net below 0 keeps its minus sign and reads "to" between the ends', () => {
    const big: Workout = { ...run, id: 'w-big', kcal: 3000, source: 'burn_machine' }
    const hvBig = headlineView(buildDayViewFor(withWorkouts(big), WED))
    expect(hvBig.value).toBe(-720)
    expect(hvBig.valueText).toBe('−720')
    // By hand: sd √(381.2² + 900²) = 977.4, so likely −720 ± 1,252.6.
    expect(hvBig.likelyText).toBe('−1,973 to 533 kcal')
    // Night's one-line ranges (no unit) follow the same rule, so no look puts a dash after a minus.
    expect(hvBig.likelyShort).toBe('−1,973 to 533')
    expect(hvBig.veryLikelyShort).toBe('−2,636 to 1,196')
  })

  it('Night’s short ranges keep the dash while both ends are 0 or more', () => {
    expect(hv.likelyShort).toBe('1,455–2,505')
    expect(hv.veryLikelyShort).toBe('1,177–2,783')
    const eaten = headlineView(buildDayViewFor(demoDoc, WED))
    expect(eaten.likelyShort).toBe('1,870–2,780')
    expect(eaten.veryLikelyShort).toBe('1,684–3,087')
  })
})

describe('formatting numbers that can be below 0', () => {
  it('uses a real minus sign and never shows −0', () => {
    expect(fmtSigned(-140)).toBe('−140')
    expect(fmtSigned(1500)).toBe('1,500')
    expect(fmtSigned(-0.4)).toBe('0')
    expect(fmtSignedRange({ lo: 428, hi: 2572 })).toBe('428–2,572 kcal')
    expect(fmtSignedRange({ lo: -139.8, hi: 3139.8 })).toBe('−140 to 3,140 kcal')
    expect(fmtSignedRangeShort({ lo: 428, hi: 2572 })).toBe('428–2,572')
    expect(fmtSignedRangeShort({ lo: -139.8, hi: 3139.8 })).toBe('−140 to 3,140')
    expect(fmtSignedRangeShort({ lo: -5115, hi: -925 })).toBe('−5,115 to −925')
    // An end that rounds to 0 is not below 0, so it keeps the dash.
    expect(fmtSignedRangeShort({ lo: -0.4, hi: 300 })).toBe('0–300')
  })
})

describe('the net range bar (Journal)', () => {
  it('may start below 0 for net, and never does for calories eaten', () => {
    const net = rangeBarGeometry(1500, { lo: 428, hi: 2572 }, { lo: -140, hi: 3140 }, undefined, { signed: true })!
    expect(net.min).toBeLessThan(-140)
    expect(net.veryLikely.left).toBeGreaterThan(0)
    const eaten = rangeBarGeometry(1500, { lo: 428, hi: 2572 }, { lo: -140, hi: 3140 })!
    expect(eaten.min).toBe(0)
  })

  it('marks where 0 falls once the net scale runs below 0, and only then', () => {
    const net = rangeBarGeometry(1500, { lo: 428, hi: 2572 }, { lo: -140, hi: 3140 }, undefined, { signed: true })!
    // 0 sits between the very likely band's low end (−140) and the likely band's (428).
    expect(net.zero).not.toBeNull()
    expect(net.zero!).toBeGreaterThan(net.veryLikely.left)
    expect(net.zero!).toBeLessThan(net.likely.left)
    expect(rangeBarGeometry(1980, { lo: 1455, hi: 2505 }, { lo: 1177, hi: 2783 }, undefined, { signed: true })!.zero).toBeNull()
    expect(rangeBarGeometry(1500, { lo: 428, hi: 2572 }, { lo: -140, hi: 3140 })!.zero).toBeNull()
  })
})

describe('the workout form (editWorkout.ts)', () => {
  const blank = blankWorkout('w-new', '2026-10-21T18:00:00-04:00')

  it('starts blank, with no source and nothing invented', () => {
    expect(blank).toEqual({ id: 'w-new', name: '', startedAt: '2026-10-21T18:00:00-04:00', minutes: null, kcal: null, source: null })
    // Build-out item 2.6: no gym sets until Add gym sets.
    expect(draftFromWorkout(blank)).toEqual({ name: '', source: null, kcal: '', startedAtLocal: '2026-10-21T18:00', minutes: '', gym: null })
  })

  it('blank calories and duration are unknown, never 0; a typed 0 calories is known', () => {
    const ok = checkWorkoutDraft({ ...draftFromWorkout(blank), name: ' Swim ' }, blank)
    expect(ok.workout).toEqual({ ...blank, name: 'Swim' })
    const zero = checkWorkoutDraft({ ...draftFromWorkout(blank), name: 'Stretch', kcal: '0', source: 'burn_guess' }, blank)
    expect(zero.workout?.kcal).toBe(0)
  })

  it('calories need a source; letters, a minus sign and a 0 duration are refused; a name is needed', () => {
    const d = draftFromWorkout(blank)
    expect(checkWorkoutDraft({ ...d, name: 'Run', kcal: '300' }, blank).errors.source).toBe('Pick how you know, so HowSure can say how sure.')
    expect(checkWorkoutDraft({ ...d, name: 'Run', kcal: 'abc' }, blank).errors.kcal).toBe('Use digits, e.g. 1501 or 13.9')
    expect(checkWorkoutDraft({ ...d, name: 'Run', minutes: '-5' }, blank).errors.minutes).toBe('Use digits, e.g. 1501 or 13.9')
    expect(checkWorkoutDraft({ ...d, name: 'Run', minutes: '0' }, blank).errors.minutes).toMatch(/A duration of 0 isn’t used/)
    expect(checkWorkoutDraft(d, blank).errors.name).toBe('Give the workout a name.')
    expect(checkWorkoutDraft({ ...d, name: 'Run', startedAtLocal: '' }, blank).errors.startedAt).toBe('Pick a date and time.')
  })

  it('an untouched workout stays identical, its stored time included', () => {
    expect(checkWorkoutDraft(draftFromWorkout(run), run).workout).toEqual(run)
  })

  it('withWorkout adds a new one and replaces a known one; withoutWorkout removes it', () => {
    const added = withWorkout(demoDoc, run)
    expect(added.workouts.map((w) => w.id)).toEqual([...demoDoc.workouts.map((w) => w.id), 'w-run'])
    const edited = withWorkout(added, { ...run, kcal: 200 })
    expect(edited.workouts.find((w) => w.id === 'w-run')?.kcal).toBe(200)
    expect(edited.workouts).toHaveLength(added.workouts.length)
    expect(withoutWorkout(edited, 'w-run').workouts).toEqual(demoDoc.workouts)
  })
})

describe('the Night timeline lists workouts among the meals, by time', () => {
  it('a run after midnight sits after the snack, before now', () => {
    const doc = withWorkouts(run)
    const pts = timelinePoints(buildDayViewFor(doc, WED), buildSleepView(doc.sleeps, WED), demoStartIso)
    const kinds = pts.map((p) => (p.kind === 'meal' ? p.meal.name : p.kind === 'workout' ? `workout ${p.workout.name}` : p.kind))
    expect(kinds.slice(-3)).toEqual(['Apple and peanut butter', 'workout Evening run', 'now'])
    const w = pts.find((p) => p.kind === 'workout')
    expect(w && w.kind === 'workout' && w.laterDate).toBe(true)
  })
})
