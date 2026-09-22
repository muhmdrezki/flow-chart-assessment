import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import payload from '../../public/payload.json'
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
        b0653a: { title: 'Welcome Message', description: 'Hello there welcome to the chat!' },
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
