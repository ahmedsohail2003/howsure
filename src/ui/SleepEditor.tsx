// The sleep and wake editor (build-out item 2.2; checklist slice 6; prd.md > Editing Sleep and
// Wake Times; spec.md > Screens > SleepEditor.tsx). Opened from the header's wake time, Edit in the
// sleep section, each night in the sleep detail, and the Night timeline's wake and sleep points.
// Three steps, one sheet:
//   1. the night: when you went to sleep and when you woke, each with its own date and a time
//      that takes shorthand (WhenField.tsx). The order check puts each problem next to its field,
//      keeps what was typed and saves nothing. From here: Delete this night, or Add a missed night;
//   2. the move warning, only when Save would change which waking day an entry belongs to: what
//      moves, from which day to which day. Save and move applies it; Change the times goes back
//      with everything kept; Close or Esc changes nothing;
//   3. Delete this night?, with the same list of what would move. Keep it goes back.
// The numbers come from sleepEdit.ts; every look draws the same sheet with its own palette.

import { useId, useMemo, useState } from 'react'
import type { SleepRecord } from '../kernel/types'
import type { LogDoc } from '../store/log'
import { copy } from './copy'
import { toLocalInput } from './editMeal'
import { fmtWeekday, fmtWeekdayDate, fmtWeekdayTime } from './format'
import { TimesTogether } from './KeepTogether'
import { MoveList } from './MoveList'
import { Sheet } from './Sheet'
import {
  checkNight,
  deleteIntroText,
  demoMaxDate,
  deleteNight,
  draftForMissed,
  draftForRecord,
  lengthText,
  nightSinceMissing,
  readWhen,
  withAutoSleepDate,
  type EditTarget,
  type NightDraft,
  type WhenDraft,
} from './sleepEdit'
import { newSleepId } from './sleepView'
import { WhenField } from './WhenField'

/** What a save changed: the night as it was (null when added) and as it is (null when deleted). */
export interface NightChange {
  before: SleepRecord | null
  after: SleepRecord | null
}

interface SleepEditorProps {
  doc: LogDoc
  target: EditTarget
  /** The log's now: in your own log the latest time allowed. */
  nowIso: string
  /** Where Add a missed night starts (sleepEdit.ts > missedWakeDate). */
  missedDate: string
  demo: boolean
  onSave: (sleeps: SleepRecord[], change: NightChange) => void
  onClose: () => void
}

type Step = 'form' | 'moves' | 'delete'

