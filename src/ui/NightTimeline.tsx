// Build-out item 1.5.2c, Night look: the waking day as a vertical timeline (nightTimeline.ts
// lists the points). The first point is the wake with last night's length; each meal sits at its
// time with its name, calories, source and score; the day ends with now (awake), or with the sleep
// start that closed it. The meal with the biggest uncertainty carries those words and Improve on
// its own point, in an amber-tinted box. A meal after midnight says it is still on the waking
// day's weekday. The 7-night average sits on the last point.
//
// Every meal point opens the meal's details, with an accessible name that says
// everything on it, as in the other looks (MealList.tsx). The meal points keep the meal list's
// test ids and classes (meal-row, meal-open, meal-kcal), so every check that reads the list reads
// this one too. Dots and the line are drawn for the eye only; every point says what it is in words.
//
// Build-out item 2.2: the wake point and the sleep point at the end are buttons too. Each opens
// that night in the sleep and wake editor (the wake point: the night that started the day), and
// shows a small "Edit" under its words, so the way in is visible without hover (phones have none).
//
// Build-out item 2.9: every number opens its detail. A meal point has two targets (the meal's
// details, and its score's explanation); a sleep point's figure (last night's length, the 7-night
// average) is its own button that opens the sleep details, apart from the editor; the point for
// now opens the sleep details as a whole. Each number carries data-opens, naming what it opens.

import type { ReactNode } from 'react'
import { estimateMeal } from '../kernel/estimate'
import { estimateWorkout } from '../kernel/net'
import type { Meal, Workout } from '../kernel/types'
import { copy } from './copy'
import type { DayView } from './dayView'
import { fmtInt, fmtTime, fmtWeekday, fmtWeekdayFull, fmtWeekdayTime } from './format'
import { mealSourceLabel, mealTimeLabel } from './MealList'
import { timelinePoints, type TimelinePoint } from './nightTimeline'
import { TimesTogether } from './KeepTogether'
import { fmtDuration, type SleepView } from './sleepView'
import { workoutDuration, workoutKcal, workoutSourceLabel, workoutTimeLabel } from './WorkoutList'

interface NightTimelineProps {
  view: DayView
  sleep: SleepView
  /** The open log's now: the current day ends with it. */
  nowIso: string
  onOpenMeal: (mealId: string) => void
  /** Opens a meal's score explanation (build-out item 2.9). */
  onOpenScore: (mealId: string) => void
  /** Opens the sleep details (build-out item 2.9): last night's length, the 7-night average and now. */
  onOpenSleep: () => void
  onImprove: (mealId: string) => void
  /** Opens a workout's details (build-out item 2.5a). */
  onOpenWorkout: (workoutId: string) => void
  /** Opens the sleep and wake editor on one night (build-out item 2.2). */
  onEditNight: (recordId: string) => void
  /**
   * Shown under "No meals logged yet" on an empty day: the latest-meal line (build-out item
   * 2.1b), so it sits with the words it is about, as it does in the other looks' empty-day tile.
   */
  emptyNote?: ReactNode
}

export function NightTimeline({ view, sleep, nowIso, onOpenMeal, onOpenScore, onOpenSleep, onImprove, onOpenWorkout, onEditNight, emptyNote }: NightTimelineProps) {
  const points = timelinePoints(view, sleep, nowIso)
  const average = sleep.stats.avgMinutes !== null ? copy.night.average(fmtDuration(sleep.stats.avgMinutes)) : copy.night.averageNotAvailable
  return (
    <section className="section night-timeline" aria-labelledby="timeline-title" data-testid="timeline">
      <h2 className="visually-hidden" id="timeline-title">
        {copy.night.timelineTitle}
      </h2>
      <ol className="tl" data-testid="meal-list">
        {points.map((p, i) => (
          <Point
            key={p.kind === 'meal' ? p.meal.id : p.kind === 'workout' ? p.workout.id : `${p.kind}-${i}`}
            point={p}
            view={view}
            average={average}
            onOpenMeal={onOpenMeal}
            onOpenScore={onOpenScore}
            onOpenSleep={onOpenSleep}
            onImprove={onImprove}
            onOpenWorkout={onOpenWorkout}
            onEditNight={onEditNight}
            emptyNote={emptyNote}
          />
        ))}
      </ol>
    </section>
  )
}

