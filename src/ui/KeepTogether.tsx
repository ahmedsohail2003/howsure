// A line that may wrap, with one part ("Wed 11:10 PM", "7:20 AM") kept on one line, so a time
// never splits from its AM or PM (build-out item 2.2: the sleep section and the header's wake time).

import type { ReactNode } from 'react'
import { copy } from './copy'

/** Renders `text` with its last occurrence of `part` in a no-wrap span (.keep-together). */
export function KeepTogether({ text, part }: { text: string; part: string }) {
  const i = text.lastIndexOf(part)
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <span className="keep-together">{part}</span>
      {text.slice(i + part.length)}
    </>
  )
}

const WD = `(?:${copy.weekdays.join('|')})`
const MON = `(?:${[...new Set([...copy.monthsShort, ...copy.months])].join('|')})`
const TIME = `\\d{1,2}:\\d{2} (?:${copy.am}|${copy.pm})`

/** A counted phrase from copy ("3 days ago", "2 weigh-ins") as a pattern: its number becomes \\d+. */
function counted(phrase: (n: number) => string): string {
  // The plural first, so "2 weigh-ins" is taken whole rather than as "2 weigh-in".
  return [...new Set([phrase(2), phrase(1)])]
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\d+/, '\\d+'))
    .join('|')
}

/**
 * The pieces of a sentence that must not break inside, in the order they are tried at each place:
 * a weekday with its time ("Thu 7:20 AM"), a date with its weekday and year if any ("Sat 17 Oct",
 * "Sat 17 Oct 2025", "Wed Nov 4"; a line may break after the comma that follows it), a date
 * written YYYY-MM-DD (whose hyphens a browser may break at), a time ("11:10 PM"), a length
 * ("7 h 50 min", "40 min"), and a count with its noun where it wraps badly ("3 days ago",
 * "2 weigh-ins", build-out item 2.1b).
 */
const PIECES = new RegExp(
  [
    `${WD} ${TIME}`,
    `(?:${WD} )?\\d{1,2} ${MON}(?: \\d{4})?`,
    `${WD} ${MON} \\d{1,2}`,
    `\\d{4}-\\d{2}-\\d{2}`,
    TIME,
    `\\d+ h \\d+ min`,
    `\\d+ min`,
    counted(copy.header.daysAgo),
    counted(copy.privacy.weighIns),
  ].join('|'),
  'g',
)

/** The parts of `text` to keep on one line, in order, for tests. */
export function togetherPieces(text: string): string[] {
  return text.match(PIECES) ?? []
}

/**
 * Renders a message with every date, time and length in it kept on one line (.keep-together), so
 * "Thu 7:20 AM" never ends a line at "7:20" with "AM" on the next. The text itself is unchanged.
 */
export function TimesTogether({ text }: { text: string }) {
  const out: ReactNode[] = []
  let at = 0
  for (const m of text.matchAll(PIECES)) {
    const i = m.index ?? 0
    if (i > at) out.push(text.slice(at, i))
    out.push(
      <span key={i} className="keep-together">
        {m[0]}
      </span>,
    )
    at = i + m[0].length
  }
  if (at < text.length) out.push(text.slice(at))
  return <>{out}</>
}
