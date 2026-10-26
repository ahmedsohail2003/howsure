// prd.md > Screens and Layout, item 9: a small sleep section. Now's status, the one relevant button
// (**I'm going to sleep** when awake, **I woke up** when asleep), last night's length and the
// 7-night average with its night count. Each night sits one tap deep. A night with a missing
// sleep or wake time reads "not logged", never 0 h, and is left out of the average.
// The sleep/wake editor (**Edit**) arrives in slice 6.

import { copy } from './copy'
import { fmtWeekday, fmtWeekdayTime } from './format'
import { fmtClockMinutes, fmtDuration, type SleepAction, type SleepView } from './sleepView'

interface SleepSectionProps {
  sleep: SleepView
  /** True when the current waking day is on screen ("Last night"); false on an earlier day. */
  today: boolean
  onAction: (action: SleepAction) => void
}

export function SleepSection({ sleep, today, onAction }: SleepSectionProps) {
  const { status, lastNight, stats } = sleep
  const asleep = status.kind === 'asleep'
  return (
    <section className="section sleep-section" aria-labelledby="sleep-title" data-testid="sleep-section">
      <div className="sleep-head">
        <div>
          <h2 className="section-title" id="sleep-title">
            {copy.sleep.title}
          </h2>
          <p className="sleep-status num" data-testid="sleep-status">
            {asleep ? copy.sleep.asleepSince(fmtWeekdayTime(status.since)) : copy.sleep.awake}
          </p>
        </div>
        <button
          type="button"
          className="btn sleep-btn"
          onClick={() => onAction(asleep ? 'wake' : 'sleep')}
          data-testid="sleep-action"
        >
          {asleep ? copy.sleep.wokeUp : copy.sleep.goingToSleep}
        </button>
      </div>

      <ul className="fact-list sleep-facts">
        <li>
          <span className="k">{today ? copy.sleep.lastNight : copy.sleep.nightBefore}</span>
          {lastNight?.minutes != null ? (
            <span className="num" data-testid="last-night">
              {fmtDuration(lastNight.minutes)}
            </span>
          ) : (
            <span className="not-logged" data-testid="last-night">
              {copy.sleep.notLogged}
            </span>
          )}
        </li>
        <li>
          <span className="k">{copy.sleep.average}</span>
          <span className="num sleep-avg" data-testid="sleep-average">
            {stats.avgMinutes !== null ? fmtDuration(stats.avgMinutes) : copy.sleep.notAvailable}
            {stats.total > 0 && (
              <span className="sleep-count" data-testid="night-count">
                {copy.sep}
                {copy.sleep.nightCount(String(stats.complete), String(stats.total))}
              </span>
            )}
          </span>
        </li>
      </ul>

      <details className="more sleep-nights" data-testid="sleep-nights">
        <summary>{copy.sleep.eachNight}</summary>
        {stats.total === 0 ? (
          <p className="small">{copy.sleep.noNights}</p>
        ) : (
          <div className="more-body">
            <ul className="fact-list">
              {[...stats.nights].reverse().map((n) => (
                <li key={n.id} data-testid="night-row">
                  <span className="k">
                    {copy.sleep.nightRow(fmtWeekday((n.wake ?? n.sleepStart) as string))}
                  </span>
                  {n.minutes !== null ? (
                    <span className="num">{fmtDuration(n.minutes)}</span>
                  ) : (
                    <span className="not-logged">{copy.sleep.notLogged}</span>
                  )}
                </li>
              ))}
            </ul>
            {stats.complete < stats.total && <p className="small">{copy.sleep.leftOut}</p>}
            <p className="small num" data-testid="avg-wake">
              {stats.avgWakeMinutes !== null
                ? copy.sleep.avgWake(fmtClockMinutes(stats.avgWakeMinutes))
                : stats.wakeVaries
                  ? copy.sleep.wakeVaries
                  : copy.sleep.notAvailable}
            </p>
          </div>
        )}
      </details>
    </section>
  )
}
