import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseSpinner from './BaseSpinner.vue'

/*
 * The loading indicator. It carries its own accessible label, so "loading" is something a screen
 * reader hears rather than something only the eye can see.
 */
describe('BaseSpinner', () => {
  it('announces itself as a status with a default label', () => {
    const wrapper = mount(BaseSpinner)

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.text()).toBe('Loading')
  })

  it('keeps the label for screen readers only by default', () => {
    const label = mount(BaseSpinner).find('span.sr-only')
    expect(label.text()).toBe('Loading')
  })

  it('announces a custom label', () => {
    expect(mount(BaseSpinner, { props: { label: 'Loading flow…' } }).text()).toBe('Loading flow…')
  })

  it('shows the label visibly when asked', () => {
    const wrapper = mount(BaseSpinner, { props: { label: 'Loading flow…', showLabel: true } })

    expect(wrapper.find('.sr-only').exists()).toBe(false)
    expect(wrapper.text()).toBe('Loading flow…')
  })

  it('is purely decorative with an empty label', () => {
    const wrapper = mount(BaseSpinner, { props: { label: '' } })

    expect(wrapper.attributes('role')).toBeUndefined()
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toBe('')
  })

  it.each([
    ['sm', 'size-4'],
    ['md', 'size-6'],
    ['lg', 'size-10'],
  ])('applies the %s size', (size, className) => {
    const wheel = mount(BaseSpinner, { props: { size } }).find('.animate-spin')
    expect(wheel.classes()).toContain(className)
  })
})
