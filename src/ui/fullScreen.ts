// The full-screen view switch (build-out item 1.3). It shows HowSure without the browser's
// bars, using the Fullscreen API on the whole page (document.documentElement), so sheets that
// open over the dashboard stay visible. Where the API is missing (for example Safari on an
// iPhone) or the browser refuses, the same view is shown inside the page instead: the column
// widens, and on a wide screen the day sits in two columns. Esc leaves either one.
// Nothing about it is saved: a reload opens the normal view.

import { useCallback, useEffect, useState } from 'react'

/** 'native': the browser's full screen. 'fallback': the widened page, without it. */
export type FullScreenMode = 'off' | 'native' | 'fallback'

/** The class on <html> while either full-screen view is on (theme.css > full-screen view). */
export const FULL_VIEW_CLASS = 'full-view'

function nativeAvailable(): boolean {
  return document.fullscreenEnabled === true && typeof document.documentElement.requestFullscreen === 'function'
}

export interface FullScreenView {
  mode: FullScreenMode
  enter: () => void
  exit: () => void
}

export function useFullScreenView(): FullScreenView {
  const [mode, setMode] = useState<FullScreenMode>('off')

  // Leaving the browser's full screen some other way (Esc, the browser's own control) ends the view.
  useEffect(() => {
    const onChange = () => setMode((m) => (document.fullscreenElement ? 'native' : m === 'native' ? 'off' : m))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle(FULL_VIEW_CLASS, mode !== 'off')
    return () => root.classList.remove(FULL_VIEW_CLASS)
  }, [mode])

  // Esc leaves the widened page too, as it leaves the browser's full screen. An open sheet
  // handles Esc itself (it closes) and stops it there, so this only sees Esc on the dashboard.
  useEffect(() => {
    if (mode !== 'fallback') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('off')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mode])

  const enter = useCallback(() => {
    if (!nativeAvailable()) {
      setMode('fallback')
      return
    }
    let request: Promise<void> | undefined
    try {
      request = document.documentElement.requestFullscreen()
    } catch {
      setMode('fallback')
      return
    }
    // Every current browser returns a promise; without one, the fullscreenchange event decides.
    if (request && typeof request.then === 'function') {
      request.then(
        () => setMode(document.fullscreenElement ? 'native' : 'fallback'),
        () => setMode('fallback'),
      )
    }
  }, [])

  const exit = useCallback(() => {
    setMode('off')
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(() => {
        // Already left, or the browser refused: the fullscreenchange event keeps the state right.
      })
    }
  }, [])

  return { mode, enter, exit }
}
