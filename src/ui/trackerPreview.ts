// Build-out item 2.1b: the words of the Import preview for a tracker bundle, and of an imported
// meal's "From your tracker" details, built from what the conversion reported
// (src/import/trackerBundle.ts). Pure, so the unit tests check them without a browser; every look
// draws the same lines. Words come from copy.ts.

import { isCalendarDate, type TrackerMealInfo, type TrackerReport } from '../import/trackerBundle'
import { hasOwnError } from '../kernel/estimate'
import { wakingDayStart } from '../kernel/sleepday'
import type { Meal, SleepRecord, Source } from '../kernel/types'
import { copy } from './copy'
import { fmtCalendarDate, fmtInt, fmtPct } from './format'
import { joinList } from './privacyView'

export interface TrackerPreview {
  /** What the file becomes: meals on days, nights, the date range, targets. */
  becomes: string[]
  /** What the conversion did that the person should know before replacing their log. */
  notes: string[]
  /** Dates with no sleep record, each with the date it joins. */
  joined: string[]
}

/** `nowIso`: the device's now, so dates in this year leave the year out. */
export function trackerPreview(r: TrackerReport, nowIso?: string): TrackerPreview {
  const becomes = [copy.trackerImport.mealsOnDays(r.meals, r.days), copy.privacy.nights(r.nights)]
  if (r.weighins > 0) becomes.push(copy.privacy.weighIns(r.weighins))
  becomes.push(r.first === null || r.last === null ? copy.privacy.noTimes : copy.privacy.span(fmtCalendarDate(r.first, nowIso), fmtCalendarDate(r.last, nowIso)))
  if (r.targets) {
    const parts: string[] = []
    if (r.targets.kcal !== undefined) parts.push(copy.trackerImport.targetKcal(fmtInt(r.targets.kcal)))
    if (r.targets.protein !== undefined) parts.push(copy.trackerImport.targetProtein(fmtInt(r.targets.protein)))
    becomes.push(copy.trackerImport.targets(joinList(parts)))
  } else {
    becomes.push(copy.trackerImport.noTargets)
  }

  const notes: string[] = []
  if (r.approximateTimes > 0) notes.push(copy.trackerImport.approximate(r.approximateTimes))
  if (r.meals > 0) notes.push(copy.trackerImport.ownErrors(r.ownErrors, r.meals))
  if (r.untagged > 0) notes.push(copy.trackerImport.untagged(r.untagged))
  if (r.truncated > 0) notes.push(copy.trackerImport.truncated(r.truncated))
  if (r.bedDerived.length > 0) notes.push(copy.trackerImport.bedDerived(joinList(r.bedDerived.map((d) => fmtCalendarDate(d, nowIso)))))
  if (r.bedSkipped.length > 0) notes.push(copy.trackerImport.bedSkipped(joinList(r.bedSkipped.map((d) => fmtCalendarDate(d, nowIso)))))
  if (r.lateWakeDates.length > 0) notes.push(copy.trackerImport.lateWake(joinList(r.lateWakeDates.map((d) => fmtCalendarDate(d, nowIso)))))
  if (r.skippedMeals > 0) notes.push(copy.trackerImport.skippedMeals(r.skippedMeals))
  if (r.unreadableMeals > 0) notes.push(copy.trackerImport.unreadableMeals(r.unreadableMeals))
  if (r.skippedNights > 0) notes.push(copy.trackerImport.skippedNights(r.skippedNights))
  if (r.repeatedWakes > 0) notes.push(copy.trackerImport.repeatedWakes(r.repeatedWakes))
  if (r.repeatedDates > 0) notes.push(copy.trackerImport.repeatedDates(r.repeatedDates))
  if (r.afterExportDates.length > 0) notes.push(copy.trackerImport.afterExport(joinList(r.afterExportDates.map((d) => fmtCalendarDate(d, nowIso)))))
  const beforeFirst = r.joined.filter((j) => j.joinedTo === null).length
  if (beforeFirst > 1) notes.push(copy.trackerImport.beforeFirstWake(beforeFirst))
  if (r.weighinsApproximate > 0) notes.push(copy.trackerImport.weighinsApproximate(r.weighinsApproximate, r.weighins))
  if (r.weighinsSkipped > 0) notes.push(copy.trackerImport.weighinsSkipped(r.weighinsSkipped))
  const left: string[] = []
  if (r.pending > 0) left.push(copy.trackerImport.pending(r.pending))
  if (r.syncSkipped) left.push(copy.trackerImport.syncNotes)
  if (left.length > 0) notes.push(copy.trackerImport.notImported(joinList(left)))

  const joined = r.joined.map((j) =>
    j.joinedTo === null
      ? copy.trackerImport.joinedNone(fmtCalendarDate(j.date, nowIso))
      : copy.trackerImport.joinedLine(fmtCalendarDate(j.date, nowIso), fmtCalendarDate(j.joinedTo, nowIso)),
  )
  return { becomes, notes, joined }
}

/** The tracker's source for an imported meal, in words: its code's meaning, or the unlisted code as written. */
export function trackerSourceText(info: TrackerMealInfo): string {
  if (info.written !== null && info.code === 'UNTAGGED') return copy.trackerImport.unlistedCode(info.written)
  return copy.trackerImport.codes[info.code]
}

/**
 * Where an imported meal's typical error comes from, in its details: the tracker's own figure
 * (with HowSure's for the source beside it); HowSure's figure because the meal's calories or
 * source changed since the import (an edit, or Improve, drops the tracker's figure), with the
 * tracker's figure beside it; or HowSure's figure because the tracker had no usable one.
 */
export function trackerErrorLine(meal: Pick<Meal, 'typicalError'>, info: TrackerMealInfo, source: Source): string {
  if (hasOwnError(meal)) return copy.trackerImport.ownErrorLine(source.label, fmtPct(source.typicalError))
  if (info.trackerError !== null) return copy.trackerImport.changedErrorLine(fmtPct(info.trackerError))
  return copy.trackerImport.sourceErrorLine
}

/** The tracker date an imported night was filed under (its record's date, else its id), or null. */
function trackerSleepDate(r: SleepRecord): string | null {
  const imp = r.imported
  if (!imp || imp.from !== 'tracker') return null
  const data = imp.data as { date?: unknown } | undefined
  if (data && isCalendarDate(data.date)) return data.date
  return isCalendarDate(imp.id) ? (imp.id as string) : null
}

/**
 * The line about a joined date in an imported meal's details, or null when its date had a sleep
 * record. It says which waking day the meal shows on only while that is still true: once the meal
 * is moved by an edit, or a wake is added on its own date (so it is no longer on the day it was
 * joined to, or no longer before the first wake), only where the tracker filed it is said.
 */
export function trackerJoinedLine(meal: Pick<Meal, 'eatenAt'>, info: TrackerMealInfo, sleeps: SleepRecord[], nowIso?: string): string | null {
  if (info.joinedTo === undefined || info.date === null) return null
  const date = fmtCalendarDate(info.date, nowIso)
  const start = wakingDayStart(sleeps, meal.eatenAt)
  if (info.joinedTo === null) {
    return start === null ? copy.trackerImport.joinedNoneNote(date) : copy.trackerImport.filedNote(date)
  }
  const night = start === null ? undefined : sleeps.find((r) => r.wake === start)
  const still = night !== undefined && trackerSleepDate(night) === info.joinedTo
  return still ? copy.trackerImport.joinedNote(date, fmtCalendarDate(info.joinedTo, nowIso)) : copy.trackerImport.filedNote(date)
}
