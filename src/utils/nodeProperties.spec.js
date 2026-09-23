import { describe, expect, it } from 'vitest'
import payload from '../../public/payload.json'
import { normalizePayload } from './graph'
import { getNodeProperties } from './nodeProperties'

const fromPayload = (id) => normalizePayload(payload).find((node) => node.id === String(id))

const IMAGE_URL =
  'https://fastly.picsum.photos/id/396/536/354.jpg?hmac=GmUosOuXb6nGkFhmTE-83i0ciQcaleMyvIyqzeFbW58'

describe('getNodeProperties', () => {
  describe('a trigger', () => {
    it('shows the event it listens for, and whether it runs once per contact', () => {
      expect(getNodeProperties(fromPayload(1))).toEqual([
        { kind: 'text', label: 'Event', value: 'Conversation Opened' },
        { kind: 'flag', label: 'Once per contact', value: false },
      ])
    })

    it('falls back to the raw identifier for an event with no label yet', () => {
      const node = { type: 'trigger', data: { type: 'messageReceived' } }

      expect(getNodeProperties(node)[0]).toEqual({
        kind: 'text',
        label: 'Event',
        value: 'messageReceived',
      })
    })

    it('reads its own labels only, not what every object inherits', () => {
      const node = { type: 'trigger', data: { type: 'constructor' } }

      expect(getNodeProperties(node)[0].value).toBe('constructor')
    })

    it('leaves the event out when the payload has none', () => {
      const node = { type: 'trigger', data: { oncePerContact: true } }

      expect(getNodeProperties(node)).toEqual([
        { kind: 'flag', label: 'Once per contact', value: true },
      ])
    })
  })

  describe('a send message', () => {
    it('lists its parts in the order they are sent', () => {
      expect(getNodeProperties(fromPayload('b0653a'))).toEqual([
        { kind: 'text', label: 'Message', value: 'Hello there\n\nwelcome to the chat!' },
        {
          kind: 'attachment',
          label: 'Attachment',
          url: IMAGE_URL,
          name: '354.jpg',
          isImage: true,
        },
      ])
    })

    it('recognises an attachment that is not an image', () => {
      const node = {
        type: 'sendMessage',
        data: { payload: [{ type: 'attachment', attachment: 'https://files.test/terms.pdf' }] },
      }

      expect(getNodeProperties(node)).toEqual([
        {
          kind: 'attachment',
          label: 'Attachment',
          url: 'https://files.test/terms.pdf',
          name: 'terms.pdf',
          isImage: false,
        },
      ])
    })

    it('ignores parts with nothing in them', () => {
      const node = {
        type: 'sendMessage',
        data: {
          payload: [
            { type: 'text', text: '   ' },
            { type: 'attachment' },
            null,
            { type: 'text', text: 'Still here' },
          ],
        },
      }

      expect(getNodeProperties(node)).toEqual([
        { kind: 'text', label: 'Message', value: 'Still here' },
      ])
    })

    it.each([
      ['no payload', { type: 'sendMessage', data: {} }],
      ['a payload that is not a list', { type: 'sendMessage', data: { payload: 'hello' } }],
      ['no data at all', { type: 'sendMessage' }],
    ])('has nothing to show with %s', (_, node) => {
      expect(getNodeProperties(node)).toEqual([])
    })
  })

  it('shows the comment of an add comment node', () => {
    expect(getNodeProperties(fromPayload('e879e4'))).toEqual([
      { kind: 'text', label: 'Comment', value: 'User message during off hours' },
    ])
  })

  describe('business hours', () => {
    it('shows the time zone and every day of the week', () => {
      const [timezone, schedule] = getNodeProperties(fromPayload('d09c08'))

      expect(timezone).toEqual({ kind: 'text', label: 'Time zone', value: 'UTC' })
      expect(schedule.kind).toBe('schedule')
      expect(schedule.days).toHaveLength(7)
      expect(schedule.days[0]).toEqual({
        day: 'mon',
        label: 'Monday',
        startTime: '09:00',
        endTime: '17:00',
      })
    })

    it('states the days it is closed rather than leaving them out', () => {
      const node = {
        type: 'dateTime',
        data: {
          action: 'businessHours',
          times: [{ day: 'mon', startTime: '09:00', endTime: '17:00' }],
        },
      }

      const [, schedule] = getNodeProperties(node)

      expect(schedule.days.map((day) => day.startTime)).toEqual([
        '09:00',
        null,
        null,
        null,
        null,
        null,
        null,
      ])
    })

    it('treats a day with only one end of its hours as closed', () => {
      const node = {
        type: 'dateTime',
        data: { action: 'businessHours', times: [{ day: 'mon', startTime: '09:00' }] },
      }

      const [, schedule] = getNodeProperties(node)

      expect(schedule.days[0]).toEqual({
        day: 'mon',
        label: 'Monday',
        startTime: null,
        endTime: null,
      })
    })

    it('falls back to UTC when the node has no time zone', () => {
      const node = { type: 'dateTime', data: { action: 'businessHours' } }

      expect(getNodeProperties(node)[0].value).toBe('UTC')
    })

    it('keeps the times exactly as stored, in the node’s own time zone', () => {
      const node = {
        type: 'dateTime',
        data: {
          action: 'businessHours',
          timezone: 'Asia/Kuala_Lumpur',
          times: [{ day: 'sun', startTime: '10:30', endTime: '14:45' }],
        },
      }

      const [timezone, schedule] = getNodeProperties(node)

      expect(timezone.value).toBe('Asia/Kuala_Lumpur')
      expect(schedule.days.at(-1)).toEqual({
        day: 'sun',
        label: 'Sunday',
        startTime: '10:30',
        endTime: '14:45',
      })
    })
  })

  describe('the description the user wrote', () => {
    it('comes first, before what the kind carries', () => {
      const node = {
        type: 'addComment',
        data: { comment: 'Noted', description: 'Why this step exists' },
      }

      expect(getNodeProperties(node)).toEqual([
        { kind: 'text', label: 'Description', value: 'Why this step exists' },
        { kind: 'text', label: 'Comment', value: 'Noted' },
      ])
    })

    it('is left out when it is blank', () => {
      const node = { type: 'addComment', data: { comment: 'Noted', description: '  ' } }

      expect(getNodeProperties(node)).toHaveLength(1)
    })
  })

  it.each([
    ['success', fromPayload('161f52')],
    ['failure', fromPayload('28c4b9')],
    ['unknown', { type: 'webhook', data: { url: 'https://example.test' } }],
    ['nothing', null],
  ])('has no properties for %s, which is why it has no drawer', (_, node) => {
    expect(getNodeProperties(node)).toEqual([])
  })
})
