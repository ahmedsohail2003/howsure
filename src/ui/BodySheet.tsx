// Body details (build-out item 2.5b): age, sex, height, weight and everyday activity, for the
// resting-burn estimate behind the estimated deficit or surplus. Kept in the open log's
// profile.body (the demo's stay in the demo). Reached from Profile and privacy, from More, and
// from the line under the headline that invites adding them. Every box is optional: a blank box
// is not set, never guessed. Each box is checked as it is typed, like the targets editor; an error
// shows under its box and Save waits until it is fixed. Cancel (or Close, or Esc) changes nothing.

import { useId, useState, type ReactNode } from 'react'
import { ACTIVITY_FACTORS } from '../kernel/energy'
import type { BodyDetails } from '../store/log'
import {
  ACTIVITY_LEVELS,
  checkBody,
  clearedFields,
  fieldsFromBody,
  keepUnchanged,
  SEXES,
  weightText,
  withHeightUnit,
  withWeightUnit,
  type BodyFields,
  type BodyFieldKey,
} from './body'
import { copy } from './copy'
import { weighInWhen, type WeighInRead } from './balanceView'
import { Sheet } from './Sheet'

interface BodySheetProps {
  body: BodyDetails | undefined
  /** The open log's now: the age shown is moved on to it, and a typed age is dated with it. */
  nowIso: string
  /** Today's date, YYYY-MM-DD, stored with a typed age. */
  todayDate: string
  /** The latest weigh-in, when the log has one: it is used in place of the weight typed here. */
  weighIn?: WeighInRead | null
  demo: boolean
  onSave: (body: BodyDetails) => void
  onClose: () => void
}

/** Two or three choices drawn as buttons, each a radio (the Log a meal amount control's style). */
function Choice<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  testId,
  hint,
}: {
  legend: string
  name: string
  options: readonly { id: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
  testId: string
  hint?: ReactNode
}) {
  return (
    <fieldset className="field amount-field body-choice" data-testid={testId}>
      <legend>{legend}</legend>
      <div className={`amount-options choice-${options.length}`}>
        {options.map((o) => (
          <label key={o.id} className={value === o.id ? 'amount-option checked' : 'amount-option'}>
            <input
              type="radio"
              className="amount-input"
              name={name}
              value={o.id}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
              data-testid={`${testId}-${o.id}`}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {hint}
    </fieldset>
  )
}

export function BodySheet({ body, nowIso, todayDate, weighIn, demo, onSave, onClose }: BodySheetProps) {
  const [start] = useState<BodyFields>(() => fieldsFromBody(body, nowIso))
  const [fields, setFields] = useState<BodyFields>(start)
  const formId = useId()
  const check = checkBody(fields, todayDate)
  const set = <K extends keyof BodyFields>(k: K, v: BodyFields[K]) => setFields((f) => ({ ...f, [k]: v }))

  function textBox(key: BodyFieldKey, label: string, testId: string, describe?: string) {
    const id = `${formId}-${key}`
    const error = check.errors[key]
    return (
      <div className="field body-num">
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="num"
          value={fields[key]}
          onChange={(e) => set(key, e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? `${id}-error` : null, describe ?? null].filter(Boolean).join(' ') || undefined}
          data-testid={testId}
        />
        {error && (
          <p className="field-error" id={`${id}-error`} data-testid={`${testId.replace(/-input$/, '')}-error`}>
            {error}
          </p>
        )}
      </div>
    )
  }

  const weighInHintId = `${formId}-weighin`

  return (
    <Sheet
      title={copy.body.title}
      sub={demo ? copy.body.subDemo : copy.body.sub}
      demo={demo}
      onClose={onClose}
      testId="body-sheet"
      footer={
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose} data-testid="cancel-body">
            {copy.body.cancel}
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={check.body === null} data-testid="save-body">
            {copy.body.save}
          </button>
        </div>
      }
    >
      <form
        id={formId}
        className="meal-form body-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (check.body) onSave(keepUnchanged(check.body, body, start, fields))
        }}
      >
        <p className="field-hint">{copy.body.intro}</p>

        {textBox('age', copy.body.age, 'body-age-input')}

        <Choice
          legend={copy.body.sex}
          name={`${formId}-sex`}
          options={SEXES.map((id) => ({ id, label: copy.body.sexOptions[id] }))}
          value={fields.sex}
          onChange={(v) => set('sex', v)}
          testId="body-sex"
          hint={
            <p className="field-hint" data-testid="body-sex-hint">
              {fields.sex === 'unspecified' ? copy.body.sexHintUnspecified : copy.body.sexHint}
            </p>
          }
        />

        <Choice
          legend={copy.body.heightUnit}
          name={`${formId}-height-unit`}
          options={[
            { id: 'cm' as const, label: copy.body.units.cm },
            { id: 'ftin' as const, label: copy.body.units.ftin },
          ]}
          value={fields.heightUnit}
          onChange={(v) => setFields((f) => withHeightUnit(f, v))}
          testId="body-height-unit"
        />
        {fields.heightUnit === 'cm' ? (
          textBox('heightCm', copy.body.heightCm, 'body-height-cm-input')
        ) : (
          <div className="body-pair">
            {textBox('heightFt', copy.body.heightFt, 'body-height-ft-input')}
            {textBox('heightIn', copy.body.heightIn, 'body-height-in-input')}
          </div>
        )}

        <Choice
          legend={copy.body.weightUnit}
          name={`${formId}-weight-unit`}
          options={[
            { id: 'kg' as const, label: copy.body.units.kg },
            { id: 'lb' as const, label: copy.body.units.lb },
          ]}
          value={fields.weightUnit}
          onChange={(v) => setFields((f) => withWeightUnit(f, v))}
          testId="body-weight-unit"
        />
        {textBox('weight', fields.weightUnit === 'kg' ? copy.body.weightKg : copy.body.weightLb, 'body-weight-input', weighIn ? weighInHintId : undefined)}
        {weighIn && (
          <p className="field-hint" id={weighInHintId} data-testid="body-weighin-hint">
            {copy.body.weighInHint(weightText(weighIn.kg, fields.weightUnit), weighInWhen(weighIn, nowIso))}
          </p>
        )}

        <fieldset className="field source-field" data-testid="body-activity">
          <legend>{copy.body.activity}</legend>
          <div className="source-options">
            {ACTIVITY_LEVELS.map((id) => (
              <label key={id} className={fields.activity === id ? 'source-option checked' : 'source-option'}>
                <input
                  type="radio"
                  name={`${formId}-activity`}
                  value={id}
                  checked={fields.activity === id}
                  onChange={() => set('activity', id)}
                  data-testid={`body-activity-${id}`}
                />
                <span className="source-label">{copy.body.activityOptions[id]}</span>
                <span className="source-error num">{copy.body.factor(String(ACTIVITY_FACTORS[id]))}</span>
              </label>
            ))}
          </div>
          <p className="field-hint">{copy.body.activityHints[fields.activity]}</p>
          <p className="field-hint">{copy.body.activityNote}</p>
        </fieldset>

        <button type="button" className="btn btn-quiet body-clear" onClick={() => setFields((f) => clearedFields(f))} data-testid="clear-body">
          {copy.body.clear}
        </button>
      </form>
    </Sheet>
  )
}
