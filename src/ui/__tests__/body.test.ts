// Build-out item 2.5b: the Body details form (body.ts) and how body details are kept in the log
// (profile.body, optional, no format version bump). Sam's numbers are made up.
import { describe, expect, it } from 'vitest'
import { demoDoc } from '../../kernel/__tests__/helpers'
import { demoChanges, pristineDemo } from '../../store/demoReset'
import { emptyLog, type LogDoc } from '../../store/log'
import { parseLogText, serializeLog } from '../../store/storage'
import { exportOwnLog, readImport } from '../../store/transfer'
import {
  bodySummary,
  checkBody,
  clearedFields,
  feetInches,
  fieldsFromBody,
  hasBody,
  heightText,
  keepAge,
  keepUnchanged,
  weightText,
  withBody,
  withHeightUnit,
  withWeightUnit,
  type BodyFields,
} from '../body'
import { changeLines } from '../ResetDemoSheet'

const TODAY = '2026-11-05'
const NOW = '2026-11-05T12:00:00-05:00'
const blank: BodyFields = fieldsFromBody(undefined, NOW)

describe('checkBody', () => {
  it('starts blank with the default activity, and saves nothing but that', () => {
    expect(blank).toEqual({
      age: '',
      sex: null,
      heightUnit: 'cm',
      heightCm: '',
      heightFt: '',
      heightIn: '',
      weightUnit: 'kg',
      weight: '',
      activity: 'sitting',
    })
    expect(checkBody(blank, TODAY)).toEqual({ body: { activity: 'sitting' }, errors: {} })
  })

  it('stores what is typed, with the date the age was typed', () => {
    const c = checkBody({ ...blank, age: '34', sex: 'female', heightCm: '168', weight: '64', activity: 'light' }, TODAY)
    expect(c).toEqual({
      body: { age: 34, ageSetOn: TODAY, sex: 'female', heightCm: 168, heightUnit: 'cm', weightKg: 64, weightUnit: 'kg', activity: 'light' },
      errors: {},
    })
  })

  it('converts feet and inches to cm and pounds to kg', () => {
    const c = checkBody({ ...blank, heightUnit: 'ftin', heightFt: '5', heightIn: '7', weightUnit: 'lb', weight: '150' }, TODAY)
    expect(c.body).toMatchObject({ heightCm: 170.18, heightUnit: 'ftin', weightKg: 68.039, weightUnit: 'lb' })
    // Feet alone is a whole number of feet.
    expect(checkBody({ ...blank, heightUnit: 'ftin', heightFt: '6' }, TODAY).body?.heightCm).toBe(182.88)
  })

  it('refuses ages outside 18–120 or not whole, with the reason', () => {
    for (const age of ['17', '121', '34.5', '-3', 'abc']) {
      expect(checkBody({ ...blank, age }, TODAY)).toEqual({
        body: null,
        errors: { age: 'Type an age from 18 to 120, in whole years. The equation is for adults.' },
      })
    }
  })

  it('refuses heights and weights outside a person’s range, in the unit typed', () => {
    expect(checkBody({ ...blank, heightCm: '99' }, TODAY).errors).toEqual({ heightCm: 'Type a height from 100 to 250 cm.' })
    expect(checkBody({ ...blank, heightUnit: 'ftin', heightFt: '9' }, TODAY).errors).toEqual({
      heightFt: 'Type a height from 3 ft 4 in to 8 ft 2 in.',
    })
    expect(checkBody({ ...blank, heightUnit: 'ftin', heightFt: '5', heightIn: '12' }, TODAY).errors).toEqual({
      heightIn: 'Inches run from 0 to 11.9.',
    })
    expect(checkBody({ ...blank, heightUnit: 'ftin', heightIn: '7' }, TODAY).errors).toEqual({
      heightFt: 'Type the feet too, or clear the inches.',
    })
    expect(checkBody({ ...blank, weight: '20' }, TODAY).errors).toEqual({ weight: 'Type a weight from 30 to 300 kg.' })
    expect(checkBody({ ...blank, weightUnit: 'lb', weight: '700' }, TODAY).errors).toEqual({ weight: 'Type a weight from 66 to 660 lb.' })
  })
})

