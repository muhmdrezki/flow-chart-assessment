import { describe, expect, it } from 'vitest'
import payload from '../../public/payload.json'
import { deriveEdges, normalizePayload } from './graph'

/*
 * The boundary between the payload and everything else. Both functions here are the reason the
 * rest of the app can be simple: ids are strings from this point on, and edges are a function of
 * the nodes rather than a second list to keep in step. Get these wrong and the failures surface
 * a long way away — as a line drawn to nowhere, or a parent that matches nothing.
 */
describe('normalizePayload', () => {
  const nodes = normalizePayload(payload)

  it('keeps every node', () => {
    expect(nodes).toHaveLength(7)
  })

  // The payload mixes types: the trigger is the number 1 and everything else is a hex string, so
  // comparing a parentId to an id would be false for a pair that really match. Normalising here is
  // what lets every comparison downstream be a plain ===.
  it('turns every id and parentId into a string', () => {
    for (const node of nodes) {
      expect(typeof node.id).toBe('string')
      if (node.parentId !== null) expect(typeof node.parentId).toBe('string')
    }
    expect(nodes.find((node) => node.id === 'd09c08').parentId).toBe('1')
  })

  // -1 is the payload's way of saying 'no parent'; null is the app's. Translating it once means
  // no component has to know about the sentinel.
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

  // Not tidiness: the store later hands nodes to structuredClone, which throws on the reactive
  // proxy Vue Query hands back. This is the test that would have caught a bug we only saw in the
  // browser, twice.
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

/*
 * Edges are derived, never stored, so this is the only thing standing between parentId and what is
 * drawn. The three cases below are the ones that would otherwise draw a line to a node that is not
 * there — which is exactly the class of bug deriving them is meant to design out.
 */
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

  // A flow has one way in. An edge into the trigger would imply something can precede it.
  it('gives the root no incoming edge', () => {
    const edges = deriveEdges(normalizePayload(payload))
    expect(edges.some((edge) => edge.target === '1')).toBe(false)
  })

  // The delete case, seen from the other side: if a parent is gone, its children produce no edge
  // rather than an edge pointing at nothing.
  it('skips nodes whose parent does not exist', () => {
    const nodes = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'missing' },
    ]
    expect(deriveEdges(nodes)).toEqual([])
  })

  // Corrupt data would otherwise draw a line from a node to itself, and give the layout a
  // one-node cycle to recurse into.
  it('skips a node that names itself as parent', () => {
    expect(deriveEdges([{ id: 'a', parentId: 'a' }])).toEqual([])
  })
})
