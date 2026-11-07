// Build-out item 2.1b: turn an export of the owner's earlier food, weight and sleep tracker (a
// "tracker bundle") into a HowSure log of kind 'mine', so he can import his real history into his
// own log. The bundle is { format: 'tracker-bundle', formatVersion: 1, exportedAt, meals, sleep,
// weighins, settings, pending }, each an array of { id, data, updatedAt, version } records.
// Pure: no React, no storage, no clock reads. The person sees a preview of everything it did
// (TrackerReport) before anything is saved, and the import keeps a backup of the log it replaces.
//
// Rules, in the order the bundle is read:
//
// Meals
// - The day is the record's stored `date` (the tracker's waking-day label). A meal never moves to
//   another day. Within a day, meals keep the tracker's order: by numeric id.
// - Calories and macros are kept as stored: 0 is a known 0, a missing or unreadable value is
//   unknown (null), never 0. The tracker already corrected them for bias when it saved them, so
//   nothing is re-applied or recomputed (kcal is not worked out from the macros).
// - The [wp1;...] tag is found anywhere in the text (first match) and read the tracker's way:
//   parts split at ';', each at its first '=', keys and values trimmed, parts with no key ignored.
//   Numbers are read as the tracker reads them (toNum). The tag is removed from the description.
// - The meal's name is the description's first clause, shortened; the whole description is the
//   meal's note. A text the tracker stored cut short (it ends in "…") is flagged as truncated.
// - Every tag field, the raw type, id, version and the original text are kept under the meal's
//   `imported` key, so nothing is lost (Phase 4 reads the nutrients and processing markers).
//
// Sources (the tracker's `src` code to HowSure's kind)
// - SCALE: Weighed. LABEL: Nutrition label (typed). CHAIN and CHAIN_BYO: Published menu.
// - NONCHAIN (an independent restaurant matched to a database entry): Food database. The
//   tracker's own label for it is "database match", and the bias it already applied to these
//   meals is the gap between non-chain restaurant meals and database values that HowSure's Food
//   database row cites, so it is the closest kind. Published menu would claim a menu that wasn't
//   there; Description would ignore that a database entry was used.
// - PHOTO_CTX and PHOTO: Photo estimate. TEXT and GUESS: Description.
// - No tag, no usable `src` (not capital letters and underscores), or a code the tracker doesn't
//   list: UNTAGGED, counted as Description, and the meal says "no source recorded" (an unlisted
//   code is kept and shown as it was written).
//
// Uncertainty
// - The tracker's `acc` is defined the same way as HowSure's estimate score: 100 x (1 - typical
//   error). HowSure's kernel can carry one meal's own typical error (Meal.typicalError), so a
//   meal with a usable acc (0 < acc < 100) gets e = (100 - acc) / 100, with the tracker's floor:
//   never below 0.2 x the tracker's own default for that source (hypot of its random and shared
//   error). Meal details say the figure came from the tracker and show HowSure's figure beside it.
//   A missing or unusable acc (0 or less, 100 or more) leaves HowSure's figure for the source.
//
// Times
// - The tracker records the day, not when a meal was eaten (`saved` is when it wrote the record).
//   Each meal is placed inside its day's waking span, from that date's wake to the next sleep's
//   bed time (16 hours after the wake when the next bed time is missing or more than a day later).
//   Breakfast, Lunch and Dinner are placed at the centre of that tracker's own parts of the waking day
//   (morning is the first 30%, afternoon to 60%, evening to 85%): at 15%, 45% and 72.5%. Other
//   types (Snack, Shake, Post-Workout, ...) are spread evenly between their neighbours. Times keep
//   the tracker's id order and are rounded to 5 minutes. No time is placed after the bundle's
//   exportedAt (or the device's now, when the caller gives it), so the last day's meals never sit
//   in the future. When a span is too short for that spacing, the meals are packed closer so they
//   still end before the next bed time. Every imported meal is marked timeApproximate, and meal
//   details say "time approximate". A date whose wake came in the evening (6 PM or later) can put
//   its meals on the next calendar date (still that date's waking day); the preview lists those.
//
// Sleep
// - One record per wake date: sleep start = bed, wake = wake; the rest is kept under `imported`.
// - A meal date with no sleep record joins the day before until that night is added (item 2.2
//   adds "add a missed night"): its meals are placed after the earlier date's, on their own
//   calendar date, and the preview lists those dates.
// - A bed time that doesn't fit between the previous night's wake and its own wake (an export can
//   hold such an overlap) is never invented: when the record's own fields give it (wake minus
//   hours asleep), that is used and flagged; otherwise the bed time is left out ("not logged")
//   and the preview says so. A second record with the same wake time as another is left out.
//
// Everything else
// - Targets: calories and protein from the targets document (its current values). Carbs and fat
//   stay unset. The whole document is kept under the log's `imported` key.
// - Weigh-ins become the log's weigh-ins (item 2.4's weight log, trackerWeighIns.ts): pounds to
//   kg with the exact factor (1 lb = 0.45359237 kg), shown back in lb; body fat kept; the record's
//   own time when it has one, else one minute after the first wake on its calendar date (noon with
//   no wake that date), marked approximate. A record with no usable date or weight is left out
//   and reported. The weight log then shows in lb, the unit the tracker kept.
// - Plates waiting to be logged (pending) and the sync bookkeeping are not imported; the preview
//   says so.

