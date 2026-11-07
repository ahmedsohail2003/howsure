// Build-out item 2.9: the sleep details, opened from last night and the 7-night average on the
// dashboard in every look (the sleep section's rows in Journal and Panel; the figures on the Night
// timeline's points, and its point for now). One sheet for every look: what it shows is worked out
// in sleepView.ts (sleepDetailView), from the same SleepView the dashboard draws.
// - Now: awake, or asleep since a time (the current day only: it is about now).
// - The night that started the day: when the sleep started and ended, and its length; a missing
//   time is "not logged", never 0. Edit opens it in the sleep and wake editor.
// - The 7-night average with its count, how it is worked out, and where the times come from.
// - Each night, with its Edit, and Add a missed night (the same list as the section's).

import { copy } from './copy'
import { fmtWeekdayDateTime } from './format'
import { Sheet } from './Sheet'
import { EachNight } from './SleepSection'
import { sleepDetailView, type SleepView } from './sleepView'

interface SleepDetailsProps {
  sleep: SleepView
  /** True when the current waking day is on screen. */
  today: boolean
  nowIso: string
  demo: boolean
  onClose: () => void
  /** Opens one night in the sleep and wake editor; closing the editor comes back here. */
  onEditNight: (recordId: string) => void
  onAddNight: () => void
}

export function SleepDetails({ sleep, today, nowIso, demo, onClose, onEditNight, onAddNight }: SleepDetailsProps) {
  const d = sleepDetailView(sleep, today, nowIso)
  return (
    <Sheet
      title={copy.sleepDetail.title}
      sub={
        !sleep.dayStart
          ? copy.sleepDetail.subProvisional
          : today && sleep.status.kind === 'asleep'
            ? copy.sleepDetail.subAsleep(fmtWeekdayDateTime(sleep.dayStart))
            : copy.sleepDetail.sub(fmtWeekdayDateTime(sleep.dayStart))
      }
      demo={demo}
      onClose={onClose}
      testId="sleep-details"
    >
      {d.now !== null && (
        <ul className="fact-list sleep-detail-now">
          <li data-testid="sleep-detail-now">
            <span className="k">{copy.sleepDetail.now}</span>
            {/* Words, not a value: plain text. */}
            <span>{d.now}</span>
          </li>
        </ul>
      )}

      <section className="sleep-detail-block" aria-labelledby="sleep-detail-last">
        <h3 className="section-title" id="sleep-detail-last" data-testid="sleep-detail-last-label">
          {d.lastNightLabel}
        </h3>
        {d.lastNight ? (
          <>
            {/* The night that was tapped leads: its length is the sheet's largest figure. */}
            {d.lastNight.length !== null ? (
              <p className="big-figure num nowrap" data-testid="sleep-detail-length">
                {d.lastNight.length}
              </p>
            ) : (
              // "not logged" reads as the dashboard's row does: amber (incomplete), normal weight.
              <p className="not-logged" data-testid="sleep-detail-length">
                {copy.sleep.notLogged}
              </p>
            )}
            <ul className="fact-list" data-testid="sleep-detail-last">
              <li>
                <span className="k">{copy.sleepDetail.wentToSleep}</span>
                {d.lastNight.sleptAt !== null ? (
                  <span className="num nowrap">{d.lastNight.sleptAt}</span>
                ) : (
                  <span className="not-logged">{copy.sleep.notLogged}</span>
                )}
              </li>
              <li>
                <span className="k">{copy.sleepDetail.woke}</span>
                <span className="num nowrap">{d.lastNight.wokeAt}</span>
              </li>
            </ul>
          </>
        ) : (
          <p className="small" data-testid="sleep-detail-last">
            {sleep.dayStart ? copy.sleepDetail.lastNightNone : copy.sleepDetail.lastNightNoneYet}
          </p>
        )}
        {d.edit && (
          <p className="sleep-detail-edit">
            <button type="button" className="btn btn-quiet" onClick={() => onEditNight(d.edit!.recordId)} data-testid="sleep-detail-edit">
              {d.edit.label}
            </button>
          </p>
        )}
      </section>

      <section className="sleep-detail-block" aria-labelledby="sleep-detail-avg">
        <h3 className="section-title" id="sleep-detail-avg">
          {copy.sleepDetail.averageTitle}
        </h3>
        {/* A duration is a value; "Not available yet" is a status: plain normal-weight text. */}
        <p className={d.average !== null ? 'mid-figure num nowrap' : 'details-status'} data-testid="sleep-detail-average">
          {d.average ?? copy.sleep.notAvailable}
        </p>
        {d.count !== null && (
          <p data-testid="sleep-detail-count">
            {d.count}
          </p>
        )}
        <p className="small">{copy.sleepDetail.averageHow}</p>
        <p className="small" data-testid="sleep-detail-source">
          {copy.sleepDetail.source}
        </p>
      </section>

      <section className="sleep-detail-block sleep-nights sleep-detail-nights" aria-labelledby="sleep-detail-each">
        <h3 className="section-title" id="sleep-detail-each">
          {copy.sleepDetail.eachNight}
        </h3>
        <EachNight sleep={sleep} today={today} onEditNight={onEditNight} onAddNight={onAddNight} />
      </section>
    </Sheet>
  )
}
