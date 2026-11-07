// prd.md > Screens and Layout, item 9: a small sleep section. Now's status, the one relevant button
// (**I'm going to sleep** when awake, **I woke up** when asleep), last night's length and the
// 7-night average with its night count. Each night sits one tap deep. A night with a missing
// sleep or wake time reads "not logged", never 0 h, and is left out of the average.
// Build-out item 2.2 (slice 6): the Edit button in the head says which night it opens. While a
// sleep is going on (current day) it sits beside "Asleep since …" and opens that sleep (**Edit
// this sleep**); otherwise it opens the night that started the viewed day (**Edit last night**, or
// **Edit the night before Wed** on an earlier day, or when nothing was logged for last night). Each night (and a sleep still going on) has
// its own Edit, with the date added when two rows would share a weekday; **Add a missed night**
// sits under the nights. The Night look's timeline also opens the editor from its points.
// Build-out item 1.5.2: the sleep button sits in the dashboard's action bar beside Log a meal
// (Dashboard.tsx), so it stays in reach on a phone; this section shows the status and the nights.
// Build-out item 2.9: last night and the 7-night average are one button that opens the sleep
// details (SleepDetails.tsx), like the weight summary; so is "Asleep since …" while a sleep is
// going on. Each night's Edit and Add a missed night stay here, one tap deep, as before.

import { copy } from './copy'
import { fmtWeekday, fmtWeekdayDate, fmtWeekdayTime } from './format'
import { KeepTogether } from './KeepTogether'
import { useLook } from './lookContext'
import { fmtClockMinutes, fmtDuration, headEdit, lastNightLabel, type SleepView } from './sleepView'

interface SleepSectionProps {
  sleep: SleepView
  /** True when the current waking day is on screen ("Last night"); false on an earlier day. */
  today: boolean
  /** The log's now, so Edit in the head and the row under it say "last night" only when no night has passed since. */
  nowIso: string
  /** Opens the sleep and wake editor on one night (build-out item 2.2). */
  onEditNight: (recordId: string) => void
  /** Opens the editor on a new, missed night. */
  onAddNight: () => void
  /** Opens the sleep details (build-out item 2.9). */
  onOpenSleep: () => void
}