import { z } from 'zod'
import { hasOffset } from '../clock'
import type { ImportedFields, Meal, MealSourceId, SleepRecord } from '../kernel/types'
import type { LogDoc } from '../store/log'
import { weighInsFromTracker } from './trackerWeighIns'

export const TRACKER_FORMAT = 'tracker-bundle'
export const TRACKER_FORMAT_VERSION = 1

/** What the caller gives the conversion. It reads no clock and no UI words of its own. */
export interface TrackerOptions {
  /**
   * The name for a meal whose description and type are both empty (copy.ts, passed in by the UI).
   * Without it, such a meal is named by its record id.
   */
  mealFallbackName?: string
  /** The device's now: no meal is placed later than this (nor later than the bundle's exportedAt). */
  nowIso?: string
}

/* ---------------- the bundle's shape ---------------- */

const recordSchema = z.looseObject({
  id: z.string().min(1),
  data: z.looseObject({}),
  updatedAt: z.string().optional(),
  version: z.number().optional(),
})

type TrackerRecord = z.infer<typeof recordSchema>

const bundleSchema = z.looseObject({
  format: z.literal(TRACKER_FORMAT),
  formatVersion: z.number(),
  exportedAt: z.string().optional(),
  meals: z.array(recordSchema),
  sleep: z.array(recordSchema),
  weighins: z.array(recordSchema).optional(),
  settings: z.array(recordSchema).optional(),
  pending: z.array(recordSchema).optional(),
})

const numLike = z.union([z.number(), z.string(), z.null()]).optional()

const mealDataSchema = z.looseObject({
  date: z.string(),
  saved: z.string().optional(),
  type: z.string().optional(),
  kcal: numLike,
  protein: numLike,
  carbs: numLike,
  fat: numLike,
  text: z.string().optional(),
})

const sleepDataSchema = z.looseObject({
  date: z.string().optional(),
  bed: z.string().optional().nullable(),
  wake: z.string(),
  hours: numLike,
  saved: z.string().optional(),
})

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar date written YYYY-MM-DD: the shape, and a month and day that exist (no 2026-13-45 or 2026-02-30). */
export function isCalendarDate(v: unknown): v is string {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** True when `json` says it is a tracker bundle (any version): Import then reads it with this module. */
export function looksLikeTrackerBundle(json: unknown): boolean {
  return typeof json === 'object' && json !== null && !Array.isArray(json) && (json as { format?: unknown }).format === TRACKER_FORMAT
}

/* ---------------- reading values the tracker's way ---------------- */

/**
 * A number as the tracker reads one: thousands commas removed ("2,348" is 2348), a lone decimal
 * comma with 1 or 2 digits after it read as a point ("11,4" is 11.4). "", "?", null, anything
 * else that isn't a number, and negative values are unknown (null), never 0.
 */
export function toNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null
  if (typeof v !== 'string') return null
  let s = v.trim()
  if (s === '' || s === '?') return null
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.')
  else s = s.replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(s) && !/^\.\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const TAG_RE = /\[wp1;([^\]]*)\]/

export interface ParsedText {
  /** The tag's fields as written (keys and values trimmed), or null when the text has no tag. */
  tag: Record<string, string> | null
  /** The text with the tag removed, wherever it was. */
  description: string
}

/** Find the [wp1;...] tag anywhere in a meal's text, read it, and take it out of the description. */
export function parseTrackerText(text: string): ParsedText {
  const m = TAG_RE.exec(text)
  if (!m) return { tag: null, description: text.trim() }
  const entries: [string, string][] = []
  for (const part of m[1].split(';')) {
    const i = part.indexOf('=')
    if (i <= 0) continue
    const key = part.slice(0, i).trim()
    if (key === '') continue
    entries.push([key, part.slice(i + 1).trim()])
  }
  const before = text.slice(0, m.index).trimEnd()
  const after = text.slice(m.index + m[0].length).trimStart()
  return { tag: Object.fromEntries(entries), description: [before, after].filter((p) => p !== '').join(' ') }
}

