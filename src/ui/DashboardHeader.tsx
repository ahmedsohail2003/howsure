// The dashboard header (prd.md > Screens and Layout > Dashboard, item 1): HowSure, the guest
// name that opens Profile and privacy (your own log), the viewed waking day with its wake time,
// the switch between the demo and your own log, and the More menu (build-out item 1.3). Build-out
// item 2.1: your own log is the main path, so the switch reads "Open my log" in the demo and
// offers the demo as a side door ("See the demo") in your own log; a log with no wake time offers
// Set wake time beside "Wake time not set". While
// the full-screen view is on, its way back sits here too, so it is one tap away.

import type { LogKind } from '../clock'
import { copy } from './copy'
import { fmtTime, fmtWeekday } from './format'

interface DashboardHeaderProps {
  kind: LogKind
  dayStart: string | null
  /** The guest name in your own log ('' until item 2.10 gives one). */
  ownName: string
  onOpenProfile: () => void
  onSwitch: () => void
  /** Set wake time (build-out item 2.1): given only while the log has no wake time and nobody is asleep. */
  onSetWake?: () => void
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
        {kind === 'mine' && (
          <button type="button" className="profile-btn" onClick={props.onOpenProfile} data-testid="open-profile">
            <span className="profile-name">{props.ownName || copy.header.yourLog}</span>
            <span className="profile-link">{copy.header.profileAndPrivacy}</span>
          </button>
        )}
        {dayStart ? (
          // data-focus-return (Sheet.tsx FOCUS_RETURN): where focus lands when a sheet closes and its
          // opener has gone, as Set wake time's button does once the wake time is saved.
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
