// spec.md > Other Tier 3 Pieces > Gym log (build-out item 2.6, slice 26; prd.md > Gym Log).
// - GymSummary: the dashboard's gym section for the viewed day: each session with its exercises,
//   their set counts and top working set. One tap opens the workout's details with every set.
//   When the day has no gym session it draws nothing.
// - GymSessionSets: a session's exercises with every set (its type in words, weight and reps, a
//   drop set's drops after it) and each exercise's best working set from earlier sessions. Used in
//   a workout's details and in the gym log.
// - GymLogSheet: every gym session across every date, newest first, found by exercise or split.
//   Its place (search, sessions shown) lives in App, so coming back from a session opened in it
//   lands on that session's row, with focus on its button.
// The numbers come from gymView.ts, worked out once; each look draws the same pieces (theme.css).

import { useEffect, useId, useRef } from 'react'
import type { WeightUnit, Workout } from '../kernel/types'
import { copy } from './copy'
import { gymHistory, HISTORY_PAGE, sessionView, type SessionView, type SummaryItem } from './gymView'
import { Sheet } from './Sheet'

interface SummaryProps {
  items: SummaryItem[]
  onOpenWorkout: (workoutId: string) => void
  onOpenLog: () => void
}

/** The day's gym sessions on the dashboard, or nothing on a day without one. */
export function GymSummary({ items, onOpenWorkout, onOpenLog }: SummaryProps) {
  if (items.length === 0) return null
  return (
    <section className="section gym-section" aria-labelledby="gym-title" data-testid="gym-summary">
      <div className="workout-head">
        <h2 className="section-title" id="gym-title">
          {copy.gym.sectionTitle}
        </h2>
        <button type="button" className="link-btn gym-open-log" onClick={onOpenLog} aria-label={copy.gym.allSessionsLabel} data-testid="gym-open-log">
          {copy.gym.allSessions}
          <span aria-hidden="true">{copy.arrow}</span>
        </button>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.workoutId} className="meal-row gym-row" data-testid="gym-summary-session">
            <button
              type="button"
              className="meal-open gym-open"
              onClick={() => onOpenWorkout(item.workoutId)}
              aria-label={item.label}
              data-opens="workout-details"
            >
              <span className="meal-main">
                <span className="meal-name">{item.name}</span>
                <span className="meal-meta num">{item.meta}</span>
                <span className="gym-summary-list">
                  {item.exercises.map((e, i) => (
                    <span key={i} className="gym-summary-ex" data-testid="gym-summary-exercise">
                      <span className="gym-ex-name">{e.name}</span>
                      <span className="gym-ex-text">{e.text}</span>
                    </span>
                  ))}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** A session's exercises with every set, and each exercise's best working set before it. */
export function GymSessionSets({ session }: { session: SessionView }) {
  return (
    <ul className="gym-ex-list" data-testid="gym-session-sets">
      {session.exercises.map((e, i) => (
        <li key={i} className="gym-ex" data-testid="gym-session-exercise">
          <h4 className="gym-ex-title">{e.name}</h4>
          <ol className="gym-set-list">
            {e.sets.map((s, si) => (
              <li key={si} className={`gym-set-line gym-kind-${s.kind}`} data-testid="gym-set-line">
                <span className="gym-kind">{s.kindLabel}</span>
                <span className={s.weighted ? 'gym-set-text num' : 'gym-set-text'}>{s.text}</span>
              </li>
            ))}
          </ol>
          <p className="gym-best" data-testid="gym-best-before">
            {e.best}
          </p>
        </li>
      ))}
    </ul>
  )
}

interface LogSheetProps {
  workouts: Workout[]
  unit: WeightUnit
  nowIso: string
  query: string
  onQuery: (q: string) => void
  /** How many matching sessions are shown (more come a page at a time). */
  shown: number
  onShown: (n: number) => void
  /** The session to return focus to as the sheet opens (the one just looked at), if any. */
  returnTo: string | null
  demo: boolean
  onClose: () => void
  onOpenWorkout: (workoutId: string) => void
  onLogSession: () => void
}

/** The gym log: every session by date, newest first, with a search by exercise or split. */
export function GymLogSheet(props: LogSheetProps) {
  const { workouts, unit, nowIso, query, onQuery, shown, onShown, returnTo, demo, onClose, onOpenWorkout, onLogSession } = props
  const id = useId()
  const listRef = useRef<HTMLOListElement>(null)
  const history = gymHistory(workouts, query)
  // Coming back to the session just looked at (App made sure its row is on the page): focus its
  // button, centred in the sheet. Runs after the Sheet's own first focus (a child's effects run
  // first), so it wins over Close.
  useEffect(() => {
    if (!returnTo) return
    const button = listRef.current?.querySelector<HTMLElement>(`[data-workout-id="${CSS.escape(returnTo)}"] [data-testid="gym-log-open"]`)
    if (!button) return
    button.focus({ preventScroll: true })
    button.scrollIntoView({ block: 'center' })
    // Once, as the sheet opens.
  }, [])
  // Show more: focus moves to the first session it brought in, since the button may go (the last
  // page) and focus must never drop to the page behind the sheet.
  const focusRow = useRef<number | null>(null)
  useEffect(() => {
    const at = focusRow.current
    if (at === null) return
    focusRow.current = null
    const row = listRef.current?.children[at]
    row?.querySelector<HTMLElement>('[data-testid="gym-log-open"]')?.focus()
  }, [shown])
  const page = history.matches.slice(0, shown)
  const more = history.matches.length - page.length
  const q = query.trim()
  const footer = (
    <div className="sheet-actions">
      <button type="button" className="btn btn-primary" onClick={onLogSession} data-testid="gym-log-new">
        {copy.gym.logSession}
      </button>
    </div>
  )
  return (
    <Sheet
      title={copy.gym.historyTitle}
      sub={history.total > 0 ? copy.gym.historySub(history.total) : undefined}
      demo={demo}
      onClose={onClose}
      testId="gym-log"
      footer={footer}
    >
      {history.total === 0 ? (
        <p data-testid="gym-log-none">{copy.gym.none}</p>
      ) : (
        <>
          <div className="field meal-form">
            <label htmlFor={`${id}-search`}>{copy.gym.search}</label>
            <input
              id={`${id}-search`}
              type="search"
              value={query}
              onChange={(e) => {
                onQuery(e.target.value)
                onShown(HISTORY_PAGE)
              }}
              autoComplete="off"
              aria-describedby={`${id}-search-hint`}
              data-testid="gym-search"
            />
            <p className="field-hint" id={`${id}-search-hint`}>
              {copy.gym.searchHint}
            </p>
          </div>
          <p className="small">{copy.gym.bestRule}</p>
          <p className="small" role="status" data-testid="gym-log-status">
            {history.matches.length === 0 ? copy.gym.noMatch(q) : copy.gym.matches(history.matches.length, history.total)}
          </p>
          <ol className="gym-log-list" ref={listRef}>
            {page.map((w) => {
              const s = sessionView(w, workouts, unit, nowIso)
              return (
                <li key={w.id} className="gym-log-session" data-testid="gym-log-session" data-workout-id={w.id}>
                  <h3 className="gym-log-head">
                    <button
                      type="button"
                      className="link-btn gym-log-open"
                      onClick={() => onOpenWorkout(w.id)}
                      aria-label={copy.gym.openSession(s.name, s.when)}
                      data-testid="gym-log-open"
                    >
                      {s.name}
                    </button>
                    <span className="gym-log-when num">{s.when}</span>
                  </h3>
                  <p className="small">{s.counts}</p>
                  <GymSessionSets session={s} />
                </li>
              )
            })}
          </ol>
          {more > 0 && (
            <button type="button" className="btn" onClick={() => {
                focusRow.current = page.length
                onShown(shown + HISTORY_PAGE)
              }} data-testid="gym-log-more">
              {copy.gym.showMore(Math.min(more, HISTORY_PAGE))}
            </button>
          )}
        </>
      )}
    </Sheet>
  )
}
