// spec.md > Screens > ExplainSheet.tsx and prd.md > Estimate Score and Explanations:
// meal score, day score and ranges, each short, with the calculation and the sources
// under More detail. Net mode (build-out item 2.5a, slice 10; spec.md > Maths Core: Net
// Calories) shows net's ranges, eaten's range, burned's range and how they combine, with the
// resting-burn note. Net has no score. Balance mode (build-out item 2.5b) explains the estimated
// deficit or surplus: the equation, its inputs, the activity factor, the hours counted, how the
// spreads combine, what is not counted, and where each number comes from.

import { estimateMeal, improve, isKnownMeal } from '../kernel/estimate'
import { RESTING_BASIS, RESTING_TYPICAL_ERROR } from '../kernel/energy'
import { isKnownWorkout } from '../kernel/net'
import { getSource } from '../kernel/sources'
import type { Meal, SourceId } from '../kernel/types'
import type { BalanceView } from './balanceView'
import { heightText, weightText } from './body'
import { copy } from './copy'
import type { DayView } from './dayView'
import { fmtInt, fmtPct, fmtRange, fmtSharePct, fmtSigned, fmtSignedPlus, fmtSignedRange, fmtWeekdayTime } from './format'
import { mealSourceLabel, mealTimeLabel } from './MealList'
import { Sheet } from './Sheet'
import { BasisTag, SourceBasisItem, SourceBasisList, sourcesUsed } from './SourceBasis'

export type ExplainMode = { mode: 'meal'; mealId: string } | { mode: 'day' } | { mode: 'ranges' } | { mode: 'net' } | { mode: 'balance' }

interface ExplainSheetProps {
  mode: ExplainMode
  view: DayView
  demo: boolean
  onClose: () => void
  /** The estimated deficit or surplus (balance mode). */
  balance?: BalanceView
}

export function ExplainSheet({ mode, view, demo, onClose, balance }: ExplainSheetProps) {
  if (mode.mode === 'balance') {
    if (!balance || balance.kind !== 'shown') return null
    return (
      <Sheet title={copy.explainBalance.title} demo={demo} onClose={onClose} testId="explain-balance">
        <BalanceExplanation balance={balance} />
      </Sheet>
    )
  }
  if (mode.mode === 'meal') {
    const meal = view.meals.find((m) => m.id === mode.mealId)
    if (!meal) return null
    return (
      <Sheet
        title={copy.explainMeal.title(meal.name)}
        sub={copy.explainMeal.sub(mealSourceLabel(meal.source), mealTimeLabel(meal, view.dayStart))}
        demo={demo}
        onClose={onClose}
        testId="explain-meal"
      >
        <MealExplanation meal={meal} view={view} />
      </Sheet>
    )
  }
  if (mode.mode === 'day') {
    return (
      <Sheet
        title={copy.explainDay.title}
        sub={view.day.knownTotal > 0 ? copy.explainDay.sub(fmtInt(view.day.knownTotal)) : undefined}
        demo={demo}
        onClose={onClose}
        testId="explain-day"
      >
        <DayExplanation view={view} />
      </Sheet>
    )
  }
  if (mode.mode === 'net') {
    return (
      <Sheet title={copy.explainNet.title} demo={demo} onClose={onClose} testId="explain-net">
        <NetExplanation view={view} />
        {balance?.kind === 'shown' && (
          <p className="small" data-testid="net-balance-pointer">
            {copy.explainNet.balancePointer}
          </p>
        )}
      </Sheet>
    )
  }
  return (
    <Sheet title={copy.explainRanges.title} demo={demo} onClose={onClose} testId="explain-ranges">
      <RangesExplanation view={view} />
    </Sheet>
  )
}

/* ---------------- net ---------------- */

