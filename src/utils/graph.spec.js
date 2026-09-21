import { describe, expect, it } from 'vitest'
import payload from '../../public/payload.json'
import { deriveEdges, findPayloadError, normalizePayload } from './graph'

const validNode = (overrides = {}) => ({ id: 'a1', parentId: -1, type: 'trigger', ...overrides })

describe('findPayloadError', () => {
  it('accepts the real payload', () => {
    expect(findPayloadError(payload)).toBeNull()
  })

  it('accepts an empty flow', () => {
    expect(findPayloadError([])).toBeNull()
  })

  it.each([
    ['an object', {}],
    ['null', null],
    ['a string', 'nodes'],
  ])('rejects %s instead of an array', (_, raw) => {
    expect(findPayloadError(raw)).toBe('expected an array of nodes')
  })

  it.each([null, 'node', 42, ['a1']])('rejects a non-object item (%j)', (item) => {
    expect(findPayloadError([validNode(), item])).toBe('node at index 1 is not an object')
  })

  it.each([undefined, '', '   ', null, NaN, {}])('rejects an invalid id (%j)', (id) => {
    expect(findPayloadError([validNode({ id })])).toBe('node at index 0 has an invalid id')
  })

  it('rejects duplicate ids, comparing numbers and strings alike', () => {
    const raw = [validNode({ id: 1 }), validNode({ id: '1', parentId: 1 })]
    expect(findPayloadError(raw)).toBe('duplicate node id "1"')
  })

  it.each([undefined, '', 7])('rejects an invalid type (%j)', (type) => {
    expect(findPayloadError([validNode({ type })])).toBe('node "a1" has an invalid type')
  })

  it.each([undefined, null, '', {}])('rejects an invalid parentId (%j)', (parentId) => {
    expect(findPayloadError([validNode({ parentId })])).toBe('node "a1" has an invalid parentId')
  })

  it('rejects a non-string name', () => {
    expect(findPayloadError([validNode({ name: 42 })])).toBe('node "a1" has an invalid name')
  })

  it.each([null, [], 'data'])('rejects non-object data (%j)', (data) => {
    expect(findPayloadError([validNode({ data })])).toBe('node "a1" has invalid data')
  })

  it('rejects a non-string data.type', () => {
    expect(findPayloadError([validNode({ data: { type: 5 } })])).toBe(
      'node "a1" has an invalid data.type',
    )
  })

  it('allows name and data to be absent', () => {
    expect(findPayloadError([{ id: 1, parentId: -1, type: 'trigger' }])).toBeNull()
  })
})

describe('normalizePayload', () => {
  const nodes = normalizePayload(payload)

  it('keeps every node', () => {
    expect(nodes).toHaveLength(7)
  })

  it('turns every id and parentId into a string', () => {
    for (const node of nodes) {
      expect(typeof node.id).toBe('string')
      if (node.parentId !== null) expect(typeof node.parentId).toBe('string')
    }
    expect(nodes.find((node) => node.id === 'd09c08').parentId).toBe('1')
  })

  it('gives the root a null parentId', () => {
    expect(nodes.find((node) => node.id === '1').parentId).toBeNull()
  })

  it('keeps type, name and data unchanged', () => {
    const raw = payload.find((node) => node.id === 'b0653a')
    expect(nodes.find((node) => node.id === 'b0653a')).toEqual({
      id: 'b0653a',
      parentId: '161f52',
      type: 'sendMessage',
      name: raw.name,
      data: raw.data,
    })
  })

  it('omits name when the payload has none', () => {
    expect(nodes.find((node) => node.id === '1')).not.toHaveProperty('name')
  })

  it('copies data instead of sharing it with the payload', () => {
    const raw = payload.find((node) => node.id === 'e879e4')
    const normalized = nodes.find((node) => node.id === 'e879e4')
    expect(normalized.data).toEqual(raw.data)
    expect(normalized.data).not.toBe(raw.data)
  })

  it('defaults missing data to an empty object', () => {
    expect(normalizePayload([{ id: 1, parentId: -1, type: 'trigger' }])[0].data).toEqual({})
  })
})

describe('deriveEdges', () => {
  it('derives one edge per parent link in the payload', () => {
    expect(deriveEdges(normalizePayload(payload))).toEqual([
      { id: 'e-28c4b9-b6a0c1', source: '28c4b9', target: 'b6a0c1' },
      { id: 'e-1-d09c08', source: '1', target: 'd09c08' },
      { id: 'e-d09c08-161f52', source: 'd09c08', target: '161f52' },
      { id: 'e-d09c08-28c4b9', source: 'd09c08', target: '28c4b9' },
      { id: 'e-161f52-b0653a', source: '161f52', target: 'b0653a' },
      { id: 'e-b6a0c1-e879e4', source: 'b6a0c1', target: 'e879e4' },
    ])
  })

  it('gives the root no incoming edge', () => {
    const edges = deriveEdges(normalizePayload(payload))
    expect(edges.some((edge) => edge.target === '1')).toBe(false)
  })

  it('skips nodes whose parent does not exist', () => {
    const nodes = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'missing' },
    ]
    expect(deriveEdges(nodes)).toEqual([])
  })

  it('skips a node that names itself as parent', () => {
    expect(deriveEdges([{ id: 'a', parentId: 'a' }])).toEqual([])
  })
})
