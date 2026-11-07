// What the app reads on start (spec.md > The Core Journey Through the System, steps 1 and 7):
// both logs, the last active one, and the demo clock. No React, so it is unit-tested.

import { setDemoClock, startDemoClock, type LogKind } from '../clock'
import type { RandomInt } from '../kernel/gamertag'
import { demoLog, emptyLog, newOwnLog, startDemo, type LogDoc } from './log'
import type { StorageKeys } from './keys'
import type { Migrations } from './migrations'
import { isEmptyOwnLog } from './transfer'
import {
  browserStore,
  KEYS,
  loadActive,
  loadLog,
  readRaw,
  saveLog,
  storageWorks,
  type KeyValueStore,
  type LoadResult,
} from './storage'

export interface Logs {
  demo: LogDoc | null
  mine: LogDoc
}

/**
 * Why a log's saved copy must be left as it is (never written over):
 * - 'unreadable': it couldn't be read (bad JSON, no format version, a failed upgrade or check);
 * - 'newer': a newer version of HowSure saved it;
 * - 'notBackedUp': it was upgraded in memory, but its original text couldn't be backed up.
 * The first two are shown from a fresh copy; 'notBackedUp' shows the upgraded log.
 */
export type LogProblem = 'unreadable' | 'newer' | 'notBackedUp'

export interface Session {
  active: LogKind | null
  logs: Logs
  /** Per log, why its saved copy is never written over this session, or null when it can be. */
  problems: Record<LogKind, LogProblem | null>
  /** False when the device won't save (blocked or full): the app keeps working in memory. */
  storageOk: boolean
}

export interface SessionOptions {
  keys?: StorageKeys
  migrations?: Migrations
  /** The random source for a new log's guest name (build-out item 2.10); crypto by default. */
  rand?: RandomInt
}

/**
 * Build-out item 2.10: opening your own log when nothing of it is saved starts a new log with a
 * generated guest name, the same on every path (the first open, coming back from the demo, and a
 * start or reload that opens straight into it, as after "Delete my data"). Returns that new log,
 * for the caller to show and save, or null when the log is to be opened as it is: something of it
 * is saved (also a log saved with no name, which keeps none until you pick one), its saved copy
 * is left alone for a problem, or the log in memory holds anything (unsaved on a device that
 * won't save) or already has a name.
 */
export function newOwnLogIfUnsaved(
  mine: LogDoc,
  problem: LogProblem | null,
  store: KeyValueStore | null,
  keys: StorageKeys = KEYS,
  rand?: RandomInt,
): LogDoc | null {
  if (problem || readRaw(store, keys.mine) !== null) return null
  if (!isEmptyOwnLog(mine) || mine.profile.name !== '') return null
  return newOwnLog(rand)
}

function problemOf(res: LoadResult): LogProblem | null {
  if (res.status === 'unreadable') return 'unreadable'
  if (res.status === 'newer') return 'newer'
  if (res.status === 'ok' && res.saveBlocked) return 'notBackedUp'
  return null
}

/**
 * Read both logs and the last active one. A saved demo brings back its own clock, so the demo's
 * now continues from where it was (spec.md > Clock). A demo saved without a clock restarts it at
 * the fixture's moment and saves that, so the next reload continues from there.
 */
export function loadSession(
  store: KeyValueStore | null = browserStore(),
  realNow: number = Date.now(),
  opts: SessionOptions = {},
): Session {
  const keys = opts.keys ?? KEYS
  const storageOk = storageWorks(store, keys)
  const demoRes = loadLog('demo', store, { keys, migrations: opts.migrations })
  const mineRes = loadLog('mine', store, { keys, migrations: opts.migrations })
  const problems = { demo: problemOf(demoRes), mine: problemOf(mineRes) }

  let demo: LogDoc | null = demoRes.status === 'ok' ? demoRes.doc : null
  if (demo?.clock) {
    setDemoClock(demo.clock)
  } else if (demo) {
    demo = { ...demo, clock: startDemoClock(demoLog().clockStartMs, realNow) }
    if (!problems.demo) saveLog(demo, store, keys)
  }

  // Returning opens the last log used (build-out item 2.1). When no saved choice can be used, a
  // saved own log comes first (it is the main path), then a saved demo; with neither saved, the
  // first-open screen shows (active null).
  const mineSaved = mineRes.status !== 'missing'
  let active = loadActive(store, keys)
  if (active === 'demo' && !demo) {
    // A saved demo that couldn't be read: show a fresh copy in memory and leave the saved one alone.
    if (problems.demo) demo = startDemo(realNow)
    else active = mineSaved ? 'mine' : null
  } else if (active === null) {
    active = mineSaved ? 'mine' : demo ? 'demo' : null
  }
  let mine = mineRes.status === 'ok' ? mineRes.doc : emptyLog()
  let saved = storageOk
  if (active === 'mine') {
    const fresh = newOwnLogIfUnsaved(mine, problems.mine, store, keys, opts.rand)
    if (fresh) {
      mine = fresh
      if (!saveLog(fresh, store, keys)) saved = false
    }
  }
  return { active, logs: { demo, mine }, problems, storageOk: saved }
}
