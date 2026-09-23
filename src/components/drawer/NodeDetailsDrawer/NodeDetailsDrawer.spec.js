import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import payload from '../../../../public/payload.json'
import NodeEditForm from '@/components/forms/NodeEditForm/NodeEditForm.vue'
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import BaseDrawer from '@/components/ui/BaseDrawer/BaseDrawer.vue'
import { useUpdateNode } from '@/composables/useUpdateNode'
import { normalizePayload } from '@/utils/graph'
import NodeDetailsDrawer from './NodeDetailsDrawer.vue'

vi.mock('@/composables/useUpdateNode', () => ({ useUpdateNode: vi.fn() }))

const nodes = normalizePayload(payload)
const node = (id) => nodes.find((candidate) => candidate.id === String(id))

// The drawer teleports to the body, so its markup is looked up there.
const query = (selector) => document.body.querySelector(selector)
const queryAll = (selector) => [...document.body.querySelectorAll(selector)]
const panel = () => query('[role="dialog"]')

const AWAY_MESSAGE = 'b6a0c1'
const BUSINESS_HOURS = 'd09c08'

describe('NodeDetailsDrawer', () => {
  let mutation

  beforeEach(() => {
    document.body.innerHTML = ''
    mutation = {
      save: vi.fn((saved) => Promise.resolve(saved)),
      isPending: ref(false),
      error: ref(null),
      fieldErrors: ref({}),
      reset: vi.fn(),
    }
    useUpdateNode.mockReturnValue(mutation)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  const mountDrawer = (props = {}) =>
    mount(NodeDetailsDrawer, {
      props: { node: node(AWAY_MESSAGE), ...props },
      attachTo: document.body,
    })

  const form = (wrapper) => wrapper.findComponent(NodeEditForm)
  const button = (wrapper, text) =>
    wrapper.findAllComponents(BaseButton).find((candidate) => candidate.text().includes(text))
  /** Types into the form the way the user would: a new draft, replacing one field. */
  const edit = (wrapper, patch) =>
    form(wrapper).vm.$emit('update:modelValue', { ...form(wrapper).props('modelValue'), ...patch })

  it('is closed when no node is selected', () => {
    mountDrawer({ node: null })
    expect(panel()).toBeNull()
  })

  it('leaves the canvas usable, since the node has to stay clickable', () => {
    expect(mountDrawer().findComponent(BaseDrawer).props('modal')).toBe(false)
  })

  it('is headed by the node’s name and what the step does', () => {
    mountDrawer()

    expect(query('h2').textContent).toBe('Away Message')
    expect(query('header p').textContent).toBe('Sends a message to the contact.')
  })

  it('calls a node without a name after its kind, as the canvas does', () => {
    mountDrawer({ node: node(1) })
    expect(query('h2').textContent).toBe('Trigger')
  })

  it('opens the form on the node’s own values', () => {
    const draft = form(mountDrawer()).props('modelValue')

    expect(draft.title).toBe('Away Message')
    expect(draft.parts[0].text).toContain('Sorry, we are currently away')
  })

  describe('saving', () => {
    it('offers nothing to save until something changes', async () => {
      const wrapper = mountDrawer()
      expect(button(wrapper, 'Save changes').props('disabled')).toBe(true)

      await edit(wrapper, { title: 'Renamed' })

      expect(button(wrapper, 'Save changes').props('disabled')).toBe(false)
    })

    it('sends the edited node, in the payload’s shape', async () => {
      const wrapper = mountDrawer()
      await edit(wrapper, { title: 'Renamed' })

      await button(wrapper, 'Save changes').trigger('click')

      expect(mutation.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: AWAY_MESSAGE, name: 'Renamed' }),
      )
    })

    it('checks the values first, and does not send an invalid one', async () => {
      const wrapper = mountDrawer()
      await edit(wrapper, { title: '   ' })

      await button(wrapper, 'Save changes').trigger('click')

      expect(mutation.save).not.toHaveBeenCalled()
      expect(form(wrapper).props('errors').title).toBe('Title is required')
    })

    it('has nothing left to save once it succeeded', async () => {
      const wrapper = mountDrawer()
      await edit(wrapper, { title: 'Renamed' })

      await button(wrapper, 'Save changes').trigger('click')
      await vi.waitFor(() => expect(button(wrapper, 'Save changes').props('disabled')).toBe(true))
    })

    it('keeps what the user typed when the save fails', async () => {
      mutation.save.mockRejectedValue(new Error('Nope'))
      const wrapper = mountDrawer()
      await edit(wrapper, { title: 'Renamed' })

      await button(wrapper, 'Save changes').trigger('click')
      await vi.waitFor(() => expect(mutation.save).toHaveBeenCalled())

      expect(form(wrapper).props('modelValue').title).toBe('Renamed')
      expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('passes the server’s field messages to the form', () => {
      mutation.fieldErrors.value = { title: 'Title is already used' }

      expect(form(mountDrawer()).props('errors').title).toBe('Title is already used')
    })

    it('shows one message for a failure that is not about a field', () => {
      mutation.error.value = new Error('Network down')
      mountDrawer()

      expect(query('[role="alert"]').textContent.trim()).toBe('Could not save the step. Try again.')
    })

    it('says it is working, and cannot be dismissed mid-save', async () => {
      mutation.isPending.value = true
      const wrapper = mountDrawer()
      await wrapper.vm.$nextTick()

      expect(button(wrapper, 'Save changes').props('loading')).toBe(true)
      expect(form(wrapper).props('disabled')).toBe(true)
      expect(wrapper.findComponent(BaseDrawer).props('dismissible')).toBe(false)
    })
  })

  describe('closing', () => {
    it('closes at once when nothing was changed', async () => {
      const wrapper = mountDrawer()

      wrapper.findComponent(BaseDrawer).vm.$emit('close')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('asks first when there are unsaved changes', async () => {
      const wrapper = mountDrawer()
      await edit(wrapper, { title: 'Renamed' })

      wrapper.findComponent(BaseDrawer).vm.$emit('close')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('close')).toBeUndefined()
      expect(panel().textContent).toContain('Discard your changes?')
    })

    it('closes when the user confirms', async () => {
      const wrapper = mountDrawer()
      await edit(wrapper, { title: 'Renamed' })
      wrapper.findComponent(BaseDrawer).vm.$emit('close')
      await wrapper.vm.$nextTick()

      await button(wrapper, 'Discard').trigger('click')

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('goes back to editing when the user changes their mind', async () => {
      const wrapper = mountDrawer()
      await edit(wrapper, { title: 'Renamed' })
      wrapper.findComponent(BaseDrawer).vm.$emit('close')
      await wrapper.vm.$nextTick()

      await button(wrapper, 'Keep editing').trigger('click')

      expect(wrapper.emitted('close')).toBeUndefined()
      expect(form(wrapper).props('modelValue').title).toBe('Renamed')
    })
  })

  describe('another node', () => {
    it('swaps its contents without closing', async () => {
      const wrapper = mountDrawer()

      await wrapper.setProps({ node: node(BUSINESS_HOURS) })

      expect(query('h2').textContent).toBe('Business Hours')
      expect(panel()).not.toBeNull()
    })

    it('starts again from the new node’s values', async () => {
      const wrapper = mountDrawer()
      await edit(wrapper, { title: 'Renamed' })

      await wrapper.setProps({ node: node(BUSINESS_HOURS) })

      expect(form(wrapper).props('modelValue').title).toBe('Business Hours')
      expect(button(wrapper, 'Save changes').props('disabled')).toBe(true)
    })

    it('shows the week for a business-hours node', async () => {
      const wrapper = mountDrawer()

      await wrapper.setProps({ node: node(BUSINESS_HOURS) })

      expect(queryAll('input[type="time"]')).toHaveLength(14)
    })
  })

  it('keeps showing the node it had while it slides out', async () => {
    const wrapper = mountDrawer()

    await wrapper.setProps({ node: null })

    // The panel is on its way out, so emptying it now would blank the content mid-animation.
    expect(wrapper.findComponent(BaseDrawer).props('title')).toBe('Away Message')
  })
})
