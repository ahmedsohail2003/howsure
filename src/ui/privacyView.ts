// Words for the Profile and privacy panel that depend on a log's contents (build-out item 1.2).
// Pure, so the unit tests check them without a browser. Words come from copy.ts.

import type { LogProblem } from '../store/session'
import type { LogSummary, OlderCopiesCount } from '../store/transfer'
import { copy } from './copy'
import { fmtDate } from './format'

/** "a", "a and b", "a, b and c". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} ${copy.privacy.and} ${items[items.length - 1]}`
}

/** Meals and nights always; workouts, plates and saved meals when there are any (later items). */
export function contentItems(s: LogSummary): string[] {
  const items = [copy.privacy.meals(s.meals), copy.privacy.nights(s.nights)]
  if (s.workouts > 0) items.push(copy.privacy.workouts(s.workouts))
  if (s.plates > 0) items.push(copy.privacy.plates(s.plates))
  if (s.savedMeals > 0) items.push(copy.privacy.savedMeals(s.savedMeals))
  return items
}

/** "6 meals and 3 nights of sleep". */
export function holdsText(s: LogSummary): string {
  return joinList(contentItems(s))
}

/** "From 2026-10-28 to 2026-11-03" in local dates, or the no-times line. */
export function spanText(s: LogSummary): string {
  if (s.first === null || s.last === null) return copy.privacy.noTimes
  return copy.privacy.span(fmtDate(s.first), fmtDate(s.last))
}

/** True when the log holds any meals, sleep, workouts, plates or saved meals. */
export function hasContent(s: LogSummary): boolean {
  return s.meals > 0 || s.nights > 0 || s.workouts > 0 || s.plates > 0 || s.savedMeals > 0
}

/**
 * What an Import replaces, for its preview. It names the guest name, targets and settings too,
 * as the Delete confirmation does, because an import replaces the whole log.
 */
export function replacesText(current: LogSummary): string {
  return hasContent(current) ? copy.privacy.previewReplaces(holdsText(current)) : copy.privacy.previewReplacesEmpty
}

/**
 * What Delete removes, item by item, for its confirmation.
 * - `onScreen`: what your own log on screen holds.
 * - `problem`: why its saved copy is left alone (store/session.ts). When this version can't read
 *   the saved copy, its contents can't be counted, and what is on screen was never saved.
 * - `older`: the older copies Delete removes too (store/transfer.ts > countOlderCopies).
 */
export function deleteItems(onScreen: LogSummary, problem: LogProblem | null, older: OlderCopiesCount): string[] {
  const items: string[] = []
  if (problem === 'unreadable' || problem === 'newer') {
    items.push(copy.privacy.confirmUnreadable)
    if (hasContent(onScreen)) items.push(copy.privacy.confirmUnsaved(holdsText(onScreen)))
  } else {
    items.push(...contentItems(onScreen), copy.privacy.confirmProfile)
    if (older.original) items.push(copy.privacy.confirmOriginal)
  }
  if (older.backups > 0) items.push(copy.privacy.confirmOlderCopies(older.backups))
  return items
}
