// The log documents: the demo (copied from fixtures/demo-week.json) and your own log.
// src/store/schema.ts validates them and src/store/storage.ts keeps each one on the device
// under its own key (howsure.demo.v1 and howsure.mine.v1).

import demoWeek from '../../fixtures/demo-week.json'
import {
  DEMO_START_WALL,
  parseWallClock,
  startDemoClock,
  wallToLocalIso,
  type DemoClockState,
  type LogKind,
} from '../clock'
import { SOURCES } from '../kernel/sources'
import type { ActivityLevel, BodySex } from '../kernel/energy'
import type { BurnSourceId, Meal, MealFood, MealLookup, MealSourceId, SleepRecord, Workout } from '../kernel/types'

/**
 * Body details for the resting-burn estimate (build-out item 2.5b). Every key is optional: a
 * blank box is not set, and nothing is guessed. Height is kept in cm and weight in kg; the units
 * say how they were typed, so the form shows them the same way again.
 */
export interface BodyDetails {
  /** Age in whole years when typed, on `ageSetOn` (YYYY-MM-DD), so it moves on with time. */
  age?: number
  ageSetOn?: string
  sex?: BodySex
  heightCm?: number
  heightUnit?: 'cm' | 'ftin'
  weightKg?: number
  weightUnit?: 'kg' | 'lb'
  /** Everyday activity, not counting workouts. Missing reads as the default, mostly sitting. */
  activity?: ActivityLevel
}

export interface Profile {
  name: string
  kind: 'guest' | 'demo'
  targets?: { kcal?: number; protein?: number; carbs?: number; fat?: number }
  /** Build-out item 2.5b: optional, so a log saved before it loads unchanged (no version bump). */
  body?: BodyDetails
}

/**
 * A meal saved as usual (build-out item 2.3): its name, source and values, with no time of its own.
 * Logging it makes a fresh meal with its own id and time; the two are not linked, so renaming or
 * deleting a saved meal leaves the meals already logged as they are.
 */
export interface SavedMeal {
  id: string
  name: string
  source: MealSourceId | null
  kcal: number | null // null = unknown, never 0
  protein: number | null
  carbs: number | null
  fat: number | null
  note?: string
  foods?: MealFood[]
  lookup?: MealLookup
  /** When it was saved, ISO 8601 with offset. */
  savedAt: string
  /** The logged meal it was saved from, so that meal's details can say it is saved. Not a link: nothing follows it. */
  fromMealId?: string
}

export interface LogDoc {
  kind: LogKind
  profile: Profile
  meals: Meal[]
  sleeps: SleepRecord[]
  /** Workouts (slice 10, build-out item 2.5a), each on the waking day it started in. */
  workouts: Workout[]
  // Carried through untouched until its slice (Tier 2, slice 11).
  plates: unknown[]
  settings?: Record<string, unknown>
  /** Meals saved as usual (build-out item 2.3). Optional: a log saved before it has none. */
  savedMeals?: SavedMeal[]
  /** The demo clock's anchor (spec.md > Clock). Demo document only, so a reload continues the timeline. */
  clock?: DemoClockState
}

export function emptyLog(): LogDoc {
  return { kind: 'mine', profile: { name: '', kind: 'guest' }, meals: [], sleeps: [], workouts: [], plates: [] }
}

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function isMealSource(v: unknown): v is MealSourceId {
  return typeof v === 'string' && v in SOURCES && !v.startsWith('burn_')
}

function toMeal(raw: unknown): Meal {
  if (!isObj(raw)) throw new Error('demo fixture: a meal is not an object')
  const { id, name, eatenAt, source } = raw
  if (typeof id !== 'string' || typeof name !== 'string' || typeof eatenAt !== 'string') {
    throw new Error('demo fixture: a meal is missing id, name or eatenAt')
  }
  if (!isMealSource(source)) throw new Error(`demo fixture: meal ${id} has an unknown source`)
  const meal: Meal = {
    ...(structuredClone(raw) as unknown as Meal),
    id,
    name,
    source,
    eatenAt: wallToLocalIso(eatenAt),
    kcal: numOrNull(raw.kcal),
    protein: numOrNull(raw.protein),
    carbs: numOrNull(raw.carbs),
    fat: numOrNull(raw.fat),
  }
  return meal
}

