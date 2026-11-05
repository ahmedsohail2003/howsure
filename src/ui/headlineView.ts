// What the headline shows, worked out once for every look (build-out item 2.5a, slice 10;
// prd.md > Workouts and Net Calories). Each look's headline draws these same numbers and words in
// its own way; none of them works anything out itself.
//
// - No workout on the day: the headline is calories eaten, as before (Tier 1).
// - At least one workout: the headline is net calories (eaten − burned), with its normal ranges
//   (they can run below 0), and eaten and burned under it as single numbers, each one tap from its
//   detail: eaten opens the meals, burned the workouts. Net's ranges open the net explanation.
// - The score under the headline stays the eaten score, labelled "Eaten: estimate score N" once net
//   is the headline. Net has no score.
// - The daily calorie target is a target for eating, so it is always compared with eaten: the
//   Panel ring keeps showing eaten against it, and Journal's range bar, which shows net once net is
//   the headline, leaves the target marker off (headline words say what the target compares with).
// - Unknown is never 0: a meal or workout with unknown calories is left out and counted in words.
// Pure: no React.

import type { Range } from '../kernel/types'
import { copy } from './copy'
import type { DayView } from './dayView'
import type { ExplainMode } from './ExplainSheet'
import { fmtInt, fmtRange, fmtRangeShort, fmtSigned, fmtSignedRange, fmtSignedRangeShort } from './format'

/** What a tap on the headline can open: an explanation, or the eaten or burned detail. */
export type HeadlineOpen = ExplainMode | { mode: 'eaten' } | { mode: 'workouts' }

export interface SideFigure {
  /** The known total, or null when not available or unknown. */
  value: number | null
  /** "2,280 kcal", "unknown" or "not available yet". */
  text: string
  /** The button's accessible name, which says what it opens. */
  label: string
}

export interface HeadlineView {
  /** True when the day has a workout, so the headline is net calories. */
  net: boolean
  label: string
  /** The headline number; null shows "Not available yet". */
  value: number | null
  /** The number as shown ("2,280", "−140"). Empty when value is null. */
  valueText: string
  /** The known-meals-only (or known-entries-only) wording applies. */
  knownOnly: boolean
  /** The pill and the unknown counts under the number; null when there is nothing to say. */
  status: { pill: string | null; counts: { kind: 'meals' | 'workouts'; text: string }[] } | null
  likely: Range | null
  veryLikely: Range | null
  /** "1,870–2,780 kcal" (or a net range, which may run below 0). */
  likelyText: string | null
  veryLikelyText: string | null
  /**
   * The ranges without the unit, for Night's one-line ranges: "1,870–2,780", or "−140 to 3,140"
   * once an end is below 0 (an en dash after a minus sign is hard to read).
   */
  likelyShort: string | null
  veryLikelyShort: string | null
  /** The ranges cover known entries only; null when they don't. Long form for Journal, short for Panel and Night. */
  rangesNote: { long: string; short: string } | null
  /** What the ranges open. */
  explain: HeadlineOpen
  /** Journal's range bar: drawn for a complete day only, so it never looks surer than the day is. */
  bar: boolean
  /** Whether a calorie target may be marked on the bar: only when the bar is in eaten calories. */
  barTarget: boolean
  /** The eaten score under the headline, and its label. */
  score: number | null
  scoreText: string
  eaten: SideFigure
  burned: SideFigure
  /** What the Panel ring compares with the target: eaten, and only on a complete day. */
  ringValue: number | null
}

function hasKnown(status: string): boolean {
  return status === 'complete' || status === 'partial'
}

