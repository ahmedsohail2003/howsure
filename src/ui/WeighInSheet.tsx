// Build-out item 2.4: Log weight, and editing or deleting a weigh-in. The weight with its unit
// (kg or lb: the unit of the number typed, which becomes how weights are shown; on an existing
// weigh-in, switching it converts the saved weight, see withDraftUnit), the date and time (starting at now,
// or at the viewed day's time on an earlier day), optional body fat and an optional note. A line
// says which waking day it goes in. Checks run as you type; Save waits until they pass. Delete
// asks first.

import { useEffect, useId, useRef, useState } from 'react'
import { wakesOf, wakingDayStart } from '../kernel/sleepday'
import type { SleepRecord, WeighIn, WeightUnit } from '../kernel/types'
import { copy } from './copy'
import { fromLocalInput, toLocalInput } from './editMeal'
import { fmtTime, fmtWeekdayDate } from './format'
import { TimesTogether } from './KeepTogether'
import { Sheet } from './Sheet'
import { checkWeighIn, draftFor, newWeighInId, showsSavedWeight, withDraftUnit, type WeighInDraft } from './weighInEdit'
import { fmtWeighInWhen, fmtWeight } from './weightView'

interface WeighInSheetProps {
  /** The weigh-in to edit, or null to log a new one. */
  existing: WeighIn | null
  /** A new weigh-in's starting time: now, or the viewed day's time on an earlier day. */
  startAt: string
  /** True when startAt is on an earlier day than now (its hint then says so). */
  startsOnEarlierDay?: boolean
  /** The unit the sheet starts in for a new weigh-in (the log's preference). */
  unit: WeightUnit
  sleeps: SleepRecord[]
  /** The log's now: the latest time allowed. */
  nowIso: string
  demo: boolean
  onSave: (w: WeighIn) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const UNITS: readonly WeightUnit[] = ['kg', 'lb']

/** Which waking day a weigh-in at this time goes in, named by its wake's date and time. */
function dayHintText(dayStart: string | null, sleeps: SleepRecord[]): string {
  if (dayStart !== null) return copy.weight.dayHint(fmtWeekdayDate(dayStart), fmtTime(dayStart))
  const first = wakesOf(sleeps)[0]
  return first === undefined ? copy.weight.dayHintNoWake : copy.weight.dayHintBeforeFirstWake(fmtWeekdayDate(first), fmtTime(first))
}

export function WeighInSheet({ existing, startAt, startsOnEarlierDay = false, unit, sleeps, nowIso, demo, onSave, onDelete, onClose }: WeighInSheetProps) {
  const id = useId()
  const formId = `${id}-form`
  const [newId] = useState(newWeighInId)
  const [draft, setDraft] = useState<WeighInDraft>(() => draftFor(existing, startAt, unit))
  const [confirming, setConfirming] = useState(false)
  // Delete swaps the footer for its confirmation: focus moves to Keep it, and back to Delete after,
  // so it never drops to the page behind the sheet (where Esc and Tab would no longer reach it).
  const keepRef = useRef<HTMLButtonElement>(null)
  const deleteRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  useEffect(() => {
    if (confirming) keepRef.current?.focus()
    else if (wasConfirming.current) deleteRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])
  const check = checkWeighIn(draft, existing, newId, nowIso)
  const set = (patch: Partial<WeighInDraft>) => setDraft((d) => ({ ...d, ...patch }))
  // A field's error line, when it appears, is scrolled into view: on a short phone it would
  // otherwise sit under the pinned Cancel and Save bar (its scroll-margin clears that bar).
  const formRef = useRef<HTMLFormElement>(null)
  const weightError = check.errors.weight && draft.weight !== '' ? check.errors.weight : null
  const bodyFatError = check.errors.bodyFat ?? null
  useEffect(() => {
    if (bodyFatError === null) return
    formRef.current?.querySelector('[data-testid="weigh-in-body-fat-error"]')?.scrollIntoView({ block: 'nearest' })
  }, [bodyFatError])
  useEffect(() => {
    if (weightError === null) return
    formRef.current?.querySelector('[data-testid="weigh-in-weight-error"]')?.scrollIntoView({ block: 'nearest' })
  }, [weightError])

  // Which waking day the time falls in, by the meals' rule.
  const at = fromLocalInput(draft.atLocal)
  const dayStart = at === null ? undefined : wakingDayStart(sleeps, at)
  // An imported weigh-in whose time was not recorded says so while its time is left as it is.
  const approxKept = existing?.timeApproximate === true && draft.atLocal === toLocalInput(existing.at)

  const footer = confirming && existing ? (
    <div className="delete-confirm" data-testid="weigh-in-delete-confirm">
      <p className="delete-confirm-text">
        <TimesTogether text={copy.weight.confirmDelete(fmtWeight(existing.kg, unit), fmtWeighInWhen(existing))} />
      </p>
      <div className="sheet-actions">
        <button type="button" className="btn" ref={keepRef} onClick={() => setConfirming(false)} data-testid="weigh-in-delete-keep">
          {copy.weight.keep}
        </button>
        <button type="button" className="btn btn-ink" onClick={() => onDelete(existing.id)} data-testid="weigh-in-delete-confirm-btn">
          {copy.weight.deleteConfirm}
        </button>
      </div>
    </div>
  ) : (
    <div className={existing ? 'sheet-actions split' : 'sheet-actions'}>
      {existing ? (
        <button type="button" className="btn btn-plain" ref={deleteRef} onClick={() => setConfirming(true)} data-testid="weigh-in-delete">
          {copy.weight.delete}
        </button>
      ) : (
        <button type="button" className="btn btn-plain" onClick={onClose} data-testid="weigh-in-cancel">
          {copy.weight.cancel}
        </button>
      )}
      <button type="submit" form={formId} className="btn btn-primary" disabled={check.weighIn === null} data-testid="weigh-in-save">
        {copy.weight.save}
      </button>
    </div>
  )

  const err = check.errors
  return (
    <Sheet
      title={existing ? copy.weight.sheetEdit : copy.weight.sheetNew}
      demo={demo}
      onClose={onClose}
      testId="weigh-in-sheet"
      footer={footer}
      // A new weigh-in opens with focus in the weight box, so "Log weight, type 79.3, Enter" works.
      initialFocusTestId={existing ? undefined : 'weigh-in-weight'}
    >
      <form
        id={formId}
        ref={formRef}
        className="meal-form weigh-in-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (check.weighIn) onSave(check.weighIn)
        }}
      >
        <div className="weigh-in-weight">
          <div className="field">
            <label htmlFor={`${id}-weight`}>{copy.weight.weightLabel}</label>
            <input
              id={`${id}-weight`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="num"
              value={draft.weight}
              onChange={(e) => set({ weight: e.target.value })}
              aria-invalid={err.weight && draft.weight !== '' ? true : undefined}
              aria-describedby={err.weight && draft.weight !== '' ? `${id}-weight-error` : undefined}
              data-testid="weigh-in-weight"
            />
          </div>
          <fieldset className="field source-field unit-field">
            <legend>{copy.weight.unitLegend}</legend>
            <div className="source-options unit-options">
              {UNITS.map((u) => (
                <label key={u} className={draft.unit === u ? 'source-option checked' : 'source-option'}>
                  <input
                    type="radio"
                    name={`${id}-unit`}
                    value={u}
                    checked={draft.unit === u}
                    onChange={() => setDraft((d) => withDraftUnit(d, u, existing))}
                    data-testid={`weigh-in-unit-${u}`}
                  />
                  <span className="source-label">{copy.weight.unitName[u]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {/* "Type your weight" waits until something is typed: a blank new form only keeps Save off. */}
        {err.weight && draft.weight !== '' && (
          <p className="field-error weigh-in-weight-error" id={`${id}-weight-error`} data-testid="weigh-in-weight-error">
            {err.weight}
          </p>
        )}
        <p className="field-hint" data-testid="weigh-in-unit-hint">
          {/* True in every state: switching converts only while the box shows the saved weight; a
              number typed (new, or over the saved one) is read in the unit picked. */}
          {showsSavedWeight(draft, existing) ? copy.weight.unitHintEdit : existing ? copy.weight.unitHintTyped : copy.weight.unitHintNew}
        </p>

        <div className="field">
          <label htmlFor={`${id}-at`}>{copy.weight.whenLabel}</label>
          <input
            id={`${id}-at`}
            type="datetime-local"
            className="num"
            value={draft.atLocal}
            onChange={(e) => set({ atLocal: e.target.value })}
            aria-invalid={err.at ? true : undefined}
            aria-describedby={approxKept || !existing ? `${id}-at-hint` : undefined}
            data-testid="weigh-in-when"
          />
          {(approxKept || !existing) && (
            <p className="field-hint" id={`${id}-at-hint`}>
              {approxKept ? copy.weight.approxNote(fmtTime(existing.at)) : startsOnEarlierDay ? copy.weight.whenHintDay : copy.weight.whenHint}
            </p>
          )}
          {err.at && (
            <p className="field-error" role="alert" data-testid="weigh-in-when-error">
              {err.at}
            </p>
          )}
          {dayStart !== undefined && !err.at && (
            <p className="field-hint" data-testid="weigh-in-day">
              <TimesTogether text={dayHintText(dayStart, sleeps)} />
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor={`${id}-bf`}>{copy.weight.bodyFatLabel}</label>
          <input
            id={`${id}-bf`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="num weigh-in-short"
            value={draft.bodyFat}
            onChange={(e) => set({ bodyFat: e.target.value })}
            aria-invalid={err.bodyFat ? true : undefined}
            aria-describedby={err.bodyFat ? `${id}-bf-error` : undefined}
            data-testid="weigh-in-body-fat"
          />
          {err.bodyFat && (
            <p className="field-error" id={`${id}-bf-error`} data-testid="weigh-in-body-fat-error">
              {err.bodyFat}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor={`${id}-note`}>{copy.weight.noteLabel}</label>
          <textarea
            id={`${id}-note`}
            rows={2}
            value={draft.note}
            onChange={(e) => set({ note: e.target.value })}
            data-testid="weigh-in-note"
          />
        </div>
      </form>
    </Sheet>
  )
}
