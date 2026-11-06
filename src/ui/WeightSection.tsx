// Build-out item 2.4 (prd.md > Weight Log, checklist slice 20): the dashboard's weight. The viewed
// day's weigh-in (or "No weigh-in today"), the 7-day average with how many weigh-ins it holds, and
// the trend over 21 days (or how many more weigh-ins it needs). The whole summary is one button
// that opens the weight details, so every number is one tap from its detail; Log weight opens the
// sheet. The numbers come from weightView.ts; each look draws this same markup its own way
// (theme.css: a plain section in Journal, a tile in Panel, a dark block in Night).

import { copy } from './copy'
import { TimesTogether } from './KeepTogether'
import { fmtTime } from './format'
import { averageText, fmtWeight, trendParts, type WeightView } from './weightView'

interface WeightSectionProps {
  weight: WeightView
  /** True on the current waking day ("No weigh-in today"); false on an earlier day. */
  today: boolean
  onOpen: () => void
  onLog: () => void
}

export function WeightSection({ weight, today, onOpen, onLog }: WeightSectionProps) {
  const { unit, latest, day, average, trend } = weight
  const avg = averageText(average, unit, weight.asOfDay === null, weight.ranOnTo)
  const rate = trendParts(trend, unit)
  const more = day.length - 1
  return (
    <section className="section weight-section" aria-labelledby="weight-title" data-testid="weight-section">
      <div className="weight-head">
        <h2 className="section-title" id="weight-title">
          {copy.weight.title}
        </h2>
        <button type="button" className="btn weight-log" onClick={onLog} data-testid="log-weight">
          {copy.weight.logWeight}
        </button>
      </div>
      {weight.all.length === 0 ? (
        <p className="weight-empty" data-testid="weight-day">
          {copy.weight.noWeighInsYet}
        </p>
      ) : (
        <button type="button" className="weight-open" onClick={onOpen} data-testid="weight-open">
          <span className="weight-day">
            {latest ? (
              <>
                <span className="weight-figure num" data-testid="weight-day">
                  {fmtWeight(latest.kg, unit)}
                </span>{' '}
                {/* A time is a number; "(time not recorded)" is words, set apart from the weight. */}
                <span className={latest.timeApproximate ? 'weight-when' : 'weight-when num'} data-testid="weight-when">
                  {latest.timeApproximate ? copy.weight.approxTimeAfter : copy.weight.at(fmtTime(latest.at))}
                </span>
                {more > 0 && (
                  <span className="weight-more" data-testid="weight-more">
                    {copy.weight.moreThisDay(more)}
                  </span>
                )}
              </>
            ) : (
              <span className="weight-none" data-testid="weight-day">
                {today ? copy.weight.noWeighInToday : copy.weight.noWeighInThatDay}
              </span>
            )}
          </span>
          <span className="weight-facts">
            <span className={avg.ok ? 'weight-fact' : 'weight-fact is-status'} data-testid="weight-average">
              <span className="k">{copy.weight.average}</span>{' '}
              <span className="weight-fact-v">
                <span className={avg.ok ? 'v num' : 'v weight-needs'} data-testid="weight-average-value">
                  {avg.ok ? avg.value : <TimesTogether text={avg.value} />}
                </span>
                {avg.note && (
                  <>
                    {' '}
                    <span className="weight-note" data-testid="weight-average-count">
                      {avg.note}
                    </span>
                  </>
                )}
              </span>
            </span>
            <span className={rate.ok ? 'weight-fact' : 'weight-fact is-status'} data-testid="weight-trend">
              <span className="k">{copy.weight.trend}</span>{' '}
              <span className="weight-fact-v">
                <span className={rate.ok ? 'v num' : 'v weight-needs'} data-testid="weight-rate">
                  {rate.value}
                </span>{' '}
                <span className="weight-note">{rate.note}</span>
              </span>
            </span>
          </span>
          <span className="visually-hidden">{copy.weight.openHidden}</span>
        </button>
      )}
    </section>
  )
}
