// Build-out item 2.10: the guest name (spec.md > Maths Core: Plates and Gamer Tags; prd.md >
// Guest Profile and Gamer-Tag Name). The generator takes its random source as an argument, so
// every name here is fixed by the numbers fed to it.
import { describe, expect, it } from 'vitest'
import { wordRuleHits } from '../../../tests/wordRules'
import {
  anotherGamerTag,
  checkName,
  cryptoRandomInt,
  isGamerTag,
  NAME_MAX,
  newGamerTag,
  SKIPPED_ENDINGS,
  WORD_PAIRS,
  WORDS_MAX,
  usableName,
  type RandomInt,
} from '../gamertag'
import { ADJECTIVES, AWKWARD_PAIRS, NOUNS } from '../words'

/** A random source that returns the given numbers in turn (each must be below the n asked for). */
function seq(...values: number[]): RandomInt {
  let i = 0
  return (n) => {
    const v = values[i++ % values.length]!
    if (v >= n) throw new Error(`test: ${v} is not below ${n}`)
    return v
  }
}

/** A small seeded generator (mulberry32), for many names that are the same on every run. */
function seeded(seed: number): RandomInt {
  let a = seed >>> 0
  return (n) => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n)
  }
}

const TAG = /^[A-Z][a-z]+[A-Z][a-z]+#\d{4}$/

/**
 * What a generated name must never show, anywhere in a word or across the join of a pair, in any
 * case. Lower case. Kept here, with the test, as the generator's words are chosen by hand.
 */
const NEVER_INSIDE: readonly string[] = [
  // Crude: sexual and bodily words, and swearing.
  'ass', 'arse', 'anal', 'anus', 'bum', 'butt', 'boob', 'tit', 'cock', 'dick', 'penis', 'pussy',
  'cunt', 'twat', 'clit', 'cum', 'sperm', 'jizz', 'fuck', 'fuk', 'shit', 'piss', 'pee', 'poo',
  'turd', 'crap', 'fart', 'wank', 'porn', 'sex', 'nude', 'slut', 'whore', 'hoe', 'skank', 'bitch',
  'bastard', 'bollock', 'prick', 'knob', 'horny', 'milf', 'thot', 'hump', 'orgasm', 'dildo',
  'pedo', 'paedo', 'incest',
  // Hateful: slurs, hate groups and harm.
  'nigg', 'negro', 'coon', 'spic', 'kike', 'chink', 'gook', 'paki', 'wog', 'jap', 'jew', 'fag',
  'dyke', 'homo', 'tranny', 'retard', 'tard', 'spaz', 'gimp', 'nazi', 'kkk', 'hitler', 'rape',
  'kill', 'murder', 'lynch', 'hate', 'slave', 'jihad', 'isis', 'gas', 'noose', 'suicid',
  // Awkward in a food and weight tracker: a comment on the body, appetite, illness or diet, a
  // food that reads as junk or as a rude second meaning, or a drug.
  'fat', 'thin', 'skinny', 'chubby', 'plump', 'heavy', 'tiny', 'huge', 'slim', 'bulky', 'greedy',
  'hungry', 'starv', 'stuff', 'lazy', 'dumb', 'stupid', 'ugly', 'toxic', 'diet', 'junk', 'binge',
  'purge', 'calor', 'weigh', 'belly', 'pig', 'whale', 'lard', 'sugar', 'candy', 'cookie', 'cake',
  'donut', 'fries', 'burger', 'bacon', 'sausage', 'wiener', 'cherry', 'peach', 'melon', 'banana',
  'plum', 'muffin', 'juicy', 'saucy', 'spicy', 'frisky', 'naughty', 'cheeky', 'sweet', 'vomit',
  'puke', 'sick', 'dead', 'die', 'drug', 'weed', 'meth', 'crack',
]

/**
 * Words a generated name must never have as one of its two words, though they sit inside fine
 * words ("pea" in "Pear", "leek" in "Sleek", "nut" in "Walnut"). Some read badly aloud: "Pea"
 * (pee), "Leek" (leak), "Pecan" (pee-can), "Wee". Lower case.
 */
const NEVER_A_WORD: readonly string[] = ['pea', 'leek', 'pecan', 'wee', 'nut', 'bun', 'gut', 'big', 'hot', 'ill', 'cow', 'sow', 'hog', 'lean', 'wild']

/**
 * Hate and joke codes the 4 digits must never be (the guidance's own examples, which the
 * generator's SKIPPED_ENDINGS must hold).
 */
const NEVER_DIGITS: readonly string[] = ['1488', '0088', '0014', '0069', '6969', '0420', '8008']

