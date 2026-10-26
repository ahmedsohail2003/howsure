// spec.md > Screens > MealDetails.tsx and prd.md > Meal Details, Edit and Delete: a meal's
// breakdown (calories and macros, evidence source, assumptions or note, its estimate score and
// both ranges, what would improve it), with Edit and Delete. A meal with unknown calories gets
// no invented number: it says so, and points at what would let HowSure count it.

import { useState } from 'react'
import { estimateMeal, improve } from '../kernel/estimate'
import { getSource } from '../kernel/sources'
import type { Meal } from '../kernel/types'
import { copy } from './copy'
import type { DayView } from './dayView'
import { fmtInt, fmtPct, fmtRange } from './format'
import { mealSourceLabel, mealTimeLabel } from './MealList'
import { Sheet } from './Sheet'
import { BasisTag } from './SourceBasis'

interface MealDetailsProps {
  meal: Meal
  /** The waking day the meal is on: what would improve it is worked out against this day. */
  view: DayView
  demo: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenScore: () => void
}

function amount(v: number | null): string {
  return v === null ? copy.details.unknown : copy.units.gramsValue(fmtInt(v))
}

export function MealDetails({ meal, view, demo, onClose, onEdit, onDelete, onOpenScore }: MealDetailsProps) {
  const [confirming, setConfirming] = useState(false)
  const est = estimateMeal(meal)
  const source = meal.source === null ? null : getSource(meal.source)
  // Worked out on the meal's own day, the same way the explanation sheet does it.
  const imp = est ? improve(view.meals.some((m) => m.id === meal.id) ? view.meals : [meal], meal.id) : null

  const footer = confirming ? (
    <div className="delete-confirm" data-testid="delete-confirm">
      <p className="delete-confirm-text">{copy.details.confirmDelete(meal.name)}</p>
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={() => setConfirming(false)} data-testid="delete-keep">
          {copy.details.keep}
        </button>
        <button type="button" className="btn btn-ink" onClick={onDelete} data-testid="delete-confirm-btn">
          {copy.details.deleteConfirm}
        </button>
      </div>
    </div>
  ) : (
    <div className="sheet-actions split">
      <button type="button" className="btn btn-plain" onClick={() => setConfirming(true)} data-testid="delete-meal">
        {copy.details.delete}
      </button>
      <button type="button" className="btn btn-primary" onClick={onEdit} data-testid="edit-meal">
        {copy.details.edit}
      </button>
    </div>
  )

  return (
    <Sheet
      title={meal.name}
      sub={copy.explainMeal.sub(mealSourceLabel(meal.source), mealTimeLabel(meal, view.dayStart))}
      demo={demo}
      onClose={onClose}
      testId="meal-details"
      footer={footer}
    >
      {est && meal.kcal !== null ? (
        <div className="details-head">
          <p className="big-figure num" data-testid="details-kcal">
            {copy.units.kcalValue(fmtInt(meal.kcal))}
          </p>
          <button type="button" className="btn score-btn num" onClick={onOpenScore} data-testid="details-score">
            {copy.headline.estimateScore(String(est.score))}
          </button>
        </div>
      ) : (
        <div className="callout amber details-callout" data-testid="details-unknown">
          <p className="details-unknown-title" data-testid="details-kcal">
            {copy.details.caloriesUnknown}
          </p>
          <p>{copy.details.unknownNote}</p>
        </div>
      )}

      <ul className="fact-list details-facts num" data-testid="details-facts">
        {est && (
          <>
            <li data-testid="details-likely">
              <span className="k">{copy.headline.likely}</span>
              <span>{fmtRange(est.likely)}</span>
            </li>
            <li data-testid="details-very-likely">
              <span className="k">{copy.headline.veryLikely}</span>
              <span>{fmtRange(est.veryLikely)}</span>
            </li>
          </>
        )}
        {(['protein', 'carbs', 'fat'] as const).map((k) => (
          <li key={k} data-testid={`details-${k}`}>
            <span className="k">{copy.macros[k]}</span>
            <span className={meal[k] === null ? 'unknown' : undefined}>{amount(meal[k])}</span>
          </li>
        ))}
        <li data-testid="details-source">
          <span className="k">{copy.details.source}</span>
          {source ? (
            <span className="details-source">
              {copy.basis.sourceLine(source.label, fmtPct(est?.e ?? source.typicalError))} <BasisTag source={source} />
            </span>
          ) : (
            <span className="unknown">{copy.details.sourceNotPicked}</span>
          )}
        </li>
      </ul>

      <div>
        <h3 className="section-title">{copy.details.noteTitle}</h3>
        <p className={meal.note ? undefined : 'small'} data-testid="details-note">
          {meal.note || copy.details.noNote}
        </p>
      </div>

      <div className="callout details-callout" data-testid="details-improve">
        <h3 className="section-title">{copy.explainMeal.improveTitle}</h3>
        <p className="num">
          {!est
            ? copy.details.improveUnknown
            : imp
              ? copy.explainMeal.improveLine(getSource(imp.to).label, fmtPct(est.e), fmtPct(imp.newMealE))
              : copy.explainMeal.noBetter}
        </p>
      </div>
    </Sheet>
  )
}
