import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import payload from '../../../public/payload.json'
import { useFlowLoader } from '@/composables/useFlowLoader'
import { createAppRouter } from '@/router'
import { useFlowStore } from '@/stores/flow'
import FlowView from './FlowView.vue'

vi.mock('@/composables/useFlowLoader', () => ({ useFlowLoader: vi.fn() }))

const stubs = vi.hoisted(() => ({ focusNode: vi.fn() }))

// The canvas has its own tests; here it only matters whether it is shown, what it is told is
// selected, and that the view asks it to move to a new node.
vi.mock('@/components/canvas/FlowCanvas/FlowCanvas.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'FlowCanvas',
      props: { selectedId: { type: String, default: null } },
      emits: ['select', 'deselect'],
      setup: (_, { expose }) => {
        expose({ focusNode: stubs.focusNode })
        return () => h('div', { id: 'canvas' })
      },
    }),
  }
})

// Both drawers have their own tests; here only their props and events matter.
vi.mock('@/components/forms/CreateNodeDrawer/CreateNodeDrawer.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'CreateNodeDrawer',
      props: { open: Boolean },
      emits: ['close', 'created'],
      render: () => h('div', { id: 'create-drawer' }),
    }),
  }
})

vi.mock('@/components/drawer/NodeDetailsDrawer/NodeDetailsDrawer.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'NodeDetailsDrawer',
      props: { node: { type: Object, default: null } },
      emits: ['close'],
      render: () => h('div', { id: 'details-drawer' }),
    }),
  }
})

describe('FlowView', () => {
  let loader
  let router

  beforeEach(async () => {
    setActivePinia(createPinia())
    loader = {
      isPending: ref(false),
      isError: ref(false),
      isFetching: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    }
    useFlowLoader.mockReturnValue(loader)

    router = createAppRouter(createMemoryHistory())
    router.push('/')
    await router.isReady()
  })

  const mountView = () => mount(FlowView, { global: { plugins: [router] } })

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

  describe('creating a node', () => {
    const drawer = (wrapper) => wrapper.findComponent({ name: 'CreateNodeDrawer' })
    const createButton = (wrapper) =>
      wrapper.findAll('header button').find((button) => button.text().includes('Create New Node'))

    beforeEach(() => {
      stubs.focusNode.mockClear()
      useFlowStore().isHydrated = true
    })

    it('offers the button only once there is a flow to add to', () => {
      useFlowStore().isHydrated = false
      expect(createButton(mountView())).toBeUndefined()

      useFlowStore().isHydrated = true
      expect(createButton(mountView())).toBeDefined()
    })

    it('keeps the drawer closed until the button is used', () => {
      expect(drawer(mountView()).props('open')).toBe(false)
    })

    it('opens the drawer from the header button', async () => {
      const wrapper = mountView()

      await createButton(wrapper).trigger('click')

      expect(drawer(wrapper).props('open')).toBe(true)
    })

    it('closes the drawer when it asks to be closed', async () => {
      const wrapper = mountView()
      await createButton(wrapper).trigger('click')

      await drawer(wrapper).vm.$emit('close')

      expect(drawer(wrapper).props('open')).toBe(false)
    })

    it('puts away an open node first, so two panels never stack up', async () => {
      useFlowStore().hydrate(payload)
      const wrapper = mountView()
      wrapper.findComponent({ name: 'FlowCanvas' }).vm.$emit('select', 'b6a0c1')
      await flushPromises()

      await createButton(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.findComponent({ name: 'NodeDetailsDrawer' }).props('node')).toBeNull()
      expect(drawer(wrapper).props('open')).toBe(true)
    })

    it('moves the canvas to the node that was created', async () => {
      const wrapper = mountView()

      await drawer(wrapper).vm.$emit('created', 'new01')

      expect(stubs.focusNode).toHaveBeenCalledWith('new01')
    })
  })

  describe('opening a node', () => {
    const canvas = (wrapper) => wrapper.findComponent({ name: 'FlowCanvas' })
    const details = (wrapper) => wrapper.findComponent({ name: 'NodeDetailsDrawer' })

    /** Emits a canvas event and lets the navigation it causes settle. */
    async function fromCanvas(wrapper, event, ...args) {
      canvas(wrapper).vm.$emit(event, ...args)
      await flushPromises()
    }

    beforeEach(() => {
      useFlowStore().hydrate(payload)
    })

    it('shows no drawer until a node is selected', () => {
      const wrapper = mountView()

      expect(details(wrapper).props('node')).toBeNull()
      expect(canvas(wrapper).props('selectedId')).toBeNull()
    })

    it('puts the selected node in the URL and in the drawer', async () => {
      const wrapper = mountView()

      await fromCanvas(wrapper, 'select', 'b6a0c1')

      expect(router.currentRoute.value.fullPath).toBe('/node/b6a0c1')
      expect(details(wrapper).props('node').id).toBe('b6a0c1')
      expect(canvas(wrapper).props('selectedId')).toBe('b6a0c1')
    })

    it('closes when the open node is clicked again', async () => {
      const wrapper = mountView()
      await fromCanvas(wrapper, 'select', 'b6a0c1')

      await fromCanvas(wrapper, 'select', 'b6a0c1')

      expect(router.currentRoute.value.fullPath).toBe('/')
      expect(details(wrapper).props('node')).toBeNull()
    })

    it('switches to another node without closing in between', async () => {
      const wrapper = mountView()
      await fromCanvas(wrapper, 'select', 'b6a0c1')

      await fromCanvas(wrapper, 'select', 'e879e4')

      expect(details(wrapper).props('node').id).toBe('e879e4')
    })

    it('closes when the empty canvas is clicked', async () => {
      const wrapper = mountView()
      await fromCanvas(wrapper, 'select', 'b6a0c1')

      await fromCanvas(wrapper, 'deselect')

      expect(router.currentRoute.value.fullPath).toBe('/')
    })

    it('closes when the drawer asks to be closed', async () => {
      const wrapper = mountView()
      await fromCanvas(wrapper, 'select', 'b6a0c1')

      details(wrapper).vm.$emit('close')
      await flushPromises()

      expect(router.currentRoute.value.fullPath).toBe('/')
    })

    it('opens the node a shared link names', async () => {
      router.push('/node/e879e4')
      await router.isReady()

      const wrapper = mountView()
      await flushPromises()

      expect(details(wrapper).props('node').id).toBe('e879e4')
    })

    it('goes back to the canvas when the link names a node that cannot be opened', async () => {
      router.push('/node/161f52')
      await router.isReady()

      mountView()
      await flushPromises()

      expect(router.currentRoute.value.fullPath).toBe('/')
    })
  })
})
