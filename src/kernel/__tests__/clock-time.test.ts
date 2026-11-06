// Build-out item 2.2: parseClockTime(), the one reader for typed clock times (the sleep and wake
// editor, the sleep buttons and Set wake time). Expected minutes worked out by hand:
// hour × 60 + minute, with 12 am = 0 and 12 pm = 720, pm adding 720 to 1–11.
import { describe, expect, it } from 'vitest'
import { parseClockTime } from '../parse'

function minutes(text: string): number | null {
  const r = parseClockTime(text)
  return r.kind === 'value' ? r.minutes : null
}

describe('parseClockTime', () => {
  it('a bare hour is the 24-hour clock: "8" is 8:00 AM (480), "20" is 8:00 PM (1200)', () => {
    expect(minutes('8')).toBe(480)
    expect(minutes('20')).toBe(1200)
    expect(minutes('0')).toBe(0)
    expect(minutes('23')).toBe(1380)
  })

  it('am and pm, in any spelling: 8am 480, "8 am" 480, "8 a.m." 480, 8p 1200, "8 PM" 1200', () => {
    expect(minutes('8am')).toBe(480)
    expect(minutes('8 am')).toBe(480)
    expect(minutes('8 a.m.')).toBe(480)
    expect(minutes('8a')).toBe(480)
    expect(minutes('8p')).toBe(1200)
    expect(minutes('8 PM')).toBe(1200)
    expect(minutes('  8pm  ')).toBe(1200)
  })

  it('hours and minutes: "8:15 pm" 1215, "8.15pm" 1215, "20:30" 1230, "20h30" 1230, "07:05" 425', () => {
    expect(minutes('8:15 pm')).toBe(1215)
    expect(minutes('8.15pm')).toBe(1215)
    expect(minutes('20:30')).toBe(1230)
    expect(minutes('20h30')).toBe(1230)
    expect(minutes('07:05')).toBe(425)
    expect(minutes('8:15 p.m.')).toBe(1215)
  })

  it('an hour with h and no minutes reads like the same hour with h30: "9h" 540, "9h30" 570, "21h" 1260', () => {
    expect(minutes('9h')).toBe(540)
    expect(minutes('9h30')).toBe(570)
    expect(minutes('21h')).toBe(1260)
    // The h form is 24-hour notation ("21h30" is the evening), so "9h" and "9h30" are not
    // ambiguous: no "type pm" tip, just the reading.
    expect(parseClockTime('9h')).toMatchObject({ ambiguous: false })
    expect(parseClockTime('9h30')).toMatchObject({ ambiguous: false })
    expect(parseClockTime('h')).toEqual({ kind: 'error' })
    expect(parseClockTime('9hh')).toEqual({ kind: 'error' })
  })

  it('three or four digits: "830" 510, "0830" 510, "2030" 1230, "1145pm" 1425', () => {
    expect(minutes('830')).toBe(510)
    expect(minutes('0830')).toBe(510)
    expect(minutes('2030')).toBe(1230)
    expect(minutes('1145pm')).toBe(1425)
  })

  it('12 am is midnight (0), 12 pm is noon (720); "noon" and "midnight" too', () => {
    expect(minutes('12am')).toBe(0)
    expect(minutes('12:30 am')).toBe(30)
    expect(minutes('12pm')).toBe(720)
    expect(minutes('12:45 pm')).toBe(765)
    expect(minutes('noon')).toBe(720)
    expect(minutes('Midnight')).toBe(0)
  })

  it('says when a bare hour from 1 to 12 could be read the other way', () => {
    expect(parseClockTime('8')).toEqual({ kind: 'value', minutes: 480, meridiem: false, ambiguous: true })
    expect(parseClockTime('12')).toEqual({ kind: 'value', minutes: 720, meridiem: false, ambiguous: true })
    expect(parseClockTime('8am')).toEqual({ kind: 'value', minutes: 480, meridiem: true, ambiguous: false })
    // The 24-hour clock written out, or past 12, is not ambiguous.
    expect(parseClockTime('20:30')).toMatchObject({ ambiguous: false })
    expect(parseClockTime('08:00')).toMatchObject({ ambiguous: false })
    expect(parseClockTime('0:15')).toMatchObject({ minutes: 15, ambiguous: false })
  })

  it('blank is empty; anything else that is not a clock time is an error', () => {
    expect(parseClockTime('')).toEqual({ kind: 'empty' })
    expect(parseClockTime('   ')).toEqual({ kind: 'empty' })
    for (const bad of ['24', '24:00', '8:60', '8:5', '13pm', '0am', '0:30 pm', 'eight', '8 o', '-8', '8:15:30', '12345', 'am']) {
      expect(parseClockTime(bad), bad).toEqual({ kind: 'error' })
    }
  })
})