function toSleep(raw: unknown): SleepRecord {
  if (!isObj(raw) || typeof raw.id !== 'string') throw new Error('demo fixture: a sleep record has no id')
  const conv = (v: unknown) => (typeof v === 'string' ? wallToLocalIso(v) : null)
  return { id: raw.id, sleepStart: conv(raw.sleepStart), wake: conv(raw.wake) }
}

function isBurnSource(v: unknown): v is BurnSourceId {
  return typeof v === 'string' && v in SOURCES && v.startsWith('burn_')
}

/** A fixture workout, with its start time converted like every other time (slice 10). */
function toWorkout(raw: unknown): Workout {
  if (!isObj(raw)) throw new Error('demo fixture: a workout is not an object')
  const { id, name, startedAt, source } = raw
  if (typeof id !== 'string' || typeof name !== 'string' || typeof startedAt !== 'string') {
    throw new Error('demo fixture: a workout is missing id, name or startedAt')
  }
  if (source !== null && !isBurnSource(source)) throw new Error(`demo fixture: workout ${id} has an unknown source`)
  return {
    ...(structuredClone(raw) as unknown as Workout),
    id,
    name,
    startedAt: wallToLocalIso(startedAt),
    minutes: numOrNull(raw.minutes),
    kcal: numOrNull(raw.kcal),
    source,
  }
}

export interface DemoStart {
  doc: LogDoc
  /** The demo clock's starting moment (ms), from the fixture, else Thu 2026-10-22 01:30 local. */
  clockStartMs: number
}

/**
 * A fresh copy of Sam's fictional week, with every time as a local-offset ISO string.
 * The fixture stores wall-clock strings with no offset (spec.md > Clock > Time zones), so
 * Wednesday's wake reads 13:20 local and the snack Thu 00:40 local in any time zone.
 */
export function demoLog(fixture: unknown = demoWeek): DemoStart {
  if (!isObj(fixture)) throw new Error('demo fixture: not an object')
  const person = isObj(fixture.person) ? fixture.person : {}
  const targets = isObj(person.targets) ? (person.targets as Profile['targets']) : undefined
  const name =
    typeof person.gamerTag === 'string' ? person.gamerTag : typeof person.name === 'string' ? person.name : ''
  const meals = Array.isArray(fixture.meals) ? fixture.meals.map(toMeal) : []
  const sleeps = Array.isArray(fixture.sleeps) ? fixture.sleeps.map(toSleep) : []
  const clock = isObj(fixture.clock) ? fixture.clock : {}
  const startWall = typeof clock.start === 'string' ? clock.start : DEMO_START_WALL
  return {
    doc: {
      kind: 'demo',
      profile: { name, kind: 'demo', targets },
      meals,
      sleeps,
      workouts: Array.isArray(fixture.workouts) ? fixture.workouts.map(toWorkout) : [],
      plates: Array.isArray(fixture.plates) ? structuredClone(fixture.plates) : [],
    },
    clockStartMs: parseWallClock(startWall),
  }
}

/**
 * Try the fictional demo with no saved demo (and, in slice 5, Reset demo): a fresh copy of
 * Sam's week with the demo clock started at the fixture's moment, Thu 2026-10-22 01:30 local.
 * The clock's anchor goes into the document, so a reload continues the same timeline.
 */
export function startDemo(realNow: number = Date.now()): LogDoc {
  const { doc, clockStartMs } = demoLog()
  return { ...doc, clock: startDemoClock(clockStartMs, realNow) }
}
