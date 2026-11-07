// The dashboard header (prd.md > Screens and Layout > Dashboard, item 1): HowSure, the guest
// name that opens Profile and privacy (your own log), the viewed waking day with its wake time,
// the switch between the demo and your own log, and the More menu (build-out item 1.3). Build-out
// item 2.1: your own log is the main path, so the switch reads "Open my log" in the demo and
// offers the demo as a side door ("See the demo") in your own log; a log with no wake time offers
// Set wake time beside "Wake time not set". Build-out item 2.2: the wake time is a button that
// opens the sleep and wake editor on the night that started the day ("I woke at 8"). Build-out
// item 2.1b: when the current day's wake is more than a day old (an imported log, or nights not
// added yet), the line says when the last wake-up was and how long ago, and offers to set today's
// wake time. While
// the full-screen view is on, its way back sits here too, so it is one tap away.

import type { LogKind } from '../clock'
import { copy } from './copy'
import { fmtCalendarDate, fmtDate, fmtTime, fmtWeekday } from './format'
import { KeepTogether, TimesTogether } from './KeepTogether'

/** "Last wake‑up Sat 17 Oct, 7:15 AM · 3 days ago". */
function staleLine(dayStart: string, days: number, nowIso: string | undefined): string {
  return copy.header.lastWake(fmtCalendarDate(fmtDate(dayStart), nowIso), fmtTime(dayStart), copy.header.daysAgo(days))
}

interface DashboardHeaderProps {
  kind: LogKind
  dayStart: string | null
  /**
   * The open log's guest name (build-out item 2.10): your own log's, which opens Profile and
   * privacy ('' for a log saved before it had one), or the demo's fixed name, shown as text.
   */
  name: string
  onOpenProfile: () => void
  onSwitch: () => void
  /** Set wake time (build-out item 2.1): given only while the log has no wake time and nobody is asleep. */
  onSetWake?: () => void
  /** Build-out item 2.2: the wake time opens the sleep and wake editor on the night that started the day. */
  onEditWake?: () => void
  /** Whole days since the current day's wake when it is more than a day old (wakeSet.ts staleWakeDays), else null. */
  staleDays?: number | null
  /** Records today's wake (I woke up), offered beside a wake that is days old. */
  onSetTodayWake?: () => void
  /** The open log's now: the last wake-up's date leaves the year out when it is this year's. */
  nowIso?: string
  onOpenMore: () => void
  moreOpen: boolean
  fullScreenOn: boolean
  onExitFullScreen: () => void
}

export function DashboardHeader(props: DashboardHeaderProps) {
  const { kind, dayStart } = props
  return (
    <header className="app-header">
      <div>
        <h1 className="wordmark">{copy.appName}</h1>
        {kind === 'mine' ? (
          <button
            type="button"
            className="profile-btn"
            onClick={props.onOpenProfile}
            aria-label={copy.header.profileButtonLabel(props.name || copy.header.yourLog)}
            data-testid="open-profile"
            data-opens="profile-privacy"
          >
            {/* A name, marked so the tap-through test reads its digits as part of a name (item 2.9). */}
            <span className="profile-name" data-name="" data-testid="header-name">
              {props.name || copy.header.yourLog}
            </span>
            <span className="profile-link">{copy.header.profileAndPrivacy}</span>
          </button>
        ) : (
          // The demo keeps Sam's name (item 2.10). Rename and Reroll are for your own log only.
          <p className="profile-static" data-testid="demo-name">
            <span className="profile-name" data-name="" data-testid="header-name">
              {props.name}
            </span>
            <span className="profile-note">{copy.header.demoNameNote}</span>
          </p>
        )}
        {dayStart && props.staleDays != null ? (
          // A wake more than a day old (build-out item 2.1b): when it was and how long ago, in the
          // header's warning ink. It still opens the editor on that night, like the plain line.
          <div className="waking-day-unset waking-day-stale" data-testid="stale-wake">
            {props.onEditWake ? (
              <p className="waking-day-line">
                <button
                  type="button"
                  className="waking-day waking-day-btn"
                  onClick={props.onEditWake}
                  aria-label={copy.sleepEditor.editWake(staleLine(dayStart, props.staleDays, props.nowIso))}
                  data-testid="waking-day"
                  data-focus-return=""
                  data-opens="sleep-editor"
                >
                  <TimesTogether text={staleLine(dayStart, props.staleDays, props.nowIso)} />
                </button>
              </p>
            ) : (
              <p className="waking-day" data-testid="waking-day" tabIndex={-1} data-focus-return="">
                <TimesTogether text={staleLine(dayStart, props.staleDays, props.nowIso)} />
              </p>
            )}
            <p className="stale-hint">{copy.header.staleHint(copy.sleep.goingToSleep)}</p>
            {props.onSetTodayWake && (
              <button
                type="button"
                className="btn btn-quiet set-wake-btn"
                onClick={props.onSetTodayWake}
                data-testid="set-today-wake"
              >
                {/* A shorter label on the narrowest screens, so the button stays on one line. */}
                <span className="label-wide">{copy.header.setTodayWake}</span>
                <span className="label-narrow">{copy.header.setTodayWakeShort}</span>
              </button>
            )}
          </div>
        ) : dayStart && props.onEditWake ? (
          // data-focus-return (Sheet.tsx FOCUS_RETURN): where focus lands when a sheet closes and its
          // opener has gone, as Set wake time's button does once the wake time is saved.
          <p className="waking-day-line">
            <button
              type="button"
              className="waking-day waking-day-btn num"
              onClick={props.onEditWake}
              aria-label={copy.sleepEditor.editWake(copy.header.awakeSince(fmtWeekday(dayStart), fmtTime(dayStart)))}
              data-testid="waking-day"
              data-focus-return=""
              data-opens="sleep-editor"
            >
              <KeepTogether text={copy.header.awakeSince(fmtWeekday(dayStart), fmtTime(dayStart))} part={fmtTime(dayStart)} />
            </button>
          </p>
        ) : dayStart ? (
          <p className="waking-day num" data-testid="waking-day" tabIndex={-1} data-focus-return="">
            {copy.header.awakeSince(fmtWeekday(dayStart), fmtTime(dayStart))}
          </p>
        ) : (
          <div className="waking-day-unset">
            <p className="waking-day unset" data-testid="waking-day" tabIndex={-1} data-focus-return="">
              {copy.header.wakeTimeNotSet}
            </p>
            {props.onSetWake && (
              <button type="button" className="btn btn-quiet set-wake-btn" onClick={props.onSetWake} data-testid="set-wake">
                {copy.header.setWake}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="header-actions">
        {props.fullScreenOn && (
          <button type="button" className="btn btn-quiet" onClick={props.onExitFullScreen} data-testid="full-screen-exit">
            {copy.fullScreen.exit}
          </button>
        )}
        <button
          type="button"
          className="btn btn-quiet"
          onClick={props.onOpenMore}
          aria-haspopup="dialog"
          aria-expanded={props.moreOpen}
          data-testid="open-more"
        >
          {copy.moreMenu.button}
        </button>
        <button
          type="button"
          className={kind === 'demo' ? 'btn btn-quiet switch-main' : 'btn btn-quiet'}
          onClick={props.onSwitch}
          data-testid="log-switch"
        >
          {kind === 'demo' ? copy.header.switchToMine : copy.header.switchToDemo}
        </button>
      </div>
    </header>
  )
}
