import { describe, expect, it } from 'vitest'
import { NODE_KIND, getEdgeColourKind, getNodeKind, humanize } from './nodeKind'

describe('getNodeKind', () => {
  it.each([
    [{ type: 'trigger', data: { type: 'conversationOpened' } }, NODE_KIND.TRIGGER],
    [{ type: 'sendMessage', data: { payload: [] } }, NODE_KIND.SEND_MESSAGE],
    [{ type: 'addComment', data: { comment: 'hi' } }, NODE_KIND.ADD_COMMENT],
    [{ type: 'dateTime', data: { action: 'businessHours' } }, NODE_KIND.BUSINESS_HOURS],
    [{ type: 'dateTimeConnector', data: { connectorType: 'success' } }, NODE_KIND.SUCCESS],
    [{ type: 'dateTimeConnector', data: { connectorType: 'failure' } }, NODE_KIND.FAILURE],
  ])('maps %j to %s', (node, kind) => {
    expect(getNodeKind(node)).toBe(kind)
  })

  it.each([
    ['a dateTime node with another action', { type: 'dateTime', data: { action: 'dateRange' } }],
    ['a dateTime node without data', { type: 'dateTime' }],
    ['a connector with an unknown connectorType', { type: 'dateTimeConnector', data: {} }],
    ['an unknown type', { type: 'webhook', data: {} }],
    ['a node without a type', {}],
    ['undefined', undefined],
  ])('returns unknown for %s', (_, node) => {
    expect(getNodeKind(node)).toBe(NODE_KIND.UNKNOWN)
  })
})

describe('humanize', () => {
  it.each([
    ['conversationOpened', 'Conversation Opened'],
    ['businessHours', 'Business Hours'],
    ['trigger', 'Trigger'],
    ['event2Fired', 'Event2 Fired'],
  ])('turns %s into %s', (identifier, text) => {
    expect(humanize(identifier)).toBe(text)
  })
})

describe('getEdgeColourKind', () => {
  it.each([
    [{ type: 'trigger' }, NODE_KIND.TRIGGER],
    [{ type: 'sendMessage' }, NODE_KIND.SEND_MESSAGE],
    [{ type: 'addComment' }, NODE_KIND.ADD_COMMENT],
    [{ type: 'dateTime', data: { action: 'businessHours' } }, NODE_KIND.BUSINESS_HOURS],
  ])('uses the source kind for %j', (source, colourKind) => {
    expect(getEdgeColourKind(source)).toBe(colourKind)
  })

  it.each(['success', 'failure'])('uses the business hours colour for %s connectors', (type) => {
    const connector = { type: 'dateTimeConnector', data: { connectorType: type } }
    expect(getEdgeColourKind(connector)).toBe(NODE_KIND.BUSINESS_HOURS)
  })

  it('is neutral for unknown or missing sources', () => {
    expect(getEdgeColourKind({ type: 'webhook' })).toBe('neutral')
    expect(getEdgeColourKind(undefined)).toBe('neutral')
  })
})
