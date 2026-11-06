// Weigh-ins from the food, weight and sleep tracker's export (build-out item 2.4), the weigh-in
// part of the tracker import (item 2.1b reads the rest of the same bundle). Each record is one
// weigh-in per calendar date:
//   { id: "<YYYY-MM-DD>", data: { date: "<YYYY-MM-DD>", lb: <number>, bf?: <number>, time?: "h:mm AM" } }
// (a bare `data` object is read the same way).
//
// - Weight: `lb` is pounds; it is stored in kg with the exact factor (1 lb = 0.45359237 kg), and the
//   weigh-in keeps unit 'lb', so it shows back as the number the tracker held.
// - Body fat: `bf` is kept as bodyFatPct when it is a percentage above 0 and below 100.
// - Time: the record's `time` when it is a clock time the tracker itself accepts ("6:48 AM",
//   /^(1[0-2]|[1-9]):[0-5]\d [AP]M$/), on the record's date. Most records have none: the weigh-in is
//   then marked timeApproximate and placed on its calendar date at one minute after the first wake
//   recorded on that date (`wakes`, the import's own sleep records), so it lands in the waking day
//   that began that date, the day the tracker filed it under, even for someone who wakes after noon.
//   With no wake on that date it is placed at 12:00 noon (APPROX_HOUR). The edit sheet names the
//   time it was given.
// - Times are local wall times on this device, written with its offset, like every time in a log.
// - Every original field is kept under `imported`, unchanged.
// - Ids: "weighin-tracker-<date>"; a second record on the same date gets "-2", a third "-3", and so
//   on in the bundle's order, so editing or deleting one never touches the other.
// A record with no usable date or weight is skipped and reported, never guessed.
// Pure: no React, no storage; the device's time zone is the only outside input.

import { toLocalIso } from '../clock'
import type { WeighIn } from '../kernel/types'
import { LB_TO_KG } from '../kernel/weight'

/** The hour an imported weigh-in with no recorded time is placed at, on its calendar date. */
export const APPROX_HOUR = 12

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const CLOCK = /^(1[0-2]|[1-9]):([0-5]\d) ([AP])M$/

export type WeighInSkip = { id: string; reason: 'noDate' | 'noWeight' }

export interface TrackerWeighIns {
  weighIns: WeighIn[]
  skipped: WeighInSkip[]
}

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** A number as the tracker stores it; a numeric string ("171.4") is read too. Null when it isn't one. */
function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim())
  return null
}

/** [year, month index, day] of a real calendar date, or null. */
function calendarDate(v: unknown): [number, number, number] | null {
  if (typeof v !== 'string') return null
  const m = DATE.exec(v)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
  const check = new Date(y, mo, d)
  return check.getFullYear() === y && check.getMonth() === mo && check.getDate() === d ? [y, mo, d] : null
}

/** Hours and minutes of "6:48 AM", or null when it isn't a time the tracker accepts. */
function clockTime(v: unknown): [number, number] | null {
  if (typeof v !== 'string') return null
  const m = CLOCK.exec(v)
  if (!m) return null
  const h12 = Number(m[1]) % 12
  return [m[3] === 'P' ? h12 + 12 : h12, Number(m[2])]
}

/** Minutes after a wake that an untimed weigh-in on the wake's date is placed at. */
export const APPROX_AFTER_WAKE_MIN = 1

/** "YYYY-MM-DD" of a moment on this device's calendar. */
function localDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The first wake on each local calendar date, in ms, from wake times (ISO with offset). */
function firstWakeByDate(wakes: readonly string[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const w of wakes) {
    const t = Date.parse(w)
    if (Number.isNaN(t)) continue
    const key = localDate(t)
    const was = out.get(key)
    if (was === undefined || t < was) out.set(key, t)
  }
  return out
}

/**
 * The tracker's weigh-in records as HowSure weigh-ins, oldest first, with what was skipped.
 * `wakes`: the wake times of the sleep records imported with them, used to place a weigh-in that
 * has no recorded time (see the header).
 */
export function weighInsFromTracker(records: readonly unknown[], wakes: readonly string[] = []): TrackerWeighIns {
  const wakeOn = firstWakeByDate(wakes)
  const weighIns: WeighIn[] = []
  const skipped: WeighInSkip[] = []
  const perDate = new Map<string, number>()
  for (const [i, record] of records.entries()) {
    const data = isObj(record) && isObj(record.data) ? record.data : isObj(record) ? record : {}
    const date = calendarDate(data.date)
    const key = typeof data.date === 'string' ? data.date : isObj(record) && typeof record.id === 'string' ? record.id : `#${i + 1}`
    if (!date) {
      skipped.push({ id: key, reason: 'noDate' })
      continue
    }
    const lb = num(data.lb)
    if (lb === null || lb <= 0) {
      skipped.push({ id: key, reason: 'noWeight' })
      continue
    }
    const clock = clockTime(data.time)
    const wake = clock ? undefined : wakeOn.get(data.date as string)
    const [hour, minute] = clock ?? [APPROX_HOUR, 0]
    const atMs = wake !== undefined ? wake + APPROX_AFTER_WAKE_MIN * 60_000 : new Date(date[0], date[1], date[2], hour, minute).getTime()
    const nth = (perDate.get(data.date as string) ?? 0) + 1
    perDate.set(data.date as string, nth)
    const w: WeighIn = {
      id: nth === 1 ? `weighin-tracker-${data.date as string}` : `weighin-tracker-${data.date as string}-${nth}`,
      at: toLocalIso(atMs),
      kg: lb * LB_TO_KG,
      unit: 'lb',
    }
    const bf = num(data.bf)
    if (bf !== null && bf > 0 && bf < 100) w.bodyFatPct = bf
    if (!clock) w.timeApproximate = true
    w.imported = structuredClone(data)
    weighIns.push(w)
  }
  weighIns.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return { weighIns, skipped }
}
