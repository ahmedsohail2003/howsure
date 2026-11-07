// spec.md > Screens > MealDetails.tsx and prd.md > Meal Details, Edit and Delete: a meal's
// breakdown (calories and macros, evidence source, assumptions or note, its estimate score and
// both ranges, what would improve it), with Edit and Delete. A meal with unknown calories gets
// no invented number: it says so, and points at what would let HowSure count it.
// Build-out item 2.3: Save as a usual meal, with a name, so it can be logged again from the top of
// Log a meal. Once saved (same name and values), the details say so instead of offering it again.
// Build-out item 2.9: the foods stored on the meal (meals.foods) and its lookup (meals.lookup),
// saved before but shown nowhere, are listed under "Foods in this meal" with their amounts, and
// with where the meal's values come from: the meal's own source (mealFoods.ts).

import { useId, useLayoutEffect, useRef, useState } from 'react'
import { estimateMeal, improve } from '../kernel/estimate'
import { getSource } from '../kernel/sources'
import type { Meal } from '../kernel/types'
import type { SavedMeal } from '../store/log'
import { copy } from './copy'
import type { DayView } from './dayView'
import { fmtInt, fmtPct, fmtRange } from './format'
import { foodRows, lookupView } from './mealFoods'
import { mealSourceLabel, mealTimeLabel } from './mealLabels'
import { Sheet } from './Sheet'
import { BasisTag } from './SourceBasis'
import { checkSavedName, nameKey, savedEarlier, savedMatch } from './usualMeals'

interface MealDetailsProps {
  meal: Meal
  /** The waking day the meal is on: what would improve it is worked out against this day. */
  view: DayView
  demo: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenScore: () => void
  /** The log's saved meals (build-out item 2.3), to name a match and refuse a taken name. */
  saved: SavedMeal[]
  /**
   * Saves this meal as usual under a checked name, or with `updateId` updates the saved meal saved
   * from it before it was edited. The sheet stays open and says it was saved.
   */
  onSaveUsual: (name: string, updateId?: string) => void
  /** Opens the Saved meals sheet. */
  onManageSaved: () => void
}

function amount(v: number | null): string {
  return v === null ? copy.details.unknown : copy.units.gramsValue(fmtInt(v))
}

export function MealDetails(props: MealDetailsProps) {
  const { meal, view, demo, onClose, onEdit, onDelete, onOpenScore } = props
  const [confirming, setConfirming] = useState(false)
  // While the Save as a usual meal name form is open, its own Cancel and Save are the sheet's
  // actions: Edit and Delete leave the footer, so two filled buttons are never stacked.
  const [naming, setNaming] = useState(false)
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
      footer={naming ? undefined : footer}
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

      <MealFoods meal={meal} />

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

      <SaveUsual
        meal={meal}
        saved={props.saved}
        onSave={props.onSaveUsual}
        onManage={props.onManageSaved}
        onFormOpen={setNaming}
      />
    </Sheet>
  )
}

/**
 * The foods stored on the meal and its lookup, or nothing when it has neither. With no foods, the
 * section is the lookup alone and is named so. A lookup the meal's source no longer uses (after an
 * edit of "How do you know?") says so (mealFoods.ts > lookupView).
 */
