// The dashboard's More menu (build-out item 1.3; spec.md > Screens: Tier 3 screens are each
// reached from the dashboard's More menu). The menu is this list: a later screen adds one
// entry here and one case where App opens it (TypeScript flags a missing case). Order here is
// the order on screen. Pure: no React.

import type { LogKind } from '../clock'
import { copy } from './copy'
import type { FullScreenMode } from './fullScreen'

export type MoreEntryId = 'profile' | 'targets' | 'fullScreen'

/** What an entry may depend on: which log is open, and the full-screen view's state. */
export interface MoreContext {
  kind: LogKind
  fullScreen: FullScreenMode
}

interface MoreEntryDef {
  id: MoreEntryId
  /** False hides the entry (Profile and privacy is for your own log only). */
  shows: (ctx: MoreContext) => boolean
  label: (ctx: MoreContext) => string
  /** One line under the label saying what it opens or does. */
  hint: (ctx: MoreContext) => string
}

export const MORE_ENTRIES: readonly MoreEntryDef[] = [
  {
    id: 'profile',
    shows: (ctx) => ctx.kind === 'mine',
    label: () => copy.moreMenu.profile,
    hint: () => copy.moreMenu.profileHint,
  },
  {
    id: 'targets',
    shows: () => true,
    label: () => copy.moreMenu.targets,
    hint: (ctx) => (ctx.kind === 'demo' ? copy.moreMenu.targetsHintDemo : copy.moreMenu.targetsHint),
  },
  {
    id: 'fullScreen',
    shows: () => true,
    // The label names the view the switch goes to.
    label: (ctx) => (ctx.fullScreen === 'off' ? copy.fullScreen.enter : copy.fullScreen.exit),
    hint: (ctx) =>
      ctx.fullScreen === 'off'
        ? copy.moreMenu.fullScreenHint
        : ctx.fullScreen === 'native'
          ? copy.moreMenu.exitFullScreenHint
          : copy.moreMenu.exitFallbackHint,
  },
]

export interface MoreEntry {
  id: MoreEntryId
  label: string
  hint: string
}

/** The entries the menu shows for this log and state, in order. */
export function moreEntries(ctx: MoreContext): MoreEntry[] {
  return MORE_ENTRIES.filter((e) => e.shows(ctx)).map((e) => ({ id: e.id, label: e.label(ctx), hint: e.hint(ctx) }))
}
