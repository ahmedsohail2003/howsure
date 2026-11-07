// spec.md > Screens > MacroRow: known totals, how many entries miss a macro, or "unknown"
// when a day with meals has no values for it. Blank is never 0. A target set in the targets
// editor (build-out item 1.3) shows under its macro; no target, no line.
//
// Build-out item 1.5.2b, Panel look: each macro is a small tile with a mini ring. The ring is
// filled only when that macro has a target and every meal has a value for it (with an entry
// missing, the known total is only part of the day); the others say "no target", or show the
// missing count or "unknown" as in Journal.
//
// Build-out item 1.5.2c, Night look: one chip under the headline ("P 124 · C 272 · F 74 g", with
// "entries missing" when an entry has no value for a macro). The chip opens Journal's row of three
// macros below it, with each target and missing count, so nothing is left out.
//
// Build-out item 2.9: each macro (Journal's column, Panel's tile, each macro under Night's chip)
// is a button that opens that macro's detail (MacroDetails.tsx): its meals, how a meal with no value
// is handled, and its target. Its accessible name gives the value and says what it opens.

import { useId, useState } from 'react'
import type { MacroKey, MacroTotal } from '../kernel/types'
import type { Profile } from '../store/log'
import { copy } from './copy'
import { fmtAmount, fmtInt } from './format'
import { useLook } from './lookContext'
import { macroOpenLabel } from './macroView'
import { Ring } from './Ring'
import { ringFill } from './targetRing'

const ORDER: readonly MacroKey[] = ['protein', 'carbs', 'fat']

interface MacroRowProps {
  macros: Record<MacroKey, MacroTotal>
  targets?: Profile['targets']
  /** Opens one macro's detail (build-out item 2.9). */
  onOpenMacro: (key: MacroKey) => void
}

export function MacroRow({ macros, targets, onOpenMacro }: MacroRowProps) {
  const { look } = useLook()
  if (look === 'panel') return <PanelMacros macros={macros} targets={targets} onOpenMacro={onOpenMacro} />
  return <MacroGrid macros={macros} targets={targets} onOpenMacro={onOpenMacro} />
}

/** Journal's row of three macros, also shown when the Night macro chip is opened. Each opens its detail. */
function MacroGrid({ macros, targets, onOpenMacro }: MacroRowProps) {
  return (
    <section className="macro-row" data-testid="macro-row" aria-label={`${copy.macros.protein}, ${copy.macros.carbs}, ${copy.macros.fat}`}>
      {ORDER.map((k) => {
        const t = macros[k]
        const target = targets?.[k]
        return (
          <button
            key={k}
            type="button"
            className="macro-open"
            onClick={() => onOpenMacro(k)}
            aria-label={macroOpenLabel(k, t)}
            data-testid={`macro-${k}`}
            data-opens="macro-details"
          >
            <span className="macro-name">{copy.macros[k]}</span>
            {t.allUnknown ? (
              <span className="macro-value macro-note">{copy.macros.unknown}</span>
            ) : (
              <span className="macro-value num">{copy.units.gramsValue(fmtInt(t.known))}</span>
            )}
            {!t.allUnknown && t.missing > 0 && <span className="macro-note">{copy.macros.missing(t.missing)}</span>}
            {target !== undefined && (
              <span className="macro-target num" data-testid={`macro-${k}-target`}>
                {copy.targets.macro(fmtAmount(target))}
              </span>
            )}
          </button>
        )
      })}
    </section>
  )
}

function PanelMacros({ macros, targets, onOpenMacro }: MacroRowProps) {
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
          <button
            key={k}
            type="button"
            className="macro-open macro-tile"
            onClick={() => onOpenMacro(k)}
            aria-label={macroOpenLabel(k, t)}
            data-testid={`macro-${k}`}
            data-fill={ring ? String(ring.fill) : 'none'}
            data-opens="macro-details"
          >
            <Ring size={54} stroke={6} fill={ring ? ring.fill : null} />
            {t.allUnknown ? (
              <span className="macro-value macro-note">{copy.macros.unknown}</span>
            ) : (
              <span className="macro-value num">{copy.units.gramsValue(fmtInt(t.known))}</span>
            )}
            <span className="macro-name">{copy.macros[k]}</span>
            {!t.allUnknown && t.missing > 0 && <span className="macro-note">{copy.macros.missing(t.missing)}</span>}
            {target !== undefined ? (
              <span className="macro-target num" data-testid={`macro-${k}-target`}>
                {copy.targets.macro(fmtAmount(target))}
              </span>
            ) : (
              <span className="macro-target" data-testid={`macro-${k}-no-target`}>
                {copy.panel.macroNoTarget}
              </span>
            )}
          </button>
        )
      })}
    </section>
  )
}

/** The Night look's macro chip and, once opened, the row of three macros under the chips. */
export function NightMacros({ macros, targets, onOpenMacro }: MacroRowProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const allUnknown = ORDER.every((k) => macros[k].allUnknown)
  const anyMissing = ORDER.some((k) => !macros[k].allUnknown && macros[k].missing > 0)
  const value = (k: MacroKey) => (macros[k].allUnknown ? copy.macros.unknown : fmtInt(macros[k].known))
  const parts = ORDER.map((k) => copy.night.macroPart(copy.night.macroLetters[k], value(k))).join(copy.sep)
  const spoken = ORDER.map((k) =>
    copy.night.macroPart(copy.macros[k], macros[k].allUnknown ? copy.macros.unknown : copy.units.gramsValue(value(k))),
  ).join(', ')
  const shown = allUnknown ? parts : copy.night.macroChip(parts)
  return (
    <>
      <button
        type="button"
        className="btn night-chip macro-chip num"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        data-opens="expand"
        aria-label={copy.night.macroChipLabel(anyMissing ? `${shown}${copy.sep}${copy.night.macrosMissing}` : shown, spoken)}
        data-testid="macro-chip"
      >
        {/* One span, so the button's flex layout keeps the space before "·". */}
        <span>
          {shown}
          {anyMissing && (
            <span className="chip-note">
              {copy.sep}
              {copy.night.macrosMissing}
            </span>
          )}
        </span>
      </button>
      <div className="night-macros" id={id} hidden={!open} data-testid="night-macros">
        {open && <MacroGrid macros={macros} targets={targets} onOpenMacro={onOpenMacro} />}
      </div>
    </>
  )
}
