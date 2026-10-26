// prd.md > Screens and Layout, item 10, and > Previous Days: previous/next and a date picker at the
// bottom of the dashboard, to move between waking days. Earlier days stay saved and editable.

import { copy } from './copy'

export interface DayNavState {
  canPrev: boolean
  canNext: boolean
  /** True when the current waking day is on screen. */
  today: boolean
  /** The viewed day's date, and the picker's bounds, as "YYYY-MM-DD". */
  date: string
  min: string
  max: string
}

interface DayNavProps {
  nav: DayNavState
  onPrev: () => void
  onNext: () => void
  onPickDate: (date: string) => void
  onToday: () => void
}

export function DayNav({ nav, onPrev, onNext, onPickDate, onToday }: DayNavProps) {
  return (
    <nav className="day-nav" aria-label={copy.nav.label} data-testid="day-nav">
      <div className="day-nav-row">
        <button type="button" className="btn btn-quiet" onClick={onPrev} disabled={!nav.canPrev} data-testid="day-prev">
          <span aria-hidden="true">‹ </span>
          {copy.nav.previous}
        </button>
        <input
          type="date"
          className="day-date num"
          aria-label={copy.nav.pickDate}
          value={nav.date}
          min={nav.min}
          max={nav.max}
          onChange={(e) => {
            if (e.target.value) onPickDate(e.target.value)
          }}
          data-testid="day-date"
        />
        <button type="button" className="btn btn-quiet" onClick={onNext} disabled={!nav.canNext} data-testid="day-next">
          {copy.nav.next}
          <span aria-hidden="true"> ›</span>
        </button>
      </div>
      {!nav.today && (
        <button type="button" className="link-btn day-today" onClick={onToday} data-testid="day-today">
          {copy.nav.backToToday}
        </button>
      )}
    </nav>
  )
}
