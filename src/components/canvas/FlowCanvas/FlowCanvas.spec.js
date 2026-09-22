import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import payload from '../../../../public/payload.json'
import { nodeTypes } from '@/components/nodes/nodeTypes'
import { useFlowStore } from '@/stores/flow'
import FlowCanvas from './FlowCanvas.vue'

// Vue Flow measures the DOM, which jsdom can't do. The canvas only has to hand Vue Flow the
// right props and react to its events, so stubs that record both are enough.
const stubs = vi.hoisted(() => ({}))

vi.mock('@vue-flow/core', async () => {
  const { defineComponent, h } = await import('vue')
  stubs.VueFlow = defineComponent({
    name: 'VueFlow',
    props: {
      nodes: Array,
      edges: Array,
      nodeTypes: Object,
      fitViewOnInit: Boolean,
      nodesConnectable: { type: Boolean, default: undefined },
      deleteKeyCode: { type: [String, null], default: undefined },
    },
    emits: ['nodeDragStop'],
    setup(_, { slots }) {
      return () => h('div', slots.default?.())
    },
  })
  // The node components import these; they're never rendered by the stub.
  return { VueFlow: stubs.VueFlow, Handle: {}, Position: { Top: 'top', Bottom: 'bottom' } }
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
    setActivePinia(createPinia())
    store = useFlowStore()
    store.hydrate(payload)
  })

  const vueFlow = (wrapper) => wrapper.findComponent(stubs.VueFlow)

  it('passes every store node to Vue Flow in its format', () => {
    const nodes = vueFlow(mount(FlowCanvas)).props('nodes')

    expect(nodes).toHaveLength(7)
    expect(nodes.find((node) => node.id === '1')).toEqual({
      id: '1',
      type: 'trigger',
      position: store.nodeById.get('1').position,
      data: { title: 'Trigger', description: 'Conversation Opened' },
    })
  })

  it('registers the custom node components', () => {
    expect(vueFlow(mount(FlowCanvas)).props('nodeTypes')).toBe(nodeTypes)
  })

  it('gives every payload node a type that has a component', () => {
    const types = vueFlow(mount(FlowCanvas))
      .props('nodes')
      .map((node) => node.type)
    expect(types.every((type) => type in nodeTypes)).toBe(true)
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

  it('saves every dragged node’s position to the store when a drag ends', () => {
    const wrapper = mount(FlowCanvas)

    vueFlow(wrapper).vm.$emit('nodeDragStop', {
      node: { id: '1' },
      nodes: [
        { id: '1', position: { x: 5, y: 6 }, selected: true },
        { id: 'd09c08', position: { x: 7, y: 8 } },
      ],
    })

    expect(store.nodeById.get('1').position).toEqual({ x: 5, y: 6 })
    expect(store.nodeById.get('d09c08').position).toEqual({ x: 7, y: 8 })
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

  it('renders the background and the zoom controls without the lock toggle', () => {
    const wrapper = mount(FlowCanvas)

    expect(wrapper.findComponent(stubs.Background).exists()).toBe(true)
    expect(wrapper.findComponent(stubs.Controls).props('showInteractive')).toBe(false)
  })
})
