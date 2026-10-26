// **I'm going to sleep** and **I woke up** (prd.md > Sleep and Waking Days): both default to now,
// with an editable date and time. Save checks the order with the kernel's validateSleep(); a
// problem shows inline, keeps what was typed and saves nothing. In the demo, a time later than
// the demo's clock is allowed and moves the clock forward (spec.md > Clock); your own log
// rejects it instead.

import { useId, useMemo, useState } from 'react'
import type { SleepRecord, Meal } from '../kernel/types'
import { copy } from './copy'
import { fromLocalInput, toLocalInput } from './editMeal'
import { fmtWeekdayTime } from './format'
import { Sheet } from './Sheet'
import { problemText, sleepSave, type SleepAction } from './sleepView'

interface SleepTimeSheetProps {
  action: SleepAction
  sleeps: SleepRecord[]
  meals: Meal[]
  /** The active log's now: the default time, and (in your own log) the latest allowed. */
  nowIso: string
  /** The wake that started the current waking day, for "This closes the waking day that started …". */
  dayStart: string | null
  demo: boolean
  onSave: (sleeps: SleepRecord[], at: string) => void
  onClose: () => void
}

export function SleepTimeSheet({ action, sleeps, meals, nowIso, dayStart, demo, onSave, onClose }: SleepTimeSheetProps) {
  const id = useId()
  const [value, setValue] = useState(() => toLocalInput(nowIso))
  const [tried, setTried] = useState(false)
  const iso = fromLocalInput(value)
  // The demo has no "later than now" limit: its clock moves forward instead.
  const result = useMemo(
    () => sleepSave(sleeps, meals, action, iso, demo ? null : nowIso),
    [sleeps, meals, action, iso, demo, nowIso],
  )
  const error = tried && !result.ok ? problemText(result.problem) : null
  const advances = demo && iso !== null && Date.parse(iso) > Date.parse(nowIso)

  function save() {
    setTried(true)
    if (result.ok && iso !== null) onSave(result.sleeps, iso)
  }

  const title = action === 'sleep' ? copy.sleep.sheetSleepTitle : copy.sleep.sheetWakeTitle
  const footer = (
    <div className="sheet-actions">
      <button type="button" className="btn btn-plain" onClick={onClose}>
        {copy.sleep.cancel}
      </button>
      <button type="button" className="btn btn-primary" onClick={save} data-testid="sleep-save">
        {copy.sleep.save}
      </button>
    </div>
  )

  return (
    <Sheet title={title} demo={demo} onClose={onClose} testId="sleep-sheet" footer={footer}>
      <form
        className="meal-form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="field">
          <label htmlFor={`${id}-when`}>{copy.sleep.when}</label>
          <input
            id={`${id}-when`}
            type="datetime-local"
            className="num"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-hint`}
            data-testid="sleep-when-input"
          />
          <p className="field-hint" id={`${id}-hint`}>
            {copy.sleep.whenHint}
          </p>
          {error && (
            <p className="field-error" role="alert" data-testid="sleep-error">
              {error}
            </p>
          )}
        </div>
        <p className="field-hint" data-testid="sleep-effect">
          {action === 'sleep'
            ? dayStart
              ? copy.sleep.closesDay(fmtWeekdayTime(dayStart))
              : null
            : copy.sleep.startsDay}
        </p>
        {action === 'wake' && result.ok && result.moved.length > 0 && (
          <p className="callout amber" data-testid="sleep-moves">
            {copy.sleep.moves(result.moved.map((m) => m.name).join(', '))}
          </p>
        )}
        {advances && (
          <p className="field-hint" data-testid="demo-advance">
            {copy.sleep.demoAdvance}
          </p>
        )}
      </form>
    </Sheet>
  )
}
