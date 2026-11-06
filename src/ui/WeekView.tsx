// The week view (build-out item 2.7; checklist slice 8; spec.md > Screens > WeekView.tsx): the
// averages of every stat over the waking days ending at the day on screen, grouped (food, workouts
// and balance, sleep, weight), each one tap from its day-by-day breakdown. The breakdown lists
// every day with its value and whether it was counted, left out (and why) or not logged; a day
// opens that day on the dashboard. The calorie breakdown also draws each day as an SVG bar with
// its range whiskers, for the eye only: every number on it is in the list under it.
//
// One component for every look: weekView.ts works out the numbers and words once, and each look's
// stylesheet (theme.css > week view) chooses how the rows are drawn.

import type { StatId } from '../kernel/statRegistry'
import { copy } from './copy'
import { Sheet } from './Sheet'
import type { WeekChart, WeekStatRow, WeekView } from './weekView'

interface WeekSheetProps {
  week: WeekView
  demo: boolean
  onClose: () => void
  onOpenStat: (id: StatId) => void
  /** The row to focus when coming back from its breakdown. */
  focusStat?: StatId | null
}

export function WeekSheet({ week, demo, onClose, onOpenStat, focusStat }: WeekSheetProps) {
  return (
    <Sheet
      title={copy.week.title}
      sub={week.window}
      demo={demo}
      onClose={onClose}
      testId="week-view"
      initialFocusTestId={focusStat ? `week-row-${focusStat}` : undefined}
    >
      {week.todayNote && (
        <p className="week-note" data-testid="week-today-note">
          {week.todayNote}
        </p>
      )}
      {week.empty && (
        <p className="week-empty" data-testid="week-empty">
          {copy.week.empty}
        </p>
      )}
      {!week.empty && week.groups.map((g) => (
        <section key={g.id} className="week-group" aria-labelledby={`week-group-${g.id}`} data-testid="week-group">
          <h3 className="week-group-title" id={`week-group-${g.id}`}>
            {g.title}
          </h3>
          <ul className="week-rows">
            {g.rows.map((r) => (
              <li key={r.id} className="week-row" data-testid="week-stat" data-stat={r.id}>
                <button
                  type="button"
                  className="week-open"
                  onClick={() => onOpenStat(r.id)}
                  aria-label={r.label}
                  data-testid={`week-row-${r.id}`}
                >
                  <span className="week-title">{r.title}</span>
                  <span className={r.ok ? 'week-value num' : 'week-value status'} data-testid="week-value">
                    {r.value}
                  </span>
                  {r.count && (
                    <span className="week-count" data-testid="week-count">
                      {r.count}
                    </span>
                  )}
                  {r.lines.length > 0 && (
                    <span className="week-lines">
                      {r.lines.map((l, i) => (
                        <span key={i} className={keepsTogether(l) ? 'week-line week-keep' : 'week-line'} data-testid="week-line">
                          {l}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Sheet>
  )
}

interface BreakdownProps {
  row: WeekStatRow
  window: string
  demo: boolean
  /** Back to the week, at this row. */
  onClose: () => void
  /** Opens a day on the dashboard. */
  onOpenDay: (dayStart: string | null) => void
}

export function WeekBreakdownSheet({ row, window, demo, onClose, onOpenDay }: BreakdownProps) {
  const b = row.breakdown
  return (
    <Sheet title={b.title} sub={window} demo={demo} onClose={onClose} testId="week-breakdown">
      <div className="week-avg" data-testid="week-breakdown-average">
        <p className="week-avg-label">{copy.week.average}</p>
        <p className={row.ok ? 'week-avg-value num' : 'week-avg-value status'} data-testid="week-value">
          {row.value}
        </p>
        {row.count && (
          <p className="week-count" data-testid="week-count">
            {row.count}
          </p>
        )}
        {row.lines.map((l, i) => (
          <p key={i} className={keepsTogether(l) ? 'week-line week-keep' : 'week-line'} data-testid="week-line">
            {l}
          </p>
        ))}
      </div>
      <p className="week-intro" data-testid="week-intro">
        {b.intro}
      </p>
      {b.chart && <WeekChartView chart={b.chart} />}
      <ul className="week-days" data-testid="week-days">
        {b.days.map((d, i) => (
          <li key={i} className="week-day" data-testid="week-day" data-state={d.state}>
            <button type="button" className="week-day-open" onClick={() => onOpenDay(d.dayStart)} aria-label={d.label} data-testid="week-day-open">
              <span className="week-day-name">{d.day}</span>
              {d.value && (
                <span className={d.ok ? 'week-day-value num' : 'week-day-value status'} data-testid="week-day-value">
                  {d.value}
                </span>
              )}
              {d.detail && (
                <span className="week-day-detail" data-testid="week-day-detail">
                  {d.detail.split(copy.sep).map((part, pi) => (
                    <span key={pi}>
                      {pi > 0 && copy.sep}
                      <span className={keepsTogether(part) ? 'week-keep' : undefined}>{part}</span>
                    </span>
                  ))}
                </span>
              )}
              <span className={`week-day-status ${d.state}`} data-testid="week-day-status">
                {d.status}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {b.notes?.map((n, i) => (
        <p key={i} className="week-note" data-testid="week-note">
          {n}
        </p>
      ))}
    </Sheet>
  )
}

/**
 * True for a range joined by an en dash ("likely 1,116–1,963 kcal"): a browser may break a line
 * after the dash, so such a part is kept on one line and the text around it wraps instead. A range
 * written with "to" ("−140 to 3,140 kcal") can wrap at its spaces, never inside a number.
 */
function keepsTogether(text: string): boolean {
  return text.includes('–')
}

/** Height of the chart's drawing, in its own units; each day is 10 units wide. */
const CHART_H = 100
const DAY_W = 10
/** A logged day of 0 kcal still gets a sliver of bar, so it never looks like a day not logged (no bar). */
const MIN_BAR = 2

/**
 * A day with no bar: not logged, or every meal of unknown calories (a sliver for it would hint at
 * "about 0 kcal"; the list under the chart says "unknown, left out").
 */
function noBar(b: WeekChart['bars'][number]): boolean {
  return b.kind === 'notLogged' || (b.kind === 'incomplete' && b.value <= 0)
}

/** The calorie breakdown's bars and range whiskers. Drawn for the eye only (aria-hidden). */
function WeekChartView({ chart }: { chart: WeekChart }) {
  const n = chart.bars.length
  // A little room above the tallest whisker.
  const y = (v: number) => CHART_H - (Math.max(0, v) / chart.top) * (CHART_H - 6)
  return (
    <figure className="week-chart" aria-hidden="true" data-testid="week-chart">
      <svg className="week-chart-svg" viewBox={`0 0 ${n * DAY_W} ${CHART_H}`} preserveAspectRatio="none" focusable="false">
        <line className="week-chart-base" x1={0} x2={n * DAY_W} y1={CHART_H} y2={CHART_H} />
        {chart.bars.map((b, i) => {
          const cx = i * DAY_W + DAY_W / 2
          if (noBar(b)) return null
          return (
            <g key={i} data-testid="week-chart-bar" data-kind={b.kind}>
              <rect
                className={b.kind === 'logged' ? 'week-bar' : 'week-bar incomplete'}
                x={i * DAY_W + 2.5}
                width={DAY_W - 5}
                y={Math.min(y(b.value), CHART_H - MIN_BAR)}
                height={Math.max(CHART_H - y(b.value), MIN_BAR)}
              />
              {b.veryLikely && <line className="week-whisker thin" x1={cx} x2={cx} y1={y(b.veryLikely.lo)} y2={y(b.veryLikely.hi)} />}
              {b.likely && <line className="week-whisker" x1={cx} x2={cx} y1={y(b.likely.lo)} y2={y(b.likely.hi)} />}
            </g>
          )
        })}
        {chart.average !== null && (
          <line className="week-avg-line" x1={0} x2={n * DAY_W} y1={y(chart.average)} y2={y(chart.average)} data-testid="week-chart-average" />
        )}
      </svg>
      <div className="week-chart-days" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {chart.bars.map((b, i) => (
          <span key={i} data-testid="week-chart-day">
            <span>{b.name}</span>
            {b.date && <span className="week-chart-date">{b.date}</span>}
          </span>
        ))}
      </div>
      <figcaption className="week-chart-legend">{copy.week.chartLegend}</figcaption>
    </figure>
  )
}
