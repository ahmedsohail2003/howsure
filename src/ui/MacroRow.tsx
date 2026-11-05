// spec.md > Screens > MacroRow: known totals, how many entries miss a macro, or "unknown"
// when a day with meals has no values for it. Blank is never 0. A target set in the targets
// editor (build-out item 1.3) shows under its macro; no target, no line.
//
// Build-out item 1.5.2b, Panel look: each macro is a small tile with a mini ring. The ring is
// filled only when that macro has a target and every meal has a value for it (with an entry
// missing, the known total is only part of the day); the others say "no target", or show the
// missing count or "unknown" as in Journal.

import type { MacroKey, MacroTotal } from '../kernel/types'
import type { Profile } from '../store/log'
import { copy } from './copy'
import { fmtAmount, fmtInt } from './format'
import { useLook } from './lookContext'
import { Ring } from './Ring'
import { ringFill } from './targetRing'

const ORDER: readonly MacroKey[] = ['protein', 'carbs', 'fat']

interface MacroRowProps {
  macros: Record<MacroKey, MacroTotal>
  targets?: Profile['targets']
}

export function MacroRow({ macros, targets }: MacroRowProps) {
  const { look } = useLook()
  if (look === 'panel') return <PanelMacros macros={macros} targets={targets} />
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

function PanelMacros({ macros, targets }: MacroRowProps) {
  return (
    <section
      className="macro-row panel-macros"
      data-testid="macro-row"
      aria-label={`${copy.macros.protein}, ${copy.macros.carbs}, ${copy.macros.fat}`}
    >
      {ORDER.map((k) => {
        const t = macros[k]
        const target = targets?.[k]
        const ring = !t.allUnknown && t.missing === 0 ? ringFill(t.known, target) : null
        return (
          <div key={k} className="macro-tile" data-testid={`macro-${k}`} data-fill={ring ? String(ring.fill) : 'none'}>
            <Ring size={54} stroke={6} fill={ring ? ring.fill : null} />
            {t.allUnknown ? (
              <p className="macro-value macro-note">{copy.macros.unknown}</p>
            ) : (
              <p className="macro-value num">{copy.units.gramsValue(fmtInt(t.known))}</p>
            )}
            <p className="macro-name">{copy.macros[k]}</p>
            {!t.allUnknown && t.missing > 0 && <p className="macro-note">{copy.macros.missing(t.missing)}</p>}
            {target !== undefined ? (
              <p className="macro-target num" data-testid={`macro-${k}-target`}>
                {copy.targets.macro(fmtAmount(target))}
              </p>
            ) : (
              <p className="macro-target" data-testid={`macro-${k}-no-target`}>
                {copy.panel.macroNoTarget}
              </p>
            )}
          </div>
        )
      })}
    </section>
  )
}
