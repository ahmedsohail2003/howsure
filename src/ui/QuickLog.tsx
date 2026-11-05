// Build-out item 2.3: the top of Log a meal. Saved (meals saved as usual) and Recent (the last
// distinct meals logged), each one tap from being logged again as a fresh meal, with an amount
// control (×0.5, ×1, ×1.5, ×2 or a typed multiplier) that scales calories, macros and the ranges.
// The lists and their numbers come from usualMeals.ts, once; every look draws this same markup
// and only theme.css differs.

import { useId, useMemo, useState } from 'react'
import type { LogDoc } from '../store/log'
import { copy } from './copy'
import { fmtInt, fmtRange } from './format'
import {
  AMOUNT_PRESETS,
  checkFactor,
  fmtFactor,
  quickLists,
  type AmountChoice,
  type MealValues,
  type QuickItem,
} from './usualMeals'

interface QuickLogProps {
  doc: Pick<LogDoc, 'meals' | 'savedMeals'>
  /** Where a tap logs the meal: null for now, else the day and time words ("Wed at 1:30 AM"). */
  logsOn: string | null
  onLog: (values: MealValues) => void
  onManageSaved: () => void
}

export function QuickLog({ doc, logsOn, onLog, onManageSaved }: QuickLogProps) {
  const ids = useId()
  const [choice, setChoice] = useState<AmountChoice>({ kind: 'preset', factor: 1 })
  const check = checkFactor(choice)
  // The lists at the usual amount when the typed multiplier isn't usable yet; their taps are off.
  const factor = check.ok ? check.factor : 1
  const lists = useMemo(() => quickLists(doc, factor), [doc, factor])
  const hasAny = lists.recent.length > 0 || lists.saved.length > 0
  const otherId = `${ids}-other`
  const errorId = `${ids}-error`

  // Nothing to repeat yet (a first meal in a new log): no section, so the form is the first thing.
  if (!hasAny) return null

  const blankOther = choice.kind === 'other' && !check.ok && check.error === null
  const rowFactor = check.ok ? factor : null

  return (
    <>
      <section className="quick-log" aria-labelledby={`${ids}-title`} data-testid="quick-log">
        <h3 className="section-title" id={`${ids}-title`}>
          {copy.quickLog.title}
        </h3>
        <p className="field-hint" data-testid="quick-intro">
          {logsOn === null ? copy.quickLog.introNow : copy.quickLog.introOn(logsOn)}
        </p>

        <fieldset className="amount-field" data-testid="quick-amount">
          <legend className="quick-group-title">{copy.quickLog.amountLegend}</legend>
          <div className="amount-options">
            {AMOUNT_PRESETS.map((f) => {
              const checked = choice.kind === 'preset' && choice.factor === f
              return (
                <label key={f} className={checked ? 'amount-option checked' : 'amount-option'}>
                  <input
                    type="radio"
                    className="amount-input"
                    name={`${ids}-amount`}
                    checked={checked}
                    onChange={() => setChoice({ kind: 'preset', factor: f })}
                    data-testid={`amount-${fmtFactor(f)}`}
                  />
                  <span className="num">{copy.quickLog.amountTimes(fmtFactor(f))}</span>
                </label>
              )
            })}
            <label className={choice.kind === 'other' ? 'amount-option checked' : 'amount-option'}>
              <input
                type="radio"
                className="amount-input"
                name={`${ids}-amount`}
                checked={choice.kind === 'other'}
                onChange={() => setChoice({ kind: 'other', text: choice.kind === 'other' ? choice.text : '' })}
                data-testid="amount-other"
              />
              <span>{copy.quickLog.amountOther}</span>
            </label>
          </div>
          {choice.kind === 'other' && (
            <div className="field amount-other-field">
              <label htmlFor={otherId}>{copy.quickLog.amountOtherLabel}</label>
              <input
                id={otherId}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="num"
                value={choice.text}
                onChange={(e) => setChoice({ kind: 'other', text: e.target.value })}
                aria-invalid={!check.ok && check.error ? true : undefined}
                aria-describedby={errorId}
                data-testid="amount-other-input"
              />
              {!check.ok && check.error && (
                <p className="field-error" id={errorId} data-testid="amount-error">
                  {check.error}
                </p>
              )}
              {blankOther && (
                <p className="field-hint" id={errorId} data-testid="amount-needed">
                  {copy.quickLog.amountNeeded}
                </p>
              )}
            </div>
          )}
          {factor !== 1 && check.ok && (
            <p className="field-hint" data-testid="amount-hint">
              {copy.quickLog.amountHint}
            </p>
          )}
        </fieldset>

        {/* Saved first: the usual meals are what a second tap is most often for. */}
        <div className="quick-group" data-testid="quick-saved">
          <div className="quick-group-head">
            <h4 className="quick-group-title">{copy.quickLog.saved}</h4>
            {lists.saved.length > 0 && (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={onManageSaved}
                aria-label={copy.quickLog.manageSavedLabel}
                data-testid="manage-saved"
              >
                {copy.quickLog.manageSaved}
              </button>
            )}
          </div>
          {lists.saved.length > 0 ? (
            <QuickRows items={lists.saved} factor={rowFactor} onLog={onLog} />
          ) : (
            <p className="field-hint" data-testid="saved-empty">
              {copy.quickLog.savedEmpty}
            </p>
          )}
        </div>

        <QuickList title={copy.quickLog.recent} items={lists.recent} factor={rowFactor} onLog={onLog} testId="quick-recent" />
      </section>
      <h3 className="section-title quick-or" data-testid="quick-or">
        {copy.quickLog.orNew}
      </h3>
    </>
  )
}

