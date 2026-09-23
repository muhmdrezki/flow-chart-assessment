import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import payload from '../../public/payload.json'
import { createAppRouter } from '@/router'
import { useFlowStore } from '@/stores/flow'
import { useSelectedNode } from './useSelectedNode'

const AWAY_MESSAGE = 'b6a0c1'
const ADD_COMMENT = 'e879e4'
const SUCCESS_PILL = '161f52'

describe('useSelectedNode', () => {
  let router
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useFlowStore()
    router = createAppRouter(createMemoryHistory())
  })

  /** Mounts the composable at `path` and hands back what it returns. */
  async function selectionAt(path) {
    router.push(path)
    await router.isReady()

    let selection
    mount(
      defineComponent({
        setup() {
          selection = useSelectedNode()
          return () => h('div')
        },
      }),
      { global: { plugins: [router] } },
    )
    await flushPromises()
    return selection
  }

  describe('reading the URL', () => {
    it('has nothing selected on the canvas route', async () => {
      store.hydrate(payload)
      const { selectedNode } = await selectionAt('/')

      expect(selectedNode.value).toBeNull()
    })

    it('resolves the node the URL names', async () => {
      store.hydrate(payload)
      const { selectedNode } = await selectionAt(`/node/${AWAY_MESSAGE}`)

      expect(selectedNode.value.id).toBe(AWAY_MESSAGE)
    })

    it('follows the URL when it changes', async () => {
      store.hydrate(payload)
      const { selectedNode } = await selectionAt(`/node/${AWAY_MESSAGE}`)

      await router.push(`/node/${ADD_COMMENT}`)

      expect(selectedNode.value.id).toBe(ADD_COMMENT)
    })
  })

  describe('a link that cannot be opened', () => {
    beforeEach(() => store.hydrate(payload))

    it('goes back to the canvas for a node that is not in the flow', async () => {
      await selectionAt('/node/ghost')

      expect(router.currentRoute.value.fullPath).toBe('/')
    })

    it('goes back to the canvas for a branch pill, which has nothing to show', async () => {
      await selectionAt(`/node/${SUCCESS_PILL}`)

      expect(router.currentRoute.value.fullPath).toBe('/')
    })

    it('leaves no history entry behind, so Back does not bounce off it again', async () => {
      await selectionAt('/node/ghost')

      router.back()
      await flushPromises()

      expect(router.currentRoute.value.fullPath).toBe('/')
    })
  })

  describe('before the flow has loaded', () => {
    it('selects nothing and redirects nothing, so a shared link survives', async () => {
      const { selectedNode } = await selectionAt(`/node/${AWAY_MESSAGE}`)

      expect(selectedNode.value).toBeNull()
      expect(router.currentRoute.value.fullPath).toBe(`/node/${AWAY_MESSAGE}`)
    })

    it('opens the node as soon as the data arrives', async () => {
      const { selectedNode } = await selectionAt(`/node/${AWAY_MESSAGE}`)

      store.hydrate(payload)
      await flushPromises()

      expect(selectedNode.value.id).toBe(AWAY_MESSAGE)
    })
  })

  describe('selecting', () => {
    beforeEach(() => store.hydrate(payload))

    it('opens a node', async () => {
      const { select, selectedNode } = await selectionAt('/')

      select(AWAY_MESSAGE)
      await flushPromises()

      expect(router.currentRoute.value.fullPath).toBe(`/node/${AWAY_MESSAGE}`)
      expect(selectedNode.value.id).toBe(AWAY_MESSAGE)
    })

    it('closes the node that is already open, because clicking it toggles', async () => {
      const { select } = await selectionAt(`/node/${AWAY_MESSAGE}`)

      select(AWAY_MESSAGE)
      await flushPromises()

      expect(router.currentRoute.value.fullPath).toBe('/')
    })

    it('switches straight to another node', async () => {
      const { select, selectedNode } = await selectionAt(`/node/${AWAY_MESSAGE}`)

      select(ADD_COMMENT)
      await flushPromises()

      expect(selectedNode.value.id).toBe(ADD_COMMENT)
    })

    it('leaves a history entry, so Back steps back through the selection', async () => {
      const { select } = await selectionAt(`/node/${AWAY_MESSAGE}`)
      select(ADD_COMMENT)
      await flushPromises()

      router.back()
      await flushPromises()

      expect(router.currentRoute.value.fullPath).toBe(`/node/${AWAY_MESSAGE}`)
    })
  })

  describe('closing', () => {
    beforeEach(() => store.hydrate(payload))

    it('returns to the canvas', async () => {
      const { close } = await selectionAt(`/node/${AWAY_MESSAGE}`)

      close()
      await flushPromises()

      expect(router.currentRoute.value.fullPath).toBe('/')
    })

    it('does nothing when no node is open', async () => {
      const { close } = await selectionAt('/')

      close()
      await flushPromises()

      router.back()
      await flushPromises()

      // Still the canvas: closing an already-closed drawer added no entry to go back through.
      expect(router.currentRoute.value.fullPath).toBe('/')
    })
  })

  describe('a node that is deleted while it is open', () => {
    it('takes its URL with it, so the drawer closes itself', async () => {
      store.hydrate(payload)
      const { selectedNode } = await selectionAt(`/node/${AWAY_MESSAGE}`)
      expect(selectedNode.value.id).toBe(AWAY_MESSAGE)

      store.removeNodes({ removeIds: [AWAY_MESSAGE] })
      await flushPromises()

      expect(selectedNode.value).toBeNull()
      expect(router.currentRoute.value.fullPath).toBe('/')
    })

    it('leaves the drawer alone when a different node goes', async () => {
      store.hydrate(payload)
      const { selectedNode } = await selectionAt(`/node/${AWAY_MESSAGE}`)

      store.removeNodes({ removeIds: [ADD_COMMENT] })
      await flushPromises()

      expect(selectedNode.value.id).toBe(AWAY_MESSAGE)
    })
  })
})
