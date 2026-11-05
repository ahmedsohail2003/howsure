// spec.md > Screens > App.tsx: chooses the first-open screen or the dashboard, and holds
// the active log, the viewed day and the open sheet. Views switch on state; no router.
// spec.md > Store: both logs are saved on the device under their own keys, every change
// writes the whole document, and a reload reads them back, demo clock included.

import { useEffect, useMemo, useState } from 'react'
import { nowIso, reanchorDemoClock, type LogKind } from '../clock'
import { sleepStatus, wakingDayStart } from '../kernel/sleepday'
import type { Meal, SleepRecord } from '../kernel/types'
import { demoChanges, isDemoEdited, pristineDemo, type DemoChanges } from '../store/demoReset'
import { emptyLog, startDemo, type LogDoc } from '../store/log'
import { DEFAULT_LOOK, saveLook, type Look } from '../store/look'
import { loadSession, type LogProblem, type Logs } from '../store/session'
import { browserStore, KEYS, readRaw, saveActive, saveLog, storageWorks } from '../store/storage'
import {
  backupsFileName,
  countOlderCopies,
  deleteOwnLog,
  exportBackups,
  exportFileName,
  exportOwnLog,
  olderCopies,
  replaceOwnLog,
} from '../store/transfer'
import { copy } from './copy'
import { Dashboard } from './Dashboard'
import { buildDayViewFor } from './dayView'
import { anchorFor, dateOfDay, dayForDate, dayNav } from './days'
import type { DayNavState } from './DayNav'
import { blankMeal, defaultMealTime, newMealId, toLocalInput, withMeal, withoutMeal } from './editMeal'
import { ExplainSheet, type ExplainMode } from './ExplainSheet'
import { FictionalBanner } from './FictionalBanner'
import { FirstOpen } from './FirstOpen'
import { useFullScreenView } from './fullScreen'
import { LogMealSheet } from './LogMealSheet'
import { LookContext, type LookState } from './lookContext'
import { applyLook } from './looks'
import { LookSheet } from './LookSheet'
import { downloadText } from './download'
import { MealDetails } from './MealDetails'
import { MoreMenu } from './MoreMenu'
import { moreEntries, type MoreEntryId } from './moreMenu'
import { ProfilePrivacy, type DeleteOutcome, type ImportOutcome } from './ProfilePrivacy'
import { ResetDemoSheet } from './ResetDemoSheet'
import { SetWakeSheet } from './SetWakeSheet'
import { SleepTimeSheet } from './SleepTimeSheet'
import { buildSleepView, type SleepAction } from './sleepView'
import { StorageNotice } from './StorageNotice'
import { withTargets, type Targets } from './targets'
import { TargetsSheet } from './TargetsSheet'
import { canSetWake } from './wakeSet'

type SheetState =
  | ExplainMode
  | { mode: 'improve'; mealId: string }
  | { mode: 'edit'; mealId: string }
  | { mode: 'details'; mealId: string }
  // A new meal keeps its blank starting point (id and default time) while the sheet is open.
  | { mode: 'new'; meal: Meal }
  // I'm going to sleep / I woke up, with the date and time (prd.md > Sleep and Waking Days).
  | { mode: 'sleepTime'; action: SleepAction }
  // Profile and privacy: Export, Import and Delete for your own log (build-out item 1.2).
  | { mode: 'profile' }
  // The More menu and the targets editor (build-out item 1.3).
  | { mode: 'more' }
  | { mode: 'targets' }
  // The Look sheet (build-out item 1.5.2).
  | { mode: 'look' }
  // Build-out item 2.1: Set wake time (a log with no wake time yet), and Reset demo's
  // confirmation, holding what the reset would discard.
  | { mode: 'setWake' }
  | { mode: 'resetDemo'; changes: DemoChanges }

/** Re-render once a minute so "now" (and with it the current waking day) stays fresh. */
function useMinuteTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return tick
}

interface AppProps {
  /** The look main.tsx read and applied before the first render (build-out item 1.5.2). */
  initialLook?: Look
}

