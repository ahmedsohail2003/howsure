// Build-out item 2.10 (prd.md > Guest Profile and Gamer-Tag Name; spec.md > Screens >
// ProfilePrivacy.tsx): the guest name at the top of Profile and privacy, labelled "Guest: saved on
// this device only", with "Reroll" (a new generated name, with Undo) and "Rename" (a name the
// person types, 1 to 16 letters or digits, checked by kernel/gamertag.ts > checkName, with the
// message beside the field).
// Each change is saved at once, like every other change to a log. The same section draws in
// every look; only theme.css differs.
//
// Rename opens its field holding the current name, selected, so typing replaces it and a small
// change needs no retyping; saving it unchanged changes nothing. A log with no name yet shows "No
// name yet" without the "saved on this device" label, as nothing is saved for it to describe. The
// label shows only while the name is saved: just after Delete my data the new name is not saved
// yet, and the section says so ("Not saved yet…") until the first change saves it; when a save
// failed or storage can't be reached, neither line shows (the panel says so elsewhere).
//
// Focus: Rename moves it to the field; Save and Cancel bring it back to Rename; Reroll and Undo
// keep it on the button pressed (Undo goes, so focus moves to Reroll). Undo sits right after
// Reroll, so Tab reaches it next. The status line that says what changed is scrolled
// into view clear of the sheet's sticky header.

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { anotherGamerTag, checkName, NAME_MAX, type NameProblem } from '../kernel/gamertag'
import { copy } from './copy'

/**
 * Whether the name on screen is the one saved on the device: 'saved'; 'notYet', nothing of your
 * log is saved yet (just after Delete my data) and saving works; 'unknown', a save failed or the
 * saved copy can't be reached.
 */
export type NameSaved = 'saved' | 'notYet' | 'unknown'

interface GuestNameSectionProps {
  /** Your own log's guest name; '' when it has none yet. */
  name: string
  /** Whether that name is saved on the device. */
  saved: NameSaved
  /** Save a new name on your own log. */
  onSetName: (name: string) => void
}

type Status = { text: string; undoTo?: string } | null

/** Rename's message. `hasName`: the log has a name to keep, which Cancel keeps. */
function problemText(p: NameProblem, bad: string, hasName: boolean): string {
  if (p === 'tooLong') return copy.guestName.errors.tooLong(NAME_MAX)
  if (p === 'characters') return copy.guestName.errors.characters(bad)
  return hasName ? copy.guestName.errors.empty : copy.guestName.errors.emptyNoName
}

export function GuestNameSection({ name, saved, onSetName }: GuestNameSectionProps) {
  const ids = useId()
  const inputId = `${ids}-name`
  const [typing, setTyping] = useState<{ value: string; problem: NameProblem | null; bad?: string } | null>(null)
  const [status, setStatus] = useState<Status>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const pickRef = useRef<HTMLButtonElement>(null)
  const renameRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Where focus goes once the section is drawn again (a layout effect, so it is there before the next key).
  // 'select': the field, with its text selected (Rename just opened); 'input': the field as it is (after a refusal).
  const pendingFocus = useRef<'pick' | 'rename' | 'input' | 'select' | null>(null)

  useLayoutEffect(() => {
    const p = pendingFocus.current
    if (!p) return
    pendingFocus.current = null
    if (p === 'input' || p === 'select') {
      inputRef.current?.focus()
      if (p === 'select') inputRef.current?.select()
      return
    }
    ;(p === 'pick' ? pickRef : renameRef).current?.focus()
  })

  // A new status line comes into view (its scroll-margin keeps it below the sticky header).
  useEffect(() => {
    if (status) statusRef.current?.scrollIntoView({ block: 'nearest' })
  }, [status])

  function pick() {
    const before = name
    const next = anotherGamerTag(before)
    onSetName(next)
    setStatus(before ? { text: copy.guestName.picked(next, before), undoTo: before } : { text: copy.guestName.pickedFirst(next) })
  }

  function undo(to: string) {
    onSetName(to)
    setStatus({ text: copy.guestName.undone(to) })
    pendingFocus.current = 'pick'
  }

  function startRename() {
    setStatus(null)
    setTyping({ value: name, problem: null })
    pendingFocus.current = 'select'
  }

  function cancel() {
    setTyping(null)
    pendingFocus.current = 'rename'
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (!typing) return
    // Saved as it was (a generated name holds "#", which a typed one can't): nothing changes.
    if (name !== '' && typing.value.trim() === name) {
      setTyping(null)
      pendingFocus.current = 'rename'
      return
    }
    const res = checkName(typing.value)
    if (!res.ok) {
      setTyping({ ...typing, problem: res.problem, bad: res.bad })
      pendingFocus.current = 'input'
      return
    }
    setTyping(null)
    pendingFocus.current = 'rename'
    if (res.name === name) return
    onSetName(res.name)
    setStatus({ text: copy.guestName.renamed(res.name) })
  }

  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  return (
    <section className="privacy-section guest-name-section" aria-labelledby={`${ids}-title`} data-testid="guest-name-section">
      <h3 className="privacy-section-title" id={`${ids}-title`}>
        {copy.guestName.title}
      </h3>
      {/* A name, marked so the tap-through test reads its digits as part of a name (item 2.9). */}
      <p className={name ? 'guest-name' : 'guest-name guest-name-none'} data-testid="guest-name" data-name="">
        {name || copy.guestName.none}
      </p>
      {name && saved === 'saved' && (
        <p className="privacy-hint" data-testid="guest-name-label">
          {copy.guestName.label}
        </p>
      )}
      {name && saved === 'notYet' && (
        <p className="privacy-hint" data-testid="guest-name-not-saved">
          {copy.guestName.notSavedYet}
        </p>
      )}
      <p className="status-note guest-name-status" role="status" ref={statusRef} data-testid="guest-name-status">
        {status?.text ?? ''}
      </p>
      {typing ? (
        <form className="meal-form guest-rename-form" noValidate onSubmit={save} data-testid="guest-rename-form">
          <div className="field">
            <label htmlFor={inputId}>{copy.guestName.newName}</label>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={typing.value}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e) => setTyping({ value: e.target.value, problem: null })}
              aria-invalid={typing.problem ? true : undefined}
              aria-describedby={typing.problem ? `${errorId} ${hintId}` : hintId}
              data-testid="guest-rename-input"
            />
            {typing.problem && (
              <p className="field-error" id={errorId} data-testid="guest-rename-error">
                {problemText(typing.problem, typing.bad ?? '', name !== '')}
              </p>
            )}
            <p className="field-hint" id={hintId}>
              {copy.guestName.hint(NAME_MAX)}
            </p>
          </div>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={cancel} data-testid="guest-rename-cancel">
              {copy.guestName.cancel}
            </button>
            <button type="submit" className="btn btn-primary" data-testid="guest-rename-save">
              {copy.guestName.save}
            </button>
          </div>
        </form>
      ) : (
        <div className="guest-name-actions">
          <button ref={pickRef} type="button" className="btn" onClick={pick} data-testid="guest-name-pick">
            {name ? copy.guestName.reroll : copy.guestName.pickFirst}
          </button>
          {status?.undoTo !== undefined && (
            <button type="button" className="btn guest-name-undo" onClick={() => undo(status.undoTo!)} data-testid="guest-name-undo">
              {copy.guestName.undo}
            </button>
          )}
          <button ref={renameRef} type="button" className="btn" onClick={startRename} data-testid="guest-name-rename">
            {name ? copy.guestName.rename : copy.guestName.renameFirst}
          </button>
        </div>
      )}
    </section>
  )
}
