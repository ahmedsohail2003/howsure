// One source's typical error and its basis: a re-checked study (author, year, DOI,
// finding, re-check date) or the word "assumption" with its nearest study as context.
// Study wording comes from src/kernel/sources.ts; HowSure's own words from copy.ts.

import type { MealSourceId, Source } from '../kernel/types'
import { getSource, SOURCES } from '../kernel/sources'
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

/** The distinct sources used by a set of meals, in the sources table's order. */
export function sourcesUsed(ids: MealSourceId[]): Source[] {
  const order = Object.keys(SOURCES)
  return [...new Set(ids)].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((id) => getSource(id))
}

export function SourceBasisList({ ids }: { ids: MealSourceId[] }) {
  return (
    <ul className="source-basis">
      {sourcesUsed(ids).map((s) => (
        <SourceBasisItem key={s.id} source={s} />
      ))}
    </ul>
  )
}
