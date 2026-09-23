import { describe, expect, it } from 'vitest'
import { toDraft } from './nodeEdit'
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  getAllowedParents,
  maxLength,
  oneOf,
  required,
  validateCreateNode,
  validateNodeDraft,
  webUrl,
} from './validation'

const VALID = {
  title: 'Welcome back',
  description: 'Greets returning visitors',
  type: 'sendMessage',
}
const context = { allowedParentIds: ['1', 'b6a0c1'] }
const validate = (overrides = {}) =>
  validateCreateNode({ ...VALID, parentId: '1', ...overrides }, context)

/*
 * Every rule a user's input is checked against, as pure functions. They are shared deliberately:
 * the form calls them to show a message under a field, and the simulated API calls the same ones
 * before it accepts a write, so input that never went through the form is held to identical rules.
 *
 * The business-hours rule is the one with real logic — a day must end after it starts — and it is
 * a string comparison only because the times are wall-clock strings in a known format.
 */
describe('required', () => {
  it('accepts text', () => {
    expect(required('Hello', 'Title')).toBeNull()
  })

  it.each([undefined, null, '', '   ', '\n\t'])('rejects %j', (value) => {
    expect(required(value, 'Title')).toBe('Title is required')
  })
})

describe('maxLength', () => {
  it('accepts text up to the limit', () => {
    expect(maxLength('abcde', 5, 'Title')).toBeNull()
  })

  it('measures the trimmed text', () => {
    expect(maxLength('  abcde  ', 5, 'Title')).toBeNull()
  })

  it('rejects text over the limit', () => {
    expect(maxLength('abcdef', 5, 'Title')).toBe('Title must be 5 characters or fewer')
  })
})

describe('oneOf', () => {
  it('accepts a listed value', () => {
    expect(oneOf('b', ['a', 'b'], 'Pick one')).toBeNull()
  })

  it.each(['c', undefined, ''])('rejects %j', (value) => {
    expect(oneOf(value, ['a', 'b'], 'Pick one')).toBe('Pick one')
  })
})

describe('getAllowedParents', () => {
  const nodes = [
    { id: '1', type: 'trigger', data: {} },
    { id: 'bh', type: 'dateTime', data: { action: 'businessHours' } },
    { id: 's', type: 'dateTimeConnector', data: { connectorType: 'success' } },
    { id: 'm', type: 'sendMessage', data: {} },
  ]

  it('excludes business hours, which always branches into success and failure', () => {
    expect(getAllowedParents(nodes).map((node) => node.id)).toEqual(['1', 's', 'm'])
  })

  it('returns nothing for an empty flow', () => {
    expect(getAllowedParents([])).toEqual([])
  })
})

describe('validateCreateNode', () => {
  it('returns no errors for a valid form', () => {
    expect(validate()).toEqual({})
  })

  it.each([undefined, '', '   '])('requires a title (%j)', (title) => {
    expect(validate({ title })).toEqual({ title: 'Title is required' })
  })

  it('limits the title length', () => {
    expect(validate({ title: 'a'.repeat(TITLE_MAX_LENGTH + 1) })).toEqual({
      title: `Title must be ${TITLE_MAX_LENGTH} characters or fewer`,
    })
  })

  it('accepts a title exactly at the limit', () => {
    expect(validate({ title: 'a'.repeat(TITLE_MAX_LENGTH) })).toEqual({})
  })

  it('requires a description', () => {
    expect(validate({ description: ' ' })).toEqual({ description: 'Description is required' })
  })

  it('limits the description length', () => {
    expect(validate({ description: 'a'.repeat(DESCRIPTION_MAX_LENGTH + 1) })).toEqual({
      description: `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer`,
    })
  })

  it.each([undefined, 'trigger', 'success', 'webhook'])('rejects the type %j', (type) => {
    expect(validate({ type })).toEqual({ type: 'Choose a node type' })
  })

  it.each(['sendMessage', 'addComment', 'businessHours'])('accepts the type %s', (type) => {
    expect(validate({ type })).toEqual({})
  })

  it.each([undefined, '', 'missing'])('rejects the parent %j', (parentId) => {
    expect(validate({ parentId })).toEqual({ parentId: 'Choose where to add the node' })
  })

  it('asks for a parent when no allowed parents are given', () => {
    expect(validateCreateNode(VALID)).toEqual({ parentId: 'Choose where to add the node' })
    expect(validateCreateNode(VALID, {})).toEqual({ parentId: 'Choose where to add the node' })
  })

  it('reports every invalid field at once', () => {
    expect(validateCreateNode({}, context)).toEqual({
      title: 'Title is required',
      description: 'Description is required',
      type: 'Choose a node type',
      parentId: 'Choose where to add the node',
    })
  })
})

describe('webUrl', () => {
  it.each(['https://files.test/a.png', 'http://files.test/a.png'])('accepts %s', (value) => {
    expect(webUrl(value, 'A link')).toBeNull()
  })

  it.each([
    ['nothing', ''],
    ['text that is not a link', 'my-file.png'],
    ['a scheme the browser will not open', 'mailto:someone@test.com'],
    ['an inline file', 'data:image/png;base64,iVBORw0KGgo='],
  ])('rejects %s', (_, value) => {
    expect(webUrl(value, 'A link')).toBe('A link must be a web link')
  })
})

