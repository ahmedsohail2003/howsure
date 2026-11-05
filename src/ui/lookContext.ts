// The chosen look, for the components that are drawn differently in each look (build-out item
// 1.5.2). App owns the state and saves it (src/store/look.ts); components read it here.

import { createContext, useContext } from 'react'
import { DEFAULT_LOOK, type Look } from '../store/look'

export interface LookState {
  look: Look
  /** Applies the look at once and saves it on this device. */
  setLook: (look: Look) => void
}

export const LookContext = createContext<LookState>({ look: DEFAULT_LOOK, setLook: () => {} })

export function useLook(): LookState {
  return useContext(LookContext)
}
