import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import NodeCard from './NodeCard.vue'

// Handle needs a surrounding Vue Flow instance; a stub that records its props is enough here.
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

const mountCard = (props = {}) =>
  mount(NodeCard, {
    props: {
      type: 'sendMessage',
      data: { title: 'Welcome Message', description: 'Hello there welcome to the chat!' },
      ...props,
    },
  })

const handles = (wrapper) => wrapper.findAllComponents(stubs.Handle).map((handle) => handle.props())

describe('NodeCard', () => {
  it('shows the title', () => {
    expect(mountCard().text()).toContain('Welcome Message')
  })

  it('clamps the description to two lines and shows the full text on hover', () => {
    const description = mountCard().find('p.line-clamp-2')

    expect(description.text()).toBe('Hello there welcome to the chat!')
    expect(description.attributes('title')).toBe('Hello there welcome to the chat!')
  })

  it('omits the description when there is none', () => {
    const wrapper = mountCard({ data: { title: 'Trigger', description: '' } })
    expect(wrapper.find('p.line-clamp-2').exists()).toBe(false)
  })

  it.each([
    ['trigger', 'zap'],
    ['sendMessage', 'send'],
    ['addComment', 'message-square'],
    ['businessHours', 'calendar-clock'],
    ['unknown', 'circle-help'],
  ])('shows the %s icon', (type, icon) => {
    expect(mountCard({ type }).findComponent(BaseIcon).props('name')).toBe(icon)
  })

  it('uses the kind’s accent colour', () => {
    const style = mountCard({ type: 'businessHours' }).attributes('style')
    expect(style).toContain('--accent: var(--color-kind-business-hours)')
  })

  it('marks its kind on the element', () => {
    expect(mountCard({ type: 'addComment' }).attributes('data-kind')).toBe('addComment')
  })

  describe.each(['sendMessage', 'addComment', 'businessHours'])('an editable %s node', (type) => {
    it('looks clickable', () => {
      const wrapper = mountCard({ type })

      expect(wrapper.attributes('data-editable')).toBe('true')
      expect(wrapper.classes()).toContain('cursor-pointer')
      expect(wrapper.classes()).toContain('hover:shadow-md')
    })
  })

  describe.each(['trigger', 'unknown'])('a display-only %s node', (type) => {
    it('does not look clickable', () => {
      const wrapper = mountCard({ type })

      expect(wrapper.attributes('data-editable')).toBe('false')
      expect(wrapper.classes()).toContain('cursor-default')
      expect(wrapper.classes()).not.toContain('hover:shadow-md')
    })
  })

  it('highlights its border in the accent colour when selected', () => {
    expect(mountCard({ selected: true }).classes()).toContain('border-(--accent)')
    expect(mountCard({ selected: false }).classes()).toContain('border-slate-200')
  })

  it('has an input and an output handle', () => {
    expect(handles(mountCard())).toEqual([
      { type: 'target', position: 'top' },
      { type: 'source', position: 'bottom' },
    ])
  })

  it('gives the trigger no input handle, since a flow starts there', () => {
    expect(handles(mountCard({ type: 'trigger' }))).toEqual([
      { type: 'source', position: 'bottom' },
    ])
  })

  it('falls back to the unknown look for an unregistered type', () => {
    const wrapper = mountCard({ type: 'webhook' })

    expect(wrapper.findComponent(BaseIcon).props('name')).toBe('circle-help')
    expect(wrapper.attributes('data-editable')).toBe('false')
  })
})
