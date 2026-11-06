// Build-out item 2.6 (slice 26; prd.md > Gym Log): the gym sets' form (gymDraft.ts), the words the
// gym log shows (gymView.ts), and a gym session saved through the Log a workout form
// (editWorkout.ts). The person is the fictional Sam; every session and weight is invented.
import { describe, expect, it } from 'vitest'
import { toKg } from '../../kernel/gym'
import type { GymSession, Workout } from '../../kernel/types'
import { emptyLog } from '../../store/log'
import { weightUnitOf } from '../weightView'
import { withWeightUnit } from '../weighInEdit'
import { copy } from '../copy'
import { checkWorkoutDraft, draftFromWorkout } from '../editWorkout'
import {
  blankGymDraft,
  checkGymDraft,
  draftCopiedFrom,
  draftFromGym,
  isBlankDraft,
  withSetAdded,
  withUnit,
  type GymDraft,
  type SetDraft,
} from '../gymDraft'
import { countsText, fmtLiftWeight, gymHistory, gymSummary, gymUnitOf, sessionView, setText } from '../gymView'

const NOW = '2026-11-05T20:00:00-05:00'

/** Shown text with its no-break spaces read as spaces (copy.gym keeps "80 kg × 8" on one line). */
const plain = (s: string) => s.replace(/\u00a0/g, ' ')

function setDraft(kind: SetDraft['kind'], weight: string, reps: string, drops: [string, string][] = []): SetDraft {
  return {
    key: `s-${kind}-${weight}-${reps}-${Math.random()}`,
    kind,
    weight,
    reps,
    drops: drops.map(([w, r], i) => ({ key: `d-${i}-${Math.random()}`, weight: w, reps: r })),
  }
}

/** The fictional push day: a warm-up, two working sets and a drop set with two drops. */
function pushDay(unit: 'kg' | 'lb' = 'kg'): GymDraft {
  return {
    unit,
    exercises: [
      {
        key: 'ex-1',
        name: '  Bench   press ',
        sets: [
          setDraft('warmup', '40', '10'),
          setDraft('working', '80', '8'),
          setDraft('working', '80', '7'),
          setDraft('drop', '60', '10', [
            ['45', '8'],
            ['30', '6'],
          ]),
        ],
      },
    ],
  }
}

