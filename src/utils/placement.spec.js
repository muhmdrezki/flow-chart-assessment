import { describe, expect, it } from 'vitest'
import { X_GAP, Y_GAP } from './layout'
import { NODE_REGISTRY } from './nodeRegistry'
import {
  collectSubtreeIds,
  getInsertShift,
  positionBelow,
  positionBranches,
  shiftSubtree,
} from './placement'

const CARD = NODE_REGISTRY.sendMessage.size
const PILL = NODE_REGISTRY.success.size

const card = (id, x = 0, y = 0) => ({ id, type: 'sendMessage', data: {}, position: { x, y } })
const pill = (id, x = 0, y = 0) => ({
  id,
  type: 'dateTimeConnector',
  data: { connectorType: 'success' },
  position: { x, y },
})
const centreOf = (node, size) => node.position.x + size.width / 2

describe('positionBelow', () => {
  it('puts the node one row below its parent', () => {
    const parent = card('parent', 100, 200)

    expect(positionBelow(parent, card('new'))).toEqual({
      x: 100,
      y: 200 + CARD.height + Y_GAP,
    })
  })

  it('centres a narrower node on its parent', () => {
    const parent = card('parent', 100, 0)
    const position = positionBelow(parent, pill('new'))

    expect(position.x + PILL.width / 2).toBe(centreOf(parent, CARD))
  })

  it('centres a wider node on a narrow parent', () => {
    const parent = pill('parent', 100, 0)
    const position = positionBelow(parent, card('new'))

    expect(position.x + CARD.width / 2).toBe(centreOf(parent, PILL))
    expect(position.y).toBe(PILL.height + Y_GAP)
  })
})

describe('positionBranches', () => {
  const parent = card('bh', 500, 300)
  const positions = positionBranches(parent, [pill('ok'), pill('no')])

  it('puts both branches on the same row, below the parent', () => {
    expect(positions[0].y).toBe(300 + CARD.height + Y_GAP)
    expect(positions[1].y).toBe(positions[0].y)
  })

  it('spaces them one column apart', () => {
    expect(positions[1].x - positions[0].x).toBe(X_GAP)
  })

  it('centres the pair on the parent', () => {
    const middle = (positions[0].x + positions[1].x + PILL.width) / 2
    expect(middle).toBe(centreOf(parent, CARD))
  })

  it('centres a single branch directly under the parent', () => {
    const [only] = positionBranches(parent, [pill('ok')])
    expect(only.x + PILL.width / 2).toBe(centreOf(parent, CARD))
  })

  it('returns nothing for no branches', () => {
    expect(positionBranches(parent, [])).toEqual([])
  })
})

describe('getInsertShift', () => {
  it('measures the space a node added directly below its parent takes up', () => {
    const parent = card('parent', 0, 0)
    const inserted = card('new', 0, CARD.height + Y_GAP)

    expect(getInsertShift(parent, inserted)).toEqual({ dx: 0, dy: CARD.height + Y_GAP })
  })

  it('is always a move down, even when the follower was dragged far away', () => {
    const parent = card('parent', 0, 0)
    const inserted = card('new', 0, CARD.height + Y_GAP)

    expect(getInsertShift(parent, inserted).dy).toBeGreaterThan(0)
  })

  it('also moves sideways when the flow continues on a branch', () => {
    // A condition below the parent, continuing on its left-hand success branch.
    const parent = card('parent', 0, 0)
    const condition = card('bh', 0, CARD.height + Y_GAP)
    const success = pill('ok', positionBranches(condition, [pill('ok'), pill('no')])[0].x, 0)
    success.position.y = condition.position.y + CARD.height + Y_GAP

    const shift = getInsertShift(parent, success)

    expect(shift.dx).toBe(-X_GAP / 2)
    expect(shift.dy).toBe(2 * (CARD.height + Y_GAP) - CARD.height + PILL.height)
  })
})

describe('shiftSubtree', () => {
  const nodes = [
    { ...card('a', 0, 0), parentId: null },
    { ...card('b', 10, 100), parentId: 'a' },
    { ...card('c', 20, 200), parentId: 'b' },
    { ...card('other', 30, 300), parentId: null },
  ]

  it('moves the branch and everything below it', () => {
    const moved = shiftSubtree(nodes, ['b'], { dx: 5, dy: 50 })

    expect(moved.get('b')).toEqual({ x: 15, y: 150 })
    expect(moved.get('c')).toEqual({ x: 25, y: 250 })
  })

  it('leaves the rest of the flow alone', () => {
    const moved = shiftSubtree(nodes, ['b'], { dx: 5, dy: 50 })

    expect(moved.has('a')).toBe(false)
    expect(moved.has('other')).toBe(false)
  })

  it('never changes the nodes it is given', () => {
    shiftSubtree(nodes, ['b'], { dx: 5, dy: 50 })
    expect(nodes[1].position).toEqual({ x: 10, y: 100 })
  })

  it('treats a missing axis as no movement', () => {
    expect(shiftSubtree(nodes, ['b'], { dy: 50 }).get('b')).toEqual({ x: 10, y: 150 })
  })
})

describe('collectSubtreeIds', () => {
  //  a → b → d
  //    → c        e (unrelated)
  const nodes = [
    { id: 'a', parentId: null },
    { id: 'b', parentId: 'a' },
    { id: 'c', parentId: 'a' },
    { id: 'd', parentId: 'b' },
    { id: 'e', parentId: null },
  ]

  it('collects a node and everything below it', () => {
    expect([...collectSubtreeIds(nodes, ['a'])].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('collects only the branch asked for', () => {
    expect([...collectSubtreeIds(nodes, ['b'])].sort()).toEqual(['b', 'd'])
  })

  it('collects several branches at once', () => {
    expect([...collectSubtreeIds(nodes, ['c', 'e'])].sort()).toEqual(['c', 'e'])
  })

  it('returns a leaf on its own', () => {
    expect([...collectSubtreeIds(nodes, ['d'])]).toEqual(['d'])
  })

  it('returns nothing for no roots', () => {
    expect(collectSubtreeIds(nodes, []).size).toBe(0)
  })

  it('ignores ids that are not in the flow', () => {
    expect([...collectSubtreeIds(nodes, ['ghost'])]).toEqual(['ghost'])
  })

  it('terminates when the data contains a cycle', () => {
    const cyclic = [
      { id: 'x', parentId: 'y' },
      { id: 'y', parentId: 'x' },
    ]
    expect([...collectSubtreeIds(cyclic, ['x'])].sort()).toEqual(['x', 'y'])
  })
})
