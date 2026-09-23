import { describe, expect, it } from 'vitest'
import payload from '../../public/payload.json'
import { normalizePayload } from './graph'
import { getAttachmentName, getNodeText, getNodeTitle, trimText } from './nodeDescription'

/** What the card shows on its second line, as one string, which most of these tests care about. */
const summaryOf = (node) => getNodeText(node).summary.text

const byId = new Map(normalizePayload(payload).map((node) => [node.id, node]))
const message = (items, extra = {}) => ({ type: 'sendMessage', data: { payload: items, ...extra } })

describe('trimText', () => {
  it('trims surrounding whitespace', () => {
    expect(trimText('  Hello there  ')).toBe('Hello there')
  })

  it('keeps line breaks inside the text, since HTML collapses them when rendering', () => {
    expect(trimText('Hello there\n\nwelcome')).toBe('Hello there\n\nwelcome')
  })

  it('turns blank text into an empty string', () => {
    expect(trimText(' \n\t ')).toBe('')
  })

  it.each([undefined, null, 5, {}])('returns an empty string for non-strings (%j)', (value) => {
    expect(trimText(value)).toBe('')
  })
})

describe('getAttachmentName', () => {
  it('takes the file name from the payload attachment URL', () => {
    const url = byId.get('b0653a').data.payload[1].attachment
    expect(getAttachmentName(url)).toBe('354.jpg')
  })

  it('drops the query string and hash', () => {
    expect(getAttachmentName('https://cdn.example.com/files/report.pdf?v=2#page=3')).toBe(
      'report.pdf',
    )
  })

  it('decodes encoded names', () => {
    expect(getAttachmentName('https://cdn.example.com/My%20Photo.png')).toBe('My Photo.png')
  })

  it('ignores a trailing slash', () => {
    expect(getAttachmentName('https://cdn.example.com/folder/image.png/')).toBe('image.png')
  })

  it('handles values that are not absolute URLs', () => {
    expect(getAttachmentName('uploads/photo.jpg?x=1')).toBe('photo.jpg')
  })

  it('keeps a badly encoded name as it is', () => {
    expect(getAttachmentName('https://cdn.example.com/100%.png')).toBe('100%.png')
  })

  it('falls back to the raw value when it cannot be parsed', () => {
    expect(getAttachmentName('http://')).toBe('http://')
  })

  it('falls back to the raw value when there is no file name', () => {
    expect(getAttachmentName('https://cdn.example.com/')).toBe('https://cdn.example.com/')
  })
})

describe('getNodeTitle', () => {
  it('uses the node name', () => {
    expect(getNodeTitle(byId.get('b6a0c1'))).toBe('Away Message')
  })

  it('trims the name', () => {
    expect(getNodeTitle({ type: 'sendMessage', name: '  Welcome  ' })).toBe('Welcome')
  })

  it('titles the unnamed payload trigger "Trigger", as in the mockup', () => {
    expect(getNodeTitle(byId.get('1'))).toBe('Trigger')
  })

  it('falls back to the kind label when the name is blank', () => {
    expect(getNodeTitle({ type: 'dateTime', name: '   ', data: { action: 'businessHours' } })).toBe(
      'Business Hours',
    )
  })

  it('falls back to "Unknown" for unrecognised nodes', () => {
    expect(getNodeTitle({ type: 'webhook' })).toBe('Unknown')
  })
})

