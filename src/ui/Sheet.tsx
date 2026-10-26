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
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'

/** A sheet over the dashboard: a bottom sheet on phones, a centred panel on desktop. */
export function Sheet({ title, sub, demo, onClose, children, testId, footer }: SheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      opener?.focus?.()
    }
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
        <header>
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
