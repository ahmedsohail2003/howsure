// One source's typical error and its basis: a re-checked study (author, year, DOI,
// finding, re-check date) or the word "assumption" with its nearest study as context.
// Study wording comes from src/kernel/sources.ts; HowSure's own words from copy.ts.

import { hasOwnError } from '../kernel/estimate'
import type { Meal, Source, SourceId } from '../kernel/types'
import { getSource, SOURCES } from '../kernel/sources'
import { trackerMealInfo } from '../import/trackerBundle'
import { copy } from './copy'
import { fmtPct } from './format'

export function BasisTag({ source }: { source: Source }) {
  const study = source.basis.kind === 'study'
  return (
    <span className={study ? 'basis-tag study' : 'basis-tag'} data-testid="basis-tag">
      {study ? copy.basis.study : copy.basis.assumption}
    </span>
  )
}

/**
 * The basis of one meal's typical error: "from your tracker" when an imported meal carries the
 * tracker's own figure for it (build-out item 2.1b), else its source's basis.
 */
export function MealBasisTag({ meal, source }: { meal: Pick<Meal, 'typicalError' | 'imported'>; source: Source }) {
  if (hasOwnError(meal) && trackerMealInfo(meal)) {
    return (
      <span className="basis-tag tracker" data-testid="basis-tag">
        {copy.trackerImport.fromTracker}
      </span>
    )
  }
  return <BasisTag source={source} />
}

export function SourceBasisItem({ source }: { source: Source }) {
  const b = source.basis
  return (
    <li data-testid="source-basis" data-source-id={source.id}>
      <p>
        <strong>{source.label}</strong>
        {copy.sep}
        <span className="num">{copy.basis.typicalError(fmtPct(source.typicalError))}</span>{' '}
        <BasisTag source={source} />
      </p>
      {b.kind === 'study' ? (
        <>
          <p className="context">
            {[b.cite, b.doi ? copy.basis.doi(b.doi) : null, b.checked ? copy.basis.checkedOn(b.checked) : null]
              .filter(Boolean)
              .join(copy.sep)}
          </p>
          {b.finding && <p className="context">{b.finding}</p>}
        </>
      ) : (
        <>
          {source.context && <p className="context">{copy.basis.nearestStudy(source.context)}</p>}
          {(b.cite || b.doi || b.checked) && (
            <p className="context" data-testid="basis-cite">
              {[b.cite, b.doi ? copy.basis.doi(b.doi) : null, b.checked ? copy.basis.checkedOn(b.checked) : null]
                .filter(Boolean)
                .join(copy.sep)}
            </p>
          )}
        </>
      )}
    </li>
  )
}

/** The distinct sources used by a set of meals (or workouts), in the sources table's order. */
export function sourcesUsed(ids: SourceId[]): Source[] {
  const order = Object.keys(SOURCES)
  return [...new Set(ids)].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((id) => getSource(id))
}

export function SourceBasisList({ ids }: { ids: SourceId[] }) {
  return (
    <ul className="source-basis">
      {sourcesUsed(ids).map((s) => (
        <SourceBasisItem key={s.id} source={s} />
      ))}
    </ul>
  )
}
