// **Set wake time** (build-out item 2.1; prd.md > Sleep and Waking Days > Before a wake time is
// set). Two steps:
//   1. the time: today or yesterday, and a time that starts at 7:00 AM (wakeSet.ts). A time later
//      than now, or one that clashes with a recorded sleep, shows inline and nothing is saved;
//   2. the regroup preview, when the log has meals: which meals fall into the day the new wake
//      starts (today, after Save) and which stay earlier, each with its own date, time and
//      calories, and each list's calories counted as the headline counts them. Save applies it;
//      Change the time goes back; Cancel, Close or Esc changes nothing.
// Enter in the time step submits it (the footer button is the form's submit button).
// With no meals logged there is nothing to regroup, so step 1 saves directly.

import { useId, useMemo, useState } from 'react'
import type { Meal, SleepRecord } from '../kernel/types'
import { copy } from './copy'
import { fmtInt, fmtWeekdayFull, fmtWeekdayTime } from './format'
import { Sheet } from './Sheet'
import { problemText } from './sleepView'
import {
  DEFAULT_WAKE_TIME,
  defaultWakeDay,
  defaultWakeLabel,
  regroupForWake,
  regroupTotal,
  wakeDates,
  wakeIso,
  type WakeDay,
} from './wakeSet'

interface SetWakeSheetProps {
  sleeps: SleepRecord[]
  meals: Meal[]
  /** The log's now: the latest time allowed, and where today and yesterday are counted from. */
  nowIso: string
  demo: boolean
  onSave: (sleeps: SleepRecord[]) => void
  onClose: () => void
}

export function SetWakeSheet({ sleeps, meals, nowIso, demo, onSave, onClose }: SetWakeSheetProps) {
  const id = useId()
  const [day, setDay] = useState<WakeDay>(() => defaultWakeDay(nowIso))
  const [time, setTime] = useState(DEFAULT_WAKE_TIME)
  const [tried, setTried] = useState(false)
  const [step, setStep] = useState<'time' | 'preview'>('time')
  const dates = wakeDates(nowIso)
  const iso = wakeIso(nowIso, day, time)
  const result = useMemo(() => regroupForWake(meals, sleeps, iso, nowIso), [meals, sleeps, iso, nowIso])
  const error = tried && !result.ok ? problemText(result.problem) : null
  const hasMeals = meals.length > 0
  const formId = `${id}-form`
  // The hint names the default; once the person changes the time it would be out of date.
  const showHint = time === DEFAULT_WAKE_TIME

  function next() {
    setTried(true)
    if (!result.ok) return
    if (hasMeals) setStep('preview')
    else onSave(result.sleeps)
  }

  function save() {
    if (result.ok) onSave(result.sleeps)
  }

  const dayLabel = (d: WakeDay) => {
    const weekday = fmtWeekdayFull(`${dates[d]}T12:00:00`)
    return d === 'today' ? copy.setWake.today(weekday) : copy.setWake.yesterday(weekday)
  }

  if (step === 'preview' && result.ok) {
    const when = fmtWeekdayTime(result.wake)
    const footer = (
      <div className="sheet-actions">
        <button type="button" className="btn btn-plain" onClick={() => setStep('time')} data-testid="regroup-back">
          {copy.setWake.back}
        </button>
        <button type="button" className="btn btn-primary" onClick={save} data-testid="regroup-save">
          {copy.setWake.save}
        </button>
      </div>
    )
    return (
      <Sheet key="preview" title={copy.setWake.previewTitle} demo={demo} onClose={onClose} testId="regroup-preview" footer={footer}>
        <div className="confirm-body">
          <p>{copy.setWake.previewIntro(when)}</p>
        </div>
        <RegroupGroup testId="regroup-moving" title={copy.setWake.todayFrom(when)} meals={result.moving} />
        {result.staying.length > 0 && (
          <RegroupGroup
            testId="regroup-staying"
            title={copy.setWake.earlier}
            note={copy.setWake.earlierNote}
            meals={result.staying}
          />
        )}
        <p className="field-hint regroup-keeps" data-testid="regroup-keeps">
          {copy.setWake.keepsAll}
        </p>
      </Sheet>
    )
  }

  const footer = (
    <div className="sheet-actions">
      <button type="button" className="btn btn-plain" onClick={onClose} data-testid="set-wake-cancel">
        {copy.setWake.cancel}
      </button>
      <button type="submit" form={formId} className="btn btn-primary" data-testid="set-wake-save">
        {hasMeals ? copy.setWake.next : copy.setWake.save}
      </button>
    </div>
  )

  return (
    <Sheet key="time" title={copy.setWake.title} demo={demo} onClose={onClose} testId="set-wake-sheet" footer={footer}>
      <form
        id={formId}
        className="meal-form"
        onSubmit={(e) => {
          e.preventDefault()
          next()
        }}
      >
        <p>{copy.setWake.intro}</p>
        <fieldset className="field source-field">
          <legend>{copy.setWake.dayLegend}</legend>
          <div className="source-options">
            {(['today', 'yesterday'] as const).map((d) => (
              <label key={d} className={day === d ? 'source-option checked' : 'source-option'}>
                <input
                  type="radio"
                  name={`${id}-day`}
                  value={d}
                  checked={day === d}
                  onChange={() => setDay(d)}
                  data-testid={`set-wake-${d}`}
                />
                <span className="source-label">{dayLabel(d)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor={`${id}-time`}>{copy.setWake.time}</label>
          <input
            id={`${id}-time`}
            type="time"
            className="num"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={showHint ? `${id}-hint` : undefined}
            data-testid="set-wake-time"
          />
          {showHint && (
            <p className="field-hint" id={`${id}-hint`} data-testid="set-wake-hint">
              {copy.setWake.timeHint(defaultWakeLabel())}
            </p>
          )}
          {error && (
            <p className="field-error" role="alert" data-testid="set-wake-error">
              {error}
            </p>
          )}
        </div>
        {iso !== null && error === null && (
          <p className="field-hint" data-testid="set-wake-effect">
            {copy.setWake.startsDay(fmtWeekdayTime(iso))}
          </p>
        )}
      </form>
    </Sheet>
  )
}

/** A list's calories line: the known total (as the headline counts it) and any unknown meals. */
function totalText(meals: Meal[]): string {
  const { kcal, unknown } = regroupTotal(meals)
  const known = kcal === null ? copy.setWake.totalUnknown : copy.setWake.total(fmtInt(kcal))
  return unknown > 0 && kcal !== null ? `${known} · ${copy.headline.unknownCount(unknown)}` : known
}

interface RegroupGroupProps {
  title: string
  note?: string
  meals: Meal[]
  testId: string
}

function RegroupGroup({ title, note, meals, testId }: RegroupGroupProps) {
  return (
    <section className="regroup-group" data-testid={testId}>
      <div className="regroup-head">
        <h3 className="regroup-title">{title}</h3>
        {meals.length > 0 && (
          <p className="regroup-total num" data-testid="regroup-total">
            {totalText(meals)}
          </p>
        )}
      </div>
      {note && <p className="field-hint regroup-note">{note}</p>}
      {meals.length === 0 ? (
        <p className="regroup-none">{copy.setWake.none}</p>
      ) : (
        <ul className="regroup-list">
          {meals.map((m) => (
            <li key={m.id} data-testid="regroup-meal">
              <span className="regroup-time num">{fmtWeekdayTime(m.eatenAt)}</span>
              <span className="regroup-name">{m.name}</span>
              <span className="regroup-kcal num">
                {m.kcal === null ? copy.setWake.mealKcalUnknown : copy.setWake.mealKcal(fmtInt(m.kcal))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
