import { describe, expect, it } from 'vitest'
import {
  DAY_LABELS,
  DEFAULT_TIMEZONE,
  WEEK_DAYS,
  fromClockParts,
  isTimeString,
  toClockParts,
} from './businessHours'

/*
 * Opening hours as the payload stores them: wall-clock strings in the node's own timezone, never
 * converted. That decision is what makes "ends after it starts" a string comparison rather than
 * date arithmetic, and it is why these tests care so much about the exact "HH:mm" shape.
 *
 * The clock-part functions are the boundary with the date picker, which works in numbers. They are
 * the only translation in the app, so a round trip has to come back byte-identical.
 */
describe('WEEK_DAYS', () => {
  it('lists the payload day names in week order, starting on Monday', () => {
    expect(WEEK_DAYS).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })

  it('cannot be modified', () => {
    expect(Object.isFrozen(WEEK_DAYS)).toBe(true)
  })
})

describe('DAY_LABELS', () => {
  it('names every day the payload can use', () => {
    expect(WEEK_DAYS.map((day) => DAY_LABELS[day])).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ])
  })

  it('cannot be modified', () => {
    expect(Object.isFrozen(DAY_LABELS)).toBe(true)
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

  it.each([
    '24:00',
    '9:00',
    '09:5',
    '09:60',
    '0900',
    '09:00:00',
    ' 09:00',
    '09: 5',
    '0a:00',
    '-1:00',
    ':',
    '',
    'noon',
  ])('rejects %j', (value) => {
    expect(isTimeString(value)).toBe(false)
  })

  it.each([900, null, undefined, {}])('rejects non-strings (%j)', (value) => {
    expect(isTimeString(value)).toBe(false)
  })
})

describe('toClockParts', () => {
  it('splits a stored time into the parts the picker works in', () => {
    expect(toClockParts('09:30')).toEqual({ hours: 9, minutes: 30, seconds: 0 })
  })

  it('reads midnight as zero rather than as nothing', () => {
    expect(toClockParts('00:00')).toEqual({ hours: 0, minutes: 0, seconds: 0 })
  })

  it.each(['9:00', '', 'noon', null, undefined, 900])(
    'gives the picker nothing to show for %j',
    (value) => {
      expect(toClockParts(value)).toBeNull()
    },
  )
})

describe('fromClockParts', () => {
  it('writes the parts back the way the payload stores them', () => {
    expect(fromClockParts({ hours: 9, minutes: 30, seconds: 0 })).toBe('09:30')
  })

  it('pads a single digit, which the picker reports unpadded', () => {
    expect(fromClockParts({ hours: 8, minutes: 5, seconds: 0 })).toBe('08:05')
  })

  it('ignores the seconds, which these times do not have', () => {
    expect(fromClockParts({ hours: 17, minutes: 0, seconds: 45 })).toBe('17:00')
  })

  it.each([
    ['nothing', null],
    ['a cleared value', undefined],
    ['parts that are strings', { hours: '9', minutes: '30' }],
    ['half a time', { hours: 9 }],
  ])('returns an empty string for %s', (_, parts) => {
    expect(fromClockParts(parts)).toBe('')
  })
})

describe('a time through both', () => {
  it.each(['00:00', '09:00', '12:30', '23:59'])('comes back unchanged (%s)', (time) => {
    expect(fromClockParts(toClockParts(time))).toBe(time)
  })
})
