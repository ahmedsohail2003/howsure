// The Look sheet (build-out item 1.5.2), opened from the More menu: one radio group with every
// look this build offers (looks.ts), each with its name, one plain line and a small preview drawn
// in CSS (theme.css > look preview). Choosing a look applies it at once and saves it on this
// device; there is no Save step. Arrow keys move between looks, as in any radio group, and the
// sheet traps focus and closes on Esc like every other sheet.

import { copy } from './copy'
import { useLook } from './lookContext'
import { LOOKS } from './looks'
import { Sheet } from './Sheet'

interface LookSheetProps {
  demo: boolean
  onClose: () => void
}

export function LookSheet({ demo, onClose }: LookSheetProps) {
  const { look, setLook } = useLook()
  return (
    <Sheet title={copy.looks.title} demo={demo} onClose={onClose} testId="look-sheet">
      <p className="small">{copy.looks.intro}</p>
      <fieldset className="look-options">
        <legend className="visually-hidden">{copy.looks.legend}</legend>
        {LOOKS.map((l) => {
          const checked = l.id === look
          return (
            <label key={l.id} className={checked ? 'look-option checked' : 'look-option'} data-testid={`look-${l.id}`}>
              <input
                type="radio"
                name="look"
                value={l.id}
                checked={checked}
                onChange={() => setLook(l.id)}
                aria-labelledby={`look-name-${l.id}`}
                aria-describedby={`look-desc-${l.id}`}
              />
              <span className={`look-preview look-preview-${l.id}`} aria-hidden="true">
                <i className="lp-head" />
                <i className="lp-num" />
                <i className="lp-bar">
                  <i className="lp-band" />
                </i>
                <i className="lp-line" />
                <i className="lp-line" />
                <i className="lp-dock" />
              </span>
              <span className="look-text">
                <span className="look-name" id={`look-name-${l.id}`}>
                  {l.name}
                </span>
                <span className="look-desc" id={`look-desc-${l.id}`}>
                  {l.description}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>
    </Sheet>
  )
}
