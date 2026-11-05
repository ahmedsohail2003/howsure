// spec.md > Screens > MealList.tsx: each row shows name, time, calories (or "unknown"),
// evidence source and estimate score, and no range (prd.md > Dashboard). Tapping the meal
// opens its details (prd.md > Meal Details, Edit and Delete), where its score opens the
// meal-score explanation (prd.md > Estimate Score and Explanations).
// Build-out item 1.5.2, Journal look: the whole row is one button with an accessible name that
// says everything on it, and the score is plain text ("Score 54"), not a link of its own.

import { estimateMeal } from '../kernel/estimate'
import { getSource } from '../kernel/sources'
import type { Meal, MealSourceId } from '../kernel/types'
import { copy } from './copy'
import { fmtInt, fmtTime, fmtWeekday, fmtWeekdayTime } from './format'

interface MealListProps {
  meals: Meal[]
  dayStart: string | null
  onOpenMeal: (mealId: string) => void
}

/** The meal's time, with its weekday when it falls on a later calendar date than the day's wake. */
export function mealTimeLabel(meal: Meal, dayStart: string | null): string {
  if (dayStart && fmtWeekday(meal.eatenAt) !== fmtWeekday(dayStart)) return fmtWeekdayTime(meal.eatenAt)
  return fmtTime(meal.eatenAt)
}

/** The source's label, or "source not picked" for a meal saved with blank calories and no source. */
export function mealSourceLabel(source: MealSourceId | null): string {
  return source === null ? copy.meals.sourceNotPicked : getSource(source).label
}

export function MealList({ meals, dayStart, onOpenMeal }: MealListProps) {
  return (
    <section className="section" aria-labelledby="meals-title">
      <h2 className="section-title" id="meals-title">
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