function NetExplanation({ view }: { view: DayView }) {
  const { net, day, burned, eatenSd } = view
  const sourceIds: SourceId[] = [
    ...view.meals.filter(isKnownMeal).map((m) => m.source),
    ...view.workouts.filter(isKnownWorkout).map((w) => w.source),
  ]
  return (
    <>
      <p data-testid="net-intro">{copy.explainNet.intro}</p>
      {net ? (
        <ul className="fact-list num" data-testid="net-facts">
          <li data-testid="explain-net-total">
            <span className="k">{copy.explainNet.net}</span>
            <span>{copy.explainNet.total(fmtSigned(net.total))}</span>
          </li>
          <li data-testid="explain-net-likely">
            <span className="k">{copy.headline.likely}</span>
            <span>{fmtSignedRange(net.likely)}</span>
          </li>
          <li data-testid="explain-net-very-likely">
            <span className="k">{copy.headline.veryLikely}</span>
            <span>{fmtSignedRange(net.veryLikely)}</span>
          </li>
        </ul>
      ) : (
        <p data-testid="net-not-available">{copy.explainNet.notAvailable}</p>
      )}

      <ul className="fact-list num" data-testid="net-sides">
        <li data-testid="explain-net-eaten">
          <span className="k">{copy.explainNet.eaten}</span>
          <span>
            {day.status === 'complete' || day.status === 'partial' ? copy.explainNet.total(fmtInt(day.knownTotal)) : copy.net.notAvailable}
            {day.likely && (
              <>
                {copy.sep}
                {copy.explainNet.likelyOf(fmtRange(day.likely))}
              </>
            )}
          </span>
        </li>
        <li data-testid="explain-net-burned">
          <span className="k">{copy.explainNet.burned}</span>
          <span>
            {burned.status === 'complete' || burned.status === 'partial' ? copy.explainNet.total(fmtInt(burned.knownTotal)) : copy.net.unknown}
            {burned.likely && (
              <>
                {copy.sep}
                {copy.explainNet.likelyOf(fmtRange(burned.likely))}
              </>
            )}
          </span>
        </li>
      </ul>

      {net && (
        <p className="num" data-testid="net-combine">
          {copy.explainNet.combine(fmtInt(eatenSd), fmtInt(burned.sd), fmtInt(net.sd))}
        </p>
      )}
      {net?.knownOnly && <p className="small">{copy.explainNet.knownOnly}</p>}
      <p className="callout amber" data-testid="net-note">
        {copy.net.note}
      </p>
      <p data-testid="net-no-score">{copy.explainNet.noScore}</p>

      <details className="more">
        <summary>{copy.sheet.moreDetail}</summary>
        <div className="more-body">
          {net && (
            <>
              <p>{copy.explainNet.ranges}</p>
              <div>
                <h3>{copy.explainNet.howTitle}</h3>
                <p className="num">{copy.explainNet.how(fmtInt(net.sd))}</p>
              </div>
            </>
          )}
          {sourcesUsed(sourceIds).some((src) => src.basis.kind === 'assumption') && (
            <p className="small">{copy.explainRanges.calcFromAssumption}</p>
          )}
          {sourceIds.length > 0 && (
            <div>
              <h3>{copy.more.sourcesTitle}</h3>
              <SourceBasisList ids={sourceIds} />
            </div>
          )}
          {net && <p className="small">{copy.explainNet.designTargets}</p>}
        </div>
      </details>
    </>
  )
}

/* ---------------- estimated deficit or surplus ---------------- */

/** "12 h 10 min" from hours. */
function fmtDuration(hours: number): string {
  const total = Math.round(hours * 60)
  return copy.explainBalance.duration(String(Math.floor(total / 60)), String(total % 60))
}

