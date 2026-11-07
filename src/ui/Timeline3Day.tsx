// The timeline (build-out item 2.8; checklist slice 18; prd.md > 3-Day Timeline; spec.md > Screens,
// Tier 3: Timeline3Day.tsx): the 3 waking days to the day on screen, or 4 with the day before.
//
// - At the top: the choice of 3 or 4 days, and the usual day length the expected-sleep marker is
//   drawn from (your setting, not advice; preset to 16 h, saved in the open log).
// - "Hour by hour": each day with a wake time drawn as one row on a shared scale, starting at its
//   wake (an SVG for the lines and marks; the sleep block and the axis labels are HTML so their words
//   keep their size). Midnight lines are named by the new date's weekday, so a snack after midnight
//   sits after the line and still on its waking day's row. The drawing is for the eye only
//   (aria-hidden): everything on it is also listed under "Each day".
// - "Each day": every entry in time order, with its time. The wake and the sleep that ended the day
//   open that night in the sleep editor; a meal, workout or weigh-in opens its details. The expected
//   sleep says what it is based on, on its own row.
//
// One component for every look: timelineView.ts works out the days, positions and order once, and
// each look's stylesheet (theme.css > timeline) chooses how they are drawn.

import { useId, type ReactNode } from 'react'
import { estimateMeal } from '../kernel/estimate'
import { estimateWorkout } from '../kernel/net'
import { DEFAULT_USUAL_DAY_HOURS, USUAL_DAY_MAX_HOURS, USUAL_DAY_MIN_HOURS } from '../kernel/sleepday'
import type { WeightUnit } from '../kernel/types'
import { copy } from './copy'
import { fmtDateInDay, fmtInt, fmtTime, fmtTimeInDay, fmtWeekdayDateTime } from './format'
import { mealSourceLabel } from './MealList'
import { Sheet } from './Sheet'
import { fmtDuration } from './sleepView'
import {
  fmtDayLength,
  fmtSleepLength,
  TIMELINE_SPANS,
  usualDayChoices,
  type DayDrawing,
  type LegendKind,
  type TimelineDay,
  type TimelineEntry,
  type TimelineSpan,
  type TimelineView,
} from './timelineView'
import { fmtWeight } from './weightView'
import { workoutDuration, workoutKcal, workoutSourceLabel } from './WorkoutList'

/** What an entry opens: a night in the sleep editor, or a meal's, workout's or weigh-in's details. */
export type TimelineTarget =
  | { kind: 'night'; recordId: string }
  | { kind: 'meal'; id: string }
  | { kind: 'workout'; id: string }
  | { kind: 'weighIn'; id: string }

interface TimelineSheetProps {
  timeline: TimelineView
  /** How weigh-ins are shown (settings.weightUnit). */
  unit: WeightUnit
  demo: boolean
  onClose: () => void
  onSpan: (span: TimelineSpan) => void
  onUsualHours: (hours: number) => void
  /**
   * Opens an entry; `dayStart` is its waking day. `keys` are the rows focus comes back to, in order
   * of preference: the entry, then the openable row after it, then the one before it (for when the
   * entry has gone: deleted, or its night removed).
   */
  onOpen: (target: TimelineTarget, dayStart: string | null, keys: string[]) => void
  /** The rows to focus when coming back from an entry, in order of preference. */
  focusKeys?: string[]
}

/** A value kept on one line inside running words: "1:15 PM", "16 h", "Score 90". */
const whole = (s: string) => s.replace(/ /g, '\u00a0')

