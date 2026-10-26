// spec.md > Screens > ExplainSheet.tsx and prd.md > Estimate Score and Explanations:
// meal score, day score and ranges, each short, with the calculation and the sources
// under More detail. Net mode arrives with workouts (Tier 2).

import { estimateMeal, improve, isKnownMeal } from '../kernel/estimate'
import { getSource } from '../kernel/sources'
import type { Meal } from '../kernel/types'
import { copy } from './copy'
import type { DayView } from './dayView'
import { fmtInt, fmtPct, fmtRange, fmtSharePct } from './format'
import { mealSourceLabel, mealTimeLabel } from './MealList'
import { Sheet } from './Sheet'
import { BasisTag, SourceBasisItem, SourceBasisList, sourcesUsed } from './SourceBasis'

export type ExplainMode = { mode: 'meal'; mealId: string } | { mode: 'day' } | { mode: 'ranges' }

interface ExplainSheetProps {
  mode: ExplainMode
  view: DayView
  demo: boolean
  onClose: () => void
}

export function ExplainSheet({ mode, view, demo, onClose }: ExplainSheetProps) {
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
  return (
    <Sheet title={copy.explainRanges.title} demo={demo} onClose={onClose} testId="explain-ranges">
      <RangesExplanation view={view} />
    </Sheet>
  )
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
