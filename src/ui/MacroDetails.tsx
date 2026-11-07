// Build-out item 2.9: one macro's detail (protein, carbs or fat), opened from the macro row in every
// look. One sheet for every look; the numbers and words come from macroView.ts, worked out once:
// the day's known total (or "unknown", never 0), what a meal with no value means for it, that there
// is no range yet, the target, and each meal's own value with how you know it, each meal opening its
// details.

import type { MacroKey } from '../kernel/types'
import type { Profile } from '../store/log'
import { copy } from './copy'
import type { DayView } from './dayView'
import { buildMacroView } from './macroView'
import { Sheet } from './Sheet'

interface MacroDetailsProps {
  macro: MacroKey
  view: DayView
  targets: Profile['targets'] | undefined
  /** True when the current waking day is on screen. */
  today: boolean
  demo: boolean
  onClose: () => void
  onOpenMeal: (mealId: string) => void
  /** Opens the targets editor. */
  onOpenTargets: () => void
}

export function MacroDetails({ macro, view, targets, today, demo, onClose, onOpenMeal, onOpenTargets }: MacroDetailsProps) {
  const m = buildMacroView(view.meals, macro, targets, view.dayStart)
  const n = view.meals.length
  return (
    <Sheet
      title={copy.macroDetail.title(m.name)}
      sub={m.noMeals ? undefined : today ? copy.macroDetail.sub(n) : copy.macroDetail.subEarlierDay(n)}
      demo={demo}
      onClose={onClose}
      testId="macro-details"
    >
      <div className="details-head">
        {/* A value slot holds a number; "No meals logged" is a status, so it is plain text. */}
        <p
          className={m.noMeals ? 'details-status' : m.total.allUnknown ? 'details-unknown-title' : 'big-figure num'}
          data-testid="macro-detail-total"
        >
          {m.valueText}
        </p>
        {m.roundedText && (
          <p className="field-hint" data-testid="macro-detail-rounded">
            {m.roundedText}
          </p>
        )}
      </div>
      {m.missingText && (
        <div className="callout amber details-callout" data-testid="macro-detail-missing">
          {!m.total.allUnknown && <p className="details-unknown-title">{copy.macroDetail.knownOnly}</p>}
          <p>{m.missingText}</p>
        </div>
      )}

      <section className="macro-detail-block" aria-labelledby="macro-detail-meals">
        <h3 className="section-title" id="macro-detail-meals">
          {copy.macroDetail.mealsTitle}
        </h3>
        {!m.noMeals && <p className="field-hint">{copy.macroDetail.mealsIntro}</p>}
        {m.noMeals ? (
          <p className="small" data-testid="macro-detail-no-meals">
            {copy.macroDetail.noMealsLine}
          </p>
        ) : (
          <ul className="macro-meals" data-testid="macro-detail-meals">
            {m.rows.map((r) => (
              <li key={r.mealId} className="macro-meal" data-testid="macro-detail-meal" data-meal-id={r.mealId}>
                <button type="button" className="macro-meal-open" onClick={() => onOpenMeal(r.mealId)} aria-label={r.label}>
                  <span className="macro-meal-main">
                    <span className="meal-name">{r.name}</span>
                    <span className="meal-meta num">{r.meta}</span>
                  </span>
                  <span className="macro-meal-right">
                    <span className={r.grams === null ? 'macro-meal-value unknown' : 'macro-meal-value num'} data-testid="macro-detail-meal-value">
                      {r.valueText}
                    </span>
                    {r.shareText && (
                      <span className="macro-meal-share num" data-testid="macro-detail-meal-share">
                        {r.shareText}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="macro-detail-block" aria-labelledby="macro-detail-target">
        <h3 className="section-title" id="macro-detail-target">
          {copy.macroDetail.targetTitle}
        </h3>
        <p className={m.target !== undefined ? 'num' : undefined} data-testid="macro-detail-target">
          {m.targetText}
        </p>
        {m.targetShareText && (
          <p className={m.noMeals || m.total.allUnknown ? 'small' : undefined} data-testid="macro-detail-target-share">
            {m.targetShareText}
          </p>
        )}
        <p className="macro-detail-edit">
          <button type="button" className="btn btn-quiet" onClick={onOpenTargets} data-testid="macro-detail-targets">
            {m.target !== undefined ? copy.macroDetail.changeTargets : copy.macroDetail.setTargets}
          </button>
        </p>
      </section>

      <section className="macro-detail-block" aria-labelledby="macro-detail-range">
        <h3 className="section-title" id="macro-detail-range">
          {copy.macroDetail.rangeTitle}
        </h3>
        <p data-testid="macro-detail-range">{m.rangeText}</p>
        <h3 className="section-title macro-detail-sub">{copy.macroDetail.unknownsTitle}</h3>
        <p data-testid="macro-detail-unknowns">{m.unknownsText}</p>
      </section>
    </Sheet>
  )
}
