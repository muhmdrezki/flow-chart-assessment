import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import payload from '../../../../public/payload.json'
import ConnectorNode from '@/components/nodes/ConnectorNode/ConnectorNode.vue'
import NodeCard from '@/components/nodes/NodeCard/NodeCard.vue'
import { useFlowStore } from '@/stores/flow'
import { NODE_REGISTRY } from '@/utils/nodeRegistry'
import FlowCanvas from './FlowCanvas.vue'

// Vue Flow measures the DOM, which jsdom can't do. The stub records the props it's given and,
// like Vue Flow, renders the "node-<type>" slot for each node with that node's props.
const stubs = vi.hoisted(() => ({}))

vi.mock('@vue-flow/core', async () => {
  const { defineComponent, h } = await import('vue')
  stubs.VueFlow = defineComponent({
    name: 'VueFlow',
    props: {
      nodes: { type: Array, default: () => [] },
      edges: Array,
      fitViewOnInit: Boolean,
      nodesConnectable: { type: Boolean, default: undefined },
      nodesFocusable: { type: Boolean, default: undefined },
      paneClickDistance: { type: Number, default: 0 },
      disableKeyboardA11y: { type: Boolean, default: false },
      deleteKeyCode: { type: [String, null], default: undefined },
    },
    emits: ['nodeClick', 'nodeDragStop', 'paneClick'],
    setup(props, { slots }) {
      return () => {
        stubs.slotNames = Object.keys(slots)
        const renderedNodes = props.nodes.map((node) => {
          const slot = slots['node-' + node.type]
          const slotProps = {
            id: node.id,
            type: node.type,
            data: node.data,
            selected: node.id === stubs.selectedId,
            position: node.position,
            dragging: false,
          }
          return h('div', { 'data-node-id': node.id }, slot?.(slotProps))
        })
        return h('div', [...renderedNodes, slots.default?.()])
      }
    },
  })
  stubs.Handle = defineComponent({ name: 'Handle', render: () => null })
  stubs.setCenter = vi.fn()
  return {
    VueFlow: stubs.VueFlow,
    Handle: stubs.Handle,
    Position: { Top: 'top', Bottom: 'bottom' },
    // The canvas moves the viewport through this, so the spies stand in for the real flow instance.
    useVueFlow: () => ({ setCenter: stubs.setCenter, getViewport: () => ({ zoom: 1.5 }) }),
  }
})

vi.mock('@vue-flow/background', async () => {
  const { defineComponent } = await import('vue')
  stubs.Background = defineComponent({ name: 'Background', render: () => null })
  return { Background: stubs.Background }
})

vi.mock('@vue-flow/controls', async () => {
  const { defineComponent } = await import('vue')
  stubs.Controls = defineComponent({
    name: 'Controls',
    props: { showInteractive: { type: Boolean, default: true } },
    render: () => null,
  })
  return { Controls: stubs.Controls }
})

