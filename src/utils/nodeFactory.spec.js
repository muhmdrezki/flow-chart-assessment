import { describe, expect, it } from 'vitest'
import { DEFAULT_TIMES, DEFAULT_TIMEZONE } from './businessHours'
import { buildNewNodes } from './nodeFactory'
import { CREATABLE_KINDS } from './nodeRegistry'

const VALUES = {
  title: 'Welcome back',
  description: 'Greets returning visitors',
  type: 'sendMessage',
  parentId: 'b6a0c1',
}

/** Predictable ids, so the built nodes can be compared exactly. */
function idGenerator(...ids) {
  let next = 0
  return () => ids[next++] ?? `id-${next}`
}

const build = (overrides = {}, ...ids) =>
  buildNewNodes({ ...VALUES, ...overrides }, idGenerator(...ids))

describe('buildNewNodes', () => {
  describe('a send message node', () => {
    it('builds one node in the payload shape', () => {
      expect(build({}, 'new01')).toEqual({
        nodes: [
          {
            id: 'new01',
            parentId: 'b6a0c1',
            type: 'sendMessage',
            name: 'Welcome back',
            data: { description: 'Greets returning visitors', payload: [] },
          },
        ],
        insertedId: 'new01',
        continuationId: 'new01',
      })
    })

    it('starts with no message content, which the drawer fills in later', () => {
      expect(build({}, 'new01').nodes[0].data.payload).toEqual([])
    })
  })

  it('builds an add comment node with an empty comment', () => {
    expect(build({ type: 'addComment' }, 'new02').nodes).toEqual([
      {
        id: 'new02',
        parentId: 'b6a0c1',
        type: 'addComment',
        name: 'Welcome back',
        data: { description: 'Greets returning visitors', comment: '' },
      },
    ])
  })

  describe('a business hours node', () => {
    const result = build({ type: 'businessHours' }, 'bh01', 'ok01', 'no01')

    it('creates the condition with its success and failure branches', () => {
      expect(result.nodes).toHaveLength(3)
      expect(result.nodes.map((node) => node.id)).toEqual(['bh01', 'ok01', 'no01'])
    })

    it('stores the payload shape, with both branches listed in connectors', () => {
      expect(result.nodes[0]).toEqual({
        id: 'bh01',
        parentId: 'b6a0c1',
        type: 'dateTime',
        name: 'Welcome back',
        data: {
          description: 'Greets returning visitors',
          action: 'businessHours',
          timezone: DEFAULT_TIMEZONE,
          times: [...DEFAULT_TIMES],
          connectors: ['ok01', 'no01'],
        },
      })
    })

    it('makes both branches children of the condition', () => {
      expect(result.nodes[1]).toEqual({
        id: 'ok01',
        parentId: 'bh01',
        type: 'dateTimeConnector',
        name: 'Success',
        data: { connectorType: 'success' },
      })
      expect(result.nodes[2]).toEqual({
        id: 'no01',
        parentId: 'bh01',
        type: 'dateTimeConnector',
        name: 'Failure',
        data: { connectorType: 'failure' },
      })
    })

    it('continues the existing flow on the success branch', () => {
      expect(result.insertedId).toBe('bh01')
      expect(result.continuationId).toBe('ok01')
    })

    it('opens Monday to Friday, 09:00–17:00', () => {
      expect(result.nodes[0].data.times).toEqual([
        { day: 'mon', startTime: '09:00', endTime: '17:00' },
        { day: 'tue', startTime: '09:00', endTime: '17:00' },
        { day: 'wed', startTime: '09:00', endTime: '17:00' },
        { day: 'thu', startTime: '09:00', endTime: '17:00' },
        { day: 'fri', startTime: '09:00', endTime: '17:00' },
      ])
    })

    it('copies the default times, so editing one node never changes another', () => {
      const first = build({ type: 'businessHours' }, 'a', 'b', 'c').nodes[0]
      const second = build({ type: 'businessHours' }, 'd', 'e', 'f').nodes[0]

      first.data.times[0].startTime = '10:00'

      expect(second.data.times[0].startTime).toBe('09:00')
      expect(DEFAULT_TIMES[0].startTime).toBe('09:00')
    })
  })

  it('trims the title and description', () => {
    const [node] = build(
      { title: '  Welcome  ', description: '  Greets visitors  ' },
      'new03',
    ).nodes

    expect(node.name).toBe('Welcome')
    expect(node.data.description).toBe('Greets visitors')
  })

  it.each([...CREATABLE_KINDS])('can build every type the form offers (%s)', (type) => {
    expect(() => build({ type }, 'a', 'b', 'c')).not.toThrow()
  })

  it('never gives two new nodes the same id, even if the generator repeats one', () => {
    const { nodes } = build({ type: 'businessHours' }, 'same', 'same', 'other', 'third')
    const ids = nodes.map((node) => node.id)

    expect(new Set(ids).size).toBe(3)
  })

  it('gives up rather than looping when the generator always repeats', () => {
    expect(() => buildNewNodes({ ...VALUES, type: 'businessHours' }, () => 'same')).toThrow(
      'Could not generate unique ids for the new nodes',
    )
  })

  it.each(['trigger', 'success', 'webhook', undefined])('refuses to build the type %j', (type) => {
    expect(() => build({ type })).toThrow(`Cannot create a node of type "${type}"`)
  })
})
