// prd.md > Screens and Layout > Dashboard: header, headline estimate, macro row, Missing
// information, the biggest-uncertainty line with Improve that entry, Log a meal, and the meal
// list. A day with no meals says "No meals logged yet" with Log your first meal (prd.md > States
// and Boundaries). The sleep section (item 9) and previous/next with a date picker (item 10)
// sit at the bottom (slice 4). The header (DashboardHeader.tsx) shows the viewed waking day and
// its wake time, the guest name that opens Profile and privacy, and the More menu (item 1.3).
// Targets set in the targets editor show beside the score and under the macros (item 1.3).
//
// Build-out item 1.5.2, Journal look: no framed boxes on the dashboard surface. The biggest
// uncertainty is one line with a short Improve link (its heading words carry the amber signal).
// Log a meal and the sleep button sit together in one action bar: pinned to the bottom of the
// window on a phone (theme.css > action bar), in the layout on a wider screen. On a wide screen
// the day sits on the left and the meals, sleep and day controls on the right.
//
// Build-out item 1.5.2b, Panel look: the same pieces as tiles (theme.css > Panel). The headline,
// macros and meal list draw their own Panel variants; here the biggest uncertainty becomes a tile
// with its share of the day's uncertainty (the share the kernel already works out for the
// explanation, day.contributions) and an Improve button. On a wide screen the tiles flow into two
// columns, and three on the widest.
//
// Build-out item 1.5.2c, Night look: dark, built around the waking day. The headline draws its
// Night variant (the ranges on one line, then chips for the score, the target and the macros), and
// the meals become a timeline from the wake to now (NightTimeline.tsx), with the biggest
// uncertainty and Improve on that meal's own point. The sleep section keeps each night, one tap
// deep. On a wide screen the page stays one centred column: a timeline across the screen would
// squeeze a long day's labels together.
//
// Build-out item 2.5a (slice 10): the headline becomes net calories once the day has a workout
// (HeadlineEstimate.tsx), the day lists its workouts under the meals with Log a workout (on the
// Night timeline, workouts are points beside the meals), and a workout with unknown calories is
// listed under Missing information.

import { useEffect, useLayoutEffect, useRef } from 'react'
import type { LogKind } from '../clock'
import type { Profile } from '../store/log'
import { copy } from './copy'
import { DashboardHeader } from './DashboardHeader'
import type { DayView } from './dayView'
import { DayNav, type DayNavState } from './DayNav'
import { fmtSharePct } from './format'
import type { BalanceView } from './balanceView'
import { HeadlineEstimate } from './HeadlineEstimate'
import type { HeadlineOpen } from './headlineView'
import { useLook } from './lookContext'
import { MacroRow } from './MacroRow'
import { MealList } from './MealList'
import { NightTimeline } from './NightTimeline'
import { SleepSection } from './SleepSection'
import type { EditTarget } from './sleepEdit'
import type { SleepAction, SleepView } from './sleepView'
import { WorkoutSection } from './WorkoutList'
import { WeightSection } from './WeightSection'
import type { WeightView } from './weightView'

