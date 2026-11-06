// The gym sets inside Log a workout (build-out item 2.6, slice 26; prd.md > Gym Log): the unit,
// Copy last session, and each exercise with its sets. A set row is its number, its type (warm-up,
// working or drop set), its weight and its reps; a drop set lists its drops under it, each a
// lighter weight with its reps. Add set copies the set above, so a run of working sets is a tap
// each. The same editor serves every look; theme.css only changes how it is drawn.
//
// Each exercise shows its best working set from earlier sessions as soon as its name matches one,
// worked out by kernel/gym.ts (gymView.ts words it). Nothing changes until the sheet's Save.

import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { exerciseHistoryBefore, lastSession, SET_KINDS } from '../kernel/gym'
import type { SetKind, WeightUnit, Workout } from '../kernel/types'
import { Choice } from './BodySheet'
import { copy } from './copy'
import { fmtDatedWhen } from './format'
import {
  blankDrop,
  blankExercise,
  draftCopiedFrom,
  isBlankDraft,
  withSetAdded,
  withUnit,
  type DropDraft,
  type ExerciseDraft,
  type GymCheck,
  type GymDraft,
  type SetDraft,
} from './gymDraft'
import { setText } from './gymView'

interface GymEditorProps {
  draft: GymDraft
  check: GymCheck
  onChange: (next: GymDraft) => void
  /** Every workout in the log, for Copy last session and each exercise's previous best. */
  workouts: Workout[]
  /** The workout being edited (left out of both), and its start as typed (null while not a time). */
  workoutId: string
  startIso: string | null
  nowIso: string
  /** The workout's name as typed; Copy last session fills it in when it is blank. */
  name: string
  onName: (name: string) => void
  onRemove: () => void
}

const UNITS: readonly WeightUnit[] = ['kg', 'lb']

/** How long after a pointerup a press still counts as going on when no click follows it. */
const PRESS_WAIT_MS = 700

