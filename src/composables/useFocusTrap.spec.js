import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, toRef } from 'vue'
import { mount } from '@vue/test-utils'
import { useFocusTrap } from './useFocusTrap'

/** A panel with three focusable controls, so Tab and Shift+Tab have somewhere to wrap. */
const Panel = defineComponent({
  props: { active: { type: Boolean, default: false }, onEscape: { type: Function, default: null } },
  setup(props) {
    const container = ref(null)
    useFocusTrap(container, {
      active: toRef(props, 'active'),
      onEscape: () => props.onEscape?.(),
    })
    return () =>
      h('div', { ref: container }, [
        h('button', { 'data-test': 'first' }, 'First'),
        h('input', { 'data-test': 'middle' }),
        h('button', { 'data-test': 'last' }, 'Last'),
      ])
  },
})

const control = (name) => document.body.querySelector(`[data-test="${name}"]`)
const pressTab = (shiftKey = false) => {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true })
  document.dispatchEvent(event)
  return event
}

function mountPanel(props = {}) {
  return mount(Panel, { props: { active: true, ...props }, attachTo: document.body })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useFocusTrap', () => {
  it('moves focus to the first control when it becomes active', async () => {
    const wrapper = mount(Panel, { props: { active: false }, attachTo: document.body })
    await wrapper.setProps({ active: true })

    await vi.waitFor(() => expect(document.activeElement).toBe(control('first')))
  })

  it('wraps to the first control when tabbing past the last', async () => {
    mountPanel()
    await nextTick()
    control('last').focus()

    const event = pressTab()

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(control('first'))
  })

  it('wraps to the last control when shift-tabbing from the first', async () => {
    mountPanel()
    await nextTick()
    control('first').focus()

    const event = pressTab(true)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(control('last'))
  })

  it('leaves tabbing between controls alone', async () => {
    mountPanel()
    await nextTick()
    control('middle').focus()

    expect(pressTab().defaultPrevented).toBe(false)
  })

  it('reports Escape so the panel can close itself', async () => {
    const onEscape = vi.fn()
    mountPanel({ onEscape })
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(onEscape).toHaveBeenCalledOnce()
  })

  it('ignores Escape from a popup inside the panel, which handles its own', async () => {
    const onEscape = vi.fn()
    mountPanel({ onEscape })
    await nextTick()
    const outside = document.createElement('button')
    document.body.append(outside)

    outside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(onEscape).not.toHaveBeenCalled()
  })

  it('stops listening when the panel is destroyed while still open', async () => {
    const wrapper = mountPanel()
    await nextTick()
    const outsideButton = document.createElement('button')
    document.body.append(outsideButton)
    outsideButton.focus()

    wrapper.unmount()

    // Without cleanup the detached trap would swallow every Tab press on the page.
    expect(pressTab().defaultPrevented).toBe(false)
  })

  it('stops trapping once it is inactive', async () => {
    const wrapper = mountPanel()
    await nextTick()
    control('last').focus()

    await wrapper.setProps({ active: false })
    await nextTick()

    expect(pressTab().defaultPrevented).toBe(false)
  })
})
