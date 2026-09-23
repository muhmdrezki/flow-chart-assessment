import { describe, expect, it } from 'vitest'
import payload from '../../public/payload.json'
import { normalizePayload } from './graph'
import { computeLayout } from './layout'
import { deriveEdges } from './graph'
import { countRemoved, getRemoval } from './nodeRemoval'

/** The payload as the store holds it: ids normalised and every node given a position. */
function laidOut() {
  const nodes = normalizePayload(payload)
  const positions = computeLayout(nodes, deriveEdges(nodes))
  return nodes.map((node) => ({ ...node, position: positions.get(node.id) }))
}

const TRIGGER = '1'
const BUSINESS_HOURS = 'd09c08'
const SUCCESS = '161f52'
const AWAY_MESSAGE = 'b6a0c1'
const ADD_COMMENT = 'e879e4'

describe('getRemoval', () => {
  describe('a plain step', () => {
    it('takes only itself', () => {
      expect(getRemoval(laidOut(), AWAY_MESSAGE).removeIds).toEqual([AWAY_MESSAGE])
    })

    it('hands what came after it to its parent, so the chain closes', () => {
      const nodes = laidOut()

      expect(getRemoval(nodes, AWAY_MESSAGE).reparent).toEqual([
        { id: ADD_COMMENT, parentId: '28c4b9' },
      ])
    })

    it('moves that subtree up into the row it left', () => {
      const nodes = laidOut()
      const away = nodes.find((node) => node.id === AWAY_MESSAGE)
      const comment = nodes.find((node) => node.id === ADD_COMMENT)

      const { shift } = getRemoval(nodes, AWAY_MESSAGE)

      expect(shift.ids).toEqual([ADD_COMMENT])
      expect(shift.dy).toBe(away.position.y - comment.position.y)
      expect(shift.dy).toBeLessThan(0)
    })

    it('has nothing to move when it is the last step of its branch', () => {
      expect(getRemoval(laidOut(), ADD_COMMENT)).toEqual({
        removeIds: [ADD_COMMENT],
        reparent: [],
        shift: null,
      })
    })
  })

  describe('a condition', () => {
    it('takes both branches and everything under them', () => {
      const { removeIds } = getRemoval(laidOut(), BUSINESS_HOURS)

      expect(removeIds.sort()).toEqual(
        [BUSINESS_HOURS, SUCCESS, '28c4b9', 'b0653a', AWAY_MESSAGE, ADD_COMMENT].sort(),
      )
    })

    it('moves nothing: there is no single branch to promote', () => {
      const { reparent, shift } = getRemoval(laidOut(), BUSINESS_HOURS)

      expect(reparent).toEqual([])
      expect(shift).toBeNull()
    })
  })

  it.each([
    ['the trigger, which a flow cannot be without', TRIGGER],
    ['a branch pill, which belongs to its condition', SUCCESS],
    ['a node that is not in the flow', 'ghost'],
  ])('refuses %s', (_, id) => {
    expect(getRemoval(laidOut(), id)).toBeNull()
  })
})

describe('countRemoved', () => {
  it('counts the branches apart from the steps, and leaves out the node itself', () => {
    const nodes = laidOut()

    expect(countRemoved(nodes, getRemoval(nodes, BUSINESS_HOURS))).toEqual({
      steps: 3,
      branches: 2,
    })
  })

  it('counts nothing when only the node itself goes', () => {
    const nodes = laidOut()

    expect(countRemoved(nodes, getRemoval(nodes, ADD_COMMENT))).toEqual({ steps: 0, branches: 0 })
  })
})
