// Build-out item 2.1: Reset demo asks first only when the demo was edited (spec.md > Store). The
// projection { profile, meals, sleeps, workouts, plates, savedMeals } in a fixed key order is compared with a
// fresh demo's; the clock and the order things are stored in don't count.
import { describe, expect, it } from 'vitest'
import { demoChanges, demoProjection, isDemoEdited, pristineDemo, stableJson, wallTime } from '../demoReset'
import { emptyLog, startDemo, type LogDoc } from '../log'
import { loadSession } from '../session'
import { ACTIVE_KEY, saveActive, saveLog, serializeLog, STORAGE_KEYS } from '../storage'
import { changeLines } from '../../ui/ResetDemoSheet'
import { MemoryStore } from './memoryStore'

const R0 = Date.parse('2026-11-05T09:00:00-05:00')
const NONE = { mealsAdded: 0, mealsChanged: 0, mealsDeleted: 0, sleepChanged: false, targetsChanged: false, bodyChanged: false, savedMealsChanged: false, workoutsChanged: false, weighInsChanged: false, usualDayChanged: false, otherChanged: false }

describe('stableJson', () => {
  it('sorts keys at every level and leaves out undefined values', () => {
    expect(stableJson({ b: 1, a: { d: [2, { z: 1, y: null }], c: undefined } })).toBe('{"a":{"d":[2,{"y":null,"z":1}]},"b":1}')
    expect(stableJson({ a: 1, b: 2 })).toBe(stableJson({ b: 2, a: 1 }))
  })

  it('passes every string through the given mapper', () => {
    expect(stableJson({ a: 'x', b: ['y'] }, (t) => t.toUpperCase())).toBe('{"a":"X","b":["Y"]}')
  })
})

describe('wallTime', () => {
  it('leaves the offset off a stored time and keeps any other string as it is', () => {
    expect(wallTime('2026-10-15T13:40:00-04:00')).toBe('2026-10-15T13:40:00')
    expect(wallTime('2026-10-15T13:40:00-07:00')).toBe('2026-10-15T13:40:00')
    expect(wallTime('2026-10-15T13:40:00.500+05:30')).toBe('2026-10-15T13:40:00.500')
    expect(wallTime('2026-10-15T17:40:00Z')).toBe('2026-10-15T17:40:00')
    expect(wallTime('2026-10-15T13:40')).toBe('2026-10-15T13:40')
    expect(wallTime('Greek yogurt -04:00')).toBe('Greek yogurt -04:00')
  })
})

/** Every stored time in `value` with its offset replaced, as if converted in another time zone. */
function inOtherZone<T>(value: T, offset: string): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v: unknown) =>
      typeof v === 'string' && /T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(v)
        ? v.replace(/([+-]\d{2}:\d{2}|Z)$/, offset)
        : v,
    ),
  ) as T
}