describe('validateNodeDraft', () => {
  const draftFor = (kind, overrides = {}) => toDraft({ ...NODES[kind], ...overrides })

  const NODES = {
    trigger: { type: 'trigger', name: 'Trigger', data: { type: 'conversationOpened' } },
    sendMessage: {
      type: 'sendMessage',
      name: 'Away Message',
      data: { payload: [{ type: 'text', text: 'Hello' }] },
    },
    addComment: { type: 'addComment', name: 'Note', data: { comment: 'Seen it' } },
    businessHours: {
      type: 'dateTime',
      name: 'Business Hours',
      data: {
        action: 'businessHours',
        timezone: 'UTC',
        times: [{ day: 'mon', startTime: '09:00', endTime: '17:00' }],
      },
    },
  }

  it.each(Object.keys(NODES))('accepts a valid %s', (kind) => {
    expect(validateNodeDraft(draftFor(kind), kind)).toEqual({})
  })

  describe('the fields every node has', () => {
    it('needs a title', () => {
      const draft = { ...draftFor('addComment'), title: '  ' }

      expect(validateNodeDraft(draft, 'addComment').title).toBe('Title is required')
    })

    it('limits the title', () => {
      const draft = { ...draftFor('addComment'), title: 'x'.repeat(61) }

      expect(validateNodeDraft(draft, 'addComment').title).toBe(
        'Title must be 60 characters or fewer',
      )
    })

    it('does not ask for a description, since the payload never has one', () => {
      const draft = { ...draftFor('addComment'), description: '' }

      expect(validateNodeDraft(draft, 'addComment')).toEqual({})
    })

    it('still limits the description when there is one', () => {
      const draft = { ...draftFor('addComment'), description: 'x'.repeat(201) }

      expect(validateNodeDraft(draft, 'addComment').description).toBe(
        'Description must be 200 characters or fewer',
      )
    })
  })

  it('lets a comment be cleared, which is how a note is taken back off a step', () => {
    const draft = { ...draftFor('addComment'), comment: '   ' }

    expect(validateNodeDraft(draft, 'addComment')).toEqual({})
  })

  it('still limits how long a comment can be', () => {
    const draft = { ...draftFor('addComment'), comment: 'x'.repeat(1001) }

    expect(validateNodeDraft(draft, 'addComment').comment).toBe(
      'Comment must be 1000 characters or fewer',
    )
  })

  describe('a message', () => {
    it('needs something in it', () => {
      const draft = { ...draftFor('sendMessage'), parts: [] }

      expect(validateNodeDraft(draft, 'sendMessage').parts).toBe('Add a message or an attachment')
    })

    it('points at the part that is empty', () => {
      const draft = {
        ...draftFor('sendMessage'),
        parts: [
          { key: 'a', type: 'text', text: 'Fine' },
          { key: 'b', type: 'text', text: '  ' },
        ],
      }

      expect(validateNodeDraft(draft, 'sendMessage')).toEqual({
        'parts.1': 'Message text is required',
      })
    })

    it('checks an attachment is a link', () => {
      const draft = {
        ...draftFor('sendMessage'),
        parts: [{ key: 'a', type: 'attachment', attachment: 'not-a-link' }],
      }

      expect(validateNodeDraft(draft, 'sendMessage')['parts.0']).toBe(
        'An attachment must be a web link',
      )
    })

    it('accepts a file the user uploaded, which is carried as a data URL', () => {
      const draft = {
        ...draftFor('sendMessage'),
        parts: [{ key: 'a', type: 'attachment', attachment: 'data:image/png;base64,iVBORw0KGgo=' }],
      }

      expect(validateNodeDraft(draft, 'sendMessage')).toEqual({})
    })
  })

  describe('business hours', () => {
    const withDays = (days) => ({ ...draftFor('businessHours'), days })

    it('needs at least one open day', () => {
      const draft = withDays(
        draftFor('businessHours').days.map((day) => ({ ...day, isOpen: false })),
      )

      expect(validateNodeDraft(draft, 'businessHours').days).toBe('Open at least one day')
    })

    it('needs an end after the start', () => {
      const draft = withDays([{ day: 'mon', isOpen: true, startTime: '17:00', endTime: '09:00' }])

      expect(validateNodeDraft(draft, 'businessHours')['times.mon']).toBe(
        'Monday must end after it starts',
      )
    })

    it('refuses a day that starts and ends at the same moment', () => {
      const draft = withDays([{ day: 'mon', isOpen: true, startTime: '09:00', endTime: '09:00' }])

      expect(validateNodeDraft(draft, 'businessHours')['times.mon']).toBe(
        'Monday must end after it starts',
      )
    })

    it('refuses a time that is not a time', () => {
      const draft = withDays([{ day: 'tue', isOpen: true, startTime: '9am', endTime: '17:00' }])

      expect(validateNodeDraft(draft, 'businessHours')['times.tue']).toBe(
        'Tuesday needs a start and an end time',
      )
    })

    it('ignores the days that are closed', () => {
      const draft = withDays([
        { day: 'mon', isOpen: true, startTime: '09:00', endTime: '17:00' },
        { day: 'tue', isOpen: false, startTime: '17:00', endTime: '09:00' },
      ])

      expect(validateNodeDraft(draft, 'businessHours')).toEqual({})
    })

    it('needs a time zone', () => {
      const draft = { ...draftFor('businessHours'), timezone: '' }

      expect(validateNodeDraft(draft, 'businessHours').timezone).toBe('Time zone is required')
    })
  })
})
