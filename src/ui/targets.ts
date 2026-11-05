// The targets editor's form state and checks (build-out item 1.3; spec.md > Data Model:
// profile.targets = { kcal, protein, carbs, fat }). Numbers are read with the kernel's
// parseAmount (spec.md > Maths Core: Number Parsing). A blank box means "no target" and is
// stored as no key at all, never as 0. Pure: no React, no storage.

import { parseAmount } from '../kernel/parse'
import type { LogDoc, Profile } from '../store/log'
import { copy } from './copy'

export const TARGET_KEYS = ['kcal', 'protein', 'carbs', 'fat'] as const
export type TargetKey = (typeof TARGET_KEYS)[number]

/** The targets that are set. A missing key means no target. */
export type Targets = Partial<Record<TargetKey, number>>

/** What is typed in each box. */
export type TargetFields = Record<TargetKey, string>

export type TargetParse = { kind: 'none' } | { kind: 'value'; value: number } | { kind: 'error'; message: string }

export interface TargetsCheck {
  /** The targets Save would store, or null while a box has an error. */
  targets: Targets | null
  /** Inline errors by box. What is typed is kept; only Save is blocked. */
  errors: Partial<Record<TargetKey, string>>
}

/**
 * One box: blank is no target; a minus sign or 0 is refused with its own message (a target
 * below or at 0 means nothing); anything else parseAmount can't read gets its message.
 */
export function parseTarget(text: string): TargetParse {
  const s = (text ?? '').trim()
  // ASCII hyphen-minus and the Unicode minus sign, so "−5" pasted from elsewhere is caught too.
  if (s.startsWith('-') || s.startsWith('−')) return { kind: 'error', message: copy.targets.errors.negative }
  const p = parseAmount(s)
  if (p.kind === 'unknown') return { kind: 'none' }
  if (p.kind === 'error') return { kind: 'error', message: p.message }
  if (p.value === 0) return { kind: 'error', message: copy.targets.errors.zero }
  return { kind: 'value', value: p.value }
}

export function checkTargets(fields: TargetFields): TargetsCheck {
  const targets: Targets = {}
  const errors: TargetsCheck['errors'] = {}
  for (const k of TARGET_KEYS) {
    const p = parseTarget(fields[k])
    if (p.kind === 'error') errors[k] = p.message
    else if (p.kind === 'value') targets[k] = p.value
  }
  return { targets: Object.keys(errors).length > 0 ? null : targets, errors }
}

/** The editor's starting text: each set target as plain digits, blank where none is set. */
export function fieldsFromTargets(targets: Profile['targets']): TargetFields {
  const text = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
  return {
    kcal: text(targets?.kcal),
    protein: text(targets?.protein),
    carbs: text(targets?.carbs),
    fat: text(targets?.fat),
  }
}

/**
 * The log with its four targets replaced. Other keys in the profile, and any key inside
 * `targets` a later version adds, are kept as they are. With nothing left in `targets`, the
 * key is removed. The log passed in is not changed.
 */
export function withTargets(doc: LogDoc, targets: Targets): LogDoc {
  const next: Record<string, unknown> = { ...(doc.profile.targets ?? {}) }
  for (const k of TARGET_KEYS) {
    if (targets[k] === undefined) delete next[k]
    else next[k] = targets[k]
  }
  const profile: Profile = { ...doc.profile }
  if (Object.keys(next).length > 0) profile.targets = next as Profile['targets']
  else delete profile.targets
  return { ...doc, profile }
}
