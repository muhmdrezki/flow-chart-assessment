import { afterEach, describe, expect, it, vi } from 'vitest'
import { getOffset, getTimezoneOptions } from './timezones'

// Mid-January, so a zone on summer time in July reads as its winter offset here.
const WINTER = new Date('2026-01-15T12:00:00Z')

const optionFor = (options, value) => options.find((option) => option.value === value)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getOffset', () => {
  it('spells out zero rather than leaving it as plain "GMT"', () => {
    expect(getOffset('UTC', WINTER)).toBe('GMT+00:00')
  })

  it('reads a zone ahead of GMT', () => {
    expect(getOffset('Asia/Kuala_Lumpur', WINTER)).toBe('GMT+08:00')
  })

  it('reads a zone behind GMT', () => {
    expect(getOffset('America/New_York', WINTER)).toBe('GMT-05:00')
  })

  it('reads a zone that is half an hour off', () => {
    expect(getOffset('Asia/Kolkata', WINTER)).toBe('GMT+05:30')
  })

  it('falls back rather than throwing on a zone the browser rejects', () => {
    expect(getOffset('Mars/Olympus', WINTER)).toBe('GMT+00:00')
  })
})

describe('getTimezoneOptions', () => {
  it('labels each zone as the mockup does', () => {
    const options = getTimezoneOptions({ now: WINTER })

    expect(optionFor(options, 'UTC')).toEqual({ value: 'UTC', label: '(GMT+00:00) UTC' })
  })

  it('offers the whole list the browser knows', () => {
    const options = getTimezoneOptions({ now: WINTER })

    expect(options.length).toBeGreaterThan(100)
    expect(optionFor(options, 'Asia/Kuala_Lumpur')).toBeDefined()
  })

  it('runs west to east, so the list reads in a sensible order', () => {
    const options = getTimezoneOptions({ now: WINTER })
    const positionOf = (value) => options.findIndex((option) => option.value === value)

    expect(positionOf('America/New_York')).toBeLessThan(positionOf('UTC'))
    expect(positionOf('UTC')).toBeLessThan(positionOf('Asia/Kuala_Lumpur'))
  })

  it('keeps a zone the flow already uses, so a select is never missing its own value', () => {
    vi.stubGlobal('Intl', { ...Intl, supportedValuesOf: undefined })

    const options = getTimezoneOptions({ include: ['Antarctica/Troll'], now: WINTER })

    // Both sit at GMT+00:00 in January, so the tie is broken by name.
    expect(options.map((option) => option.value)).toEqual(['Antarctica/Troll', 'UTC'])
  })

  it('still offers UTC on a browser that cannot list its zones', () => {
    vi.stubGlobal('Intl', {
      ...Intl,
      supportedValuesOf: () => {
        throw new TypeError('not supported')
      },
    })

    expect(getTimezoneOptions({ now: WINTER })).toEqual([
      { value: 'UTC', label: '(GMT+00:00) UTC' },
    ])
  })
})
