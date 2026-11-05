// Reset demo (spec.md > Store; prd.md > Demo and My Log): puts back Sam's fictional week as it
// started and restarts the demo clock. It asks for confirmation only when the demo has been
// edited. "Edited" means the projection { profile, meals, sleeps, workouts, plates }, written
// with its keys in a fixed (sorted) order, differs from the same projection of a fresh demo
// (converted from fixtures/demo-week.json as on demo start). The clock and anything else the
// demo document holds do not count, so an untouched demo resets with no confirmation.
//
// Times count by their wall clock (date and time of day), not by their offset. The fixture holds
// wall times and a fresh demo converts them in the device's current time zone, so a demo started
// in Toronto (-04:00) and reset in Los Angeles (-07:00) would otherwise read as edited throughout.
// Reset puts back the same wall times, so an edit that keeps the wall time discards nothing.
//
// The fresh demo goes through the same save-and-load path as a stored one (serializeLog then
// parseLogText), so a demo that was only saved and read back compares equal. Comparing the
// fixed-order text itself, rather than a hash of it, gives the same answer with no collisions.
// Pure: nothing is read from or written to storage here; your own log is never involved.

import type { Meal, SleepRecord } from '../kernel/types'
import { demoLog, type LogDoc } from './log'
import { parseLogText, serializeLog } from './storage'

/** An ISO date-time with a UTC offset or Z, as the log stores times ("2026-10-21T17:30:00-04:00"). */
const ISO_WITH_OFFSET = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(?:Z|[+-]\d{2}:\d{2})$/

/** A stored time's wall clock: the offset left off. Any other string is returned as it is. */
export function wallTime(text: string): string {
  const m = ISO_WITH_OFFSET.exec(text)
  return m ? m[1] : text
}

/**
 * JSON with every object's keys sorted, and undefined values left out (as JSON.stringify does).
 * Every string goes through `str` first; the demo's comparisons pass wallTime.
 */
export function stableJson(value: unknown, str: (s: string) => string = (s) => s): string {
  if (typeof value === 'string') return JSON.stringify(str(value))
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableJson(v, str))).join(',')}]`
  const obj = value as Record<string, unknown>
  const parts = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJson(obj[k], str)}`)
  return `{${parts.join(',')}}`
}

/** stableJson with stored times compared by their wall clock. */
function demoJson(value: unknown): string {
  return stableJson(value, wallTime)
}

/** Items in id order, so the order they happen to be stored in doesn't count as an edit. */
function inIdOrder(items: unknown[]): unknown[] {
  const idOf = (v: unknown) =>
    typeof v === 'object' && v !== null && typeof (v as { id?: unknown }).id === 'string' ? (v as { id: string }).id : ''
  return [...items].sort((a, b) => (idOf(a) < idOf(b) ? -1 : idOf(a) > idOf(b) ? 1 : 0))
}

/** The parts of a demo that count as its data: everything but the clock and settings. */
export function demoProjection(doc: LogDoc): string {
  return demoJson({
    profile: doc.profile,
    meals: inIdOrder(doc.meals),
    sleeps: inIdOrder(doc.sleeps),
    workouts: inIdOrder(doc.workouts),
    plates: inIdOrder(doc.plates),
  })
}

/** Sam's week as it starts, as it reads back from the device (no clock: it doesn't count). */
export function pristineDemo(): LogDoc {
  const { doc } = demoLog()
  const back = parseLogText(serializeLog(doc))
  if (back.status !== 'ok') throw new Error('demo fixture: does not read back after saving')
  return back.doc
}

/** True when the demo's data differs from Sam's week as it started. */
export function isDemoEdited(doc: LogDoc, pristine: LogDoc = pristineDemo()): boolean {
  return demoProjection(doc) !== demoProjection(pristine)
}

/** What Reset demo would discard, for its confirmation. Counts by meal id. */
export interface DemoChanges {
  mealsAdded: number
  mealsChanged: number
  mealsDeleted: number
  sleepChanged: boolean
  targetsChanged: boolean
  /** The rest of the projection: the profile's other fields, workouts and plates. */
  otherChanged: boolean
}

function byId<T extends { id: string }>(items: T[]): Map<string, string> {
  return new Map(items.map((i) => [i.id, demoJson(i)]))
}

export function demoChanges(doc: LogDoc, pristine: LogDoc = pristineDemo()): DemoChanges {
  const now = byId<Meal>(doc.meals)
  const was = byId<Meal>(pristine.meals)
  let mealsAdded = 0
  let mealsChanged = 0
  for (const [id, text] of now) {
    const before = was.get(id)
    if (before === undefined) mealsAdded++
    else if (before !== text) mealsChanged++
  }
  const mealsDeleted = [...was.keys()].filter((id) => !now.has(id)).length
  const sleepText = (s: SleepRecord[]) => demoJson(inIdOrder(s))
  const { targets: targetsNow, ...profileNow } = doc.profile
  const { targets: targetsWas, ...profileWas } = pristine.profile
  return {
    mealsAdded,
    mealsChanged,
    mealsDeleted,
    sleepChanged: sleepText(doc.sleeps) !== sleepText(pristine.sleeps),
    targetsChanged: demoJson(targetsNow ?? null) !== demoJson(targetsWas ?? null),
    otherChanged:
      demoJson(profileNow) !== demoJson(profileWas) ||
      demoJson(inIdOrder(doc.workouts)) !== demoJson(inIdOrder(pristine.workouts)) ||
      demoJson(inIdOrder(doc.plates)) !== demoJson(inIdOrder(pristine.plates)),
  }
}
