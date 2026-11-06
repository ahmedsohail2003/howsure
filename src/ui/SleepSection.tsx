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

import { copy } from './copy'
import { fmtWeekday, fmtWeekdayDate, fmtWeekdayTime } from './format'
import { KeepTogether } from './KeepTogether'
import { useLook } from './lookContext'
import { fmtClockMinutes, fmtDuration, nightGoneBySince, type SleepView } from './sleepView'

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
}

export function SleepSection(props: SleepSectionProps) {
  const { look } = useLook()
  if (look === 'night') return <NightSleep {...props} />
  const { sleep, today, nowIso, onEditNight } = props
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
          <p className="sleep-status num" data-testid="sleep-status">
            {asleep ? <KeepTogether text={copy.sleep.asleepSince(fmtWeekdayTime(status.since))} part={fmtWeekdayTime(status.since)} /> : copy.sleep.awake}
          </p>
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

      <ul className="fact-list sleep-facts">
        <li>
          <span className="k" data-testid="last-night-label">
            {lastNightLabel(sleep, today, nowIso)}
          </span>
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
        <EachNight sleep={sleep} today={today} onEditNight={onEditNight} onAddNight={props.onAddNight} />
      </details>
    </section>
  )
}

/**
 * What Edit in the head opens, and its visible words. On the current day while asleep: the sleep
 * going on, beside "Asleep since …". Otherwise the night that started the viewed day: "last night"
 * when no night has passed since it (isLastNight); otherwise named by its day (an earlier day, or
 * a current day that runs on because nothing was logged for last night).
 */
export function headEdit(sleep: SleepView, today: boolean, nowIso: string): { recordId: string; label: string } | null {
  if (today && sleep.status.kind === 'asleep') return { recordId: sleep.status.recordId, label: copy.sleepEditor.editThisSleep }
  if (!sleep.dayRecordId || !sleep.dayStart) return null
  const last = isLastNight(sleep, today, nowIso)
  return {
    recordId: sleep.dayRecordId,
    label: last ? copy.sleepEditor.editLastNight : copy.sleepEditor.editNight(fmtWeekday(sleep.dayStart)),
  }
}

/**
 * True when the night that started the viewed day is the one the person last woke from with no
 * night since: the current day, woken up from under 24 hours ago (nightGoneBySince). So at 1:30 AM,
 * still up after waking at 7:10 AM the day before, that night is still "last night"; at 10:00 AM
 * the day after, with nothing logged in between, it is named by its day.
 */
function isLastNight(sleep: SleepView, today: boolean, nowIso: string): boolean {
  return today && sleep.dayStart !== null && !nightGoneBySince(sleep.dayStart, nowIso)
}

/**
 * The name of the row under the head: "Last night" only under the same test Edit in the head uses. On a current day that runs on because nothing was logged for last night,
 * the night is named by its day ("Night before Wed"), so the row never claims it was last night.
 * With no night at all on the current day, "Last night" reads "not logged", which is true.
 */
export function lastNightLabel(sleep: SleepView, today: boolean, nowIso: string): string {
  if (!today) return copy.sleep.nightBefore
  if (sleep.dayStart === null || isLastNight(sleep, today, nowIso)) return copy.sleep.lastNight
  return copy.sleep.nightRow(fmtWeekday(sleep.dayStart))
}

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
        <summary>
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
function EachNight({ sleep, today, onEditNight, onAddNight }: EachNightProps) {
  const { stats, status } = sleep
  const open = today && status.kind === 'asleep' ? status : null
  const counts = new Map<string, number>()
  for (const n of stats.nights) {
    const w = fmtWeekday((n.wake ?? n.sleepStart) as string)
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  const repeated = new Set([...counts].filter(([, c]) => c > 1).map(([w]) => w))
  return (
    <div className="more-body">
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
