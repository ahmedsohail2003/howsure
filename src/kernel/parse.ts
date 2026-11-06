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

/* ---------------- clock times (build-out item 2.2: the sleep and wake editor) ---------------- */

/**
 * A typed clock time. `minutes` is minutes after midnight (0..1439). `meridiem` is true when the
 * text said am or pm (or noon, midnight); `ambiguous` is true when it didn't and the hour was
 * 1..12 with no leading zero and no h ("9h30" is 24-hour notation), so the screen can say how it was read ("8" reads as 8:00 AM) and
 * how to get the other.
 */
export type ClockParse =
  | { kind: 'empty' }
  | { kind: 'value'; minutes: number; meridiem: boolean; ambiguous: boolean }
  | { kind: 'error' }

// "8", "8am", "8 a.m.", "8:15 pm", "8.15pm", "20:30", "20h30", "9h"
const CLOCK_HM = /^(\d{1,2})(?:[:.h](\d{2})|h)?\s*(am|pm|a|p)?$/
// "830", "0830", "2030", "830pm": three or four digits, the last two the minutes
const CLOCK_DIGITS = /^(\d{1,2})(\d{2})\s*(am|pm|a|p)?$/

/**
 * Reads a clock time the way people type it. Without am or pm the hour is on the 24-hour clock
 * ("8" is 8:00 AM, "20:30" is 8:30 PM, "0:15" is 12:15 AM). With am or pm the hour must be 1..12,
 * and 12 am is midnight, 12 pm noon. Minutes, when given, are two digits, 00..59. Anything else
 * is an error; blank is empty (the caller decides what blank means).
 */
export function parseClockTime(input: string): ClockParse {
  const s = (input ?? '').trim().toLowerCase().replace(/\./g, (m, i: number, all: string) => {
    // "a.m." and "p.m." lose their dots; a dot between digits ("8.15") stays as the separator.
    return /\d/.test(all[i - 1] ?? '') && /\d/.test(all[i + 1] ?? '') ? m : ''
  })
  if (s === '') return { kind: 'empty' }
  if (s === 'noon') return { kind: 'value', minutes: 720, meridiem: true, ambiguous: false }
  if (s === 'midnight') return { kind: 'value', minutes: 0, meridiem: true, ambiguous: false }
  const m = CLOCK_HM.exec(s) ?? CLOCK_DIGITS.exec(s)
  if (!m) return { kind: 'error' }
  let hour = Number(m[1])
  const minute = m[2] === undefined ? 0 : Number(m[2])
  const suffix = m[3]
  if (minute > 59) return { kind: 'error' }
  if (suffix === undefined) {
    if (hour > 23) return { kind: 'error' }
    // A leading zero ("07:00", "0830") or the h form ("9h30", "21h30") is the 24-hour clock
    // written out: not ambiguous.
    const ambiguous = hour >= 1 && hour <= 12 && !m[1].startsWith('0') && !s.includes('h')
    return { kind: 'value', minutes: hour * 60 + minute, meridiem: false, ambiguous }
  }
  if (hour < 1 || hour > 12) return { kind: 'error' }
  const pm = suffix.startsWith('p')
  if (hour === 12) hour = 0
  if (pm) hour += 12
  return { kind: 'value', minutes: hour * 60 + minute, meridiem: true, ambiguous: false }
}
