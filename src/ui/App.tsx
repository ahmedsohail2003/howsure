// spec.md > Screens > App.tsx: chooses the first-open screen or the dashboard, and holds
// the active log, the viewed day and the open sheet. Views switch on state; no router.
// spec.md > Store: both logs are saved on the device under their own keys, every change
// writes the whole document, and a reload reads them back, demo clock included.

import { useEffect, useMemo, useState } from 'react'
import { nowIso, reanchorDemoClock, type LogKind } from '../clock'
import { wakingDayStart } from '../kernel/sleepday'
import type { Meal, SleepRecord } from '../kernel/types'
import { startDemo, type LogDoc } from '../store/log'
import { loadSession, type Logs } from '../store/session'
import { saveActive, saveLog } from '../store/storage'
import { Dashboard } from './Dashboard'
import { buildDayViewFor } from './dayView'
import { anchorFor, dateOfDay, dayForDate, dayNav } from './days'
import type { DayNavState } from './DayNav'
import { blankMeal, defaultMealTime, newMealId, toLocalInput, withMeal, withoutMeal } from './editMeal'
import { ExplainSheet, type ExplainMode } from './ExplainSheet'
import { FictionalBanner } from './FictionalBanner'
import { FirstOpen } from './FirstOpen'
import { LogMealSheet } from './LogMealSheet'
import { MealDetails } from './MealDetails'
import { SleepTimeSheet } from './SleepTimeSheet'
import { buildSleepView, type SleepAction } from './sleepView'
import { StorageNotice } from './StorageNotice'

type SheetState =
  | ExplainMode
  | { mode: 'improve'; mealId: string }
  | { mode: 'edit'; mealId: string }
  | { mode: 'details'; mealId: string }
  // A new meal keeps its blank starting point (id and default time) while the sheet is open.
  | { mode: 'new'; meal: Meal }
  // I'm going to sleep / I woke up, with the date and time (prd.md > Sleep and Waking Days).
  | { mode: 'sleepTime'; action: SleepAction }

/** Re-render once a minute so "now" (and with it the current waking day) stays fresh. */
function useMinuteTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return tick
}

