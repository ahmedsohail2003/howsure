import { copy } from './copy'

interface FirstOpenProps {
  onStartMine: () => void
  onTryDemo: () => void
}

/**
 * The first open (prd.md > First Open, reshaped by build-out item 2.1): your own log is the main
 * path, one tap to an empty log with no invented data; the fictional demo is a side door below
 * it, also one tap. The same markup in every look; theme.css draws it.
 */
export function FirstOpen({ onStartMine, onTryDemo }: FirstOpenProps) {
  return (
    <main className="first-open" data-testid="first-open">
      <div className="page">
        <h1 className="wordmark">{copy.appName}</h1>
        <p className="tagline">{copy.tagline}</p>
        <p className="first-open-lede">{copy.firstOpen.lede}</p>
        <div className="first-open-actions">
          <div className="first-open-choice first-open-main">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onStartMine}
              aria-describedby="first-open-mine-hint"
              data-testid="start-mine"
            >
              {copy.firstOpen.startMine}
            </button>
            <small id="first-open-mine-hint">{copy.firstOpen.startMineHint}</small>
          </div>
          <div className="first-open-choice first-open-side" role="group" aria-labelledby="first-open-or">
            <p className="first-open-or" id="first-open-or">
              {copy.firstOpen.orDemo}
            </p>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={onTryDemo}
              aria-describedby="first-open-demo-hint"
              data-testid="try-demo"
            >
              {copy.firstOpen.tryDemo}
            </button>
            <small id="first-open-demo-hint">{copy.firstOpen.tryDemoHint}</small>
          </div>
        </div>
      </div>
    </main>
  )
}