function BalanceExplanation({ balance }: { balance: Extract<BalanceView, { kind: 'shown' }> }) {
  const t = copy.explainBalance
  const { inputs, resting, est } = balance
  const factor = String(inputs.factor)
  const weight = weightText(inputs.weightKg, inputs.weightUnit)
  const sexTerm =
    resting.sexConstant < 0 ? `${copy.headline.minus} ${fmtInt(-resting.sexConstant)}` : `+ ${fmtInt(resting.sexConstant)}`
  return (
    <>
      <p className="big-figure num" data-testid="explain-balance-total">
        {balance.text}
      </p>
      <p data-testid="balance-intro">{t.intro}</p>
      <ul className="fact-list num" data-testid="balance-ranges">
        <li data-testid="explain-balance-likely">
          <span className="k">{copy.headline.likely}</span>
          <span>{balance.likelyRange}</span>
        </li>
        <li data-testid="explain-balance-very-likely">
          <span className="k">{copy.headline.veryLikely}</span>
          <span>{balance.veryLikelyRange}</span>
        </li>
      </ul>

      <ul className="fact-list num" data-testid="balance-sum">
        <li data-testid="explain-balance-eaten">
          <span className="k">{balance.knownOnly ? t.eatenKnownOnly : t.eaten}</span>
          <span>{t.kcal(fmtInt(balance.eaten))}</span>
        </li>
        <li data-testid="explain-balance-resting">
          <span className="k">{t.resting}</span>
          <span>{t.restingValue(fmtInt(resting.kcal))}</span>
        </li>
        <li data-testid="explain-balance-activity">
          <span className="k">{t.activity}</span>
          <span>{t.activityValue(copy.body.activityOptions[inputs.activity], factor, inputs.activityDefault)}</span>
        </li>
        <li data-testid="explain-balance-hours">
          <span className="k">{t.hours}</span>
          <span>{t.hoursValue(fmtDuration(inputs.hours), fmtSharePct(est.share))}</span>
        </li>
        <li data-testid="explain-balance-everyday">
          <span className="k">{t.everyday}</span>
          <span>{t.kcal(fmtInt(est.everyday))}</span>
        </li>
        <li data-testid="explain-balance-workouts">
          <span className="k">{balance.knownOnly ? t.workoutsKnownOnly : t.workouts}</span>
          <span>{t.kcal(fmtInt(balance.workouts))}</span>
        </li>
        <li data-testid="explain-balance-burn">
          <span className="k">{t.burn}</span>
          <span>{t.kcal(fmtInt(est.burn))}</span>
        </li>
        <li data-testid="explain-balance-sum">
          <span className="k">{t.balance}</span>
          <span>{t.kcal(fmtSignedPlus(est.balance))}</span>
        </li>
      </ul>
      <p className="small" data-testid="balance-time">
        {inputs.soFar ? t.soFar(fmtWeekdayTime(inputs.from)) : t.wholeDay(fmtWeekdayTime(inputs.from), fmtWeekdayTime(inputs.to))}
      </p>
      <p className="small">{t.once}</p>
      {balance.knownOnly && <p className="small">{t.knownOnly}</p>}

      <div>
        <h3 className="section-title">{t.inputsTitle}</h3>
        <ul className="fact-list num" data-testid="balance-inputs">
          <li>
            <span className="k">{t.age}</span>
            <span>{t.ageValue(String(inputs.age))}</span>
          </li>
          <li>
            <span className="k">{t.sex}</span>
            <span>{t.sexNames[inputs.sex]}</span>
          </li>
          <li>
            <span className="k">{t.height}</span>
            <span>{heightText(inputs.heightCm, inputs.heightUnit)}</span>
          </li>
          <li data-testid="balance-weight">
            <span className="k">{t.weight}</span>
            <span>
              {inputs.weightFrom.from === 'weighIn'
                ? t.weightFromWeighIn(weight, inputs.weightFrom.when)
                : t.weightFromProfile(weight)}
            </span>
          </li>
        </ul>
      </div>

      <div className="balance-equation-block" data-testid="balance-equation-block">
        <h3 className="section-title">{t.equationTitle}</h3>
        <p className="num" data-testid="balance-equation">
          {t.equation(fmtNum(inputs.weightKg), fmtNum(inputs.heightCm), String(inputs.age), sexTerm)}
          {t.equationResult(fmtInt(resting.kcal))}
        </p>
        {inputs.sex === 'unspecified' && (
          <p className="small" data-testid="balance-unspecified">
            {t.unspecified(fmtInt(resting.sexSd))}
          </p>
        )}
        <p className="num small" data-testid="balance-everyday-line">{t.everydayLine(fmtInt(resting.kcal), factor, fmtShare(est.share), fmtInt(est.everyday))}</p>
      </div>

      <div className="callout amber" data-testid="balance-not-counted">
        <h3 className="section-title">{t.notCountedTitle}</h3>
        <ul className="plain-list">
          {t.notCounted.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>{t.notMeasured}</p>
      </div>

      <details className="more">
        <summary>{copy.sheet.moreDetail}</summary>
        <div className="more-body">
          <p className="num" data-testid="balance-combine">
            {t.combine(fmtInt(balance.eatenSd), fmtInt(balance.workoutsSd), fmtInt(est.everydaySd), fmtInt(est.sd))}
          </p>
          <p className="small">{t.restError(fmtPct(RESTING_TYPICAL_ERROR))}</p>
          <div>
            <h3>{t.howTitle}</h3>
            <p className="num">{t.how(fmtInt(est.sd))}</p>
          </div>
          <p className="small">{t.rangesNote}</p>
          <div>
            <h3>{t.sourcesTitle}</h3>
            <ul className="source-basis">
              <li data-testid="balance-source">
                <p>
                  <strong className="num">{t.equationSource(fmtPct(RESTING_TYPICAL_ERROR))}</strong>{' '}
                  <span className="basis-tag" data-testid="basis-tag">
                    {copy.basis.assumption}
                  </span>
                </p>
                <p className="context">{copy.basis.nearestStudy(RESTING_BASIS.context)}</p>
                <p className="context" data-testid="basis-cite">
                  {[RESTING_BASIS.cite, copy.basis.doi(RESTING_BASIS.doi as string), copy.basis.checkedOn(RESTING_BASIS.checked as string)].join(copy.sep)}
                </p>
              </li>
              <li>
                <p>
                  <strong>{copy.body.activity}</strong>{' '}
                  <span className="basis-tag">{copy.basis.assumption}</span>
                </p>
                <p className="context">{t.factorsSource}</p>
              </li>
            </ul>
          </div>
        </div>
      </details>
    </>
  )
}

// Up to two decimals: the stored values have at most that many that matter (172.72 cm from
// 5 ft 8 in, 63.957 kg from 141 lb shows 63.96), so redoing the sum gives the same whole kcal.
const twoDecimals = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false })
/** 64 -> "64", 172.72 -> "172.72", 63.957 -> "63.96". */
function fmtNum(n: number): string {
  return twoDecimals.format(n)
}
/**
 * A share of a day to four decimals: 0.99306 -> "0.9931". Two decimals were too coarse to redo
 * the everyday-burn sum (1,442 × 1.2 × 0.99 is 1,713, not the 1,718 shown); at four the share's
 * own rounding moves the sum by well under 1 kcal.
 */
