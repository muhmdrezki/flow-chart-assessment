import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import payload from '../../../../public/payload.json'
import CreateNodeForm from '@/components/forms/CreateNodeForm/CreateNodeForm.vue'
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import { useCreateNode } from '@/composables/useCreateNode'
import { useFlowStore } from '@/stores/flow'
import CreateNodeDrawer from './CreateNodeDrawer.vue'

vi.mock('@/composables/useCreateNode', () => ({ useCreateNode: vi.fn() }))

const VALUES = {
  title: 'Ask for feedback',
  description: 'Requests a rating after the chat',
  type: 'sendMessage',
  parentId: 'b6a0c1',
}

describe('CreateNodeDrawer', () => {
  let mutation

  beforeEach(() => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    useFlowStore().hydrate(payload)

    mutation = {
      create: vi.fn().mockResolvedValue('new01'),
      isPending: ref(false),
      error: ref(null),
      fieldErrors: ref({}),
      reset: vi.fn(),
    }
    useCreateNode.mockReturnValue(mutation)
  })

  const mountDrawer = (props = {}) =>
    mount(CreateNodeDrawer, { props: { open: true, ...props }, attachTo: document.body })

  const form = (wrapper) => wrapper.findComponent(CreateNodeForm)
  const footerButton = (wrapper, text) =>
    wrapper.findAllComponents(BaseButton).find((button) => button.text().includes(text))
  // The drawer teleports to the body, so its markup is looked up there.
  const alert = () => document.body.querySelector('[role="alert"]')

  it('offers every step a node can be added after, by name', () => {
    expect(form(mountDrawer()).props('parents')).toEqual([
      { value: '1', label: 'Trigger' },
      { value: 'b6a0c1', label: 'Away Message' },
      // A branch is named after its condition, so two conditions can be told apart.
      { value: '161f52', label: 'Business Hours · Success' },
      { value: '28c4b9', label: 'Business Hours · Failure' },
      { value: 'b0653a', label: 'Welcome Message' },
      { value: 'e879e4', label: 'Add Comment #1' },
    ])
  })

  it('cannot be dismissed while the node is being created', async () => {
    const wrapper = mountDrawer()
    expect(wrapper.findComponent({ name: 'BaseDrawer' }).props('dismissible')).toBe(true)

    mutation.isPending.value = true
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent({ name: 'BaseDrawer' }).props('dismissible')).toBe(false)
  })

  it('leaves out business hours, which branches instead of continuing', () => {
    const values = form(mountDrawer())
      .props('parents')
      .map((parent) => parent.value)

    expect(values).not.toContain('d09c08')
  })

  it('creates the node the form submitted', async () => {
    const wrapper = mountDrawer()

    await form(wrapper).vm.$emit('submit', VALUES)

    expect(mutation.create).toHaveBeenCalledWith(VALUES)
  })

  it('reports the new node and closes when it worked', async () => {
    const wrapper = mountDrawer()

    await form(wrapper).vm.$emit('submit', VALUES)
    await vi.waitFor(() => expect(wrapper.emitted('created')).toEqual([['new01']]))

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('stays open when the create fails', async () => {
    mutation.create.mockRejectedValue(new Error('Nope'))
    const wrapper = mountDrawer()

    await form(wrapper).vm.$emit('submit', VALUES)
    await vi.waitFor(() => expect(mutation.create).toHaveBeenCalled())

    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.emitted('created')).toBeUndefined()
  })

  it('passes the server’s field messages to the form', () => {
    mutation.fieldErrors.value = { title: 'Title is required' }

    expect(form(mountDrawer()).props('serverErrors')).toEqual({ title: 'Title is required' })
  })

  it('shows one message for a failure that is not about a field', () => {
    mutation.error.value = new Error('Network down')
    mountDrawer()

    expect(alert().textContent.trim()).toBe('Could not add the node. Try again.')
  })

  it('has no general message when the failure belongs to a field', () => {
    mutation.error.value = new Error('Invalid')
    mutation.fieldErrors.value = { title: 'Title is required' }
    mountDrawer()

    expect(alert()).toBeNull()
  })

  it('says it is working while the node is created', () => {
    mutation.isPending.value = true
    const wrapper = mountDrawer()

    expect(footerButton(wrapper, 'Create node').props('loading')).toBe(true)
    expect(footerButton(wrapper, 'Cancel').props('disabled')).toBe(true)
    expect(form(wrapper).props('pending')).toBe(true)
  })

  it('closes when the user cancels', async () => {
    const wrapper = mountDrawer()

    await footerButton(wrapper, 'Cancel').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('starts fresh each time it opens', async () => {
    const wrapper = mountDrawer({ open: false })

    await wrapper.setProps({ open: true })

    expect(mutation.reset).toHaveBeenCalled()
    expect(form(wrapper).exists()).toBe(true)
  })

  it('keeps the form out of the page while it is closed', () => {
    expect(form(mountDrawer({ open: false })).exists()).toBe(false)
  })
})