describe('FlowCanvas', () => {
  let store

  beforeEach(() => {
    stubs.selectedId = null
    stubs.setCenter.mockClear()
    setActivePinia(createPinia())
    store = useFlowStore()
    store.hydrate(payload)
  })

  const vueFlow = (wrapper) => wrapper.findComponent(stubs.VueFlow)
  const rendered = (wrapper, id) => wrapper.find('[data-node-id="' + id + '"]')
  const clickNode = (wrapper, id) => vueFlow(wrapper).vm.$emit('nodeClick', { node: { id } })
  const dragTo = (wrapper, nodes) => vueFlow(wrapper).vm.$emit('nodeDragStop', { nodes })

  it('passes every store node to Vue Flow in its format', () => {
    const nodes = vueFlow(mount(FlowCanvas)).props('nodes')

    expect(nodes).toHaveLength(7)
    expect(nodes.find((node) => node.id === '1')).toEqual({
      id: '1',
      type: 'trigger',
      position: store.nodeById.get('1').position,
      data: {
        title: 'Trigger',
        description: '',
        summary: { label: '', text: 'Conversation Opened' },
      },
    })
  })

  it('has a node slot for every registered kind', () => {
    mount(FlowCanvas)

    for (const kind of Object.keys(NODE_REGISTRY)) {
      expect(stubs.slotNames).toContain('node-' + kind)
    }
  })

  describe('rendering each node', () => {
    it.each([
      ['1', 'trigger'],
      ['d09c08', 'businessHours'],
      ['b6a0c1', 'sendMessage'],
      ['b0653a', 'sendMessage'],
      ['e879e4', 'addComment'],
    ])('renders %s as a NodeCard of type %s', (id, type) => {
      const card = rendered(mount(FlowCanvas), id).findComponent(NodeCard)

      expect(card.props()).toEqual({
        type,
        data: store.nodeDisplayById.get(id),
        selected: false,
      })
    })

    it.each([
      ['161f52', 'success'],
      ['28c4b9', 'failure'],
    ])('renders %s as a %s pill', (id, type) => {
      const node = rendered(mount(FlowCanvas), id)

      expect(node.findComponent(NodeCard).exists()).toBe(false)
      expect(node.findComponent(ConnectorNode).props()).toEqual({
        type,
        data: store.nodeDisplayById.get(id),
      })
    })

    it('draws every pill kind with ConnectorNode and every card kind with NodeCard', () => {
      store.nodes.push({ id: 'x', parentId: '1', type: 'webhook', data: {}, position: {} })
      const wrapper = mount(FlowCanvas)

      for (const node of vueFlow(wrapper).props('nodes')) {
        const component = NODE_REGISTRY[node.type].variant === 'pill' ? ConnectorNode : NodeCard
        expect(rendered(wrapper, node.id).findComponent(component).exists()).toBe(true)
      }
    })

    it('rings the node the URL names, not the one Vue Flow thinks is selected', () => {
      const wrapper = mount(FlowCanvas, { props: { selectedId: 'd09c08' } })

      expect(rendered(wrapper, 'd09c08').findComponent(NodeCard).props('selected')).toBe(true)
      expect(rendered(wrapper, '1').findComponent(NodeCard).props('selected')).toBe(false)
    })

    it('renders a node of an unrecognised type with the unknown card', () => {
      store.nodes.push({ id: 'x', parentId: '1', type: 'webhook', data: {}, position: {} })
      const card = rendered(mount(FlowCanvas), 'x').findComponent(NodeCard)

      expect(card.props('type')).toBe('unknown')
    })
  })

  it('keeps each node’s display data identical across a drag', async () => {
    const wrapper = mount(FlowCanvas)
    const before = vueFlow(wrapper).props('nodes')

    store.updateNodePositions([{ id: '1', position: { x: 11, y: 12 } }])
    await nextTick()

    const after = vueFlow(wrapper).props('nodes')
    expect(after).not.toBe(before)
    after.forEach((node, index) => expect(node.data).toBe(before[index].data))
  })

  it('passes the derived edges with their colour classes', () => {
    const edges = vueFlow(mount(FlowCanvas)).props('edges')

    expect(edges).toHaveLength(6)
    expect(edges.find((edge) => edge.id === 'e-1-d09c08').class).toBe('edge--trigger')
    expect(edges.find((edge) => edge.id === 'e-161f52-b0653a').class).toBe('edge--businessHours')
  })

  it('turns off graph editing inside Vue Flow', () => {
    const props = vueFlow(mount(FlowCanvas)).props()

    expect(props.nodesConnectable).toBe(false)
    expect(props.deleteKeyCode).toBeNull()
    expect(props.fitViewOnInit).toBe(true)
  })

  it('lets each node card own the keyboard, rather than Vue Flow', () => {
    const props = vueFlow(mount(FlowCanvas)).props()

    expect(props.nodesFocusable).toBe(false)
    // Otherwise the arrow keys would move a node inside Vue Flow, where the store never hears it.
    expect(props.disableKeyboardA11y).toBe(true)
  })

  it('lets a hand wobble while clicking the canvas, instead of calling it a pan', () => {
    // Vue Flow allows no movement at all by default, so a pixel of drift swallows the click that
    // would have closed the drawer.
    expect(vueFlow(mount(FlowCanvas)).props('paneClickDistance')).toBeGreaterThan(0)
  })

  it('leaves a position the drag did not change alone', () => {
    const wrapper = mount(FlowCanvas)
    const { position } = store.nodeById.get('1')

    dragTo(wrapper, [{ id: '1', position: { ...position } }])

    expect(store.nodeById.get('1').position).toBe(position)
  })

  it('saves every dragged node’s position to the store when a drag ends', () => {
    const wrapper = mount(FlowCanvas)

    dragTo(wrapper, [
      { id: '1', position: { x: 5, y: 6 }, selected: true },
      { id: 'd09c08', position: { x: 7, y: 8 } },
    ])

    expect(store.nodeById.get('1').position).toEqual({ x: 5, y: 6 })
    expect(store.nodeById.get('d09c08').position).toEqual({ x: 7, y: 8 })
  })

  describe('selecting a node', () => {
    it('asks for the clicked node to be opened', () => {
      const wrapper = mount(FlowCanvas)

      clickNode(wrapper, 'b6a0c1')

      expect(wrapper.emitted('select')).toEqual([['b6a0c1']])
    })

    it('ignores a branch pill, which has nothing to show', () => {
      const wrapper = mount(FlowCanvas)

      clickNode(wrapper, '161f52')

      expect(wrapper.emitted('select')).toBeUndefined()
    })

    it('opens a node activated from the keyboard', () => {
      const wrapper = mount(FlowCanvas)

      rendered(wrapper, 'b6a0c1').findComponent(NodeCard).vm.$emit('activate')

      expect(wrapper.emitted('select')).toEqual([['b6a0c1']])
    })

    it('asks to close when the empty canvas is clicked', () => {
      const wrapper = mount(FlowCanvas)

      vueFlow(wrapper).vm.$emit('paneClick')

      expect(wrapper.emitted('deselect')).toHaveLength(1)
    })

    it('still opens a node that was pressed and let go without moving', () => {
      // Vue Flow only reports a drag once the pointer has moved, and d3-drag swallows the click
      // that ends a real drag, so a click here is always a click.
      const wrapper = mount(FlowCanvas)
      const { position } = store.nodeById.get('b6a0c1')

      dragTo(wrapper, [{ id: 'b6a0c1', position: { ...position } }])
      clickNode(wrapper, 'b6a0c1')

      expect(wrapper.emitted('select')).toEqual([['b6a0c1']])
    })
  })

  it('re-renders Vue Flow when the store changes', async () => {
    const wrapper = mount(FlowCanvas)

    store.updateNodePositions([{ id: '1', position: { x: 11, y: 12 } }])
    await nextTick()

    const trigger = vueFlow(wrapper)
      .props('nodes')
      .find((node) => node.id === '1')
    expect(trigger.position).toEqual({ x: 11, y: 12 })
  })

  describe('focusNode', () => {
    it('centres the viewport on the node, keeping the current zoom', async () => {
      const wrapper = mount(FlowCanvas)
      const { position } = store.nodeById.get('b6a0c1')

      await wrapper.vm.focusNode('b6a0c1')

      // A card is 240 × 88, so its middle is half of each past its top-left corner.
      expect(stubs.setCenter).toHaveBeenCalledWith(position.x + 120, position.y + 44, {
        zoom: 1.5,
        duration: 400,
      })
    })

    it('measures pills by their own size', async () => {
      const wrapper = mount(FlowCanvas)
      const { position } = store.nodeById.get('161f52')

      await wrapper.vm.focusNode('161f52')

      expect(stubs.setCenter).toHaveBeenCalledWith(
        position.x + 48,
        position.y + 14,
        expect.anything(),
      )
    })

    it('moves without an animation when the viewer asked for less motion', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true }))
      const wrapper = mount(FlowCanvas)

      await wrapper.vm.focusNode('b6a0c1')

      expect(stubs.setCenter).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({ duration: 0 }),
      )
    })

    it('does nothing for a node that is not in the flow', async () => {
      const wrapper = mount(FlowCanvas)

      await wrapper.vm.focusNode('ghost')

      expect(stubs.setCenter).not.toHaveBeenCalled()
    })
  })

  it('renders the background and the zoom controls without the lock toggle', () => {
    const wrapper = mount(FlowCanvas)

    expect(wrapper.findComponent(stubs.Background).exists()).toBe(true)
    expect(wrapper.findComponent(stubs.Controls).props('showInteractive')).toBe(false)
  })
})