function fmtShare(share: number): string {
  return share.toFixed(4)
}

/* ---------------- meal score ---------------- */

function MealExplanation({ meal, view }: { meal: Meal; view: DayView }) {
  const est = estimateMeal(meal)
  if (!est || !isKnownMeal(meal)) return <p>{copy.explainMeal.unknownKcal}</p>
  const source = getSource(meal.source)

  const imp = improve(view.meals, meal.id)
  const score = String(est.score)
  const errPct = fmtPct(est.e)

  return (
    <>
      <p className="big-figure num" data-testid="explain-score">
        {copy.headline.estimateScore(score)}
      </p>
      <p className="num">
        {copy.basis.sourceLine(source.label, errPct)} <BasisTag source={source} />
      </p>
      <p data-testid="meal-score-sentence">{copy.explainMeal.sentence(score, errPct)}</p>

      <ul className="fact-list num">
        <li>
          <span className="k">{copy.explainMeal.detailCalories}</span>
          <span>{copy.units.kcalValue(fmtInt(meal.kcal))}</span>
        </li>
        <li>
          <span className="k">{copy.headline.likely}</span>
          <span>{fmtRange(est.likely)}</span>
        </li>
        <li>
          <span className="k">{copy.headline.veryLikely}</span>
          <span>{fmtRange(est.veryLikely)}</span>
        </li>
      </ul>

      <div className="callout">
        <h3 className="section-title">{copy.explainMeal.improveTitle}</h3>
        <p>
          {imp
            ? copy.explainMeal.improveLine(getSource(imp.to).label, errPct, fmtPct(imp.newMealE))
            : copy.explainMeal.noBetter}
        </p>
      </div>

      <details className="more">
        <summary>{copy.sheet.moreDetail}</summary>
        <div className="more-body">
          <ul className="fact-list num">
            <li>
              <span className="k">{copy.explainMeal.detailCalories}</span>
              <span>{copy.units.kcalValue(fmtInt(meal.kcal))}</span>
            </li>
            <li>
              <span className="k">{copy.explainMeal.detailSource}</span>
              <span>{source.label}</span>
            </li>
            <li>
              <span className="k">{copy.explainMeal.detailTypicalError}</span>
              <span>{copy.units.percent(errPct)}</span>
            </li>
            <li>
              <span className="k">{copy.explainMeal.detailSpread}</span>
              <span>{copy.units.plusMinusKcal(fmtInt(est.sd))}</span>
            </li>
            <li>
              <span className="k">{copy.explainMeal.detailScore}</span>
              <span>{score}</span>
            </li>
          </ul>
          <h3>{copy.explainMeal.basisLabel}</h3>
          <ul className="source-basis">
            <SourceBasisItem source={source} />
          </ul>
          <p className="small">{copy.more.designTargets}</p>
        </div>
      </details>
    </>
  )
}