/* ---------------- sources and uncertainty ---------------- */

/** The tracker's source codes, with its random (r) and shared (s) error, each a fraction of the estimate. */
export const TRACKER_SOURCES = {
  SCALE: { kind: 'weighed', r: 0.07, s: 0.03 },
  LABEL: { kind: 'label', r: 0.1, s: 0.03 },
  CHAIN: { kind: 'menu', r: 0.2, s: 0.05 },
  CHAIN_BYO: { kind: 'menu', r: 0.18, s: 0.07 },
  NONCHAIN: { kind: 'food_db', r: 0.3, s: 0.1 },
  PHOTO_CTX: { kind: 'photo', r: 0.3, s: 0.1 },
  PHOTO: { kind: 'photo', r: 0.45, s: 0.1 },
  TEXT: { kind: 'description', r: 0.4, s: 0.1 },
  GUESS: { kind: 'description', r: 0.6, s: 0.1 },
  UNTAGGED: { kind: 'description', r: 0.3, s: 0.1 },
} as const satisfies Record<string, { kind: MealSourceId; r: number; s: number }>

export type TrackerCode = keyof typeof TRACKER_SOURCES

function isTrackerCode(v: string): v is TrackerCode {
  return Object.hasOwn(TRACKER_SOURCES, v)
}

/**
 * The code a meal counts under: the tag's `src` when it is a code the tracker lists, else
 * UNTAGGED (no tag, no src, a src that isn't capital letters and underscores, or an unlisted code).
 */
export function trackerCode(tag: Record<string, string> | null): TrackerCode {
  const src = tag?.src
  if (src === undefined || !/^[A-Z_]+$/.test(src) || !isTrackerCode(src)) return 'UNTAGGED'
  return src
}

/** The tracker's own default typical error for a source: hypot(r, s). */
export function trackerDefaultError(code: TrackerCode): number {
  const { r, s } = TRACKER_SOURCES[code]
  return Math.hypot(r, s)
}

/**
 * The meal's typical error from the tracker's acc: (100 - acc) / 100, never below 0.2 x the
 * tracker's default for the source. Null when acc is missing or not 0 < acc < 100 (then HowSure's
 * figure for the source applies). `floored` says the floor was used.
 */
export function errorFromAcc(code: TrackerCode, acc: unknown): { e: number; floored: boolean } | null {
  const a = toNum(acc)
  if (a === null || a <= 0 || a >= 100) return null
  const own = (100 - a) / 100
  const floor = 0.2 * trackerDefaultError(code)
  return own < floor ? { e: floor, floored: true } : { e: own, floored: false }
}

/* ---------------- names ---------------- */

const NAME_MAX = 40

/** A short meal name: the description's first clause, cut at a word near 40 characters. */
export function shortMealName(description: string, type: string | undefined, fallback: string): string {
  const first = description.split(/\s\+\s|[,;:([]|\s[-–—]\s|\s~|\s\d+(?:\.\d+)?\s?(?:g|ml|oz)\b/)[0] ?? ''
  let name = first.replace(/\s+/g, ' ').trim().replace(/[\s.…]+$/, '')
  if (name.length > NAME_MAX) {
    const cut = name.slice(0, NAME_MAX)
    const space = cut.lastIndexOf(' ')
    name = `${(space > 10 ? cut.slice(0, space) : cut).trimEnd()}…`
  }
  if (name !== '') return name
  const t = (type ?? '').replace(/[^A-Za-z -]/g, '').trim()
  return t !== '' ? t : fallback
}

/** True when the tracker stored the text cut short: it ends in an ellipsis. */
export function isTruncated(text: string): boolean {
  return text.trimEnd().endsWith('…')
}

/* ---------------- times ---------------- */

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const STEP = 5 * MIN

/** The offset of an ISO string in minutes east of UTC (Z is 0), or null without one. */
export function offsetMinutes(iso: string): number | null {
  if (/Z$/i.test(iso)) return 0
  const m = /([+-])(\d{2}):?(\d{2})$/.exec(iso)
  if (!m) return null
  const v = Number(m[2]) * 60 + Number(m[3])
  return m[1] === '-' ? -v : v
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** A moment as ISO 8601 at a given offset, e.g. "2026-10-13T12:35:00-04:00". */
export function isoAtOffset(ms: number, offsetMin: number): string {
  const d = new Date(ms + offsetMin * MIN)
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

/** Local midnight starting `date` ("YYYY-MM-DD") at an offset, in ms. */
function midnight(date: string, offsetMin: number): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d) - offsetMin * MIN
}

/** "YYYY-MM-DD" one calendar day after `date`. */
function nextDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + 1))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Where a type sits in its span: the middle of the tracker's part of the waking day, or null. */
const TYPE_POSITION: Record<string, number> = { breakfast: 0.15, lunch: 0.45, dinner: 0.725 }
const LATE_WAKE_HOUR = 18
const SPAN_LO = 0.05
const SPAN_HI = 0.95

