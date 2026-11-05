// spec.md > Screens > HeadlineEstimate.tsx: the calorie headline, both ranges and the
// tappable estimate score (prd.md > Dashboard). The number dominates.
// prd.md > Days With Unknown Calories and > States and Boundaries: a partly known day shows
// the known subtotal labelled "Known meals only — incomplete day" with the unknown count; a day
// with no known calories (every meal unknown, or nothing logged) says "Not available yet" for
// calories, ranges and score, never a zero or a perfect score. A typed 0 is known, so a day of
// 0 kcal meals shows 0 kcal, with ranges and score not available (there is nothing to divide by).
// A daily calorie target, when set, is a plain line beside the score (build-out item 1.3): no
// verdict and no room-left sum, which come with their own slices.
//
// Build-out item 1.5.2, Journal look: the score is a small pill beside the target, and the two
// ranges are one labelled range bar (very likely outer, likely inner, a marker for the best
// estimate and one for the target) with a text legend that keeps every number as text. The bar
// is drawn for the eye only (aria-hidden); screen readers and tests read the legend. The bar is
// drawn only for a complete day: on an incomplete day the ranges cover the known meals only, so
// a bar would look surer than the day is, and the legend says why there is none.

import type { DayEstimate } from '../kernel/types'
import { copy } from './copy'
import type { ExplainMode } from './ExplainSheet'
import { fmtAmount, fmtInt, fmtRange } from './format'
import { rangeBarGeometry } from './rangeBar'

interface HeadlineEstimateProps {
  day: DayEstimate
  onOpen: (mode: ExplainMode) => void
  /** False on an earlier waking day (prd.md > Previous Days), so the label doesn't say "today". */
  today?: boolean
  /** The daily calorie target, when one is set (build-out item 1.3). */
  targetKcal?: number
}

export function HeadlineEstimate({ day, onOpen, today = true, targetKcal }: HeadlineEstimateProps) {
  const hasKnown = day.status === 'complete' || day.status === 'partial'
  const partial = day.status === 'partial'
  const unknownCount = day.unknownMealIds.length
  const na = copy.headline.notAvailable
  const label = today ? copy.headline.label : copy.headline.labelEarlierDay
  const bar = day.status === 'complete' ? rangeBarGeometry(day.knownTotal, day.likely, day.veryLikely, targetKcal) : null

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

      <div className="headline-meta">
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

        {targetKcal !== undefined && (
          <p className="headline-target num" data-testid="headline-target">
            {copy.targets.headline(fmtAmount(targetKcal))}
          </p>
        )}
      </div>

      {day.likely && day.veryLikely ? (
        // One tap target for the bar and its legend: it opens the range explanation.
        <button type="button" className="range-summary" onClick={() => onOpen({ mode: 'ranges' })} data-testid="ranges">
          {bar && (
            <span className="range-bar" aria-hidden="true" data-testid="range-bar">
              <span className="range-track" />
              <span
                className="range-band very-likely-band"
                style={{ left: `${bar.veryLikely.left}%`, width: `${bar.veryLikely.width}%` }}
              />
              <span className="range-band likely-band" style={{ left: `${bar.likely.left}%`, width: `${bar.likely.width}%` }} />
              {bar.target !== null && <span className="range-target" style={{ left: `${bar.target}%` }} />}
              <span className="range-best" style={{ left: `${bar.best}%` }} />
            </span>
          )}
          <span className="range-legend num">
            <span className="range-row" data-testid="likely-range">
              <span className="range-name">
                {bar && <span className="range-swatch likely-band" aria-hidden="true" />}
                {copy.headline.likely}
              </span>
              <span className="range-value">{fmtRange(day.likely)}</span>
            </span>
            <span className="range-row" data-testid="very-likely-range">
              <span className="range-name">
                {bar && <span className="range-swatch very-likely-band" aria-hidden="true" />}
                {copy.headline.veryLikely}
              </span>
              <span className="range-value">{fmtRange(day.veryLikely)}</span>
            </span>
            {bar && (
              <span className="range-row" data-testid="best-estimate">
                <span className="range-name">
                  <span className="range-swatch range-best" aria-hidden="true" />
                  {copy.headline.bestEstimate}
                </span>
                <span className="range-value">{copy.units.kcalValue(fmtInt(day.knownTotal))}</span>
              </span>
            )}
            {bar && bar.target !== null && targetKcal !== undefined && (
              <span className="range-row" data-testid="range-target">
                <span className="range-name">
                  <span className="range-swatch range-target" aria-hidden="true" />
                  {copy.headline.target}
                </span>
                <span className="range-value">{copy.units.kcalValue(fmtAmount(targetKcal))}</span>
              </span>
            )}
          </span>
          {partial && (
            <span className="range-note" data-testid="ranges-known-only">
              {copy.headline.rangesKnownOnly}
            </span>
          )}
        </button>
      ) : (
        <div className="range-legend na" data-testid="ranges-na">
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
    </section>
  )
}
