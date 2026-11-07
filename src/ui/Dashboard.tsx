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
//
// Build-out item 2.6 (slice 26): the viewed day's gym sessions (GymLog.tsx GymSummary), or nothing
// on a day without one, right below the weight section (item 2.4) in every look.
//
// Build-out item 2.9: every number on the dashboard opens its detail, in every look. Each macro
// opens its detail, last night and the 7-night average open the sleep details, a meal row's score
// opens its explanation in one tap (the rest of the row still opens the meal's details), and Panel's
// share of the day's uncertainty opens the explanation that lists every meal's share. Each number
// carries data-opens with the test id of what it opens; tests/e2e/tap-through.spec.ts taps every
// one, and fails on any number without it.

import { useEffect, useLayoutEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import type { LogKind } from '../clock'
import type { MacroKey } from '../kernel/types'
import type { Profile } from '../store/log'
import { copy } from './copy'
import { DashboardHeader } from './DashboardHeader'
import type { DayView } from './dayView'
import { DayNav, type DayNavState } from './DayNav'
import type { BalanceView } from './balanceView'
import { fmtCalendarDate, fmtDate, fmtSharePct } from './format'
import { HeadlineEstimate } from './HeadlineEstimate'
import type { HeadlineOpen } from './headlineView'
import { useLook } from './lookContext'
import { MacroRow } from './MacroRow'
import { MealList } from './MealList'
import { NightTimeline } from './NightTimeline'
import { GymSummary } from './GymLog'
import type { SummaryItem } from './gymView'
import { TimesTogether } from './KeepTogether'
import { FOCUS_RETURN } from './Sheet'
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
  /** Days since the current day's wake when it is more than a day old (DashboardHeader), else null. */
  staleDays?: number | null
  /**
   * The current day's wake when it is more than a day old, whichever day is on screen, else null:
   * now's sleep status says no sleep was logged since it, naming it on an earlier day.
   */
  staleNowWake?: string | null
  /** Records today's wake, offered beside a wake that is days old. */
  onSetTodayWake?: () => void
  /** On an empty day, the waking day holding the log's latest meal when it is more than a day before it (days.ts > latestMealElsewhere). */
  latestMealDay?: { day: string | null; at: string }
  /** Opens a waking day (the latest-meal line). */
  onShowDay?: (dayStart: string | null) => void
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
  /** Build-out item 2.9: a meal's score explanation, a macro's detail and the sleep details. */
  onOpenScore: (mealId: string) => void
  onOpenMacro: (key: MacroKey) => void
  onOpenSleep: () => void
  /** Opens a workout's details, and Log a workout (build-out item 2.5a). */
  onOpenWorkout: (workoutId: string) => void
  onLogWorkout: () => void
  /** The viewed day's gym sessions (build-out item 2.6), and the gym log of every session. */
  gym: SummaryItem[]
  onOpenGymLog: () => void
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
  /** Opens the week view (build-out item 2.7), beside previous and next. */
  onOpenWeek: () => void
  /** Build-out item 2.8: the timeline of the last 3 or 4 waking days. */
  onOpenTimeline: () => void
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
  /** An ended day that ran for more than 36 hours says so under the headline (balanceView.ts > longDayNote). */
  longDay?: string | null
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
  // A current day whose wake is days old (build-out item 2.1b) isn't called "today" or "last
  // night": the header says when that wake-up was.
  const asToday = nav.today && props.staleDays == null
  const latestLink =
    props.latestMealDay && props.onShowDay ? (
      <LatestMealLink latest={props.latestMealDay} onShowDay={props.onShowDay} nowIso={props.nowIso} />
    ) : null
  const dayRecordId = sleep.dayRecordId
  const editDay = dayRecordId ? () => props.onEditNight({ kind: 'edit', recordId: dayRecordId }) : undefined
  const editRecord = (recordId: string) => props.onEditNight({ kind: 'edit', recordId })
  const sleepSection = (
    <SleepSection
      sleep={sleep}
      today={nav.today}
      nowIso={props.nowIso}
      onEditNight={editRecord}
      onAddNight={props.onAddNight}
      onOpenSleep={props.onOpenSleep}
      staleWake={props.staleNowWake ?? null}
    />
  )
  const weightSection = (
    <WeightSection weight={props.weight} today={asToday} onOpen={props.onOpenWeight} onLog={props.onLogWeight} />
  )
  const gymSummary = <GymSummary items={props.gym} onOpenWorkout={props.onOpenWorkout} onOpenLog={props.onOpenGymLog} />

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
        staleDays={props.staleDays}
        onSetTodayWake={props.onSetTodayWake}
        nowIso={props.nowIso}
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
            today={asToday}
            targetKcal={targets?.kcal}
            onSetTarget={props.onOpenTargets}
            dayKey={dayStart ?? 'provisional'}
            macros={night ? view.macros : undefined}
            targets={targets}
            balance={props.balance}
            longDay={props.longDay}
            onOpenBody={props.onOpenBody}
            onOpenMacro={props.onOpenMacro}
          />

          {day.status !== 'empty' && !night && <MacroRow macros={view.macros} targets={targets} onOpenMacro={props.onOpenMacro} />}

          {(unknownMeals.length > 0 || unknownWorkouts.length > 0) && (
            <section className="section" aria-labelledby="missing-title" data-testid="missing-info">
              <h2 className="section-title" id="missing-title">
                {copy.missing.title}
              </h2>
              {/* Listed as things to improve, with no number: no uncertainty is invented for them.
                  The name's button covers its row (theme.css), so "calories unknown" opens it too. */}
              <ul className="missing-list">
                {unknownMeals.map((m) => (
                  <li key={m.id} data-testid="missing-meal">
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => onOpenMeal(m.id)}
                      aria-label={copy.missing.mealLabel(m.name)}
                      data-opens="meal-details"
                    >
                      {m.name}
                    </button>
                    <span className="unknown" data-opens="meal-details">
                      {copy.missing.unknownKcal}
                    </span>
                  </li>
                ))}
                {unknownWorkouts.map((w) => (
                  <li key={w.id} data-testid="missing-workout">
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => props.onOpenWorkout(w.id)}
                      aria-label={copy.missing.workoutLabel(w.name)}
                      data-opens="workout-details"
                    >
                      {w.name}
                    </button>
                    <span className="unknown" data-opens="workout-details">
                      {copy.missing.unknownBurned}
                    </span>
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
                  // Build-out item 2.9: the share opens the explanation that lists every meal's share.
                  <p className="uncertainty-share-line">
                    <button
                      type="button"
                      className="uncertainty-share share-open num"
                      onClick={() => onOpen({ mode: 'day' })}
                      aria-label={copy.headline.openShare(
                        knownOnly
                          ? copy.panel.biggestShareKnownOnly(fmtSharePct(biggestShare))
                          : copy.panel.biggestShare(fmtSharePct(biggestShare)),
                      )}
                      data-testid="biggest-share"
                      data-opens="explain-day"
                    >
                      {knownOnly
                        ? copy.panel.biggestShareKnownOnly(fmtSharePct(biggestShare))
                        : copy.panel.biggestShare(fmtSharePct(biggestShare))}
                    </button>
                  </p>
                )}
                <p className="uncertainty-line">
                  <span data-testid="biggest-line">
                    <NamedText
                      text={knownOnly ? copy.uncertainty.mostFromKnownOnly(biggest.name) : copy.uncertainty.mostFrom(biggest.name)}
                      name={biggest.name}
                    />
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
                  <NamedText
                    text={knownOnly ? copy.uncertainty.mostFromKnownOnly(biggest.name) : copy.uncertainty.mostFrom(biggest.name)}
                    name={biggest.name}
                  />
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
          {/* One log button at a time ("Log your first meal" on an empty day; "Log a meal" when the
              latest-meal line shows, since earlier meals exist) and the one sleep button that fits
              now (I'm going to sleep, or I woke up). */}
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
                {day.status === 'empty' && !props.latestMealDay ? copy.dashboard.logFirstMeal : copy.dashboard.logMeal}
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

          {/* The latest-meal line sits right under "No meals logged yet" in every look: inside the
              empty-day tile in Journal and Panel (so Panel's wide grid keeps them together), and
              on the timeline's empty point in Night. */}
          {night ? (
            <NightTimeline
              view={view}
              sleep={sleep}
              nowIso={props.nowIso}
              onOpenMeal={onOpenMeal}
              onOpenScore={props.onOpenScore}
              onOpenSleep={props.onOpenSleep}
              onImprove={onImprove}
              onOpenWorkout={props.onOpenWorkout}
              onEditNight={editRecord}
              emptyNote={latestLink}
            />
          ) : day.status === 'empty' ? (
            <section className="section empty-day" data-testid="empty-day">
              <p className="empty-title">{copy.emptyDay.noMeals}</p>
              {latestLink}
            </section>
          ) : (
            <MealList
              meals={meals}
              dayStart={dayStart}
              onOpenMeal={onOpenMeal}
              onOpenScore={props.onOpenScore}
              biggestId={biggest?.id ?? null}
            />
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

          {/* Build-out item 2.6: the day's gym sessions, just below weight in every look. */}
          {gymSummary}

          {!night && sleepSection}

          <DayNav
            nav={nav}
            onPrev={props.onPrev}
            onNext={props.onNext}
            onPickDate={props.onPickDate}
            onToday={props.onToday}
            onOpenWeek={props.onOpenWeek}
            onOpenTimeline={props.onOpenTimeline}
          />
        </div>
      </div>
    </main>
  )
}

/** "Last meal logged: Tue 13 Oct ›", opening that waking day (build-out item 2.1b). */
function LatestMealLink({
  latest,
  onShowDay,
  nowIso,
}: {
  latest: { day: string | null; at: string }
  onShowDay: (dayStart: string | null) => void
  nowIso?: string
}) {
  // The link leaves the page once its day shows, so focus moves to the new day's waking-day line
  // (the same return point Sheet.tsx uses); a screen reader then reads which day is open.
  function open() {
    flushSync(() => onShowDay(latest.day))
    document.querySelector<HTMLElement>(`[${FOCUS_RETURN}]`)?.focus()
  }
  return (
    <p className="latest-meal">
      <button type="button" className="link-btn" onClick={open} data-testid="latest-meal">
        {/* One span, so the button's flex layout keeps the spaces between the words. */}
        <span>
          <TimesTogether text={copy.emptyDay.lastMeal(fmtCalendarDate(fmtDate(latest.at), nowIso))} />
          {/* A no-break space joins the chevron to the date, so it never sits alone on a line. */}
          <span aria-hidden="true">{`\u00a0${copy.arrow.trim()}`}</span>
        </span>
      </button>
    </p>
  )
}

/**
 * A sentence with a name typed by the person in it ("Most uncertainty comes from 2 boiled eggs."):
 * the name is marked data-name, so the tap-through test (build-out item 2.9) reads a digit in it as
 * part of a name, not as a number that needs a detail. The words stay one sentence.
 */
function NamedText({ text, name }: { text: string; name: string }) {
  const at = name ? text.indexOf(name) : -1
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <span data-name="">{name}</span>
      {text.slice(at + name.length)}
    </>
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
