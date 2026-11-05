// spec.md > Screens > MealList.tsx: each row shows name, time, calories (or "unknown"),
// evidence source and estimate score, and no range (prd.md > Dashboard). Tapping the meal
// opens its details (prd.md > Meal Details, Edit and Delete), where its score opens the
// meal-score explanation (prd.md > Estimate Score and Explanations).
// Build-out item 1.5.2, Journal look: the whole row is one button with an accessible name that
// says everything on it, and the score is plain text ("Score 54"), not a link of its own.
// Build-out item 1.5.2b, Panel look: the same row with a thin score bar under the name and the
// score in words ("Estimate score 90"). Amber marks only the meal with the biggest uncertainty,
// always with those words beside it. The bar is drawn for the eye only; a meal with no score has
// no bar.

import { estimateMeal } from '../kernel/estimate'
import { getSource } from '../kernel/sources'
import type { Meal, MealSourceId } from '../kernel/types'
import { copy } from './copy'
import { fmtInt, fmtTime, fmtWeekdayTime, onLaterDate } from './format'
import { useLook } from './lookContext'

interface MealListProps {
  meals: Meal[]
  dayStart: string | null
  onOpenMeal: (mealId: string) => void
  /** The meal with the biggest uncertainty (Panel look marks it), or null. */
  biggestId?: string | null
  /** The heading's id: the Eaten sheet draws this list over the dashboard's, so it needs its own. */
  headingId?: string
}

/** The meal's time, with its weekday when it falls on a later calendar date than the day's wake. */
export function mealTimeLabel(meal: Meal, dayStart: string | null): string {
  if (onLaterDate(meal.eatenAt, dayStart)) return fmtWeekdayTime(meal.eatenAt)
  return fmtTime(meal.eatenAt)
}

/** The source's label, or "source not picked" for a meal saved with blank calories and no source. */
export function mealSourceLabel(source: MealSourceId | null): string {
  return source === null ? copy.meals.sourceNotPicked : getSource(source).label
}

export function MealList(props: MealListProps) {
  const { look } = useLook()
  if (look === 'panel') return <PanelMealList {...props} />
  const { meals, dayStart, onOpenMeal, headingId = 'meals-title' } = props
  return (
    <section className="section" aria-labelledby={headingId}>
      <h2 className="section-title" id={headingId}>
        {copy.meals.title}
      </h2>
      <ul data-testid="meal-list">
        {meals.map((meal) => {
          const est = estimateMeal(meal)
          const meta = copy.meals.meta(mealTimeLabel(meal, dayStart), mealSourceLabel(meal.source))
          const kcal = meal.kcal === null ? copy.meals.unknownKcal : copy.units.kcalValue(fmtInt(meal.kcal))
          const score = est ? copy.meals.rowScore(String(est.score)) : copy.meals.noScore
          return (
            <li key={meal.id} className="meal-row" data-testid="meal-row" data-meal-id={meal.id}>
              <button
                type="button"
                className="meal-open"
                onClick={() => onOpenMeal(meal.id)}
                aria-label={copy.meals.rowLabel(meal.name, meta, kcal, score)}
                data-testid="meal-open"
              >
                <span className="meal-main">
                  <span className="meal-name">{meal.name}</span>
                  <span className="meal-meta num">{meta}</span>
                </span>
                <span className="meal-right">
                  <span className={meal.kcal === null ? 'meal-kcal unknown' : 'meal-kcal num'}>{kcal}</span>
                  <span className={est ? 'meal-score num' : 'meal-score none'} data-testid="meal-score">
                    {est ? copy.meals.rowScoreShort(String(est.score)) : copy.meals.noScore}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function PanelMealList({ meals, dayStart, onOpenMeal, biggestId = null, headingId = 'meals-title' }: MealListProps) {
  return (
    <section className="section" aria-labelledby={headingId}>
      <h2 className="section-title" id={headingId}>
        {copy.meals.title}
      </h2>
      <ul data-testid="meal-list">
        {meals.map((meal) => {
          const est = estimateMeal(meal)
          const biggest = est !== null && meal.id === biggestId
          const meta = copy.meals.meta(mealTimeLabel(meal, dayStart), mealSourceLabel(meal.source))
          const kcal = meal.kcal === null ? copy.meals.unknownKcal : copy.units.kcalValue(fmtInt(meal.kcal))
          const score = est
            ? biggest
              ? copy.meals.rowScoreBiggest(String(est.score))
              : copy.meals.rowScore(String(est.score))
            : copy.meals.noScore
          return (
            <li key={meal.id} className="meal-row" data-testid="meal-row" data-meal-id={meal.id}>
              <button
                type="button"
                className="meal-open"
                onClick={() => onOpenMeal(meal.id)}
                aria-label={copy.meals.rowLabel(meal.name, meta, kcal, score)}
                data-testid="meal-open"
              >
                <span className="meal-name">{meal.name}</span>
                <span className={meal.kcal === null ? 'meal-kcal unknown' : 'meal-kcal num'}>{kcal}</span>
                {est && (
                  <span className="score-bar" aria-hidden="true" data-testid="score-bar">
                    <span className={biggest ? 'score-fill biggest' : 'score-fill'} style={{ width: `${est.score}%` }} />
                  </span>
                )}
                <span className="meal-sub">
                  <span className="meal-meta num">{meta}</span>
                  <span
                    className={est ? (biggest ? 'meal-score num biggest' : 'meal-score num') : 'meal-score none'}
                    data-testid="meal-score"
                  >
                    {score}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
