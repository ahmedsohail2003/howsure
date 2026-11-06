// Build-out item 2.4: the Log weight sheet's form state and checks, and the changes it makes to a
// log. Like Log a meal, everything typed is kept and Save waits until every box is fine. The
// weight is stored in kg and keeps the unit it was typed in; the unit picked for a new weigh-in, or
// changed while editing one, becomes the log's unit preference (settings.weightUnit; see
// unitToRemember). Pure: no React, no storage.

import { parseAmount } from '../kernel/parse'
import type { WeighIn, WeightUnit } from '../kernel/types'
import { fromKg, toKg } from '../kernel/weight'
import type { LogDoc } from '../store/log'
import { WEIGHT_KG_MAX, WEIGHT_KG_MIN, WEIGHT_LB_MAX, WEIGHT_LB_MIN } from './body'
import { copy } from './copy'
import { fromLocalInput, toLocalInput } from './editMeal'

/**
 * The weights the sheet takes, in each unit: the Body details form's range (30 to 300 kg, 66 to
 * 660 lb), so a slip such as 8.5 for 85 is caught, and every weigh-in typed here can also serve the
 * estimated deficit or surplus (balanceView.ts > latestWeighIn reads the same range).
 */
export const WEIGHT_LIMITS: Record<WeightUnit, { lo: number; hi: number }> = {
  kg: { lo: WEIGHT_KG_MIN, hi: WEIGHT_KG_MAX },
  lb: { lo: WEIGHT_LB_MIN, hi: WEIGHT_LB_MAX },
}

export interface WeighInDraft {
  weight: string
  unit: WeightUnit
  atLocal: string // a datetime-local value
  bodyFat: string
  note: string
}

export type WeighInField = 'weight' | 'at' | 'bodyFat'

export interface WeighInCheck {
  /** The weigh-in Save would store, or null while something blocks Save. */
  weighIn: WeighIn | null
  errors: Partial<Record<WeighInField, string>>
}