describe('the gym sets form', () => {
  it('saves a warm-up, two working sets and a drop set with its drops, in kg', () => {
    const res = checkGymDraft(pushDay())
    expect(res.errors).toEqual({})
    expect(res.gym).toEqual({
      unit: 'kg',
      exercises: [
        {
          name: 'Bench press',
          sets: [
            { kind: 'warmup', weightKg: 40, reps: 10 },
            { kind: 'working', weightKg: 80, reps: 8 },
            { kind: 'working', weightKg: 80, reps: 7 },
            {
              kind: 'drop',
              weightKg: 60,
              reps: 10,
              drops: [
                { weightKg: 45, reps: 8 },
                { weightKg: 30, reps: 6 },
              ],
            },
          ],
        },
      ],
    })
    expect(res.notes).toEqual({})
  })

  it('stores pounds as kg, and reads them back as typed', () => {
    const res = checkGymDraft(pushDay('lb'))
    expect(res.gym?.unit).toBe('lb')
    expect(res.gym?.exercises[0].sets[1].weightKg).toBeCloseTo(36.28738960, 8)
    const again = draftFromGym(res.gym!)
    expect(again.unit).toBe('lb')
    expect(again.exercises[0].sets.map((s) => s.weight)).toEqual(['40', '80', '80', '60'])
    expect(again.exercises[0].sets[3].drops.map((d) => d.weight)).toEqual(['45', '30'])
  })

  it('an untouched session saves back identical, even with weights that are not round in kg', () => {
    const stored: GymSession = {
      unit: 'lb',
      exercises: [{ name: 'Squat', sets: [{ kind: 'working', weightKg: toKg(225, 'lb'), reps: 5 }, { kind: 'drop', weightKg: 100.123456, reps: 8, drops: [{ weightKg: 80.987654, reps: 6 }] }] }],
    }
    expect(checkGymDraft(draftFromGym(stored)).gym).toStrictEqual(stored)
  })

  it('keys a later format adds to a session, exercise, set or drop are saved back after an edit', () => {
    const stored = {
      unit: 'kg',
      tempo: 'slow',
      exercises: [
        {
          name: 'Squat',
          machine: 'rack 2',
          sets: [{ kind: 'drop', weightKg: 100, reps: 8, rpe: 9, drops: [{ weightKg: 80, reps: 6, rest: 0 }] }],
        },
      ],
    } as unknown as GymSession
    const d = draftFromGym(stored)
    d.exercises[0].sets[0].reps = '9'
    expect(checkGymDraft(d).gym).toStrictEqual({
      unit: 'kg',
      tempo: 'slow',
      exercises: [{ name: 'Squat', machine: 'rack 2', sets: [{ kind: 'drop', weightKg: 100, reps: 9, rpe: 9, drops: [{ weightKg: 80, reps: 6, rest: 0 }] }] }],
    })
    // Switching the unit there and back keeps them too, the session's own included.
    const switched = withUnit(withUnit(draftFromGym(stored), 'lb'), 'kg')
    expect(checkGymDraft(switched).gym).toStrictEqual(stored)
    expect(checkGymDraft(withUnit(draftFromGym(stored), 'lb')).gym).toMatchObject({ unit: 'lb', tempo: 'slow' })
    // Copy last session starts a new session: nothing from the old one's extra keys comes along.
    expect(checkGymDraft(draftCopiedFrom(stored, 'kg')).gym).toStrictEqual({
      unit: 'kg',
      exercises: [{ name: 'Squat', sets: [{ kind: 'drop', weightKg: 100, reps: 8, drops: [{ weightKg: 80, reps: 6 }] }] }],
    })
  })

  it('a blank weight is a set with no weight (null), never 0; a typed 0 is refused', () => {
    const d = pushDay()
    d.exercises[0].sets = [setDraft('working', '', '12'), setDraft('working', '0', '12')]
    const res = checkGymDraft(d)
    expect(res.gym).toBeNull()
    expect(Object.values(res.errors)).toEqual([copy.gym.weightZero])
    d.exercises[0].sets = [setDraft('working', '', '12')]
    expect(checkGymDraft(d).gym?.exercises[0].sets[0]).toEqual({ kind: 'working', weightKg: null, reps: 12 })
  })

  it('needs reps on every set and drop, as a whole number from 1; refuses words and a slip of 1,000 kg or more', () => {
    const cases: [string, string, string][] = [
      ['80', '', copy.gym.repsNeeded],
      ['80', '0', copy.gym.repsWhole],
      ['80', '7.5', copy.gym.repsWhole],
      ['80', '1001', copy.gym.repsWhole],
      ['eighty', '8', 'Use digits, e.g. 1501 or 13.9'],
      // Said in the unit typed: "1,000 kg" in a kg form, "2,204.62 lb" in an lb one.
      ['1001', '8', 'That is more than 1,000\u00a0kg. Check the number.'],
      ['2205', '8', 'That is more than 2,204.62\u00a0lb. Check the number.'],
      // So small it would show as 0: a slip, never a 0 on screen.
      ['0.001', '8', copy.gym.weightTooSmall],
      ['0.004', '8', copy.gym.weightTooSmall],
    ]
    for (const [w, r, msg] of cases) {
      const d = pushDay(w === '2205' ? 'lb' : 'kg')
      d.exercises[0].sets = [setDraft('working', w, r)]
      expect(Object.values(checkGymDraft(d).errors), `${w} × ${r}`).toEqual([msg])
    }
    // "1,000" with a thousands comma is 1,000 kg: still taken.
    const d = pushDay()
    d.exercises[0].sets = [setDraft('working', '1,000', '1')]
    expect(checkGymDraft(d).gym?.exercises[0].sets[0].weightKg).toBe(1000)
    // A drop needs its reps too.
    d.exercises[0].sets = [setDraft('drop', '60', '10', [['45', '']])]
    expect(Object.values(checkGymDraft(d).errors)).toEqual([copy.gym.repsNeeded])
  })

  it('a stored exercise name is kept exactly while left as it is; a typed one is tidied', () => {
    const stored: GymSession = { unit: 'kg', exercises: [{ name: 'Bench  press ', sets: [{ kind: 'working', weightKg: 80, reps: 8 }] }] }
    const d = draftFromGym(stored)
    d.exercises[0].sets[0].reps = '9'
    expect(checkGymDraft(d).gym?.exercises[0].name).toBe('Bench  press ')
    d.exercises[0].name = 'Bench  press  '
    expect(checkGymDraft(d).gym?.exercises[0].name).toBe('Bench press')
    // A stored blank name still blocks Save, saying so.
    const blank = draftFromGym({ ...stored, exercises: [{ ...stored.exercises[0], name: '  ' }] })
    expect(Object.values(checkGymDraft(blank).errors)).toEqual([copy.gym.nameNeeded])
  })

  it('needs an exercise name, at least one set, and at least one exercise', () => {
    const d = pushDay()
    d.exercises[0].name = '   '
    expect(checkGymDraft(d).errors).toEqual({ 'ex-1.name': copy.gym.nameNeeded })
    d.exercises[0] = { ...d.exercises[0], name: 'Row', sets: [] }
    expect(checkGymDraft(d).errors).toEqual({ 'ex-1.sets': copy.gym.setNeeded })
    expect(checkGymDraft({ unit: 'kg', exercises: [] }).errors).toEqual({ session: copy.gym.exerciseNeeded })
  })

  it('says, without refusing, when a drop is not lighter than the weight before it', () => {
    const d = pushDay()
    d.exercises[0].sets = [setDraft('drop', '60', '10', [['45', '8'], ['50', '6']])]
    const res = checkGymDraft(d)
    expect(res.gym).not.toBeNull()
    expect(Object.values(res.notes)).toEqual([copy.gym.dropNotLighter])
  })

  it('keeps drops while the kind is changed and back, and saves them only on a drop set', () => {
    const d = pushDay()
    d.exercises[0].sets = [{ ...setDraft('drop', '60', '10', [['45', '8']]), kind: 'working' }]
    expect(checkGymDraft(d).gym?.exercises[0].sets[0]).toEqual({ kind: 'working', weightKg: 60, reps: 10 })
    d.exercises[0].sets[0].kind = 'drop'
    expect(checkGymDraft(d).gym?.exercises[0].sets[0].drops).toEqual([{ weightKg: 45, reps: 8 }])
  })

  it('switching the unit converts every typed weight, and back again leaves the stored kg exactly as it was', () => {
    const kg = pushDay()
    kg.exercises[0].sets.push(setDraft('working', '', '12'), setDraft('working', 'heavy', '5'))
    const lb = withUnit(kg, 'lb')
    expect(lb.unit).toBe('lb')
    // 80 kg reads 176.37 lb; blank stays blank (no weight), and a box that is not a number stays as typed.
    expect(lb.exercises[0].sets.map((s) => s.weight)).toEqual(['88.18', '176.37', '176.37', '132.28', '', 'heavy'])
    expect(lb.exercises[0].sets[3].drops.map((d) => d.weight)).toEqual(['99.21', '66.14'])
    // Never a number reinterpreted: what is saved in lb is still 80 kg, not 80 lb.
    lb.exercises[0].sets.splice(4)
    expect(checkGymDraft(lb).gym?.exercises[0].sets[1].weightKg).toBe(80)
    expect(checkGymDraft(lb).gym).toEqual({ ...checkGymDraft(pushDay()).gym, unit: 'lb' })
    const back = withUnit(lb, 'kg')
    expect(back.exercises[0].sets.map((s) => s.weight)).toEqual(['40', '80', '80', '60'])
    // A stored weight that is not round in either unit survives the round trip exactly.
    const stored: GymSession = { unit: 'kg', exercises: [{ name: 'Squat', sets: [{ kind: 'working', weightKg: 100.123456, reps: 5 }] }] }
    const twice = withUnit(withUnit(draftFromGym(stored), 'lb'), 'kg')
    expect(checkGymDraft(twice).gym).toStrictEqual(stored)
    // The same unit: the same form.
    expect(withUnit(kg, 'kg')).toBe(kg)
    // A weight changed after the switch is read in the new unit.
    lb.exercises[0].sets[1].weight = '180'
    expect(checkGymDraft(lb).gym?.exercises[0].sets[1].weightKg).toBeCloseTo(toKg(180, 'lb'), 9)
  })

  it('Add set copies the set above (kind, weight and reps, not its drops); with none, a blank working set', () => {
    const ex = pushDay().exercises[0]
    const added = withSetAdded(ex).sets[4]
    expect(added).toMatchObject({ kind: 'drop', weight: '60', reps: '10', drops: [] })
    expect(withSetAdded({ ...ex, sets: [] }).sets[0]).toMatchObject({ kind: 'working', weight: '', reps: '', drops: [] })
  })

  it('a new session starts with one exercise and one set, in the unit preferred, and counts as blank until typed in', () => {
    const d = blankGymDraft('lb')
    expect(d.unit).toBe('lb')
    expect(d.exercises).toHaveLength(1)
    expect(d.exercises[0].sets).toHaveLength(1)
    expect(isBlankDraft(d)).toBe(true)
    d.exercises[0].sets[0].reps = '8'
    expect(isBlankDraft(d)).toBe(false)
  })

  it('Copy last session converts the copied weights into the unit chosen', () => {
    const last = checkGymDraft(pushDay('kg')).gym!
    const copied = draftCopiedFrom(last, 'lb')
    expect(copied.unit).toBe('lb')
    expect(copied.exercises[0].name).toBe('Bench press')
    expect(copied.exercises[0].sets.map((s) => [s.kind, s.weight, s.reps])).toEqual([
      ['warmup', '88.18', '10'],
      ['working', '176.37', '8'],
      ['working', '176.37', '7'],
      ['drop', '132.28', '10'],
    ])
    expect(copied.exercises[0].sets[3].drops.map((x) => x.weight)).toEqual(['99.21', '66.14'])
  })
})

