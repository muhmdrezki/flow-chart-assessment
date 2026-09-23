import { describe, expect, it } from 'vitest'
import { getOpenEndIds, toVueFlowEdges, toVueFlowNodes } from './vueFlowAdapter'

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

describe('getOpenEndIds', () => {
  const nodes = [trigger, businessHours, success, failure, message, comment]
  const edgesFrom = (...pairs) => pairs.map(([source, target]) => ({ id: 'e', source, target }))

  it('marks a step with nothing after it', () => {
    const ids = getOpenEndIds(nodes, edgesFrom(['1', 'bh']))

    expect(ids.has('m')).toBe(true)
    expect(ids.has('c')).toBe(true)
  })

  it('leaves out a step that already has something after it', () => {
    expect(getOpenEndIds(nodes, edgesFrom(['1', 'bh'])).has('1')).toBe(false)
  })

  it('leaves out a condition, whose branches are made with it', () => {
    // Business hours has no children in this flow, and still gets no "+": nothing may come between
    // it and the Success and Failure branches it is created with.
    expect(getOpenEndIds(nodes, []).has('bh')).toBe(false)
  })

  it('marks a branch that leads nowhere yet, which is where a new branch starts', () => {
    const ids = getOpenEndIds(nodes, edgesFrom(['bh', 's'], ['bh', 'f'], ['s', 'm']))

    expect(ids.has('f')).toBe(true)
    expect(ids.has('s')).toBe(false)
  })

  it('marks nothing in an empty flow', () => {
    expect(getOpenEndIds([], [])).toEqual(new Set())
  })
})

describe('toVueFlowEdges', () => {
  const nodeById = new Map(
    [trigger, businessHours, success, failure, message, comment, unknown].map((n) => [n.id, n]),
  )
  const classFor = (source) => toVueFlowEdges([{ id: 'e', source, target: 'x' }], nodeById)[0].class

  it('keeps the edge fields, and adds what our own edge component draws with', () => {
    const displayById = new Map([['1', { title: 'Trigger' }]])

    expect(
      toVueFlowEdges([{ id: 'e-1-bh', source: '1', target: 'bh' }], nodeById, displayById),
    ).toEqual([
      {
        id: 'e-1-bh',
        source: '1',
        target: 'bh',
        type: 'flow',
        class: 'edge--trigger',
        data: { canInsert: true, sourceTitle: 'Trigger' },
      },
    ])
  })

  describe('the "+" that adds a step', () => {
    const canInsertAfter = (source) =>
      toVueFlowEdges([{ id: 'e', source, target: 'x' }], nodeById)[0].data.canInsert

    it.each([
      ['a trigger', '1'],
      ['a message', 'm'],
      ['a comment', 'c'],
      ['a success branch', 's'],
      ['a failure branch', 'f'],
    ])('is offered under %s', (_, source) => {
      expect(canInsertAfter(source)).toBe(true)
    })

    it('is not offered under a condition, whose branches have to stay attached to it', () => {
      expect(canInsertAfter('bh')).toBe(false)
    })

    it('is not offered on an edge whose source is gone', () => {
      expect(canInsertAfter('missing')).toBe(false)
    })

    it('names the step it would add after, and copes when there is no name for it', () => {
      const [named] = toVueFlowEdges(
        [{ id: 'e', source: 'm', target: 'x' }],
        nodeById,
        new Map([['m', { title: 'Welcome Message' }]]),
      )
      const [unnamed] = toVueFlowEdges([{ id: 'e', source: 'm', target: 'x' }], nodeById)

      expect(named.data.sourceTitle).toBe('Welcome Message')
      expect(unnamed.data.sourceTitle).toBe('')
    })
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
