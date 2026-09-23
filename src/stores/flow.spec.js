import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import payload from '../../public/payload.json'
import { getNodeSize } from '@/utils/nodeRegistry'
import { useFlowStore } from './flow'

describe('useFlowStore', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useFlowStore()
  })

  it('starts empty and not hydrated', () => {
    expect(store.nodes).toEqual([])
    expect(store.edges).toEqual([])
    expect(store.isHydrated).toBe(false)
  })

  describe('hydrate', () => {
    it('loads every payload node with a position', () => {
      store.hydrate(payload)

      expect(store.isHydrated).toBe(true)
      expect(store.nodes).toHaveLength(7)
      for (const node of store.nodes) {
        expect(node.position).toEqual({ x: expect.any(Number), y: expect.any(Number) })
      }
    })

    it('accepts Vue Query data, which arrives as a reactive proxy', () => {
      // structuredClone throws on proxies; this failed in the browser before hydrate used toRaw.
      expect(() => store.hydrate(reactive(structuredClone(payload)))).not.toThrow()
      expect(store.nodes).toHaveLength(7)
    })

    it('ignores later calls so user changes are never overwritten', () => {
      store.hydrate(payload)
      store.updateNodePositions([{ id: '1', position: { x: 999, y: 999 } }])

      store.hydrate([{ id: 'other', parentId: -1, type: 'trigger' }])

      expect(store.nodes).toHaveLength(7)
      expect(store.nodeById.get('1').position).toEqual({ x: 999, y: 999 })
    })

    it('does not share objects with the payload it was given', () => {
      const raw = structuredClone(payload)
      store.hydrate(raw)

      raw.find((node) => node.id === 'e879e4').data.comment = 'changed'

      expect(store.nodeById.get('e879e4').data.comment).toBe('User message during off hours')
    })

    it('leaves the store untouched if the payload cannot be processed', () => {
      expect(() => store.hydrate([null])).toThrow()
      expect(store.nodes).toEqual([])
      expect(store.isHydrated).toBe(false)
    })
  })

  describe('getters', () => {
    beforeEach(() => store.hydrate(payload))

    it('looks nodes up by string id', () => {
      expect(store.nodeById.get('1').type).toBe('trigger')
      expect(store.nodeById.get('d09c08').name).toBe('Business Hours')
    })

    it('derives the six payload edges', () => {
      expect(store.edges).toHaveLength(6)
      expect(store.edges).toContainEqual({ id: 'e-1-d09c08', source: '1', target: 'd09c08' })
    })

    it('updates edges and lookups when nodes change', () => {
      store.nodes.push({ id: 'new', parentId: 'e879e4', type: 'addComment', data: {} })

      expect(store.nodeById.has('new')).toBe(true)
      expect(store.edges).toContainEqual({ id: 'e-e879e4-new', source: 'e879e4', target: 'new' })
    })
  })

  describe('nodeDisplayById', () => {
    beforeEach(() => store.hydrate(payload))

    it('gives every node its title and description', () => {
      expect(Object.fromEntries(store.nodeDisplayById)).toEqual({
        1: { title: 'Trigger', description: 'Conversation Opened' },
        b6a0c1: {
          title: 'Away Message',
          description: 'Sorry, we are currently away. We will respond as soon as possible.',
        },
        d09c08: { title: 'Business Hours', description: 'Business Hours - UTC' },
        '161f52': { title: 'Success', description: '' },
        '28c4b9': { title: 'Failure', description: '' },
        b0653a: { title: 'Welcome Message', description: 'Hello there\n\nwelcome to the chat!' },
        e879e4: { title: 'Add Comment #1', description: 'User message during off hours' },
      })
    })

    it('is not recomputed when positions change', () => {
      const before = store.nodeDisplayById

      store.updateNodePositions([{ id: '1', position: { x: 5, y: 5 } }])

      expect(store.nodeDisplayById).toBe(before)
    })

    it('updates when a node’s text changes', () => {
      store.nodeById.get('e879e4').data.comment = 'Follow up tomorrow'
      expect(store.nodeDisplayById.get('e879e4').description).toBe('Follow up tomorrow')
    })
  })

  describe('layout sizes', () => {
    beforeEach(() => store.hydrate(payload))
    const y = (id) => store.nodeById.get(id).position.y

    it('spaces nodes by the height of their parent, so pills sit closer than cards', () => {
      const gap = 64
      expect(y('d09c08') - y('1')).toBe(88 + gap)
      expect(y('161f52') - y('d09c08')).toBe(88 + gap)
      expect(y('b0653a') - y('161f52')).toBe(28 + gap)
    })

    it('centres the narrow pills under their parent card’s slot', () => {
      const centreX = (id, width) => store.nodeById.get(id).position.x + width / 2
      expect(centreX('161f52', 96)).toBe(centreX('b0653a', 240))
    })
  })

  describe('insertNodes', () => {
    beforeEach(() => store.hydrate(payload))

    const node = (id) => store.nodeById.get(id)
    /** Every pair of nodes whose boxes touch: the flow should never have any. */
    const overlappingPairs = () => {
      const boxes = store.nodes.map((n) => {
        const size = getNodeSize(n)
        return {
          id: n.id,
          left: n.position.x,
          right: n.position.x + size.width,
          top: n.position.y,
          bottom: n.position.y + size.height,
        }
      })
      const pairs = []
      for (const [index, a] of boxes.entries()) {
        for (const b of boxes.slice(index + 1)) {
          const overlaps =
            a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
          if (overlaps) pairs.push([a.id, b.id])
        }
      }
      return pairs
    }
    const message = (id, parentId) => ({
      id,
      parentId,
      type: 'sendMessage',
      name: 'Follow up',
      data: { description: 'Checks in later', payload: [] },
    })
    const addMessage = (id, parentId) =>
      store.insertNodes([message(id, parentId)], { insertedId: id, continuationId: id })

    describe('after a step that has nothing following it', () => {
      it('adds the node one row below its parent, centred on it', () => {
        // Welcome Message is a leaf at { x: -120, y: 396 }.
        addMessage('new01', 'b0653a')

        expect(store.nodes).toHaveLength(8)
        expect(node('new01').position).toEqual({ x: -120, y: 396 + 88 + 64 })
      })

      it('connects it to its parent', () => {
        addMessage('new01', 'b0653a')

        expect(node('new01').parentId).toBe('b0653a')
        expect(store.edges).toContainEqual({
          id: 'e-b0653a-new01',
          source: 'b0653a',
          target: 'new01',
        })
      })

      it('returns the id of the node the user created', () => {
        expect(addMessage('new01', 'b0653a')).toBe('new01')
      })
    })

    describe('between a step and what used to follow it', () => {
      // Away Message (y 396) → Add Comment #1 (y 548).
      beforeEach(() => addMessage('new01', 'b6a0c1'))

      it('reattaches the following step under the new node', () => {
        expect(node('e879e4').parentId).toBe('new01')
        expect(store.edges).toContainEqual({
          id: 'e-new01-e879e4',
          source: 'new01',
          target: 'e879e4',
        })
        expect(store.edges).not.toContainEqual({
          id: 'e-b6a0c1-e879e4',
          source: 'b6a0c1',
          target: 'e879e4',
        })
      })

      it('moves the following step down so it does not overlap the new node', () => {
        expect(node('new01').position.y).toBe(548)
        expect(node('e879e4').position.y).toBe(548 + 88 + 64)
      })

      it('leaves the rest of the flow where it was', () => {
        expect(node('b6a0c1').position).toEqual({ x: 160, y: 396 })
        expect(node('b0653a').position).toEqual({ x: -120, y: 396 })
      })
    })

    it('moves a whole branch down, not just the node directly below', () => {
      // Inserting after Failure moves Away Message and the comment under it.
      const awayBefore = node('b6a0c1').position.y
      const commentBefore = node('e879e4').position.y

      addMessage('new01', '28c4b9')

      const shift = node('b6a0c1').position.y - awayBefore
      expect(shift).toBeGreaterThan(0)
      expect(node('e879e4').position.y - commentBefore).toBe(shift)
    })

    it('only ever moves followers down, even one the user dragged far below', () => {
      // The comment was dragged 600px down; inserting above it must not pull it back up.
      store.updateNodePositions([{ id: 'e879e4', position: { x: 160, y: 1148 } }])

      addMessage('new01', 'b6a0c1')

      expect(node('e879e4').position.y).toBe(1148 + 88 + 64)
    })

    it('keeps positions the user has dragged, instead of laying the flow out again', () => {
      store.updateNodePositions([{ id: '1', position: { x: 999, y: 999 } }])

      addMessage('new01', 'b0653a')

      expect(node('1').position).toEqual({ x: 999, y: 999 })
    })

    describe('a business hours node', () => {
      const created = [
        {
          id: 'bh01',
          parentId: 'b6a0c1',
          type: 'dateTime',
          name: 'Office hours',
          data: {
            description: 'Only during office hours',
            action: 'businessHours',
            timezone: 'UTC',
            times: [],
            connectors: ['ok01', 'no01'],
          },
        },
        {
          id: 'ok01',
          parentId: 'bh01',
          type: 'dateTimeConnector',
          name: 'Success',
          data: { connectorType: 'success' },
        },
        {
          id: 'no01',
          parentId: 'bh01',
          type: 'dateTimeConnector',
          name: 'Failure',
          data: { connectorType: 'failure' },
        },
      ]
      const addBusinessHours = () =>
        store.insertNodes(created, { insertedId: 'bh01', continuationId: 'ok01' })

      it('adds the condition and both of its branches', () => {
        addBusinessHours()

        expect(store.nodes).toHaveLength(10)
        expect(node('ok01').parentId).toBe('bh01')
        expect(node('no01').parentId).toBe('bh01')
      })

      it('puts the branches side by side, one row below the condition', () => {
        addBusinessHours()

        expect(node('ok01').position.y).toBe(node('bh01').position.y + 88 + 64)
        expect(node('no01').position.y).toBe(node('ok01').position.y)
        expect(node('no01').position.x - node('ok01').position.x).toBe(280)
      })

      it('moves the followers under their new parent, not just downwards', () => {
        addBusinessHours()

        const centre = (id, width) => node(id).position.x + width / 2
        expect(centre('e879e4', 240)).toBe(centre('ok01', 96))
      })

      it('leaves room for a later step on the failure branch', () => {
        addBusinessHours()
        addMessage('new02', 'no01')

        expect(node('new02').position.x).not.toBe(node('e879e4').position.x)
      })

      it('makes room for the new branch, so nothing ends up on top of anything else', () => {
        // Adding a condition after Success used to drop its failure pill onto Add Comment #1.
        store.insertNodes(created, { insertedId: 'bh01', continuationId: 'ok01' })

        expect(overlappingPairs()).toEqual([])
      })

      it('makes room when added on a branch beside another branch', () => {
        // The original overlap: a condition added after Success put its failure pill on top of
        // Add Comment #1, which lives on the neighbouring failure branch.
        const onSuccess = created.map((n) => (n.id === 'bh01' ? { ...n, parentId: '161f52' } : n))

        store.insertNodes(onSuccess, { insertedId: 'bh01', continuationId: 'ok01' })

        expect(overlappingPairs()).toEqual([])
        expect(node('b0653a').parentId).toBe('ok01')
      })

      it('arranges the whole flow again, since a condition changes the tree’s width', () => {
        store.updateNodePositions([{ id: '1', position: { x: 999, y: 999 } }])

        store.insertNodes(created, { insertedId: 'bh01', continuationId: 'ok01' })

        expect(node('1').position).not.toEqual({ x: 999, y: 999 })
      })

      it('continues the existing flow on the success branch', () => {
        addBusinessHours()

        expect(node('e879e4').parentId).toBe('ok01')
        expect(node('e879e4').position.y).toBe(node('ok01').position.y + 28 + 64)
      })
    })

    it('refuses to add a node after business hours, which branches instead', () => {
      expect(() => addMessage('new01', 'd09c08')).toThrow('which branches instead')
      expect(store.nodes).toHaveLength(7)
    })

    it.each([
      ['the new node is missing', { insertedId: 'ghost', continuationId: 'new01' }],
      ['the continuation is missing', { insertedId: 'new01', continuationId: 'ghost' }],
    ])('refuses to insert when %s', (_, placement) => {
      expect(() => store.insertNodes([message('new01', 'b0653a')], placement)).toThrow()
      expect(store.nodes).toHaveLength(7)
    })

    it('refuses to add a node after a step that does not exist', () => {
      expect(() => addMessage('new01', 'ghost')).toThrow(
        'Cannot add a node after unknown node "ghost"',
      )
      expect(store.nodes).toHaveLength(7)
    })

    it('normalises what the API returns, like the payload', () => {
      store.insertNodes([{ id: 'new01', parentId: 'b0653a', type: 'addComment' }], {
        insertedId: 'new01',
        continuationId: 'new01',
      })

      expect(node('new01').data).toEqual({})
      expect(store.nodeDisplayById.get('new01')).toEqual({
        title: 'Add Comment',
        description: 'No comment',
      })
    })
  })

  describe('updateNodePositions', () => {
    beforeEach(() => store.hydrate(payload))

    it('moves every node in the update', () => {
      store.updateNodePositions([
        { id: '1', position: { x: 1, y: 2 } },
        { id: 'd09c08', position: { x: 3, y: 4 } },
      ])

      expect(store.nodeById.get('1').position).toEqual({ x: 1, y: 2 })
      expect(store.nodeById.get('d09c08').position).toEqual({ x: 3, y: 4 })
    })

    it('copies the position rather than keeping the caller’s object', () => {
      const position = { x: 1, y: 2 }
      store.updateNodePositions([{ id: '1', position }])
      position.x = 100

      expect(store.nodeById.get('1').position.x).toBe(1)
    })

    it('ignores unknown ids', () => {
      const snapshot = () => store.nodes.map(({ id, position }) => ({ id, ...position }))
      const before = snapshot()

      store.updateNodePositions([{ id: 'missing', position: { x: 1, y: 1 } }])

      expect(snapshot()).toEqual(before)
    })
  })
})