describe('a gym session saved as a workout (editWorkout.ts)', () => {
  const walk: Workout = { id: 'w-1', name: 'Brisk walk', startedAt: '2026-11-05T18:00:00-05:00', minutes: 45, kcal: 210, source: 'burn_device' }

  it('Add gym sets on a workout saves them with it; the rest of the workout is unchanged', () => {
    const draft = { ...draftFromWorkout(walk), name: 'Push', gym: pushDay() }
    const res = checkWorkoutDraft(draft, walk)
    expect(res.workout).toEqual({ ...walk, name: 'Push', gym: checkGymDraft(pushDay()).gym })
  })

  it('blocks Save while a set needs a fix, with one line saying so', () => {
    const gym = pushDay()
    gym.exercises[0].sets[1].reps = ''
    const res = checkWorkoutDraft({ ...draftFromWorkout(walk), gym }, walk)
    expect(res.workout).toBeNull()
    expect(res.errors).toEqual({ gym: copy.gym.fixToSave })
  })

  it('Remove gym sets saves the workout without them', () => {
    const withGym: Workout = { ...walk, gym: checkGymDraft(pushDay()).gym! }
    const draft = draftFromWorkout(withGym)
    expect(checkWorkoutDraft(draft, withGym).workout).toStrictEqual(withGym)
    expect(checkWorkoutDraft({ ...draft, gym: null }, withGym).workout).toStrictEqual(walk)
  })
})