describe('the form shows what is stored, the same way it was typed', () => {
  it('round-trips cm and kg, and feet, inches and pounds', () => {
    const metric = checkBody({ ...blank, age: '34', sex: 'female', heightCm: '168', weight: '64' }, TODAY).body!
    expect(fieldsFromBody(metric, NOW)).toMatchObject({ age: '34', sex: 'female', heightCm: '168', weight: '64', weightUnit: 'kg' })
    const imperial = checkBody({ ...blank, heightUnit: 'ftin', heightFt: '5', heightIn: '7', weightUnit: 'lb', weight: '150' }, TODAY).body!
    expect(fieldsFromBody(imperial, NOW)).toMatchObject({ heightUnit: 'ftin', heightFt: '5', heightIn: '7', weightUnit: 'lb', weight: '150' })
    expect(feetInches(182.88)).toEqual({ ft: 6, inches: 0 })
  })

  it('moves the age on by the years since it was typed', () => {
    expect(fieldsFromBody({ age: 34, ageSetOn: '2024-11-01' }, NOW).age).toBe('36')
  })

  it('keeps the stored age and its date when the age box was left as shown', () => {
    const previous = { age: 34, ageSetOn: '2024-11-01' }
    const next = checkBody({ ...fieldsFromBody(previous, NOW), weight: '64' }, TODAY).body!
    expect(keepAge(next, previous, '36', '36')).toMatchObject({ age: 34, ageSetOn: '2024-11-01', weightKg: 64 })
    expect(keepAge(next, previous, '36', '37')).toBe(next)
  })

  it('keeps a stored height and weight exactly when their boxes were left as shown (only the shown text is rounded)', () => {
    const cases = [
      { heightCm: 168.25, heightUnit: 'cm' as const, weightKg: 64.07, weightUnit: 'lb' as const },
      { heightCm: 168.28, heightUnit: 'ftin' as const, weightKg: 64.04, weightUnit: 'kg' as const },
    ]
    for (const previous of cases) {
      const start = fieldsFromBody(previous, NOW)
      // Only the activity changed.
      const fields = { ...start, activity: 'light' as const }
      const next = checkBody(fields, TODAY).body!
      expect(next.heightCm).not.toBe(previous.heightCm)
      expect(keepUnchanged(next, previous, start, fields)).toMatchObject({ ...previous, activity: 'light' })
    }
    // A box that was changed stores the new value.
    const previous = { heightCm: 168.25, heightUnit: 'cm' as const, weightKg: 64.07, weightUnit: 'kg' as const }
    const start = fieldsFromBody(previous, NOW)
    const edited = { ...start, heightCm: '170', weight: '65' }
    expect(keepUnchanged(checkBody(edited, TODAY).body!, previous, start, edited)).toMatchObject({ heightCm: 170, weightKg: 65 })
    // Switching a unit is a change: the box's amount is stored in the new unit.
    const lb = withWeightUnit(start, 'lb')
    expect(lb.weight).toBe('141.3')
    expect(keepUnchanged(checkBody(lb, TODAY).body!, previous, start, lb)).toMatchObject({ weightUnit: 'lb', weightKg: 64.093 })
    // Switching there and back with the box unchanged is not.
    const back = withWeightUnit(lb, 'kg')
    expect(keepUnchanged(checkBody(back, TODAY).body!, previous, start, back).weightKg).toBe(64.07)
    // A cleared box is still cleared.
    const cleared = { ...start, heightCm: '', weight: '' }
    const out = keepUnchanged(checkBody(cleared, TODAY).body!, previous, start, cleared)
    expect(out.heightCm).toBeUndefined()
    expect(out.weightKg).toBeUndefined()
  })

  it('clear all blanks every box and picks the default activity', () => {
    const full: BodyFields = { ...blank, age: '34', sex: 'male', heightCm: '180', weight: '80', activity: 'moderate' }
    expect(clearedFields(full)).toEqual({ ...blank })
  })

  it('writes values for the explanation and Profile and privacy', () => {
    expect(heightText(168, 'cm')).toBe('168 cm')
    expect(heightText(170.18, 'ftin')).toBe('5 ft 7 in')
    expect(weightText(64, 'kg')).toBe('64 kg')
    expect(weightText(68.039, 'lb')).toBe('150 lb')
    expect(bodySummary(undefined, NOW)).toBeNull()
    expect(bodySummary({ activity: 'sitting' }, NOW)).toBeNull()
    expect(bodySummary({ age: 34, sex: 'female', heightCm: 168, weightKg: 64 }, NOW)).toBe('age 34 · Female · 168 cm · 64 kg · Mostly sitting')
  })
})

