// spec.md > Screens > HeadlineEstimate.tsx: the calorie headline, both ranges and the
// tappable estimate score, in that order of emphasis (prd.md > Dashboard).
// prd.md > Days With Unknown Calories and > States and Boundaries: a partly known day shows
// the known subtotal labelled "Known meals only — incomplete day" with the unknown count; a day
// with no known calories (every meal unknown, or nothing logged) says "Not available yet" for
// calories, ranges and score, never a zero or a perfect score. A typed 0 is known, so a day of
// 0 kcal meals shows 0 kcal, with ranges and score not available (there is nothing to divide by).

import type { DayEstimate } from '../kernel/types'
import { copy } from './copy'
import type { ExplainMode } from './ExplainSheet'
import { fmtInt, fmtRange } from './format'

interface HeadlineEstimateProps {
  day: DayEstimate
  onOpen: (mode: ExplainMode) => void
  /** False on an earlier waking day (prd.md > Previous Days), so the label doesn't say "today". */
  today?: boolean
}

export function HeadlineEstimate({ day, onOpen, today = true }: HeadlineEstimateProps) {
  const hasKnown = day.status === 'complete' || day.status === 'partial'
  const partial = day.status === 'partial'
  const unknownCount = day.unknownMealIds.length
  const na = copy.headline.notAvailable
  const label = today ? copy.headline.label : copy.headline.labelEarlierDay

  return (
    <section className="headline" aria-label={label}>
      <p className="headline-label">{partial ? copy.headline.labelKnownOnly : label}</p>

      {hasKnown ? (
        <p className="headline-number num">
          <span data-testid="headline-kcal">{fmtInt(day.knownTotal)}</span>
          <span className="unit">{copy.units.kcal}</span>
        </p>
      ) : (
        <p className="headline-na" data-testid="headline-kcal">
          {na}
        </p>
      )}

      {(partial || day.status === 'all-unknown') && (
        <p className="day-status" data-testid="day-status">
          {partial && <span className="status-pill">{copy.headline.incompleteDay}</span>}
          <span className="status-count" data-testid="unknown-count">
            {copy.headline.unknownCount(unknownCount)}
          </span>
        </p>
      )}

      {day.likely && day.veryLikely ? (
        <div className="ranges">
          <button
            type="button"
            className="range-btn likely"
            onClick={() => onOpen({ mode: 'ranges' })}
            data-testid="likely-range"
          >
            <span className="range-name">{copy.headline.likely}</span>
            <span className="range-value num">{fmtRange(day.likely)}</span>
          </button>
          <button
            type="button"
            className="range-btn very-likely"
            onClick={() => onOpen({ mode: 'ranges' })}
            data-testid="very-likely-range"
          >
            <span className="range-name">{copy.headline.veryLikely}</span>
            <span className="range-value num">{fmtRange(day.veryLikely)}</span>
          </button>
        </div>
      ) : (
        <div className="ranges na" data-testid="ranges-na">
          <p className="range-row" data-testid="likely-range">
            <span className="range-name">{copy.headline.likely}</span>
            <span className="range-value">{na}</span>
          </p>
          <p className="range-row" data-testid="very-likely-range">
            <span className="range-name">{copy.headline.veryLikely}</span>
            <span className="range-value">{na}</span>
          </p>
        </div>
      )}

      {day.score !== null ? (
        <button
          type="button"
          className="btn score-btn num"
          onClick={() => onOpen({ mode: 'day' })}
          data-testid="day-score"
        >
          {copy.headline.estimateScore(String(day.score))}
        </button>
      ) : (
        <p className="score-na" data-testid="day-score-na">
          {copy.headline.estimateScoreNotAvailable}
        </p>
      )}
    </section>
  )
}