describe('is the demo edited?', () => {
  it('a fresh demo is not, whatever its clock says', () => {
    const fresh = startDemo(R0)
    expect(isDemoEdited(fresh)).toBe(false)
    expect(isDemoEdited({ ...fresh, clock: { demoEpochFixture: 1, demoEpochReal: 2 } })).toBe(false)
    expect(demoChanges(fresh)).toEqual(NONE)
  })

  it('a demo saved and read back after a reload is not', () => {
    const store = new MemoryStore()
    saveLog(startDemo(R0), store)
    saveActive('demo', store)
    const s = loadSession(store, R0 + 3_600_000)
    expect(s.logs.demo).not.toBeNull()
    expect(isDemoEdited(s.logs.demo as LogDoc)).toBe(false)
  })

  it('a demo started in one time zone and reset in another is not (wall times compare)', () => {
    // Started in Toronto, reset in Los Angeles: the same wall times, a different offset on each.
    const pristine = pristineDemo()
    const elsewhere = inOtherZone(pristine, '-07:00')
    expect(elsewhere.meals[0].eatenAt).not.toBe(pristine.meals[0].eatenAt)
    expect(isDemoEdited(elsewhere, pristine)).toBe(false)
    expect(demoChanges(elsewhere, pristine)).toEqual(NONE)
    // A real edit there still counts: one meal an hour later on the wall clock.
    const [first, ...rest] = elsewhere.meals
    const hourLater = first.eatenAt.replace(/T(\d{2})/, (_m, h: string) => `T${String(Number(h) + 1).padStart(2, '0')}`)
    const edited = { ...elsewhere, meals: [{ ...first, eatenAt: hourLater }, ...rest] }
    expect(isDemoEdited(edited, pristine)).toBe(true)
    expect(demoChanges(edited, pristine)).toEqual({ ...NONE, mealsChanged: 1 })
  })

  it('the order meals and sleeps are stored in does not count', () => {
    const fresh = pristineDemo()
    const shuffled = { ...fresh, meals: [...fresh.meals].reverse(), sleeps: [...fresh.sleeps].reverse() }
    expect(demoProjection(shuffled)).toBe(demoProjection(fresh))
    expect(isDemoEdited(shuffled, fresh)).toBe(false)
  })

  it('an improved meal is one meal changed', () => {
    const fresh = pristineDemo()
    const pasta = fresh.meals.find((m) => m.name === 'Pasta bake (ready meal)')
    expect(pasta).toBeDefined()
    const edited = { ...fresh, meals: fresh.meals.map((m) => (m === pasta ? { ...m, kcal: 860, source: 'label' as const } : m)) }
    expect(isDemoEdited(edited, fresh)).toBe(true)
    expect(demoChanges(edited, fresh)).toEqual({ ...NONE, mealsChanged: 1 })
  })

  it('counts meals added and deleted, and names sleep and target changes', () => {
    const fresh = pristineDemo()
    const snack = { ...fresh.meals[0], id: 'new-snack', name: 'Rice cake' }
    const edited: LogDoc = {
      ...fresh,
      meals: [...fresh.meals.slice(2), snack],
      sleeps: [...fresh.sleeps, { id: 'n', sleepStart: '2026-10-22T04:40:00-04:00', wake: null }],
      profile: { ...fresh.profile, targets: { ...fresh.profile.targets, kcal: 2500 } },
    }
    expect(demoChanges(edited, fresh)).toEqual({
      ...NONE,
      mealsAdded: 1,
      mealsDeleted: 2,
      sleepChanged: true,
      targetsChanged: true,
    })
    expect(isDemoEdited(edited, fresh)).toBe(true)
  })

  it('saved meals added, renamed or deleted count as their own change (build-out item 2.3)', () => {
    const fresh = pristineDemo()
    const usual = { id: 'saved-1', name: 'Usual soup', source: 'menu' as const, kcal: 330, protein: 18, carbs: 46, fat: 8, savedAt: '2026-10-22T01:30:00-04:00' }
    const added: LogDoc = { ...fresh, savedMeals: [usual] }
    expect(isDemoEdited(added, fresh)).toBe(true)
    expect(demoChanges(added, fresh)).toEqual({ ...NONE, savedMealsChanged: true })
    expect(demoChanges({ ...fresh, savedMeals: [{ ...usual, name: 'Soup' }] }, added)).toEqual({ ...NONE, savedMealsChanged: true })
    // All of them deleted again: an empty list is the same as none.
    expect(isDemoEdited({ ...fresh, savedMeals: [] }, fresh)).toBe(false)
  })

  it('a workout logged, edited or deleted counts as its own change (build-out item 2.5a)', () => {
    const fresh = pristineDemo()
    const swim = { id: 'w-new', name: 'Swim', startedAt: '2026-10-22T01:00:00-04:00', minutes: 30, kcal: 300, source: 'burn_guess' as const }
    expect(demoChanges({ ...fresh, workouts: [...fresh.workouts, swim] }, fresh)).toEqual({ ...NONE, workoutsChanged: true })
    expect(demoChanges({ ...fresh, workouts: [{ ...fresh.workouts[0], kcal: 250 }] }, fresh)).toEqual({ ...NONE, workoutsChanged: true })
    expect(demoChanges({ ...fresh, workouts: [] }, fresh)).toEqual({ ...NONE, workoutsChanged: true })
  })

  it('weigh-ins added, changed or deleted count as their own change (build-out item 2.4)', () => {
    const fresh = pristineDemo()
    const weigh = { id: 'weigh-1', at: '2026-10-22T07:10:00-04:00', kg: 70.2, unit: 'kg' as const }
    const added: LogDoc = { ...fresh, weighIns: [weigh] }
    expect(isDemoEdited(added, fresh)).toBe(true)
    expect(demoChanges(added, fresh)).toEqual({ ...NONE, weighInsChanged: true })
    expect(demoChanges({ ...fresh, weighIns: [{ ...weigh, kg: 70.4 }] }, added)).toEqual({ ...NONE, weighInsChanged: true })
    expect(isDemoEdited({ ...fresh, weighIns: [] }, fresh)).toBe(false)
  })

  it('gym sets added to a workout count as a workout change; the weight unit setting does not count (build-out item 2.6)', () => {
    const fresh = pristineDemo()
    const gym = { unit: 'kg' as const, exercises: [{ name: 'Bench press', sets: [{ kind: 'working' as const, weightKg: 80, reps: 8 }] }] }
    expect(demoChanges({ ...fresh, workouts: [{ ...fresh.workouts[0], gym }] }, fresh)).toEqual({ ...NONE, workoutsChanged: true })
    expect(isDemoEdited({ ...fresh, settings: { weightUnit: 'lb' } }, fresh)).toBe(false)
  })

  it('a change to the plates or the profile name counts as another change', () => {
    const fresh = pristineDemo()
    expect(demoChanges({ ...fresh, plates: [] }, fresh)).toEqual({ ...NONE, otherChanged: true })
    expect(demoChanges({ ...fresh, profile: { ...fresh.profile, name: 'Other' } }, fresh)).toEqual({ ...NONE, otherChanged: true })
  })

  it('a usual day length set for the timeline counts as its own change (build-out item 2.8)', () => {
    const fresh = pristineDemo()
    const set = { ...fresh, profile: { ...fresh.profile, usualDayHours: 15 } }
    expect(demoChanges(set, fresh)).toEqual({ ...NONE, usualDayChanged: true })
    expect(isDemoEdited(set, fresh)).toBe(true)
    expect(changeLines(demoChanges(set, fresh))).toEqual(['Sam’s usual day length changed'])
  })
})