describe('getNodeText', () => {
  describe('with the payload', () => {
    it.each([
      ['1', 'Conversation Opened'],
      ['b6a0c1', 'Sorry, we are currently away. We will respond as soon as possible.'],
      ['b0653a', 'Hello there\n\nwelcome to the chat!'],
      ['d09c08', 'Business Hours - UTC'],
      ['e879e4', 'User message during off hours'],
      ['161f52', ''],
      ['28c4b9', ''],
    ])('describes %s as %j', (id, description) => {
      expect(summaryOf(byId.get(id))).toBe(description)
    })
  })

  describe('a user-entered description', () => {
    it('is kept beside what the step holds, not instead of it', () => {
      const node = message([{ type: 'text', text: 'Hi' }], { description: 'Greets the visitor' })

      expect(getNodeText(node)).toEqual({
        description: 'Greets the visitor',
        summary: { label: 'Message', text: 'Hi' },
      })
    })

    it('is ignored when blank', () => {
      const node = message([{ type: 'text', text: 'Hi' }], { description: '  \n ' })

      expect(getNodeText(node).description).toBe('')
      expect(summaryOf(node)).toBe('Hi')
    })

    it('is not shown on pills, which show only their label', () => {
      const node = {
        type: 'dateTimeConnector',
        data: { connectorType: 'success', description: 'x' },
      }

      expect(getNodeText(node)).toEqual({ description: '', summary: { label: '', text: '' } })
    })
  })

  describe('the message label', () => {
    it('labels a message, as the mockup does', () => {
      expect(getNodeText(message([{ type: 'text', text: 'Hi' }])).summary).toEqual({
        label: 'Message',
        text: 'Hi',
      })
    })

    it.each([
      ['a trigger', { type: 'trigger', data: { type: 'conversationOpened' } }],
      ['a comment', { type: 'addComment', data: { comment: 'Noted' } }],
      ['business hours', { type: 'dateTime', data: { action: 'businessHours' } }],
    ])('leaves %s unlabelled, since its text stands on its own', (_, node) => {
      expect(getNodeText(node).summary.label).toBe('')
    })
  })

  describe('sendMessage', () => {
    it('uses the first non-blank text', () => {
      const items = [
        { type: 'attachment', attachment: 'https://x.io/a.png' },
        { type: 'text', text: '   ' },
        { type: 'text', text: 'Second' },
      ]
      expect(summaryOf(message(items))).toBe('Second')
    })

    it('uses the first attachment name when there is no text', () => {
      const items = [
        { type: 'attachment', attachment: 'https://x.io/first.png' },
        { type: 'attachment', attachment: 'https://x.io/second.png' },
      ]
      expect(summaryOf(message(items))).toBe('first.png')
    })

    it.each([
      ['an empty payload', []],
      ['no payload', undefined],
      [
        'blank items only',
        [
          { type: 'text', text: '' },
          { type: 'attachment', attachment: '' },
        ],
      ],
    ])('says so when it has %s', (_, items) => {
      expect(summaryOf(message(items))).toBe('No content')
    })
  })

  it('says so when a comment is empty or missing', () => {
    expect(summaryOf({ type: 'addComment', data: { comment: ' ' } })).toBe('No comment')
    expect(summaryOf({ type: 'addComment' })).toBe('No comment')
  })

  it('shows the business-hours timezone', () => {
    const node = { type: 'dateTime', data: { action: 'businessHours', timezone: 'Asia/Jakarta' } }
    expect(summaryOf(node)).toBe('Business Hours - Asia/Jakarta')
  })

  it('falls back to UTC when business hours have no timezone', () => {
    const node = { type: 'dateTime', data: { action: 'businessHours' } }
    expect(summaryOf(node)).toBe('Business Hours - UTC')
  })

  it('shows an unlisted trigger event as its identifier', () => {
    expect(summaryOf({ type: 'trigger', data: { type: 'tagAdded' } })).toBe('tagAdded')
  })

  it.each(['toString', 'constructor', 'hasOwnProperty'])(
    'never shows a built-in object property for an event named %s',
    (event) => {
      expect(summaryOf({ type: 'trigger', data: { type: event } })).toBe(event)
    },
  )

  it('leaves a trigger without an event undescribed', () => {
    expect(summaryOf({ type: 'trigger', data: {} })).toBe('')
  })

  it('marks unrecognised nodes as unsupported', () => {
    expect(summaryOf({ type: 'webhook', data: {} })).toBe('Unsupported node')
  })
})
