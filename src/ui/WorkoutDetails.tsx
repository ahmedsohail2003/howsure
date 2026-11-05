// A workout's details (build-out item 2.5a, slice 10; prd.md > Workouts and Net Calories: "Tap a
// workout for its details (burned with its range, score and source), Edit and Delete"). Its typical
// error comes from the sources table and says it is an assumption, with the nearest study. A
// workout with unknown calories gets no invented number: it says so. Delete asks first.

import { useState } from 'react'
import { estimateWorkout } from '../kernel/net'
import { getSource } from '../kernel/sources'
import type { Workout } from '../kernel/types'
import { copy } from './copy'
import { fmtPct, fmtRange, fmtWeekdayTime } from './format'
import { Sheet } from './Sheet'
import { BasisTag, SourceBasisItem } from './SourceBasis'
import { workoutDuration, workoutKcal, workoutSourceLabel, workoutTimeLabel } from './WorkoutList'

interface WorkoutDetailsProps {
  workout: Workout
  dayStart: string | null
  demo: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

export function WorkoutDetails({ workout, dayStart, demo, onClose, onEdit, onDelete }: WorkoutDetailsProps) {
  const [confirming, setConfirming] = useState(false)
  const est = estimateWorkout(workout)
  const source = workout.source === null ? null : getSource(workout.source)

  const footer = confirming ? (
    <div className="delete-confirm" data-testid="workout-delete-confirm">
      <p className="delete-confirm-text">{copy.workouts.confirmDelete(workout.name)}</p>
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={() => setConfirming(false)} data-testid="workout-delete-keep">
          {copy.workouts.keep}
        </button>
        <button type="button" className="btn btn-ink" onClick={onDelete} data-testid="workout-delete-confirm-btn">
          {copy.workouts.deleteConfirm}
        </button>
      </div>
    </div>
  ) : (
    <div className="sheet-actions split">
      <button type="button" className="btn btn-plain" onClick={() => setConfirming(true)} data-testid="delete-workout">
        {copy.workouts.delete}
      </button>
      <button type="button" className="btn btn-primary" onClick={onEdit} data-testid="edit-workout">
        {copy.workouts.edit}
      </button>
    </div>
  )

  return (
    <Sheet
      title={workout.name}
      sub={copy.explainMeal.sub(workoutSourceLabel(workout.source), workoutTimeLabel(workout, dayStart))}
      demo={demo}
      onClose={onClose}
      testId="workout-details"
      footer={footer}
    >
      {est && workout.kcal !== null ? (
        <div className="details-head">
          <p className="big-figure num" data-testid="workout-kcal">
            {workoutKcal(workout)}
          </p>
          <p className="score-pill num" data-testid="workout-details-score">
            {copy.headline.estimateScore(String(est.score))}
          </p>
        </div>
      ) : (
        <div className="callout amber details-callout" data-testid="workout-unknown">
          <p className="details-unknown-title" data-testid="workout-kcal">
            {copy.workouts.caloriesUnknown}
          </p>
          <p>{copy.workouts.unknownNote}</p>
        </div>
      )}

      <ul className="fact-list details-facts num" data-testid="workout-facts">
        {est && (
          <>
            <li data-testid="workout-likely">
              <span className="k">{copy.headline.likely}</span>
              <span>{fmtRange(est.likely)}</span>
            </li>
            <li data-testid="workout-very-likely">
              <span className="k">{copy.headline.veryLikely}</span>
              <span>{fmtRange(est.veryLikely)}</span>
            </li>
          </>
        )}
        <li data-testid="workout-started">
          <span className="k">{copy.workouts.started}</span>
          <span>{fmtWeekdayTime(workout.startedAt)}</span>
        </li>
        <li data-testid="workout-duration">
          <span className="k">{copy.workouts.durationLabel}</span>
          <span className={workout.minutes === null ? 'unknown' : undefined}>{workoutDuration(workout)}</span>
        </li>
        <li data-testid="workout-source">
          <span className="k">{copy.workouts.source}</span>
          {source ? (
            <span className="details-source">
              {copy.workouts.sourceLine(source.label, fmtPct(source.typicalError))} <BasisTag source={source} />
            </span>
          ) : (
            <span className="unknown">{copy.details.sourceNotPicked}</span>
          )}
        </li>
      </ul>

      {est && <p data-testid="workout-score-sentence">{copy.workouts.scoreMeans(String(est.score), fmtPct(est.e))}</p>}

      {source && (
        <div>
          <h3 className="section-title">{copy.workouts.basisLabel}</h3>
          <ul className="source-basis">
            <SourceBasisItem source={source} />
          </ul>
        </div>
      )}
      <p className="small">{copy.net.restingShort}</p>
    </Sheet>
  )
}
