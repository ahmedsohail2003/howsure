// spec.md > Screens > ProfilePrivacy.tsx and prd.md > Privacy Panel, for your own log (build-out
// item 1.2): "Saved on this device only", Export, Import and Delete. Opened from the guest name in
// the header; item 1.3's More menu links here too, so it takes everything it needs as props.
//
// Import and Delete each ask first, inside this sheet: Import shows what the file holds and
// what it replaces; Delete lists what it removes. Focus moves to each step's heading, and back
// to the button that started it on Cancel. A refused file changes nothing.
//
// Build-out item 2.5b: Body details (age, sex, height, weight, everyday activity) for the
// estimated deficit or surplus: a one-line summary here and a button that opens their sheet.
//
// Not here yet: the guest name with Reroll and Rename (item 2.10), plates (3.4), the
// sent-off-device count (with lookups, 3.5), the Claude connector switch (3.3) and Reset demo (2.1).

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { LogDoc } from '../store/log'
import type { LogProblem } from '../store/session'
import { IMPORT_MAX_BYTES, readImport, summarize, type ImportRead, type OlderCopiesCount } from '../store/transfer'
import { bodySummary } from './body'
import { copy } from './copy'
import { deleteItems, holdsText, replacesText, spanText } from './privacyView'
import { Sheet } from './Sheet'

/** How a confirmed Import went. 'stored…': the saved copy is left alone (see LogProblem). */
export type ImportOutcome = 'ok' | 'notSaved' | 'storedUnreadable' | 'storedNotBackedUp'

/** How Delete went: 'noStorage' when the browser won't let HowSure reach its storage at all. */
export type DeleteOutcome = 'ok' | 'failed' | 'noStorage'

interface ProfilePrivacyProps {
  /** Your own log as it is on screen. */
  doc: LogDoc
  /** Why its saved copy is left as it is, if it is (store/session.ts). */
  problem: LogProblem | null
  /** Older copies of your log on the device (store/transfer.ts > countOlderCopies). */
  olderCopies: OlderCopiesCount
  /** Download your log; returns the file name. */
  onExport: () => string
  /** Download the older copies; returns the file name. */
  onExportOlderCopies: () => string
  /** Replace your own log with the confirmed import. */
  onImport: (doc: LogDoc) => ImportOutcome
  /** Delete your own log. */
  onDelete: () => DeleteOutcome
  /** Opens Body details (build-out item 2.5b); closing them comes back here. */
  onEditBody: () => void
  /** Your log's now: the age shown moves on with it. */
  nowIso: string
  onClose: () => void
}

type Step =
  | { kind: 'main' }
  | { kind: 'preview'; file: string; read: Extract<ImportRead, { status: 'ok' }> }
  | { kind: 'confirmDelete' }

type Message = { tone: 'status' | 'error'; text: string; testId: string } | null

