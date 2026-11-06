// Build-out item 2.4: the weight details, one tap from the dashboard's weight (and from More). The
// latest weigh-in, the 7-day average with its count and the trend with how it is worked out; the
// unit weights are shown in; a chart of the last 30 days; and every weigh-in as a list, each one
// opening it to edit or delete. The chart is drawn for the eye only: every point on it is also in
// the list as text. On an earlier day the latest, the average, the trend and the chart are as they
// stood when that day ended, and a line says so; the list still holds every weigh-in, and marks
// the ones after that day.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { WeightUnit } from '../kernel/types'
import { copy } from './copy'
import { TimesTogether } from './KeepTogether'
import { Sheet } from './Sheet'
import { averageText, CHART_WIDTH, fmtWeighInWhen, fmtWeight, trendParts, type WeightView } from './weightView'

interface WeightDetailsProps {
  weight: WeightView
  demo: boolean
  onClose: () => void
  onLog: () => void
  onEdit: (id: string) => void
  onUnit: (unit: WeightUnit) => void
  /** The weigh-in whose edit sheet was just closed: its row gets focus back. */
  focusId?: string | null
}

const UNITS: readonly WeightUnit[] = ['kg', 'lb']

export function WeightDetails({ weight, demo, onClose, onLog, onEdit, onUnit, focusId = null }: WeightDetailsProps) {
  const id = useId()
  const { unit, all, average, trend, latestAsOf: latest, asOfDay } = weight
  const avg = averageText(average, unit, asOfDay === null, weight.ranOnTo)
  const rate = trendParts(trend, unit)
  // On an earlier day, the weigh-ins after it: the list still shows them, marked as later.
  const isLater = (at: string) => asOfDay !== null && Date.parse(at) > Date.parse(weight.asOf)
  const anyLater = all.some((w) => isLater(w.at))
  const chartRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  // The chart is laid out at the width it is shown at, so its labels stay one size on every screen.
  const [chartWidth, setChartWidth] = useState(CHART_WIDTH)
  const chart = chartWidth === CHART_WIDTH ? weight.chart : weight.chartAt(chartWidth)
  // The measured box is drawn only while there are weigh-ins, so the effect re-runs when that changes.
  const hasWeighIns = all.length > 0
  useLayoutEffect(() => {
    const box = chartRef.current
    if (!box) return
    const measure = () => {
      const w = Math.round(box.getBoundingClientRect().width)
      if (w > 0) setChartWidth(w)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [hasWeighIns])
  // Back from a weigh-in's edit sheet: focus its row again, so a keyboard user keeps their place in
  // the list. A parent's effects run after its children's, so this comes after the Sheet has put
  // focus on Close. A deleted weigh-in has no row, and focus stays on Close.
  useEffect(() => {
    if (focusId === null) return
    listRef.current?.querySelector<HTMLElement>(`[data-weigh-in-id="${CSS.escape(focusId)}"]`)?.focus()
  }, [focusId])

  const footer = (
    <div className="sheet-actions">
      <button type="button" className="btn btn-primary" onClick={onLog} data-testid="weight-details-log">
        {copy.weight.logWeight}
      </button>
    </div>
  )

  return (
    <Sheet title={copy.weight.title} sub={copy.weight.detailsSub} demo={demo} onClose={onClose} testId="weight-details" footer={footer}>
      {all.length === 0 ? (
        <p data-testid="weight-details-empty">{copy.weight.noWeighInsYet}</p>
      ) : (
        <>
          {asOfDay !== null && (
            <p className="weight-as-of" data-testid="weight-as-of">
              {weight.ranOnTo === null ? (
                copy.weight.asOfDay(asOfDay)
              ) : (
                <TimesTogether text={weight.provisional ? copy.weight.asOfProvisional(weight.ranOnTo) : copy.weight.asOfDayRanOn(asOfDay, weight.ranOnTo)} />
              )}
            </p>
          )}
          <ul className="fact-list weight-summary" data-testid="weight-summary">
            <li data-testid="weight-details-latest">
              <span className="k">{copy.weight.latest}</span>
              <span className="weight-summary-v">
                {latest ? (
                  <>
                    <span className="weight-summary-main num">{fmtWeight(latest.kg, unit)}</span>
                    <span className={latest.timeApproximate ? 'weight-note' : 'weight-note num'}>
                      <TimesTogether text={fmtWeighInWhen(latest)} />
                    </span>
                  </>
                ) : (
                  <span className="weight-summary-main weight-needs">{asOfDay === null ? copy.weight.latestNoneYet : copy.weight.latestNone}</span>
                )}
              </span>
            </li>
            <li data-testid="weight-details-average">
              <span className="k">{copy.weight.average}</span>
              <span className="weight-summary-v">
                <span className={avg.ok ? 'weight-summary-main num' : 'weight-summary-main weight-needs'}>{avg.ok ? avg.value : <TimesTogether text={avg.value} />}</span>
                {avg.note && <span className="weight-note">{avg.note}</span>}
              </span>
            </li>
            <li data-testid="weight-details-trend">
              <span className="k">{copy.weight.trend}</span>
              <span className="weight-summary-v">
                <span className={rate.ok ? 'weight-summary-main num' : 'weight-summary-main weight-needs'}>{rate.value}</span>
                <span className="weight-note">{rate.note}</span>
              </span>
            </li>
          </ul>

          {/* General guidance from the PRD, not measured from this log: tagged as an assumption. */}
          <p className="weight-swings">
            <span data-testid="weight-swings">{copy.weight.swings}</span>{' '}
            <span className="basis-tag" data-testid="weight-swings-basis">
              {copy.basis.assumption}
            </span>
          </p>

          <details className="more" data-testid="weight-how">
            <summary>{copy.weight.howTitle}</summary>
            <div className="more-body">
              <p className="small">{asOfDay === null ? copy.weight.averageMethod : copy.weight.averageMethodThen}</p>
              <p className="small">{asOfDay === null ? copy.weight.trendMethod : copy.weight.trendMethodThen}</p>
              <p className="small">{copy.weight.notPrediction}</p>
            </div>
          </details>
        </>
      )}

      <fieldset className="field source-field unit-field weight-unit-pref">
        <legend>{copy.weight.showIn}</legend>
        <div className="source-options unit-options">
          {UNITS.map((u) => (
            <label key={u} className={unit === u ? 'source-option checked' : 'source-option'}>
              <input
                type="radio"
                name={`${id}-show`}
                value={u}
                checked={unit === u}
                onChange={() => onUnit(u)}
                data-testid={`weight-show-${u}`}
              />
              <span className="source-label">{copy.weight.unitName[u]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {all.length > 0 && (
        <figure className="weight-chart" data-testid="weight-chart">
          <figcaption>
            <span className="section-title" data-testid="weight-chart-title">
              {weight.chartTitle}
            </span>
            <span className="field-hint weight-chart-caption" data-testid="weight-chart-caption">
              {chart ? (chart.lineCountsEarlier ? `${copy.weight.chartCaption} ${copy.weight.chartCaptionEarlier}` : copy.weight.chartCaption) : copy.weight.chartNeedsTwo}
            </span>
          </figcaption>
          <div ref={chartRef} className="weight-chart-box">
            {chart && (
              <svg
                className="weight-chart-svg"
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                aria-hidden="true"
                focusable="false"
                data-testid="weight-chart-svg"
              >
                <line className="chart-grid" x1={chart.plot.left} x2={chart.plot.right} y1={chart.plot.top} y2={chart.plot.top} />
                <line className="chart-grid" x1={chart.plot.left} x2={chart.plot.right} y1={chart.plot.bottom} y2={chart.plot.bottom} />
                <text className="chart-label" x={chart.plot.left - 6} y={chart.plot.top + 4} textAnchor="end">
                  {chart.yTop}
                </text>
                <text className="chart-label" x={chart.plot.left - 6} y={chart.plot.bottom + 4} textAnchor="end">
                  {chart.yBottom}
                </text>
                <text className="chart-label" x={chart.plot.left} y={chart.height - 6} textAnchor="start">
                  {chart.xStart}
                </text>
                <text className="chart-label" x={chart.plot.right} y={chart.height - 6} textAnchor="end">
                  {chart.xEnd}
                </text>
                {chart.line.includes(' ') && <polyline className="chart-average" points={chart.line} data-testid="weight-chart-line" />}
                {chart.points.map((p) => (
                  <circle key={p.id} className="chart-point" cx={p.x} cy={p.y} r={3.5} data-testid="weight-chart-point" />
                ))}
              </svg>
            )}
          </div>
        </figure>
      )}

      {all.length > 0 && (
        <section aria-labelledby={`${id}-list`}>
          <h3 className="section-title" id={`${id}-list`}>
            {copy.weight.listTitle}
          </h3>
          {anyLater && (
            <p className="field-hint" data-testid="weigh-in-list-later">
              {copy.weight.listLaterNote}
            </p>
          )}
          <ul className="weigh-in-list" data-testid="weigh-in-list" ref={listRef}>
            {all.map((w) => {
              const when = fmtWeighInWhen(w)
              const value = fmtWeight(w.kg, unit)
              const later = isLater(w.at)
              return (
                <li key={w.id} className="weigh-in-row" data-testid="weigh-in-row">
                  <button type="button" className="weigh-in-open" onClick={() => onEdit(w.id)} data-weigh-in-id={w.id}>
                    {/* "time not recorded" is words: no number style for it (as on the dashboard). */}
                    <span className={w.timeApproximate ? 'weigh-in-when' : 'weigh-in-when num'}>
                      <TimesTogether text={when} />
                    </span>
                    <span className="weigh-in-value num">{value}</span>
                    {later && (
                      <span className="weigh-in-later" data-testid="weigh-in-later">
                        {copy.weight.laterThanDay}
                      </span>
                    )}
                    {(w.bodyFatPct !== undefined || w.note) && (
                      <span className="weigh-in-extra">
                        {[w.bodyFatPct !== undefined ? copy.weight.bodyFat(String(w.bodyFatPct)) : null, w.note ?? null]
                          .filter((x): x is string => x !== null)
                          .join(copy.sep)}
                      </span>
                    )}
                    <span className="visually-hidden">{copy.weight.rowHidden}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </Sheet>
  )
}
