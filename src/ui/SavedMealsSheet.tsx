// Build-out item 2.3: the Saved meals sheet, from More or from Log a meal. Each saved meal can be
// renamed (the same name check as saving) or deleted after a confirmation. Neither touches the
// meals already logged: a saved meal is a starting point, not a link. A status line says what was
// done. Each change is saved at once, like every other change to a log.

import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { SavedMeal } from '../store/log'
import { copy } from './copy'
import { fmtInt } from './format'
import { mealSourceLabel } from './MealList'
import { Sheet } from './Sheet'
import { checkSavedName, savedInOrder } from './usualMeals'

interface SavedMealsSheetProps {
  saved: SavedMeal[]
  demo: boolean
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

type RowMode = { id: string; kind: 'rename'; name: string; tried: boolean } | { id: string; kind: 'delete' }

export function SavedMealsSheet({ saved, demo, onRename, onDelete, onClose }: SavedMealsSheetProps) {
  const ids = useId()
  const [mode, setMode] = useState<RowMode | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const list = savedInOrder(saved)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // After a row's form closes, focus goes back to the button that opened it, as soon as it is drawn
  // again (a layout effect runs before the next key press is handled, so Esc still closes the sheet).
  const pendingFocus = useRef<{ id: string; button: 'saved-rename' | 'saved-delete' } | null>(null)
  useLayoutEffect(() => {
    const p = pendingFocus.current
    if (!p) return
    pendingFocus.current = null
    listRef.current?.querySelector<HTMLElement>(`[data-saved-id="${CSS.escape(p.id)}"] [data-testid="${p.button}"]`)?.focus()
  })

  function closeRow(id: string, button: 'saved-rename' | 'saved-delete') {
    pendingFocus.current = { id, button }
    setMode(null)
  }

  /** After a rename or delete, focus goes to the line that says what was done. */
  function done(text: string) {
    setMode(null)
    setStatus(text)
    statusRef.current?.focus()
  }

  return (
    <Sheet title={copy.usualMeals.title} demo={demo} onClose={onClose} testId="saved-meals-sheet">
      <p className="small">{copy.usualMeals.intro}</p>
      <p className="status-note" role="status" tabIndex={-1} ref={statusRef} data-testid="saved-meals-status">
        {status ?? ''}
      </p>
      {list.length === 0 ? (
        <p data-testid="saved-meals-empty">{copy.usualMeals.empty}</p>
      ) : (
        <ul className="saved-list" ref={listRef} data-testid="saved-meals-list">
          {list.map((s) => {
            const kcal = s.kcal === null ? copy.quickLog.kcalUnknown : copy.quickLog.kcal(fmtInt(s.kcal))
            const rowMode = mode?.id === s.id ? mode : null
            const inputId = `${ids}-${s.id}`
            const error = rowMode?.kind === 'rename' ? checkSavedName(rowMode.name, saved, s.id) : null
            const showError = rowMode?.kind === 'rename' && error !== null && (rowMode.tried || rowMode.name.trim() !== '')
            return (
              <li key={s.id} className="saved-row" data-saved-id={s.id} data-testid="saved-meal">
                <div className="saved-head">
                  <div className="saved-main">
                    <span className="saved-name" data-testid="saved-meal-name">
                      {s.name}
                    </span>
                    <span className="saved-meta num">{copy.usualMeals.meta(kcal, mealSourceLabel(s.source))}</span>
                  </div>
                  {rowMode === null && (
                    <div className="saved-actions">
                      <button
                        type="button"
                        className="btn btn-quiet"
                        onClick={() => setMode({ id: s.id, kind: 'rename', name: s.name, tried: false })}
                        aria-label={copy.usualMeals.renameLabel(s.name)}
                        data-testid="saved-rename"
                      >
                        {copy.usualMeals.rename}
                      </button>
                      <button
                        type="button"
                        className="btn btn-quiet"
                        onClick={() => setMode({ id: s.id, kind: 'delete' })}
                        aria-label={copy.usualMeals.deleteLabel(s.name)}
                        data-testid="saved-delete"
                      >
                        {copy.usualMeals.delete}
                      </button>
                    </div>
                  )}
                </div>

                {rowMode?.kind === 'rename' && (
                  <form
                    className="meal-form saved-rename-form"
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (error !== null) {
                        setMode({ ...rowMode, tried: true })
                        return
                      }
                      const to = rowMode.name.trim()
                      if (to === s.name) {
                        closeRow(s.id, 'saved-rename')
                        return
                      }
                      onRename(s.id, to)
                      done(copy.usualMeals.renamed(s.name, to))
                    }}
                  >
                    <div className="field">
                      <label htmlFor={inputId}>{copy.usualMeals.newName}</label>
                      <input
                        id={inputId}
                        type="text"
                        value={rowMode.name}
                        autoFocus
                        onChange={(e) => setMode({ ...rowMode, name: e.target.value })}
                        aria-invalid={showError ? true : undefined}
                        aria-describedby={showError ? `${inputId}-error` : undefined}
                        data-testid="saved-rename-input"
                      />
                      {showError && (
                        <p className="field-error" id={`${inputId}-error`} data-testid="saved-rename-error">
                          {error}
                        </p>
                      )}
                    </div>
                    <div className="sheet-actions">
                      <button type="button" className="btn" onClick={() => closeRow(s.id, 'saved-rename')} data-testid="saved-rename-cancel">
                        {copy.usualMeals.cancel}
                      </button>
                      <button type="submit" className="btn btn-primary" data-testid="saved-rename-save">
                        {copy.usualMeals.confirm}
                      </button>
                    </div>
                  </form>
                )}

                {rowMode?.kind === 'delete' && (
                  <div className="delete-confirm" data-testid="saved-delete-confirm">
                    <p className="delete-confirm-text">{copy.usualMeals.confirmDelete(s.name)}</p>
                    <div className="sheet-actions">
                      <button type="button" className="btn" onClick={() => closeRow(s.id, 'saved-delete')} data-testid="saved-delete-keep">
                        {copy.usualMeals.keep}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ink"
                        onClick={() => {
                          onDelete(s.id)
                          done(copy.usualMeals.deleted(s.name))
                        }}
                        data-testid="saved-delete-confirm-btn"
                      >
                        {copy.usualMeals.deleteConfirm}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
