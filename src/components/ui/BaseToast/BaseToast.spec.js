import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseToast from './BaseToast.vue'

// The toast teleports to the body, so its markup is looked up there.
const toast = () => document.body.querySelector('[role="status"]')

const mountToast = (props = {}) =>
  mount(BaseToast, { props: { message: 'Changes saved', ...props }, attachTo: document.body })

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

/*
 * How a write announces itself. Saving leaves the drawer open, so without this a successful save
 * was visible only as a button going grey.
 *
 * It is role="status" rather than an alert on purpose: a screen reader should mention it at the
 * next pause rather than interrupt what the user is doing. It also clears itself, so the caller
 * sets a message and never has to remember to unset one.
 */
describe('BaseToast', () => {
  it('says nothing when there is nothing to say', () => {
    mountToast({ message: '' })
    expect(toast()).toBeNull()
  })

  it('shows the message it was given', () => {
    mountToast()
    expect(toast().textContent.trim()).toBe('Changes saved')
  })

  it('is announced politely: it is confirmation, not a problem', () => {
    mountToast()

    expect(toast().getAttribute('role')).toBe('status')
    expect(toast().getAttribute('aria-live')).toBe('polite')
  })

  it('keeps out of the way of the canvas controls in the same corner', () => {
    mountToast()

    expect(toast().className).toContain('bottom-4')
    expect(toast().className).toContain('left-14')
  })

  it('asks to be cleared once it has been read', async () => {
    vi.useFakeTimers()
    const wrapper = mountToast()

    await vi.advanceTimersByTimeAsync(2999)
    expect(wrapper.emitted('close')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('takes the time it was given', async () => {
    vi.useFakeTimers()
    const wrapper = mountToast({ duration: 500 })

    await vi.advanceTimersByTimeAsync(500)

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('starts again when something else is said', async () => {
    vi.useFakeTimers()
    const wrapper = mountToast()
    await vi.advanceTimersByTimeAsync(2000)

    await wrapper.setProps({ message: '“Away Message” deleted' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.emitted('close')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('does not ask to be cleared after it is gone', async () => {
    vi.useFakeTimers()
    const wrapper = mountToast()

    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(5000)

    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
