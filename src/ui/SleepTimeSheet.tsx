// **I'm going to sleep** and **I woke up** (prd.md > Sleep and Waking Days): both default to now,
// with an editable date and time. Save checks the order with the kernel's validateSleep(); a
// problem shows inline, keeps what was typed and saves nothing. In the demo, a time later than
// the demo's clock is allowed and moves the clock forward (spec.md > Clock); your own log
// rejects it instead.
// Build-out item 2.2: the date and time are two fields (WhenField.tsx), and the time takes
// shorthand, so "I woke at 8" is: I woke up, type 8, Save. Enter in either field saves (the footer
// button is the form's submit button). What moves to the new day is shown with the editor's move
// list (MoveList.tsx), counted the same way (sleepEdit.ts > movesBetween): meals, workouts and weigh-ins.

import { useId, useMemo, useState } from 'react'
import type { Meal, SleepRecord } from '../kernel/types'
import { copy } from './copy'
import { toLocalInput } from './editMeal'
import { fmtWeekdayTime } from './format'
import { MoveList } from './MoveList'
import { Sheet } from './Sheet'
import { demoMaxDate, movesBetween, readWhen, whenFromIso, type DatedLog, type WhenDraft } from './sleepEdit'
import { problemText, sleepSave, type SleepAction } from './sleepView'
import { WhenField } from './WhenField'

interface SleepTimeSheetProps {
  action: SleepAction
  sleeps: SleepRecord[]
  meals: Meal[]
  /** The log's workouts: dated entries that can change day too. */
  workouts: DatedLog['workouts']
  /** The log's weigh-ins, which change day too, and its settings (the unit they are named in). */
  weighIns?: DatedLog['weighIns']
  settings?: DatedLog['settings']
  /** The active log's now: the default time, and (in your own log) the latest allowed. */
  nowIso: string
  /** The wake that started the current waking day, for "This closes the waking day that started …". */
  dayStart: string | null
  demo: boolean
  onSave: (sleeps: SleepRecord[], at: string) => void
  onClose: () => void
}

export function SleepTimeSheet({ action, sleeps, meals, workouts, weighIns, settings, nowIso, dayStart, demo, onSave, onClose }: SleepTimeSheetProps) {
  const id = useId()
  const formId = `${id}-form`
  // What the fields were filled in with: the "Starts at now" hint shows only while they still hold it.
  const [initial] = useState<WhenDraft>(() => whenFromIso(nowIso))
  const [when, setWhen] = useState<WhenDraft>(initial)
  const [tried, setTried] = useState(false)
  // The demo's dates stop a day after its clock (sleepEdit.ts > demoMaxDate).
  const maxDate = demo ? demoMaxDate(nowIso) : toLocalInput(nowIso).slice(0, 10)
  const read = readWhen(when, demo ? maxDate : null)
  const iso = read.kind === 'value' ? read.iso : null
  // The demo has no "later than now" limit: its clock moves forward instead.
  const result = useMemo(
    () => sleepSave(sleeps, meals, action, iso, demo ? null : nowIso),
    [sleeps, meals, action, iso, demo, nowIso],
  )
  const error = !tried
    ? null
    : read.kind === 'error'
      ? read.message
      : read.kind === 'empty'
        ? copy.sleepEditor.errors.time
        : !result.ok
          ? problemText(result.problem)
          : null
  const advances = demo && iso !== null && Date.parse(iso) > Date.parse(nowIso)
  const moves = useMemo(
    () => (result.ok ? movesBetween({ meals, workouts, weighIns, settings }, sleeps, result.sleeps) : []),
    [result, meals, workouts, weighIns, settings, sleeps],
  )

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
      <button type="submit" form={formId} className="btn btn-primary" data-testid="sleep-save">
        {copy.sleep.save}
      </button>
    </div>
  )

  return (
    <Sheet title={title} demo={demo} onClose={onClose} testId="sleep-sheet" footer={footer}>
      <form
        id={formId}
        className="meal-form"
        // The checks below say what is wrong in plain words; the browser's own date limits would not.
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <WhenField
          legend={copy.sleep.when}
          value={when}
          onChange={setWhen}
          error={error}
          testId="sleep"
          hint={when.date === initial.date && when.time === initial.time ? copy.sleep.whenHint : null}
          maxDate={maxDate}
        />
        <p className="field-hint" data-testid="sleep-effect">
          {action === 'sleep'
            ? dayStart
              ? copy.sleep.closesDay(fmtWeekdayTime(dayStart))
              : null
            : moves.length > 0
              ? copy.sleep.startsDayWithMoves
              : copy.sleep.startsDay}
        </p>
        {/* The same list as the editor's move warning, with each entry's day, time and calories. */}
        {action === 'wake' && moves.length > 0 && (
          <div className="sleep-moves" data-testid="sleep-moves">
            <p className="field-hint" data-testid="sleep-moves-intro">
              {copy.sleep.moves}
            </p>
            <MoveList groups={moves} />
          </div>
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
