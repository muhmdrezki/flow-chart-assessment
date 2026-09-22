import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import ConnectorNode from './ConnectorNode.vue'

const stubs = vi.hoisted(() => ({}))
vi.mock('@vue-flow/core', async () => {
  const { defineComponent, h } = await import('vue')
  stubs.Handle = defineComponent({
    name: 'Handle',
    props: { type: String, position: String },
    setup: (props) => () => h('span', { 'data-handle': props.type }),
  })
  return { Handle: stubs.Handle, Position: { Top: 'top', Bottom: 'bottom' } }
})

const mountPill = (type, props = {}) =>
  mount(ConnectorNode, {
    props: { type, data: { title: type === 'success' ? 'Success' : 'Failure' }, ...props },
  })

describe('ConnectorNode', () => {
  it.each([
    ['success', 'Success', 'check', '--color-kind-success'],
    ['failure', 'Failure', 'x', '--color-kind-failure'],
  ])('renders the %s pill', (type, label, icon, accent) => {
    const wrapper = mountPill(type)

    expect(wrapper.text()).toBe(label)
    expect(wrapper.findComponent(BaseIcon).props('name')).toBe(icon)
    expect(wrapper.attributes('style')).toContain(`--accent: var(${accent})`)
    expect(wrapper.attributes('data-kind')).toBe(type)
  })

  it('is display-only', () => {
    const wrapper = mountPill('success')

    expect(wrapper.attributes('data-editable')).toBe('false')
    expect(wrapper.classes()).toContain('cursor-default')
  })

  it('sits on the branch line with an input and an output handle', () => {
    const handles = mountPill('failure')
      .findAllComponents(stubs.Handle)
      .map((handle) => handle.props())

    expect(handles).toEqual([
      { type: 'target', position: 'top' },
      { type: 'source', position: 'bottom' },
    ])
  })

  it('highlights its border when selected', () => {
    expect(mountPill('success', { selected: true }).classes()).toContain('border-(--accent)')
    expect(mountPill('success').classes()).toContain('border-(--accent)/40')
  })

  it('does not turn Vue Flow’s other node props into attributes', () => {
    const wrapper = mount(ConnectorNode, {
      props: { type: 'success', data: { title: 'Success' } },
      attrs: { position: { x: 1, y: 2 } },
    })
    expect(wrapper.attributes('position')).toBeUndefined()
  })
})
