import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import BaseIconButton from './BaseIconButton.vue'

const mountButton = (props = {}) =>
  mount(BaseIconButton, { props: { icon: 'undo', label: 'Undo delete Away Message', ...props } })

describe('BaseIconButton', () => {
  it('shows the icon it was asked for', () => {
    expect(mountButton().findComponent(BaseIcon).props('name')).toBe('undo')
  })

  it('is named by its label, since a picture says nothing to a screen reader', () => {
    expect(mountButton().attributes('aria-label')).toBe('Undo delete Away Message')
  })

  it('shows the same words on hover, for anyone unsure what the picture means', () => {
    expect(mountButton().attributes('title')).toBe('Undo delete Away Message')
  })

  it('reports a click', async () => {
    const wrapper = mountButton()

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('says nothing when it is disabled', async () => {
    const wrapper = mountButton({ disabled: true })

    await wrapper.trigger('click')

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it.each([
    ['md', 'size-10'],
    ['sm', 'size-8'],
  ])('is square at %s, rather than padded for words it does not have', (size, expected) => {
    expect(mountButton({ size }).classes()).toContain(expected)
  })

  it('is a button, so it never submits a form it happens to sit in', () => {
    expect(mountButton().attributes('type')).toBe('button')
  })
})
