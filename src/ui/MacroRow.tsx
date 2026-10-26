// spec.md > Screens > MacroRow: known totals, how many entries miss a macro, or "unknown"
// when a day with meals has no values for it. Blank is never 0.

import type { MacroKey, MacroTotal } from '../kernel/types'
import { copy } from './copy'
import { fmtInt } from './format'

const ORDER: readonly MacroKey[] = ['protein', 'carbs', 'fat']

export function MacroRow({ macros }: { macros: Record<MacroKey, MacroTotal> }) {
  return (
    <section className="macro-row" data-testid="macro-row" aria-label={`${copy.macros.protein}, ${copy.macros.carbs}, ${copy.macros.fat}`}>
      {ORDER.map((k) => {
        const t = macros[k]
        return (
          <div key={k} data-testid={`macro-${k}`}>
            <p className="macro-name">{copy.macros[k]}</p>
            {t.allUnknown ? (
              <p className="macro-value macro-note">{copy.macros.unknown}</p>
            ) : (
              <p className="macro-value num">{copy.units.gramsValue(fmtInt(t.known))}</p>
            )}
            {!t.allUnknown && t.missing > 0 && <p className="macro-note">{copy.macros.missing(t.missing)}</p>}
          </div>
        )
      })}
    </section>
  )
}
