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
  it('passes only id, type, position and a label', () => {
    expect(toVueFlowNodes([trigger])).toEqual([
      {
        id: '1',
        type: 'default',
        position: { x: 10, y: 20 },
        data: { label: 'Trigger' },
      },
    ])
  })

  it('copies the position so Vue Flow never holds store state', () => {
    const [mapped] = toVueFlowNodes([trigger])
    expect(mapped.position).not.toBe(trigger.position)
  })

  it('labels nodes with their title', () => {
    expect(toVueFlowNodes([businessHours])[0].data.label).toBe('Business Hours')
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
