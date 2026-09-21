import { describe, expect, it } from 'vitest'
import payload from '../../public/payload.json'
import { deriveEdges, normalizePayload } from './graph'
import { DEFAULT_NODE_SIZE, computeLayout } from './layout'

const nodes = normalizePayload(payload)
const edges = deriveEdges(nodes)
const HALF_WIDTH = DEFAULT_NODE_SIZE.width / 2

/** Horizontal centre of a node, which is what the layout aligns. */
const centreX = (positions, id) => positions.get(id).x + HALF_WIDTH

const node = (id) => ({ id })
const edge = (source, target) => ({ source, target })

describe('computeLayout', () => {
  describe('with the payload', () => {
    const positions = computeLayout(nodes, edges)

    it('positions every node', () => {
      expect(positions.size).toBe(7)
    })

    it('stacks levels top-down, one node height plus the gap apart', () => {
      const step = DEFAULT_NODE_SIZE.height + 64
      expect(positions.get('1').y).toBe(0)
      expect(positions.get('d09c08').y).toBe(step)
      expect(positions.get('161f52').y).toBe(2 * step)
      expect(positions.get('28c4b9').y).toBe(2 * step)
      expect(positions.get('b0653a').y).toBe(3 * step)
      expect(positions.get('b6a0c1').y).toBe(3 * step)
      expect(positions.get('e879e4').y).toBe(4 * step)
    })

    it('puts the success branch left of the failure branch, one slot apart', () => {
      expect(centreX(positions, '28c4b9') - centreX(positions, '161f52')).toBe(280)
    })

    it('centres business hours over its two branches', () => {
      const midpoint = (centreX(positions, '161f52') + centreX(positions, '28c4b9')) / 2
      expect(centreX(positions, 'd09c08')).toBe(midpoint)
    })

    it('keeps a single child directly under its parent', () => {
      expect(centreX(positions, 'd09c08')).toBe(centreX(positions, '1'))
      expect(centreX(positions, 'b0653a')).toBe(centreX(positions, '161f52'))
      expect(centreX(positions, 'e879e4')).toBe(centreX(positions, 'b6a0c1'))
    })

    it('is deterministic', () => {
      expect(computeLayout(nodes, edges)).toEqual(positions)
    })
  })

  it('uses getNodeSize for vertical spacing', () => {
    const getNodeSize = ({ id }) => (id === 'root' ? { width: 100, height: 40 } : DEFAULT_NODE_SIZE)
    const positions = computeLayout([node('root'), node('child')], [edge('root', 'child')], {
      getNodeSize,
      yGap: 10,
    })
    expect(positions.get('child').y).toBe(50)
  })

  it('aligns centres when nodes have different widths', () => {
    const getNodeSize = ({ id }) =>
      id === 'root' ? { width: 100, height: 40 } : { width: 300, height: 40 }
    const positions = computeLayout([node('root'), node('child')], [edge('root', 'child')], {
      getNodeSize,
    })
    expect(positions.get('root').x + 50).toBe(positions.get('child').x + 150)
  })

  it('never overlaps siblings', () => {
    const positions = computeLayout(
      [node('r'), node('a'), node('b'), node('c')],
      [edge('r', 'a'), edge('r', 'b'), edge('r', 'c')],
    )
    const xs = ['a', 'b', 'c'].map((id) => positions.get(id).x)
    expect(xs[1] - xs[0]).toBeGreaterThanOrEqual(DEFAULT_NODE_SIZE.width)
    expect(xs[2] - xs[1]).toBeGreaterThanOrEqual(DEFAULT_NODE_SIZE.width)
    expect(new Set(['a', 'b', 'c'].map((id) => positions.get(id).y)).size).toBe(1)
  })

  it('orders siblings by node order, not edge order', () => {
    const positions = computeLayout(
      [node('r'), node('first'), node('second')],
      [edge('r', 'second'), edge('r', 'first')],
    )
    expect(positions.get('first').x).toBeLessThan(positions.get('second').x)
  })

  it('lays out a node with a missing parent as a separate tree beside the main one', () => {
    // An orphan gets no edge from deriveEdges, so it arrives here as a second root.
    const positions = computeLayout([node('a'), node('b'), node('orphan')], [edge('a', 'b')])
    expect(positions.get('orphan').y).toBe(0)
    expect(positions.get('orphan').x).toBeGreaterThan(positions.get('a').x)
  })

  it('ignores edges that reference unknown nodes', () => {
    const positions = computeLayout([node('a')], [edge('a', 'ghost'), edge('ghost', 'a')])
    expect(positions.get('a')).toEqual({ x: -HALF_WIDTH, y: 0 })
  })

  it('keeps only the first parent when a node has several', () => {
    const positions = computeLayout(
      [node('p1'), node('p2'), node('child')],
      [edge('p1', 'child'), edge('p2', 'child')],
    )
    expect(centreX(positions, 'child')).toBe(centreX(positions, 'p1'))
  })

  it('terminates and positions every node when edges form a cycle', () => {
    const positions = computeLayout([node('x'), node('y')], [edge('x', 'y'), edge('y', 'x')])
    expect(positions.size).toBe(2)
    expect(positions.get('y').y).toBeGreaterThan(positions.get('x').y)
  })

  it('returns an empty map for an empty flow', () => {
    expect(computeLayout([], []).size).toBe(0)
  })
})
