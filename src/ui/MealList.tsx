// spec.md > Screens > MealList.tsx: each row shows name, time, calories (or "unknown"),
// evidence source and estimate score, and no range (prd.md > Dashboard). Tapping the meal
// opens its details (prd.md > Meal Details, Edit and Delete); tapping its score opens the
// meal-score explanation (prd.md > Estimate Score and Explanations).
// Build-out item 1.5.2, Journal look: the row's button has an accessible name that says
// everything on it.
// Build-out item 2.9: two targets per row, so the score is one tap from its explanation. The
// meal's name is a button whose tap layer (::after, theme.css > meal list) covers the whole row,
// so a tap anywhere on the row still opens the details; the score is a second button drawn above
// that layer. A meal with no score has no score button. Every number on the row carries
// data-opens, naming what a tap on it opens (tests/e2e/tap-through.spec.ts).
// Build-out item 1.5.2b, Panel look: the same row with a thin score bar under the name and the
// score in words ("Estimate score 90"). Amber marks only the meal with the biggest uncertainty,
// always with those words beside it. The bar is drawn for the eye only; a meal with no score has
// no bar.

import { estimateMeal } from '../kernel/estimate'
import type { Meal } from '../kernel/types'
import { copy } from './copy'
import { fmtInt } from './format'
import { useLook } from './lookContext'
import { mealSourceLabel, mealTimeLabel } from './mealLabels'

interface MealListProps {
  meals: Meal[]
  dayStart: string | null
  onOpenMeal: (mealId: string) => void
  /** Opens the meal's score explanation (build-out item 2.9). */
  onOpenScore: (mealId: string) => void
  /** The meal with the biggest uncertainty (Panel look marks it), or null. */
  biggestId?: string | null
  /** The heading's id: the Eaten sheet draws this list over the dashboard's, so it needs its own. */
  headingId?: string
}

export { mealSourceLabel, mealTimeLabel }

export function MealList(props: MealListProps) {
  const { look } = useLook()
  const panel = look === 'panel'
  const { meals, dayStart, onOpenMeal, onOpenScore, biggestId = null, headingId = 'meals-title' } = props
  return (
    <section className="section" aria-labelledby={headingId}>
      <h2 className="section-title" id={headingId}>
        {copy.meals.title}
      </h2>
      <ul data-testid="meal-list">
        {meals.map((meal) => {
          const est = estimateMeal(meal)
          // Panel marks the meal with the biggest uncertainty in words on its own row.
          const biggest = panel && est !== null && meal.id === biggestId
          const meta = copy.meals.meta(mealTimeLabel(meal, dayStart), mealSourceLabel(meal.source))
          const kcal = meal.kcal === null ? copy.meals.unknownKcal : copy.units.kcalValue(fmtInt(meal.kcal))
          const score = est
            ? biggest
              ? copy.meals.rowScoreBiggest(String(est.score))
              : copy.meals.rowScore(String(est.score))
            : copy.meals.noScore
          const open = (
            <button
              type="button"
              className="meal-name-btn"
              onClick={() => onOpenMeal(meal.id)}
              aria-label={copy.meals.rowLabel(meal.name, meta, kcal, score)}
              data-testid="meal-open"
              data-opens="meal-details"
            >
              <span className="meal-name">{meal.name}</span>
            </button>
          )
          const metaEl = (
            <span className="meal-meta num" data-opens="meal-details">
              {meta}
            </span>
          )
          const kcalEl = (
            <span className={meal.kcal === null ? 'meal-kcal unknown' : 'meal-kcal num'} data-opens="meal-details">
              {kcal}
            </span>
          )
          // Journal shows "Score 54"; Panel spells it out, with the biggest uncertainty in words.
          const shown = est ? (panel ? score : copy.meals.rowScoreShort(String(est.score))) : copy.meals.noScore
          const scoreEl = est ? (
            <button
              type="button"
              className={biggest ? 'meal-score meal-score-btn num biggest' : 'meal-score meal-score-btn num'}
              onClick={() => onOpenScore(meal.id)}
              aria-label={copy.meals.scoreLabel(score, meal.name)}
              data-testid="meal-score"
              data-opens="explain-meal"
            >
              {shown}
            </button>
          ) : (
            <span className="meal-score none" data-testid="meal-score">
              {shown}
            </span>
          )
          return (
            <li key={meal.id} className="meal-row" data-testid="meal-row" data-meal-id={meal.id}>
              <div className="meal-open meal-line">
                {panel ? (
                  <>
                    {open}
                    {kcalEl}
                    {est && (
                      <span className="score-bar" aria-hidden="true" data-testid="score-bar">
                        <span className={biggest ? 'score-fill biggest' : 'score-fill'} style={{ width: `${est.score}%` }} />
                      </span>
                    )}
                    <span className="meal-sub">
                      {metaEl}
                      {scoreEl}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="meal-main">
                      {open}
                      {metaEl}
                    </span>
                    <span className="meal-right">
                      {kcalEl}
                      {scoreEl}
                    </span>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
