import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseInput from './BaseInput.vue'

const mountInput = (props = {}) => mount(BaseInput, { props })

describe('BaseInput', () => {
  it('shows the current value', () => {
    expect(mountInput({ modelValue: 'Welcome back' }).find('input').element.value).toBe(
      'Welcome back',
    )
  })

  it('reports what the user types', async () => {
    const wrapper = mountInput({ modelValue: '' })

    await wrapper.find('input').setValue('Follow up')

    expect(wrapper.emitted('update:modelValue')).toEqual([['Follow up']])
  })

  it('is a text box by default, and can be another type', () => {
    expect(mountInput().find('input').attributes('type')).toBe('text')
    expect(mountInput({ type: 'email' }).find('input').attributes('type')).toBe('email')
  })

  it('takes the id and placeholder it is given', () => {
    const input = mountInput({ id: 'title', placeholder: 'Welcome back' }).find('input')

    expect(input.attributes('id')).toBe('title')
    expect(input.attributes('placeholder')).toBe('Welcome back')
  })

  it('can be disabled', () => {
    expect(mountInput({ disabled: true }).find('input').attributes('disabled')).toBeDefined()
  })

  describe('when the value is invalid', () => {
    it('says so for screen readers', () => {
      expect(mountInput({ invalid: true }).find('input').attributes('aria-invalid')).toBe('true')
    })

    it('shows a red border instead of the accent one', () => {
      const classes = mountInput({ invalid: true }).find('input').classes()

      expect(classes).toContain('border-red-500')
      expect(classes).not.toContain('border-slate-300')
    })
  })

  it('is not marked invalid when it is fine', () => {
    const input = mountInput().find('input')

    expect(input.attributes('aria-invalid')).toBeUndefined()
    expect(input.classes()).toContain('border-slate-300')
  })

  it('points at the message that describes it', () => {
    const input = mountInput({ describedBy: 'title-message' }).find('input')
    expect(input.attributes('aria-describedby')).toBe('title-message')
  })
})
