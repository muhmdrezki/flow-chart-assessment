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

/*
 * The layout is the one piece of maths in the project, and it is entirely ours — the payload ships
 * no positions, so every coordinate on screen comes out of this function. It is also the easiest
 * thing to break without noticing: a canvas that is slightly wrong still renders, so these tests
 * assert the *relationships* the eye would check (this is centred over those, these two don't
 * overlap, this row is below that one) rather than pixel values that would have to be rewritten
 * every time a card changes size.
 *
 * The second half is the risky half: a flow whose shape we don't control. The payload is a tidy
 * tree, but a node can name a parent that was deleted, two nodes can name the same child, and data
 * can contain a cycle — and none of those may hang the browser or drop a node off the canvas.
 */
describe('computeLayout', () => {
  // The real payload, so the arithmetic is checked against the flow the app actually opens with.
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

    // The rule the whole layout rests on: a parent sits at the midpoint of its first and last
    // child, so a branch is read as belonging to the condition above it.
    it('centres business hours over its two branches', () => {
      const midpoint = (centreX(positions, '161f52') + centreX(positions, '28c4b9')) / 2
      expect(centreX(positions, 'd09c08')).toBe(midpoint)
    })

    // The same rule with one child, which is the common case and the one a reader eyeballs first.
    it('keeps a single child directly under its parent', () => {
      expect(centreX(positions, 'd09c08')).toBe(centreX(positions, '1'))
      expect(centreX(positions, 'b0653a')).toBe(centreX(positions, '161f52'))
      expect(centreX(positions, 'e879e4')).toBe(centreX(positions, 'b6a0c1'))
    })

    // No randomness, no dependence on iteration order or time: the same flow must always come
    // out the same way, or a reload would appear to rearrange the canvas by itself.
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

  // Slots are allocated per leaf, so three children of one parent cannot land on top of each
  // other however wide the cards become.
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

  // Edges are derived and their order is an implementation detail; the payload order is not. This
  // is what keeps Success on the left of Failure rather than wherever the edge list happened to put
  // them.
  it('orders siblings by node order, not edge order', () => {
    const positions = computeLayout(
      [node('r'), node('first'), node('second')],
      [edge('r', 'second'), edge('r', 'first')],
    )
    expect(positions.get('first').x).toBeLessThan(positions.get('second').x)
  })

  // Bad data, drawn rather than dropped: an orphan is still a node the user can see and delete.
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

  // The tree assumption, made explicit. A second parent is ignored rather than honoured, because
  // placing the child twice would move it out from under the first parent (see the comment in
  // layout.js). If converging branches are ever supported, this is the test that should fail first.
  it('keeps only the first parent when a node has several', () => {
    const positions = computeLayout(
      [node('p1'), node('p2'), node('child')],
      [edge('p1', 'child'), edge('p2', 'child')],
    )
    expect(centreX(positions, 'child')).toBe(centreX(positions, 'p1'))
  })

  // The highest-risk case in this file: the layout recurses, so a cycle in the data would blow the
  // stack and take the tab with it. The visited set is what makes this finish at all.
  it('terminates and positions every node when edges form a cycle', () => {
    const positions = computeLayout([node('x'), node('y')], [edge('x', 'y'), edge('y', 'x')])
    expect(positions.size).toBe(2)
    expect(positions.get('y').y).toBeGreaterThan(positions.get('x').y)
  })

  it('returns an empty map for an empty flow', () => {
    expect(computeLayout([], []).size).toBe(0)
  })
})
