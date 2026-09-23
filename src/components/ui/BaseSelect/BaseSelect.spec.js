import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseSelect from './BaseSelect.vue'

const OPTIONS = [
  { value: 'sendMessage', label: 'Send Message' },
  { value: 'addComment', label: 'Add Comments' },
  { value: 'businessHours', label: 'Business Hours' },
]

const mountSelect = (props = {}) => mount(BaseSelect, { props: { options: OPTIONS, ...props } })

describe('BaseSelect', () => {
  it('lists every option in the order given', () => {
    const labels = mountSelect()
      .findAll('option')
      .map((option) => option.text())

    expect(labels).toEqual(['Choose one', 'Send Message', 'Add Comments', 'Business Hours'])
  })

  it('shows a placeholder that cannot be chosen while nothing is selected', () => {
    const placeholder = mountSelect({ placeholder: 'Choose a node type' }).find('option')

    expect(placeholder.text()).toBe('Choose a node type')
    expect(placeholder.attributes('disabled')).toBeDefined()
    expect(placeholder.attributes('value')).toBe('')
  })

  it('shows the current value', () => {
    expect(mountSelect({ modelValue: 'addComment' }).find('select').element.value).toBe(
      'addComment',
    )
  })

  it('reports what the user chooses', async () => {
    const wrapper = mountSelect({ modelValue: '' })

    await wrapper.find('select').setValue('businessHours')

    expect(wrapper.emitted('update:modelValue')).toEqual([['businessHours']])
  })

  it('greys the text until something is chosen', () => {
    expect(mountSelect({ modelValue: '' }).find('select').classes()).toContain('text-slate-400')
    expect(mountSelect({ modelValue: 'addComment' }).find('select').classes()).toContain(
      'text-slate-900',
    )
  })

  it('marks itself invalid and points at its message', () => {
    const select = mountSelect({ invalid: true, describedBy: 'type-message' }).find('select')

    expect(select.attributes('aria-invalid')).toBe('true')
    expect(select.attributes('aria-describedby')).toBe('type-message')
    expect(select.classes()).toContain('border-red-500')
  })

  it('can be disabled', () => {
    expect(mountSelect({ disabled: true }).find('select').attributes('disabled')).toBeDefined()
  })

  it('hides its drawn arrow from screen readers', () => {
    expect(mountSelect().find('svg').attributes('aria-hidden')).toBe('true')
  })

  it('says when it was left, which the wrapper around it cannot', async () => {
    // `blur` doesn't bubble, so a listener on this component would land on the arrow's wrapper and
    // never hear a thing. A form that shows a message once a field is left needs it passed on.
    const wrapper = mountSelect()

    await wrapper.find('select').trigger('blur')

    expect(wrapper.emitted('blur')).toHaveLength(1)
  })
})