/** A new weigh-in's id: random, like a meal's. */
export function newWeighInId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return `weigh-${c.randomUUID()}`
  return `weigh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const upTo2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false })

/** A weight in a box: up to 2 decimals, no thousands separator ("171.4"). */
export function weightInputText(kg: number, unit: WeightUnit): string {
  return upTo2.format(fromKg(kg, unit))
}

/** The sheet's starting values: blank for a new weigh-in at `at`; an existing one as it was typed. */
export function draftFor(existing: WeighIn | null, at: string, unit: WeightUnit): WeighInDraft {
  if (!existing) return { weight: '', unit, atLocal: toLocalInput(at), bodyFat: '', note: '' }
  const own = existing.unit ?? unit
  return {
    weight: weightInputText(existing.kg, own),
    unit: own,
    atLocal: toLocalInput(existing.at),
    bodyFat: existing.bodyFatPct === undefined ? '' : String(existing.bodyFatPct),
    note: existing.note ?? '',
  }
}

/** True when the box still shows the saved weight in the draft's unit (nothing typed over it). */
export function showsSavedWeight(draft: WeighInDraft, original: WeighIn | null): original is WeighIn {
  return original !== null && draft.weight === weightInputText(original.kg, draft.unit)
}

/**
 * The draft with its unit switched. For a new weigh-in the number in the box is read in the new
 * unit (type it, then pick its unit). For an existing one whose box still shows its saved weight,
 * the box is converted, so switching to kg shows 171.4 lb as 77.75 kg and never stores 171.4 kg.
 * A number typed over the saved one is read in the unit picked, as for a new weigh-in.
 */
export function withDraftUnit(draft: WeighInDraft, unit: WeightUnit, original: WeighIn | null): WeighInDraft {
  if (unit === draft.unit) return draft
  if (showsSavedWeight(draft, original)) return { ...draft, unit, weight: weightInputText(original.kg, unit) }
  return { ...draft, unit }
}

/**
 * Check a draft. `original` is the weigh-in being edited (null for a new one, which gets `id`);
 * `nowIso` is the log's now, the latest time allowed. An untouched weight or time keeps the stored
 * value exactly, with no rounding. Saving always records the unit shown, so a weigh-in saved before
 * units were kept (no `unit`) gains the one it was shown in; its kg value is kept as it was.
 */
export function checkWeighIn(draft: WeighInDraft, original: WeighIn | null, id: string, nowIso: string): WeighInCheck {
  const errors: WeighInCheck['errors'] = {}
  const limits = WEIGHT_LIMITS[draft.unit]
  const parsed = parseAmount(draft.weight)
  let kg: number | null = null
  // The box still shows the stored weight in this unit: keep the stored kg, with no rounding, and
  // no range check, so a note or time can be changed on any saved weigh-in (an imported one may lie
  // outside the range, or a 66 lb one shown in kg reads 29.94).
  if (showsSavedWeight(draft, original)) kg = original.kg
  else if (parsed.kind === 'unknown') errors.weight = copy.weight.errors.weightNeeded
  else if (parsed.kind === 'error') errors.weight = copy.weight.errors.digits
  else if (parsed.value < limits.lo || parsed.value > limits.hi)
    errors.weight = copy.weight.errors.range(String(limits.lo), upTo2.format(limits.hi), copy.weight.unitName[draft.unit])
  else kg = toKg(parsed.value, draft.unit)

  const bf = parseAmount(draft.bodyFat)
  if (bf.kind === 'error') errors.bodyFat = copy.weight.errors.bodyFat
  else if (bf.kind === 'value' && !(bf.value > 0 && bf.value < 100)) errors.bodyFat = copy.weight.errors.bodyFat

  const timeKept = original !== null && draft.atLocal === toLocalInput(original.at)
  const at = timeKept ? original.at : fromLocalInput(draft.atLocal)
  if (at === null) errors.at = copy.weight.errors.notATime
  else if (!timeKept && Date.parse(at) > Date.parse(nowIso)) errors.at = copy.weight.errors.future

  if (Object.keys(errors).length > 0 || kg === null || at === null) return { weighIn: null, errors }

  const w: WeighIn = { ...(original ?? {}), id: original?.id ?? id, at, kg, unit: draft.unit }
  if (bf.kind === 'value') w.bodyFatPct = bf.value
  else delete w.bodyFatPct
  const note = draft.note.trim()
  if (note === '') delete w.note
  else w.note = note
  // A time typed in is a recorded time: an imported weigh-in's approximate time is no longer one.
  if (!timeKept) delete w.timeApproximate
  return { weighIn: w, errors }
}

/** The log with one weigh-in saved: replaced in place when its id is there, added when it is new. */
export function withWeighIn(doc: LogDoc, w: WeighIn): LogDoc {
  const list = doc.weighIns ?? []
  if (!list.some((x) => x.id === w.id)) return { ...doc, weighIns: [...list, w] }
  return { ...doc, weighIns: list.map((x) => (x.id === w.id ? w : x)) }
}

/** The log without one weigh-in. */
export function withoutWeighIn(doc: LogDoc, id: string): LogDoc {
  return { ...doc, weighIns: (doc.weighIns ?? []).filter((w) => w.id !== id) }
}

/**
 * The unit a saved weigh-in should make the log's preference, or null to leave it: a new weigh-in's
 * unit, or an edited one's when it was changed in the sheet. Editing an older lb weigh-in's note
 * leaves weights shown in kg.
 */
export function unitToRemember(saved: WeighIn, original: WeighIn | null, preference: WeightUnit): WeightUnit | null {
  const unit = saved.unit ?? 'kg'
  if (original === null) return unit
  return unit === (original.unit ?? preference) ? null : unit
}

/** The log with its unit preference set; the same log when it already has it. */
export function withWeightUnit(doc: LogDoc, unit: WeightUnit): LogDoc {
  if (doc.settings?.weightUnit === unit) return doc
  return { ...doc, settings: { ...(doc.settings ?? {}), weightUnit: unit } }
}