describe('returning opens the last log used (loadSession)', () => {
  const mineText = serializeLog({ ...emptyLog(), profile: { name: 'Sam', kind: 'guest' } })

  it('opens the saved choice', () => {
    const store = new MemoryStore()
    store.setItem(STORAGE_KEYS.mine, mineText)
    saveLog(startDemo(R0), store)
    store.setItem(ACTIVE_KEY, 'demo')
    expect(loadSession(store, R0).active).toBe('demo')
    store.setItem(ACTIVE_KEY, 'mine')
    expect(loadSession(store, R0).active).toBe('mine')
  })

  it('with no saved choice, a saved own log comes first, then a saved demo', () => {
    const store = new MemoryStore()
    saveLog(startDemo(R0), store)
    expect(loadSession(store, R0).active).toBe('demo')
    store.setItem(STORAGE_KEYS.mine, mineText)
    expect(loadSession(store, R0).active).toBe('mine')
  })

  it('a saved choice of the demo with no demo saved falls back to your own log, if saved', () => {
    const store = new MemoryStore()
    store.setItem(ACTIVE_KEY, 'demo')
    expect(loadSession(store, R0).active).toBeNull()
    store.setItem(STORAGE_KEYS.mine, mineText)
    expect(loadSession(store, R0).active).toBe('mine')
  })

  it('a saved choice of your own log with nothing saved yet opens your empty log', () => {
    const store = new MemoryStore()
    store.setItem(ACTIVE_KEY, 'mine')
    const s = loadSession(store, R0)
    expect(s.active).toBe('mine')
    expect(s.logs.mine).toEqual(emptyLog())
  })
})
