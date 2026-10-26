// spec.md > Screens > MealList.tsx: each row shows name, time, calories (or "unknown"),
// evidence source and estimate score, and no range (prd.md > Dashboard). Tapping the meal
// opens its details (prd.md > Meal Details, Edit and Delete); tapping its score opens the
// meal-score explanation (prd.md > Estimate Score and Explanations).

import { estimateMeal } from '../kernel/estimate'
import { getSource } from '../kernel/sources'
import type { Meal, MealSourceId } from '../kernel/types'
import { copy } from './copy'
import { fmtInt, fmtTime, fmtWeekday, fmtWeekdayTime } from './format'

interface MealListProps {
  meals: Meal[]
  dayStart: string | null
  onOpenScore: (mealId: string) => void
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

export function MealList({ meals, dayStart, onOpenScore, onOpenMeal }: MealListProps) {
  return (
    <section className="section" aria-labelledby="meals-title">
      <h2 className="section-title" id="meals-title">
        {copy.meals.title}
      </h2>
      <ul data-testid="meal-list">
        {meals.map((meal) => {
          const est = estimateMeal(meal)
          return (
            <li key={meal.id} className="meal-row" data-testid="meal-row" data-meal-id={meal.id}>
              <button type="button" className="meal-open" onClick={() => onOpenMeal(meal.id)} data-testid="meal-open">
                <span className="meal-name">{meal.name}</span>
                <span className="meal-meta num">
                  {copy.meals.meta(mealTimeLabel(meal, dayStart), mealSourceLabel(meal.source))}
                </span>
              </button>
              <div className="meal-right">
                {meal.kcal === null ? (
                  <p className="meal-kcal unknown">{copy.meals.unknownKcal}</p>
                ) : (
                  <p className="meal-kcal num">{copy.units.kcalValue(fmtInt(meal.kcal))}</p>
                )}
                <p className="meal-score num">
                  {est ? (
                    <button
                      type="button"
                      className="link-btn"
                      aria-label={copy.meals.rowScoreLabel(String(est.score), meal.name)}
                      onClick={() => onOpenScore(meal.id)}
                      data-testid="meal-score"
                    >
                      {copy.meals.rowScore(String(est.score))}
                    </button>
                  ) : (
                    <span className="small">{copy.meals.noScore}</span>
                  )}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
