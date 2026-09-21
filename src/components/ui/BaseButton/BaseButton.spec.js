import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from './BaseButton.vue'
import BaseSpinner from '../BaseSpinner/BaseSpinner.vue'

const mountButton = (props = {}) => mount(BaseButton, { props, slots: { default: 'Save' } })

describe('BaseButton', () => {
  it('renders its label', () => {
    expect(mountButton().text()).toBe('Save')
  })

  it('defaults to type="button" so it never submits a form by accident', () => {
    expect(mountButton().attributes('type')).toBe('button')
  })

  it('accepts another type', () => {
    expect(mountButton({ type: 'submit' }).attributes('type')).toBe('submit')
  })

  it.each([
    ['primary', 'bg-indigo-600'],
    ['secondary', 'border-slate-300'],
    ['danger', 'bg-red-600'],
    ['ghost', 'hover:bg-slate-100'],
  ])('applies the %s variant', (variant, className) => {
    expect(mountButton({ variant }).classes()).toContain(className)
  })

  it('uses the primary variant by default', () => {
    expect(mountButton().classes()).toContain('bg-indigo-600')
  })

  it.each([
    ['sm', 'h-8'],
    ['md', 'h-10'],
  ])('applies the %s size', (size, className) => {
    expect(mountButton({ size }).classes()).toContain(className)
  })

  it('emits click', async () => {
    const wrapper = mountButton()
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('does not emit click when disabled', async () => {
    const wrapper = mountButton({ disabled: true })
    await wrapper.trigger('click')

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  describe('when loading', () => {
    it('blocks clicks', async () => {
      const wrapper = mountButton({ loading: true })
      await wrapper.trigger('click')

      expect(wrapper.attributes('disabled')).toBeDefined()
      expect(wrapper.emitted('click')).toBeUndefined()
    })

    it('marks itself busy and shows a decorative spinner', () => {
      const wrapper = mountButton({ loading: true })

      expect(wrapper.attributes('aria-busy')).toBe('true')
      expect(wrapper.findComponent(BaseSpinner).exists()).toBe(true)
      expect(wrapper.find('[role="status"]').exists()).toBe(false)
    })
  })

  it('shows no spinner and no aria-busy when idle', () => {
    const wrapper = mountButton()

    expect(wrapper.attributes('aria-busy')).toBeUndefined()
    expect(wrapper.findComponent(BaseSpinner).exists()).toBe(false)
  })
})