/**
 * Fractions of a span (0..1) for meals in id order: Breakfast, Lunch and Dinner at their parts'
 * middles (never earlier than a meal before them), the others spread evenly between neighbours.
 */
export function spanPositions(types: (string | undefined)[]): number[] {
  const pos: (number | null)[] = types.map((t) => TYPE_POSITION[(t ?? '').trim().toLowerCase()] ?? null)
  let floor = SPAN_LO
  for (let i = 0; i < pos.length; i++) {
    const p = pos[i]
    if (p !== null) {
      pos[i] = Math.max(p, floor)
      floor = pos[i] as number
    }
  }
  const out: number[] = []
  let i = 0
  while (i < pos.length) {
    if (pos[i] !== null) {
      out.push(pos[i] as number)
      i++
      continue
    }
    let j = i
    while (j < pos.length && pos[j] === null) j++
    const lo = i === 0 ? SPAN_LO : out[i - 1]
    const hi = j < pos.length ? (pos[j] as number) : SPAN_HI
    const n = j - i
    for (let k = 1; k <= n; k++) out.push(lo + ((Math.max(hi, lo) - lo) * k) / (n + 1))
    i = j
  }
  return out
}

/**
 * Times for meals in a span [from, to), in order: placed by spanPositions, rounded to 5 minutes,
 * each at least 5 minutes after the one before, and before `to`. When the span is too short for
 * 5-minute steps, the steps shrink (1 minute, then evenly spread seconds) so every meal still
 * lands before `to`. `after` is a time the first meal must come after. Only a span with no room
 * at all (`to` not after `after`) can put a meal at or past `to`.
 */
export function placeInSpan(from: number, to: number, types: (string | undefined)[], after = Number.NEGATIVE_INFINITY): number[] {
  const n = types.length
  const len = Math.max(0, to - from)
  const room = to - Math.max(from, after)
  const step =
    room >= STEP * (n + 1)
      ? STEP
      : room >= MIN * (n + 1)
        ? MIN
        : Math.max(SEC, Math.floor(Math.max(0, room) / (n + 1) / SEC) * SEC)
  const out: number[] = []
  let prev = Math.max(after, from - step)
  spanPositions(types).forEach((p, k) => {
    let t = Math.round((from + p * len) / step) * step
    if (t < prev + step) t = prev + step
    // Leave room for the meals still to come, each a step apart, before `to`.
    const cap = to - (n - k) * step
    if (t > cap) t = Math.max(prev + step, cap)
    out.push(t)
    prev = t
  })
  return out
}

/* ---------------- the conversion ---------------- */

export interface TrackerReport {
  meals: number
  nights: number
  /** Distinct meal dates. */
  days: number
  /** The earliest and latest dates ("YYYY-MM-DD") among the meals and sleep; null with neither. */
  first: string | null
  last: string | null
  /** Meals counted as UNTAGGED (no source recorded). */
  untagged: number
  /** Meals whose text the tracker stored cut short. */
  truncated: number
  /** Meals whose time HowSure placed (all of them: the tracker keeps no eating time). */
  approximateTimes: number
  /** Meals whose typical error came from the tracker's acc. */
  ownErrors: number
  /** Meal dates with no sleep record, and the date they join (null: before the first wake). */
  joined: { date: string; joinedTo: string | null }[]
  /**
   * Wake dates whose bed time didn't fit between the wake before it and its own wake: worked out
   * from the record (wake minus hours), or left out.
   */
  bedDerived: string[]
  bedSkipped: string[]
  /** Meal dates woken at 6 PM or later whose meals partly show on the next calendar date. */
  lateWakeDates: string[]
  /** Meal dates whose meals fall after the export (or the device's now): kept on their own date. */
  afterExportDates: string[]
  /** Meal records left out: no usable date, or a field that isn't the kind it should be. */
  skippedMeals: number
  unreadableMeals: number
  /** Sleep records left out: no usable wake time (missing, unreadable or without its offset), or a wake time another record already has. */
  skippedNights: number
  repeatedWakes: number
  /** Sleep records left out because another record has the same wake date (the later-written one is kept). */
  repeatedDates: number
  /** Weigh-ins imported into the weight log, how many of them have a placed (approximate) time, and how many were left out. */
  weighins: number
  weighinsApproximate: number
  weighinsSkipped: number
  /** Not imported. */
  pending: number
  syncSkipped: boolean
  targets: { kcal?: number; protein?: number } | null
}

