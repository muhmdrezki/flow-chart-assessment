import { describe, expect, it } from 'vitest'
import { DEFAULT_TIMEZONE, WEEK_DAYS, isTimeString } from './businessHours'

describe('WEEK_DAYS', () => {
  it('lists the payload day names in week order, starting on Monday', () => {
    expect(WEEK_DAYS).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })

  it('cannot be modified', () => {
    expect(Object.isFrozen(WEEK_DAYS)).toBe(true)
  })
})

describe('DEFAULT_TIMEZONE', () => {
  it('is UTC', () => {
    expect(DEFAULT_TIMEZONE).toBe('UTC')
  })
})

describe('isTimeString', () => {
  it.each(['00:00', '09:00', '12:30', '23:59'])('accepts %s', (value) => {
    expect(isTimeString(value)).toBe(true)
  })

  it.each(['24:00', '9:00', '09:60', '0900', '09:00:00', ' 09:00', '', 'noon'])(
    'rejects %j',
    (value) => {
      expect(isTimeString(value)).toBe(false)
    },
  )

  it.each([900, null, undefined, {}])('rejects non-strings (%j)', (value) => {
    expect(isTimeString(value)).toBe(false)
  })
})