export function SleepSection(props: SleepSectionProps) {
  const { look } = useLook()
  if (look === 'night') return <NightSleep {...props} />
  const { sleep, today, nowIso, onEditNight, onOpenSleep } = props
  const { status, lastNight, stats, dayRecordId } = sleep
  const asleep = status.kind === 'asleep'
  const edit = headEdit(sleep, today, nowIso)
  return (
    <section className="section sleep-section" aria-labelledby="sleep-title" data-testid="sleep-section">
      <div className="sleep-head">
        <h2 className="section-title" id="sleep-title">
          {copy.sleep.title}
        </h2>
        {/* The status and Edit share the right-hand side; on a narrow screen Edit wraps under the status. */}
        <div className="sleep-head-end">
          {asleep ? (
            <p className="sleep-status-line">
              <button
                type="button"
                className="sleep-status status-link num"
                onClick={onOpenSleep}
                aria-label={copy.sleepDetail.openLabel(copy.sleep.asleepSince(fmtWeekdayTime(status.since)))}
                data-testid="sleep-status"
                data-opens="sleep-details"
              >
                <KeepTogether text={copy.sleep.asleepSince(fmtWeekdayTime(status.since))} part={fmtWeekdayTime(status.since)} />
              </button>
            </p>
          ) : (
            <p className="sleep-status" data-testid="sleep-status">
              {copy.sleep.awake}
            </p>
          )}
          {edit && (
            <button
              type="button"
              className="link-btn sleep-edit"
              onClick={() => onEditNight(edit.recordId)}
              data-testid="sleep-edit"
            >
              {edit.label}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        className="sleep-open"
        onClick={onOpenSleep}
        aria-label={copy.sleepDetail.rowsLabel(
          lastNightLabel(sleep, today, nowIso),
          lastNight?.minutes != null ? fmtDuration(lastNight.minutes) : copy.sleep.notLogged,
          copy.sleep.average,
          stats.avgMinutes !== null ? fmtDuration(stats.avgMinutes) : copy.sleep.notAvailable.toLowerCase(),
          stats.total > 0 ? copy.sleep.nightCount(String(stats.complete), String(stats.total)) : null,
        )}
        data-testid="sleep-open"
        data-opens="sleep-details"
      >
        <span className="sleep-facts">
          <span className="sleep-fact">
            <span className="k" data-testid="last-night-label">
              {lastNightLabel(sleep, today, nowIso)}
            </span>
            {lastNight?.minutes != null ? (
              <span className="num sleep-figure sleep-duration" data-testid="last-night">
                {fmtDuration(lastNight.minutes)}
              </span>
            ) : (
              <span className="not-logged" data-testid="last-night">
                {copy.sleep.notLogged}
              </span>
            )}
          </span>
          <span className="sleep-fact">
            <span className="k">{copy.sleep.average}</span>
            <span className="sleep-avg" data-testid="sleep-average">
              {/* A real duration is a value: number style, on one line. "Not available yet" is a
                  status: plain text, and it may wrap. Where the row is too narrow for the duration
                  and the count side by side, the count goes on its own line under it and the
                  separator is not drawn (theme.css), so no line ends in " ·". */}
              {stats.avgMinutes !== null ? (
                <span className="num sleep-figure sleep-duration">{fmtDuration(stats.avgMinutes)}</span>
              ) : (
                <span className="sleep-na">{copy.sleep.notAvailable}</span>
              )}
              {stats.total > 0 && (
                <span className="sleep-count" data-testid="night-count">
                  <span className="sleep-sep">{copy.sep}</span>
                  <span className="sleep-count-words num">{copy.sleep.nightCount(String(stats.complete), String(stats.total))}</span>
                </span>
              )}
            </span>
          </span>
        </span>
      </button>

      <details className="more sleep-nights" data-testid="sleep-nights">
        <summary>{copy.sleep.eachNight}</summary>
        <EachNight sleep={sleep} today={today} onEditNight={onEditNight} onAddNight={props.onAddNight} />
      </details>
    </section>
  )
}

export { headEdit, lastNightLabel }

/**
 * Night look (build-out item 1.5.2c): the timeline already shows last night, now's status and the
 * 7-night average (NightTimeline.tsx), so this section keeps the rest: how many nights the average
 * counts and each night, one tap deep.
 */
function NightSleep({ sleep, today, onEditNight, onAddNight }: SleepSectionProps) {
  const { stats } = sleep
  return (
    <section className="section sleep-section night-sleep" aria-labelledby="sleep-title" data-testid="sleep-section">
      <h2 className="visually-hidden" id="sleep-title">
        {copy.sleep.title}
      </h2>
      <details className="more sleep-nights" data-testid="sleep-nights">
        <summary data-opens="expand">
          {copy.sleep.eachNight}
          {stats.total > 0 && (
            <span className="sleep-count num" data-testid="night-count">
              {copy.sep}
              {copy.sleep.nightCount(String(stats.complete), String(stats.total))}
            </span>
          )}
        </summary>
        <EachNight sleep={sleep} today={today} onEditNight={onEditNight} onAddNight={onAddNight} />
      </details>
    </section>
  )
}

interface EachNightProps {
  sleep: SleepView
  today: boolean
  onEditNight: (recordId: string) => void
  onAddNight: () => void
}

/**
 * Each night's length, newest first, each with Edit, and the average wake time. On the current
 * day a sleep still going on comes first, so it can be corrected too. Add a missed night is last.
 */
export function EachNight({ sleep, today, onEditNight, onAddNight }: EachNightProps) {
  const { stats, status } = sleep
  const open = today && status.kind === 'asleep' ? status : null
  const counts = new Map<string, number>()
  for (const n of stats.nights) {
    const w = fmtWeekday((n.wake ?? n.sleepStart) as string)
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  const repeated = new Set([...counts].filter(([, c]) => c > 1).map(([w]) => w))
  return (
    // The list is itself the detail its disclosure opens (data-detail, tests/e2e/tap-through.spec.ts):
    // each night's figure sits beside its own Edit.
    <div className="more-body" data-detail="each-night">
      {stats.total === 0 && !open ? (
        <p className="small">{copy.sleep.noNights}</p>
      ) : (
        <ul className="fact-list">
          {open && (
            <li data-testid="night-open-row">
              {/* A sentence, so plain text, not the tabular figures of a value. */}
              <span className="k">
                <KeepTogether text={copy.sleepEditor.asleepRow(fmtWeekdayTime(open.since))} part={fmtWeekdayTime(open.since)} />
              </span>
              <span className="night-row-end">
                <EditButton label={copy.sleepEditor.editAsleep(fmtWeekdayTime(open.since))} onClick={() => onEditNight(open.recordId)} />
              </span>
            </li>
          )}
          {[...stats.nights].reverse().map((n) => {
            const at = (n.wake ?? n.sleepStart) as string
            // Two rows on the same weekday (a gap over a week) get their dates, so each Edit is clear.
            const weekday = repeated.has(fmtWeekday(at)) ? fmtWeekdayDate(at) : fmtWeekday(at)
            return (
              <li key={n.id} data-testid="night-row">
                <span className="k">
                  {/* "Wed Nov 4" stays on one line when the name wraps. */}
                  <KeepTogether text={copy.sleep.nightRow(weekday)} part={weekday} />
                </span>
                <span className="night-row-end">
                  {n.minutes !== null ? (
                    <span className="num">{fmtDuration(n.minutes)}</span>
                  ) : (
                    <span className="not-logged">{copy.sleep.notLogged}</span>
                  )}
                  <EditButton label={copy.sleepEditor.editNight(weekday)} onClick={() => onEditNight(n.id)} />
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {stats.total > 0 && stats.complete < stats.total && <p className="small">{copy.sleep.leftOut}</p>}
      {stats.total > 0 && (
        <p className="small num" data-testid="avg-wake">
          {stats.avgWakeMinutes !== null
            ? copy.sleep.avgWake(fmtClockMinutes(stats.avgWakeMinutes))
            : stats.wakeVaries
              ? copy.sleep.wakeVaries
              : copy.sleep.notAvailable}
        </p>
      )}
      <p className="night-add">
        <button type="button" className="btn btn-quiet" onClick={onAddNight} data-testid="add-night">
          {copy.sleepEditor.addMissed}
        </button>
      </p>
    </div>
  )
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="link-btn night-edit" onClick={onClick} aria-label={label} data-testid="night-edit">
      {copy.sleepEditor.edit}
    </button>
  )
}