describe('the word lists', () => {
  it('hold about 60 adjectives and 60 nouns, each a capitalised word of 3 to 7 letters, with no repeats', () => {
    expect(ADJECTIVES.length).toBeGreaterThanOrEqual(55)
    expect(NOUNS.length).toBeGreaterThanOrEqual(55)
    for (const w of [...ADJECTIVES, ...NOUNS]) expect(w).toMatch(/^[A-Z][a-z]{2,6}$/)
    expect(new Set(ADJECTIVES).size).toBe(ADJECTIVES.length)
    expect(new Set(NOUNS).size).toBe(NOUNS.length)
    // A word in both lists could make "OliveOlive".
    expect(ADJECTIVES.filter((a) => NOUNS.includes(a))).toEqual([])
  })

  it('every adjective has nouns short enough to pair with it, so every word can come up', () => {
    for (const a of ADJECTIVES) expect(WORD_PAIRS.some(([x]) => x === a)).toBe(true)
    for (const n of NOUNS) expect(WORD_PAIRS.some(([, y]) => y === n)).toBe(true)
  })

  it('every pair the generator can make: no crude, hateful or awkward word in either word or across the join, and at most 11 letters', () => {
    // Every adjective with every noun, so a pair left out by the length rule or AWKWARD_PAIRS is
    // also checked to be one the generator really never makes.
    let made = 0
    const hits: string[] = []
    for (const a of ADJECTIVES) {
      for (const n of NOUNS) {
        const pair = `${a}${n}`
        const inList = WORD_PAIRS.some(([x, y]) => x === a && y === n)
        if (a.length + n.length > WORDS_MAX || AWKWARD_PAIRS.includes(pair)) {
          expect(inList, pair).toBe(false)
          continue
        }
        expect(inList, pair).toBe(true)
        made++
        const lower = pair.toLowerCase()
        for (const bad of NEVER_INSIDE) if (lower.includes(bad)) hits.push(`${pair}: ${bad}`)
        for (const w of [a, n]) if (NEVER_A_WORD.includes(w.toLowerCase())) hits.push(`${pair}: ${w}`)
        expect(pair.length, pair).toBeLessThanOrEqual(WORDS_MAX)
      }
    }
    expect(hits).toEqual([])
    expect(made).toBe(WORD_PAIRS.length)
    expect(made).toBeGreaterThan(2500)
  })

  it('the check would catch a crude word across the join, so the pairs it keeps out are kept out', () => {
    // These pairs spell a slur or a crude word across the join; AWKWARD_PAIRS keeps them out.
    for (const [pair, bad] of [['SteadyKefir', 'dyke'], ['TidyKefir', 'dyke'], ['ReadyKefir', 'dyke'], ['SmoothOtter', 'thot']] as const) {
      expect(pair.toLowerCase()).toContain(bad)
      expect(NEVER_INSIDE).toContain(bad)
      expect(AWKWARD_PAIRS).toContain(pair)
    }
    // "SilverFox" is a slang phrase.
    expect(AWKWARD_PAIRS).toContain('SilverFox')
    const made = WORD_PAIRS.map(([a, n]) => `${a}${n}`)
    expect(made.filter((p) => AWKWARD_PAIRS.includes(p))).toEqual([])
    // Each word is still used with other partners.
    expect(made).toContain('SilverOtter')
    expect(made).toContain('SwiftFox')
    expect(made).toContain('BraveKefir')
  })

  it('no word sounds like a rude or bodily word read aloud ("Pea", "Leek", "Pecan")', () => {
    for (const w of ['Pea', 'Leek', 'Pecan', 'Wee']) {
      expect(NOUNS).not.toContain(w)
      expect(ADJECTIVES).not.toContain(w)
    }
  })

  it('every word passes the copy word rules', () => {
    const text = [...ADJECTIVES, ...NOUNS].join(' ')
    expect(wordRuleHits(text)).toEqual([])
    // And none says "sure", "safe", "toxic" or "harmful", which HowSure's own text avoids.
    for (const w of [...ADJECTIVES, ...NOUNS]) expect(w.toLowerCase()).not.toMatch(/sure|safe|toxic|harm/)
  })

  it('the lists in this test are lower-case letters only, so the check is case-blind', () => {
    for (const w of [...NEVER_INSIDE, ...NEVER_A_WORD]) expect(w).toMatch(/^[a-z]+$/)
  })
})

