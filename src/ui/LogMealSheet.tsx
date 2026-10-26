// spec.md > Screens > LogMealSheet.tsx: new (slice 3), edit and improve modes (slice 2).
// Fields in the prd.md > Logging a Meal order: name, how you know, calories, date and time
// (with the waking day the meal will belong to), then optional details, collapsed at first for
// a new meal. In improve mode the sheet highlights the evidence source, the meal's note (its
// assumptions) and what would improve it. Edit and improve show a before/after preview of the
// meal and the day. Nothing changes until Save (prd.md > Improve That Entry).

import { useId, useMemo, useState } from 'react'
import { estimateMeal, suggestedSource } from '../kernel/estimate'
import { wakingDayStart } from '../kernel/sleepday'
import { getSource, LOG_SOURCE_IDS } from '../kernel/sources'
import type { DayEstimate, Meal, MealSourceId } from '../kernel/types'
import type { LogDoc } from '../store/log'
import { copy } from './copy'
import { checkDraft, draftFromMeal, fromLocalInput, previewEdit, type EditPreview, type MealDraft } from './editMeal'
import { fmtInt, fmtPct, fmtRangeEnds, fmtTime, fmtWeekday } from './format'
import { Sheet } from './Sheet'
import { BasisTag } from './SourceBasis'

export type MealSheetMode = 'new' | 'edit' | 'improve'

interface LogMealSheetProps {
  mode: MealSheetMode
  /** The meal to edit, or for a new meal its blank starting point (editMeal.ts blankMeal()). */
  meal: Meal
  doc: LogDoc
  /** The active log's now: the preview reads the same waking day the dashboard shows. */
  at: string
  /** The waking day on screen (null = provisional), so a new meal timed elsewhere can say so. */
  viewDayStart?: string | null
  demo: boolean
  onSave: (meal: Meal) => void
  onClose: () => void
}

/** The "How do you know?" choices: the Tier 1 list, plus the meal's own source if it isn't in it. */
function sourceOptions(current: MealSourceId | null): MealSourceId[] {
  const ids = [...LOG_SOURCE_IDS]
  if (current && !ids.includes(current)) ids.push(current)
  return ids
}