interface DashboardProps {
  kind: LogKind
  view: DayView
  onSwitch: () => void
  /** Set wake time (build-out item 2.1), while the log has no wake time; see DashboardHeader. */
  onSetWake?: () => void
  /** A one-line confirmation of the last action that changes nothing on screen by itself (Reset demo). */
  statusNote?: string | null
  /**
   * Build-out item 2.3: "Logged", after a meal is logged again from Recent or Saved (and "Undone"
   * after its Undo). It sits in the action bar, just above Log a meal, which is pinned to the
   * bottom on a phone, so it is in view however far the page was scrolled. `onUndo` adds Undo.
   */
  barNote?: string | null
  onUndo?: () => void
  undoLabel?: string
  /** Opens an explanation, or (net headline, build-out item 2.5a) the eaten or burned detail. */
  onOpen: (mode: HeadlineOpen) => void
  /** Opens the meal's edit sheet in improve mode (prd.md > Improve That Entry). */
  onImprove: (mealId: string) => void
  /** Opens the Log a meal sheet (prd.md > Logging a Meal). */
  onLogMeal: () => void
  /** Opens a meal's details (prd.md > Meal Details, Edit and Delete). */
  onOpenMeal: (mealId: string) => void
  /** Opens a workout's details, and Log a workout (build-out item 2.5a). */
  onOpenWorkout: (workoutId: string) => void
  onLogWorkout: () => void
  sleep: SleepView
  onSleepAction: (action: SleepAction) => void
  /**
   * Opens the sleep and wake editor (build-out item 2.2) on one night: from the header's wake
   * time, Edit in the sleep section, each night, and the Night timeline's wake and sleep points.
   */
  onEditNight: (target: EditTarget) => void
  /** Opens the editor on a new, missed night. */
  onAddNight: () => void
  /** The viewed day's weight (build-out item 2.4), the weight details, and Log weight. */
  weight: WeightView
  onOpenWeight: () => void
  onLogWeight: () => void
  nav: DayNavState
  onPrev: () => void
  onNext: () => void
  onPickDate: (date: string) => void
  onToday: () => void
  /** The guest name in your own log ('' until item 2.10 gives one). */
  ownName: string
  /** Opens Profile and privacy (build-out item 1.2). Your own log only. */
  onOpenProfile: () => void
  /** The open log's targets (build-out item 1.3), shown beside the score and under the macros. */
  targets: Profile['targets']
  /** Opens the targets editor (the Panel ring offers it when no calorie target is set). */
  onOpenTargets: () => void
  /** The estimated deficit or surplus under the headline, or what stands in for it (build-out item 2.5b). */
  balance?: BalanceView
  /** Opens Body details, from the line under the headline that invites adding them. */
  onOpenBody?: () => void
  /** The open log's now, where the Night timeline's current day ends. */
  nowIso: string
  /** Opens the More menu (build-out item 1.3). */
  onOpenMore: () => void
  moreOpen: boolean
  /** The full-screen view is on (build-out item 1.3); the header then offers the way back. */
  fullScreenOn: boolean
  onExitFullScreen: () => void
}

