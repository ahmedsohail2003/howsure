// spec.md > Maths Core: Number Parsing; prd.md > Calorie Input Rules.
import { describe, expect, it } from 'vitest'
import { PARSE_ERROR_MESSAGE, parseAmount } from '../parse'

describe('parseAmount', () => {
  it.each([
    ['1,501', 1501],
    ['12,345', 12345],
    ['1,234,567', 1234567],
    ['12,345.5', 12345.5],
    ['13,9', 13.9],
    ['13,95', 13.95],
    ['1501', 1501],
    ['13.9', 13.9],
    ['  42  ', 42],
  ])('"%s" is %d', (input, value) => {
    expect(parseAmount(input)).toEqual({ kind: 'value', value })
  })

  it('"0" is a valid zero, distinct from blank', () => {
    expect(parseAmount('0')).toEqual({ kind: 'value', value: 0 })
    expect(parseAmount('')).not.toEqual(parseAmount('0'))
  })

  it.each(['', '   ', '\t'])('blank %j is unknown, never 0', (input) => {
    expect(parseAmount(input)).toEqual({ kind: 'unknown' })
  })

  it.each(['abc', '-50', '12a', '1,5012', '1.501,5', '1 501', '1,2,3', '.5', '5.', '+5', '1e3'])(
    '"%s" is an error with a plain message',
    (input) => {
      const r = parseAmount(input)
      expect(r.kind).toBe('error')
      if (r.kind === 'error') expect(r.message).toBe(PARSE_ERROR_MESSAGE)
    },
  )

  // checklist.md slice 3 Build: the edge cases the Log a meal sheet relies on, side by side.
  it.each([
    ['1,501', { kind: 'value', value: 1501 }],
    ['13,9', { kind: 'value', value: 13.9 }],
    ['', { kind: 'unknown' }],
    ['abc', { kind: 'error', message: 'Use digits, e.g. 1501 or 13.9' }],
    ['-50', { kind: 'error', message: 'Use digits, e.g. 1501 or 13.9' }],
    ['0', { kind: 'value', value: 0 }],
  ] as const)('slice 3 edge case %j', (input, expected) => {
    expect(parseAmount(input)).toEqual(expected)
  })

  it('the message says what to type', () => {
    expect(PARSE_ERROR_MESSAGE).toBe('Use digits, e.g. 1501 or 13.9')
  })
})