export function LogMealSheet({ mode, meal, doc, at, viewDayStart, demo, onSave, onClose }: LogMealSheetProps) {
  const formId = useId()
  const [initial] = useState<MealDraft>(() => draftFromMeal(meal))
  const [draft, setDraft] = useState<MealDraft>(initial)
  const [nameTouched, setNameTouched] = useState(false)
  const check = useMemo(() => checkDraft(draft, meal), [draft, meal])
  const isNew = mode === 'new'
  const improving = mode === 'improve'
  const preview = useMemo(
    () => (!isNew && check.meal ? previewEdit(doc, at, check.meal) : null),
    [isNew, check.meal, doc, at],
  )
  // What would improve it, from the meal as saved (spec.md > improve(): computed, never hard-coded).
  const suggestedTo = suggestedSource(meal)
  const original = meal.source === null ? null : getSource(meal.source)
  const originalPct = original ? fmtPct(estimateMeal(meal)?.e ?? original.typicalError) : ''
  // A new meal starts with a blank name: say it is needed once the field is left, or once
  // something else is filled in, so a fresh sheet doesn't open on an error.
  const changed = (Object.keys(initial) as (keyof MealDraft)[]).some((k) => k !== 'name' && draft[k] !== initial[k])
  const showNameError = Boolean(check.errors.name) && (!isNew || nameTouched || changed)
  // Optional details start collapsed for a new meal (prd.md > Logging a Meal). Improve opens them
  // for the label's macros; Edit opens them when the meal already has some.
  const detailsOpen =
    improving || (mode === 'edit' && (meal.protein !== null || meal.carbs !== null || meal.fat !== null || Boolean(meal.note)))

  function set<K extends keyof MealDraft>(key: K, value: MealDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const ids = {
    name: `${formId}-name`,
    kcal: `${formId}-kcal`,
    when: `${formId}-when`,
    protein: `${formId}-protein`,
    carbs: `${formId}-carbs`,
    fat: `${formId}-fat`,
    note: `${formId}-note`,
  }

  const eatenIso = fromLocalInput(draft.eatenAtLocal)
  const dayOfTime = eatenIso ? wakingDayStart(doc.sleeps, eatenIso) : null
  const selected = draft.source ? getSource(draft.source) : null

  return (
    <Sheet
      title={
        isNew
          ? copy.logMeal.titleNew
          : improving
            ? copy.logMeal.titleImprove(meal.name)
            : copy.logMeal.titleEdit(meal.name)
      }
      demo={demo}
      onClose={onClose}
      testId="log-meal-sheet"
      footer={
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose} data-testid="cancel-meal">
            {copy.logMeal.cancel}
          </button>
          <button
            type="submit"
            form={formId}
            className="btn btn-primary"
            disabled={check.meal === null}
            data-testid="save-meal"
          >
            {copy.logMeal.save}
          </button>
        </div>
      }
    >
      {improving && original && (
        <div className="callout amber improve-callout" data-testid="improve-callout">
          <h3 className="section-title">{copy.logMeal.improveTitle}</h3>
          <p className="num">
            {copy.logMeal.currentSource(original.label, originalPct)}{' '}
            <BasisTag source={original} />
          </p>
          {suggestedTo && (
            <p className="num" data-testid="improve-suggestion">
              {copy.explainMeal.improveLine(
                getSource(suggestedTo).label,
                originalPct,
                fmtPct(getSource(suggestedTo).typicalError),
              )}
            </p>
          )}
          {meal.note && (
            <p className="improve-note" data-testid="improve-note">
              <span className="k">{copy.logMeal.yourNote}: </span>
              {meal.note}
            </p>
          )}
        </div>
      )}

      <form
        id={formId}
        className="meal-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (check.meal) onSave(check.meal)
        }}
      >
        <div className="field">
          <label htmlFor={ids.name}>{copy.logMeal.name}</label>
          <input
            id={ids.name}
            type="text"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            onBlur={() => setNameTouched(true)}
            aria-invalid={showNameError ? true : undefined}
            data-testid="meal-name-input"
          />
          {showNameError && (
            <p className="field-error" data-testid="name-error">
              {check.errors.name}
            </p>
          )}
        </div>

        <fieldset className={improving ? 'field source-field highlight' : 'field source-field'}>
          <legend>{copy.logMeal.howKnow}</legend>
          <div className="source-options">
            {sourceOptions(draft.source).map((id) => {
              const s = getSource(id)
              const isSuggested = improving && suggestedTo === id
              return (
                <label key={id} className={draft.source === id ? 'source-option checked' : 'source-option'}>
                  <input
                    type="radio"
                    name={`${formId}-source`}
                    value={id}
                    checked={draft.source === id}
                    onChange={() => set('source', id)}
                    data-testid={`source-${id}`}
                  />
                  <span className="source-label">
                    {s.label}
                    {isSuggested && (
                      <>
                        {' '}
                        <span className="suggested-tag">{copy.logMeal.suggested}</span>
                      </>
                    )}
                  </span>
                  <span className="source-error num">{copy.logMeal.optionError(fmtPct(s.typicalError))}</span>
                </label>
              )
            })}
          </div>
          {selected?.hint && <p className="field-hint">{selected.hint}</p>}
          {check.errors.source && (
            <p className="field-error" data-testid="source-hint">
              {check.errors.source}
            </p>
          )}
        </fieldset>

        <div className="field">
          <label htmlFor={ids.kcal}>{copy.logMeal.calories}</label>
          <input
            id={ids.kcal}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="num"
            value={draft.kcal}
            onChange={(e) => set('kcal', e.target.value)}
            aria-invalid={check.errors.kcal ? true : undefined}
            aria-describedby={`${ids.kcal}-hint`}
            data-testid="meal-kcal-input"
          />
          <p className="field-hint" id={`${ids.kcal}-hint`}>
            {copy.logMeal.caloriesHint}
          </p>
          {check.errors.kcal && (
            <p className="field-error" data-testid="kcal-error">
              {check.errors.kcal}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor={ids.when}>{copy.logMeal.dateTime}</label>
          <input
            id={ids.when}
            type="datetime-local"
            className="num"
            value={draft.eatenAtLocal}
            onChange={(e) => set('eatenAtLocal', e.target.value)}
            aria-invalid={check.errors.eatenAt ? true : undefined}
            data-testid="meal-when-input"
          />
          {eatenIso && (
            <p className="field-hint num" data-testid="meal-waking-day">
              {dayOfTime
                ? copy.logMeal.wakingDay(copy.header.awakeSince(fmtWeekday(dayOfTime), fmtTime(dayOfTime)))
                : copy.logMeal.provisionalDay}
            </p>
          )}
          {isNew && eatenIso && viewDayStart !== undefined && dayOfTime !== viewDayStart && (
            <p className="field-hint" data-testid="meal-other-day">
              {copy.logMeal.otherDay}
            </p>
          )}
          {check.errors.eatenAt && <p className="field-error">{check.errors.eatenAt}</p>}
        </div>

        <details className="optional-details" open={detailsOpen || undefined} data-testid="optional-details">
          <summary>{copy.logMeal.optionalDetails}</summary>
          <div className="macro-inputs">
            {(['protein', 'carbs', 'fat'] as const).map((k) => (
              <div className="field" key={k}>
                <label htmlFor={ids[k]}>{copy.logMeal[k]}</label>
                <input
                  id={ids[k]}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="num"
                  value={draft[k]}
                  onChange={(e) => set(k, e.target.value)}
                  aria-invalid={check.errors[k] ? true : undefined}
                  data-testid={`meal-${k}-input`}
                />
                {check.errors[k] && <p className="field-error">{check.errors[k]}</p>}
              </div>
            ))}
          </div>
          <div className="field">
            <label htmlFor={ids.note}>{copy.logMeal.note}</label>
            <textarea
              id={ids.note}
              rows={2}
              value={draft.note}
              onChange={(e) => set('note', e.target.value)}
              data-testid="meal-note-input"
            />
          </div>
        </details>
      </form>

      {!isNew && <EditPreviewTable meal={meal} preview={preview} edited={check.meal} doc={doc} at={at} />}
    </Sheet>
  )
}

