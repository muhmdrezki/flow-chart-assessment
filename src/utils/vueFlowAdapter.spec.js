import { describe, expect, it } from 'vitest'
import { toVueFlowEdges, toVueFlowNodes } from './vueFlowAdapter'

const trigger = {
  id: '1',
  parentId: null,
  type: 'trigger',
  data: { type: 'conversationOpened' },
  position: { x: 10, y: 20 },
}
const businessHours = {
  id: 'bh',
  parentId: '1',
  type: 'dateTime',
  name: 'Business Hours',
  data: { action: 'businessHours' },
  position: { x: 0, y: 0 },
}
const success = { id: 's', type: 'dateTimeConnector', data: { connectorType: 'success' } }
const failure = { id: 'f', type: 'dateTimeConnector', data: { connectorType: 'failure' } }
const message = { id: 'm', type: 'sendMessage', data: {} }
const comment = { id: 'c', type: 'addComment', data: {} }
const unknown = { id: 'u', type: 'webhook', data: {} }

describe('toVueFlowNodes', () => {
  const triggerDisplay = { title: 'Trigger', description: 'Conversation Opened' }
  const displayById = new Map([
    ['1', triggerDisplay],
    ['bh', { title: 'Business Hours', description: 'Business Hours - UTC' }],
  ])

  it('passes only id, the kind as type, position and the display data', () => {
    expect(toVueFlowNodes([trigger], displayById)).toEqual([
      { id: '1', type: 'trigger', position: { x: 10, y: 20 }, data: triggerDisplay },
    ])
  })

  it('reuses the display object itself, so it keeps its identity across renders', () => {
    const [mapped] = toVueFlowNodes([trigger], displayById)
    expect(mapped.data).toBe(triggerDisplay)
  })

  it('copies the position so Vue Flow never holds store state', () => {
    const [mapped] = toVueFlowNodes([trigger], displayById)
    expect(mapped.position).not.toBe(trigger.position)
  })

  it.each([
    [businessHours, 'businessHours'],
    [success, 'success'],
    [failure, 'failure'],
    [message, 'sendMessage'],
    [comment, 'addComment'],
    [unknown, 'unknown'],
  ])('uses the node kind as the Vue Flow type (%j → %s)', (node, type) => {
    expect(toVueFlowNodes([node], displayById)[0].type).toBe(type)
  })
})

describe('toVueFlowEdges', () => {
  const nodeById = new Map(
    [trigger, businessHours, success, failure, message, comment, unknown].map((n) => [n.id, n]),
  )
  const classFor = (source) => toVueFlowEdges([{ id: 'e', source, target: 'x' }], nodeById)[0].class

  it('keeps the edge fields', () => {
    expect(toVueFlowEdges([{ id: 'e-1-bh', source: '1', target: 'bh' }], nodeById)).toEqual([
      { id: 'e-1-bh', source: '1', target: 'bh', class: 'edge--trigger' },
    ])
  })

  it.each([
    ['bh', 'edge--businessHours'],
    ['m', 'edge--sendMessage'],
    ['c', 'edge--addComment'],
  ])('colours edges from %s with %s', (source, className) => {
    expect(classFor(source)).toBe(className)
  })

  it('uses the business hours colour for edges leaving success and failure', () => {
    expect(classFor('s')).toBe('edge--businessHours')
    expect(classFor('f')).toBe('edge--businessHours')
  })

  it('uses the neutral colour for unknown or missing sources', () => {
    expect(classFor('u')).toBe('edge--neutral')
    expect(classFor('missing')).toBe('edge--neutral')
  })
})
