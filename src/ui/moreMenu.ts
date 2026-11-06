// The dashboard's More menu (build-out item 1.3; spec.md > Screens: Tier 3 screens are each
// reached from the dashboard's More menu). The menu is this list: a later screen adds one
// entry here and one case where App opens it (TypeScript flags a missing case). Order here is
// the order on screen. Pure: no React.

import type { LogKind } from '../clock'
import type { Look } from '../store/look'
import { copy } from './copy'
import type { FullScreenMode } from './fullScreen'
import { lookDef } from './looks'

export type MoreEntryId = 'profile' | 'targets' | 'body' | 'savedMeals' | 'weight' | 'look' | 'fullScreen' | 'resetDemo'

/** What an entry may depend on: which log is open, the full-screen view's state, the look. */
export interface MoreContext {
  kind: LogKind
  fullScreen: FullScreenMode
  look: Look
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
    // Build-out item 2.5b: body details for the estimated deficit or surplus. In both logs (the
    // demo's stay in the demo).
    id: 'body',
    shows: () => true,
    label: () => copy.moreMenu.body,
    hint: (ctx) => (ctx.kind === 'demo' ? copy.moreMenu.bodyHintDemo : copy.moreMenu.bodyHint),
  },
  {
    // Build-out item 2.3: rename or delete the meals saved as usual. In both logs.
    id: 'savedMeals',
    shows: () => true,
    label: () => copy.moreMenu.savedMeals,
    hint: () => copy.moreMenu.savedMealsHint,
  },
  {
    // Build-out item 2.4: the weight details (weigh-ins, the 7-day average and the trend). In both logs.
    id: 'weight',
    shows: () => true,
    label: () => copy.moreMenu.weight,
    hint: () => copy.moreMenu.weightHint,
  },
  {
    // Build-out item 1.5.2: the Look sheet. A device setting, so it shows in both logs.
    id: 'look',
    shows: () => true,
    label: () => copy.moreMenu.look,
    hint: (ctx) => copy.moreMenu.lookHint(lookDef(ctx.look).name),
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
  {
    // Build-out item 2.1: Reset demo, in the demo only. It never touches your own log.
    id: 'resetDemo',
    shows: (ctx) => ctx.kind === 'demo',
    label: () => copy.moreMenu.resetDemo,
    hint: () => copy.moreMenu.resetDemoHint,
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
