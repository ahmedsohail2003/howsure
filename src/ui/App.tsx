// spec.md > Screens > App.tsx: chooses the first-open screen or the dashboard, and holds
// the active log, the viewed day and the open sheet. Views switch on state; no router.
// spec.md > Store: both logs are saved on the device under their own keys, every change
// writes the whole document, and a reload reads them back, demo clock included.

import { useEffect, useMemo, useState } from 'react'
import { nowIso, reanchorDemoClock, type LogKind } from '../clock'
import { sleepStatus, wakingDayStart } from '../kernel/sleepday'
import type { Meal, SleepRecord, WeighIn, WeightUnit, Workout } from '../kernel/types'
import { demoChanges, isDemoEdited, pristineDemo, type DemoChanges } from '../store/demoReset'
import { emptyLog, startDemo, type BodyDetails, type LogDoc } from '../store/log'
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
import { balanceView, latestWeighIn } from './balanceView'
import { withBody } from './body'
import { BodySheet } from './BodySheet'
import { buildDayViewFor } from './dayView'
import { anchorFor, dateOfDay, dayForDate, dayNav } from './days'
import type { DayNavState } from './DayNav'
import { blankMeal, defaultMealTime, newMealId, toLocalInput, withMeal, withoutMeal } from './editMeal'
import { blankWorkout, newWorkoutId, withoutWorkout, withWorkout } from './editWorkout'
import { EatenSheet } from './EatenSheet'
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
import { missedWakeDate, latestTime, type EditTarget } from './sleepEdit'
import { SleepEditor, type NightChange } from './SleepEditor'
import { SleepTimeSheet } from './SleepTimeSheet'
import { buildSleepView, type SleepAction } from './sleepView'
import { StorageNotice } from './StorageNotice'
import { withTargets, type Targets } from './targets'
import { TargetsSheet } from './TargetsSheet'
import { SavedMealsSheet } from './SavedMealsSheet'
import { fmtDate, fmtInt, fmtTime, fmtWeekday } from './format'
import {
  mealFromValues,
  newSavedMealId,
  savedFromMeal,
  withSavedMeal,
  withSavedMealRenamed,
  withSavedMealUpdated,
  withoutSavedMeal,
  type MealValues,
} from './usualMeals'
import { canSetWake } from './wakeSet'
import { WorkoutDetails } from './WorkoutDetails'
import { WorkoutListSheet } from './WorkoutList'
import { WorkoutSheet } from './WorkoutSheet'
import { WeighInSheet } from './WeighInSheet'
import { unitToRemember, withoutWeighIn, withWeighIn, withWeightUnit } from './weighInEdit'
import { WeightDetails } from './WeightDetails'
import { buildWeightView } from './weightView'

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
  // Build-out item 2.3: the Saved meals sheet. Opened from Log a meal, closing it goes back there.
  | { mode: 'savedMeals'; from: 'more' | 'logMeal' | 'details'; mealId?: string }
  // Build-out item 2.5a: eaten's and burned's details under the net headline, a workout's
  // details, and Log a workout (a new workout keeps its blank starting point while open) and Edit.
  | { mode: 'eaten' }
  | { mode: 'workouts' }
  | { mode: 'workout'; workoutId: string }
  | { mode: 'newWorkout'; workout: Workout }
  | { mode: 'editWorkout'; workoutId: string }
  // Build-out item 2.5b: Body details, from Profile and privacy (closing goes back there), More,
  // or the line under the headline that invites adding them.
  | { mode: 'body'; from: 'profile' | 'more' | 'dashboard' }
  // Build-out item 2.2: the sleep and wake editor, on one night or a new (missed) one.
  | { mode: 'sleepEdit'; target: EditTarget }
  // Build-out item 2.4: the weight details, and Log weight (id null) or a weigh-in's edit sheet.
  // Closing the sheet goes back to where it was opened from: the details or the dashboard.
  | { mode: 'weight'; focusId?: string | null }
  | { mode: 'weighIn'; id: string | null; from: 'dashboard' | 'weight'; startAt: string }

