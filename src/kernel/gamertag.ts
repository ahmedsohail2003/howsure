// The guest name (spec.md > Maths Core: Plates and Gamer Tags; prd.md > Guest Profile and Gamer-Tag
// Name; build-out item 2.10). A new own log gets a readable random name: an adjective and a noun
// from words.ts, together at most 11 letters, then "#" and 4 random digits, 16 characters at most,
// as in "BraveKefir#4821". "Reroll" makes a new one. "Rename" takes a name the person types:
// trimmed, 1 to 16 letters or digits. The name is shown only to the person, on their own device,
// so a typed name is checked for its length and characters only.
// Pure: the random source is passed in (crypto.getRandomValues by default), so tests are
// deterministic. No React, no storage.

import { ADJECTIVES, AWKWARD_PAIRS, NOUNS } from './words'

/** The longest name, generated or typed. */
export const NAME_MAX = 16
/** The adjective and noun together, before "#" and the digits. */
export const WORDS_MAX = 11

/** A whole number from 0 to n − 1, chosen at random. */
export type RandomInt = (n: number) => number

/** crypto.getRandomValues, without the bias a plain modulo would give. */
export const cryptoRandomInt: RandomInt = (n) => {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new Error('HowSure: randomInt needs a whole number from 1 to 2^32')
  const limit = 2 ** 32 - (2 ** 32 % n)
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    const v = buf[0]!
    if (v < limit) return v % n
  }
}

/** Every adjective and noun pair that fits in WORDS_MAX letters, in list order, less the awkward pairs. */
export const WORD_PAIRS: readonly (readonly [string, string])[] = ADJECTIVES.flatMap((a) =>
  NOUNS.filter((n) => a.length + n.length <= WORDS_MAX && !AWKWARD_PAIRS.includes(`${a}${n}`)).map((n) => [a, n] as const),
)

/**
 * Endings a generated name never has, as the 4 digits it shows. Kept short and explicit:
 * - numbers used as hate symbols: 14 and 88 (and 1488 together), 18, 311 and 2316;
 * - numbers read as a joke or a provocation: 69, 6969, 420, 666, and 8008 ("BOOB" on a calculator).
 */
export const SKIPPED_ENDINGS: readonly string[] = [
  '0014',
  '0088',
  '1488',
  '0018',
  '0311',
  '2316',
  '0069',
  '6969',
  '0420',
  '0666',
  '8008',
]

/**
 * A new guest name such as "BraveKefir#4821": one pair chosen evenly from WORD_PAIRS, and 4 digits.
 * The words are clean by construction (the word-list test checks every pair). A draw whose digits
 * are one of SKIPPED_ENDINGS is thrown away and another made.
 */
export function newGamerTag(rand: RandomInt = cryptoRandomInt): string {
  for (;;) {
    const [adj, noun] = WORD_PAIRS[rand(WORD_PAIRS.length)]!
    const digits = String(rand(10000)).padStart(4, '0')
    if (!SKIPPED_ENDINGS.includes(digits)) return `${adj}${noun}#${digits}`
  }
}

/**
 * A new guest name that differs from `current` ("Reroll" never shows the same name again).
 * With about 3,000 pairs and 10,000 endings a repeat is rare; the tries are capped all the same.
 */
export function anotherGamerTag(current: string, rand: RandomInt = cryptoRandomInt): string {
  let next = newGamerTag(rand)
  for (let i = 0; i < 20 && next === current; i++) next = newGamerTag(rand)
  return next
}

/** The pattern a generated name has: two capitalised words, "#", 4 digits. */
const TAG_PATTERN = /^([A-Z][a-z]+)([A-Z][a-z]+)#(\d{4})$/

/** True when `name` is one the generator could have made (its words are on the lists). */
export function isGamerTag(name: string): boolean {
  const m = TAG_PATTERN.exec(name)
  if (!m) return false
  return name.length <= NAME_MAX && WORD_PAIRS.some(([a, n]) => a === m[1] && n === m[2])
}

/** Why a typed name can't be used. */
export type NameProblem = 'empty' | 'tooLong' | 'characters'

/**
 * `bad`: for 'characters', the first character that can't be used: " " for a space, "hidden" for
 * one that shows nothing (a control or format character, or a blank filler letter), and an accent
 * on its own is shown on a dotted circle ("◌́").
 */
export type NameCheck = { ok: true; name: string } | { ok: false; problem: NameProblem; bad?: string }

/**
 * Characters that draw nothing: the Hangul filler letters, the blank Braille pattern, and marks
 * that only change how the character before them is drawn (variation selectors, the combining
 * grapheme joiner, the Mongolian ones), which Unicode counts as accents. "Sam" with one of these
 * after it would look the same as "Sam".
 */
const DRAWS_NOTHING = /[\u115F\u1160\u3164\uFFA0\u2800\u034F\u180B-\u180F\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u

/** A character a name may hold at `i`: a letter or digit, or an accent on the one before it. */
function usable(c: string, i: number): boolean {
  if (DRAWS_NOTHING.test(c)) return false
  return /^[\p{L}\p{Nd}]$/u.test(c) || (i > 0 && /^\p{M}$/u.test(c))
}

/**
 * The character as the message names it. A control or format character, or one that draws
 * nothing, is "hidden"; a private-use or unassigned one is shown as it is, as the box it draws.
 */
function shown(c: string): string {
  if (/\s/u.test(c)) return ' '
  if (DRAWS_NOTHING.test(c) || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(c)) return 'hidden'
  if (/\p{M}/u.test(c)) return `\u25CC${c}`
  return c
}

/**
 * Rename's check. The name is trimmed (spaces at either end are dropped) and put in its composed
 * form, then it must be 1 to NAME_MAX letters or digits. An accent counts
 * only on a letter or digit, so a name can't be accents alone. Length counts code points after
 * composing: "Zoë" is 3, typed as one character or two, but an accent with no composed form (as
 * in many Devanagari names) counts as one more.
 */
export function checkName(typed: string): NameCheck {
  const name = typed.normalize('NFC').trim()
  if (name.length === 0) return { ok: false, problem: 'empty' }
  const chars = [...name]
  if (chars.length > NAME_MAX) return { ok: false, problem: 'tooLong' }
  const badAt = chars.findIndex((c, i) => !usable(c, i))
  if (badAt !== -1) return { ok: false, problem: 'characters', bad: shown(chars[badAt]!) }
  return { ok: true, name }
}

/**
 * The name to keep from an imported file, or null when it can't be used as it is (build-out item
 * 2.10: a hand-edited file can't bring in a name that is too long or holds symbols). Taken: a name
 * shaped like a generated one (two capitalised words, "#", 4 digits, at most NAME_MAX), even when
 * its words are not on this version's lists (they change: a name another version picked is still
 * kept); and a name Rename would take unchanged, comparing composed forms, so "Zoë" written as
 * "Zoe" and an accent mark is kept as "Zoë".
 */
export function usableName(name: string): string | null {
  if (TAG_PATTERN.test(name) && name.length <= NAME_MAX) return name
  const res = checkName(name)
  return res.ok && res.name === name.normalize('NFC') ? res.name : null
}