export type TrackerConvert =
  | { ok: true; doc: LogDoc; report: TrackerReport }
  | { ok: false; problem: 'trackerVersion' | 'trackerUnreadable'; detail: string }

interface SleepOut {
  record: SleepRecord
  date: string
  wakeMs: number
  /** The bed time used (null when not logged). */
  bedMs: number | null
  offset: number
}

function recordMeta(r: TrackerRecord): Record<string, unknown> {
  const meta: Record<string, unknown> = { id: r.id }
  if (r.version !== undefined) meta.version = r.version
  if (r.updatedAt !== undefined) meta.updatedAt = r.updatedAt
  return meta
}

function numericId(id: string): number {
  const n = Number(id.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

function convertSleeps(records: TrackerRecord[], report: TrackerReport): SleepOut[] {
  const read: { r: TrackerRecord; date: string; wake: string; wakeMs: number; bed: string | null; hours: number | null; saved?: string }[] = []
  for (const r of records) {
    const parsed = sleepDataSchema.safeParse(r.data)
    if (!parsed.success) {
      report.skippedNights++
      continue
    }
    const d = parsed.data
    const wakeMs = Date.parse(d.wake)
    const date = isCalendarDate(d.date) ? d.date : isCalendarDate(r.id) ? r.id : null
    if (!hasOffset(d.wake) || Number.isNaN(wakeMs) || date === null) {
      report.skippedNights++
      continue
    }
    const bed = typeof d.bed === 'string' && hasOffset(d.bed) && !Number.isNaN(Date.parse(d.bed)) ? d.bed : null
    read.push({ r, date, wake: d.wake, wakeMs, bed, hours: toNum(d.hours), saved: d.saved })
  }
  // One night per wake date (the tracker keys its nights by date): when a file has two records for
  // one date, the one written last is kept (latest updatedAt, then saved, then later in the file),
  // and the other is reported, never merged.
  const written = (x: (typeof read)[number]) => [x.r.updatedAt ?? '', x.saved ?? ''].map((v) => (hasOffset(v) ? Date.parse(v) : Number.NEGATIVE_INFINITY))
  const byWakeDate = new Map<string, (typeof read)[number]>()
  for (const s of read) {
    const kept = byWakeDate.get(s.date)
    if (kept === undefined) {
      byWakeDate.set(s.date, s)
      continue
    }
    report.repeatedDates++
    const [ku, ks] = written(kept)
    const [su, ss] = written(s)
    if (su > ku || (su === ku && ss >= ks)) byWakeDate.set(s.date, s)
  }
  read.splice(0, read.length, ...byWakeDate.values())
  read.sort((a, b) => a.wakeMs - b.wakeMs || (a.r.id < b.r.id ? -1 : 1))

  const out: SleepOut[] = []
  const usedIds = new Set<string>()
  for (const s of read) {
    const prev = out[out.length - 1]
    if (prev && s.wakeMs <= prev.wakeMs) {
      // Two wakes at the same moment: one night can't be two records.
      report.repeatedWakes++
      continue
    }
    const offset = offsetMinutes(s.wake) ?? 0
    const prevWake = prev ? prev.wakeMs : Number.NEGATIVE_INFINITY
    let bedMs = s.bed === null ? null : Date.parse(s.bed)
    let sleepStart = s.bed
    const extra: Record<string, unknown> = {}
    if (bedMs !== null && (bedMs <= prevWake || bedMs >= s.wakeMs)) {
      // The bed time overlaps the night before, or isn't before its own wake. Never invented: use
      // wake minus hours asleep when that fits, else leave the bed time out.
      const derived = s.hours !== null && s.hours > 0 && s.hours < 24 ? s.wakeMs - Math.round(s.hours * 60) * MIN : null
      if (derived !== null && derived > prevWake && derived < s.wakeMs) {
        bedMs = derived
        sleepStart = isoAtOffset(derived, offset)
        extra.bedDerived = 'wake minus hours'
        report.bedDerived.push(s.date)
      } else {
        extra.bedSkipped = bedMs >= s.wakeMs ? 'not before its wake' : 'overlaps the night before'
        bedMs = null
        sleepStart = null
        report.bedSkipped.push(s.date)
      }
    }
    let id = `tracker-sleep-${s.r.id}`
    for (let n = 2; usedIds.has(id); n++) id = `tracker-sleep-${s.r.id}-${n}`
    usedIds.add(id)
    const imported: ImportedFields = { from: 'tracker', ...recordMeta(s.r), data: s.r.data, ...extra }
    out.push({ record: { id, sleepStart, wake: s.wake, imported }, date: s.date, wakeMs: s.wakeMs, bedMs, offset })
  }
  return out
}

interface MealIn {
  r: TrackerRecord
  date: string
  type?: string
  text: string
  saved?: string
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

/* What the import kept on an imported meal, read back for meal details. */
export interface TrackerMealInfo {
  /** The code the meal counts under, and the code as written when it differs (an unlisted one). */
  code: TrackerCode
  written: string | null
  type: string | null
  date: string | null
  untagged: boolean
  truncated: boolean
  /** The date it shows under when its own date had no sleep record (null: before the first wake). */
  joinedTo: string | null | undefined
  /**
   * The typical error the tracker's acc gives this meal (errorFromAcc), or null when it had no
   * usable figure. The meal keeps it as Meal.typicalError until its calories or source change, so
   * the details can say which of the two is why HowSure's figure for the source applies.
   */
  trackerError: number | null
}

/** The tracker fields kept on an imported meal, or null for a meal that didn't come from a tracker bundle. */
export function trackerMealInfo(meal: Pick<Meal, 'imported'>): TrackerMealInfo | null {
  const imp = meal.imported
  if (!imp || imp.from !== 'tracker') return null
  const data = typeof imp.data === 'object' && imp.data !== null ? (imp.data as Record<string, unknown>) : {}
  const tag = typeof imp.tag === 'object' && imp.tag !== null ? (imp.tag as Record<string, unknown>) : null
  const code = typeof imp.code === 'string' && isTrackerCode(imp.code) ? imp.code : 'UNTAGGED'
  const src = tag && typeof tag.src === 'string' ? tag.src : null
  return {
    code,
    written: src !== null && src !== code ? src : null,
    type: typeof data.type === 'string' && data.type.trim() !== '' ? data.type.trim() : null,
    date: typeof data.date === 'string' ? data.date : null,
    untagged: imp.untagged === true,
    truncated: imp.truncated === true,
    joinedTo: typeof imp.joinedTo === 'string' || imp.joinedTo === null ? (imp.joinedTo as string | null) : undefined,
    trackerError: errorFromAcc(code, tag?.acc)?.e ?? null,
  }
}

function readMeals(records: TrackerRecord[], report: TrackerReport): MealIn[] {
  const out: MealIn[] = []
  for (const r of records) {
    const data = r.data as Record<string, unknown>
    if (!isCalendarDate(data.date)) {
      report.skippedMeals++
      continue
    }
    const parsed = mealDataSchema.safeParse(data)
    if (!parsed.success) {
      report.unreadableMeals++
      continue
    }
    const d = parsed.data
    out.push({
      r,
      date: d.date,
      type: d.type,
      text: d.text ?? '',
      saved: d.saved,
      kcal: toNum(d.kcal),
      protein: toNum(d.protein),
      carbs: toNum(d.carbs),
      fat: toNum(d.fat),
    })
  }
  // By date, then the tracker's own order within a day: numeric id.
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : numericId(a.r.id) - numericId(b.r.id)))
}

function toMeal(m: MealIn, id: string, eatenAt: string, joinedTo: string | null | undefined, fallbackName: string, report: TrackerReport): Meal {
  const { tag, description } = parseTrackerText(m.text)
  const code = trackerCode(tag)
  const truncated = isTruncated(m.text)
  const own = errorFromAcc(code, tag?.acc)
  if (code === 'UNTAGGED') report.untagged++
  if (truncated) report.truncated++
  if (own) report.ownErrors++
  // The record's data as it was (type, text, id, saved, ...), the tag as read, and what the
  // import decided, under one key so nothing is lost.
  const imported: ImportedFields = { from: 'tracker', ...recordMeta(m.r), data: m.r.data, code }
  if (tag) imported.tag = tag
  if (code === 'UNTAGGED') imported.untagged = true
  if (truncated) imported.truncated = true
  if (own?.floored) imported.errorFloored = true
  if (joinedTo !== undefined) imported.joinedTo = joinedTo
  const meal: Meal = {
    id,
    name: shortMealName(description, m.type, fallbackName),
    eatenAt,
    source: TRACKER_SOURCES[code].kind,
    kcal: m.kcal,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    timeApproximate: true,
    imported,
  }
  if (description !== '') meal.note = description
  if (own) meal.typicalError = own.e
  return meal
}

/** Read a tracker bundle (already parsed from JSON) into a HowSure log of kind 'mine', with a report for the preview. */
export function convertTrackerBundle(json: unknown, options: TrackerOptions = {}): TrackerConvert {
  const parsed = bundleSchema.safeParse(json)
  if (!parsed.success) {
    if (looksLikeTrackerBundle(json)) {
      const v = (json as { formatVersion?: unknown }).formatVersion
      if (typeof v === 'number' && v !== TRACKER_FORMAT_VERSION) {
        return { ok: false, problem: 'trackerVersion', detail: `format version ${v}` }
      }
    }
    const first = parsed.error.issues[0]
    return { ok: false, problem: 'trackerUnreadable', detail: first ? `${first.path.join('.')}: ${first.message}` : 'invalid' }
  }
  const b = parsed.data
  if (b.formatVersion !== TRACKER_FORMAT_VERSION) {
    return { ok: false, problem: 'trackerVersion', detail: `format version ${b.formatVersion}` }
  }

  const report: TrackerReport = {
    meals: 0,
    nights: 0,
    days: 0,
    first: null,
    last: null,
    untagged: 0,
    truncated: 0,
    approximateTimes: 0,
    ownErrors: 0,
    joined: [],
    bedDerived: [],
    bedSkipped: [],
    lateWakeDates: [],
    afterExportDates: [],
    skippedMeals: 0,
    unreadableMeals: 0,
    skippedNights: 0,
    repeatedWakes: 0,
    repeatedDates: 0,
    weighins: 0,
    weighinsApproximate: 0,
    weighinsSkipped: 0,
    pending: b.pending?.length ?? 0,
    syncSkipped: (b.settings ?? []).some((s) => s.id === 'sync'),
    targets: null,
  }

  const sleeps = convertSleeps(b.sleep, report)
  const byDate = new Map<string, number>() // sleep date -> index in sleeps
  sleeps.forEach((s, i) => byDate.set(s.date, i))
  const mealsIn = readMeals(b.meals, report)

  // Group each meal date under the sleep date whose waking day it falls in: its own, or the
  // latest earlier one when it has none (joined), or none at all (before the first wake).
  const dates = [...new Set(mealsIn.map((m) => m.date))].sort()
  const groups = new Map<number, string[]>() // sleep index (-1: before the first wake) -> meal dates
  const joinedTo = new Map<string, string | null>()
  for (const date of dates) {
    let idx = byDate.get(date)
    if (idx === undefined) {
      idx = -1
      for (let i = 0; i < sleeps.length; i++) if (sleeps[i].date < date) idx = i
      const to = idx === -1 ? null : sleeps[idx].date
      joinedTo.set(date, to)
      report.joined.push({ date, joinedTo: to })
    }
    const list = groups.get(idx) ?? []
    list.push(date)
    groups.set(idx, list)
  }

  const mealsByDate = new Map<string, MealIn[]>()
  for (const m of mealsIn) {
    const list = mealsByDate.get(m.date) ?? []
    list.push(m)
    mealsByDate.set(m.date, list)
  }

  // No meal is placed after the export was made, nor after the device's now.
  const limits = [b.exportedAt, options.nowIso].map((v) => (v !== undefined && hasOffset(v) ? Date.parse(v) : Number.NaN))
  const endLimit = Math.min(...limits.map((v) => (Number.isFinite(v) ? v : Number.POSITIVE_INFINITY)))
  const usedIds = new Set<string>()
  const late = new Set<string>()
  const afterExport = new Set<string>()

  const meals: Meal[] = []
  for (const [idx, groupDates] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    const sleep = idx >= 0 ? sleeps[idx] : null
    const next = idx + 1 < sleeps.length ? sleeps[idx + 1] : null
    // The day can't run past the next night: its bed time, else its wake.
    const hardEnd = next ? (next.bedMs ?? next.wakeMs) : Number.POSITIVE_INFINITY
    const firstMeal = mealsByDate.get(groupDates[0])?.[0]
    const offset = sleep ? sleep.offset : (offsetMinutes(firstMeal?.saved ?? '') ?? offsetMinutes(next?.record.wake ?? '') ?? 0)
    let last = Number.NEGATIVE_INFINITY
    // A wake at or after 6 PM local time: its meals can land on the next calendar date, which the
    // preview lists (meals after midnight on an ordinary day aren't worth a note).
    const lateWake = sleep !== null && Number(isoAtOffset(sleep.wakeMs, sleep.offset).slice(11, 13)) >= LATE_WAKE_HOUR
    for (const date of groupDates) {
      const list = mealsByDate.get(date) ?? []
      let from: number
      let to: number
      if (sleep && date === sleep.date) {
        from = sleep.wakeMs
        // A waking day of normal length ends at the next bed time; a missing or far-off one
        // gives 16 hours. With later dates joined to it, its own meals stay on its own date.
        to = hardEnd - from <= DAY ? hardEnd : from + 16 * HOUR
        if (groupDates.length > 1) to = Math.min(to, midnight(nextDate(date), offset))
      } else {
        // A joined date (or one before the first wake): the daytime of its own calendar date.
        const dayFrom = midnight(date, offset)
        const dayTo = midnight(nextDate(date), offset)
        from = Math.max(dayFrom + 8 * HOUR, sleep ? sleep.wakeMs : Number.NEGATIVE_INFINITY, last)
        to = Math.min(dayTo, hardEnd)
        if (to - from < HOUR) from = Math.max(dayFrom, sleep ? sleep.wakeMs : Number.NEGATIVE_INFINITY, last)
      }
      if (endLimit > Math.max(from, last)) to = Math.min(to, endLimit)
      const times = placeInSpan(from, to, list.map((m) => m.type), last)
      // A date later than the export (or the device's now) can't be clamped to it without moving
      // its meals to another day, so they stay on their date and the preview names it.
      if (times.some((t) => t > endLimit)) afterExport.add(date)
      list.forEach((m, k) => {
        const eatenAt = isoAtOffset(times[k], offset)
        if (lateWake && !joinedTo.has(date) && eatenAt.slice(0, 10) > date) late.add(date)
        // Record ids are the tracker's document keys, so they are unique; a repeated one still
        // gets its own meal id, so Edit and Delete never reach two meals.
        let id = `tracker-${m.r.id}`
        for (let n = 2; usedIds.has(id); n++) id = `tracker-${m.r.id}-${n}`
        usedIds.add(id)
        const fallback = options.mealFallbackName ?? `#${m.r.id}`
        meals.push(toMeal(m, id, eatenAt, joinedTo.has(date) ? joinedTo.get(date) : undefined, fallback, report))
      })
      if (times.length > 0) last = times[times.length - 1]
    }
  }

  const targetsRecord = (b.settings ?? []).find((s) => s.id === 'targets')
  const targets: { kcal?: number; protein?: number } = {}
  if (targetsRecord) {
    const kcal = toNum(targetsRecord.data.kcal)
    const protein = toNum(targetsRecord.data.protein)
    if (kcal !== null && kcal > 0) targets.kcal = kcal
    if (protein !== null && protein > 0) targets.protein = protein
  }
  report.targets = Object.keys(targets).length > 0 ? targets : null

  report.lateWakeDates = [...late].sort()
  report.afterExportDates = [...afterExport].sort()
  report.meals = meals.length
  report.approximateTimes = meals.filter((m) => m.timeApproximate).length
  report.nights = sleeps.length
  report.days = dates.length
  const allDates = [...dates, ...sleeps.map((s) => s.date)].sort()
  report.first = allDates[0] ?? null
  report.last = allDates[allDates.length - 1] ?? null

  // Weigh-ins go straight into the weight log; one with no recorded time is placed on its own
  // calendar date just after that date's wake, from the nights imported here.
  const weights = weighInsFromTracker(
    b.weighins ?? [],
    sleeps.map((s) => s.record.wake).filter((w): w is string => w !== null),
  )
  report.weighins = weights.weighIns.length
  report.weighinsApproximate = weights.weighIns.filter((w) => w.timeApproximate).length
  report.weighinsSkipped = weights.skipped.length

  const imported: ImportedFields = { from: 'tracker', format: TRACKER_FORMAT, formatVersion: b.formatVersion }
  if (b.exportedAt !== undefined) imported.exportedAt = b.exportedAt
  if (targetsRecord) imported.targets = targetsRecord

  const doc: LogDoc = {
    kind: 'mine',
    profile: report.targets ? { name: '', kind: 'guest', targets } : { name: '', kind: 'guest' },
    meals,
    sleeps: sleeps.map((s) => s.record),
    workouts: [],
    plates: [],
    imported,
  }
  if (weights.weighIns.length > 0) {
    doc.weighIns = weights.weighIns
    doc.settings = { weightUnit: 'lb' }
  }
  return { ok: true, doc, report }
}
