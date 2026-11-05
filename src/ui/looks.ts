// The looks this build offers (build-out item 1.5.2), in the order the Look sheet lists them.
// A look that isn't built yet is not listed, so it can't be chosen and a stored value naming it
// falls back to Journal (src/store/look.ts). Building a look adds one line here, its words in
// copy.ts > looks, its palette and layout in theme.css under [data-look="<id>"], and its preview
// (theme.css > .look-preview-<id>). Pure: no React.
//
// Every look shows the same numbers, details and actions. The view-models (dayView.ts,
// sleepView.ts) are shared; a component that is drawn differently in a look reads the look from
// lookContext.ts and picks its variant.

import { DEFAULT_LOOK, type Look } from '../store/look'
import { copy } from './copy'

export interface LookDef {
  id: Look
  name: string
  /** One plain line under the name in the Look sheet. */
  description: string
}

export const LOOKS: readonly LookDef[] = [
  { id: 'journal', name: copy.looks.journal.name, description: copy.looks.journal.description },
]

/** The ids of the looks this build offers. */
export const BUILT_LOOKS: readonly Look[] = LOOKS.map((l) => l.id)

export function lookDef(id: Look): LookDef {
  return LOOKS.find((l) => l.id === id) ?? (LOOKS.find((l) => l.id === DEFAULT_LOOK) as LookDef)
}

/** Draw the page in `look`: theme.css scopes each look's palette and layout by this attribute. */
export function applyLook(look: Look, root: HTMLElement = document.documentElement): void {
  root.dataset.look = look
}
