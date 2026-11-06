// A date and a time, typed (build-out item 2.2). The time field takes shorthand ("8", "8am",
// "8:15 pm", "20:30"), read by the kernel's parseClockTime() through sleepEdit.ts, and the line
// under it says how it was read, with AM or PM and the weekday ("Reads as Thu 8:00 AM."). When it
// loses focus the text is tidied to that reading ("8" becomes "8:00 AM"); text that isn't a time
// is left as typed, with its message. Used by the sleep and wake editor and the sleep buttons;
// Set wake time uses the time field alone (TimeTextInput).

import { useId } from 'react'
import { copy } from './copy'
import { TimesTogether } from './KeepTogether'
import { MIN_NIGHT_DATE, readBack, readWhen, tidyTime, type WhenDraft } from './sleepEdit'

interface TimeTextInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  invalid: boolean
  describedBy?: string
  testId: string
}

/** The shorthand time field: plain text, so "8am" can be typed; tidied on blur. */
export function TimeTextInput({ id, value, onChange, invalid, describedBy, testId }: TimeTextInputProps) {
  return (
    <input
      id={id}
      type="text"
      className="num time-text"
      autoComplete="off"
      spellCheck={false}
      placeholder={copy.sleep.timePlaceholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => {
        const tidy = tidyTime(value)
        if (tidy !== value) onChange(tidy)
      }}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      data-testid={testId}
    />
  )
}

interface WhenFieldProps {
  legend: string
  value: WhenDraft
  onChange: (next: WhenDraft) => void
  /** The message for this field (a typing problem or an order-check problem), or null. */
  error: string | null
  /** Prefix for test ids: `${testId}-date-input`, `-time-input`, `-readback`, `-error`. */
  testId: string
  /** A line under the fields (what the default is, what blank means). */
  hint?: string | null
  /** The latest date the date field offers (today in your own log). */
  maxDate?: string
}

export function WhenField({ legend, value, onChange, error, testId, hint, maxDate }: WhenFieldProps) {
  const id = useId()
  const read = readWhen(value)
  const back = error ? null : readBack(read)
  // The date is the field to mark when the message is about it, or when it is past the latest date
  // allowed (a future-time error caused by the date, not the time). Otherwise the time is marked.
  const dateBad =
    error !== null &&
    (error === copy.sleepEditor.errors.date ||
      error === copy.sleepEditor.errors.dateRange ||
      (maxDate !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value.date) && value.date > maxDate))
  const described = [hint ? `${id}-hint` : '', back ? `${id}-back` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ')
  return (
    <fieldset className="field when-field" data-testid={`${testId}-field`}>
      <legend>{legend}</legend>
      <div className="when-row">
        <div className="when-part">
          <label htmlFor={`${id}-date`}>{copy.sleepEditor.date}</label>
          <input
            id={`${id}-date`}
            type="date"
            className="num"
            value={value.date}
            min={MIN_NIGHT_DATE}
            max={maxDate}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
            aria-invalid={dateBad ? true : undefined}
            aria-describedby={described || undefined}
            data-testid={`${testId}-date-input`}
          />
        </div>
        <div className="when-part">
          <label htmlFor={`${id}-time`}>{copy.sleepEditor.time}</label>
          <TimeTextInput
            id={`${id}-time`}
            value={value.time}
            onChange={(time) => onChange({ ...value, time })}
            invalid={error !== null && !dateBad}
            describedBy={described || undefined}
            testId={`${testId}-time-input`}
          />
        </div>
      </div>
      {hint && (
        <p className="field-hint" id={`${id}-hint`} data-testid={`${testId}-hint`}>
          <TimesTogether text={hint} />
        </p>
      )}
      {back && (
        <p className="field-hint when-readback" id={`${id}-back`} data-testid={`${testId}-readback`}>
          <TimesTogether text={back} />
        </p>
      )}
      {error && (
        <p className="field-error" role="alert" id={`${id}-error`} data-testid={`${testId}-error`}>
          <TimesTogether text={error} />
        </p>
      )}
    </fieldset>
  )
}