export function Dashboard(props: DashboardProps) {
  const { kind, view, onSwitch, onOpen, onImprove, onLogMeal, onOpenMeal, sleep, onSleepAction, nav, targets } = props
  const { dayStart, meals, day, biggest, improvement } = view
  const unknownMeals = meals.filter((m) => day.unknownMealIds.includes(m.id))
  const unknownWorkouts = view.workouts.filter((w) => view.burned.unknownWorkoutIds.includes(w.id))
  const knownOnly = day.status === 'partial'
  // The biggest meal's share of the day's uncertainty, as the explanation lists it.
  const biggestShare = biggest ? day.contributions.find((c) => c.mealId === biggest.id)?.share : undefined
  const asleep = sleep.status.kind === 'asleep'
  const actionBarRef = useActionBarHeight()
  const logBtnRef = useRef<HTMLButtonElement>(null)
  const barNoteRef = useRef<HTMLDivElement>(null)
  // On a wider screen the bar is in the layout: bring a new Logged line into view if the page was
  // scrolled past it (on a phone the bar is pinned, so this moves nothing).
  useEffect(() => {
    if (!props.barNote) return
    const frame = requestAnimationFrame(() => barNoteRef.current?.scrollIntoView({ block: 'nearest' }))
    return () => cancelAnimationFrame(frame)
  }, [props.barNote])
  const { look } = useLook()
  const panel = look === 'panel'
  const night = look === 'night'
  const dayRecordId = sleep.dayRecordId
  const editDay = dayRecordId ? () => props.onEditNight({ kind: 'edit', recordId: dayRecordId }) : undefined
  const editRecord = (recordId: string) => props.onEditNight({ kind: 'edit', recordId })
  const sleepSection = (
    <SleepSection sleep={sleep} today={nav.today} nowIso={props.nowIso} onEditNight={editRecord} onAddNight={props.onAddNight} />
  )
  const weightSection = (
    <WeightSection weight={props.weight} today={nav.today} onOpen={props.onOpenWeight} onLog={props.onLogWeight} />
  )

  return (
    <main className="page dash-page" data-testid="dashboard">
      <DashboardHeader
        kind={kind}
        dayStart={dayStart}
        ownName={props.ownName}
        onOpenProfile={props.onOpenProfile}
        onSwitch={onSwitch}
        onSetWake={props.onSetWake}
        onEditWake={editDay}
        onOpenMore={props.onOpenMore}
        moreOpen={props.moreOpen}
        fullScreenOn={props.fullScreenOn}
        onExitFullScreen={props.onExitFullScreen}
      />

      <p className="status-note" role="status" data-testid="status-note">
        {props.statusNote ?? ''}
      </p>

      {/* Two groups: the day's numbers, then the meals, sleep and day controls. They stack in
          the normal column; the full-screen view puts them side by side on a wide screen. */}
      <div className="dash-body">
        <div className="dash-col" data-testid="dash-col-day">
          <HeadlineEstimate
            view={view}
            onOpen={onOpen}
            today={nav.today}
            targetKcal={targets?.kcal}
            onSetTarget={props.onOpenTargets}
            dayKey={dayStart ?? 'provisional'}
            macros={night ? view.macros : undefined}
            targets={targets}
            balance={props.balance}
            onOpenBody={props.onOpenBody}
          />

          {day.status !== 'empty' && !night && <MacroRow macros={view.macros} targets={targets} />}

          {(unknownMeals.length > 0 || unknownWorkouts.length > 0) && (
            <section className="section" aria-labelledby="missing-title" data-testid="missing-info">
              <h2 className="section-title" id="missing-title">
                {copy.missing.title}
              </h2>
              {/* Listed as things to improve, with no number: no uncertainty is invented for them. */}
              <ul className="missing-list">
                {unknownMeals.map((m) => (
                  <li key={m.id} data-testid="missing-meal">
                    <button type="button" className="link-btn" onClick={() => onOpenMeal(m.id)}>
                      {m.name}
                    </button>
                    <span className="unknown">{copy.missing.unknownKcal}</span>
                  </li>
                ))}
                {unknownWorkouts.map((w) => (
                  <li key={w.id} data-testid="missing-workout">
                    <button type="button" className="link-btn" onClick={() => props.onOpenWorkout(w.id)}>
                      {w.name}
                    </button>
                    <span className="unknown">{copy.missing.unknownBurned}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {biggest && panel && (
            <section className="section uncertainty panel-uncertainty" aria-labelledby="uncertainty-title">
              <div className="uncertainty-text">
                <h2 className="section-title uncertainty-title" id="uncertainty-title">
                  {copy.uncertainty.sectionTitle}
                </h2>
                {biggestShare !== undefined && (
                  <p className="uncertainty-share num" data-testid="biggest-share">
                    {knownOnly
                      ? copy.panel.biggestShareKnownOnly(fmtSharePct(biggestShare))
                      : copy.panel.biggestShare(fmtSharePct(biggestShare))}
                  </p>
                )}
                <p className="uncertainty-line">
                  <span data-testid="biggest-line">
                    {knownOnly ? copy.uncertainty.mostFromKnownOnly(biggest.name) : copy.uncertainty.mostFrom(biggest.name)}
                    {improvement === null && (
                      <>
                        {' '}
                        <span className="hint">{copy.uncertainty.alreadyBest}</span>
                      </>
                    )}
                  </span>
                </p>
              </div>
              {improvement !== null && (
                <button
                  type="button"
                  className="btn btn-primary improve-btn"
                  onClick={() => onImprove(biggest.id)}
                  aria-label={copy.uncertainty.improveEntry}
                  data-testid="improve-entry"
                >
                  {copy.uncertainty.improveShort}
                </button>
              )}
            </section>
          )}

          {biggest && !panel && !night && (
            <section className="section uncertainty" aria-labelledby="uncertainty-title">
              <h2 className="section-title uncertainty-title" id="uncertainty-title">
                {copy.uncertainty.sectionTitle}
              </h2>
              <p className="uncertainty-line">
                <span data-testid="biggest-line">
                  {knownOnly ? copy.uncertainty.mostFromKnownOnly(biggest.name) : copy.uncertainty.mostFrom(biggest.name)}
                  {improvement === null && (
                    <>
                      {' '}
                      <span className="hint">{copy.uncertainty.alreadyBest}</span>
                    </>
                  )}
                </span>
                {/* Hidden when improve() is null: the meal already uses the most reliable source (G12). */}
                {improvement !== null && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="link-btn improve-link"
                      onClick={() => onImprove(biggest.id)}
                      aria-label={copy.uncertainty.improveEntry}
                      data-testid="improve-entry"
                    >
                      {copy.uncertainty.improveShort}
                      <span aria-hidden="true">{copy.arrow}</span>
                    </button>
                  </>
                )}
              </p>
            </section>
          )}
        </div>

        <div className="dash-col" data-testid="dash-col-list">
          {/* One log button at a time ("Log your first meal" on an empty day) and the one sleep
              button that fits now (I'm going to sleep, or I woke up). */}
          <div className="action-bar" ref={actionBarRef} data-testid="action-bar">
            {/* Always in the page as a live region, so a screen reader reads "Logged" when it
                appears; empty, it takes no room. */}
            <div className={props.barNote ? 'bar-note on' : 'bar-note'} ref={barNoteRef} data-testid="bar-note">
              <p className="bar-note-text" role="status" data-testid="logged-note">
                {props.barNote ?? ''}
              </p>
              {props.barNote && props.onUndo && (
                <button
                  type="button"
                  className="btn btn-quiet bar-undo"
                  onClick={() => {
                    props.onUndo?.()
                    // The button goes with the meal; focus moves to Log a meal, which stays.
                    logBtnRef.current?.focus()
                  }}
                  aria-label={props.undoLabel}
                  data-testid="status-undo"
                >
                  {copy.quickLog.undo}
                </button>
              )}
            </div>
            <div className="action-row">
              <button type="button" className="btn btn-primary log-btn" ref={logBtnRef} onClick={onLogMeal} data-testid="log-meal">
                {day.status === 'empty' ? copy.dashboard.logFirstMeal : copy.dashboard.logMeal}
              </button>
              <button
                type="button"
                className="btn sleep-btn"
                onClick={() => onSleepAction(asleep ? 'wake' : 'sleep')}
                data-testid="sleep-action"
              >
                {asleep ? copy.sleep.wokeUp : copy.sleep.goingToSleep}
              </button>
            </div>
          </div>

          {night ? (
            <NightTimeline
              view={view}
              sleep={sleep}
              nowIso={props.nowIso}
              onOpenMeal={onOpenMeal}
              onImprove={onImprove}
              onOpenWorkout={props.onOpenWorkout}
              onEditNight={editRecord}
            />
          ) : day.status === 'empty' ? (
            <section className="section empty-day" data-testid="empty-day">
              <p className="empty-title">{copy.emptyDay.noMeals}</p>
            </section>
          ) : (
            <MealList meals={meals} dayStart={dayStart} onOpenMeal={onOpenMeal} biggestId={biggest?.id ?? null} />
          )}

          {/* In the Night look, "Each night" follows its timeline directly, so nothing splits them. */}
          {night && sleepSection}

          {/* Build-out item 2.5a: the day's workouts with Log a workout (Night draws them on its timeline). */}
          <WorkoutSection
            workouts={view.workouts}
            dayStart={dayStart}
            onOpenWorkout={props.onOpenWorkout}
            onLogWorkout={props.onLogWorkout}
          />

          {/* Build-out item 2.4: the day's weigh-in with the 7-day average and the trend. */}
          {weightSection}

          {!night && sleepSection}

          <DayNav nav={nav} onPrev={props.onPrev} onNext={props.onNext} onPickDate={props.onPickDate} onToday={props.onToday} />
        </div>
      </div>
    </main>
  )
}

/**
 * Keeps --action-bar-h on <html> equal to the action bar's height. On a phone the bar is pinned
 * to the bottom of the window (theme.css > action bar), and the page's bottom room and the scroll
 * padding that keeps a focused control clear of the bar both read it. The bar grows when a narrow
 * screen wraps a label, so it is measured rather than assumed. Removed when the dashboard closes.
 */
function useActionBarHeight() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const bar = ref.current
    const root = document.documentElement
    if (!bar) return
    const update = () => root.style.setProperty('--action-bar-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`)
    update()
    if (typeof ResizeObserver === 'undefined') return () => root.style.removeProperty('--action-bar-h')
    const observer = new ResizeObserver(update)
    observer.observe(bar)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--action-bar-h')
    }
  }, [])
  return ref
}
