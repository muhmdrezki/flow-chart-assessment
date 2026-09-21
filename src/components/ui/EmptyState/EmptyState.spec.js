import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from './EmptyState.vue'

const mountState = (props, slots) => mount(EmptyState, { props, slots })

describe('EmptyState', () => {
  it('renders the title and message', () => {
    const wrapper = mountState({ title: 'Nothing here', message: 'Add a node.' })

    expect(wrapper.find('h2').text()).toBe('Nothing here')
    expect(wrapper.find('p').text()).toBe('Add a node.')
  })

  it('omits the message when there is none', () => {
    const wrapper = mountState({ title: 'Nothing here' })
    expect(wrapper.find('p').exists()).toBe(false)
  })

  it('is not announced as an alert in the neutral tone', () => {
    const wrapper = mountState({ title: 'Nothing here' })
    expect(wrapper.attributes('role')).toBeUndefined()
  })

  it('is announced as an alert in the error tone', () => {
    const wrapper = mountState({ title: 'Failed', tone: 'error' })
    expect(wrapper.attributes('role')).toBe('alert')
  })

  it('renders actions', () => {
    const wrapper = mountState({ title: 'Failed' }, { actions: '<button>Retry</button>' })
    expect(wrapper.find('button').text()).toBe('Retry')
  })

  it('renders no actions container without actions', () => {
    const wrapper = mountState({ title: 'Failed' })
    expect(wrapper.find('.mt-2').exists()).toBe(false)
  })
})