function MealFoods({ meal }: { meal: Meal }) {
  const foods = foodRows(meal)
  const lookup = lookupView(meal)
  if (foods.length === 0 && lookup === null) return null
  const lookupOnly = foods.length === 0
  return (
    <section className="meal-foods" aria-labelledby="meal-foods-title" data-testid="meal-foods">
      <h3 className="section-title" id="meal-foods-title">
        {lookupOnly ? copy.foods.lookupTitle : copy.foods.title}
      </h3>
      {foods.length > 0 && (
        <ul className="fact-list" data-testid="meal-foods-list">
          {foods.map((f, i) => (
            <li key={i} data-testid="meal-food">
              <span className="food-name">{f.name}</span>
              <span className="food-amount">
                <span className="num nowrap" data-testid="meal-food-amount">
                  {f.amount}
                </span>
                {f.fiber && <span className="food-fiber small num">{f.fiber}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {lookup && (
        <div className="meal-lookup" data-testid="meal-lookup">
          {!lookupOnly && <p className="k">{copy.foods.lookupTitle}</p>}
          {/* Each part stays on one line with the dot after it, so a line never starts with " · ". */}
          <p className="small" data-testid="meal-lookup-parts">
            {lookup.parts.map((part, i) => (
              <span key={i}>
                <span className="nowrap">
                  {part}
                  {i < lookup.parts.length - 1 && copy.sep.trimEnd()}
                </span>
                {i < lookup.parts.length - 1 && ' '}
              </span>
            ))}
          </p>
          {lookup.credit && <p className="small">{lookup.credit}</p>}
          {lookup.unused && (
            // A change of state, not more of the lookup: set apart in a callout, with words that say so.
            <p className="callout amber small meal-lookup-unused" data-testid="meal-lookup-unused">
              {lookup.unused}
            </p>
          )}
        </div>
      )}
      {foods.length > 0 && (
        <p className="small" data-testid="meal-foods-note">
          {meal.source === null ? copy.foods.noteNoSource : copy.foods.note(mealSourceLabel(meal.source))}
          {foods.some((f) => f.fiber !== null) && ` ${copy.foods.fiberNote}`}
          {` ${copy.foods.keptNote}`}
        </p>
      )}
    </section>
  )
}

interface SaveUsualProps {
  meal: Meal
  saved: SavedMeal[]
  onSave: (name: string, updateId?: string) => void
  onManage: () => void
  /** Told when the name form opens and closes. */
  onFormOpen: (open: boolean) => void
}

/** Save as a usual meal: a button, then a name field (the meal's name to start with) and Save. */
function SaveUsual({ meal, saved, onSave, onManage, onFormOpen }: SaveUsualProps) {
  const ids = useId()
  const [name, setName] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  // The name it was saved under in this sheet: shown even when it differs from the meal's own.
  const [savedName, setSavedName] = useState<string | null>(null)
  // "updated" when saving under the earlier saved meal's name replaced its values.
  const [savedHow, setSavedHow] = useState<'saved' | 'updated'>('saved')
  const match = savedMatch(meal, saved)
  const earlier = savedEarlier(meal, saved)
  const done = savedName ?? match?.name ?? null
  const doneRef = useRef<HTMLParagraphElement>(null)
  const openRef = useRef<HTMLButtonElement>(null)
  // When the form goes (saved, or cancelled), focus moves to what replaced it: the line that says
  // it was saved, or the button again. It stays inside the sheet, where Esc and Tab keep working.
  const refocus = useRef<'done' | 'open' | null>(null)
  useLayoutEffect(() => {
    const target = refocus.current
    if (!target) return
    refocus.current = null
    ;(target === 'done' ? doneRef.current : openRef.current)?.focus()
  })
  // Typed as the earlier saved meal's name, Save updates that one, so its name is not "taken".
  const updating = earlier !== undefined && name !== null && nameKey(name) === nameKey(earlier.name)
  const error = name === null ? null : checkSavedName(name, saved, updating ? earlier.id : undefined)
  // A taken name shows as it is typed; a blank one only after Save is tried.
  const showError = error !== null && name !== null && (tried || name.trim() !== '')

  if (done !== null) {
    return (
      <div className="save-usual" data-testid="save-usual">
        <p className="save-usual-done" role="status" tabIndex={-1} ref={doneRef} data-testid="saved-as">
          {savedHow === 'updated' ? copy.usualMeals.updated(done) : copy.usualMeals.savedAs(done)}{' '}
          <button type="button" className="link-btn" onClick={onManage} data-testid="saved-as-manage">
            {copy.usualMeals.manage}
          </button>
        </p>
      </div>
    )
  }

  if (name === null) {
    return (
      <div className="save-usual" data-testid="save-usual">
        {earlier && (
          <p className="save-usual-earlier" data-testid="saved-earlier">
            {copy.usualMeals.savedEarlier(
              earlier.name,
              earlier.kcal === null ? copy.missing.unknownKcal : copy.quickLog.kcal(fmtInt(earlier.kcal)),
            )}
          </p>
        )}
        <button
          type="button"
          className="btn"
          ref={openRef}
          onClick={() => {
            setName(meal.name)
            onFormOpen(true)
          }}
          data-testid="save-usual-open"
        >
          {copy.usualMeals.save}
        </button>
        <p className="field-hint">{copy.usualMeals.saveHint}</p>
      </div>
    )
  }

  return (
    <form
      className="save-usual meal-form"
      noValidate
      data-testid="save-usual"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (error !== null) return
        refocus.current = 'done'
        setSavedName(name.trim())
        setSavedHow(updating ? 'updated' : 'saved')
        onFormOpen(false)
        onSave(name.trim(), updating ? earlier.id : undefined)
      }}
    >
      <div className="field">
        <label htmlFor={`${ids}-name`}>{copy.usualMeals.nameLabel}</label>
        <input
          id={`${ids}-name`}
          type="text"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          aria-invalid={showError ? true : undefined}
          aria-describedby={showError ? `${ids}-error` : undefined}
          data-testid="save-usual-name"
        />
        {showError && (
          <p className="field-error" id={`${ids}-error`} data-testid="save-usual-error">
            {error}
          </p>
        )}
        {updating && !showError && (
          <p className="field-hint" data-testid="save-usual-updates">
            {copy.usualMeals.updates(earlier.name)}
          </p>
        )}
      </div>
      <div className="sheet-actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            refocus.current = 'open'
            setName(null)
            setTried(false)
            onFormOpen(false)
          }}
          data-testid="save-usual-cancel"
        >
          {copy.usualMeals.cancel}
        </button>
        <button type="submit" className="btn btn-primary" data-testid="save-usual-confirm">
          {copy.usualMeals.confirm}
        </button>
      </div>
    </form>
  )
}
