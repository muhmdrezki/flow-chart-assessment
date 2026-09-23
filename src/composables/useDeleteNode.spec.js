import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin, onlineManager } from '@tanstack/vue-query'
import payload from '../../public/payload.json'
import { deleteNode } from '@/api/flowApi'
import { queryClientConfig } from '@/config/queryClient'
import { useFlowStore } from '@/stores/flow'
import { useDeleteNode } from './useDeleteNode'

vi.mock('@/api/flowApi', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteNode: vi.fn(),
}))

/** Deleting Away Message: the comment under it moves up to the Failure branch. */
const REMOVAL = {
  removeIds: ['b6a0c1'],
  reparent: [{ id: 'e879e4', parentId: '28c4b9' }],
  shift: { ids: ['e879e4'], dy: -152 },
}

describe('useDeleteNode', () => {
  let store
  let pinia
  let queryClient

  beforeEach(() => {
    deleteNode.mockReset()
    pinia = createPinia()
    setActivePinia(pinia)
    store = useFlowStore()
    store.hydrate(payload)
    queryClient = new QueryClient(queryClientConfig)
  })

  function mountComposable() {
    let composable
    const Host = defineComponent({
      setup() {
        composable = useDeleteNode()
        return () => null
      },
    })
    mount(Host, { global: { plugins: [pinia, [VueQueryPlugin, { queryClient }]] } })
    return composable
  }

  it('applies the removal to the store once the request succeeds', async () => {
    deleteNode.mockResolvedValue(REMOVAL)
    const { remove } = mountComposable()

    await remove('b6a0c1')

    expect(store.nodeById.has('b6a0c1')).toBe(false)
    expect(store.nodeById.get('e879e4').parentId).toBe('28c4b9')
  })

  it('sends the id with the current flow, so the API can work out what else goes', async () => {
    deleteNode.mockResolvedValue(REMOVAL)
    const { remove } = mountComposable()
    // The flow as it was before the delete: the store holds a shorter list afterwards.
    const sent = [...store.nodes]

    await remove('b6a0c1')

    expect(deleteNode).toHaveBeenCalledWith('b6a0c1', { nodes: sent })
  })

  it('leaves the flow alone when the request fails', async () => {
    deleteNode.mockRejectedValue(new Error("That step can't be deleted."))
    const { remove } = mountComposable()

    await expect(remove('1')).rejects.toThrow("That step can't be deleted.")

    expect(store.nodes).toHaveLength(7)
  })

  it('deletes while offline: the request never leaves the browser', async () => {
    const wasOnline = onlineManager.isOnline()
    onlineManager.setOnline(false)
    deleteNode.mockResolvedValue(REMOVAL)

    try {
      const { remove } = mountComposable()
      await remove('b6a0c1')

      expect(store.nodes).toHaveLength(6)
    } finally {
      onlineManager.setOnline(wasOnline)
    }
  })
})
