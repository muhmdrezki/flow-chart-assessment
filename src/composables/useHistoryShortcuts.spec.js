import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useHistoryShortcuts } from './useHistoryShortcuts'

const Host = defineComponent({
  props: {
    undo: { type: Function, required: true },
    redo: { type: Function, required: true },
    enabled: { type: [Boolean, Object], default: true },
  },
  setup(props) {
    useHistoryShortcuts({
      undo: () => props.undo(),
      redo: () => props.redo(),
      enabled: props.enabled,
    })
    return () =>
      h('div', [h('input'), h('textarea'), h('select'), h('div', { contenteditable: 'true' })])
  },
})

/** Presses a key on `target`, which stands in for wherever focus happens to be. */
function press(key, { target = document.body, ...modifiers } = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers })
  target.dispatchEvent(event)
  return event
}

describe('useHistoryShortcuts', () => {
  let undo
  let redo
  let wrapper

  beforeEach(() => {
    document.body.innerHTML = ''
    undo = vi.fn()
    redo = vi.fn()
    wrapper = mount(Host, { props: { undo, redo }, attachTo: document.body })
  })

  const field = (selector) => wrapper.find(selector).element

  describe('undo', () => {
    it.each([
      ['ctrl', { ctrlKey: true }],
      ['cmd', { metaKey: true }],
    ])('answers to %s+Z', (_, modifier) => {
      press('z', modifier)

      expect(undo).toHaveBeenCalledTimes(1)
      expect(redo).not.toHaveBeenCalled()
    })

    it('stops the browser undoing the page as well', () => {
      expect(press('z', { ctrlKey: true }).defaultPrevented).toBe(true)
    })
  })

  describe('redo', () => {
    it.each([
      ['ctrl+shift+Z', { ctrlKey: true, shiftKey: true }, 'z'],
      ['cmd+shift+Z', { metaKey: true, shiftKey: true }, 'z'],
      ['ctrl+Y', { ctrlKey: true }, 'y'],
    ])('answers to %s', (_, modifier, key) => {
      press(key, modifier)

      expect(redo).toHaveBeenCalledTimes(1)
      expect(undo).not.toHaveBeenCalled()
    })
  })

  describe('while the user is typing', () => {
    it.each(['input', 'textarea', 'select', '[contenteditable]'])(
      'leaves %s alone, where undo belongs to the browser',
      (selector) => {
        press('z', { ctrlKey: true, target: field(selector) })
        press('z', { ctrlKey: true, shiftKey: true, target: field(selector) })

        expect(undo).not.toHaveBeenCalled()
        expect(redo).not.toHaveBeenCalled()
      },
    )

    it('does not swallow the key either, so the field still gets it', () => {
      expect(press('z', { ctrlKey: true, target: field('input') }).defaultPrevented).toBe(false)
    })
  })

  it.each([
    ['z on its own', 'z', {}],
    ['a different key', 'a', { ctrlKey: true }],
    ['shift+Z without a modifier', 'z', { shiftKey: true }],
  ])('ignores %s', (_, key, modifier) => {
    press(key, modifier)

    expect(undo).not.toHaveBeenCalled()
    expect(redo).not.toHaveBeenCalled()
  })

  it('can be switched off, for a flow that has not loaded yet', () => {
    wrapper.unmount()
    const enabled = ref(false)
    mount(Host, { props: { undo, redo, enabled }, attachTo: document.body })

    press('z', { ctrlKey: true })
    expect(undo).not.toHaveBeenCalled()

    enabled.value = true
    press('z', { ctrlKey: true })

    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('stops listening when it is torn down', () => {
    wrapper.unmount()

    press('z', { ctrlKey: true })

    expect(undo).not.toHaveBeenCalled()
  })
})
