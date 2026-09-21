import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import payload from '../../public/payload.json'
import { InvalidPayloadError, fetchFlow } from '@/api/flowApi'
import { queryClientConfig } from '@/config/queryClient'
import { useFlowStore } from '@/stores/flow'
import { useFlowLoader } from './useFlowLoader'

vi.mock('@/api/flowApi', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchFlow: vi.fn(),
}))

describe('useFlowLoader', () => {
  let pinia
  let queryClient

  beforeEach(() => {
    fetchFlow.mockReset()
    pinia = createPinia()
    setActivePinia(pinia)
    // The app's real config, so caching behaves as it does in production.
    queryClient = new QueryClient(queryClientConfig)
  })

  function mountLoader() {
    let loader
    const Host = defineComponent({
      setup() {
        loader = useFlowLoader()
        return () => null
      },
    })
    const wrapper = mount(Host, {
      global: { plugins: [pinia, [VueQueryPlugin, { queryClient }]] },
    })
    return { wrapper, loader }
  }

  it('hands the payload to the store once it has loaded', async () => {
    fetchFlow.mockResolvedValue(payload)
    const { loader } = mountLoader()
    const store = useFlowStore()

    expect(loader.isPending.value).toBe(true)
    await vi.waitFor(() => expect(store.isHydrated).toBe(true))

    expect(store.nodes).toHaveLength(7)
    expect(loader.isPending.value).toBe(false)
    expect(loader.isError.value).toBe(false)
  })

  it('exposes load errors without hydrating the store', async () => {
    fetchFlow.mockRejectedValue(new InvalidPayloadError('Invalid flow payload: bad'))
    const { loader } = mountLoader()

    await vi.waitFor(() => expect(loader.isError.value).toBe(true))

    expect(loader.error.value.message).toBe('Invalid flow payload: bad')
    expect(useFlowStore().isHydrated).toBe(false)
  })

  it('does not retry invalid content', async () => {
    fetchFlow.mockRejectedValue(new InvalidPayloadError('Invalid flow payload: bad'))
    const { loader } = mountLoader()

    await vi.waitFor(() => expect(loader.isError.value).toBe(true))

    expect(fetchFlow).toHaveBeenCalledTimes(1)
  })

  it('reuses cached data on remount without overwriting changes', async () => {
    fetchFlow.mockResolvedValue(payload)
    const first = mountLoader()
    const store = useFlowStore()
    await vi.waitFor(() => expect(store.isHydrated).toBe(true))

    store.updateNodePositions([{ id: '1', position: { x: 42, y: 42 } }])
    first.wrapper.unmount()
    const second = mountLoader()

    expect(second.loader.isPending.value).toBe(false)
    expect(fetchFlow).toHaveBeenCalledTimes(1)
    expect(store.nodeById.get('1').position).toEqual({ x: 42, y: 42 })
  })

  it('returns request status only, never the data', () => {
    fetchFlow.mockResolvedValue(payload)
    const { loader } = mountLoader()

    expect(Object.keys(loader).sort()).toEqual(
      ['error', 'isError', 'isFetching', 'isPending', 'refetch'].sort(),
    )
  })
})