interface PointProps {
  point: TimelinePoint
  view: DayView
  /** The 7-night average line, shown on the day's last point. */
  average: string
  onOpenMeal: (mealId: string) => void
  onOpenScore: (mealId: string) => void
  onOpenSleep: () => void
  onImprove: (mealId: string) => void
  onOpenWorkout: (workoutId: string) => void
  onEditNight: (recordId: string) => void
  emptyNote?: ReactNode
}

/**
 * The words of a point that opens its night in the editor (build-out item 2.2). Build-out item
 * 2.9: the button holds the point's main words, and its tap layer (::after, theme.css) covers the
 * whole point, so a tap anywhere on it still opens the editor; the sleep figure beside the words
 * (last night's length, the 7-night average) is its own button above that layer, opening the sleep
 * details. With no record to open, the words are plain.
 */
interface EditMainProps {
  recordId: string | null
  onEditNight: (id: string) => void
  /** The button's name: what the point says and which night it opens. */
  label: string
  /** The words say a time is not logged (amber). */
  notLogged?: boolean
  testId?: string
  children: ReactNode
}

function EditMain({ recordId, onEditNight, label, notLogged = false, testId, children }: EditMainProps) {
  if (recordId === null) {
    return (
      <span className={notLogged ? 'tl-main not-logged' : 'tl-main'} data-testid={testId}>
        {children}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={notLogged ? 'tl-main not-logged tl-edit-btn' : 'tl-main tl-edit-btn'}
      onClick={() => onEditNight(recordId)}
      aria-label={label}
      data-testid="tl-edit"
      data-opens="sleep-editor"
    >
      <span data-testid={testId}>{children}</span>
    </button>
  )
}

/** A point's row: a plain row, or one whose main words open the editor (EditMain). */
function NightRow({ recordId, children }: { recordId: string | null; children: ReactNode }) {
  return <div className={recordId === null ? 'tl-row' : 'tl-row tl-split'}>{children}</div>
}

/** The sleep figure on a point: last night's length or the 7-night average, opening the sleep details. */
function SleepFigure({ text, testId, notLogged, onOpenSleep }: { text: string; testId: string; notLogged: boolean; onOpenSleep: () => void }) {
  return (
    <button
      type="button"
      className={notLogged ? 'tl-side tl-side-btn not-logged' : 'tl-side tl-side-btn'}
      onClick={onOpenSleep}
      aria-label={copy.sleepDetail.openLabel(text)}
      data-testid={testId}
      data-opens="sleep-details"
    >
      {text}
    </button>
  )
}

/** The visible "Edit" under a point's words, when the point opens the editor. */
function EditCue({ recordId }: { recordId: string | null }) {
  if (recordId === null) return null
  return (
    <span className="tl-edit-cue" data-testid="tl-edit-cue">
      {copy.sleepEditor.edit}
    </span>
  )
}

/**
 * A time in the left column; after midnight its weekday sits above it ("Thu" over "12:40 AM"), and
 * a time HowSure placed rather than recorded (an imported meal, build-out item 2.1b) says "about".
 * `opens` names what a tap on it opens (the row's tap layer), for the tap-through test.
 */
function Time({ iso, laterDate, approx = false, opens }: { iso: string; laterDate: boolean; approx?: boolean; opens?: string }) {
  if (!laterDate && !approx)
    return (
      <span className="tl-time num" data-opens={opens}>
        {fmtTime(iso)}
      </span>
    )
  const above = [approx ? copy.night.about : null, laterDate ? fmtWeekday(iso) : null].filter(Boolean).join(' ')
  return (
    <span className="tl-time num" data-opens={opens}>
      <span className="tl-weekday">{above}</span> <span>{fmtTime(iso)}</span>
    </span>
  )
}

function Point({ point, view, average, onOpenMeal, onOpenScore, onOpenSleep, onImprove, onOpenWorkout, onEditNight, emptyNote }: PointProps) {
  switch (point.kind) {
    case 'wake': {
      const slept = point.sleptMinutes !== null ? copy.night.slept(fmtDuration(point.sleptMinutes)) : copy.night.sleepNotLogged
      const opens = point.recordId !== null ? 'sleep-editor' : undefined
      return (
        <li className="tl-point" data-testid="tl-wake">
          <NightRow recordId={point.recordId}>
            <Time iso={point.at} laterDate={false} opens={opens} />
            <span className="tl-dot hollow" aria-hidden="true" />
            <span className="tl-body">
              <span className="tl-line">
                <EditMain
                  recordId={point.recordId}
                  onEditNight={onEditNight}
                  label={copy.sleepEditor.editWake(copy.night.wokeAt(fmtTime(point.at)))}
                >
                  {copy.night.wokeUp}
                </EditMain>
                <SleepFigure text={slept} testId="last-night" notLogged={point.sleptMinutes === null} onOpenSleep={onOpenSleep} />
              </span>
              <EditCue recordId={point.recordId} />
            </span>
          </NightRow>
        </li>
      )
    }
    case 'noWake':
      return (
        <li className="tl-point tl-row" data-testid="tl-wake">
          <span className="tl-time" />
          <span className="tl-dot hollow" aria-hidden="true" />
          <span className="tl-body">
            <span className="tl-main not-logged">{copy.header.wakeTimeNotSet}</span>
          </span>
        </li>
      )
    case 'empty':
      return (
        <li className="tl-point tl-row tl-empty" data-testid="empty-day">
          <span className="tl-time" />
          <span className="tl-dot faint" aria-hidden="true" />
          {/* A div, so the latest-meal line (a paragraph) can sit under the words. */}
          <div className="tl-body">
            <span className="tl-main">{copy.emptyDay.noMeals}</span>
            {emptyNote}
          </div>
        </li>
      )
    case 'workout':
      return <WorkoutPoint workout={point.workout} laterDate={point.laterDate} view={view} onOpenWorkout={onOpenWorkout} />
    case 'meal':
      return (
        <MealPoint
          meal={point.meal}
          laterDate={point.laterDate}
          biggest={point.biggest}
          view={view}
          onOpenMeal={onOpenMeal}
          onOpenScore={onOpenScore}
          onImprove={onImprove}
        />
      )
    case 'now': {
      // Now's status and the 7-night average: one button that opens the sleep details. A wake more
      // than a day old (build-out item 2.1b) says no sleep was logged since, with now's weekday.
      const nowText = point.laterDate ? copy.night.nowNoSleep(fmtWeekdayTime(point.at)) : copy.night.nowAwake(fmtTime(point.at))
      return (
        <li className="tl-point tl-end" data-testid="tl-end">
          <button
            type="button"
            className="tl-row tl-open"
            onClick={onOpenSleep}
            aria-label={copy.sleepDetail.openLabel(`${copy.night.now} ${nowText}${copy.sep}${average}`)}
            data-testid="tl-now"
            data-opens="sleep-details"
          >
            <span className="tl-time">{copy.night.now}</span>
            <span className="tl-dot hollow" aria-hidden="true" />
            <span className="tl-body">
              <span className="tl-line">
                <span className="tl-main num" data-testid="sleep-status">
                  {point.laterDate ? <TimesTogether text={nowText} /> : nowText}
                </span>
                <span className="tl-side" data-testid="sleep-average">
                  {average}
                </span>
              </span>
            </span>
          </button>
        </li>
      )
    }
    case 'asleep':
    case 'sleep': {
      const startAt = point.kind === 'asleep' ? point.since : point.at
      // The editor button is named by the night it opens; the 7-night average beside it is its own button.
      const label =
        point.kind === 'asleep'
          ? copy.sleepEditor.editAsleep(fmtWeekdayTime(point.since))
          : startAt !== null
            ? copy.sleepEditor.editNightFrom(fmtWeekdayTime(startAt))
            : copy.sleepEditor.editNightNoStart
      const notLoggedStart = point.kind === 'sleep' && point.at === null
      return (
        <li className="tl-point tl-end" data-testid="tl-end">
          <NightRow recordId={point.recordId}>
            {startAt !== null ? (
              <Time iso={startAt} laterDate={point.laterDate} opens={point.recordId !== null ? 'sleep-editor' : undefined} />
            ) : (
              <span className="tl-time" />
            )}
            <span className="tl-dot hollow" aria-hidden="true" />
            <span className="tl-body">
              <span className="tl-line">
                <EditMain
                  recordId={point.recordId}
                  onEditNight={onEditNight}
                  label={label}
                  notLogged={notLoggedStart}
                  testId="sleep-status"
                >
                  {notLoggedStart ? (
                    copy.night.sleepStartNotLogged
                  ) : (
                    <>
                      {copy.night.wentToSleep}
                      {point.kind === 'asleep' && (
                        <span className="tl-note">
                          {copy.sep}
                          {copy.night.asleepNow}
                        </span>
                      )}
                    </>
                  )}
                </EditMain>
                <SleepFigure text={average} testId="sleep-average" notLogged={false} onOpenSleep={onOpenSleep} />
              </span>
              <EditCue recordId={point.recordId} />
            </span>
          </NightRow>
        </li>
      )
    }
  }
}

interface MealPointProps {
  meal: Meal
  laterDate: boolean
  biggest: boolean
  view: DayView
  onOpenMeal: (mealId: string) => void
  onOpenScore: (mealId: string) => void
  onImprove: (mealId: string) => void
}

function MealPoint({ meal, laterDate, biggest, view, onOpenMeal, onOpenScore, onImprove }: MealPointProps) {
  const est = estimateMeal(meal)
  const knownOnly = view.day.status === 'partial'
  const source = mealSourceLabel(meal.source)
  const stillDay = laterDate && view.dayStart !== null ? copy.night.stillDay(fmtWeekdayFull(view.dayStart)) : null
  const biggestWords = knownOnly ? copy.night.biggestKnownOnly : copy.night.biggest
  const kcal = meal.kcal === null ? copy.meals.unknownKcal : copy.units.kcalValue(fmtInt(meal.kcal))
  const scoreLabel = est
    ? biggest
      ? `${copy.meals.rowScore(String(est.score))}${copy.sep}${biggestWords}`
      : copy.meals.rowScore(String(est.score))
    : copy.meals.noScore
  const meta = copy.meals.meta(mealTimeLabel(meal, view.dayStart), source) + (stillDay ? `${copy.sep}${stillDay}` : '')

  return (
    <li className={biggest ? 'tl-point meal-row biggest' : 'tl-point meal-row'} data-testid="meal-row" data-meal-id={meal.id}>
      {/* Build-out item 2.9: two targets, as in the other looks. The name's button covers the
          whole point with its tap layer (theme.css), so a tap anywhere opens the details; the
          score is its own button above that layer, one tap from its explanation. */}
      <div className="meal-open meal-line tl-row">
        <Time iso={meal.eatenAt} laterDate={laterDate} approx={meal.timeApproximate === true} opens="meal-details" />
        <span
          className={meal.kcal === null ? 'tl-dot unknown' : biggest ? 'tl-dot amber' : est ? 'tl-dot' : 'tl-dot hollow'}
          aria-hidden="true"
        />
        <span className="tl-body">
          <span className="tl-line">
            <button
              type="button"
              className="meal-name-btn"
              onClick={() => onOpenMeal(meal.id)}
              aria-label={copy.meals.rowLabel(meal.name, meta, kcal, scoreLabel)}
              data-testid="meal-open"
              data-opens="meal-details"
            >
              <span className="meal-name">{meal.name}</span>
            </button>
            <span className={meal.kcal === null ? 'meal-kcal unknown' : 'meal-kcal num'} data-opens="meal-details">
              {kcal}
            </span>
          </span>
          <span className="tl-meta num">
            {source}
            {copy.sep}
            {est ? (
              <button
                type="button"
                className="meal-score meal-score-btn"
                onClick={() => onOpenScore(meal.id)}
                aria-label={copy.meals.scoreLabel(scoreLabel, meal.name)}
                data-testid="meal-score"
                data-opens="explain-meal"
              >
                {copy.night.score(String(est.score))}
              </button>
            ) : (
              <span className="meal-score none" data-testid="meal-score">
                {copy.night.noScore}
              </span>
            )}
            {biggest && (
              <>
                {copy.sep}
                <span className="tl-biggest" data-testid="tl-biggest">
                  {biggestWords}
                </span>
              </>
            )}
            {stillDay && (
              <>
                {copy.sep}
                <span className="tl-still" data-testid="still-day">
                  {stillDay}
                </span>
              </>
            )}
          </span>
        </span>
      </div>
      {biggest && view.biggest && (
        <p className="tl-improve">
          {/* The sentence the other looks show, for screen readers: on screen the words
              "biggest uncertainty" on this point say it, and Improve below acts on it. */}
          <span className="visually-hidden" data-testid="biggest-line">
            {knownOnly ? copy.uncertainty.mostFromKnownOnly(meal.name) : copy.uncertainty.mostFrom(meal.name)}
          </span>
          {view.improvement !== null ? (
            <button
              type="button"
              className="link-btn improve-link"
              onClick={() => onImprove(meal.id)}
              aria-label={copy.uncertainty.improveEntry}
              data-testid="improve-entry"
            >
              {copy.uncertainty.improveShort}
              <span aria-hidden="true">{copy.arrow}</span>
            </button>
          ) : (
            <span className="hint">{copy.uncertainty.alreadyBest}</span>
          )}
        </p>
      )}
    </li>
  )
}

interface WorkoutPointProps {
  workout: Workout
  laterDate: boolean
  view: DayView
  onOpenWorkout: (workoutId: string) => void
}

/**
 * Build-out item 2.5a: a workout on the timeline, at its start time. A diamond dot sets it apart
 * from the meals, and its words say it: "300 kcal burned", how you know and its score. One button
 * that opens the workout's details, as the meal points do.
 */
function WorkoutPoint({ workout, laterDate, view, onOpenWorkout }: WorkoutPointProps) {
  const est = estimateWorkout(workout)
  const source = workoutSourceLabel(workout.source)
  const kcal = workoutKcal(workout)
  const meta = copy.workouts.meta(workoutTimeLabel(workout, view.dayStart), workoutDuration(workout), source)
  const score = est ? copy.workouts.rowScore(String(est.score)) : copy.workouts.noScore
  return (
    <li className="tl-point workout-row tl-workout" data-testid="workout-row" data-workout-id={workout.id}>
      <button
        type="button"
        className="meal-open tl-row"
        onClick={() => onOpenWorkout(workout.id)}
        aria-label={copy.workouts.rowLabel(workout.name, meta, kcal, score)}
        data-testid="workout-open"
        data-opens="workout-details"
      >
        <Time iso={workout.startedAt} laterDate={laterDate} opens="workout-details" />
        <span className={workout.kcal === null ? 'tl-dot workout unknown' : 'tl-dot workout'} aria-hidden="true" />
        <span className="tl-body">
          <span className="tl-line">
            <span className="meal-name">{workout.name}</span>
            <span className={workout.kcal === null ? 'meal-kcal unknown' : 'meal-kcal num'}>{kcal}</span>
          </span>
          <span className="tl-meta num">
            {workoutDuration(workout)}
            {copy.sep}
            {source}
            {copy.sep}
            <span className={est ? 'meal-score' : 'meal-score none'} data-testid="workout-score">
              {est ? copy.workouts.nightScore(String(est.score)) : copy.workouts.nightNoScore}
            </span>
          </span>
        </span>
      </button>
    </li>
  )
}