/* ---------------- before/after preview ---------------- */

/** The day's known total, as the headline shows it: a typed 0 is known, no known meal is "Not available yet". */
function dayKcal(day: DayEstimate): string {
  return day.status === 'complete' || day.status === 'partial' ? fmtInt(day.knownTotal) : copy.preview.notAvailable
}

function dayRange(day: DayEstimate, which: 'likely' | 'veryLikely'): string {
  const r = day[which]
  if (!r) return copy.preview.notAvailable
  const { lo, hi } = fmtRangeEnds(r)
  return copy.headline.rangeValue(lo, hi)
}

function dayScore(day: DayEstimate): string {
  return day.score === null ? copy.preview.notAvailable : String(day.score)
}

function mealCells(m: Meal | null) {
  const est = m ? estimateMeal(m) : null
  return {
    kcal: m === null ? copy.preview.pending : m.kcal === null ? copy.preview.unknown : fmtInt(m.kcal),
    error: m === null ? copy.preview.pending : est ? copy.units.percent(fmtPct(est.e)) : copy.preview.unknown,
    score: m === null ? copy.preview.pending : est ? String(est.score) : copy.preview.unknown,
  }
}

interface PreviewProps {
  meal: Meal
  edited: Meal | null
  preview: EditPreview | null
  doc: LogDoc
  at: string
}