/**
 * The one-line confirmation of the last action: under the header (Reset demo), or in the action
 * bar just above Log a meal (`bar`, build-out item 2.3: Logged and Undone, after a meal is logged
 * again from Recent or Saved). `undo` is the meal just logged, which its Undo button removes.
 */
interface StatusNote {
  text: string
  bar?: boolean
  undo?: { kind: LogKind; mealId: string; name: string }
}

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
  // A one-line confirmation under the header (Reset demo; Logged, with Undo). Any next step clears
  // it: opening a sheet, switching logs, or moving to another day.
  const [statusNote, setStatusNote] = useState<StatusNote | null>(null)
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
  // The viewed day's weight (build-out item 2.4), worked out once for the dashboard and the details.
  const weight = useMemo(() => (doc && at && nav ? buildWeightView(doc, viewedStart, at) : null), [doc, nav !== null, viewedStart, tick])
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

  /** Put the changed log in place and write it to the device, keeping the open sheet open. */
  function update(next: LogDoc) {
    setLogs((l) => (next.kind === 'demo' ? { ...l, demo: next } : { ...l, mine: next }))
    persist(next)
  }

  /** Log, Edit and Improve all save through here: a new id is added, a known id replaced. */
  function saveMeal(meal: Meal) {
    if (doc) commit(withMeal(doc, meal))
  }

  function deleteMeal(mealId: string) {
    if (doc) commit(withoutMeal(doc, mealId))
  }

  /** Log a workout and Edit save through here (build-out item 2.5a): a new id is added, a known id replaced. */
  function saveWorkout(workout: Workout) {
    if (doc) commit(withWorkout(doc, workout))
  }

  function deleteWorkout(workoutId: string) {
    if (doc) commit(withoutWorkout(doc, workoutId))
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
   * The sleep and wake editor's Save, after the move warning (when anything changed day) was
   * confirmed: an edited, added or deleted night. In the demo, a time later than the demo's now
   * moves its clock there, as the sleep buttons do. An earlier day on screen whose own wake was
   * edited stays on screen at its new wake; when its night was deleted, the day that now holds
   * that time is shown. Every meal keeps its own date and time.
   */
  function saveNight(sleeps: SleepRecord[], change: NightChange) {
    if (!doc || !at) return
    let next: LogDoc = { ...doc, sleeps }
    const last = change.after ? latestTime(change.after) : null
    if (doc.kind === 'demo' && last !== null && Date.parse(last) > Date.parse(at)) {
      next = { ...next, clock: reanchorDemoClock(Date.parse(last)) }
    }
    const oldWake = change.before?.wake ?? null
    if (viewed && oldWake !== null && viewed.dayStart === oldWake) {
      const newWake = change.after?.wake ?? null
      setViewed({ dayStart: newWake ?? wakingDayStart(sleeps, oldWake) })
    }
    commit(next)
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
    setStatusNote({ text: copy.resetDemo.done })
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

  /** Body details Save (build-out item 2.5b): the open log's (Sam's in the demo stay in the demo). */
  function saveBody(body: BodyDetails, from: 'profile' | 'more' | 'dashboard') {
    if (!doc) return
    commit(withBody(doc, body))
    if (from === 'profile') setSheet({ mode: 'profile' })
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
      case 'savedMeals':
        setSheet({ mode: 'savedMeals', from: 'more' })
        return
      case 'body':
        setSheet({ mode: 'body', from: 'more' })
        return
      case 'weight':
        setSheet({ mode: 'weight' })
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

  /** Log a workout: a blank workout starting now, or on the viewed waking day when that isn't today's. */
  function openLogWorkout() {
    if (!doc || !view || !at) return
    setSheet({ mode: 'newWorkout', workout: blankWorkout(newWorkoutId(), defaultMealTime(doc.sleeps, view.dayStart, at)) })
  }

  /**
   * Build-out item 2.3, tap 2: log a recent or saved meal again as a fresh meal with its own id and
   * time. On the current waking day the time is now (read at the tap); on another day it is the
   * time the sheet offered for that day. Then a short Logged line with Undo.
   */
  function quickLog(values: MealValues, sheetTime: string, onToday: boolean) {
    if (!doc || !view || !active) return
    const eatenAt = onToday ? defaultMealTime(doc.sleeps, view.dayStart, nowIso(active)) : sheetTime
    const meal = mealFromValues(values, newMealId(), eatenAt)
    commit(withMeal(doc, meal))
    const text =
      meal.kcal === null
        ? copy.quickLog.loggedUnknown(meal.name)
        : copy.quickLog.logged(meal.name, copy.quickLog.kcal(fmtInt(meal.kcal)))
    setStatusNote({ text, bar: true, undo: { kind: doc.kind, mealId: meal.id, name: meal.name } })
  }

  /** Undo after a quick log: the meal it added leaves the log, which is saved again. */
  function undoQuickLog() {
    const undo = statusNote?.undo
    if (!undo) return
    const target = undo.kind === 'demo' ? logs.demo : logs.mine
    if (!target || !target.meals.some((m) => m.id === undo.mealId)) {
      setStatusNote(null)
      return
    }
    commit(withoutMeal(target, undo.mealId))
    setStatusNote({ text: copy.quickLog.undone(undo.name), bar: true })
  }

  /**
   * Save as a usual meal, from a meal's details. The details stay open and say it was saved. With
   * `updateId`, the saved meal saved from this meal before it was edited takes its values now.
   */
  function saveUsual(meal: Meal, name: string, updateId?: string) {
    if (!doc || !active) return
    if (updateId !== undefined) update(withSavedMealUpdated(doc, savedFromMeal(meal, name, updateId, nowIso(active))))
    else update(withSavedMeal(doc, savedFromMeal(meal, name, newSavedMealId(), nowIso(active))))
  }

  /** Log weight: a blank weigh-in dated now, or on the viewed waking day when that isn't today's. */
  function openLogWeight(from: 'dashboard' | 'weight') {
    if (!doc || !view || !at) return
    setSheet({ mode: 'weighIn', id: null, from, startAt: defaultMealTime(doc.sleeps, view.dayStart, at) })
  }

  /** Back to where the weigh-in sheet was opened from; in the details, focus goes back to the row opened. */
  function closeWeighIn(from: 'dashboard' | 'weight', id: string | null) {
    setSheet(from === 'weight' ? { mode: 'weight', focusId: id } : null)
  }

  /**
   * Save a weigh-in (new or edited). A new weigh-in's unit, or one changed while editing, becomes
   * how weights are shown (settings.weightUnit). The dashboard shows the current day, or the day on screen.
   */
  function saveWeighIn(w: WeighIn, original: WeighIn | null, from: 'dashboard' | 'weight') {
    if (!doc || !weight) return
    const saved = withWeighIn(doc, w)
    const unit = unitToRemember(w, original, weight.unit)
    update(unit === null ? saved : withWeightUnit(saved, unit))
    closeWeighIn(from, original?.id ?? null)
  }

  function deleteWeighIn(id: string, from: 'dashboard' | 'weight') {
    if (!doc) return
    update(withoutWeighIn(doc, id))
    closeWeighIn(from, null)
  }

  /** The weight details' unit choice: how weights are shown. Nothing stored is converted. */
  function setWeightUnit(unit: WeightUnit) {
    if (doc) update(withWeightUnit(doc, unit))
  }

  /** Closing Saved meals goes back to where it was opened from: Log a meal, a meal's details, or the dashboard. */
  function closeSavedMeals(from: 'more' | 'logMeal' | 'details', mealId?: string) {
    if (from === 'logMeal') openLogMeal()
    else if (from === 'details' && mealId && doc?.meals.some((m) => m.id === mealId)) setSheet({ mode: 'details', mealId })
    else setSheet(null)
  }

  const notice = (
    <StorageNotice blocked={!storageOk} problem={active !== null ? problems[active] : null} canExport={active === 'mine'} />
  )

  if (!active || !doc || !view || !at || !nav || !weight) {
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
  const explain =
    sheet?.mode === 'meal' || sheet?.mode === 'day' || sheet?.mode === 'ranges' || sheet?.mode === 'net' || sheet?.mode === 'balance'
      ? sheet
      : null
  // Build-out item 2.5b: the estimated deficit or surplus for the viewed day, worked out once.
  const balance = balanceView(doc, view, at, demo)
  const findWorkout = (id: string) => doc.workouts.find((w) => w.id === id)
  const workoutDetails = sheet?.mode === 'workout' ? findWorkout(sheet.workoutId) : undefined
  const editingWorkout =
    sheet?.mode === 'newWorkout' ? sheet.workout : sheet?.mode === 'editWorkout' ? findWorkout(sheet.workoutId) : undefined
  const weighIn = sheet?.mode === 'weighIn' ? sheet : null
  const editingWeighIn = weighIn?.id ? (doc.weighIns ?? []).find((w) => w.id === weighIn.id) : undefined
  return (
    <LookContext.Provider value={lookState}>
      {demo && <FictionalBanner sticky />}
      {notice}
      <Dashboard
        kind={active}
        view={view}
        onSwitch={demo ? openMine : openDemo}
        onSetWake={canSetWake(doc.sleeps, sleepStatus(doc.sleeps)) ? () => setSheet({ mode: 'setWake' }) : undefined}
        statusNote={statusNote && !statusNote.bar ? statusNote.text : null}
        barNote={statusNote?.bar ? statusNote.text : null}
        onUndo={statusNote?.undo && statusNote.undo.kind === active ? undoQuickLog : undefined}
        undoLabel={statusNote?.undo ? copy.quickLog.undoLabel(statusNote.undo.name) : undefined}
        onOpen={setSheet}
        onImprove={(mealId) => setSheet({ mode: 'improve', mealId })}
        onLogMeal={openLogMeal}
        onOpenMeal={(mealId) => setSheet({ mode: 'details', mealId })}
        onOpenWorkout={(workoutId) => setSheet({ mode: 'workout', workoutId })}
        onLogWorkout={openLogWorkout}
        sleep={buildSleepView(doc.sleeps, viewedStart)}
        weight={weight}
        onOpenWeight={() => setSheet({ mode: 'weight' })}
        onLogWeight={() => openLogWeight('dashboard')}
        onSleepAction={(action) => setSheet({ mode: 'sleepTime', action })}
        onEditNight={(target) => setSheet({ mode: 'sleepEdit', target })}
        onAddNight={() => setSheet({ mode: 'sleepEdit', target: { kind: 'add', wakeDate: missedWakeDate(doc.sleeps, viewedStart, at) } })}
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
        balance={balance}
        onOpenBody={() => setSheet({ mode: 'body', from: 'dashboard' })}
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
      {explain && <ExplainSheet mode={explain} view={view} balance={balance} demo={demo} onClose={() => setSheet(null)} />}
      {sheet?.mode === 'body' && (
        <BodySheet
          body={doc.profile.body}
          nowIso={at}
          todayDate={fmtDate(at)}
          weighIn={latestWeighIn(doc, at)}
          demo={demo}
          onSave={(body) => saveBody(body, sheet.from)}
          onClose={() => setSheet(sheet.from === 'profile' ? { mode: 'profile' } : null)}
        />
      )}
      {sheet?.mode === 'eaten' && (
        <EatenSheet
          view={view}
          today={today}
          demo={demo}
          onClose={() => setSheet(null)}
          onOpen={setSheet}
          onOpenMeal={(mealId) => setSheet({ mode: 'details', mealId })}
        />
      )}
      {sheet?.mode === 'workouts' && (
        <WorkoutListSheet
          view={view}
          today={today}
          demo={demo}
          onClose={() => setSheet(null)}
          onOpenWorkout={(workoutId) => setSheet({ mode: 'workout', workoutId })}
          onLogWorkout={openLogWorkout}
        />
      )}
      {workoutDetails && (
        <WorkoutDetails
          workout={workoutDetails}
          dayStart={view.dayStart}
          demo={demo}
          onClose={() => setSheet(null)}
          onEdit={() => setSheet({ mode: 'editWorkout', workoutId: workoutDetails.id })}
          onDelete={() => deleteWorkout(workoutDetails.id)}
        />
      )}
      {editingWorkout && sheet && (sheet.mode === 'newWorkout' || sheet.mode === 'editWorkout') && (
        <WorkoutSheet
          key={`${sheet.mode}-${editingWorkout.id}`}
          mode={sheet.mode === 'newWorkout' ? 'new' : 'edit'}
          workout={editingWorkout}
          sleeps={doc.sleeps}
          viewDayStart={view.dayStart}
          demo={demo}
          onSave={saveWorkout}
          onClose={() => setSheet(null)}
        />
      )}
      {details && (
        <MealDetails
          meal={details}
          view={view}
          demo={demo}
          onClose={() => setSheet(null)}
          onEdit={() => setSheet({ mode: 'edit', mealId: details.id })}
          onDelete={() => deleteMeal(details.id)}
          onOpenScore={() => setSheet({ mode: 'meal', mealId: details.id })}
          saved={doc.savedMeals ?? []}
          onSaveUsual={(name, updateId) => saveUsual(details, name, updateId)}
          onManageSaved={() => setSheet({ mode: 'savedMeals', from: 'details', mealId: details.id })}
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
          quick={
            sheet.mode === 'new'
              ? {
                  logsOn: today ? null : copy.quickLog.when(fmtWeekday(editing.eatenAt), fmtTime(editing.eatenAt)),
                  onLog: (values) => quickLog(values, editing.eatenAt, today),
                  onManageSaved: () => setSheet({ mode: 'savedMeals', from: 'logMeal' }),
                }
              : undefined
          }
        />
      )}
      {sheet?.mode === 'weight' && (
        <WeightDetails
          weight={weight}
          demo={demo}
          onClose={() => setSheet(null)}
          onLog={() => openLogWeight('weight')}
          onEdit={(id) => setSheet({ mode: 'weighIn', id, from: 'weight', startAt: at })}
          onUnit={setWeightUnit}
          focusId={sheet.focusId ?? null}
        />
      )}
      {weighIn && (weighIn.id === null || editingWeighIn) && (
        <WeighInSheet
          key={weighIn.id ?? 'new'}
          existing={editingWeighIn ?? null}
          startAt={weighIn.startAt}
          startsOnEarlierDay={weighIn.id === null && weight.asOfDay !== null}
          unit={weight.unit}
          sleeps={doc.sleeps}
          nowIso={at}
          demo={demo}
          onSave={(w) => saveWeighIn(w, editingWeighIn ?? null, weighIn.from)}
          onDelete={(id) => deleteWeighIn(id, weighIn.from)}
          onClose={() => closeWeighIn(weighIn.from, weighIn.id)}
        />
      )}
      {sheet?.mode === 'savedMeals' && (
        <SavedMealsSheet
          saved={doc.savedMeals ?? []}
          demo={demo}
          onRename={(id, name) => update(withSavedMealRenamed(doc, id, name))}
          onDelete={(id) => update(withoutSavedMeal(doc, id))}
          onClose={() => closeSavedMeals(sheet.from, sheet.mealId)}
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
          onEditBody={() => setSheet({ mode: 'body', from: 'profile' })}
          nowIso={at}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.mode === 'setWake' && (
        <SetWakeSheet
          sleeps={doc.sleeps}
          meals={doc.meals}
          workouts={doc.workouts}
          weighIns={doc.weighIns}
          settings={doc.settings}
          nowIso={at}
          demo={demo}
          onSave={saveWake}
          onAddNight={() => setSheet({ mode: 'sleepEdit', target: { kind: 'add', wakeDate: toLocalInput(at).slice(0, 10) } })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.mode === 'resetDemo' && demo && (
        <ResetDemoSheet changes={sheet.changes} onConfirm={() => resetDemo(true)} onClose={() => setSheet(null)} />
      )}
      {sheet?.mode === 'sleepEdit' && (
        <SleepEditor
          doc={doc}
          target={sheet.target}
          nowIso={at}
          missedDate={missedWakeDate(doc.sleeps, viewedStart, at)}
          demo={demo}
          onSave={saveNight}
          onClose={() => setSheet(null)}
        />
      )}
      {sleepTime && (
        <SleepTimeSheet
          key={sleepTime.action}
          action={sleepTime.action}
          sleeps={doc.sleeps}
          meals={doc.meals}
          workouts={doc.workouts}
          weighIns={doc.weighIns}
          settings={doc.settings}
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
