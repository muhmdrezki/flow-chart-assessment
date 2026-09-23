import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin, onlineManager } from '@tanstack/vue-query'
import payload from '../../public/payload.json'
import { NodeValidationError, updateNode } from '@/api/flowApi'
import { queryClientConfig } from '@/config/queryClient'
import { useFlowStore } from '@/stores/flow'
import { useUpdateNode } from './useUpdateNode'

vi.mock('@/api/flowApi', async (importOriginal) => ({
  ...(await importOriginal()),
  updateNode: vi.fn(),
}))

const EDITED = {
  id: 'e879e4',
  parentId: 'b6a0c1',
  type: 'addComment',
  name: 'Renamed comment',
  data: { comment: 'Looked at it' },
}

/*
 * Saving an edit, with the same shape as create and delete: the request goes through Vue Query and
 * the store changes only in onSuccess. The negative case is the one worth having — a rejected save
 * must leave the flow exactly as it was, so the canvas can never show an edit the "server" refused.
 */
describe('useUpdateNode', () => {
  let store
  let pinia
  let queryClient

  beforeEach(() => {
    updateNode.mockReset()
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
        composable = useUpdateNode()
        return () => null
      },
    })
    mount(Host, { global: { plugins: [pinia, [VueQueryPlugin, { queryClient }]] } })
    return composable
  }

  it('puts the saved node into the store once the request succeeds', async () => {
    updateNode.mockResolvedValue(EDITED)
    const { save } = mountComposable()

    await save(EDITED)

    expect(store.nodeById.get('e879e4').name).toBe('Renamed comment')
    expect(store.nodes).toHaveLength(7)
  })

  it('sends the node with the current flow, so the API can check it', async () => {
    updateNode.mockResolvedValue(EDITED)
    const { save } = mountComposable()

    await save(EDITED)

    expect(updateNode).toHaveBeenCalledWith(EDITED, { nodes: store.nodes })
  })

  it('leaves the store untouched when the save fails', async () => {
    updateNode.mockRejectedValue(new Error('Nope'))
    const { save } = mountComposable()

    await expect(save(EDITED)).rejects.toThrow('Nope')

    expect(store.nodeById.get('e879e4').name).toBe('Add Comment #1')
  })

  it('hands the server’s field messages to the form', async () => {
    updateNode.mockRejectedValue(new NodeValidationError({ title: 'Title is required' }))
    const { save, fieldErrors } = mountComposable()

    await expect(save(EDITED)).rejects.toThrow()

    expect(fieldErrors.value).toEqual({ title: 'Title is required' })
  })

  it('has no field messages for a failure that is not about a field', async () => {
    updateNode.mockRejectedValue(new Error('Network down'))
    const { save, fieldErrors } = mountComposable()

    await expect(save(EDITED)).rejects.toThrow()

    expect(fieldErrors.value).toEqual({})
  })

  it('saves while offline: the request never leaves the browser', async () => {
    const wasOnline = onlineManager.isOnline()
    onlineManager.setOnline(false)
    updateNode.mockResolvedValue(EDITED)

    try {
      const { save } = mountComposable()
      await save(EDITED)

      expect(store.nodeById.get('e879e4').name).toBe('Renamed comment')
    } finally {
      onlineManager.setOnline(wasOnline)
    }
  })

  it('forgets an earlier failure when it is reset', async () => {
    updateNode.mockRejectedValue(new NodeValidationError({ title: 'Title is required' }))
    const { save, fieldErrors, reset } = mountComposable()
    await expect(save(EDITED)).rejects.toThrow()

    reset()

    expect(fieldErrors.value).toEqual({})
  })
})
