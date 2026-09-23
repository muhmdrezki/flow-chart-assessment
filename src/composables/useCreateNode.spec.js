import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin, onlineManager } from '@tanstack/vue-query'
import payload from '../../public/payload.json'
import { NodeValidationError, createNode } from '@/api/flowApi'
import { queryClientConfig } from '@/config/queryClient'
import { useFlowStore } from '@/stores/flow'
import { useCreateNode } from './useCreateNode'

vi.mock('@/api/flowApi', async (importOriginal) => ({
  ...(await importOriginal()),
  createNode: vi.fn(),
}))

const VALUES = {
  title: 'Follow up',
  description: 'Checks in later',
  type: 'sendMessage',
  parentId: 'b6a0c1',
}

/** What the API returns for those values: one node added after Away Message. */
const CREATED = {
  nodes: [
    {
      id: 'new01',
      parentId: 'b6a0c1',
      type: 'sendMessage',
      name: 'Follow up',
      data: { description: 'Checks in later', payload: [] },
    },
  ],
  insertedId: 'new01',
  continuationId: 'new01',
}

describe('useCreateNode', () => {
  let store
  let pinia
  let queryClient

  beforeEach(() => {
    createNode.mockReset()
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
        composable = useCreateNode()
        return () => null
      },
    })
    mount(Host, { global: { plugins: [pinia, [VueQueryPlugin, { queryClient }]] } })
    return composable
  }

  it('adds the created node to the store once the request succeeds', async () => {
    createNode.mockResolvedValue(CREATED)
    const { create } = mountComposable()

    await create(VALUES)

    expect(store.nodes).toHaveLength(8)
    expect(store.nodeById.get('new01').name).toBe('Follow up')
  })

  it('sends the values with the current flow, so the API can check them', async () => {
    createNode.mockResolvedValue(CREATED)
    const { create } = mountComposable()

    await create(VALUES)

    expect(createNode).toHaveBeenCalledWith(VALUES, { nodes: store.nodes })
  })

  it('resolves with the new node’s id, which the canvas centres on', async () => {
    createNode.mockResolvedValue(CREATED)
    const { create } = mountComposable()

    await expect(create(VALUES)).resolves.toBe('new01')
  })

  it('reports progress while the request is in flight', async () => {
    let finish
    createNode.mockReturnValue(new Promise((resolve) => (finish = () => resolve(CREATED))))
    const composable = mountComposable()

    expect(composable.isPending.value).toBe(false)
    const pending = composable.create(VALUES)
    await vi.waitFor(() => expect(composable.isPending.value).toBe(true))

    finish()
    await pending
    expect(composable.isPending.value).toBe(false)
  })

  it('still creates when the browser reports no connection', async () => {
    // Creating never leaves the browser, so it must not wait for a connection to come back.
    createNode.mockResolvedValue(CREATED)
    const composable = mountComposable()
    onlineManager.setOnline(false)

    try {
      await expect(composable.create(VALUES)).resolves.toBe('new01')
      expect(composable.isPending.value).toBe(false)
    } finally {
      onlineManager.setOnline(true)
    }
  })

  describe('when the request fails', () => {
    const rejectWith = (error) => createNode.mockRejectedValue(error)

    it('leaves the store untouched', async () => {
      rejectWith(new NodeValidationError({ title: 'Title is required' }))
      const { create } = mountComposable()

      await expect(create(VALUES)).rejects.toThrow()
      expect(store.nodes).toHaveLength(7)
    })

    it('exposes the field messages for the form', async () => {
      rejectWith(new NodeValidationError({ title: 'Title is required' }))
      const composable = mountComposable()

      await composable.create(VALUES).catch(() => {})

      expect(composable.fieldErrors.value).toEqual({ title: 'Title is required' })
    })

    it('has no field messages for a failure that is not about the form', async () => {
      rejectWith(new Error('Network down'))
      const composable = mountComposable()

      await composable.create(VALUES).catch(() => {})

      expect(composable.error.value.message).toBe('Network down')
      expect(composable.fieldErrors.value).toEqual({})
    })

    it('does not retry, so a rejected create fails once', async () => {
      rejectWith(new Error('Network down'))
      const { create } = mountComposable()

      await create(VALUES).catch(() => {})

      expect(createNode).toHaveBeenCalledTimes(1)
    })

    it('clears the error when the form is reset', async () => {
      rejectWith(new NodeValidationError({ title: 'Title is required' }))
      const composable = mountComposable()
      await composable.create(VALUES).catch(() => {})

      composable.reset()

      await vi.waitFor(() => expect(composable.error.value).toBeNull())
      expect(composable.fieldErrors.value).toEqual({})
    })
  })
})
