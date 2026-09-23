import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseInput from '@/components/ui/BaseInput/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea/BaseTextarea.vue'
import CreateNodeForm from './CreateNodeForm.vue'

const PARENTS = [
  { value: '1', label: 'Trigger' },
  { value: 'b6a0c1', label: 'Away Message' },
]

const mountForm = (props = {}) =>
  mount(CreateNodeForm, { props: { parents: PARENTS, ...props }, attachTo: document.body })

/** Fills every field with something valid. */
async function fillIn(wrapper, overrides = {}) {
  const values = {
    title: 'Ask for feedback',
    description: 'Requests a rating after the chat',
    type: 'sendMessage',
    parentId: 'b6a0c1',
    ...overrides,
  }
  await wrapper.findComponent(BaseInput).setValue(values.title)
  await wrapper.findComponent(BaseTextarea).setValue(values.description)
  const [type, parent] = wrapper.findAllComponents(BaseSelect)
  await type.setValue(values.type)
  await parent.setValue(values.parentId)
  return values
}

const submit = (wrapper) => wrapper.find('form').trigger('submit')
const messages = (wrapper) => wrapper.findAll('p').map((p) => p.text())

describe('CreateNodeForm', () => {
  it('asks for a title, a description, a type and where to add the node', () => {
    const labels = mountForm()
      .findAll('label')
      .map((label) => label.text().replace(' *', ''))

    expect(labels).toEqual(['Title', 'Description', 'Type of node', 'Add after'])
  })

  it('offers only the three types the brief lists', () => {
    const [type] = mountForm().findAllComponents(BaseSelect)

    expect(type.props('options')).toEqual([
      { value: 'sendMessage', label: 'Send Message' },
      { value: 'addComment', label: 'Add Comment' },
      { value: 'businessHours', label: 'Business Hours' },
    ])
  })

  it('offers the steps it was given as parents', () => {
    const [, parent] = mountForm().findAllComponents(BaseSelect)
    expect(parent.props('options')).toEqual(PARENTS)
  })

  it('says nothing is wrong before the user has done anything', () => {
    expect(messages(mountForm())).toEqual(['0 / 200', 'The new step is added after this one.'])
  })

  it('counts the description as it is typed', async () => {
    const wrapper = mountForm()

    await wrapper.findComponent(BaseTextarea).setValue('  Five  ')

    expect(messages(wrapper)).toContain('4 / 200')
  })

  describe('validation', () => {
    it('shows a field’s message once the user leaves it', async () => {
      const wrapper = mountForm()

      await wrapper.findComponent(BaseInput).trigger('blur')

      expect(messages(wrapper)).toContain('Title is required')
    })

    it('leaves the other fields quiet', async () => {
      const wrapper = mountForm()

      await wrapper.findComponent(BaseInput).trigger('blur')

      expect(messages(wrapper)).not.toContain('Choose a node type')
    })

    it('shows every message on submit and does not submit', async () => {
      const wrapper = mountForm()

      await submit(wrapper)

      expect(messages(wrapper)).toEqual(
        expect.arrayContaining([
          'Title is required',
          'Description is required',
          'Choose a node type',
          'Choose where to add the node',
        ]),
      )
      expect(wrapper.emitted('submit')).toBeUndefined()
    })

    it('puts the cursor on the first thing to fix', async () => {
      const wrapper = mountForm()

      await submit(wrapper)
      await new Promise((resolve) => setTimeout(resolve))

      expect(document.activeElement).toBe(wrapper.find('input').element)
    })
  })

  it('hands the values over when everything is filled in', async () => {
    const wrapper = mountForm()
    const values = await fillIn(wrapper)

    await submit(wrapper)

    expect(wrapper.emitted('submit')).toEqual([[values]])
  })

  describe('a message from the server', () => {
    /** Fill in, submit, then have the server reject the title. */
    async function submitAndReject() {
      const wrapper = mountForm()
      await fillIn(wrapper)
      await submit(wrapper)
      await wrapper.setProps({ serverErrors: { title: 'Title is already used' } })
      return wrapper
    }

    it('is shown under its field', async () => {
      expect(messages(await submitAndReject())).toContain('Title is already used')
    })

    it('goes away once that field is changed, since it was about the old value', async () => {
      const wrapper = await submitAndReject()

      await wrapper.findComponent(BaseInput).setValue('Ask for feedback again')

      expect(messages(wrapper)).not.toContain('Title is already used')
    })

    it('stays while the other fields are edited', async () => {
      const wrapper = await submitAndReject()

      await wrapper.findComponent(BaseTextarea).setValue('A different description')

      expect(messages(wrapper)).toContain('Title is already used')
    })
  })

  it('locks the fields while the node is being created', () => {
    const wrapper = mountForm({ pending: true })

    expect(wrapper.findComponent(BaseInput).props('disabled')).toBe(true)
    expect(wrapper.findComponent(BaseTextarea).props('disabled')).toBe(true)
    expect(wrapper.findAllComponents(BaseSelect).every((s) => s.props('disabled'))).toBe(true)
  })

  it('carries the id its submit button points at', () => {
    expect(mountForm({ id: 'create-node-form' }).find('form').attributes('id')).toBe(
      'create-node-form',
    )
  })
})
