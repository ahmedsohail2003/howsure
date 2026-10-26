import { copy } from './copy'

/**
 * "Sample person — fictional": shown above every view and inside every sheet header in demo
 * mode. On the page it sticks to the top of the window, so it stays visible however far the
 * view scrolls (prd.md > Screens and Layout: "always visible there"). It keeps its own place
 * in the layout, so it never sits on top of the content before scrolling.
 */
export function FictionalBanner({ sticky = false }: { sticky?: boolean }) {
  return (
    <div className={sticky ? 'fictional-banner page-banner' : 'fictional-banner'} role="note" data-testid="fictional-banner">
      {copy.fictionalBanner}
    </div>
  )
}
