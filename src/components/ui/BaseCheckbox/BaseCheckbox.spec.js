import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseCheckbox from './BaseCheckbox.vue'

const mountCheckbox = (props = {}) =>
  mount(BaseCheckbox, { props: { label: 'Once per contact', ...props } })

describe('BaseCheckbox', () => {
  it('labels the box with its text', () => {
    const wrapper = mountCheckbox()

    expect(wrapper.find('label').text()).toBe('Once per contact')
    expect(wrapper.find('input').attributes('type')).toBe('checkbox')
  })

  it('shows what it was given', () => {
    expect(mountCheckbox({ modelValue: true }).find('input').element.checked).toBe(true)
  })

  it('reports a tick', async () => {
    const wrapper = mountCheckbox({ modelValue: false })

    await wrapper.find('input').setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('reports being unticked', async () => {
    const wrapper = mountCheckbox({ modelValue: true })

    await wrapper.find('input').setValue(false)

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('keeps the label for screen readers when the row already shows it', () => {
    const wrapper = mountCheckbox({ labelHidden: true })

    expect(wrapper.find('span').classes()).toContain('sr-only')
    expect(wrapper.find('span').text()).toBe('Once per contact')
  })

  it('can be disabled', () => {
    const wrapper = mountCheckbox({ disabled: true })

    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
    expect(wrapper.find('label').classes()).toContain('cursor-not-allowed')
  })

  it('points at the message describing it', () => {
    const wrapper = mountCheckbox({ describedBy: 'hint-1' })

    expect(wrapper.find('input').attributes('aria-describedby')).toBe('hint-1')
  })
})