describe('withBody: the log keeps body details in profile.body', () => {
  it('sets them, keeps keys a later version adds, and removes the key when nothing is left', () => {
    const doc = withBody(emptyLog(), { age: 34, sex: 'female', activity: 'sitting' })
    expect(doc.profile.body).toEqual({ age: 34, sex: 'female', activity: 'sitting' })
    const later = { ...doc, profile: { ...doc.profile, body: { ...doc.profile.body, laterKey: 1 } } } as LogDoc
    expect(withBody(later, { activity: 'light' }).profile.body).toEqual({ laterKey: 1, activity: 'light' })
    expect('body' in withBody(doc, { activity: 'sitting' }).profile).toBe(false)
    expect(hasBody(doc.profile.body)).toBe(true)
  })

  it('does not change the log passed in', () => {
    const doc = emptyLog()
    withBody(doc, { age: 40 })
    expect(doc.profile.body).toBeUndefined()
  })
})

describe('saved logs: optional, no format version bump, and in Export and Import', () => {
  const body = { age: 34, ageSetOn: TODAY, sex: 'unspecified' as const, heightCm: 170.18, heightUnit: 'ftin' as const, weightKg: 64, weightUnit: 'kg' as const, activity: 'light' as const }

  it('a log saved before body details loads unchanged', () => {
    const res = parseLogText(serializeLog(emptyLog()))
    expect(res.status).toBe('ok')
    if (res.status === 'ok') expect('body' in res.doc.profile).toBe(false)
  })

  it('round-trips through save, Export and Import', () => {
    const doc = withBody(emptyLog(), body)
    const res = parseLogText(serializeLog(doc))
    expect(res.status === 'ok' && res.doc.profile.body).toEqual(body)
    const read = readImport(exportOwnLog(doc, null, null))
    expect(read.status === 'ok' && read.doc.profile.body).toEqual(body)
  })

  it('refuses a body detail of the wrong kind rather than guessing', () => {
    const bad = JSON.parse(serializeLog(emptyLog()))
    bad.profile.body = { sex: 'other' }
    expect(parseLogText(JSON.stringify(bad)).status).toBe('unreadable')
  })
})

describe('Reset demo: Sam’s body details count as their own change', () => {
  it('names them in the confirmation', () => {
    const fresh = pristineDemo()
    const edited = withBody(fresh, { age: 34, sex: 'female', heightCm: 168, weightKg: 64 })
    const changes = demoChanges(edited, fresh)
    expect(changes.bodyChanged).toBe(true)
    expect(changes.otherChanged).toBe(false)
    expect(changeLines(changes)).toEqual(['Sam’s body details changed'])
    expect(demoChanges(demoDoc, fresh).bodyChanged).toBe(false)
  })
})