function EditPreviewTable({ meal, edited, preview, doc, at }: PreviewProps) {
  const titleId = useId()
  // The "before" side never depends on the draft, so it shows even while a field is invalid.
  const before = useMemo(() => preview?.before ?? previewEdit(doc, at, meal).before, [preview, doc, at, meal])
  const after = preview?.after ?? null
  const b = mealCells(meal)
  const a = mealCells(edited)
  const pending = copy.preview.pending

  const rows: { key: string; label: string; before: string; after: string; testId?: string }[] = [
    { key: 'm-kcal', label: copy.preview.calories, before: b.kcal, after: a.kcal, testId: 'preview-meal-kcal' },
    { key: 'm-err', label: copy.preview.typicalError, before: b.error, after: a.error, testId: 'preview-meal-error' },
    { key: 'm-score', label: copy.preview.score, before: b.score, after: a.score, testId: 'preview-meal-score' },
  ]
  const afterKnownOnly = after?.day.status === 'partial'
  const dayRows: typeof rows = [
    {
      key: 'd-kcal',
      label: afterKnownOnly || before.day.status === 'partial' ? copy.preview.caloriesKnownOnly : copy.preview.calories,
      before: dayKcal(before.day),
      after: after ? dayKcal(after.day) : pending,
      testId: 'preview-day-kcal',
    },
    {
      key: 'd-likely',
      label: copy.preview.likely,
      before: dayRange(before.day, 'likely'),
      after: after ? dayRange(after.day, 'likely') : pending,
      testId: 'preview-likely',
    },
    {
      key: 'd-vlikely',
      label: copy.preview.veryLikely,
      before: dayRange(before.day, 'veryLikely'),
      after: after ? dayRange(after.day, 'veryLikely') : pending,
      testId: 'preview-very-likely',
    },
    {
      key: 'd-score',
      label: copy.preview.score,
      before: dayScore(before.day),
      after: after ? dayScore(after.day) : pending,
      testId: 'preview-day-score',
    },
  ]

  function renderRow(r: (typeof rows)[number]) {
    const changed = r.after !== pending && r.after !== r.before
    return (
      <tr key={r.key}>
        <th scope="row">{r.label}</th>
        <td>{r.before}</td>
        <td className={changed ? 'after changed' : 'after'} data-testid={r.testId}>
          {r.after}
        </td>
      </tr>
    )
  }

  return (
    <section className="edit-preview" aria-labelledby={titleId} data-testid="edit-preview">
      <h3 className="section-title" id={titleId}>
        {copy.preview.title}
      </h3>
      <table className="preview-table num">
        <thead>
          <tr>
            <td />
            <th scope="col">{copy.preview.before}</th>
            <th scope="col">{copy.preview.after}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="group">
            <th scope="rowgroup" colSpan={3}>
              {copy.preview.thisMeal}
            </th>
          </tr>
          {rows.map(renderRow)}
          <tr className="group">
            <th scope="rowgroup" colSpan={3}>
              {copy.preview.theDay}
            </th>
          </tr>
          {dayRows.map(renderRow)}
        </tbody>
      </table>
      {!edited && <p className="field-hint">{copy.preview.waiting}</p>}
      {preview && !preview.stillOnThisDay && <p className="field-hint">{copy.preview.leavesDay}</p>}
      {preview?.after.biggest && (
        <p className="preview-biggest" data-testid="preview-biggest">
          {afterKnownOnly
            ? copy.preview.biggestAfterKnownOnly(preview.after.biggest.name)
            : copy.preview.biggestAfter(preview.after.biggest.name)}
          {preview.after.improvement === null && <> {copy.preview.biggestAfterAlreadyBest}</>}
        </p>
      )}
      <p className="field-hint">{copy.preview.appliesOnSave}</p>
    </section>
  )
}