export function TimelineSheet({ timeline, unit, demo, onClose, onSpan, onUsualHours, onOpen, focusKeys = [] }: TimelineSheetProps) {
  const id = useId()
  const choices = usualDayChoices(timeline.usualHours, USUAL_DAY_MIN_HOURS, USUAL_DAY_MAX_HOURS)
  const anyDrawn = timeline.days.some((d) => d.drawing !== null)
  // Every row that opens something, in list order, so focus can come back beside one that has gone.
  const openable = timeline.days.flatMap((d) => d.entries.filter((e) => targetOf(e) !== undefined).map((e) => e.key))
  const open = (target: TimelineTarget, dayStart: string | null, key: string) => {
    const i = openable.indexOf(key)
    const near = [openable[i + 1], openable[i - 1]].filter((k): k is string => k !== undefined)
    onOpen(target, dayStart, [key, ...near])
  }
  return (
    <Sheet
      title={copy.timeline.title}
      sub={timeline.window}
      subShort={timeline.windowShort ?? undefined}
      demo={demo}
      onClose={onClose}
      testId="timeline-view"
      initialFocusTestId={focusKeys.length > 0 ? focusKeys.map((k) => `tld-open-${k}`) : undefined}
    >
      {/* While only the time before the first wake time is shown, neither setting changes anything: a line says when they apply. */}
      {!anyDrawn && (
        <p className="field-hint" data-testid="timeline-settings-later">
          {copy.timeline.settingsLater}
        </p>
      )}
      {anyDrawn && (
        <div className="meal-form tld-settings">
          <fieldset className="field source-field unit-field tld-span">
            <legend>{copy.timeline.spanGroup}</legend>
            <div className="source-options unit-options">
              {TIMELINE_SPANS.map((n) => (
                <label key={n} className={timeline.span === n ? 'source-option checked' : 'source-option'}>
                  <input
                    type="radio"
                    name={`${id}-span`}
                    value={n}
                    checked={timeline.span === n}
                    onChange={() => onSpan(n)}
                    data-testid={`timeline-span-${n}`}
                  />
                  <span className="source-label">{copy.timeline.spanOption(String(n))}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field tld-usual">
            <label htmlFor={`${id}-usual`}>{copy.timeline.usualLabel}</label>
            <select
              id={`${id}-usual`}
              value={String(timeline.usualHours)}
              onChange={(e) => onUsualHours(Number(e.target.value))}
              aria-describedby={`${id}-usual-hint`}
              data-testid="timeline-usual"
            >
              {choices.map((h) => (
                <option key={h} value={String(h)}>
                  {fmtDayLength(h)}
                </option>
              ))}
            </select>
            <p className="field-hint" id={`${id}-usual-hint`} data-testid="timeline-usual-hint">
              {copy.timeline.usualHint}
              {!timeline.usualSaved && ` ${copy.timeline.usualPreset(fmtDayLength(DEFAULT_USUAL_DAY_HOURS))}`}
              {demo && ` ${copy.timeline.usualSavedDemo}`}
            </p>
          </div>
        </div>
      )}

      <section className="tld-drawing-section" aria-labelledby={`${id}-drawing`}>
        <h3 className="section-title" id={`${id}-drawing`}>
          {copy.timeline.drawingTitle}
        </h3>
        {anyDrawn && <p className="field-hint">{copy.timeline.drawingNote}</p>}
        <figure className="tld-figure" aria-hidden="true" data-testid="timeline-drawing" data-scale-hours={timeline.scaleHours}>
          {timeline.days.map((d) => (
            <DayRow key={d.key} day={d} anyWake={timeline.anyWake} />
          ))}
          {/* A key only for a drawing that is there. */}
          {timeline.legend.length > 0 && <Legend kinds={timeline.legend} />}
        </figure>
      </section>

      <section className="tld-days" aria-labelledby={`${id}-days`}>
        <h3 className="section-title" id={`${id}-days`}>
          {copy.timeline.listTitle}
        </h3>
        {timeline.days.map((d) => (
          <section key={d.key} className="tld-day" aria-labelledby={`${id}-day-${d.key}`} data-testid="timeline-day" data-day={d.key}>
            <h4 className="tld-day-name" id={`${id}-day-${d.key}`}>
              <DayName day={d} />
            </h4>
            <ol className="tld-list">
              {d.entries.map((e) => (
                <EntryRow key={e.key} entry={e} day={d} unit={unit} hours={timeline.usualHours} anyWake={timeline.anyWake} onOpen={open} />
              ))}
            </ol>
          </section>
        ))}
      </section>
    </Sheet>
  )
}

/** "Wed Oct 21 · today" for the current day. */
function DayName({ day }: { day: TimelineDay }) {
  return (
    <>
      {day.name}
      {day.current && (
        <span className="tld-today">
          {copy.sep}
          {copy.timeline.today}
        </span>
      )}
    </>
  )
}

const pct = (x: number) => `${(x * 100).toFixed(3)}%`

/** One day of the drawing: its name, the strip and its axis. */
function DayRow({ day, anyWake }: { day: TimelineDay; anyWake: boolean }) {
  const d = day.drawing
  return (
    <div className="tld-row" data-testid="timeline-row" data-day={day.key}>
      <p className="tld-row-name">
        <DayName day={day} />
      </p>
      {d ? <Strip day={day} drawing={d} /> : <p className="tld-not-drawn">{anyWake ? copy.timeline.notDrawn : copy.timeline.notDrawnNoWake}</p>}
    </div>
  )
}

/** True for a mark whose calories are unknown: drawn hollow, and last, so a mark beside it never hides it. */
const unknownKcal = (e: TimelineEntry) => (e.kind === 'meal' && e.meal.kcal === null) || (e.kind === 'workout' && e.workout.kcal === null)

/** The words over the sleep: its length, the length so far, or that its start was not logged. */
function sleepNote(d: DayDrawing): { text: string; kind: 'length' | 'ongoing' | 'unlogged' } | null {
  if (d.sleep) {
    if (d.sleep.minutes === null) return null
    return d.sleep.ongoing
      ? { text: copy.timeline.soFar(fmtSleepLength(d.sleep.minutes)), kind: 'ongoing' }
      : { text: fmtSleepLength(d.sleep.minutes), kind: 'length' }
  }
  return d.unlogged ? { text: copy.timeline.unloggedNote, kind: 'unlogged' } : null
}

function Strip({ day, drawing: d }: { day: TimelineDay; drawing: DayDrawing }) {
  const marks = day.entries
    .filter((e) => e.x !== null && (e.kind === 'meal' || e.kind === 'workout' || e.kind === 'weighIn'))
    .sort((a, b) => Number(unknownKcal(a)) - Number(unknownKcal(b)))
  const sleepWidth = d.sleep ? Math.max(0, d.sleep.to - d.sleep.from) : 0
  // The track (recorded time awake) stops where the sleep starts, or where the unlogged stretch starts.
  const trackEnd = d.sleep ? Math.min(d.logged, d.sleep.from) : d.unlogged ? d.unlogged.from : d.logged
  const note = sleepNote(d)
  return (
    <>
      {/* The sleep's length (or that its start was not logged), written above the strip so it always shows. */}
      {d.note && note && (
        <div className="tld-note-lane">
          <span
            className={`tld-sleep-len ${d.note.align} ${note.kind}`}
            style={{ left: pct(d.note.x) }}
            data-testid="tld-sleep-length"
            data-note={note.kind}
          >
            {note.text}
          </span>
        </div>
      )}
      <div className="tld-strip" data-testid="timeline-strip">
        {d.sleep && (
          <div
            className={d.sleep.ongoing ? 'tld-sleep ongoing' : 'tld-sleep'}
            style={{ left: pct(d.sleep.from), width: pct(sleepWidth) }}
            data-testid="tld-sleep"
          />
        )}
        {d.unlogged && (
          <div
            className="tld-unlogged"
            style={{ left: pct(d.unlogged.from), width: pct(Math.max(0, d.unlogged.to - d.unlogged.from)) }}
            data-testid="tld-unlogged"
          />
        )}
        <svg className="tld-svg" focusable="false">
          {/* The track stops where the sleep starts: the block is the rest of the day. */}
          <line className="tld-track" x1="0" x2={pct(trackEnd)} y1="50%" y2="50%" />
          {/* The rest of today, up to expected sleep: only on the current day, while awake. */}
          {d.ahead && <line className="tld-track ahead" x1={pct(d.ahead.from)} x2={pct(d.ahead.to)} y1="50%" y2="50%" data-testid="tld-ahead" />}
          {d.midnights.map((x) => (
            <line key={x} className="tld-midnight" x1={pct(x)} x2={pct(x)} y1="0" y2="100%" data-testid="tld-midnight" />
          ))}
          <rect className="tld-wake" x="0" y="0" width="4" height="100%" data-testid="tld-mark" data-kind="wake" />
          <line
            className="tld-expected"
            x1={pct(d.expected)}
            x2={pct(d.expected)}
            y1="0"
            y2="100%"
            data-testid="tld-mark"
            data-kind="expected"
          />
          {/* The wake that ended an earlier day, inside the end of its sleep. */}
          {d.closingWake !== null && (
            <rect
              className="tld-wake closing"
              x={pct(d.closingWake)}
              y="0"
              width="4"
              height="100%"
              data-testid="tld-mark"
              data-kind="closingWake"
            />
          )}
          {marks.map((e) => (
            <svg key={e.key} x={pct(e.x as number)} y="50%" overflow="visible">
              {/* A mark too close to the one before it sits just above or below the track. */}
              <g className={e.lane === 0 ? undefined : e.lane < 0 ? 'tld-lane above' : 'tld-lane below'}>
                <Mark entry={e} />
              </g>
            </svg>
          ))}
          {/* Now: a filled triangle pointing down at the track, a shape no entry uses. */}
          {d.now !== null && (
            <svg x={pct(d.now)} y="50%" overflow="visible">
              <polygon className="tld-now" points="-6.5,-6 6.5,-6 0,6" data-testid="tld-mark" data-kind="now" data-shape="triangle" />
            </svg>
          )}
        </svg>
      </div>
      <div className="tld-axis">
        {d.ticks.map((x) => (
          <span key={x} className={d.midnights.includes(x) ? 'tld-tick midnight' : 'tld-tick'} style={{ left: pct(x) }} />
        ))}
        {d.labels.map((l) => (
          <span key={l.x} className={`tld-label ${l.align}${l.midnight ? ' midnight' : ''}`} style={{ left: pct(l.x) }} data-testid="tld-label">
            {l.text}
          </span>
        ))}
      </div>
    </>
  )
}

/** A meal (a dot) or a workout (a diamond), hollow amber with unknown calories, or a weigh-in (a square), centred on its time. */
function Mark({ entry: e }: { entry: TimelineEntry }) {
  if (e.kind === 'meal') {
    return (
      <circle
        className={e.meal.kcal === null ? 'tld-meal unknown' : 'tld-meal'}
        r="5"
        data-testid="tld-mark"
        data-kind="meal"
        data-key={e.key}
      />
    )
  }
  if (e.kind === 'workout') {
    return (
      <polygon
        className={e.workout.kcal === null ? 'tld-workout unknown' : 'tld-workout'}
        points="0,-6.5 6.5,0 0,6.5 -6.5,0"
        data-testid="tld-mark"
        data-kind="workout"
        data-key={e.key}
      />
    )
  }
  return <rect className="tld-weigh-in" x="-4" y="-4" width="8" height="8" data-testid="tld-mark" data-kind="weighIn" data-key={e.key} />
}

/** What each mark on the drawing means, in words beside a small copy of it: only the kinds drawn. */
function Legend({ kinds }: { kinds: LegendKind[] }) {
  const l = copy.timeline.legend
  return (
    <figcaption className="tld-legend" data-testid="timeline-legend">
      {kinds.map((kind) => (
        <span key={kind} className="tld-legend-item" data-kind={kind}>
          <span className={`tld-key ${kind}`} />
          {l[kind]}
        </span>
      ))}
    </figcaption>
  )
}

/** What an entry's row opens: its night in the sleep editor, or its details; nothing for the rest. */
function targetOf(e: TimelineEntry): TimelineTarget | undefined {
  switch (e.kind) {
    case 'wake':
      return e.recordId ? { kind: 'night', recordId: e.recordId } : undefined
    case 'meal':
      return { kind: 'meal', id: e.meal.id }
    case 'workout':
      return { kind: 'workout', id: e.workout.id }
    case 'weighIn':
      return { kind: 'weighIn', id: e.weighIn.id }
    case 'asleep':
    case 'sleep':
      return { kind: 'night', recordId: e.recordId }
    default:
      return undefined
  }
}

interface EntryRowProps {
  entry: TimelineEntry
  day: TimelineDay
  unit: WeightUnit
  /** The usual day length the expected-sleep marker is drawn from. */
  hours: number
  /** False while the log has no wake time at all. */
  anyWake: boolean
  /** Opens the entry; `key` is its row's key. */
  onOpen: (target: TimelineTarget, dayStart: string | null, key: string) => void
}

/**
 * A time in the list; on a later date than the wake, its weekday sits above it ("Thu" over
 * "12:40 AM"), with the date too 6 or more days on, where a weekday alone is ambiguous.
 */
function Time({ iso, laterDate, dayStart }: { iso: string; laterDate: boolean; dayStart: string | null }) {
  if (!laterDate) return <span className="tld-time num">{fmtTime(iso)}</span>
  return (
    <span className="tld-time num">
      <span className="tld-weekday">{fmtDateInDay(iso, dayStart)}</span> <span>{fmtTime(iso)}</span>
    </span>
  )
}

interface RowParts {
  time: ReactNode
  title: string
  value?: { text: string; number: boolean }
  detail?: string
  label?: string
  target?: TimelineTarget
}

/** The words of one entry, and what it opens. Everything shown is in its spoken name. */
function rowParts(e: TimelineEntry, day: TimelineDay, unit: WeightUnit, hours: number, anyWake: boolean): RowParts {
  const t = copy.timeline
  const blank = <span className="tld-time" />
  // A time in words: "6:30 PM", "Thu 12:40 AM", or with its date 6 or more days on.
  const when = (iso: string) => fmtTimeInDay(iso, day.dayStart)
  switch (e.kind) {
    case 'wake': {
      const detail = e.sleptMinutes !== null ? t.sleptBefore(whole(fmtDuration(e.sleptMinutes))) : t.nightBeforeNotLogged
      return {
        time: <Time iso={e.at} laterDate={false} dayStart={day.dayStart} />,
        title: t.wokeUp,
        detail,
        label: t.wakeLabel(fmtTime(e.at), detail),
        target: targetOf(e),
      }
    }
    case 'noWake':
      return { time: blank, title: anyWake ? t.noWake : t.noWakeYet }
    case 'empty':
      return { time: blank, title: t.noMeals }
    case 'meal': {
      const est = estimateMeal(e.meal)
      const kcal = e.meal.kcal === null ? copy.meals.unknownKcal : copy.units.kcalValue(fmtInt(e.meal.kcal))
      const source = mealSourceLabel(e.meal.source)
      const score = est ? copy.meals.rowScore(String(est.score)) : copy.meals.noScore
      const time = when(e.at)
      return {
        time: <Time iso={e.at} laterDate={e.laterDate} dayStart={day.dayStart} />,
        title: e.meal.name,
        value: { text: kcal, number: e.meal.kcal !== null },
        detail: `${source}${copy.sep}${est ? whole(copy.meals.rowScoreShort(String(est.score))) : t.noScore}`,
        label: copy.meals.rowLabel(e.meal.name, copy.meals.meta(time, source), kcal, score),
        target: targetOf(e),
      }
    }
    case 'workout': {
      const w = e.workout
      const est = estimateWorkout(w)
      const source = workoutSourceLabel(w.source)
      const time = when(e.at)
      const parts = [
        w.gym ? t.gymSession : null,
        whole(workoutDuration(w)),
        source,
        est ? whole(copy.workouts.rowScoreShort(String(est.score))) : t.noScore,
      ]
      const meta = copy.workouts.meta(time, workoutDuration(w), source)
      return {
        time: <Time iso={e.at} laterDate={e.laterDate} dayStart={day.dayStart} />,
        title: w.name,
        value: { text: workoutKcal(w), number: w.kcal !== null },
        detail: parts.filter((p): p is string => p !== null).join(copy.sep),
        label: copy.workouts.rowLabel(
          w.name,
          w.gym ? t.gymMeta(meta) : meta,
          workoutKcal(w),
          est ? copy.workouts.rowScore(String(est.score)) : copy.workouts.noScore,
        ),
        target: targetOf(e),
      }
    }
    case 'weighIn': {
      const w = e.weighIn
      const value = fmtWeight(w.kg, unit)
      const extra = [w.bodyFatPct !== undefined ? whole(copy.weight.bodyFat(String(w.bodyFatPct))) : null, w.note ?? null]
        .filter((x): x is string => x !== null)
        .join(copy.sep)
      // An imported weigh-in with no recorded time shows that in words, not a made-up time.
      const time = w.timeApproximate ? copy.weight.approxTime : when(e.at)
      return {
        time: w.timeApproximate ? <span className="tld-time words">{copy.weight.approxTime}</span> : <Time iso={e.at} laterDate={e.laterDate} dayStart={day.dayStart} />,
        title: t.weighIn,
        value: { text: value, number: true },
        detail: extra || undefined,
        label: t.weighInLabel(time, value, extra),
        target: targetOf(e),
      }
    }
    case 'expected':
      return {
        time: <Time iso={e.at} laterDate={e.laterDate} dayStart={day.dayStart} />,
        title: t.expected,
        detail: t.expectedBasis(whole(fmtDayLength(hours)), whole(fmtTime(day.dayStart as string))),
      }
    case 'now':
      return { time: <Time iso={e.at} laterDate={e.laterDate} dayStart={day.dayStart} />, title: t.now, detail: t.awake }
    case 'asleep': {
      const length = t.soFar(fmtSleepLength(e.minutesSoFar))
      return {
        time: <Time iso={e.at} laterDate={e.laterDate} dayStart={day.dayStart} />,
        title: t.wentToSleep,
        value: { text: length, number: true },
        detail: t.asleepNow,
        label: t.asleepLabel(when(e.at), length),
        target: targetOf(e),
      }
    }
    case 'sleep': {
      // The wake that ended the night, with its weekday when it is on a later date. Before the
      // first wake time there is no wake to count from, so the night's own start is the reference,
      // and with no start either the wake gives its weekday and date.
      const ref = day.dayStart ?? e.at
      const until = t.until(whole(ref === null ? fmtWeekdayDateTime(e.wake) : fmtTimeInDay(e.wake, ref)))
      if (e.at === null) {
        return {
          time: blank,
          title: t.sleepStartNotLogged,
          detail: until,
          label: t.sleepNoStartLabel(until),
          target: targetOf(e),
        }
      }
      const length = e.minutes !== null ? fmtSleepLength(e.minutes) : t.lengthUnknown
      return {
        time: <Time iso={e.at} laterDate={e.laterDate} dayStart={day.dayStart} />,
        title: t.wentToSleep,
        value: { text: length, number: e.minutes !== null },
        detail: until,
        label: t.sleepLabel(when(e.at), length, until),
        target: targetOf(e),
      }
    }
  }
}

function EntryRow({ entry, day, unit, hours, anyWake, onOpen }: EntryRowProps) {
  const p = rowParts(entry, day, unit, hours, anyWake)
  const inner = (
    <>
      {p.time}
      <span className={`tld-glyph tld-key ${glyphOf(entry)}`} aria-hidden="true" />
      <span className="tld-body">
        <span className="tld-line">
          <span className="tld-main">{p.title}</span>
          {p.value && <span className={p.value.number ? 'tld-value num' : 'tld-value words'}>{p.value.text}</span>}
        </span>
        {p.detail && <span className="tld-detail">{p.detail}</span>}
      </span>
    </>
  )
  const target = p.target
  return (
    <li className={`tld-entry ${entry.kind}`} data-testid="timeline-entry" data-kind={entry.kind} data-key={entry.key}>
      {target ? (
        <button
          type="button"
          className="tld-open tld-item"
          onClick={() => onOpen(target, day.dayStart, entry.key)}
          aria-label={p.label}
          data-testid={`tld-open-${entry.key}`}
        >
          {inner}
        </button>
      ) : (
        <div className="tld-item">{inner}</div>
      )}
    </li>
  )
}

/** The glyph beside a row: the same shape the drawing uses for it. */
function glyphOf(e: TimelineEntry): string {
  switch (e.kind) {
    case 'meal':
      return e.meal.kcal === null ? 'mealUnknown' : 'meal'
    case 'workout':
      return e.workout.kcal === null ? 'workoutUnknown' : 'workout'
    case 'asleep':
      return 'sleep'
    // A night whose sleep start was not logged: the hatched stretch the drawing shows for it.
    case 'sleep':
      return e.at === null ? 'unlogged' : 'sleep'
    case 'noWake':
    case 'empty':
      return 'none'
    default:
      return e.kind
  }
}
