// Build-out item 1.5.2c, Night look: the waking day as a vertical timeline (nightTimeline.ts
// lists the points). The first point is the wake with last night's length; each meal sits at its
// time with its name, calories, source and score; the day ends with now (awake), or with the sleep
// start that closed it. The meal with the biggest uncertainty carries those words and Improve on
// its own point, in an amber-tinted box. A meal after midnight says it is still on the waking
// day's weekday. The 7-night average sits on the last point.
//
// Every meal point is one button that opens the meal's details, with an accessible name that says
// everything on it, as in the other looks (MealList.tsx). The meal points keep the meal list's
// test ids and classes (meal-row, meal-open, meal-kcal), so every check that reads the list reads
// this one too. Dots and the line are drawn for the eye only; every point says what it is in words.

import { estimateMeal } from '../kernel/estimate'
import type { Meal } from '../kernel/types'
import { copy } from './copy'
import type { DayView } from './dayView'
import { fmtInt, fmtTime, fmtWeekday, fmtWeekdayFull } from './format'
import { mealSourceLabel, mealTimeLabel } from './MealList'
import { timelinePoints, type TimelinePoint } from './nightTimeline'
import { fmtDuration, type SleepView } from './sleepView'

interface NightTimelineProps {
  view: DayView
  sleep: SleepView
  /** The open log's now: the current day ends with it. */
  nowIso: string
  onOpenMeal: (mealId: string) => void
  onImprove: (mealId: string) => void
}

export function NightTimeline({ view, sleep, nowIso, onOpenMeal, onImprove }: NightTimelineProps) {
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
            key={p.kind === 'meal' ? p.meal.id : `${p.kind}-${i}`}
            point={p}
            view={view}
            average={average}
            onOpenMeal={onOpenMeal}
            onImprove={onImprove}
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
  onImprove: (mealId: string) => void
}

/** A time in the left column; after midnight its weekday sits above it ("Thu" over "12:40 AM"). */
function Time({ iso, laterDate }: { iso: string; laterDate: boolean }) {
  if (!laterDate) return <span className="tl-time num">{fmtTime(iso)}</span>
  return (
    <span className="tl-time num">
      <span className="tl-weekday">{fmtWeekday(iso)}</span> <span>{fmtTime(iso)}</span>
    </span>
  )
}

function Point({ point, view, average, onOpenMeal, onImprove }: PointProps) {
  switch (point.kind) {
    case 'wake':
      return (
        <li className="tl-point tl-row" data-testid="tl-wake">
          <Time iso={point.at} laterDate={false} />
          <span className="tl-dot hollow" aria-hidden="true" />
          <span className="tl-body">
            <span className="tl-line">
              <span className="tl-main">{copy.night.wokeUp}</span>
              {point.sleptMinutes !== null ? (
                <span className="tl-side" data-testid="last-night">
                  {copy.night.slept(fmtDuration(point.sleptMinutes))}
                </span>
              ) : (
                <span className="tl-side not-logged" data-testid="last-night">
                  {copy.night.sleepNotLogged}
                </span>
              )}
            </span>
          </span>
        </li>
      )
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
          <span className="tl-body">
            <span className="tl-main">{copy.emptyDay.noMeals}</span>
          </span>
        </li>
      )
    case 'meal':
      return <MealPoint meal={point.meal} laterDate={point.laterDate} biggest={point.biggest} view={view} onOpenMeal={onOpenMeal} onImprove={onImprove} />
    case 'now':
      return (
        <li className="tl-point tl-row tl-end" data-testid="tl-end">
          <span className="tl-time">{copy.night.now}</span>
          <span className="tl-dot hollow" aria-hidden="true" />
          <span className="tl-body">
            <span className="tl-line">
              <span className="tl-main num" data-testid="sleep-status">
                {copy.night.nowAwake(fmtTime(point.at))}
              </span>
              <span className="tl-side" data-testid="sleep-average">
                {average}
              </span>
            </span>
          </span>
        </li>
      )
    case 'asleep':
    case 'sleep':
      return (
        <li className="tl-point tl-row tl-end" data-testid="tl-end">
          {point.kind === 'asleep' ? (
            <Time iso={point.since} laterDate={point.laterDate} />
          ) : point.at !== null ? (
            <Time iso={point.at} laterDate={point.laterDate} />
          ) : (
            <span className="tl-time" />
          )}
          <span className="tl-dot hollow" aria-hidden="true" />
          <span className="tl-body">
            <span className="tl-line">
              {point.kind === 'sleep' && point.at === null ? (
                <span className="tl-main not-logged" data-testid="sleep-status">
                  {copy.night.sleepStartNotLogged}
                </span>
              ) : (
                <span className="tl-main" data-testid="sleep-status">
                  {copy.night.wentToSleep}
                  {point.kind === 'asleep' && (
                    <span className="tl-note">
                      {copy.sep}
                      {copy.night.asleepNow}
                    </span>
                  )}
                </span>
              )}
              <span className="tl-side" data-testid="sleep-average">
                {average}
              </span>
            </span>
          </span>
        </li>
      )
  }
}

interface MealPointProps {
  meal: Meal
  laterDate: boolean
  biggest: boolean
  view: DayView
  onOpenMeal: (mealId: string) => void
  onImprove: (mealId: string) => void
}

function MealPoint({ meal, laterDate, biggest, view, onOpenMeal, onImprove }: MealPointProps) {
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
      <button
        type="button"
        className="meal-open tl-row"
        onClick={() => onOpenMeal(meal.id)}
        aria-label={copy.meals.rowLabel(meal.name, meta, kcal, scoreLabel)}
        data-testid="meal-open"
      >
        <Time iso={meal.eatenAt} laterDate={laterDate} />
        <span
          className={meal.kcal === null ? 'tl-dot unknown' : biggest ? 'tl-dot amber' : est ? 'tl-dot' : 'tl-dot hollow'}
          aria-hidden="true"
        />
        <span className="tl-body">
          <span className="tl-line">
            <span className="meal-name">{meal.name}</span>
            <span className={meal.kcal === null ? 'meal-kcal unknown' : 'meal-kcal num'}>{kcal}</span>
          </span>
          <span className="tl-meta num">
            {source}
            {copy.sep}
            <span className={est ? 'meal-score' : 'meal-score none'} data-testid="meal-score">
              {est ? copy.night.score(String(est.score)) : copy.night.noScore}
            </span>
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
      </button>
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
