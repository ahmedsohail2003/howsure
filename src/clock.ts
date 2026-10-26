// spec.md > Clock.
// Your own log runs on real time. The demo runs on its own clock:
//   demo now = demoEpochFixture + (Date.now() - demoEpochReal)
// so it starts at the fixture's moment (Thu 2026-10-22 01:30 local) and then
// moves forward in real time. Slice 1 keeps the two values in memory; slice 2
// stores them in the demo document's `clock` so a reload stays continuous.

export type LogKind = 'demo' | 'mine'

/** The demo's starting moment, as a wall-clock string with no offset (parsed as local time). */
export const DEMO_START_WALL = '2026-10-22T01:30:00'

export interface DemoClockState {
  demoEpochFixture: number // ms since epoch: the demo's "now" at the anchor
  demoEpochReal: number // ms since epoch: the real time at the anchor
}

let demoClock: DemoClockState | null = null

/** Parse a wall-clock string with no offset (e.g. "2026-10-21T13:20:00") as local time. */
export function parseWallClock(wall: string): number {
  const ms = new Date(wall).getTime()
  if (Number.isNaN(ms)) throw new Error(`clock: not a date-time: ${wall}`)
  return ms
}

/**
 * Start (or restart, for Reset demo) the demo clock at the fixture's moment.
 * `fixtureStartMs` defaults to Thu 2026-10-22 01:30 local; the demo loader passes the
 * fixture's own `clock.start` so the clock and the meals share one time frame.
 */
export function startDemoClock(
  fixtureStartMs: number = parseWallClock(DEMO_START_WALL),
  realNow: number = Date.now(),
): DemoClockState {
  demoClock = { demoEpochFixture: fixtureStartMs, demoEpochReal: realNow }
  return demoClock
}

/** Restore a saved demo clock (slice 2 reads it from the demo document). */
export function setDemoClock(state: DemoClockState): void {
  demoClock = { ...state }
}

export function getDemoClock(): DemoClockState | null {
  return demoClock ? { ...demoClock } : null
}

/** Move the demo's now to `atMs` (a sleep or wake time saved past the demo's now). */
export function reanchorDemoClock(atMs: number, realNow: number = Date.now()): DemoClockState {
  demoClock = { demoEpochFixture: atMs, demoEpochReal: realNow }
  return demoClock
}

/** The demo's current time in ms. Starts the demo clock if it hasn't been started. */
export function demoNowMs(realNow: number = Date.now()): number {
  const c = demoClock ?? startDemoClock(undefined, realNow)
  return c.demoEpochFixture + (realNow - c.demoEpochReal)
}

/** Now for the active log: real time for your own log, the demo clock for the demo. */
export function nowMs(kind: LogKind, realNow: number = Date.now()): number {
  return kind === 'demo' ? demoNowMs(realNow) : realNow
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** ISO 8601 with the local offset, e.g. "2026-10-21T13:20:00-04:00" (the format logs store). */
export function toLocalIso(ms: number): string {
  const d = new Date(ms)
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

/** True when an ISO string carries its own offset or Z. */
export function hasOffset(iso: string): boolean {
  return /(Z|[+-]\d{2}:?\d{2})$/.test(iso)
}

/** Convert a fixture wall-clock string to a local-offset ISO string; full ISO strings pass through. */
export function wallToLocalIso(wallOrIso: string): string {
  return hasOffset(wallOrIso) ? wallOrIso : toLocalIso(parseWallClock(wallOrIso))
}

/** Now for the active log, as a local-offset ISO string (what the kernel's sleepday takes). */
export function nowIso(kind: LogKind, realNow: number = Date.now()): string {
  return toLocalIso(nowMs(kind, realNow))
}
