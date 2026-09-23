import { describe, expect, it } from 'vitest'
import payload from '../../public/payload.json'
import { normalizePayload } from './graph'
import { createPart, fromDraft, isSameDraft, toDraft } from './nodeEdit'

const nodes = normalizePayload(payload)
const node = (id) => nodes.find((candidate) => candidate.id === String(id))

const TRIGGER = 1
const AWAY_MESSAGE = 'b6a0c1'
const WELCOME_MESSAGE = 'b0653a'
const ADD_COMMENT = 'e879e4'
const BUSINESS_HOURS = 'd09c08'

describe('toDraft', () => {
  it('reads the fields every node has', () => {
    const draft = toDraft(node(AWAY_MESSAGE))

    expect(draft.title).toBe('Away Message')
    expect(draft.description).toBe('')
  })

  it('starts a node the payload never named from the title the canvas shows', () => {
    // Otherwise the trigger would open with an empty required field it was never given.
    expect(toDraft(node(TRIGGER)).title).toBe('Trigger')
  })

  it('reads a trigger’s setting', () => {
    expect(toDraft(node(TRIGGER)).oncePerContact).toBe(false)
  })

  it('reads a comment', () => {
    expect(toDraft(node(ADD_COMMENT)).comment).toBe('User message during off hours')
  })

  it('reads a message as its parts, in order and each with its own key', () => {
    const { parts } = toDraft(node(WELCOME_MESSAGE))

    expect(parts.map((part) => part.type)).toEqual(['text', 'attachment'])
    expect(parts[0].text).toBe('Hello there\n\nwelcome to the chat!')
    expect(parts[1].attachment).toContain('picsum.photos')
    expect(new Set(parts.map((part) => part.key)).size).toBe(2)
  })

  it('reads business hours as all seven days', () => {
    const draft = toDraft(node(BUSINESS_HOURS))

    expect(draft.timezone).toBe('UTC')
    expect(draft.days).toHaveLength(7)
    expect(draft.days[0]).toEqual({
      day: 'mon',
      isOpen: true,
      startTime: '09:00',
      endTime: '17:00',
    })
  })

  it('shows times for a closed day too, so opening it is one click', () => {
    const draft = toDraft({
      type: 'dateTime',
      data: {
        action: 'businessHours',
        times: [{ day: 'mon', startTime: '10:00', endTime: '12:00' }],
      },
    })

    expect(draft.days[1]).toEqual({
      day: 'tue',
      isOpen: false,
      startTime: '09:00',
      endTime: '17:00',
    })
  })

  it.each([
    ['a message with no payload', { type: 'sendMessage', data: {} }],
    ['a node with no data', { type: 'addComment' }],
    ['a kind with no fields of its own', { type: 'dateTimeConnector', data: {} }],
  ])('copes with %s', (_, raw) => {
    expect(() => toDraft(raw)).not.toThrow()
  })
})

describe('fromDraft', () => {
  it.each([AWAY_MESSAGE, WELCOME_MESSAGE, ADD_COMMENT, BUSINESS_HOURS])(
    'leaves %s exactly as it was when nothing changed',
    (id) => {
      const original = node(id)

      expect(fromDraft(original, toDraft(original))).toEqual(original)
    },
  )

  it('writes the title back as the node’s name', () => {
    const saved = fromDraft(node(AWAY_MESSAGE), {
      ...toDraft(node(AWAY_MESSAGE)),
      title: '  Renamed  ',
    })

    expect(saved.name).toBe('Renamed')
  })

  it('gives the trigger the name it was shown under, since it had none', () => {
    expect(fromDraft(node(TRIGGER), toDraft(node(TRIGGER))).name).toBe('Trigger')
  })

  it('stores a description, and removes it again when it is emptied', () => {
    const original = node(ADD_COMMENT)
    const described = fromDraft(original, {
      ...toDraft(original),
      description: ' Why this exists ',
    })
    expect(described.data.description).toBe('Why this exists')

    const emptied = fromDraft(described, { ...toDraft(described), description: '   ' })
    expect('description' in emptied.data).toBe(false)
  })

  it('keeps what the form never touched', () => {
    const original = node(BUSINESS_HOURS)
    const saved = fromDraft(original, { ...toDraft(original), timezone: 'Asia/Tokyo' })

    expect(saved.data.action).toBe('businessHours')
    expect(saved.data.connectors).toEqual(['161f52', '28c4b9'])
    expect(saved.parentId).toBe(original.parentId)
  })

  it('leaves a closed day out of the times, which is how the payload says it', () => {
    const original = node(BUSINESS_HOURS)
    const draft = toDraft(original)
    draft.days[6].isOpen = false

    expect(fromDraft(original, draft).data.times.map((time) => time.day)).toEqual([
      'mon',
      'tue',
      'wed',
      'thu',
      'fri',
      'sat',
    ])
  })

  it('writes message parts back in the payload’s shape', () => {
    const original = node(WELCOME_MESSAGE)
    const draft = toDraft(original)
    draft.parts[0].text = '  Hi there  '

    expect(fromDraft(original, draft).data.payload[0]).toEqual({ type: 'text', text: 'Hi there' })
  })

  it('converts without cleaning up, so the API still gets to refuse bad values', () => {
    const original = node(ADD_COMMENT)
    const saved = fromDraft(original, { ...toDraft(original), comment: '   ' })

    expect(saved.data.comment).toBe('')
  })
})

describe('createPart', () => {
  it('makes an empty text part', () => {
    expect(createPart('text')).toEqual({ key: expect.any(String), type: 'text', text: '' })
  })

  it('makes an empty attachment part', () => {
    expect(createPart('attachment')).toEqual({
      key: expect.any(String),
      type: 'attachment',
      attachment: '',
    })
  })

  it('never repeats a key, so rows keep their identity as they are added', () => {
    expect(createPart('text').key).not.toBe(createPart('text').key)
  })
})

describe('isSameDraft', () => {
  it('sees an untouched draft as unchanged', () => {
    const original = node(BUSINESS_HOURS)

    expect(isSameDraft(toDraft(original), toDraft(original))).toBe(true)
  })

  it('sees an edited value as changed', () => {
    const draft = toDraft(node(ADD_COMMENT))

    expect(isSameDraft(draft, { ...draft, comment: 'Something else' })).toBe(false)
  })

  it('ignores the keys that only identify a row', () => {
    // Adding a part and removing it again leaves the same message, so Save shouldn't light up.
    const original = toDraft(node(WELCOME_MESSAGE))
    const reloaded = toDraft(node(WELCOME_MESSAGE))

    expect(original.parts[0].key).not.toBe(reloaded.parts[0].key)
    expect(isSameDraft(original, reloaded)).toBe(true)
  })
})