describe('newGamerTag', () => {
  it('builds an adjective, a noun, "#" and 4 digits from the random source', () => {
    // Pair 0 is the first adjective with the first noun that fits; 4821 is the digits.
    expect(WORD_PAIRS[0]).toEqual(['Brave', 'Kefir'])
    expect(newGamerTag(seq(0, 4821))).toBe('BraveKefir#4821')
  })

  it('pads the digits to 4, and reaches the last pair', () => {
    expect(newGamerTag(seq(0, 7))).toBe('BraveKefir#0007')
    const [a, n] = WORD_PAIRS[WORD_PAIRS.length - 1]!
    expect(newGamerTag(seq(WORD_PAIRS.length - 1, 9999))).toBe(`${a}${n}#9999`)
  })

  it('always matches the pattern and is at most 16 characters, over many names', () => {
    const rand = seeded(2026)
    for (let i = 0; i < 5000; i++) {
      const tag = newGamerTag(rand)
      expect(tag).toMatch(TAG)
      expect(tag.length).toBeLessThanOrEqual(NAME_MAX)
      expect(isGamerTag(tag)).toBe(true)
    }
  })

  it('the longest possible name is 16 characters', () => {
    const longest = Math.max(...WORD_PAIRS.map(([a, n]) => a.length + n.length))
    expect(longest).toBe(WORDS_MAX)
    expect(longest + '#0000'.length).toBe(NAME_MAX)
  })

  it('uses crypto by default, giving whole numbers in range', () => {
    for (let i = 0; i < 200; i++) {
      const v = cryptoRandomInt(7)
      expect(Number.isInteger(v) && v >= 0 && v < 7).toBe(true)
    }
    expect(newGamerTag()).toMatch(TAG)
    expect(() => cryptoRandomInt(0)).toThrow()
  })
})

describe('newGamerTag skips digits that are a hate or joke code', () => {
  it('holds the explicit codes, each 4 digits', () => {
    for (const code of NEVER_DIGITS) expect(SKIPPED_ENDINGS).toContain(code)
    for (const code of SKIPPED_ENDINGS) expect(code).toMatch(/^\d{4}$/)
    expect(new Set(SKIPPED_ENDINGS).size).toBe(SKIPPED_ENDINGS.length)
    // Short and explicit.
    expect(SKIPPED_ENDINGS.length).toBeLessThanOrEqual(20)
  })

  it('each code forced through the random source is thrown away, and the next draw is used', () => {
    for (const code of SKIPPED_ENDINGS) {
      expect(newGamerTag(seq(0, Number(code), 0, 4821)), code).toBe('BraveKefir#4821')
    }
  })

  it('keeps ordinary digits next to a code ("1487", "0089")', () => {
    expect(newGamerTag(seq(0, 1487))).toBe('BraveKefir#1487')
    expect(newGamerTag(seq(0, 89))).toBe('BraveKefir#0089')
  })

  it('never shows a code over many names', () => {
    const rand = seeded(88)
    for (let i = 0; i < 5000; i++) expect(SKIPPED_ENDINGS).not.toContain(newGamerTag(rand).slice(-4))
  })
})

describe('anotherGamerTag ("Reroll")', () => {
  it('never gives the same name back', () => {
    // The first draw repeats the current name; the next one is used.
    expect(anotherGamerTag('BraveKefir#4821', seq(0, 4821, 0, 4822))).toBe('BraveKefir#4822')
  })
})

describe('isGamerTag', () => {
  it('knows a generated name from a typed or imported one', () => {
    expect(isGamerTag('BraveKefir#4821')).toBe(true)
    expect(isGamerTag('Sam')).toBe(false)
    expect(isGamerTag('Sam2026')).toBe(false)
    // The pattern alone is not enough: the words must be on the lists.
    expect(isGamerTag('LoudPizza#1234')).toBe(false)
    expect(isGamerTag('BraveKefir#482')).toBe(false)
  })
})

