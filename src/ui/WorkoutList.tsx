// spec.md > Screens > WorkoutList.tsx (build-out item 2.5a, slice 10; prd.md > Workouts and Net
// Calories): the day's workouts, and the list Burned opens under the net headline.
// - WorkoutRows: each row shows name, start time, duration, calories burned and how you know, with
//   its estimate score; the whole row is one button that opens the workout's details. Journal and
//   Night draw the meal list's row; Panel adds the same thin score bar its meal rows have.
// - WorkoutSection: the dashboard's Workouts section, under the meals, with Log a workout. The
//   Night look draws the workouts on its timeline instead, so it shows only the button.
// - WorkoutListSheet: burned's total, its own estimate score and both ranges in the header (from
//   net.combineBurned, the same numbers the headline uses), then each workout. It says what burned
//   leaves out: resting burn.
// A workout with unknown calories shows "unknown", never 0, and has no score.

import { estimateWorkout } from '../kernel/net'
import { getSource } from '../kernel/sources'
import type { BurnSourceId, Workout } from '../kernel/types'
import { copy } from './copy'
import type { DayView } from './dayView'
import { fmtInt, fmtPct, fmtRange, fmtTimeInDay } from './format'
import { useLook } from './lookContext'
import { Sheet } from './Sheet'
import { SourceBasisList } from './SourceBasis'

/** The workout's start time, with its weekday (and a week or more on, its date) when it falls on a later calendar date than the wake. */
export function workoutTimeLabel(w: Workout, dayStart: string | null): string {
  return fmtTimeInDay(w.startedAt, dayStart)
}

export function workoutSourceLabel(source: BurnSourceId | null): string {
  return source === null ? copy.workouts.sourceNotPicked : getSource(source).label
}

export function workoutDuration(w: Workout): string {
  return w.minutes === null ? copy.workouts.durationUnknown : copy.workouts.minutes(fmtInt(w.minutes))
}

export function workoutKcal(w: Workout): string {
  return w.kcal === null ? copy.workouts.unknownKcal : copy.workouts.kcalBurned(fmtInt(w.kcal))
}

interface RowsProps {
  workouts: Workout[]
  dayStart: string | null
  onOpenWorkout: (workoutId: string) => void
}