export function ProfilePrivacy(props: ProfilePrivacyProps) {
  const { doc, problem, olderCopies, onClose } = props
  const [step, setStep] = useState<Step>({ kind: 'main' })
  const [message, setMessage] = useState<Message>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const messageRef = useRef<HTMLParagraphElement>(null)
  const importBtnRef = useRef<HTMLButtonElement>(null)
  const deleteBtnRef = useRef<HTMLButtonElement>(null)
  // Where focus goes when a step ends: the message if there is one, else the button that started it.
  const returnTo = useRef<'import' | 'delete' | null>(null)

  const unreadable = problem === 'unreadable' || problem === 'newer'
  const onScreen = summarize(doc)
  const olderCount = olderCopies.backups + (olderCopies.original ? 1 : 0)
  const importBlocked =
    problem === 'unreadable' || problem === 'newer'
      ? copy.privacy.importBlockedUnreadable
      : problem === 'notBackedUp'
        ? copy.privacy.importBlockedNotBackedUp
        : null

  useEffect(() => {
    if (step.kind !== 'main') {
      stepHeadingRef.current?.focus()
      return
    }
    if (message) messageRef.current?.focus()
    else if (returnTo.current === 'import') importBtnRef.current?.focus()
    else if (returnTo.current === 'delete') deleteBtnRef.current?.focus()
    returnTo.current = null
  }, [step, message])

  function exportLog() {
    const file = props.onExport()
    setMessage({ tone: 'status', text: copy.privacy.exportReady(file), testId: 'privacy-status' })
  }

  function exportOlder() {
    const file = props.onExportOlderCopies()
    setMessage({ tone: 'status', text: copy.privacy.exportReady(file), testId: 'privacy-status' })
  }

  function refuse(text: string) {
    returnTo.current = 'import'
    setStep({ kind: 'main' })
    setMessage({ tone: 'error', text, testId: 'privacy-error' })
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const file = input.files?.[0]
    // Cleared so choosing the same file again fires a change.
    input.value = ''
    if (!file) return
    setMessage(null)
    if (file.size > IMPORT_MAX_BYTES) return refuse(copy.privacy.importErrors.tooLarge)
    let text: string
    try {
      text = await file.text()
    } catch {
      return refuse(copy.privacy.importErrors.notRead)
    }
    const read = readImport(text)
    if (read.status === 'refused') return refuse(copy.privacy.importErrors[read.problem])
    setStep({ kind: 'preview', file: file.name, read })
  }

  function confirmImport(next: LogDoc) {
    const outcome = props.onImport(next)
    returnTo.current = 'import'
    setStep({ kind: 'main' })
    if (outcome === 'ok') {
      setMessage({ tone: 'status', text: copy.privacy.imported(holdsText(summarize(next))), testId: 'privacy-status' })
    } else {
      setMessage({
        tone: 'error',
        text:
          outcome === 'notSaved'
            ? copy.privacy.importErrors.notSaved
            : outcome === 'storedNotBackedUp'
              ? copy.privacy.importBlockedNotBackedUp
              : copy.privacy.importBlockedUnreadable,
        testId: 'privacy-error',
      })
    }
  }

  function confirmDelete() {
    const outcome = props.onDelete()
    returnTo.current = 'delete'
    setStep({ kind: 'main' })
    setMessage(
      outcome === 'failed'
        ? { tone: 'error', text: copy.privacy.deleteFailed, testId: 'privacy-error' }
        : {
            tone: 'status',
            text: outcome === 'noStorage' ? copy.privacy.deletedNoStorage : copy.privacy.deleted,
            testId: 'privacy-status',
          },
    )
  }

  function cancel(to: 'import' | 'delete') {
    returnTo.current = to
    setMessage(null)
    setStep({ kind: 'main' })
  }

  let body
  if (step.kind === 'preview') {
    const { summary, upgradedFrom, doc: next } = step.read
    body = (
      <section className="privacy-step" aria-labelledby="import-preview-title" data-testid="import-preview">
        <h3 className="privacy-step-title" id="import-preview-title" ref={stepHeadingRef} tabIndex={-1}>
          {copy.privacy.previewTitle}
        </h3>
        <p className="privacy-hint">{copy.privacy.previewFile(step.file)}</p>
        <p className="privacy-subtitle">{copy.privacy.previewHolds}</p>
        <ul className="privacy-list" data-testid="import-preview-holds">
          {summary.name && <li>{copy.privacy.previewName(summary.name)}</li>}
          <li>{holdsText(summary)}</li>
          <li>{spanText(summary)}</li>
        </ul>
        {upgradedFrom !== undefined && <p className="privacy-hint">{copy.privacy.previewUpgraded(String(upgradedFrom))}</p>}
        <p className="callout amber" data-testid="import-preview-replaces">
          {replacesText(onScreen)}
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn btn-plain" onClick={() => cancel('import')} data-testid="import-cancel">
            {copy.privacy.importCancel}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => confirmImport(next)} data-testid="import-confirm">
            {copy.privacy.importConfirm}
          </button>
        </div>
      </section>
    )
  } else if (step.kind === 'confirmDelete') {
    body = (
      <section className="privacy-step" aria-labelledby="delete-confirm-title" data-testid="delete-data-confirm">
        <h3 className="privacy-step-title" id="delete-confirm-title" ref={stepHeadingRef} tabIndex={-1}>
          {copy.privacy.confirmTitle}
        </h3>
        <p className="privacy-subtitle">{copy.privacy.confirmDeletes}</p>
        <ul className="privacy-list" data-testid="delete-data-items">
          {deleteItems(onScreen, problem, olderCopies).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="callout amber">{copy.privacy.confirmKeeps}</p>
        <div className="sheet-actions">
          <button type="button" className="btn btn-plain" onClick={() => cancel('delete')} data-testid="delete-data-keep">
            {copy.privacy.keep}
          </button>
          <button type="button" className="btn btn-ink" onClick={confirmDelete} data-testid="delete-data-confirm-btn">
            {copy.privacy.confirmButton}
          </button>
        </div>
      </section>
    )
  } else {
    body = (
      <>
        <section className="privacy-section" aria-labelledby="privacy-saved-title">
          <h3 className="privacy-section-title" id="privacy-saved-title" data-testid="privacy-saved-here">
            {copy.privacy.savedHere}
          </h3>
          <p className="privacy-hint">{copy.privacy.savedHereDetail}</p>
        </section>

        <section className="privacy-section" aria-labelledby="privacy-body-title" data-testid="privacy-body">
          <h3 className="privacy-section-title" id="privacy-body-title">
            {copy.body.title}
          </h3>
          <p className="privacy-hint">{copy.body.sectionHint}</p>
          <p className="privacy-hint num" data-testid="privacy-body-summary">
            {bodySummary(doc.profile.body, props.nowIso) ?? copy.body.notSet}
          </p>
          <button type="button" className="btn" onClick={props.onEditBody} data-testid="edit-body">
            {bodySummary(doc.profile.body, props.nowIso) ? copy.body.edit : copy.body.add}
          </button>
        </section>

        <section className="privacy-section" aria-labelledby="privacy-export-title">
          <h3 className="privacy-section-title" id="privacy-export-title">
            {copy.privacy.exportTitle}
          </h3>
          <p className="privacy-hint">{unreadable ? copy.privacy.exportUnreadable : copy.privacy.exportHint}</p>
          <button type="button" className="btn" onClick={exportLog} data-testid="export-data">
            {copy.privacy.exportButton}
          </button>
          {olderCount > 0 && (
            <>
              <p className="privacy-hint">
                {olderCopies.original ? copy.privacy.olderCopiesOriginalHint : copy.privacy.olderCopiesHint}
              </p>
              <button type="button" className="btn btn-plain" onClick={exportOlder} data-testid="export-older-copies">
                {copy.privacy.olderCopiesButton(olderCount)}
              </button>
            </>
          )}
        </section>

        <section className="privacy-section" aria-labelledby="privacy-import-title">
          <h3 className="privacy-section-title" id="privacy-import-title">
            {copy.privacy.importTitle}
          </h3>
          <p className="privacy-hint">{copy.privacy.importHint}</p>
          {importBlocked && (
            <p className="callout amber" data-testid="import-blocked">
              {importBlocked}
            </p>
          )}
          <button
            ref={importBtnRef}
            type="button"
            className="btn"
            disabled={importBlocked !== null}
            onClick={() => fileRef.current?.click()}
            data-testid="import-data"
          >
            {copy.privacy.importButton}
          </button>
          {/* Opened by the button above, which carries the visible label; hidden from focus and screen readers. */}
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={onFile}
            data-testid="import-file"
          />
        </section>

        <section className="privacy-section" aria-labelledby="privacy-delete-title">
          <h3 className="privacy-section-title" id="privacy-delete-title">
            {copy.privacy.deleteTitle}
          </h3>
          <p className="privacy-hint">{copy.privacy.deleteHint}</p>
          <button
            ref={deleteBtnRef}
            type="button"
            className="btn btn-plain"
            onClick={() => {
              setMessage(null)
              setStep({ kind: 'confirmDelete' })
            }}
            data-testid="delete-data"
          >
            {copy.privacy.deleteButton}
          </button>
        </section>
      </>
    )
  }

  return (
    <Sheet title={copy.privacy.title} demo={false} onClose={onClose} testId="profile-privacy">
      {message && (
        <p
          ref={messageRef}
          tabIndex={-1}
          className={message.tone === 'error' ? 'callout amber privacy-message' : 'callout privacy-message'}
          role={message.tone === 'error' ? 'alert' : 'status'}
          data-testid={message.testId}
        >
          {message.text}
        </p>
      )}
      {body}
    </Sheet>
  )
}
