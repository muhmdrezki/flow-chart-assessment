import { describe, expect, it } from 'vitest'
import payload from '../../public/payload.json'
import { findPayloadError } from './payloadValidation'

const validNode = (overrides = {}) => ({ id: 'a1', parentId: -1, type: 'trigger', ...overrides })
const errorFor = (overrides) => findPayloadError([validNode(overrides)])

/*
 * The payload arrives over the network, so it can be truncated, an error page, or JSON that simply
 * is not a flow. This is the gate that turns any of those into one clear failure before a single
 * node reaches the store — a half-valid flow rendering with nodes missing is far worse than an
 * error message saying the file could not be read.
 *
 * Each message names the node and the field, because the first person to read it is whoever is
 * looking at a blank screen wondering which part of the data is wrong.
 */
describe('findPayloadError', () => {
  it('accepts the real payload', () => {
    expect(findPayloadError(payload)).toBeNull()
  })

  it('accepts an empty flow', () => {
    expect(findPayloadError([])).toBeNull()
  })

  describe('shape of every node', () => {
    it.each([
      ['an object', {}],
      ['null', null],
      ['a string', 'nodes'],
    ])('rejects %s instead of an array', (_, raw) => {
      expect(findPayloadError(raw)).toBe('expected an array of nodes')
    })

    it.each([null, 'node', 42, ['a1']])('rejects a non-object item (%j)', (item) => {
      expect(findPayloadError([validNode(), item])).toBe('node at index 1 is not an object')
    })

    it.each([undefined, '', '   ', null, NaN, {}])('rejects an invalid id (%j)', (id) => {
      expect(errorFor({ id })).toBe('node at index 0 has an invalid id')
    })

    it('rejects duplicate ids, comparing numbers and strings alike', () => {
      const raw = [validNode({ id: 1 }), validNode({ id: '1', parentId: 1 })]
      expect(findPayloadError(raw)).toBe('duplicate node id "1"')
    })

    it.each([undefined, '', 7])('rejects an invalid type (%j)', (type) => {
      expect(errorFor({ type })).toBe('node "a1" has an invalid type')
    })

    it.each([undefined, null, '', {}])('rejects an invalid parentId (%j)', (parentId) => {
      expect(errorFor({ parentId })).toBe('node "a1" has an invalid parentId')
    })

    it('rejects a non-string name', () => {
      expect(errorFor({ name: 42 })).toBe('node "a1" has an invalid name')
    })

    it.each([null, [], 'data'])('rejects non-object data (%j)', (data) => {
      expect(errorFor({ data })).toBe('node "a1" has invalid data')
    })

    it('rejects a non-string data.type', () => {
      expect(errorFor({ data: { type: 5 } })).toBe('node "a1" has an invalid data.type')
    })

    it('rejects a non-string data.description', () => {
      expect(errorFor({ data: { description: 3 } })).toBe(
        'node "a1" has an invalid data.description',
      )
    })

    it('allows name, data and description to be absent', () => {
      expect(findPayloadError([{ id: 1, parentId: -1, type: 'trigger' }])).toBeNull()
    })

    it('accepts unknown node types, which render as "unknown"', () => {
      expect(errorFor({ type: 'webhook', data: { anything: [1, 2] } })).toBeNull()
    })
  })

  describe('sendMessage', () => {
    const message = (payload) => errorFor({ type: 'sendMessage', data: { payload } })

    it('accepts text and attachment items', () => {
      expect(
        message([
          { type: 'text', text: 'Hi' },
          { type: 'attachment', attachment: 'https://example.com/a.png' },
        ]),
      ).toBeNull()
    })

    it('accepts a missing or empty payload', () => {
      expect(errorFor({ type: 'sendMessage', data: {} })).toBeNull()
      expect(message([])).toBeNull()
    })

    it('rejects a payload that is not an array', () => {
      expect(message('Hi')).toBe('node "a1" has invalid data.payload')
    })

    it.each([null, 'Hi', ['text']])('rejects a non-object item (%j)', (item) => {
      expect(message([item])).toBe('node "a1" has invalid data.payload[0]')
    })

    it('rejects a text item without string text', () => {
      expect(message([{ type: 'text', text: 5 }])).toBe(
        'node "a1" has invalid data.payload[0].text',
      )
    })

    it('rejects an attachment item without a string attachment', () => {
      expect(message([{ type: 'text', text: 'ok' }, { type: 'attachment' }])).toBe(
        'node "a1" has invalid data.payload[1].attachment',
      )
    })

    it('rejects an item of unknown type', () => {
      expect(message([{ type: 'video', url: 'x' }])).toBe(
        'node "a1" has unknown data.payload[0].type',
      )
    })
  })

  describe('addComment', () => {
    it('accepts a string or missing comment', () => {
      expect(errorFor({ type: 'addComment', data: { comment: 'note' } })).toBeNull()
      expect(errorFor({ type: 'addComment', data: {} })).toBeNull()
    })

    it('rejects a non-string comment', () => {
      expect(errorFor({ type: 'addComment', data: { comment: 1 } })).toBe(
        'node "a1" has invalid data.comment',
      )
    })
  })

  describe('business hours', () => {
    const hours = (data) =>
      errorFor({ type: 'dateTime', data: { action: 'businessHours', ...data } })
    const monday = (overrides) => ({
      day: 'mon',
      startTime: '09:00',
      endTime: '17:00',
      ...overrides,
    })

    it('accepts valid times and timezone', () => {
      expect(hours({ times: [monday()], timezone: 'Asia/Jakarta' })).toBeNull()
    })

    it('accepts missing times and timezone', () => {
      expect(hours({})).toBeNull()
    })

    it('rejects a non-string timezone', () => {
      expect(hours({ timezone: 7 })).toBe('node "a1" has invalid data.timezone')
    })

    it('rejects times that are not an array', () => {
      expect(hours({ times: monday() })).toBe('node "a1" has invalid data.times')
    })

    it('rejects a non-object time', () => {
      expect(hours({ times: ['mon 09:00'] })).toBe('node "a1" has invalid data.times[0]')
    })

    it.each(['monday', 'Mon', '', undefined])('rejects an invalid day (%j)', (day) => {
      expect(hours({ times: [monday({ day })] })).toBe('node "a1" has invalid data.times[0].day')
    })

    it.each(['9:00', '24:00', '', undefined])('rejects an invalid startTime (%j)', (startTime) => {
      expect(hours({ times: [monday({ startTime })] })).toBe(
        'node "a1" has invalid data.times[0].startTime',
      )
    })

    it('rejects an invalid endTime', () => {
      expect(hours({ times: [monday(), monday({ day: 'tue', endTime: '5pm' })] })).toBe(
        'node "a1" has invalid data.times[1].endTime',
      )
    })

    it('ignores dateTime nodes with another action', () => {
      expect(errorFor({ type: 'dateTime', data: { action: 'dateRange', times: 'x' } })).toBeNull()
    })
  })
})
