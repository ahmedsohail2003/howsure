import { copy } from './copy'

interface FirstOpenProps {
  onTryDemo: () => void
  onStartEmpty: () => void
}

/** prd.md > First Open: two choices, the demo as the primary action. */
export function FirstOpen({ onTryDemo, onStartEmpty }: FirstOpenProps) {
  return (
    <main className="first-open" data-testid="first-open">
      <div className="page">
        <h1 className="wordmark">{copy.appName}</h1>
        <p className="tagline">{copy.tagline}</p>
        <p className="first-open-lede">{copy.firstOpen.lede}</p>
        <div className="first-open-actions">
          <div className="first-open-choice">
            <button type="button" className="btn btn-primary" onClick={onTryDemo}>
              {copy.firstOpen.tryDemo}
            </button>
            <small>{copy.firstOpen.tryDemoHint}</small>
          </div>
          <div className="first-open-choice">
            <button type="button" className="btn" onClick={onStartEmpty}>
              {copy.firstOpen.startEmpty}
            </button>
            <small>{copy.firstOpen.startEmptyHint}</small>
          </div>
        </div>
      </div>
    </main>
  )
}
