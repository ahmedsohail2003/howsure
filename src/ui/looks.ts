// The looks this build offers (build-out item 1.5.2), in the order the Look sheet lists them.
// A look that isn't built yet is not listed, so it can't be chosen and a stored value naming it
// falls back to Journal (src/store/look.ts). Building a look adds one line here, its words in
// copy.ts > looks, its palette and layout in theme.css under [data-look="<id>"], and its preview
// (theme.css > .look-preview-<id>). A dark look is also named in src/store/earlyLook.ts >
// DARK_LOOKS, so a reload in it is dark from the first paint. Pure: no React.
//
// Every look shows the same numbers, details and actions. The view-models (dayView.ts,
// sleepView.ts) are shared; a component that is drawn differently in a look reads the look from
// lookContext.ts and picks its variant.

import { DARK_LOOKS } from '../store/earlyLook'
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
  { id: 'panel', name: copy.looks.panel.name, description: copy.looks.panel.description },
  { id: 'night', name: copy.looks.night.name, description: copy.looks.night.description },
]

/** The ids of the looks this build offers. */
export const BUILT_LOOKS: readonly Look[] = LOOKS.map((l) => l.id)

export function lookDef(id: Look): LookDef {
  return LOOKS.find((l) => l.id === id) ?? (LOOKS.find((l) => l.id === DEFAULT_LOOK) as LookDef)
}

/** The color-scheme a look is drawn in: dark for Night, light for the others. */
export function colorSchemeOf(look: Look): 'light' | 'dark' {
  return DARK_LOOKS.includes(look) ? 'dark' : 'light'
}

/**
 * Draw the page in `look`: theme.css scopes each look's palette and layout by this attribute. The
 * color-scheme meta tag follows, as the early script in index.html sets it (src/store/earlyLook.ts).
 */
export function applyLook(look: Look, root: HTMLElement = document.documentElement): void {
  root.dataset.look = look
  root.ownerDocument.querySelector('meta[name="color-scheme"]')?.setAttribute('content', colorSchemeOf(look))
}
