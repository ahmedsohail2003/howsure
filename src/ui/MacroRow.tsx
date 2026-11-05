// spec.md > Screens > MacroRow: known totals, how many entries miss a macro, or "unknown"
// when a day with meals has no values for it. Blank is never 0. A target set in the targets
// editor (build-out item 1.3) shows under its macro; no target, no line.

import type { MacroKey, MacroTotal } from '../kernel/types'
import type { Profile } from '../store/log'
import { copy } from './copy'
import { fmtAmount, fmtInt } from './format'

const ORDER: readonly MacroKey[] = ['protein', 'carbs', 'fat']

interface MacroRowProps {
  macros: Record<MacroKey, MacroTotal>
  targets?: Profile['targets']
}

export function MacroRow({ macros, targets }: MacroRowProps) {
  return (
    <section className="macro-row" data-testid="macro-row" aria-label={`${copy.macros.protein}, ${copy.macros.carbs}, ${copy.macros.fat}`}>
      {ORDER.map((k) => {
        const t = macros[k]
        const target = targets?.[k]
        return (
          <div key={k} data-testid={`macro-${k}`}>
            <p className="macro-name">{copy.macros[k]}</p>
            {t.allUnknown ? (
              <p className="macro-value macro-note">{copy.macros.unknown}</p>
            ) : (
              <p className="macro-value num">{copy.units.gramsValue(fmtInt(t.known))}</p>
            )}
            {!t.allUnknown && t.missing > 0 && <p className="macro-note">{copy.macros.missing(t.missing)}</p>}
            {target !== undefined && (
              <p className="macro-target num" data-testid={`macro-${k}-target`}>
                {copy.targets.macro(fmtAmount(target))}
              </p>
            )}
          </div>
        )
      })}
    </section>
  )
}