describe('what the gym log shows (gymView.ts)', () => {
  const mon: Workout = {
    id: 'w-mon',
    name: 'Push',
    startedAt: '2026-10-26T18:00:00-04:00',
    minutes: null,
    kcal: null,
    source: null,
    gym: checkGymDraft(pushDay()).gym!,
  }
  const thu: Workout = {
    id: 'w-thu',
    name: 'Push',
    startedAt: '2026-11-05T18:30:00-05:00',
    minutes: null,
    kcal: null,
    source: null,
    gym: {
      unit: 'kg',
      exercises: [
        { name: 'bench press', sets: [{ kind: 'working', weightKg: 82.5, reps: 6 }] },
        { name: 'Dips', sets: [{ kind: 'working', weightKg: null, reps: 12 }] },
      ],
    },
  }

  it('writes each set with its weight and reps, a drop set with each drop', () => {
    const sets = mon.gym!.exercises[0].sets
    // A value never breaks inside: no-break spaces in "40 kg × 10"; a line may break after a comma.
    expect(setText(sets[0], 'kg')).toBe('40\u00a0kg\u00a0×\u00a010')
    expect(plain(setText(sets[3], 'kg'))).toBe('60 kg × 10, then 45 kg × 8, then 30 kg × 6')
    expect(setText(sets[3], 'kg').split(' ')).toEqual(['60\u00a0kg\u00a0×\u00a010,', 'then', '45\u00a0kg\u00a0×\u00a08,', 'then', '30\u00a0kg\u00a0×\u00a06'])
    // A blank weight is not claimed to be no weight at all: it may just not have been written down.
    expect(plain(setText({ kind: 'working', weightKg: null, reps: 12 }, 'kg'))).toBe('12 reps, no weight logged')
    expect(setText({ kind: 'working', weightKg: null, reps: 12 }, 'kg')).toBe('12\u00a0reps, no weight logged')
    expect(plain(setText({ kind: 'working', weightKg: null, reps: 1 }, 'kg'))).toBe('1 rep, no weight logged')
    expect(plain(fmtLiftWeight(80, 'lb'))).toBe('176.37 lb')
    expect(plain(fmtLiftWeight(toKg(225, 'lb'), 'lb'))).toBe('225 lb')
    expect(plain(fmtLiftWeight(1000, 'kg'))).toBe('1,000 kg')
    expect(plain(fmtLiftWeight(1.25, 'kg'))).toBe('1.25 kg')
  })

  it('counts sets by kind, leaving out kinds with none', () => {
    expect(countsText({ warmup: 1, working: 2, drop: 1, total: 4 })).toBe('4 sets (1 warm-up, 2 working, 1 drop set)')
    expect(countsText({ warmup: 0, working: 1, drop: 2, total: 3 })).toBe('3 sets (1 working, 2 drop sets)')
  })

  it('a session shows every set with its type in words, and each exercise’s previous best with its date', () => {
    const v = sessionView(thu as Workout & { gym: GymSession }, [mon, thu], 'kg', NOW)
    // A history across many dates: the calendar date is always given, even for this week.
    expect(v.when).toBe('Thu Nov 5, 6:30 PM')
    expect(v.counts).toBe('2 exercises · 2 sets (2 working)')
    expect(v.exercises[0].name).toBe('bench press')
    expect(v.exercises[0].sets.map((x) => ({ ...x, text: plain(x.text) }))).toEqual([
      { kind: 'working', kindLabel: 'Working', text: '82.5 kg × 6', weighted: true },
    ])
    // A set with no weight logged is words, not a figure: no number styling.
    expect(v.exercises[1].sets.map((x) => ({ ...x, text: plain(x.text) }))).toEqual([
      { kind: 'working', kindLabel: 'Working', text: '12 reps, no weight logged', weighted: false },
    ])
    expect(plain(v.exercises[0].best)).toBe('Previous best: 80 kg × 8 (Mon Oct 26)')
    expect(v.exercises[1].best).toBe(copy.gym.bestFirst)
    expect(copy.gym.bestFirst).toBe('Previous best: none, first time logged')
    const first = sessionView(mon as Workout & { gym: GymSession }, [mon, thu], 'kg', NOW)
    expect(first.when).toBe('Mon Oct 26, 6:00 PM')
    // Another year's session names its year.
    const lastYear = { ...mon, startedAt: '2025-12-29T18:00:00-05:00' } as Workout & { gym: GymSession }
    expect(sessionView(lastYear, [lastYear], 'kg', NOW).when).toBe('Mon Dec 29, 2025, 6:00 PM')
    expect(first.exercises[0].sets.map((s) => s.kindLabel)).toEqual(['Warm-up', 'Working', 'Working', 'Drop set'])
    expect(first.exercises[0].best).toBe(copy.gym.bestFirst)
  })

  it('the gym log lists sessions newest first and finds them by exercise or split', () => {
    const walk: Workout = { id: 'w-walk', name: 'Brisk walk', startedAt: '2026-11-01T12:00:00-05:00', minutes: 30, kcal: null, source: null }
    expect(gymHistory([mon, walk, thu], '')).toEqual({ total: 2, matches: [thu, mon] })
    expect(gymHistory([mon, walk, thu], 'DIP').matches).toEqual([thu])
    expect(gymHistory([mon, walk, thu], 'push').matches).toEqual([thu, mon])
    expect(gymHistory([mon, walk, thu], 'walk').matches).toEqual([])
  })

  it('the dashboard summary lists the day’s sessions only, with each exercise’s set count and top working set', () => {
    const walk: Workout = { id: 'w-walk', name: 'Brisk walk', startedAt: '2026-11-05T12:00:00-05:00', minutes: 30, kcal: null, source: null }
    expect(gymSummary([walk], '2026-11-05T08:00:00-05:00', 'kg')).toEqual([])
    const [item] = gymSummary([walk, thu], '2026-11-05T08:00:00-05:00', 'kg')
    expect(item.meta).toBe('6:30 PM · 2 exercises · 2 sets')
    expect(item.exercises.map((e) => ({ ...e, text: plain(e.text) }))).toEqual([
      { name: 'bench press', text: '1 set · Top working set 82.5 kg × 6' },
      { name: 'Dips', text: '1 set · Top working set 12 reps, no weight logged' },
    ])
    // The row's accessible name replaces its visible text, so every exercise line is in it.
    expect(plain(item.label)).toBe(
      'Push, 6:30 PM · 2 exercises · 2 sets. bench press: 1 set · Top working set 82.5 kg × 6. ' +
        'Dips: 1 set · Top working set 12 reps, no weight logged. Opens the workout details with every set.',
    )
    const [warmOnly] = gymSummary(
      [{ ...thu, gym: { unit: 'kg', exercises: [{ name: 'Row', sets: [{ kind: 'warmup', weightKg: 20, reps: 10 }] }] } }],
      '2026-11-05T08:00:00-05:00',
      'kg',
    )
    expect(warmOnly.exercises[0].text).toBe('1 set · No working set')
  })

  it('gym weights show in the latest gym session’s unit, never changing the weight log’s; with none yet, the weight log’s unit', () => {
    const lbSession: Workout = { ...thu, gym: { ...thu.gym!, unit: 'lb' } }
    const kgLog = { ...withWeightUnit(emptyLog(), 'kg'), workouts: [mon, lbSession] }
    // Sam weighs in in kg and lifts in lb: the gym log reads lb, the weight log stays kg.
    expect(gymUnitOf(kgLog)).toBe('lb')
    expect(weightUnitOf(kgLog)).toBe('kg')
    // The latest session by start decides, whichever order the log holds them in.
    expect(gymUnitOf({ ...kgLog, workouts: [lbSession, { ...mon, startedAt: '2026-11-06T07:00:00-05:00' }] })).toBe('kg')
    // No gym session yet: the weight log's unit is the starting point.
    expect(gymUnitOf(withWeightUnit(emptyLog(), 'lb'))).toBe('lb')
    expect(gymUnitOf(emptyLog())).toBe('kg')
  })

  it('previous best tells a first time apart from an exercise logged before with no working set', () => {
    const dropsOnly: Workout = {
      ...mon,
      id: 'w-raises',
      startedAt: '2026-10-29T18:00:00-05:00',
      gym: { unit: 'kg', exercises: [{ name: 'Lateral raise', sets: [{ kind: 'drop', weightKg: 10, reps: 12, drops: [{ weightKg: 6, reps: 10 }] }] }] },
    }
    const again: Workout & { gym: GymSession } = {
      ...mon,
      id: 'w-raises-2',
      startedAt: '2026-11-05T18:00:00-05:00',
      gym: { unit: 'kg', exercises: [{ name: 'lateral  RAISE', sets: [{ kind: 'drop', weightKg: 10, reps: 12 }] }] },
    }
    const v = sessionView(again, [dropsOnly, again], 'kg', NOW)
    expect(v.exercises[0].best).toBe(copy.gym.bestNoWorking)
    expect(copy.gym.bestNoWorking).toBe('Previous best: none yet (no earlier working set)')
    // The first one ever logged is the first time.
    expect(sessionView(dropsOnly as Workout & { gym: GymSession }, [dropsOnly, again], 'kg', NOW).exercises[0].best).toBe(copy.gym.bestFirst)
  })

  it('a session on a later date in a long waking day gives its weekday, and a week or more on, its date too', () => {
    const start = '2026-10-26T07:00:00-04:00'
    const at = (iso: string) => gymSummary([{ ...thu, startedAt: iso }], start, 'kg')[0].meta.split(' · ')[0]
    expect(at('2026-10-26T18:30:00-04:00')).toBe('6:30 PM')
    expect(at('2026-10-27T00:40:00-04:00')).toBe('Tue 12:40 AM')
    // Same weekday a week on: the date tells the two Mondays apart.
    expect(at('2026-11-02T18:30:00-05:00')).toBe('Mon Nov 2, 6:30 PM')
  })
})
