// prd.md > Screens and Layout > Dashboard: header, headline estimate, macro row, Missing
// information, the biggest-uncertainty line with Improve that entry, Log a meal, and the meal
// list. A day with no meals says "No meals logged yet" with Log your first meal (prd.md > States
// and Boundaries). The sleep section (item 9) and previous/next with a date picker (item 10)
// sit at the bottom (slice 4). The header (DashboardHeader.tsx) shows the viewed waking day and
// its wake time, the guest name that opens Profile and privacy, and the More menu (item 1.3).
// Targets set in the targets editor show under the headline and the macros (item 1.3).

import type { LogKind } from '../clock'
import type { Profile } from '../store/log'
import { copy } from './copy'
import { DashboardHeader } from './DashboardHeader'
import type { DayView } from './dayView'
import { DayNav, type DayNavState } from './DayNav'
import type { ExplainMode } from './ExplainSheet'
import { HeadlineEstimate } from './HeadlineEstimate'
import { MacroRow } from './MacroRow'
import { MealList } from './MealList'
import { SleepSection } from './SleepSection'
import type { SleepAction, SleepView } from './sleepView'

interface DashboardProps {
  kind: LogKind
  view: DayView
  onSwitch: () => void
  onOpen: (mode: ExplainMode) => void
  /** Opens the meal's edit sheet in improve mode (prd.md > Improve That Entry). */
  onImprove: (mealId: string) => void
  /** Opens the Log a meal sheet (prd.md > Logging a Meal). */
  onLogMeal: () => void
  /** Opens a meal's details (prd.md > Meal Details, Edit and Delete). */
  onOpenMeal: (mealId: string) => void
  sleep: SleepView
  onSleepAction: (action: SleepAction) => void
  nav: DayNavState
  onPrev: () => void
  onNext: () => void
  onPickDate: (date: string) => void
  onToday: () => void
  /** The guest name in your own log ('' until item 2.10 gives one). */
  ownName: string
  /** Opens Profile and privacy (build-out item 1.2). Your own log only. */
  onOpenProfile: () => void
  /** The open log's targets (build-out item 1.3), shown under the headline and the macros. */
  targets: Profile['targets']
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
  const knownOnly = day.status === 'partial'

  return (
    <main className="page" data-testid="dashboard">
      <DashboardHeader
        kind={kind}
        dayStart={dayStart}
        ownName={props.ownName}
        onOpenProfile={props.onOpenProfile}
        onSwitch={onSwitch}
        onOpenMore={props.onOpenMore}
        moreOpen={props.moreOpen}
        fullScreenOn={props.fullScreenOn}
        onExitFullScreen={props.onExitFullScreen}
      />

      {/* Two groups: the day's numbers, then the meals, sleep and day controls. They stack in
          the normal column; the full-screen view puts them side by side on a wide screen. */}
      <div className="dash-body">
        <div className="dash-col" data-testid="dash-col-day">
          <HeadlineEstimate day={day} onOpen={onOpen} today={nav.today} targetKcal={targets?.kcal} />

          {day.status !== 'empty' && <MacroRow macros={view.macros} targets={targets} />}

          {unknownMeals.length > 0 && (
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
              </ul>
            </section>
          )}

          {biggest && (
            <section className="section" aria-labelledby="uncertainty-title">
              <h2 className="section-title" id="uncertainty-title">
                {copy.uncertainty.sectionTitle}
              </h2>
              <p className="uncertainty-line" data-testid="biggest-line">
                {knownOnly ? copy.uncertainty.mostFromKnownOnly(biggest.name) : copy.uncertainty.mostFrom(biggest.name)}
                {improvement === null && (
                  <>
                    {' '}
                    <span className="hint">{copy.uncertainty.alreadyBest}</span>
                  </>
                )}
              </p>
              {/* Hidden when improve() is null: the meal already uses the most reliable source (G12). */}
              {improvement !== null && (
                <button
                  type="button"
                  className="btn improve-btn"
                  onClick={() => onImprove(biggest.id)}
                  data-testid="improve-entry"
                >
                  {copy.uncertainty.improveEntry}
                </button>
              )}
            </section>
          )}
        </div>

        <div className="dash-col" data-testid="dash-col-list">
          {day.status === 'empty' ? (
            <section className="section empty-day" data-testid="empty-day">
              <p className="empty-title">{copy.emptyDay.noMeals}</p>
              <button type="button" className="btn btn-primary log-btn" onClick={onLogMeal} data-testid="log-meal">
                {copy.dashboard.logFirstMeal}
              </button>
            </section>
          ) : (
            <>
              <div className="log-row">
                <button type="button" className="btn btn-primary log-btn" onClick={onLogMeal} data-testid="log-meal">
                  {copy.dashboard.logMeal}
                </button>
              </div>
              <MealList
                meals={meals}
                dayStart={dayStart}
                onOpenScore={(mealId) => onOpen({ mode: 'meal', mealId })}
                onOpenMeal={onOpenMeal}
              />
            </>
          )}

          <SleepSection sleep={sleep} today={nav.today} onAction={onSleepAction} />

          <DayNav nav={nav} onPrev={props.onPrev} onNext={props.onNext} onPickDate={props.onPickDate} onToday={props.onToday} />
        </div>
      </div>
    </main>
  )
}
