import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseTextarea from './BaseTextarea.vue'

const mountTextarea = (props = {}) => mount(BaseTextarea, { props })

describe('BaseTextarea', () => {
  it('shows the current value', () => {
    const wrapper = mountTextarea({ modelValue: 'Greets returning visitors' })
    expect(wrapper.find('textarea').element.value).toBe('Greets returning visitors')
  })

  it('reports what the user types', async () => {
    const wrapper = mountTextarea({ modelValue: '' })

    await wrapper.find('textarea').setValue('Checks in later')

    expect(wrapper.emitted('update:modelValue')).toEqual([['Checks in later']])
  })

  it('is three rows tall by default', () => {
    expect(mountTextarea().find('textarea').attributes('rows')).toBe('3')
    expect(mountTextarea({ rows: 6 }).find('textarea').attributes('rows')).toBe('6')
  })

  it('takes the id, placeholder and disabled state it is given', () => {
    const textarea = mountTextarea({
      id: 'description',
      placeholder: 'What this step does',
      disabled: true,
    }).find('textarea')

    expect(textarea.attributes('id')).toBe('description')
    expect(textarea.attributes('placeholder')).toBe('What this step does')
    expect(textarea.attributes('disabled')).toBeDefined()
  })

  it('marks itself invalid and turns red', () => {
    const textarea = mountTextarea({ invalid: true }).find('textarea')

    expect(textarea.attributes('aria-invalid')).toBe('true')
    expect(textarea.classes()).toContain('border-red-500')
  })

  it('points at the message that describes it', () => {
    const textarea = mountTextarea({ describedBy: 'description-message' }).find('textarea')
    expect(textarea.attributes('aria-describedby')).toBe('description-message')
  })
})