describe('checkName (Rename): 1 to 16 letters or digits, trimmed', () => {
  it('accepts letters and digits up to 16 characters, trimmed', () => {
    expect(checkName('Sam2026')).toEqual({ ok: true, name: 'Sam2026' })
    expect(checkName('  Sam2026  ')).toEqual({ ok: true, name: 'Sam2026' })
    expect(checkName('a'.repeat(16))).toEqual({ ok: true, name: 'a'.repeat(16) })
    expect(checkName('7')).toEqual({ ok: true, name: '7' })
    // Letters of any alphabet; an accent typed as two parts counts once.
    expect(checkName('Zoë')).toEqual({ ok: true, name: 'Zoë' })
    expect(checkName('Zoë')).toEqual({ ok: true, name: 'Zoë' })
  })

  it('takes any letters and digits, with no word list: the name is shown only to the person who typed it', () => {
    for (const name of ['Nazim', 'Nazia', 'Allcock', 'SamButt', 'Dick1950', 'Glass', 'Yamashita', 'Sam88']) {
      expect(checkName(name), name).toEqual({ ok: true, name })
    }
  })

  it('refuses an empty name, also one of spaces only', () => {
    expect(checkName('')).toEqual({ ok: false, problem: 'empty' })
    expect(checkName('   ')).toEqual({ ok: false, problem: 'empty' })
  })

  it('refuses a name over 16 characters, counting what is left after trimming', () => {
    expect(checkName('a'.repeat(17))).toEqual({ ok: false, problem: 'tooLong' })
    expect(checkName('SamLentilLover2026')).toEqual({ ok: false, problem: 'tooLong' })
    expect(checkName(` ${'a'.repeat(16)} `)).toEqual({ ok: true, name: 'a'.repeat(16) })
  })

  it('refuses spaces inside, "#" and other symbols', () => {
    // `bad` names the first character to take out, so the message can say which.
    expect(checkName('Sam Smith')).toEqual({ ok: false, problem: 'characters', bad: ' ' })
    expect(checkName('Sam\tSmith')).toEqual({ ok: false, problem: 'characters', bad: ' ' })
    expect(checkName('BraveKefir#4821')).toEqual({ ok: false, problem: 'characters', bad: '#' })
    expect(checkName('sam_2026')).toEqual({ ok: false, problem: 'characters', bad: '_' })
    expect(checkName('Sam!')).toEqual({ ok: false, problem: 'characters', bad: '!' })
  })

  it('refuses accents on their own, and characters that show nothing', () => {
    // Accents alone would draw as an empty-looking name in the header.
    expect(checkName('\u0301\u0301')).toEqual({ ok: false, problem: 'characters', bad: '\u25CC\u0301' })
    // A blank filler letter, and an invisible joiner inside a name.
    expect(checkName('\u3164\u3164')).toEqual({ ok: false, problem: 'characters', bad: 'hidden' })
    expect(checkName('Sa\u200Dm')).toEqual({ ok: false, problem: 'characters', bad: 'hidden' })
    // An accent on a letter is fine, typed as one character or two.
    expect(checkName('Zoe\u0308')).toEqual({ ok: true, name: 'Zoë' })
    // Marks that only change how the letter before is drawn would make "Sam" look like "Sam".
    for (const mark of ['\uFE0F', '\uFE00', '\u034F', '\u180B', '\u{E0100}']) {
      expect(checkName(`Sam${mark}`), mark.codePointAt(0)!.toString(16)).toEqual({ ok: false, problem: 'characters', bad: 'hidden' })
    }
    expect(checkName('Sa\u2800m')).toEqual({ ok: false, problem: 'characters', bad: 'hidden' })
    // A private-use character draws as a box, so the message shows it as it is, not as hidden.
    expect(checkName('Sa\uE000m')).toEqual({ ok: false, problem: 'characters', bad: '\uE000' })
  })

  it('checks length before the characters, so a long name with a space says it is too long', () => {
    expect(checkName('a very long name indeed')).toEqual({ ok: false, problem: 'tooLong' })
  })
})

describe('usableName (an imported file\'s own name)', () => {
  it('takes a generated name or one Rename would take unchanged, and nothing else', () => {
    expect(usableName('CalmLentil#3108')).toBe('CalmLentil#3108')
    expect(usableName('Sam2026')).toBe('Sam2026')
    expect(usableName('Zoë')).toBe('Zoë')
    for (const bad of ['', ' Sam', 'Sam ', 'SamTheLentilLover', 'Sam 2026', 'Sam#2026', 'Sam!']) {
      expect(usableName(bad), bad).toBeNull()
    }
  })

  it('keeps a name shaped like a generated one whose words are not on this version\'s lists, as the lists change', () => {
    // "Pecan" was on the noun list once; "LoudPizza" never was.
    expect(NOUNS).not.toContain('Pecan')
    expect(usableName('BravePecan#1234')).toBe('BravePecan#1234')
    expect(usableName('LoudPizza#1234')).toBe('LoudPizza#1234')
    // The shape alone is not enough: three words, too long, or 3 digits, is not a generated name.
    expect(usableName('BraveLongWord#1234')).toBeNull()
    expect(usableName('BraveLentils#1234')).toBeNull()
    expect(usableName('BraveKefir#482')).toBeNull()
  })

  it('keeps a name written with a separate accent mark, in its composed form', () => {
    const decomposed = 'Zoë'
    expect(decomposed).not.toBe('Zoë')
    expect(usableName(decomposed)).toBe('Zoë')
  })
})
