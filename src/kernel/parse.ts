// Number parsing for typed amounts (spec.md > Maths Core: Number Parsing).
// Works on the trimmed text. Blank is unknown, never 0; "0" is a valid zero.
// Pure: no React, no storage, no clock reads.

import type { Parsed } from './types'

/** The inline error for anything that isn't a plain amount (letters, a minus sign, odd separators). */
export const PARSE_ERROR_MESSAGE = 'Use digits, e.g. 1501 or 13.9'

const THOUSANDS = /^\d{1,3}(,\d{3})+(\.\d+)?$/ // "1,501" -> 1501, "12,345.5" -> 12345.5
const DECIMAL_COMMA = /^\d+,\d{1,2}$/ // "13,9" -> 13.9
const PLAIN = /^\d+(\.\d+)?$/ // "1501", "13.9", "0"

export function parseAmount(input: string): Parsed {
  const s = (input ?? '').trim()
  if (s === '') return { kind: 'unknown' }
  let value: number | null = null
  if (THOUSANDS.test(s)) value = Number(s.replace(/,/g, ''))
  else if (DECIMAL_COMMA.test(s)) value = Number(s.replace(',', '.'))
  else if (PLAIN.test(s)) value = Number(s)
  if (value === null || !Number.isFinite(value)) return { kind: 'error', message: PARSE_ERROR_MESSAGE }
  return { kind: 'value', value }
}
