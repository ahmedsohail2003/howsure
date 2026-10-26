// prd.md > Screens and Layout > Dashboard: header, headline estimate, macro row, Missing
// information, the biggest-uncertainty line with Improve that entry, Log a meal, and the meal
// list. A day with no meals says "No meals logged yet" with Log your first meal (prd.md > States
// and Boundaries). The sleep section (item 9) and previous/next with a date picker (item 10)
// sit at the bottom (slice 4). The header shows the viewed waking day and its wake time.

import type { LogKind } from '../clock'
import { copy } from './copy'
import type { DayView } from './dayView'
import { DayNav, type DayNavState } from './DayNav'
import type { ExplainMode } from './ExplainSheet'
import { fmtTime, fmtWeekday } from './format'
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
}

export function Dashboard(props: DashboardProps) {
  const { kind, view, onSwitch, onOpen, onImprove, onLogMeal, onOpenMeal, sleep, onSleepAction, nav } = props
  const { dayStart, meals, day, biggest, improvement } = view
  const unknownMeals = meals.filter((m) => day.unknownMealIds.includes(m.id))
  const knownOnly = day.status === 'partial'

  return (
    <main className="page" data-testid="dashboard">
      <header className="app-header">
        <div>
          <h1 className="wordmark">{copy.appName}</h1>
          {kind === 'mine' && <p className="waking-day">{copy.header.yourLog}</p>}
          {dayStart ? (
            <p className="waking-day num" data-testid="waking-day">
              {copy.header.awakeSince(fmtWeekday(dayStart), fmtTime(dayStart))}
            </p>
          ) : (
            <p className="waking-day unset" data-testid="waking-day">
              {copy.header.wakeTimeNotSet}
            </p>
          )}
        </div>
        <button type="button" className="btn btn-quiet" onClick={onSwitch} data-testid="log-switch">
          {kind === 'demo' ? copy.header.switchToMine : copy.header.switchToDemo}
        </button>
      </header>

      <HeadlineEstimate day={day} onOpen={onOpen} today={nav.today} />

      {day.status !== 'empty' && <MacroRow macros={view.macros} />}

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
    </main>
  )
}
