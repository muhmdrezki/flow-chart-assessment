import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import payload from '../../../../public/payload.json'
import AddStepButton from '@/components/canvas/AddStepButton/AddStepButton.vue'
import FlowEdge from '@/components/canvas/FlowEdge/FlowEdge.vue'
import ConnectorNode from '@/components/nodes/ConnectorNode/ConnectorNode.vue'
import NodeCard from '@/components/nodes/NodeCard/NodeCard.vue'
import { useFlowStore } from '@/stores/flow'
import { NODE_REGISTRY, getNodeSize } from '@/utils/nodeRegistry'
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
      nodeDragThreshold: { type: Number, default: 1 },
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
        // The real Vue Flow also works out where each edge's two ends are; the slot gets them too.
        const renderedEdges = (props.edges ?? []).map((edge) => {
          const slot = slots['edge-' + edge.type]
          const slotProps = {
            ...edge,
            sourceX: 0,
            sourceY: 0,
            targetX: 10,
            targetY: 20,
          }
          return h('div', { 'data-edge-id': edge.id }, slot?.(slotProps))
        })
        return h('div', [...renderedNodes, ...renderedEdges, slots.default?.()])
      }
    },
  })
  stubs.Handle = defineComponent({ name: 'Handle', render: () => null })
  stubs.setCenter = vi.fn()
  return {
    VueFlow: stubs.VueFlow,
    Handle: stubs.Handle,
    // What a custom edge draws with, stubbed the same way: the real ones need a live canvas.
    BaseEdge: defineComponent({ name: 'BaseEdge', props: { path: String }, render: () => null }),
    EdgeLabelRenderer: defineComponent({
      name: 'EdgeLabelRenderer',
      setup:
        (_, { slots }) =>
        () =>
          h('div', slots.default?.()),
    }),
    getBezierPath: () => ['M0,0 L10,20', 5, 10],
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
  const { defineComponent, h } = await import('vue')
  // Like the real one: the zoom buttons, with whatever the canvas puts above them in the column.
  stubs.Controls = defineComponent({
    name: 'Controls',
    props: { showInteractive: { type: Boolean, default: true } },
    setup:
      (_, { slots }) =>
      () =>
        h('div', { class: 'vue-flow__controls' }, slots.top?.()),
  })
  stubs.ControlButton = defineComponent({
    name: 'ControlButton',
    props: { title: String, disabled: Boolean },
    setup:
      (props, { slots }) =>
      () =>
        h(
          'button',
          {
            type: 'button',
            class: 'vue-flow__controls-button',
            title: props.title,
            disabled: props.disabled || undefined,
          },
          slots.default?.(),
        ),
  })
  return { Controls: stubs.Controls, ControlButton: stubs.ControlButton }
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

  it('names the step each edge would add after, so its "+" can say so', () => {
    const edges = vueFlow(mount(FlowCanvas)).props('edges')

    expect(edges.find((edge) => edge.id === 'e-1-d09c08').data).toEqual({
      canInsert: true,
      sourceTitle: 'Trigger',
    })
  })

  describe('the "+" under a step with nothing after it', () => {
    const addButton = (wrapper, id) => rendered(wrapper, id).findComponent(AddStepButton)

    it('is drawn under the ends of the flow, and nowhere else', () => {
      const wrapper = mount(FlowCanvas)

      // "Welcome Message" and "Add Comment #1" are where the payload's two branches stop.
      expect(addButton(wrapper, 'b0653a').exists()).toBe(true)
      expect(addButton(wrapper, 'e879e4').exists()).toBe(true)
      expect(addButton(wrapper, '1').exists()).toBe(false)
      expect(addButton(wrapper, 'd09c08').exists()).toBe(false)
    })

    it('names the step it would add after', () => {
      expect(addButton(mount(FlowCanvas), 'e879e4').props('title')).toBe('Add Comment #1')
    })

    it('asks for a step to be added after it', async () => {
      const wrapper = mount(FlowCanvas)

      await addButton(wrapper, 'b0653a').vm.$emit('add')

      expect(wrapper.emitted('insert-after')).toEqual([['b0653a']])
    })

    it('appears under a branch as soon as it has nothing after it', async () => {
      const wrapper = mount(FlowCanvas)
      expect(addButton(wrapper, '161f52').exists()).toBe(false)

      store.removeNodes({ removeIds: ['b0653a'] })
      await nextTick()

      expect(addButton(wrapper, '161f52').exists()).toBe(true)
    })
  })

  describe('undo and redo', () => {
    /** The buttons carry an icon, so what they say is in the title and the icon's own label. */
    const controlButton = (wrapper, label) =>
      wrapper.findAll('button').find((button) => button.attributes('title')?.includes(label))

    const mountWithHistory = (props = {}) =>
      mount(FlowCanvas, {
        props: { undoLabel: 'Undo: Delete Away Message', redoLabel: 'Nothing to redo', ...props },
      })

    it('sits in the canvas control column, beside the zoom buttons', () => {
      const wrapper = mountWithHistory()

      // Vue Flow's own control button, so the column reads as one set of controls.
      expect(controlButton(wrapper, 'Undo: Delete Away Message').classes()).toContain(
        'vue-flow__controls-button',
      )
    })

    it('says what it would take back, for a pointer and a screen reader alike', () => {
      const undo = controlButton(mountWithHistory(), 'Undo: Delete Away Message')

      expect(undo.attributes('title')).toBe('Undo: Delete Away Message')
    })

    it('asks the view to take the change back', async () => {
      const wrapper = mountWithHistory({ canUndo: true })

      await controlButton(wrapper, 'Undo: Delete Away Message').trigger('click')

      expect(wrapper.emitted('undo')).toHaveLength(1)
    })

    it('is turned off when there is nothing to take back', () => {
      const wrapper = mountWithHistory({ canUndo: false, canRedo: true })

      expect(controlButton(wrapper, 'Undo:').attributes('disabled')).toBeDefined()
      expect(controlButton(wrapper, 'Nothing to redo').attributes('disabled')).toBeUndefined()
    })
  })

  it('asks for a step to be added where a "+" was clicked', async () => {
    const wrapper = mount(FlowCanvas)

    await wrapper.findComponent(FlowEdge).vm.$emit('insert', 'd09c08')

    expect(wrapper.emitted('insert-after')).toEqual([['d09c08']])
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

  it('lets it wobble while clicking a step, instead of calling it a drag', () => {
    // One pixel is Vue Flow's default, and the drag swallows the click that ended it — so clicking
    // quickly from step to step opened nothing and the drawer stayed on the step before.
    expect(vueFlow(mount(FlowCanvas)).props('nodeDragThreshold')).toBeGreaterThan(1)
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
      const node = store.nodeById.get('b6a0c1')
      const { width, height } = getNodeSize(node)

      await wrapper.vm.focusNode('b6a0c1')

      // The card's middle: half its own size past its top-left corner.
      expect(stubs.setCenter).toHaveBeenCalledWith(
        node.position.x + width / 2,
        node.position.y + height / 2,
        {
          zoom: 1.5,
          duration: 400,
        },
      )
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
