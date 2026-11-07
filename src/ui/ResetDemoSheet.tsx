// Reset demo's confirmation (build-out item 2.1; prd.md > Demo and My Log): shown only when the
// demo has been edited. It lists what would be discarded, counted against Sam's week as it
// started (store/demoReset.ts), and says your own log is not affected. Keep is the safe default:
// it closes the sheet and changes nothing. As in the app's other discard confirmations (Delete
// meal, Delete my data), the safe choice is the outlined button and the discard is btn-ink, so
// the teal fill of the positive main actions never invites the discard.

import type { DemoChanges } from '../store/demoReset'
import { copy } from './copy'
import { Sheet } from './Sheet'

interface ResetDemoSheetProps {
  changes: DemoChanges
  onConfirm: () => void
  onClose: () => void
}

/** The lines of the confirmation, in a fixed order; only the kinds of change that happened. */
export function changeLines(c: DemoChanges): string[] {
  const t = copy.resetDemo
  return [
    c.mealsAdded > 0 ? t.mealsAdded(c.mealsAdded) : null,
    c.mealsChanged > 0 ? t.mealsChanged(c.mealsChanged) : null,
    c.mealsDeleted > 0 ? t.mealsDeleted(c.mealsDeleted) : null,
    c.sleepChanged ? t.sleepChanged : null,
    c.targetsChanged ? t.targetsChanged : null,
    c.bodyChanged ? t.bodyChanged : null,
    c.usualDayChanged ? t.usualDayChanged : null,
    c.savedMealsChanged ? t.savedMealsChanged : null,
    c.workoutsChanged ? t.workoutsChanged : null,
    c.weighInsChanged ? t.weighInsChanged : null,
    c.otherChanged ? t.otherChanged : null,
  ].filter((l): l is string => l !== null)
}

export function ResetDemoSheet({ changes, onConfirm, onClose }: ResetDemoSheetProps) {
  const lines = changeLines(changes)
  const footer = (
    <div className="sheet-actions">
      <button type="button" className="btn" onClick={onClose} data-testid="reset-demo-keep">
        {copy.resetDemo.keep}
      </button>
      <button type="button" className="btn btn-ink" onClick={onConfirm} data-testid="reset-demo-confirm">
        {copy.resetDemo.confirm}
      </button>
    </div>
  )
  return (
    <Sheet title={copy.resetDemo.title} demo onClose={onClose} testId="reset-demo-sheet" footer={footer}>
      <div className="confirm-body">
        {lines.length > 0 && (
          <>
            <p>{copy.resetDemo.intro}</p>
            <ul className="confirm-list" data-testid="reset-demo-changes">
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </>
        )}
        <p data-testid="reset-demo-discards">{copy.resetDemo.discards}</p>
      </div>
    </Sheet>
  )
}