export function App({ initialLook = DEFAULT_LOOK }: AppProps) {
  const [initial] = useState(() => loadSession())
  const [active, setActive] = useState<LogKind | null>(initial.active)
  const [logs, setLogs] = useState<Logs>(initial.logs)
  const [storageOk, setStorageOk] = useState(initial.storageOk)
  const [sheet, setSheetState] = useState<SheetState | null>(null)
  // A one-line confirmation under the header (Reset demo). Any next step clears it: opening a
  // sheet, switching logs, or moving to another day.
  const [statusNote, setStatusNote] = useState<string | null>(null)
  function setSheet(next: SheetState | null) {
    if (next !== null) setStatusNote(null)
    setSheetState(next)
  }
  // The waking day on screen; null follows the current day (the dashboard opens on it, and
  // after I woke up it moves to the new day). prd.md > Previous Days.
  const [viewed, setViewed] = useState<{ dayStart: string | null } | null>(null)
  const tick = useMinuteTick()
  // Per log, why its saved copy is left as it is. Delete and Import clear your own log's problem.
  const [problems, setProblems] = useState<Record<LogKind, LogProblem | null>>(initial.problems)
  // The full-screen view (build-out item 1.3). Not saved: a reload opens the normal view.
  const fullScreen = useFullScreenView()
  // The chosen look: a device setting shared by both logs, saved apart from them (store/look.ts).
  const [look, setLookState] = useState<Look>(initialLook)
  const lookState = useMemo<LookState>(
    () => ({
      look,
      setLook: (next: Look) => {
        applyLook(next)
        setLookState(next)
        // When the device won't save, the look still applies until a reload, and the notice says so.
        if (!saveLook(next)) setStorageOk(false)
      },
    }),
    [look],
  )

  /**
   * Write the whole document, synchronously. A log whose saved copy couldn't be read, came from
   * a newer version, or couldn't be backed up before an upgrade is never written over.
   */
  function persist(doc: LogDoc) {
    if (problems[doc.kind]) return
    setStorageOk(saveLog(doc))
  }

  function activate(kind: LogKind) {
    setSheet(null)
    setStatusNote(null)
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
  // The older copies the panel offers, counted when it opens and after Delete or Import change
  // your own log (not on every render: it scans the device's keys).
  const profileOpen = sheet?.mode === 'profile'
  const olderCount = useMemo(
    () => (profileOpen ? countOlderCopies(problems.mine, browserStore()) : { backups: 0, original: false }),
    [profileOpen, problems.mine, logs.mine],
  )

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
    setStatusNote(null)
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

  /**
   * Set wake time, after the regroup preview (when there were meals) was confirmed: the first wake
   * is saved and the dashboard follows the day it starts. Every meal keeps its own date and time.
   * Focus then goes to the waking-day line (Sheet.tsx FOCUS_RETURN), since the button has gone.
   */
  function saveWake(sleeps: SleepRecord[]) {
    if (!doc) return
    setViewed(null)
    commit({ ...doc, sleeps })
  }

  /**
   * Reset demo (build-out item 2.1; spec.md > Store): Sam's week as it started, with the demo clock
   * restarted at the fixture's moment. It asks first only when the demo was edited (or `confirmed`
   * is true once it has). Your own log is never read or written here.
   */
  function resetDemo(confirmed = false) {
    const current = logs.demo
    if (!current) return
    if (!confirmed) {
      const pristine = pristineDemo()
      if (isDemoEdited(current, pristine)) {
        setSheet({ mode: 'resetDemo', changes: demoChanges(current, pristine) })
        return
      }
    }
    const fresh = startDemo()
    setViewed(null)
    commit(fresh)
    setStatusNote(copy.resetDemo.done)
  }

  /** Export: download your own log (the stored text as it is when this version can't read it). */
  function exportMine(): string {
    const file = exportFileName(new Date())
    downloadText(file, exportOwnLog(logs.mine, problems.mine, browserStore()))
    return file
  }

  /**
   * Export the older copies of your log, offered only when there are some: the backups kept by
   * format upgrades, and the original older-format text when it was never backed up.
   */
  function exportOlderCopies(): string {
    const file = backupsFileName(new Date())
    downloadText(file, exportBackups(olderCopies(problems.mine, browserStore())))
    return file
  }

  /**
   * Import, after the person confirmed the preview: replace your own log. A saved copy this
   * version can't read, or couldn't back up, is never replaced (the panel says to Export and
   * Delete it first). Nothing changes on screen unless the device saved the import.
   */
  function importMine(next: LogDoc): ImportOutcome {
    if (problems.mine === 'notBackedUp') return 'storedNotBackedUp'
    if (problems.mine) return 'storedUnreadable'
    const res = replaceOwnLog(next, browserStore())
    if (!res.ok) return res.reason
    setLogs((l) => ({ ...l, mine: next }))
    setStorageOk(true)
    if (active === 'mine') setViewed(null)
    return 'ok'
  }

  /**
   * Delete your own log from the device; afterwards your own log is empty. The demo is untouched.
   * When the browser won't let HowSure reach its storage at all, there is no saved copy it can
   * reach: the log on screen is cleared and the panel says so ('noStorage'), instead of asking
   * the person to try again.
   */
  function deleteMine(): DeleteOutcome {
    const store = browserStore()
    const clear = () => {
      setLogs((l) => ({ ...l, mine: emptyLog() }))
      setProblems((p) => ({ ...p, mine: null }))
      if (active === 'mine') setViewed(null)
    }
    if (!store) {
      clear()
      return 'noStorage'
    }
    const res = deleteOwnLog(store)
    if (readRaw(store, KEYS.mine) === null) {
      clear()
      // A save that failed earlier no longer matters for this log; say so only if saving works now.
      setStorageOk(storageWorks(store))
    }
    return res.ok ? 'ok' : 'failed'
  }

  /** Targets editor Save: the open log's targets (Sam's in the demo, which stay in the demo). */
  function saveTargets(targets: Targets) {
    if (doc) commit(withTargets(doc, targets))
  }

  /**
   * A More menu entry: the menu closes, then the entry opens. A new entry in moreMenu.ts needs a
   * case here; TypeScript flags a missing one.
   */
  function chooseMore(id: MoreEntryId) {
    switch (id) {
      case 'profile':
        setSheet({ mode: 'profile' })
        return
      case 'targets':
        setSheet({ mode: 'targets' })
        return
      case 'look':
        setSheet({ mode: 'look' })
        return
      case 'fullScreen':
        setSheet(null)
        if (fullScreen.mode === 'off') fullScreen.enter()
        else fullScreen.exit()
        return
      case 'resetDemo':
        setSheet(null)
        resetDemo()
        return
      default: {
        const unhandled: never = id
        throw new Error(`More menu entry with no action: ${String(unhandled)}`)
      }
    }
  }

  /** Log a meal: a blank meal dated now, or on the viewed waking day when that isn't today's. */
  function openLogMeal() {
    if (!doc || !view || !at) return
    setSheet({ mode: 'new', meal: blankMeal(newMealId(), defaultMealTime(doc.sleeps, view.dayStart, at)) })
  }

  const notice = (
    <StorageNotice blocked={!storageOk} problem={active !== null ? problems[active] : null} canExport={active === 'mine'} />
  )

  if (!active || !doc || !view || !at || !nav) {
    return (
      <LookContext.Provider value={lookState}>
        {notice}
        <FirstOpen onStartMine={openMine} onTryDemo={openDemo} />
      </LookContext.Provider>
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
    <LookContext.Provider value={lookState}>
      {demo && <FictionalBanner sticky />}
      {notice}
      <Dashboard
        kind={active}
        view={view}
        onSwitch={demo ? openMine : openDemo}
        onSetWake={canSetWake(doc.sleeps, sleepStatus(doc.sleeps)) ? () => setSheet({ mode: 'setWake' }) : undefined}
        statusNote={statusNote}
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
        onToday={() => {
          setStatusNote(null)
          setViewed(null)
        }}
        ownName={logs.mine.profile.name}
        onOpenProfile={() => setSheet({ mode: 'profile' })}
        targets={doc.profile.targets}
        onOpenTargets={() => setSheet({ mode: 'targets' })}
        nowIso={at}
        onOpenMore={() => setSheet({ mode: 'more' })}
        moreOpen={sheet?.mode === 'more'}
        fullScreenOn={fullScreen.mode !== 'off'}
        onExitFullScreen={fullScreen.exit}
      />
      {sheet?.mode === 'more' && (
        <MoreMenu
          entries={moreEntries({ kind: active, fullScreen: fullScreen.mode, look })}
          demo={demo}
          onChoose={chooseMore}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.mode === 'look' && <LookSheet demo={demo} onClose={() => setSheet(null)} />}
      {sheet?.mode === 'targets' && (
        <TargetsSheet targets={doc.profile.targets} demo={demo} onSave={saveTargets} onClose={() => setSheet(null)} />
      )}
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
      {sheet?.mode === 'profile' && !demo && (
        <ProfilePrivacy
          doc={logs.mine}
          problem={problems.mine}
          olderCopies={olderCount}
          onExport={exportMine}
          onExportOlderCopies={exportOlderCopies}
          onImport={importMine}
          onDelete={deleteMine}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.mode === 'setWake' && (
        <SetWakeSheet
          sleeps={doc.sleeps}
          meals={doc.meals}
          nowIso={at}
          demo={demo}
          onSave={saveWake}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.mode === 'resetDemo' && demo && (
        <ResetDemoSheet changes={sheet.changes} onConfirm={() => resetDemo(true)} onClose={() => setSheet(null)} />
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
    </LookContext.Provider>
  )
}
