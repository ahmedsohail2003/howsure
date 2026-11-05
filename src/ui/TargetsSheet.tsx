// The targets editor (build-out item 1.3): daily calories, protein, carbs and fat, kept in the
// open log's profile.targets. A blank box means no target. Each box is checked as it is typed,
// like the Log a meal sheet: an error shows under its box and Save waits until it is fixed.
// Cancel (or Close, or Esc) leaves the targets as they were.

import { useId, useState } from 'react'
import type { Profile } from '../store/log'
import { copy } from './copy'
import { Sheet } from './Sheet'
import { checkTargets, fieldsFromTargets, TARGET_KEYS, type TargetFields, type Targets } from './targets'

interface TargetsSheetProps {
  targets: Profile['targets']
  demo: boolean
  onSave: (targets: Targets) => void
  onClose: () => void
}

export function TargetsSheet({ targets, demo, onSave, onClose }: TargetsSheetProps) {
  const [fields, setFields] = useState<TargetFields>(() => fieldsFromTargets(targets))
  const formId = useId()
  const hintId = useId()
  const check = checkTargets(fields)

  return (
    <Sheet
      title={copy.targets.title}
      sub={demo ? copy.targets.subDemo : undefined}
      demo={demo}
      onClose={onClose}
      testId="targets-sheet"
      footer={
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose} data-testid="cancel-targets">
            {copy.targets.cancel}
          </button>
          <button
            type="submit"
            form={formId}
            className="btn btn-primary"
            disabled={check.targets === null}
            data-testid="save-targets"
          >
            {copy.targets.save}
          </button>
        </div>
      }
    >
      <form
        id={formId}
        className="meal-form targets-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (check.targets) onSave(check.targets)
        }}
      >
        <p className="field-hint" id={hintId}>
          {copy.targets.intro}
        </p>
        <div className="targets-inputs">
          {TARGET_KEYS.map((k) => {
            const id = `${formId}-${k}`
            const error = check.errors[k]
            return (
              <div className="field" key={k}>
                <label htmlFor={id}>{copy.targets[k]}</label>
                <input
                  id={id}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="num"
                  value={fields[k]}
                  onChange={(e) => {
                    const value = e.target.value
                    setFields((f) => ({ ...f, [k]: value }))
                  }}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-error ${hintId}` : hintId}
                  data-testid={`target-${k}-input`}
                />
                {error && (
                  <p className="field-error" id={`${id}-error`} data-testid={`target-${k}-error`}>
                    {error}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </form>
    </Sheet>
  )
}