describe('switching a unit with an amount in the box', () => {
  const filled: BodyFields = { ...blank, age: '34', sex: 'female', heightCm: '168', weight: '64' }

  it('converts kg to lb and back, never reading 64 kg as 64 lb', () => {
    const lb = withWeightUnit(filled, 'lb')
    expect(lb.weightUnit).toBe('lb')
    expect(lb.weight).toBe('141.1')
    expect(checkBody(lb, TODAY).body?.weightKg).toBeCloseTo(64, 1)
    // Back with the box unchanged: the text typed comes back exactly.
    const kg = withWeightUnit(lb, 'kg')
    expect(kg.weight).toBe('64')
    expect(checkBody(kg, TODAY).body).toMatchObject({ weightKg: 64, weightUnit: 'kg' })
    // Changed after the switch: the new amount is converted instead.
    const edited = withWeightUnit({ ...lb, weight: '150' }, 'kg')
    expect(edited.weight).toBe('68')
    // From lb: 141 lb is 64 kg to one decimal.
    expect(withWeightUnit({ ...filled, weightUnit: 'lb', weight: '141' }, 'kg').weight).toBe('64')
  })

  it('leaves a blank or unreadable weight box blank, never holding a number in the wrong unit', () => {
    expect(withWeightUnit({ ...filled, weight: '' }, 'lb').weight).toBe('')
    expect(withWeightUnit({ ...filled, weight: 'abc' }, 'lb').weight).toBe('')
    expect(withWeightUnit(filled, 'kg')).toBe(filled)
  })

  it('converts cm to feet and inches and back, keeping the cm typed when the feet and inches were not changed', () => {
    const ftin = withHeightUnit(filled, 'ftin')
    expect(ftin).toMatchObject({ heightUnit: 'ftin', heightFt: '5', heightIn: '6.1' })
    expect(withHeightUnit(ftin, 'cm')).toMatchObject({ heightUnit: 'cm', heightCm: '168' })
    // A new height typed in feet and inches is carried into cm.
    const typed = withHeightUnit({ ...ftin, heightIn: '8' }, 'cm')
    expect(typed.heightCm).toBe('172.7')
    expect(checkBody(typed, TODAY).body).toMatchObject({ heightCm: 172.7, heightUnit: 'cm' })
    expect(withHeightUnit({ ...ftin, heightFt: '6', heightIn: '' }, 'cm').heightCm).toBe('182.9')
  })

  it('a new cm value typed before switching is the one carried over, not the stored height', () => {
    const stored = fieldsFromBody({ heightCm: 168, heightUnit: 'cm' }, NOW)
    const ftin = withHeightUnit({ ...stored, heightCm: '180' }, 'ftin')
    expect(ftin).toMatchObject({ heightFt: '5', heightIn: '10.9' })
    expect(checkBody(ftin, TODAY).body?.heightCm).toBeCloseTo(180, 0)
  })

  it('leaves blank or unreadable height boxes blank in the other unit', () => {
    expect(withHeightUnit({ ...filled, heightCm: '' }, 'ftin')).toMatchObject({ heightFt: '', heightIn: '' })
    expect(withHeightUnit({ ...filled, heightCm: 'tall' }, 'ftin')).toMatchObject({ heightFt: '', heightIn: '' })
    const ftin = { ...filled, heightUnit: 'ftin' as const, heightFt: '', heightIn: '7' }
    expect(withHeightUnit(ftin, 'cm').heightCm).toBe('')
    expect(withHeightUnit({ ...ftin, heightFt: '5', heightIn: 'x' }, 'cm').heightCm).toBe('')
  })

  it('never turns an amount the form refused into an accepted one in the other unit', () => {
    const ftin = { ...filled, heightUnit: 'ftin' as const, heightFt: '5', heightIn: '12' }
    expect(checkBody(ftin, TODAY).errors.heightIn).toBe('Inches run from 0 to 11.9.')
    expect(withHeightUnit(ftin, 'cm').heightCm).toBe('')
    expect(withHeightUnit({ ...ftin, heightFt: '9', heightIn: '0' }, 'cm').heightCm).toBe('')
    expect(withHeightUnit({ ...filled, heightCm: '300' }, 'ftin')).toMatchObject({ heightFt: '', heightIn: '' })
    // 29.95 kg is refused by the kg box; it does not become an accepted 66 lb.
    expect(checkBody({ ...filled, weight: '29.95' }, TODAY).errors.weight).toBeDefined()
    expect(withWeightUnit({ ...filled, weight: '29.95' }, 'lb').weight).toBe('')
  })
})

describe('the inches box', () => {
  it('accepts 0 to 11.9 inches, as its message says', () => {
    const f = (inches: string): BodyFields => ({ ...blank, heightUnit: 'ftin', heightFt: '5', heightIn: inches })
    expect(checkBody(f('11.9'), TODAY).errors).toEqual({})
    expect(checkBody(f('11.95'), TODAY).errors).toEqual({ heightIn: 'Inches run from 0 to 11.9.' })
    expect(checkBody(f('0'), TODAY).errors).toEqual({})
  })
})
