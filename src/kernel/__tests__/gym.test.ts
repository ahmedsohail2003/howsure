// Build-out item 2.6 (slice 26; prd.md > Gym Log): the gym log's set model (kernel/gym.ts).
// The person is the fictional Sam; the sessions, exercises and weights are invented.
import { describe, expect, it } from 'vitest'
import {
  bestWorkingSetBefore,
  exerciseHistoryBefore,
  exerciseKey,
  gymSessions,
  isGymSession,
  liftWeightIn,
  lastSession,
  sessionMatches,
  setCounts,
  toKg,
  topWorkingSet,
} from '../gym'
import { LB_TO_KG } from '../weight'
import type { GymSet, Workout } from '../types'

function session(id: string, name: string, startedAt: string, exercises: { name: string; sets: GymSet[] }[]): Workout {
  return { id, name, startedAt, minutes: null, kcal: null, source: null, gym: { unit: 'kg', exercises } }
}

const warm = (kg: number | null, reps: number): GymSet => ({ kind: 'warmup', weightKg: kg, reps })
const work = (kg: number | null, reps: number): GymSet => ({ kind: 'working', weightKg: kg, reps })
const drop = (kg: number | null, reps: number, drops: [number | null, number][]): GymSet => ({
  kind: 'drop',
  weightKg: kg,
  reps,
  drops: drops.map(([weightKg, r]) => ({ weightKg, reps: r })),
})

// Three Push sessions and a Pull, over two weeks, plus a walk with no gym sets.
const MON = session('w-mon', 'Push', '2026-10-26T18:00:00-04:00', [
  { name: 'Bench press', sets: [warm(40, 10), work(75, 8), work(75, 8), drop(60, 10, [[45, 8], [30, 6]])] },
  { name: 'Dips', sets: [work(null, 12), work(null, 10)] },
])
const WED = session('w-wed', 'Pull', '2026-10-28T18:00:00-04:00', [{ name: 'Row', sets: [work(60, 10)] }])
const FRI = session('w-fri', 'Push', '2026-10-30T18:00:00-04:00', [
  { name: '  bench   PRESS ', sets: [warm(40, 10), work(80, 6), work(77.5, 8), drop(100, 3, [[50, 20]])] },
  { name: 'Dips', sets: [work(10, 8), work(null, 15)] },
])
const NEXT_MON = session('w-next', 'Push', '2026-11-02T18:00:00-04:00', [{ name: 'Bench press', sets: [work(80, 6)] }])
const WALK: Workout = { id: 'w-walk', name: 'Brisk walk', startedAt: '2026-10-29T12:00:00-04:00', minutes: 45, kcal: 210, source: 'burn_device' }
const ALL = [WALK, NEXT_MON, MON, FRI, WED]

describe('units', () => {
  it('keeps weights in kg, with 1 lb = 0.45359237 kg exactly', () => {
    expect(LB_TO_KG).toBe(0.45359237)
    expect(toKg(100, 'kg')).toBe(100)
    expect(toKg(100, 'lb')).toBeCloseTo(45.359237, 9)
  })

  it('reads a typed weight back as typed (rounded to 2 decimals)', () => {
    for (const lb of [225, 135, 2.5, 47.5, 1.25, 315]) expect(liftWeightIn(toKg(lb, 'lb'), 'lb')).toBe(lb)
    for (const kg of [80, 82.5, 1.25, 102.06]) expect(liftWeightIn(toKg(kg, 'kg'), 'kg')).toBe(kg)
    // In the other unit: 80 kg = 176.37 lb.
    expect(liftWeightIn(80, 'lb')).toBe(176.37)
  })
})

describe('the set model', () => {
  it('counts sets by kind; a drop set counts once, however many drops it has', () => {
    expect(setCounts(MON.gym!.exercises[0].sets)).toEqual({ warmup: 1, working: 2, drop: 1, total: 4 })
    expect(setCounts([])).toEqual({ warmup: 0, working: 0, drop: 0, total: 0 })
  })

  it('a workout is a gym session only with at least one exercise', () => {
    expect(isGymSession(MON)).toBe(true)
    expect(isGymSession(WALK)).toBe(false)
    expect(isGymSession({ ...WALK, gym: { unit: 'kg', exercises: [] } })).toBe(false)
  })

  it('the top working set is the heaviest, then the most reps; warm-ups and drop sets never count', () => {
    // The 100 kg drop set and the 40 kg warm-up are left out; 80 kg × 6 beats 77.5 kg × 8.
    expect(topWorkingSet(FRI.gym!.exercises[0].sets)).toEqual(work(80, 6))
    expect(topWorkingSet([work(75, 8), work(75, 10), work(75, 9)])).toEqual(work(75, 10))
    // A weighted set beats any set with no weight; with no weight at all, the most reps.
    expect(topWorkingSet(FRI.gym!.exercises[1].sets)).toEqual(work(10, 8))
    expect(topWorkingSet([work(null, 12), work(null, 10)])).toEqual(work(null, 12))
    expect(topWorkingSet([warm(40, 10), drop(60, 10, [])])).toBeNull()
  })

  it('matches an exercise by name, ignoring case and extra spaces', () => {
    expect(exerciseKey('  Bench   PRESS ')).toBe('bench press')
    expect(exerciseKey('Bench press')).toBe(exerciseKey('bench press'))
  })
})

