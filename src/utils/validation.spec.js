import { describe, expect, it } from 'vitest'
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  getAllowedParents,
  maxLength,
  oneOf,
  required,
  validateCreateNode,
} from './validation'

const VALID = {
  title: 'Welcome back',
  description: 'Greets returning visitors',
  type: 'sendMessage',
}
const context = { allowedParentIds: ['1', 'b6a0c1'] }
const validate = (overrides = {}) =>
  validateCreateNode({ ...VALID, parentId: '1', ...overrides }, context)

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