export function SleepEditor({ doc, target: initialTarget, nowIso, missedDate, demo, onSave, onClose }: SleepEditorProps) {
  const id = useId()
  const formId = `${id}-form`
  const [target, setTarget] = useState<EditTarget>(initialTarget)
  const record = target.kind === 'edit' ? doc.sleeps.find((r) => r.id === target.recordId) : undefined
  const [draft, setDraft] = useState<NightDraft>(() =>
    record ? draftForRecord(record, nowIso) : draftForMissed(target.kind === 'add' ? target.wakeDate : missedDate),
  )
  const [tried, setTried] = useState(false)
  const [step, setStep] = useState<Step>('form')
  // A new night's id is picked once, so the check and the save agree.
  const [newId] = useState(newSleepId)
  const latest = demo ? null : nowIso
  // The demo's dates stop a day after its clock, so a mistyped year cannot move it decades ahead.
  const maxDate = demo ? demoMaxDate(nowIso) : toLocalInput(nowIso).slice(0, 10)
  const check = useMemo(
    () => checkNight(doc, target, draft, latest, newId, demo ? maxDate : null),
    [doc, target, draft, latest, newId, demo, maxDate],
  )
  const removal = useMemo(() => (record ? deleteNight(doc, record.id) : null), [doc, record])

  function setSleep(next: WhenDraft) {
    // Choosing a sleep date stops it following the wake.
    const auto = draft.sleepDateAuto && next.date === draft.sleep.date
    setDraft(withAutoSleepDate({ ...draft, sleep: next, sleepDateAuto: auto }))
  }

  function setWake(next: WhenDraft) {
    setDraft(withAutoSleepDate({ ...draft, wake: next }))
  }

  function save() {
    setTried(true)
    if (!check.save) return
    if (check.save.moves.length > 0) setStep('moves')
    else apply()
  }

  function apply() {
    if (check.save) onSave(check.save.sleeps, { before: record ?? null, after: check.save.record })
  }

  function addMissed() {
    setTarget({ kind: 'add', wakeDate: missedDate })
    setDraft(draftForMissed(missedDate))
    setTried(false)
  }

  if (step === 'moves' && check.save) {
    const footer = (
      <div className="sheet-actions">
        <button type="button" className="btn btn-plain" onClick={() => setStep('form')} data-testid="moves-back">
          {copy.sleepEditor.movesBack}
        </button>
        <button type="button" className="btn btn-primary" onClick={apply} data-testid="moves-save">
          {copy.sleepEditor.movesSave}
        </button>
      </div>
    )
    return (
      <Sheet key="moves" title={copy.sleepEditor.movesTitle} demo={demo} onClose={onClose} testId="move-warning" footer={footer}>
        <div className="confirm-body">
          <p>{copy.sleepEditor.movesIntro}</p>
        </div>
        <MoveList groups={check.save.moves} />
      </Sheet>
    )
  }

  if (step === 'delete' && record && removal) {
    const footer = (
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={() => setStep('form')} data-testid="delete-night-keep">
          {copy.sleepEditor.deleteKeep}
        </button>
        <button
          type="button"
          className="btn btn-ink"
          onClick={() => onSave(removal.sleeps, { before: record, after: null })}
          data-testid="delete-night-confirm"
        >
          {copy.sleepEditor.deleteConfirm}
        </button>
      </div>
    )
    return (
      <Sheet key="delete" title={copy.sleepEditor.deleteTitle} demo={demo} onClose={onClose} testId="delete-night-sheet" footer={footer}>
        <div className="confirm-body">
          <p data-testid="delete-night-range">
            <TimesTogether text={deleteIntroText(record)} />
          </p>
          <p>{copy.sleepEditor.deleteEffect}</p>
          {removal.moves.length === 0 ? (
            <p data-testid="delete-no-moves">{copy.sleepEditor.deleteNoMoves}</p>
          ) : (
            <p data-testid="delete-moves-intro">{copy.sleepEditor.deleteMovesIntro}</p>
          )}
        </div>
        {removal.moves.length > 0 && <MoveList groups={removal.moves} />}
      </Sheet>
    )
  }

  const errors = tried ? check.errors : {}
  const sleepRead = readWhen(draft.sleep)
  const wakeRead = readWhen(draft.wake)
  const length = lengthText(draft)
  // The demo moves its clock forward to a later time, but only to a time it would save: no line
  // about moving forward while a field has a problem (a date past the demo's limit, say).
  const advances =
    demo &&
    !check.errors.sleep &&
    !check.errors.wake &&
    [sleepRead, wakeRead].some((r) => r.kind === 'value' && Date.parse(r.iso) > Date.parse(nowIso))
  // A sleep still going on is named by when it started; a night with a wake by the day it woke on.
  const intro =
    target.kind !== 'edit' || !record
      ? copy.sleepEditor.introAdd
      : record.wake !== null
        ? copy.sleepEditor.introEdit(fmtWeekdayDate(record.wake))
        : record.sleepStart !== null
          ? copy.sleepEditor.introOpen(fmtWeekdayTime(record.sleepStart))
          : copy.sleepEditor.introAdd

  // The latest night woke on an earlier date than today: say how to add the night since.
  const sinceMissing = target.kind === 'edit' && record !== undefined && nightSinceMissing(doc.sleeps, record, nowIso)

  const footer = (
    <div className="sheet-actions">
      <button type="button" className="btn btn-plain" onClick={onClose} data-testid="edit-night-cancel">
        {copy.sleepEditor.cancel}
      </button>
      <button type="submit" form={formId} className="btn btn-primary" data-testid="edit-night-save">
        {copy.sleepEditor.save}
      </button>
    </div>
  )

  return (
    <Sheet
      key={`form-${target.kind}`}
      title={
        target.kind !== 'edit'
          ? copy.sleepEditor.titleAdd
          : record && record.wake === null && record.sleepStart !== null
            ? copy.sleepEditor.titleOpen
            : copy.sleepEditor.titleEdit
      }
      demo={demo}
      onClose={onClose}
      testId="sleep-editor"
      footer={footer}
      // "I woke at 8": an existing night (or a sleep still going on) opens on its wake time, ready
      // to type over; a new night opens on its sleep time, the first thing to fill in.
      initialFocusTestId={record ? 'edit-wake-time-input' : 'edit-sleep-time-input'}
    >
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
        <p data-testid="sleep-editor-intro">
          <TimesTogether text={intro} />
        </p>
        {sinceMissing && record?.wake && (
          <p className="field-hint" data-testid="editor-missed-hint">
            {copy.sleepEditor.missedSince(fmtWeekday(record.wake))}
          </p>
        )}
        <WhenField
          legend={copy.sleepEditor.sleepLegend}
          value={draft.sleep}
          onChange={setSleep}
          error={errors.sleep ?? null}
          testId="edit-sleep"
          hint={sleepRead.kind === 'empty' && !errors.sleep ? copy.sleepEditor.sleepBlank : null}
          maxDate={maxDate}
        />
        <WhenField
          legend={copy.sleepEditor.wakeLegend}
          value={draft.wake}
          onChange={setWake}
          error={errors.wake ?? null}
          testId="edit-wake"
          hint={wakeRead.kind === 'empty' && !errors.wake ? copy.sleepEditor.wakeBlank : null}
          maxDate={maxDate}
        />
        {length && !errors.sleep && !errors.wake && (
          <p className="field-hint" data-testid="edit-length">
            <TimesTogether text={length} />
          </p>
        )}
        {advances && (
          <p className="field-hint" data-testid="edit-demo-advance">
            {copy.sleep.demoAdvance}
          </p>
        )}
        {/* Only an edit has more to offer; a new night's form ends at its fields. */}
        {target.kind === 'edit' && (
          <div className="editor-more">
            {record && (
              <button type="button" className="btn btn-plain" onClick={() => setStep('delete')} data-testid="delete-night">
                {copy.sleepEditor.deleteNight}
              </button>
            )}
            <button type="button" className="btn btn-quiet editor-add" onClick={addMissed} data-testid="editor-add-night">
              {copy.sleepEditor.addMissed}
            </button>
          </div>
        )}
      </form>
    </Sheet>
  )
}
