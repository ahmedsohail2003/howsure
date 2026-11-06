import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { copy } from './copy'
import { FictionalBanner } from './FictionalBanner'

interface SheetProps {
  title: string
  sub?: string
  demo: boolean
  onClose: () => void
  children: ReactNode
  testId?: string
  /** Actions kept in view at the bottom of the sheet while its body scrolls (Save and Cancel). */
  footer?: ReactNode
  /**
   * The data-testid of the control, inside the sheet, that takes focus when it opens (the field
   * most people came to change), or several in order of preference: the first one on the sheet
   * wins. Without it, or when nothing matches, the Close button takes focus.
   */
  initialFocusTestId?: string | string[]
}

/** Marks the element focus goes back to when a sheet closes and its opener has left the page. */
export const FOCUS_RETURN = 'data-focus-return'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([hidden]):not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])'

/** A sheet over the dashboard: a bottom sheet on phones, a centred panel on desktop. */
export function Sheet({ title, sub, demo, onClose, children, testId, footer, initialFocusTestId }: SheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const headRef = useRef<HTMLElement>(null)

  // The sticky header's height, kept in --sheet-head-h on the sheet, so a control that takes focus
  // can stop clear of it (scroll-margin in theme.css). It changes with the banner, a title or
  // subtitle that wraps, and the screen width.
  useEffect(() => {
    const head = headRef.current
    const panel = panelRef.current
    if (!head || !panel) return
    // offsetHeight: the layout height, unaffected by the opening tilt (a transform).
    const update = () => panel.style.setProperty('--sheet-head-h', `${head.offsetHeight}px`)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(head)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const wanted = initialFocusTestId === undefined ? [] : [initialFocusTestId].flat()
    const first = wanted.map((t) => panelRef.current?.querySelector<HTMLElement>(`[data-testid="${t}"]`)).find(Boolean)
    ;(first ?? closeRef.current)?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      // Back to the control that opened the sheet. When saving removed it (Set wake time goes
      // once a wake time exists), focus goes to the page's return point instead of <body>, so
      // the next Tab carries on from there rather than from the top of the page.
      if (opener && opener !== document.body && opener.isConnected) opener.focus()
      else document.querySelector<HTMLElement>(`[${FOCUS_RETURN}]`)?.focus()
    }
    // Focus moves once, when the sheet opens; a later change to the prop must not pull it back.
  }, [])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={footer ? 'sheet has-footer' : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        data-testid={testId}
      >
        <header ref={headRef}>
          {demo && <FictionalBanner />}
          <div className="sheet-header">
            <div>
              <h2 className="sheet-title" id={titleId}>
                {title}
              </h2>
              {sub && <p className="sheet-sub">{sub}</p>}
            </div>
            <button ref={closeRef} type="button" className="btn btn-quiet" onClick={onClose}>
              {copy.sheet.close}
            </button>
          </div>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </div>
    </div>
  )
}