export function headlineView(view: DayView, today = true): HeadlineView {
  const { day, burned, net } = view
  const isNet = view.workouts.length > 0
  const eatenKnown = hasKnown(day.status)
  const unknownMeals = day.unknownMealIds.length
  const unknownWorkouts = burned.unknownWorkoutIds.length

  const eatenText = eatenKnown ? copy.net.value(fmtInt(day.knownTotal)) : day.status === 'all-unknown' ? copy.net.unknown : copy.net.notAvailable
  const burnedText = hasKnown(burned.status) ? copy.net.value(fmtInt(burned.knownTotal)) : copy.net.unknown
  const eaten: SideFigure = { value: eatenKnown ? day.knownTotal : null, text: eatenText, label: copy.net.eatenOpen(eatenText) }
  const burnedFig: SideFigure = {
    value: hasKnown(burned.status) ? burned.knownTotal : null,
    text: burnedText,
    label: copy.net.burnedOpen(burnedText),
  }
  const score = day.score
  const ringValue = day.status === 'complete' ? day.knownTotal : null

  if (!isNet) {
    const partial = day.status === 'partial'
    return {
      net: false,
      label: partial ? copy.headline.labelKnownOnly : today ? copy.headline.label : copy.headline.labelEarlierDay,
      value: eatenKnown ? day.knownTotal : null,
      valueText: eatenKnown ? fmtInt(day.knownTotal) : '',
      knownOnly: partial,
      status:
        partial || day.status === 'all-unknown'
          ? { pill: partial ? copy.headline.incompleteDay : null, counts: [{ kind: 'meals', text: copy.headline.unknownCount(unknownMeals) }] }
          : null,
      likely: day.likely,
      veryLikely: day.veryLikely,
      likelyText: day.likely ? fmtRange(day.likely) : null,
      veryLikelyText: day.veryLikely ? fmtRange(day.veryLikely) : null,
      likelyShort: day.likely ? fmtRangeShort(day.likely) : null,
      veryLikelyShort: day.veryLikely ? fmtRangeShort(day.veryLikely) : null,
      rangesNote: partial ? { long: copy.headline.rangesKnownOnly, short: copy.headline.rangesKnownOnlyShort } : null,
      explain: { mode: 'ranges' },
      bar: day.status === 'complete',
      barTarget: true,
      score,
      scoreText: score !== null ? copy.headline.estimateScore(String(score)) : copy.headline.estimateScoreNotAvailable,
      eaten,
      burned: burnedFig,
      ringValue,
    }
  }

  const knownOnly = net !== null ? net.knownOnly : false
  const counts: { kind: 'meals' | 'workouts'; text: string }[] = [
    ...(unknownMeals > 0 ? [{ kind: 'meals' as const, text: copy.headline.unknownCount(unknownMeals) }] : []),
    ...(unknownWorkouts > 0 ? [{ kind: 'workouts' as const, text: copy.headline.unknownWorkouts(unknownWorkouts) }] : []),
  ]
  return {
    net: true,
    label: knownOnly ? copy.headline.netLabelKnownOnly : today ? copy.headline.netLabel : copy.headline.netLabelEarlierDay,
    value: net ? net.total : null,
    valueText: net ? fmtSigned(net.total) : '',
    knownOnly,
    status: counts.length > 0 ? { pill: knownOnly ? copy.headline.netKnownOnly : null, counts } : null,
    likely: net ? net.likely : null,
    veryLikely: net ? net.veryLikely : null,
    likelyText: net ? fmtSignedRange(net.likely) : null,
    veryLikelyText: net ? fmtSignedRange(net.veryLikely) : null,
    likelyShort: net ? fmtSignedRangeShort(net.likely) : null,
    veryLikelyShort: net ? fmtSignedRangeShort(net.veryLikely) : null,
    rangesNote: knownOnly ? { long: copy.headline.netRangesKnownOnly, short: copy.headline.netRangesKnownOnly } : null,
    explain: { mode: 'net' },
    bar: net !== null && !knownOnly,
    barTarget: false,
    score,
    scoreText: score !== null ? copy.headline.eatenScore(String(score)) : copy.headline.eatenScoreNotAvailable,
    eaten,
    burned: burnedFig,
    ringValue,
  }
}
