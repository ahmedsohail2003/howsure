// What the app reads on start (spec.md > The Core Journey Through the System, steps 1 and 7):
// both logs, the last active one, and the demo clock. No React, so it is unit-tested.

import { setDemoClock, startDemoClock, type LogKind } from '../clock'
import { demoLog, emptyLog, startDemo, type LogDoc } from './log'
import type { StorageKeys } from './keys'
import type { Migrations } from './migrations'
import {
  browserStore,
  KEYS,
  loadActive,
  loadLog,
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

  let active = loadActive(store, keys)
  if (active === 'demo' && !demo) {
    // A saved demo that couldn't be read: show a fresh copy in memory and leave the saved one alone.
    if (problems.demo) demo = startDemo(realNow)
    else active = null
  }
  const mine = mineRes.status === 'ok' ? mineRes.doc : emptyLog()
  return { active, logs: { demo, mine }, problems, storageOk }
}
