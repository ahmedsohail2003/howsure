// What the app reads on start (spec.md > The Core Journey Through the System, steps 1 and 7):
// both logs, the last active one, and the demo clock. No React, so it is unit-tested.

import { setDemoClock, startDemoClock, type LogKind } from '../clock'
import { demoLog, emptyLog, startDemo, type LogDoc } from './log'
import { browserStore, loadActive, loadLog, saveLog, storageWorks, type KeyValueStore } from './storage'

export interface Logs {
  demo: LogDoc | null
  mine: LogDoc
}

export interface Session {
  active: LogKind | null
  logs: Logs
  /** Logs whose saved copy couldn't be read: shown from a fresh copy and never written over. */
  unreadable: Record<LogKind, boolean>
  /** False when the device won't save (blocked or full): the app keeps working in memory. */
  storageOk: boolean
}

/**
 * Read both logs and the last active one. A saved demo brings back its own clock, so the demo's
 * now continues from where it was (spec.md > Clock). A demo saved without a clock restarts it at
 * the fixture's moment and saves that, so the next reload continues from there.
 */
export function loadSession(store: KeyValueStore | null = browserStore(), realNow: number = Date.now()): Session {
  const storageOk = storageWorks(store)
  const demoRes = loadLog('demo', store)
  const mineRes = loadLog('mine', store)
  const unreadable = { demo: demoRes.status === 'unreadable', mine: mineRes.status === 'unreadable' }

  let demo: LogDoc | null = demoRes.status === 'ok' ? demoRes.doc : null
  if (demo?.clock) {
    setDemoClock(demo.clock)
  } else if (demo) {
    demo = { ...demo, clock: startDemoClock(demoLog().clockStartMs, realNow) }
    saveLog(demo, store)
  }

  let active = loadActive(store)
  if (active === 'demo' && !demo) {
    // A saved demo that couldn't be read: show a fresh copy in memory and leave the saved one alone.
    if (unreadable.demo) demo = startDemo(realNow)
    else active = null
  }
  const mine = mineRes.status === 'ok' ? mineRes.doc : emptyLog()
  return { active, logs: { demo, mine }, unreadable, storageOk }
}