export function GymEditor({ draft, check, onChange, workouts, workoutId, startIso, nowIso, name, onName, onRemove }: GymEditorProps) {
  const id = useId()
  const rootRef = useRef<HTMLElement>(null)
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null)
  // Remove exercise on one with something typed: what went and where, for Undo (until Save).
  const [removed, setRemoved] = useState<{ exercise: ExerciseDraft; unit: WeightUnit; index: number; n: number } | null>(null)
  // The row (or button) that takes focus after the next change: a new row's first box, or after a
  // remove, the add button that stays.
  const focusNext = useRef<string | null>(null)
  useEffect(() => {
    const key = focusNext.current
    if (!key) return
    focusNext.current = null
    rootRef.current?.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)?.focus()
  })

  const before = startIso ?? nowIso
  const last = isBlankDraft(draft) ? lastSession(workouts, name, before, workoutId) : null
  const unitLabel = copy.gym.units[draft.unit]
  const anyTouched = touched.size > 0

  // A field's message shows once focus has left it. When focus leaves because a button is being
  // pressed (Add drop, Add set), the message waits until that press has finished: a line appearing
  // mid-press would move the button out from under the finger or pointer and the press would be lost.
  // "Finished" is the click itself. With a mouse it comes straight after pointerup; on a touch
  // screen the blur and the click come later, after touchend, with the compatibility mouse events.
  // So the press ends just after the click has been handled, or after a short wait when no click
  // follows (the finger slid off), or at once when the browser cancels it (a scroll).
  const pressing = useRef(false)
  const waiting = useRef<string[]>([])
  const markTouched = (fields: string[]) =>
    setTouched((t) => (fields.every((f) => t.has(f)) ? t : new Set([...t, ...fields])))
  useEffect(() => {
    let fallback: number | undefined
    const release = () => {
      window.clearTimeout(fallback)
      document.removeEventListener('click', clicked, true)
      pressing.current = false
      const fields = waiting.current
      waiting.current = []
      if (fields.length > 0) markTouched(fields)
    }
    // Capture phase: runs before the button's own handler, so the release waits for it.
    const clicked = () => {
      document.removeEventListener('click', clicked, true)
      window.clearTimeout(fallback)
      fallback = window.setTimeout(release, 0)
    }
    const down = () => {
      window.clearTimeout(fallback)
      pressing.current = true
    }
    const up = () => {
      document.addEventListener('click', clicked, true)
      window.clearTimeout(fallback)
      fallback = window.setTimeout(release, PRESS_WAIT_MS)
    }
    const cancel = () => {
      window.clearTimeout(fallback)
      fallback = window.setTimeout(release, 0)
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', cancel, true)
    return () => {
      window.clearTimeout(fallback)
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', cancel, true)
      document.removeEventListener('click', clicked, true)
    }
  }, [])
  const touch = (field: string) => {
    if (pressing.current) waiting.current.push(field)
    else markTouched([field])
  }
  const shown = (field: string) => (touched.has(field) ? check.errors[field] : undefined)
  // Focus has left the gym sets (to the rest of the form, Save, or nowhere) since they were opened.
  const [left, setLeft] = useState(false)
  const onSectionBlur = (ev: FocusEvent<HTMLElement>) => {
    if (!left && !rootRef.current?.contains(ev.relatedTarget as Node | null)) setLeft(true)
  }
  // The "To save…" line waits like the per-field messages: until a field with a problem has been
  // left, or focus has left the gym sets with something typed (so Save never waits unexplained),
  // not while the first set is still being typed.
  const fixShown =
    check.gym === null &&
    (Object.keys(check.errors).some((f) => touched.has(f)) || (left && !isBlankDraft(draft)))

  // Enter (a phone keyboard's Next) in a box moves on to the next box rather than submitting the
  // whole form, so a set typed between rests never closes the sheet. After the last box it goes to
  // that exercise's Add set.
  const nextOnEnter = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key !== 'Enter' || ev.nativeEvent.isComposing) return
    ev.preventDefault()
    const root = rootRef.current
    if (!root) return
    const boxes = [...root.querySelectorAll<HTMLInputElement>('input[type="text"]')]
    const next = boxes[boxes.indexOf(ev.currentTarget) + 1]
    if (next) next.focus()
    else ev.currentTarget.closest('.gym-exercise')?.querySelector<HTMLElement>('[data-testid="gym-add-set"]')?.focus()
  }

  function setExercise(key: string, f: (e: ExerciseDraft) => ExerciseDraft) {
    onChange({ ...draft, exercises: draft.exercises.map((e) => (e.key === key ? f(e) : e)) })
  }
  function setSet(exKey: string, setKey: string, f: (s: SetDraft) => SetDraft) {
    setExercise(exKey, (e) => ({ ...e, sets: e.sets.map((s) => (s.key === setKey ? f(s) : s)) }))
  }
  function setDrop(exKey: string, setKey: string, dropKey: string, f: (d: DropDraft) => DropDraft) {
    setSet(exKey, setKey, (s) => ({ ...s, drops: s.drops.map((d) => (d.key === dropKey ? f(d) : d)) }))
  }

  function copyLast() {
    if (!last) return
    const next = draftCopiedFrom(last.gym, draft.unit)
    if (name.trim() === '') onName(last.name)
    setCopiedFrom(copy.gym.copied(last.name, fmtDatedWhen(last.startedAt, nowIso, false)))
    setRemoved(null)
    focusNext.current = next.exercises[0] ? `${next.exercises[0].key}.name` : null
    onChange(next)
  }

  function errorLine(field: string) {
    const msg = shown(field)
    return msg ? (
      <p className="field-error gym-row-msg" id={`${id}-${field}`} data-testid="gym-error">
        {msg}
      </p>
    ) : null
  }

  function noteLine(field: string) {
    const msg = check.notes[field]
    return msg && !shown(field) ? (
      <p className="field-hint gym-row-msg" data-testid="gym-note">
        {msg}
      </p>
    ) : null
  }

  function numBox(props: {
    field: string
    value: string
    label: string
    onValue: (v: string) => void
    testId: string
    focusKey?: string
  }) {
    const err = shown(props.field)
    return (
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="num"
        value={props.value}
        onChange={(e) => props.onValue(e.target.value)}
        onBlur={() => touch(props.field)}
        onKeyDown={nextOnEnter}
        enterKeyHint="next"
        aria-label={props.label}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? `${id}-${props.field}` : undefined}
        data-testid={props.testId}
        data-focus-key={props.focusKey ?? props.field}
      />
    )
  }

  return (
    <section className="gym-editor" ref={rootRef} onBlur={onSectionBlur} aria-labelledby={`${id}-title`} data-testid="gym-editor">
      <div className="gym-editor-head">
        <h3 className="gym-title" id={`${id}-title`}>
          {copy.gym.setsTitle}
        </h3>
        <button type="button" className="btn btn-quiet" onClick={onRemove} data-testid="gym-remove">
          {copy.gym.removeSets}
        </button>
      </div>

      {last && (
        <div className="gym-copy">
          <button type="button" className="btn" onClick={copyLast} data-testid="gym-copy-last">
            {copy.gym.copyLast}
          </button>
          <p className="field-hint" data-testid="gym-copy-from">
            {copy.gym.copyLastFrom(last.name, fmtDatedWhen(last.startedAt, nowIso, false), copy.gym.exercises(last.gym.exercises.length))}
          </p>
        </div>
      )}
      {copiedFrom && !last && (
        <p className="field-hint" data-testid="gym-copied">
          {copiedFrom}
        </p>
      )}

      <Choice
        legend={copy.gym.unitLegend}
        name={`${id}-unit`}
        options={UNITS.map((u) => ({ id: u, label: copy.gym.units[u] }))}
        value={draft.unit}
        onChange={(u) => onChange(withUnit(draft, u))}
        testId="gym-unit"
        hint={<p className="field-hint">{copy.gym.unitHint}</p>}
      />

      <ol className="gym-exercises">
        {draft.exercises.map((e, ei) => {
          const n = ei + 1
          const nameField = `${e.key}.name`
          const nameErr = shown(nameField)
          const history = e.name.trim() === '' ? null : exerciseHistoryBefore(workouts, e.name, before, workoutId)
          const best = history?.best ?? null
          return (
            <li key={e.key} className="gym-exercise" data-testid="gym-exercise">
              <div className="gym-exercise-head">
                <label htmlFor={`${id}-${nameField}`}>{copy.gym.exercise(n)}</label>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => {
                    // Something typed in it: Undo can put it back. A blank one just goes.
                    const typed = !isBlankDraft({ unit: draft.unit, exercises: [e] })
                    setRemoved(typed ? { exercise: e, unit: draft.unit, index: ei, n } : null)
                    focusNext.current = typed ? 'undoRemove' : 'addExercise'
                    onChange({ ...draft, exercises: draft.exercises.filter((x) => x.key !== e.key) })
                  }}
                  aria-label={copy.gym.removeExercise(n)}
                  data-testid="gym-remove-exercise"
                >
                  {copy.gym.removeExerciseShort}
                </button>
              </div>
              <input
                id={`${id}-${nameField}`}
                type="text"
                value={e.name}
                onChange={(ev) => setExercise(e.key, (x) => ({ ...x, name: ev.target.value }))}
                onBlur={() => touch(nameField)}
                onKeyDown={nextOnEnter}
                enterKeyHint="next"
                aria-invalid={nameErr ? true : undefined}
                aria-describedby={nameErr ? `${id}-${nameField}` : `${id}-${e.key}-hint`}
                data-testid="gym-exercise-name"
                data-focus-key={nameField}
              />
              {errorLine(nameField)}
              {best ? (
                <p className="field-hint" id={`${id}-${e.key}-hint`} data-testid="gym-best">
                  {copy.gym.bestBefore(setText(best.set, draft.unit), fmtDatedWhen(best.startedAt, nowIso, false))}
                </p>
              ) : history?.seen ? (
                <p className="field-hint" id={`${id}-${e.key}-hint`} data-testid="gym-best">
                  {copy.gym.bestNoWorking}
                </p>
              ) : (
                ei === 0 && (
                  <p className="field-hint" id={`${id}-${e.key}-hint`}>
                    {copy.gym.exerciseHint}
                  </p>
                )
              )}

              <div className="gym-sets" role="group" aria-label={copy.gym.exerciseSets(e.name.trim() || copy.gym.exercise(n))}>
                <div className="gym-set-row gym-set-head" aria-hidden="true">
                  <span className="gym-head-n">{copy.gym.head.n}</span>
                  <span>{copy.gym.head.kind}</span>
                  <span>{copy.gym.head.weight(unitLabel)}</span>
                  <span>{copy.gym.head.reps}</span>
                  <span />
                </div>
                {e.sets.map((s, si) => {
                  const sn = si + 1
                  return (
                    <div key={s.key} className={`gym-set gym-set-${s.kind}`} data-testid="gym-set">
                      <div className="gym-set-row">
                        <span className="gym-set-n num">{sn}</span>
                        <select
                          value={s.kind}
                          onChange={(ev) => setSet(e.key, s.key, (x) => ({ ...x, kind: ev.target.value as SetKind }))}
                          aria-label={copy.gym.setKindLabel(sn)}
                          data-testid="gym-set-kind"
                        >
                          {SET_KINDS.map((k) => (
                            <option key={k} value={k}>
                              {copy.gym.kinds[k]}
                            </option>
                          ))}
                        </select>
                        {numBox({
                          field: `${s.key}.weight`,
                          value: s.weight,
                          label: copy.gym.setWeightLabel(sn, unitLabel),
                          onValue: (v) => setSet(e.key, s.key, (x) => ({ ...x, weight: v })),
                          testId: 'gym-set-weight',
                        })}
                        {numBox({
                          field: `${s.key}.reps`,
                          value: s.reps,
                          label: copy.gym.setRepsLabel(sn),
                          onValue: (v) => setSet(e.key, s.key, (x) => ({ ...x, reps: v })),
                          testId: 'gym-set-reps',
                        })}
                        <button
                          type="button"
                          className="btn btn-quiet gym-x"
                          onClick={() => {
                            focusNext.current = `${e.key}.addSet`
                            setExercise(e.key, (x) => ({ ...x, sets: x.sets.filter((y) => y.key !== s.key) }))
                          }}
                          aria-label={copy.gym.removeSet(sn)}
                          data-testid="gym-remove-set"
                        >
                          <span aria-hidden="true">{copy.gym.removeMark}</span>
                        </button>
                      </div>
                      {errorLine(`${s.key}.weight`)}
                      {errorLine(`${s.key}.reps`)}

                      {s.kind === 'drop' && (
                        <div className="gym-drops">
                          {s.drops.map((d, di) => {
                            const dn = di + 1
                            return (
                              <div key={d.key} className="gym-drop" data-testid="gym-drop">
                                <div className="gym-set-row">
                                  <span />
                                  <span className="gym-drop-label">{copy.gym.drop(dn)}</span>
                                  {numBox({
                                    field: `${d.key}.weight`,
                                    value: d.weight,
                                    label: copy.gym.dropWeightLabel(sn, dn, unitLabel),
                                    onValue: (v) => setDrop(e.key, s.key, d.key, (x) => ({ ...x, weight: v })),
                                    testId: 'gym-drop-weight',
                                  })}
                                  {numBox({
                                    field: `${d.key}.reps`,
                                    value: d.reps,
                                    label: copy.gym.dropRepsLabel(sn, dn),
                                    onValue: (v) => setDrop(e.key, s.key, d.key, (x) => ({ ...x, reps: v })),
                                    testId: 'gym-drop-reps',
                                  })}
                                  <button
                                    type="button"
                                    className="btn btn-quiet gym-x"
                                    onClick={() => {
                                      focusNext.current = `${s.key}.addDrop`
                                      setSet(e.key, s.key, (x) => ({ ...x, drops: x.drops.filter((y) => y.key !== d.key) }))
                                    }}
                                    aria-label={copy.gym.removeDrop(sn, dn)}
                                    data-testid="gym-remove-drop"
                                  >
                                    <span aria-hidden="true">{copy.gym.removeMark}</span>
                                  </button>
                                </div>
                                {errorLine(`${d.key}.weight`)}
                                {noteLine(`${d.key}.weight`)}
                                {errorLine(`${d.key}.reps`)}
                              </div>
                            )
                          })}
                          <button
                            type="button"
                            className="link-btn gym-add-drop"
                            onClick={() => {
                              const drop = blankDrop()
                              focusNext.current = `${drop.key}.weight`
                              setSet(e.key, s.key, (x) => ({ ...x, drops: [...x.drops, drop] }))
                            }}
                            aria-label={copy.gym.addDropLabel(sn)}
                            data-testid="gym-add-drop"
                            data-focus-key={`${s.key}.addDrop`}
                          >
                            {copy.gym.addDrop}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {check.errors[`${e.key}.sets`] && anyTouched && (
                <p className="field-error" data-testid="gym-error">
                  {check.errors[`${e.key}.sets`]}
                </p>
              )}
              <button
                type="button"
                className="btn btn-quiet gym-add-set"
                onClick={() => {
                  const next = withSetAdded(e)
                  const added = next.sets[next.sets.length - 1]
                  focusNext.current = added ? `${added.key}.weight` : null
                  setExercise(e.key, () => next)
                }}
                aria-label={copy.gym.addSetLabel(e.name.trim() || copy.gym.exercise(n))}
                data-testid="gym-add-set"
                data-focus-key={`${e.key}.addSet`}
              >
                {copy.gym.addSet}
              </button>
            </li>
          )
        })}
      </ol>
      <p className="field-hint">
        {copy.gym.addSetHint} {copy.gym.weightHint}
      </p>

      {removed && (
        <div className="gym-undo" role="status" data-testid="gym-removed-exercise">
          <p>
            {removed.exercise.name.trim()
              ? copy.gym.exerciseRemoved(removed.exercise.name.trim(), copy.gym.sets(removed.exercise.sets.length))
              : copy.gym.exerciseRemovedUnnamed(removed.n, copy.gym.sets(removed.exercise.sets.length))}
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const at = Math.min(removed.index, draft.exercises.length)
              // Its weights in the unit chosen now, if the unit was switched since.
              const back = withUnit({ unit: removed.unit, exercises: [removed.exercise] }, draft.unit).exercises[0]
              const exercises = [...draft.exercises.slice(0, at), back, ...draft.exercises.slice(at)]
              focusNext.current = `${removed.exercise.key}.name`
              setRemoved(null)
              onChange({ ...draft, exercises })
            }}
            aria-label={copy.gym.undoRemoveLabel(removed.exercise.name.trim() || copy.gym.exercise(removed.n))}
            data-testid="gym-undo-remove"
            data-focus-key="undoRemove"
          >
            {copy.gym.undoRemove}
          </button>
        </div>
      )}
      {check.errors.session && (
        <p className="field-error" data-testid="gym-error">
          {check.errors.session}
        </p>
      )}
      <button
        type="button"
        className="btn gym-add-exercise"
        onClick={() => {
          const ex = blankExercise()
          focusNext.current = `${ex.key}.name`
          onChange({ ...draft, exercises: [...draft.exercises, ex] })
        }}
        data-testid="gym-add-exercise"
        data-focus-key="addExercise"
      >
        {copy.gym.addExercise}
      </button>
      {fixShown && (
        <p className="field-error" data-testid="gym-fix-to-save">
          {copy.gym.fixToSave}
        </p>
      )}
    </section>
  )
}
