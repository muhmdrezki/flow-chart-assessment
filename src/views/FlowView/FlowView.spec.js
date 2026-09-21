import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useFlowLoader } from '@/composables/useFlowLoader'
import { useFlowStore } from '@/stores/flow'
import FlowView from './FlowView.vue'

vi.mock('@/composables/useFlowLoader', () => ({ useFlowLoader: vi.fn() }))

// The canvas has its own tests; here it only matters whether it is shown.
vi.mock('@/components/canvas/FlowCanvas/FlowCanvas.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({ name: 'FlowCanvas', render: () => h('div', { id: 'canvas' }) }),
  }
})

describe('FlowView', () => {
  let loader

  beforeEach(() => {
    setActivePinia(createPinia())
    loader = {
      isPending: ref(false),
      isError: ref(false),
      isFetching: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    }
    useFlowLoader.mockReturnValue(loader)
  })

  const mountView = () => mount(FlowView, { global: { stubs: { RouterView: true } } })

  it('shows the app title', () => {
    expect(mountView().find('h1').text()).toBe('Flow Builder')
  })

  it('shows a loading status while the flow loads', () => {
    loader.isPending.value = true
    const wrapper = mountView()

    expect(wrapper.find('[role="status"]').text()).toBe('Loading flow…')
    expect(wrapper.find('#canvas').exists()).toBe(false)
  })

  describe('when loading fails', () => {
    beforeEach(() => {
      loader.isError.value = true
      loader.error.value = new Error('Invalid flow payload: node at index 0 is not an object')
    })

    it('shows the error as an alert', () => {
      const alert = mountView().find('[role="alert"]')

      expect(alert.text()).toContain("Couldn't load the flow")
      expect(alert.text()).toContain('Invalid flow payload: node at index 0 is not an object')
    })

    it('retries without passing the click event to refetch', async () => {
      const wrapper = mountView()
      await wrapper.find('button').trigger('click')

      expect(loader.refetch).toHaveBeenCalledOnce()
      expect(loader.refetch).toHaveBeenCalledWith()
    })

    it('shows the retry as busy while refetching', () => {
      loader.isFetching.value = true
      expect(mountView().find('button').attributes('aria-busy')).toBe('true')
    })
  })

  it('shows the canvas once the store is hydrated', () => {
    useFlowStore().isHydrated = true
    const wrapper = mountView()

    expect(wrapper.find('#canvas').exists()).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('never shows a blank canvas when the store failed to hydrate', () => {
    const wrapper = mountView()

    expect(wrapper.find('#canvas').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').text()).toContain("Couldn't display the flow")
  })
})