export function WorkoutRows({ workouts, dayStart, onOpenWorkout }: RowsProps) {
  const { look } = useLook()
  const panel = look === 'panel'
  return (
    <ul data-testid="workout-list">
      {workouts.map((w) => {
        const est = estimateWorkout(w)
        const meta = copy.workouts.meta(workoutTimeLabel(w, dayStart), workoutDuration(w), workoutSourceLabel(w.source))
        const kcal = workoutKcal(w)
        const score = est ? copy.workouts.rowScore(String(est.score)) : copy.workouts.noScore
        const label = copy.workouts.rowLabel(w.name, meta, kcal, score)
        return (
          <li key={w.id} className="meal-row workout-row" data-testid="workout-row" data-workout-id={w.id}>
            <button
              type="button"
              className="meal-open"
              onClick={() => onOpenWorkout(w.id)}
              aria-label={label}
              data-testid="workout-open"
              data-opens="workout-details"
            >
              {panel ? (
                <>
                  <span className="meal-name">{w.name}</span>
                  <span className={w.kcal === null ? 'meal-kcal unknown' : 'meal-kcal num'}>{kcal}</span>
                  {est && (
                    <span className="score-bar" aria-hidden="true">
                      <span className="score-fill" style={{ width: `${est.score}%` }} />
                    </span>
                  )}
                  <span className="meal-sub">
                    <span className="meal-meta num">{meta}</span>
                    <span className={est ? 'meal-score num' : 'meal-score none'} data-testid="workout-score">
                      {score}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span className="meal-main">
                    <span className="meal-name">{w.name}</span>
                    <span className="meal-meta num">{meta}</span>
                  </span>
                  <span className="meal-right">
                    <span className={w.kcal === null ? 'meal-kcal unknown' : 'meal-kcal num'}>{kcal}</span>
                    <span className={est ? 'meal-score num' : 'meal-score none'} data-testid="workout-score">
                      {est ? copy.workouts.rowScoreShort(String(est.score)) : copy.workouts.noScore}
                    </span>
                  </span>
                </>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

interface SectionProps extends RowsProps {
  onLogWorkout: () => void
}

/** The dashboard's Workouts section (Journal and Panel), or just Log a workout (Night). */
export function WorkoutSection({ workouts, dayStart, onOpenWorkout, onLogWorkout }: SectionProps) {
  const { look } = useLook()
  const button = (
    <button type="button" className="btn log-workout-btn" onClick={onLogWorkout} data-testid="log-workout">
      {copy.workouts.logWorkout}
    </button>
  )
  if (look === 'night') return <div className="night-log-workout">{button}</div>
  return (
    <section className="section workout-section" aria-labelledby="workouts-title" data-testid="workout-section">
      <div className="workout-head">
        <h2 className="section-title" id="workouts-title">
          {copy.workouts.sectionTitle}
        </h2>
        {button}
      </div>
      {workouts.length > 0 ? (
        <WorkoutRows workouts={workouts} dayStart={dayStart} onOpenWorkout={onOpenWorkout} />
      ) : (
        <p className="workout-none small" data-testid="workouts-none">
          {copy.workouts.none}
        </p>
      )}
    </section>
  )
}

/** The workout list's heading id in Burned's detail, apart from the dashboard's Workouts heading. */
const HEADING_ID = 'burned-workouts-title'

interface ListSheetProps {
  view: DayView
  today: boolean
  demo: boolean
  onClose: () => void
  onOpenWorkout: (workoutId: string) => void
  onLogWorkout: () => void
}

/** Burned's detail: its total, own score and ranges, then each workout (spec.md > WorkoutList). */
export function WorkoutListSheet({ view, today, demo, onClose, onOpenWorkout, onLogWorkout }: ListSheetProps) {
  const { burned, workouts, dayStart } = view
  const known = workouts.filter((w) => w.kcal !== null && w.source !== null)
  const footer = (
    <div className="sheet-actions">
      <button type="button" className="btn btn-primary" onClick={onLogWorkout} data-testid="list-log-workout">
        {copy.workouts.logWorkout}
      </button>
    </div>
  )
  return (
    <Sheet
      title={today ? copy.workouts.listTitle : copy.workouts.listTitleEarlierDay}
      sub={workouts.length > 0 ? copy.workouts.listSub(workouts.length) : undefined}
      demo={demo}
      onClose={onClose}
      testId="workouts-sheet"
      footer={footer}
    >
      {burned.status === 'complete' || burned.status === 'partial' ? (
        <div className="details-head">
          <p className="big-figure num" data-testid="burned-total">
            {copy.units.kcalValue(fmtInt(burned.knownTotal))}
          </p>
          {burned.score !== null && (
            <p className="score-pill num" data-testid="burned-score">
              {copy.workouts.rowScore(String(burned.score))}
            </p>
          )}
        </div>
      ) : (
        <p className="small" data-testid="burned-total">
          {workouts.length === 0 ? copy.workouts.listNone : copy.workouts.burnedNotAvailable}
        </p>
      )}

      {/* The same header block as Eaten's detail: the total and its score, then both ranges. */}
      {burned.likely && burned.veryLikely && (
        <div className="range-legend detail-ranges num">
          <p className="range-row" data-testid="burned-likely">
            <span className="range-name">{copy.headline.likely}</span>
            <span className="range-value">{fmtRange(burned.likely)}</span>
          </p>
          <p className="range-row" data-testid="burned-very-likely">
            <span className="range-name">{copy.headline.veryLikely}</span>
            <span className="range-value">{fmtRange(burned.veryLikely)}</span>
          </p>
        </div>
      )}
      {burned.status === 'partial' && <p className="small">{copy.workouts.listKnownOnly}</p>}
      <p className="small" data-testid="burned-resting">
        {copy.net.restingShort}
      </p>

      {workouts.length > 0 && (
        <div data-testid="burned-workouts">
          <p className="field-hint">{copy.workouts.listIntro}</p>
          <section className="section" aria-labelledby={HEADING_ID}>
            <h2 className="section-title" id={HEADING_ID}>
              {copy.workouts.sectionTitle}
            </h2>
            <WorkoutRows workouts={workouts} dayStart={dayStart} onOpenWorkout={onOpenWorkout} />
          </section>
        </div>
      )}

      {burned.e !== null && burned.score !== null && (
        <details className="more">
          <summary>{copy.sheet.moreDetail}</summary>
          <div className="more-body">
            <p>{copy.workouts.scoreSentence}</p>
            <div>
              <h3>{copy.explainDay.combinedTitle}</h3>
              <p className="small">{copy.workouts.combinedGroups}</p>
              <ul className="fact-list num">
                {burned.groups.map((g) => (
                  <li key={g.source}>
                    <span>{copy.workouts.groupLine(getSource(g.source).label, fmtInt(g.sd))}</span>
                  </li>
                ))}
              </ul>
              <p className="num" data-testid="burned-combined">
                {copy.workouts.combinedLine(fmtInt(burned.sd), fmtInt(burned.knownTotal), fmtPct(burned.e), String(burned.score))}
              </p>
              <p className="num">{copy.workouts.how(fmtPct(burned.e, 2))}</p>
            </div>
            <div>
              <h3>{copy.more.sourcesTitle}</h3>
              <SourceBasisList ids={known.map((w) => w.source as BurnSourceId)} />
            </div>
            <p className="small">{copy.workouts.designTargets}</p>
          </div>
        </details>
      )}
    </Sheet>
  )
}
