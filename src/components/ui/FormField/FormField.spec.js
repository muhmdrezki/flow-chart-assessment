import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FormField from './FormField.vue'

/** The slot renders a real input, so the label/message wiring can be checked end to end. */
const mountField = (props = {}) =>
  mount(FormField, {
    props: { label: 'Title', ...props },
    slots: {
      default: `
        <template #default="control">
          <input
            :id="control.id"
            :aria-invalid="control.invalid || undefined"
            :aria-describedby="control.describedBy"
          />
        </template>
      `,
    },
  })

describe('FormField', () => {
  it('labels the control it wraps', () => {
    const wrapper = mountField()

    expect(wrapper.find('label').text()).toContain('Title')
    expect(wrapper.find('label').attributes('for')).toBe(wrapper.find('input').attributes('id'))
  })

  it('marks required fields without announcing the asterisk', () => {
    const wrapper = mountField({ required: true })
    const asterisk = wrapper.find('label span')

    expect(asterisk.text()).toBe('*')
    expect(asterisk.attributes('aria-hidden')).toBe('true')
  })

  it('has no asterisk when the field is optional', () => {
    expect(mountField().find('label span').exists()).toBe(false)
  })

  it('shows a hint under the field', () => {
    const wrapper = mountField({ hint: '24 / 200' })

    expect(wrapper.find('p').text()).toBe('24 / 200')
    expect(wrapper.find('p').classes()).toContain('text-slate-500')
  })

  it('shows the error instead of the hint, in red', () => {
    const wrapper = mountField({ hint: '24 / 200', error: 'Title is required' })

    expect(wrapper.find('p').text()).toBe('Title is required')
    expect(wrapper.find('p').classes()).toContain('text-red-600')
  })

  it('connects the message to the control for screen readers', () => {
    const wrapper = mountField({ error: 'Title is required' })

    expect(wrapper.find('input').attributes('aria-describedby')).toBe(
      wrapper.find('p').attributes('id'),
    )
  })

  it('tells the control it is invalid only when there is an error', () => {
    expect(
      mountField({ error: 'Title is required' }).find('input').attributes('aria-invalid'),
    ).toBe('true')
    expect(mountField({ hint: '0 / 200' }).find('input').attributes('aria-invalid')).toBeUndefined()
  })

  it('describes nothing when there is no message', () => {
    const wrapper = mountField()

    expect(wrapper.find('p').exists()).toBe(false)
    expect(wrapper.find('input').attributes('aria-describedby')).toBeUndefined()
  })

  it('gives each field on a page its own ids', () => {
    const form = mount(
      {
        components: { FormField },
        template: `
          <form>
            <FormField label="Title"><template #default="c"><input :id="c.id" /></template></FormField>
            <FormField label="Description"><template #default="c"><input :id="c.id" /></template></FormField>
          </form>
        `,
      },
      { global: { components: { FormField } } },
    )

    const [first, second] = form.findAll('input').map((input) => input.attributes('id'))
    expect(first).not.toBe(second)
  })
})
