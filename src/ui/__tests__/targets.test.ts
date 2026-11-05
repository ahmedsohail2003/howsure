// Build-out item 1.3: the targets editor's parsing and checks (src/ui/targets.ts).
// Expected values are worked by hand from the typed text: "2,400" is 2 thousand 4 hundred,
// "13,9" is the decimal-comma form of 13.9 (spec.md > Maths Core: Number Parsing). Every log
// here is the fictional Sam.
import { describe, expect, it } from 'vitest'
import { emptyLog, type LogDoc } from '../../store/log'
import { copy } from '../copy'
import { checkTargets, fieldsFromTargets, parseTarget, withTargets, type TargetFields } from '../targets'

const blank: TargetFields = { kcal: '', protein: '', carbs: '', fat: '' }

describe('parseTarget', () => {
  it('reads plain, grouped and decimal-comma numbers', () => {
    expect(parseTarget('2400')).toEqual({ kind: 'value', value: 2400 })
    expect(parseTarget(' 2,400 ')).toEqual({ kind: 'value', value: 2400 })
    expect(parseTarget('62.5')).toEqual({ kind: 'value', value: 62.5 })
    expect(parseTarget('13,9')).toEqual({ kind: 'value', value: 13.9 })
  })

  it('treats a blank box as no target, never 0', () => {
    expect(parseTarget('')).toEqual({ kind: 'none' })
    expect(parseTarget('   ')).toEqual({ kind: 'none' })
  })

  it('refuses a negative number with its own plain message', () => {
    expect(parseTarget('-5')).toEqual({ kind: 'error', message: copy.targets.errors.negative })
    expect(parseTarget(' -2,400')).toEqual({ kind: 'error', message: copy.targets.errors.negative })
    expect(parseTarget('−130')).toEqual({ kind: 'error', message: copy.targets.errors.negative })
  })

  it('refuses 0, since a target of 0 means nothing (blank is how to say no target)', () => {
    expect(parseTarget('0')).toEqual({ kind: 'error', message: copy.targets.errors.zero })
    expect(parseTarget('0.0')).toEqual({ kind: 'error', message: copy.targets.errors.zero })
  })

  it('refuses anything that is not a plain number, with the shared parse message', () => {
    for (const text of ['abc', '12g', '1.2.3', '2 400', '1e3']) {
      expect(parseTarget(text), text).toEqual({ kind: 'error', message: copy.input.parseError })
    }
  })
})

describe('checkTargets', () => {
  it('collects the set targets and leaves blank ones out', () => {
    expect(checkTargets({ kcal: '2,200', protein: '120', carbs: '', fat: '70' })).toEqual({
      targets: { kcal: 2200, protein: 120, fat: 70 },
      errors: {},
    })
  })

  it('all blank is a valid "no targets" (an empty object, no zeros)', () => {
    expect(checkTargets(blank)).toEqual({ targets: {}, errors: {} })
  })

  it('blocks Save while any box has an error, and names each box', () => {
    const check = checkTargets({ kcal: '-1', protein: 'lots', carbs: '250', fat: '0' })
    expect(check.targets).toBeNull()
    expect(check.errors).toEqual({
      kcal: copy.targets.errors.negative,
      protein: copy.input.parseError,
      fat: copy.targets.errors.zero,
    })
  })
})

describe('fieldsFromTargets', () => {
  it('starts blank with no targets', () => {
    expect(fieldsFromTargets(undefined)).toEqual(blank)
    expect(fieldsFromTargets({})).toEqual(blank)
  })

  it("shows Sam's demo targets as plain digits, blank where none is set", () => {
    expect(fieldsFromTargets({ kcal: 2400, protein: 130 })).toEqual({ kcal: '2400', protein: '130', carbs: '', fat: '' })
    expect(fieldsFromTargets({ kcal: 2200, protein: 120, carbs: 250, fat: 62.5 })).toEqual({
      kcal: '2200',
      protein: '120',
      carbs: '250',
      fat: '62.5',
    })
  })

  it('round-trips through checkTargets', () => {
    const targets = { kcal: 2200, protein: 120, carbs: 250, fat: 62.5 }
    expect(checkTargets(fieldsFromTargets(targets)).targets).toEqual(targets)
  })
})

describe('withTargets', () => {
  const sam: LogDoc = {
    ...emptyLog(),
    profile: {
      name: 'Sam',
      kind: 'guest',
      // A key a later version might add, inside targets and beside them (profile is loose).
      targets: { kcal: 2200, protein: 120, carbs: 250, fat: 70, sugarG: 40 } as LogDoc['profile']['targets'],
      usualMealsPerDay: 3,
    } as LogDoc['profile'],
  }

  it('replaces the four targets and keeps every other key', () => {
    const next = withTargets(sam, { kcal: 2300, protein: 125 })
    expect(next.profile).toEqual({
      name: 'Sam',
      kind: 'guest',
      targets: { kcal: 2300, protein: 125, sugarG: 40 },
      usualMealsPerDay: 3,
    })
    expect(next.meals).toBe(sam.meals)
  })

  it('does not change the log passed in', () => {
    const before = structuredClone(sam)
    withTargets(sam, {})
    expect(sam).toEqual(before)
  })

  it('removes the targets key when nothing is left in it', () => {
    const plain: LogDoc = { ...emptyLog(), profile: { name: 'Sam', kind: 'guest', targets: { kcal: 2200 } } }
    const next = withTargets(plain, {})
    expect(next.profile).toEqual({ name: 'Sam', kind: 'guest' })
    expect('targets' in next.profile).toBe(false)
  })

  it('adds targets to a log that had none', () => {
    const next = withTargets(emptyLog(), { fat: 70 })
    expect(next.profile.targets).toEqual({ fat: 70 })
  })
})