interface QuickListProps {
  title: string
  items: QuickItem[]
  /** The usable multiplier, or null while the typed one isn't (the rows can't be tapped then). */
  factor: number | null
  onLog: (values: MealValues) => void
  testId: string
}

function QuickList({ title, items, factor, onLog, testId }: QuickListProps) {
  if (items.length === 0) return null
  return (
    <div className="quick-group" data-testid={testId}>
      <h4 className="quick-group-title">{title}</h4>
      <QuickRows items={items} factor={factor} onLog={onLog} />
    </div>
  )
}

function QuickRows({ items, factor, onLog }: Omit<QuickListProps, 'title' | 'testId'>) {
  return (
    <ul className="quick-list">
      {items.map((item) => {
        const v = item.values
        const kcal = v.kcal === null ? copy.quickLog.kcalUnknown : copy.quickLog.kcal(fmtInt(v.kcal))
        const source = item.sourceLabel ?? copy.meals.sourceNotPicked
        const scaled = factor !== null && factor !== 1 && item.usualKcal !== null
        return (
          <li key={`${item.kind}-${item.id}`} className="quick-row" data-testid="quick-item" data-kind={item.kind}>
            <button
              type="button"
              className="quick-item"
              onClick={() => onLog(v)}
              disabled={factor === null}
              data-testid="quick-log-item"
            >
              <span className="quick-main">
                <span className="visually-hidden">{copy.quickLog.logPrefix} </span>
                <span className="quick-name" data-testid="quick-name">
                  {v.name}
                </span>
                <span className="quick-meta num" data-testid="quick-meta">
                  {source}
                  {item.likely && (
                    <>
                      {copy.sep}
                      <span className="nowrap">{copy.quickLog.likely(fmtRange(item.likely))}</span>
                    </>
                  )}
                </span>
              </span>
              <span className="quick-right">
                <span className={v.kcal === null ? 'quick-kcal unknown num' : 'quick-kcal num'} data-testid="quick-kcal">
                  {kcal}
                </span>
                {scaled && (
                  <span className="quick-times num" data-testid="quick-times">
                    {copy.quickLog.times(fmtFactor(factor), copy.quickLog.kcal(fmtInt(item.usualKcal as number)))}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