export function App() {
  const [initial] = useState(() => loadSession())
  const [active, setActive] = useState<LogKind | null>(initial.active)
  const [logs, setLogs] = useState<Logs>(initial.logs)
  const [storageOk, setStorageOk] = useState(initial.storageOk)
  const [sheet, setSheet] = useState<SheetState | null>(null)
  // The waking day on screen; null follows the current day (the dashboard opens on it, and
  // after I woke up it moves to the new day). prd.md > Previous Days.
  const [viewed, setViewed] = useState<{ dayStart: string | null } | null>(null)
  const tick = useMinuteTick()
  const { unreadable } = initial

  /** Write the whole document, synchronously. A log that couldn't be read is never written over. */
  function persist(doc: LogDoc) {
    if (unreadable[doc.kind]) return
    setStorageOk(saveLog(doc))
  }

  function activate(kind: LogKind) {
    setSheet(null)
    setViewed(null)
    setActive(kind)
    if (!saveActive(kind)) setStorageOk(false)
  }

  function openDemo() {
    if (!logs.demo) {
      const doc = startDemo()
      setLogs((l) => ({ ...l, demo: doc }))
      persist(doc)
    }
    activate('demo')
  }

  function openMine() {
    activate('mine')
  }

  const doc = active === 'demo' ? logs.demo : active === 'mine' ? logs.mine : null
  const at = active ? nowIso(active) : null
  const nav = doc && at ? dayNav(doc, viewed ? viewed.dayStart : wakingDayStart(doc.sleeps, at), at) : null
  const viewedStart = nav ? (nav.days[nav.index] ?? null) : null
  // `tick` is read so the current day is recomputed as time passes.
  const view = useMemo(() => (doc && nav ? buildDayViewFor(doc, viewedStart) : null), [doc, nav !== null, viewedStart, tick])

  /** Put the changed log in place and write it to the device, then close the sheet. */
  function commit(next: LogDoc) {
    setLogs((l) => (next.kind === 'demo' ? { ...l, demo: next } : { ...l, mine: next }))
    persist(next)
    setSheet(null)
  }

  /** Log, Edit and Improve all save through here: a new id is added, a known id replaced. */
  function saveMeal(meal: Meal) {
    if (doc) commit(withMeal(doc, meal))
  }

  function deleteMeal(mealId: string) {
    if (doc) commit(withoutMeal(doc, mealId))
  }

  /** Show a waking day; the current one is followed (null) so a new wake moves the dashboard on. */
  function showDay(dayStart: string | null) {
    setViewed(nav && dayStart === nav.current ? null : { dayStart })
  }

  /**
   * I'm going to sleep / I woke up. In the demo, a time later than the demo's now moves its clock
   * there (spec.md > Clock), saved in the document so a reload continues from it. The dashboard
   * then shows the current waking day: after waking up, the new, empty one.
   */
  function saveSleep(sleeps: SleepRecord[], atIso: string) {
    if (!doc || !at) return
    let next: LogDoc = { ...doc, sleeps }
    if (doc.kind === 'demo' && Date.parse(atIso) > Date.parse(at)) {
      next = { ...next, clock: reanchorDemoClock(Date.parse(atIso)) }
    }
    setViewed(null)
    commit(next)
  }

  /** Log a meal: a blank meal dated now, or on the viewed waking day when that isn't today's. */
  function openLogMeal() {
    if (!doc || !view || !at) return
    setSheet({ mode: 'new', meal: blankMeal(newMealId(), defaultMealTime(doc.sleeps, view.dayStart, at)) })
  }

  const notice = <StorageNotice blocked={!storageOk} unreadable={active !== null && unreadable[active]} />

  if (!active || !doc || !view || !at || !nav) {
    return (
      <>
        {notice}
        <FirstOpen onTryDemo={openDemo} onStartEmpty={openMine} />
      </>
    )
  }

  const demo = active === 'demo'
  const findMeal = (id: string) => doc.meals.find((m) => m.id === id)
  const editing =
    sheet?.mode === 'new'
      ? sheet.meal
      : sheet?.mode === 'improve' || sheet?.mode === 'edit'
        ? findMeal(sheet.mealId)
        : undefined
  const details = sheet?.mode === 'details' ? findMeal(sheet.mealId) : undefined
  const today = viewedStart === nav.current
  const navState: DayNavState = {
    canPrev: nav.index > 0,
    canNext: nav.index < nav.days.length - 1,
    today,
    date: dateOfDay(doc, viewedStart, at),
    min: dateOfDay(doc, nav.days[0] ?? null, at),
    max: toLocalInput(at).slice(0, 10),
  }
  const sleepTime = sheet?.mode === 'sleepTime' ? sheet : null
  const explain = sheet?.mode === 'meal' || sheet?.mode === 'day' || sheet?.mode === 'ranges' ? sheet : null
  return (
    <>
      {demo && <FictionalBanner sticky />}
      {notice}
      <Dashboard
        kind={active}
        view={view}
        onSwitch={demo ? openMine : openDemo}
        onOpen={setSheet}
        onImprove={(mealId) => setSheet({ mode: 'improve', mealId })}
        onLogMeal={openLogMeal}
        onOpenMeal={(mealId) => setSheet({ mode: 'details', mealId })}
        sleep={buildSleepView(doc.sleeps, viewedStart)}
        onSleepAction={(action) => setSheet({ mode: 'sleepTime', action })}
        nav={navState}
        onPrev={() => showDay(nav.days[nav.index - 1] ?? null)}
        onNext={() => showDay(nav.days[nav.index + 1] ?? null)}
        onPickDate={(date) => showDay(dayForDate(doc, date, at))}
        onToday={() => setViewed(null)}
      />
      {explain && <ExplainSheet mode={explain} view={view} demo={demo} onClose={() => setSheet(null)} />}
      {details && (
        <MealDetails
          meal={details}
          view={view}
          demo={demo}
          onClose={() => setSheet(null)}
          onEdit={() => setSheet({ mode: 'edit', mealId: details.id })}
          onDelete={() => deleteMeal(details.id)}
          onOpenScore={() => setSheet({ mode: 'meal', mealId: details.id })}
        />
      )}
      {editing && sheet && (sheet.mode === 'new' || sheet.mode === 'edit' || sheet.mode === 'improve') && (
        <LogMealSheet
          key={`${sheet.mode}-${editing.id}`}
          mode={sheet.mode}
          meal={editing}
          doc={doc}
          at={anchorFor(doc, view.dayStart, at)}
          viewDayStart={view.dayStart}
          demo={demo}
          onSave={saveMeal}
          onClose={() => setSheet(null)}
        />
      )}
      {sleepTime && (
        <SleepTimeSheet
          key={sleepTime.action}
          action={sleepTime.action}
          sleeps={doc.sleeps}
          meals={doc.meals}
          nowIso={at}
          dayStart={nav.current}
          demo={demo}
          onSave={saveSleep}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}