/* ---------------- day score ---------------- */

function DayExplanation({ view }: { view: DayView }) {
  const { day, meals, biggest, improvement } = view
  if (day.score === null || day.e === null) return <p>{copy.explainDay.notAvailable}</p>

  const byId = new Map(meals.map((m) => [m.id, m]))
  const known = meals.filter(isKnownMeal)
  const knownOnly = day.status === 'partial'
  const dayPct = fmtPct(day.e)

  return (
    <>
      <p className="big-figure num" data-testid="explain-score">
        {copy.headline.estimateScore(String(day.score))}
      </p>
      <p className="num">{copy.explainDay.dayFigure(dayPct, fmtInt(day.knownTotal))}</p>
      <p data-testid="day-score-sentence">{copy.explainDay.sentence}</p>
      {knownOnly && <p className="small">{copy.explainDay.unknownNote(day.unknownMealIds.length)}</p>}

      <div>
        <h3 className="section-title">{copy.explainDay.contributionsTitle}</h3>
        <ol className="contrib-list" data-testid="contributions">
          {day.contributions.map((c) => {
            const m = byId.get(c.mealId)
            if (!m || !isKnownMeal(m)) return null
            const share = fmtSharePct(c.share)
            return (
              <li key={c.mealId} data-testid="contribution" data-meal-id={c.mealId}>
                <div className="contrib-head">
                  <span className="meal-name">{m.name}</span>
                  <span className="num">{copy.explainDay.contributionShare(share)}</span>
                </div>
                <div className="contrib-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(1, Math.round(c.share * 100))}%` }} />
                </div>
                <p className="contrib-meta num">
                  {copy.explainDay.contributionMeta(fmtInt(m.kcal), getSource(m.source).label)}
                </p>
              </li>
            )
          })}
        </ol>
      </div>

      {biggest && (
        <div className="callout amber" data-testid="biggest-contributor">
          <p>
            <strong>
              {knownOnly ? copy.explainDay.biggestKnownOnly(biggest.name) : copy.explainDay.biggest(biggest.name)}
            </strong>
          </p>
          <p>
            {improvement && improvement.newDayScore !== null
              ? copy.explainDay.wouldChange(
                  getSource(improvement.to).label,
                  String(day.score),
                  String(improvement.newDayScore),
                )
              : copy.explainDay.alreadyBest}
          </p>
        </div>
      )}

      <details className="more">
        <summary>{copy.sheet.moreDetail}</summary>
        <div className="more-body">
          <table className="detail-table num" data-testid="day-detail-table">
            <thead>
              <tr>
                <th>{copy.explainDay.tableMeal}</th>
                <th className="r">{copy.explainDay.tableKcal}</th>
                <th>{copy.explainDay.tableSource}</th>
                <th className="r">{copy.explainDay.tableError}</th>
              </tr>
            </thead>
            <tbody>
              {known.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className="r">{fmtInt(m.kcal)}</td>
                  <td>
                    {getSource(m.source).label} <BasisTag source={getSource(m.source)} />
                  </td>
                  <td className="r">{copy.units.percent(fmtPct(estimateMeal(m)?.e ?? getSource(m.source).typicalError))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div>
            <h3>{copy.explainDay.combinedTitle}</h3>
            <p className="small">{copy.explainDay.combinedGroups}</p>
            <ul className="fact-list num">
              {day.groups.map((g) => (
                <li key={g.source}>
                  <span>{copy.explainDay.groupLine(getSource(g.source).label, fmtInt(g.sd))}</span>
                </li>
              ))}
            </ul>
            <p className="num" data-testid="combined-result">
              {copy.explainDay.combinedLine(fmtInt(day.e * day.knownTotal), fmtInt(day.knownTotal), dayPct, String(day.score))}
            </p>
          </div>

          <div>
            <h3>{copy.more.sourcesTitle}</h3>
            <SourceBasisList ids={known.map((m) => m.source)} />
          </div>

          <div>
            <h3>{copy.more.limitTitle}</h3>
            <p data-testid="limit-text">{copy.more.limit}</p>
          </div>
          <p className="small">{copy.more.designTargets}</p>
        </div>
      </details>
    </>
  )
}

/* ---------------- ranges ---------------- */

function RangesExplanation({ view }: { view: DayView }) {
  const { day, meals } = view
  if (!day.likely || !day.veryLikely || day.e === null) return <p>{copy.explainRanges.notAvailable}</p>

  const known = meals.filter(isKnownMeal)
  const used = sourcesUsed(known.map((m) => m.source))
  const studies = used.filter((s) => s.basis.kind === 'study' && s.basis.cite)
  const anyAssumption = used.some((s) => s.basis.kind === 'assumption')

  return (
    <>
      <ul className="fact-list num">
        <li data-testid="explain-likely">
          <span className="k">{copy.headline.likely}</span>
          <span>{fmtRange(day.likely)}</span>
        </li>
        <li data-testid="explain-very-likely">
          <span className="k">{copy.headline.veryLikely}</span>
          <span>{fmtRange(day.veryLikely)}</span>
        </li>
      </ul>
      <p data-testid="range-explanation">{copy.explainRanges.explanation}</p>
      <p>{copy.explainRanges.widerFor}</p>
      <p className="callout" data-testid="planning-line">
        <strong>{copy.explainRanges.planning}</strong>
      </p>
      <p className="callout amber" data-testid="honesty-line">
        {copy.explainRanges.honesty}
      </p>

      <details className="more">
        <summary>{copy.sheet.moreDetail}</summary>
        <div className="more-body">
          <div>
            <h3>{copy.explainRanges.howTitle}</h3>
            <p className="num">{copy.explainRanges.how(fmtPct(day.e, 2))}</p>
          </div>
          {studies.map((s) => (
            <p key={s.id} className="small">
              {copy.explainRanges.calcFromStudy(s.basis.cite as string)}
            </p>
          ))}
          {anyAssumption && <p className="small">{copy.explainRanges.calcFromAssumption}</p>}
          <div>
            <h3>{copy.more.sourcesTitle}</h3>
            <SourceBasisList ids={known.map((m) => m.source)} />
          </div>
          <p className="small">{copy.more.designTargets}</p>
        </div>
      </details>
    </>
  )
}
