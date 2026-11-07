// Eaten's detail (build-out item 2.5a, slice 10; prd.md > Workouts and Net Calories: "consumed →
// meals → the meal breakdown"). Opened from Eaten under the net headline: calories eaten with its
// estimate score and both ranges (each opening its explanation, as on the dashboard), then the
// day's meals, each opening its breakdown (MealDetails). The same numbers as the headline: they
// come from the day view.
// Build-out item 2.9: also the detail behind the calories-eaten headline in every look, so it shows
// the daily calorie target with the best estimate's share of it (the Panel ring's "95% of 2,400"),
// and each meal row's score opens its explanation in one tap, as on the dashboard.

import { copy } from './copy'
import type { DayView } from './dayView'
import { fmtAmount, fmtInt, fmtRange } from './format'
import { ringValueOf, type HeadlineOpen } from './headlineView'
import { MealList } from './MealList'
import { Sheet } from './Sheet'
import { ringFill } from './targetRing'

/** The meal list's heading id here, apart from the dashboard's list under the sheet. */
const HEADING_ID = 'eaten-meals-title'

interface EatenSheetProps {
  view: DayView
  today: boolean
  demo: boolean
  onClose: () => void
  onOpen: (mode: HeadlineOpen) => void
  onOpenMeal: (mealId: string) => void
  /** Opens a meal's score explanation (build-out item 2.9). */
  onOpenScore: (mealId: string) => void
  /** The daily calorie target, when one is set, and the targets editor. */
  targetKcal?: number
  onOpenTargets: () => void
}

export function EatenSheet({ view, today, demo, onClose, onOpen, onOpenMeal, onOpenScore, targetKcal, onOpenTargets }: EatenSheetProps) {
  const { day, meals } = view
  const known = day.status === 'complete' || day.status === 'partial'
  // The same share the Panel ring states: the best estimate against the target, on a complete day only.
  const share = ringFill(ringValueOf(day), targetKcal)
  return (
    <Sheet
      title={today ? copy.eaten.title : copy.eaten.titleEarlierDay}
      sub={
        day.status === 'partial' ? copy.eaten.subKnownOnly(fmtInt(day.knownTotal)) : day.status === 'complete' ? copy.eaten.sub(meals.length) : undefined
      }
      demo={demo}
      onClose={onClose}
      testId="eaten-sheet"
    >
      <div className="details-head">
        <p className={known ? 'big-figure num' : 'details-unknown-title'} data-testid="eaten-total">
          {known ? copy.units.kcalValue(fmtInt(day.knownTotal)) : copy.headline.notAvailable}
        </p>
        {day.score !== null ? (
          <button type="button" className="btn score-btn num" onClick={() => onOpen({ mode: 'day' })} data-testid="eaten-score">
            {copy.headline.estimateScore(String(day.score))}
          </button>
        ) : (
          <p className="score-na">{copy.headline.estimateScoreNotAvailable}</p>
        )}
      </div>

      {day.status === 'partial' && (
        <p className="day-status">
          <span className="status-pill">{copy.headline.incompleteDay}</span>
          <span className="status-count">{copy.headline.unknownCount(day.unknownMealIds.length)}</span>
        </p>
      )}

      {day.likely && day.veryLikely && (
        <button type="button" className="range-summary" onClick={() => onOpen({ mode: 'ranges' })} data-testid="eaten-ranges">
          <span className="range-legend num">
            <span className="range-row" data-testid="eaten-likely">
              <span className="range-name">{copy.headline.likely}</span>
              <span className="range-value">{fmtRange(day.likely)}</span>
            </span>
            <span className="range-row" data-testid="eaten-very-likely">
              <span className="range-name">{copy.headline.veryLikely}</span>
              <span className="range-value">{fmtRange(day.veryLikely)}</span>
            </span>
          </span>
        </button>
      )}

      {targetKcal !== undefined && (
        <div className="eaten-target" data-testid="eaten-target">
          <ul className="fact-list">
            <li>
              <span className="k">{copy.eaten.targetLabel}</span>
              <span className="num nowrap">{copy.units.kcalValue(fmtAmount(targetKcal))}</span>
            </li>
          </ul>
          {share ? (
            <p data-testid="eaten-target-share">
              {copy.eaten.targetShare(fmtInt(share.pct))}
            </p>
          ) : day.status === 'partial' ? (
            <p className="small" data-testid="eaten-target-share">
              {copy.eaten.targetShareKnownOnly}
            </p>
          ) : null}
          <p>
            <button type="button" className="btn btn-quiet" onClick={onOpenTargets} data-testid="eaten-targets">
              {copy.eaten.changeTarget}
            </button>
          </p>
        </div>
      )}

      {meals.length > 0 ? (
        <div data-testid="eaten-meals">
          <p className="field-hint">{copy.eaten.intro}</p>
          <MealList
            meals={meals}
            dayStart={view.dayStart}
            onOpenMeal={onOpenMeal}
            onOpenScore={onOpenScore}
            biggestId={view.biggest?.id ?? null}
            headingId={HEADING_ID}
          />
        </div>
      ) : (
        <p className="small">{copy.eaten.none}</p>
      )}
    </Sheet>
  )
}
