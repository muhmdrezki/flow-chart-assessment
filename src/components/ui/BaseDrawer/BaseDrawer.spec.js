import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import BaseDrawer from './BaseDrawer.vue'

/** The drawer teleports to the body, so its markup is looked up there rather than in the wrapper. */
const panel = () => document.body.querySelector('[role="dialog"]')
const query = (selector) => document.body.querySelector(selector)

function mountDrawer(props = {}, slots = {}) {
  return mount(BaseDrawer, {
    props: { open: true, title: 'Create node', ...props },
    slots: { default: '<input data-test="first" /><button>Inside</button>', ...slots },
    attachTo: document.body,
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('BaseDrawer', () => {
  it('renders nothing while it is closed', () => {
    mountDrawer({ open: false })
    expect(panel()).toBeNull()
  })

  it('is announced as a dialog named after its title', () => {
    mountDrawer()

    expect(panel().getAttribute('aria-modal')).toBe('true')
    expect(query('h2').textContent).toBe('Create node')
    expect(panel().getAttribute('aria-labelledby')).toBe(query('h2').id)
  })

  it('shows the purpose line and header icon when given', () => {
    mountDrawer({ description: 'Add a step to the flow.', icon: 'send' })

    expect(query('header p').textContent).toBe('Add a step to the flow.')
    expect(query('header svg')).not.toBeNull()
  })

  it('renders its content and footer', () => {
    mountDrawer({}, { footer: '<button data-test="save">Create node</button>' })

    expect(query('[data-test="first"]')).not.toBeNull()
    expect(query('[data-test="save"]').textContent).toBe('Create node')
  })

  it('has no footer area when no footer is given', () => {
    mountDrawer()
    expect(query('footer')).toBeNull()
  })

  describe('closing', () => {
    it('asks to close from the close button', async () => {
      const wrapper = mountDrawer()

      await query('header button').click()

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('asks to close when the area beside the panel is clicked', async () => {
      const wrapper = mountDrawer()

      await query('.fixed > div').click()

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('asks to close on Escape', async () => {
      const wrapper = mountDrawer()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('does not close by itself: the parent decides', async () => {
      mountDrawer()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await nextTick()

      expect(panel()).not.toBeNull()
    })
  })

  describe('keyboard focus', () => {
    it('moves into the panel when it opens', async () => {
      const wrapper = mount(BaseDrawer, {
        props: { open: false, title: 'Create node' },
        slots: { default: '<input data-test="first" />' },
        attachTo: document.body,
      })

      await wrapper.setProps({ open: true })
      await nextTick()

      await vi.waitFor(() => expect(document.activeElement).toBe(query('[data-test="first"]')))
    })

    it('still lands inside the panel when its content has nothing focusable', async () => {
      const wrapper = mount(BaseDrawer, {
        props: { open: false, title: 'Node details' },
        slots: { default: '<p>User message during off hours</p>' },
        attachTo: document.body,
      })

      await wrapper.setProps({ open: true })
      await nextTick()

      // Read-only content, so it falls back to the close button rather than leaving focus outside.
      await vi.waitFor(() => expect(panel().contains(document.activeElement)).toBe(true))
      expect(document.activeElement).toBe(query('header button'))
    })

    it('makes the rest of the page inert while it is open', async () => {
      const behind = document.createElement('div')
      document.body.append(behind)

      const wrapper = mount(BaseDrawer, {
        props: { open: false, title: 'Create node' },
        slots: { default: '<input />' },
        attachTo: document.body,
      })

      await wrapper.setProps({ open: true })
      await vi.waitFor(() => expect(behind.inert).toBe(true))

      await wrapper.setProps({ open: false })
      await vi.waitFor(() => expect(behind.inert).toBe(false))
    })

    it('goes back where it was when the panel closes', async () => {
      const opener = document.createElement('button')
      document.body.append(opener)
      opener.focus()

      const wrapper = mount(BaseDrawer, {
        props: { open: false, title: 'Create node' },
        slots: { default: '<input data-test="first" />' },
        attachTo: document.body,
      })
      await wrapper.setProps({ open: true })
      await nextTick()

      await wrapper.setProps({ open: false })

      await vi.waitFor(() => expect(document.activeElement).toBe(opener))
    })
  })
})
