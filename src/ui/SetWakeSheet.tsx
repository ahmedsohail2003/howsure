// **Set wake time** (build-out item 2.1; prd.md > Sleep and Waking Days > Before a wake time is
// set). Two steps:
//   1. the time: today or yesterday, and a time that starts at 7:00 AM (wakeSet.ts). A time later
//      than now, or one that clashes with a recorded sleep, shows inline and nothing is saved;
//   2. the regroup preview, when the log has meals: which meals fall into the day the new wake
//      starts (today, after Save) and which stay earlier, each with its own date, time and
//      calories, and each list's calories counted as the headline counts them. Save applies it;
//      Change the time goes back; Cancel, Close or Esc changes nothing.
// Enter in the time step submits it (the footer button is the form's submit button).
// Build-out item 2.2: the time field takes shorthand ("8", "8am", "20:30"; TimeTextInput), read
// the same way as in the sleep and wake editor, and the line under it shows AM or PM back.
// Workouts are listed with the meals, as the editor's move warning lists them; each list's
// calories still count meals only, as the headline does.
// With no meals or workouts logged there is nothing to regroup, so step 1 saves directly.

import { useId, useMemo, useState } from 'react'
import { parseClockTime } from '../kernel/parse'
import type { Meal, SleepRecord } from '../kernel/types'
import { copy } from './copy'
import { fmtInt, fmtWeekdayFull, fmtWeekdayTime } from './format'
import { TimesTogether } from './KeepTogether'
import { Sheet } from './Sheet'
import { problemText } from './sleepView'
import { TimeTextInput } from './WhenField'
import { ambiguityTip, workoutEntries, type DatedLog, type MovedEntry } from './sleepEdit'
import {
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
  /** The log's workouts: dated entries that change day with the meals. */
  workouts: DatedLog['workouts']
  /** The log's now: the latest time allowed, and where today and yesterday are counted from. */
  nowIso: string
  demo: boolean
  onSave: (sleeps: SleepRecord[]) => void
  /** Build-out item 2.2: the whole night instead, in the sleep and wake editor. */
  onAddNight?: () => void
  onClose: () => void
}

export function SetWakeSheet({ sleeps, meals, workouts, nowIso, demo, onSave, onAddNight, onClose }: SetWakeSheetProps) {
  const id = useId()
  const [day, setDay] = useState<WakeDay>(() => defaultWakeDay(nowIso))
  const [time, setTime] = useState(defaultWakeLabel)
  const [tried, setTried] = useState(false)
  const [step, setStep] = useState<'time' | 'preview'>('time')
  const dates = wakeDates(nowIso)
  const iso = wakeIso(nowIso, day, time)
  const result = useMemo(
    () => regroupForWake(meals, sleeps, iso, nowIso, undefined, workouts),
    [meals, sleeps, iso, nowIso, workouts],
  )
  const typed = parseClockTime(time)
  const error = !tried
    ? null
    : typed.kind !== 'value'
      ? copy.sleepEditor.errors.time
      : !result.ok
        ? problemText(result.problem)
        : null
  // Anything dated to regroup: then Next shows the preview first.
  const hasEntries = meals.length > 0 || workoutEntries(workouts).length > 0
  const formId = `${id}-form`
  const hintId = `${id}-hint`
  // The hint names the filled-in time; it shows only while the field still holds it.
  const showHint = time === defaultWakeLabel()
  // A bare hour from 1 to 12 reads on the 24-hour clock; say how to get the other half of the day.
  const tip = typed.kind === 'value' ? ambiguityTip(typed) : null

  function next() {
    setTried(true)
    if (!result.ok) return
    if (hasEntries) setStep('preview')
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
        <RegroupGroup
          testId="regroup-moving"
          title={copy.setWake.todayFrom(when)}
          meals={result.moving}
          workouts={result.movingWorkouts}
        />
        {result.staying.length + result.stayingWorkouts.length > 0 && (
          <RegroupGroup
            testId="regroup-staying"
            title={copy.setWake.earlier}
            note={copy.setWake.earlierNote}
            meals={result.staying}
            workouts={result.stayingWorkouts}
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
        {hasEntries ? copy.setWake.next : copy.setWake.save}
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
          <TimeTextInput
            id={`${id}-time`}
            value={time}
            onChange={setTime}
            invalid={error !== null}
            describedBy={showHint ? hintId : undefined}
            testId="set-wake-time"
          />
          {showHint && (
            <p className="field-hint" id={hintId} data-testid="set-wake-hint">
              {copy.setWake.timeHint(defaultWakeLabel())}
            </p>
          )}
          {error && (
            <p className="field-error" role="alert" data-testid="set-wake-error">
              <TimesTogether text={error} />
            </p>
          )}
        </div>
        {iso !== null && error === null && (
          <p className="field-hint" data-testid="set-wake-effect">
            <TimesTogether text={copy.setWake.startsDay(fmtWeekdayTime(iso))} />
            {tip && ` ${tip}`}
          </p>
        )}
        {onAddNight && (
          <p className="set-wake-night">
            <button type="button" className="link-btn" onClick={onAddNight} data-testid="set-wake-add-night">
              {copy.setWake.addNight}
            </button>
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
  /** Workouts in this list: shown with the meals in time order, outside the calories total. */
  workouts: MovedEntry[]
  testId: string
}

function RegroupGroup({ title, note, meals, workouts, testId }: RegroupGroupProps) {
  const rows = [
    ...meals.map((m) => ({
      key: `meal-${m.id}`,
      at: m.eatenAt,
      name: m.name,
      end: m.kcal === null ? copy.setWake.mealKcalUnknown : copy.setWake.mealKcal(fmtInt(m.kcal)),
      // A word ("unknown", "workout") is not set in the number style.
      word: m.kcal === null,
      testId: 'regroup-meal',
    })),
    ...workouts.map((w) => ({ key: `workout-${w.id}`, at: w.at, name: w.name, end: copy.sleepEditor.workout, word: true, testId: 'regroup-workout' })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return (
    <section className="regroup-group" data-testid={testId}>
      <div className="regroup-head">
        <h3 className="regroup-title">
          <TimesTogether text={title} />
        </h3>
        {meals.length > 0 && (
          <p className="regroup-total num" data-testid="regroup-total">
            {totalText(meals)}
          </p>
        )}
      </div>
      {note && <p className="field-hint regroup-note">{note}</p>}
      {rows.length === 0 ? (
        <p className="regroup-none">{copy.setWake.none}</p>
      ) : (
        <ul className="regroup-list">
          {rows.map((r) => (
            <li key={r.key} data-testid={r.testId}>
              <span className="regroup-time num">{fmtWeekdayTime(r.at)}</span>
              <span className="regroup-name">{r.name}</span>
              <span className={r.word ? 'regroup-kcal' : 'regroup-kcal num'}>{r.end}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
