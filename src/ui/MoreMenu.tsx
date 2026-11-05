// The More menu (build-out item 1.3): a sheet listing the app's other places, from the list in
// moreMenu.ts. The sheet traps focus, closes on Esc, and gives focus back to the More button.

import { copy } from './copy'
import type { MoreEntry, MoreEntryId } from './moreMenu'
import { Sheet } from './Sheet'

interface MoreMenuProps {
  entries: MoreEntry[]
  demo: boolean
  onChoose: (id: MoreEntryId) => void
  onClose: () => void
}

export function MoreMenu({ entries, demo, onChoose, onClose }: MoreMenuProps) {
  return (
    <Sheet title={copy.moreMenu.title} demo={demo} onClose={onClose} testId="more-menu">
      <ul className="more-list">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="more-item"
              onClick={() => onChoose(e.id)}
              data-testid={`more-${e.id}`}
            >
              <span className="more-label">{e.label}</span>
              <span className="more-hint">
                {e.hint}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
