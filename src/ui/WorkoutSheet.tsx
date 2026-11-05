// spec.md > Screens > WorkoutSheet.tsx (build-out item 2.5a, slice 10; prd.md > Workouts and Net
// Calories): Log a workout, and Edit. Fields: name, "How do you know?" (a device or watch estimate,
// a machine's display, or a rough guess, each with its typical error and marked "assumption", no
// default), calories burned, start date and time (with the waking day it will belong to), and
// duration. Blank calories and duration are unknown, never 0. Once calories and a source are in,
// a line shows that workout's likely and very likely ranges. Nothing changes until Save.

import { useId, useMemo, useState } from 'react'
import { BURN_SOURCE_IDS, estimateWorkout } from '../kernel/net'
import { parseAmount } from '../kernel/parse'
import { wakingDayStart } from '../kernel/sleepday'
import { getSource } from '../kernel/sources'
import type { SleepRecord, Workout } from '../kernel/types'
import { copy } from './copy'
import { fromLocalInput } from './editMeal'
import { checkWorkoutDraft, draftFromWorkout, type WorkoutDraft } from './editWorkout'
import { fmtPct, fmtRange, fmtTime, fmtWeekday } from './format'
import { Sheet } from './Sheet'
import { BasisTag } from './SourceBasis'

interface WorkoutSheetProps {
  mode: 'new' | 'edit'
  /** The workout to edit, or for a new one its blank starting point (editWorkout.ts blankWorkout()). */
  workout: Workout
  sleeps: SleepRecord[]
  /** The waking day on screen (null = provisional), so a workout timed elsewhere can say so. */
  viewDayStart: string | null
  demo: boolean
  onSave: (workout: Workout) => void
  onClose: () => void
}

export function WorkoutSheet({ mode, workout, sleeps, viewDayStart, demo, onSave, onClose }: WorkoutSheetProps) {
  const formId = useId()
  const [initial] = useState<WorkoutDraft>(() => draftFromWorkout(workout))
  const [draft, setDraft] = useState<WorkoutDraft>(initial)
  const [nameTouched, setNameTouched] = useState(false)
  const check = useMemo(() => checkWorkoutDraft(draft, workout), [draft, workout])
  const isNew = mode === 'new'
  const changed = (Object.keys(initial) as (keyof WorkoutDraft)[]).some((k) => k !== 'name' && draft[k] !== initial[k])
  const showNameError = Boolean(check.errors.name) && (!isNew || nameTouched || changed)

  function set<K extends keyof WorkoutDraft>(key: K, value: WorkoutDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const ids = { name: `${formId}-name`, kcal: `${formId}-kcal`, when: `${formId}-when`, minutes: `${formId}-minutes` }
  const startIso = fromLocalInput(draft.startedAtLocal)
  const dayOfTime = startIso ? wakingDayStart(sleeps, startIso) : null
  const selected = draft.source ? getSource(draft.source) : null
  // The ranges this workout would have, from the calories and source typed so far.
  const kcal = parseAmount(draft.kcal)
  const preview =
    kcal.kind === 'value' && draft.source !== null
      ? estimateWorkout({ ...workout, kcal: kcal.value, source: draft.source })
      : null

  return (
    <Sheet
      title={isNew ? copy.workouts.titleNew : copy.workouts.titleEdit(workout.name)}
      demo={demo}
      onClose={onClose}
      testId="workout-sheet"
      footer={
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose} data-testid="cancel-workout">
            {copy.workouts.cancel}
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={check.workout === null} data-testid="save-workout">
            {copy.workouts.save}
          </button>
        </div>
      }
    >
      <form
        id={formId}
        className="meal-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (check.workout) onSave(check.workout)
        }}
      >
        <div className="field">
          <label htmlFor={ids.name}>{copy.workouts.name}</label>
          <input
            id={ids.name}
            type="text"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            onBlur={() => setNameTouched(true)}
            aria-invalid={showNameError ? true : undefined}
            data-testid="workout-name-input"
          />
          {showNameError && (
            <p className="field-error" data-testid="workout-name-error">
              {check.errors.name}
            </p>
          )}
        </div>

        <fieldset className="field source-field">
          <legend>{copy.workouts.howKnow}</legend>
          <div className="source-options">
            {BURN_SOURCE_IDS.map((id) => {
              const s = getSource(id)
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
                    {s.label} <BasisTag source={s} />
                  </span>
                  <span className="source-error num">{copy.logMeal.optionError(fmtPct(s.typicalError))}</span>
                </label>
              )
            })}
          </div>
          {selected?.hint && <p className="field-hint">{selected.hint}</p>}
          {check.errors.source && (
            <p className="field-error" data-testid="workout-source-hint">
              {check.errors.source}
            </p>
          )}
        </fieldset>

        <div className="field">
          <label htmlFor={ids.kcal}>{copy.workouts.calories}</label>
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
            data-testid="workout-kcal-input"
          />
          <p className="field-hint" id={`${ids.kcal}-hint`}>
            {copy.workouts.caloriesHint}
          </p>
          {preview && (
            <p className="field-hint num" data-testid="workout-range-preview">
              {copy.workouts.rangePreviewLead}{' '}
              <span className="nowrap">{copy.workouts.rangePreviewLikely(fmtRange(preview.likely))}</span>
              {copy.workouts.rangePreviewJoin}
              <span className="nowrap">{copy.workouts.rangePreviewVeryLikely(fmtRange(preview.veryLikely))}</span>
              {copy.workouts.rangePreviewEnd}
            </p>
          )}
          {check.errors.kcal && (
            <p className="field-error" data-testid="workout-kcal-error">
              {check.errors.kcal}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor={ids.when}>{copy.workouts.start}</label>
          <input
            id={ids.when}
            type="datetime-local"
            className="num"
            value={draft.startedAtLocal}
            onChange={(e) => set('startedAtLocal', e.target.value)}
            aria-invalid={check.errors.startedAt ? true : undefined}
            data-testid="workout-when-input"
          />
          {startIso && (
            <p className="field-hint num" data-testid="workout-waking-day">
              {dayOfTime
                ? copy.logMeal.wakingDay(copy.header.awakeSince(fmtWeekday(dayOfTime), fmtTime(dayOfTime)))
                : copy.logMeal.provisionalDay}
            </p>
          )}
          {startIso && dayOfTime !== viewDayStart && (
            <p className="field-hint" data-testid="workout-other-day">
              {copy.workouts.otherDay}
            </p>
          )}
          {check.errors.startedAt && <p className="field-error">{check.errors.startedAt}</p>}
        </div>

        <div className="field">
          <label htmlFor={ids.minutes}>{copy.workouts.duration}</label>
          <input
            id={ids.minutes}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="num"
            value={draft.minutes}
            onChange={(e) => set('minutes', e.target.value)}
            aria-invalid={check.errors.minutes ? true : undefined}
            aria-describedby={`${ids.minutes}-hint`}
            data-testid="workout-minutes-input"
          />
          <p className="field-hint" id={`${ids.minutes}-hint`}>
            {copy.workouts.durationHint}
          </p>
          {check.errors.minutes && (
            <p className="field-error" data-testid="workout-minutes-error">
              {check.errors.minutes}
            </p>
          )}
        </div>
      </form>
    </Sheet>
  )
}
