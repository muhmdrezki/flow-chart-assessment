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

/*
 * Keyboard focus while a panel is open — the part of accessibility that is invisible until someone
 * relies on it, and therefore the part most worth pinning down in tests.
 *
 * Two modes, and the difference is the interesting bit. A **modal** panel cycles Tab within itself,
 * because the page behind it is inert and tabbing there would strand the user. A **non-modal** one
 * (the details drawer, which deliberately leaves the canvas clickable) must let Tab walk out, or
 * the panel would trap a keyboard user in a page that is otherwise still live.
 *
 * The subtler cases:
 *
 * - Escape is answered only when the key came from inside the panel, so a popup living outside it —
 *   a teleported picker menu — can handle its own Escape without closing the panel underneath.
 * - Where focus returns to is tracked as it moves, not captured once on open: a non-modal panel can
 *   stay open while the user clicks a different node, and focus should go back to what the panel is
 *   about *now*.
 * - The listener is removed when the panel is destroyed while still open — a route change, a v-if
 *   above it — or it would go on swallowing Tab and Escape for the rest of the session.
 */
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

  describe('giving focus back', () => {
    it('returns it to whatever had it when the panel opened', async () => {
      const opener = document.createElement('button')
      document.body.append(opener)
      opener.focus()

      const wrapper = mount(Panel, { props: { active: false }, attachTo: document.body })
      await wrapper.setProps({ active: true })
      await nextTick()

      await wrapper.setProps({ active: false })

      await vi.waitFor(() => expect(document.activeElement).toBe(opener))
    })

    it('follows focus that moved on while the panel stayed open', async () => {
      // A panel that leaves the page usable can be open while the user clicks something else —
      // another node, whose details the panel then shows. Closing should return focus there.
      const first = document.createElement('button')
      const second = document.createElement('button')
      document.body.append(first, second)
      first.focus()

      const wrapper = mount(Panel, { props: { active: false }, attachTo: document.body })
      await wrapper.setProps({ active: true })
      await nextTick()

      second.focus()
      await wrapper.setProps({ active: false })

      await vi.waitFor(() => expect(document.activeElement).toBe(second))
    })

    it('ignores focus moving about inside the panel', async () => {
      const opener = document.createElement('button')
      document.body.append(opener)
      opener.focus()

      const wrapper = mount(Panel, { props: { active: false }, attachTo: document.body })
      await wrapper.setProps({ active: true })
      await nextTick()

      control('last').focus()
      await wrapper.setProps({ active: false })

      await vi.waitFor(() => expect(document.activeElement).toBe(opener))
    })
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