describe('sessions across many dates', () => {
  it('lists gym sessions only, newest first', () => {
    expect(gymSessions(ALL).map((w) => w.id)).toEqual(['w-next', 'w-fri', 'w-wed', 'w-mon'])
  })

  it('works the order out once per log, and again for a new log with a session added', () => {
    expect(gymSessions(ALL)).toBe(gymSessions(ALL))
    const added = [...ALL, session('w-later', 'Legs', '2026-11-04T18:00:00-05:00', [{ name: 'Squat', sets: [work(100, 5)] }])]
    expect(gymSessions(added).map((w) => w.id)).toEqual(['w-later', 'w-next', 'w-fri', 'w-wed', 'w-mon'])
    expect(gymSessions(ALL).map((w) => w.id)).toEqual(['w-next', 'w-fri', 'w-wed', 'w-mon'])
  })

  it('finds a session by its split or by any exercise name, in part and in any case', () => {
    const ids = (q: string) => gymSessions(ALL).filter((w) => sessionMatches(w, q)).map((w) => w.id)
    expect(ids('bench')).toEqual(['w-next', 'w-fri', 'w-mon'])
    expect(ids('PULL')).toEqual(['w-wed'])
    expect(ids('row')).toEqual(['w-wed'])
    expect(ids('dip')).toEqual(['w-fri', 'w-mon'])
    expect(ids('squat')).toEqual([])
    expect(ids('  ')).toEqual(['w-next', 'w-fri', 'w-wed', 'w-mon'])
  })
})

describe('best working set from earlier sessions', () => {
  it('looks only at sessions that started before, leaving out the session itself', () => {
    // Before Friday: Monday's 75 kg × 8 (two of them; Monday's is the one).
    expect(bestWorkingSetBefore(ALL, 'Bench press', FRI.startedAt, FRI.id)).toEqual({
      set: work(75, 8),
      workoutId: 'w-mon',
      startedAt: MON.startedAt,
    })
    // Before the next Monday: Friday's 80 kg × 6 beats Monday's 75 kg × 8, and Friday's 100 kg drop set never counts.
    expect(bestWorkingSetBefore(ALL, 'bench press', NEXT_MON.startedAt, NEXT_MON.id)?.set).toEqual(work(80, 6))
    // Nothing before the first session.
    expect(bestWorkingSetBefore(ALL, 'Bench press', MON.startedAt, MON.id)).toBeNull()
  })

  it('on a tie keeps the most recent session', () => {
    const a = session('a', 'Push', '2026-10-01T10:00:00-04:00', [{ name: 'Curl', sets: [work(20, 10)] }])
    const b = session('b', 'Push', '2026-10-05T10:00:00-04:00', [{ name: 'Curl', sets: [work(20, 10)] }])
    expect(bestWorkingSetBefore([a, b], 'Curl', '2026-10-09T10:00:00-04:00')?.workoutId).toBe('b')
  })

  it('a bodyweight exercise gets its most reps; a later weighted set beats it', () => {
    expect(bestWorkingSetBefore(ALL, 'Dips', FRI.startedAt, FRI.id)?.set).toEqual(work(null, 12))
    expect(bestWorkingSetBefore(ALL, 'Dips', NEXT_MON.startedAt)?.set).toEqual(work(10, 8))
  })

  it('a name with no earlier working set, or a blank name, has none', () => {
    expect(bestWorkingSetBefore(ALL, 'Squat', NEXT_MON.startedAt)).toBeNull()
    expect(bestWorkingSetBefore(ALL, '   ', NEXT_MON.startedAt)).toBeNull()
  })

  it('tells an exercise never logged before from one logged with only warm-ups or drop sets', () => {
    const raises = session('r1', 'Push', '2026-10-20T18:00:00-04:00', [{ name: 'Lateral raise', sets: [warm(4, 15), drop(10, 12, [[6, 10]])] }])
    const all = [...ALL, raises]
    expect(exerciseHistoryBefore(all, 'lateral RAISE', NEXT_MON.startedAt)).toEqual({ best: null, seen: true })
    expect(exerciseHistoryBefore(all, 'Squat', NEXT_MON.startedAt)).toEqual({ best: null, seen: false })
    // Its own session, and later ones, never count as earlier.
    expect(exerciseHistoryBefore(all, 'Lateral raise', raises.startedAt, raises.id)).toEqual({ best: null, seen: false })
    expect(exerciseHistoryBefore(all, 'Bench press', NEXT_MON.startedAt).seen).toBe(true)
  })
})

describe('Copy last session', () => {
  it('starts from the latest session before the new one', () => {
    expect(lastSession(ALL, '', '2026-11-03T10:00:00-05:00')?.id).toBe('w-next')
    expect(lastSession(ALL, '', '2026-10-29T10:00:00-04:00')?.id).toBe('w-wed')
  })

  it('with a name typed, the latest session of that split instead', () => {
    expect(lastSession(ALL, 'push', '2026-10-29T10:00:00-04:00')?.id).toBe('w-mon')
    expect(lastSession(ALL, 'Pull', '2026-11-03T10:00:00-05:00')?.id).toBe('w-wed')
    // A name with no earlier session of its own: the latest of any split.
    expect(lastSession(ALL, 'Legs', '2026-11-03T10:00:00-05:00')?.id).toBe('w-next')
  })

  it('leaves out the session being edited, and has none before the first', () => {
    expect(lastSession(ALL, '', NEXT_MON.startedAt, NEXT_MON.id)?.id).toBe('w-fri')
    expect(lastSession(ALL, '', '2026-10-26T17:59:00-04:00')).toBeNull()
    // One started at the same minute counts: it was logged a moment ago.
    expect(lastSession(ALL, '', MON.startedAt)?.id).toBe('w-mon')
    expect(lastSession([WALK], '', '2026-11-03T10:00:00-05:00')).toBeNull()
  })
})
