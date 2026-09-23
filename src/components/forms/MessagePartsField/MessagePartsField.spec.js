import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MessagePartsField from './MessagePartsField.vue'

const PARTS = [
  { key: 'a', type: 'text', text: 'Hello there' },
  { key: 'b', type: 'attachment', attachment: 'https://files.test/menu.png' },
]

const mountField = (props = {}) =>
  mount(MessagePartsField, { props: { modelValue: PARTS, ...props } })

const lastParts = (wrapper) => wrapper.emitted('update:modelValue').at(-1)[0]
const buttonWith = (wrapper, text) =>
  wrapper.findAll('button').find((button) => button.text().includes(text))

describe('MessagePartsField', () => {
  it('shows a box per part, in the order they are sent', () => {
    const wrapper = mountField()

    expect(wrapper.find('textarea').element.value).toBe('Hello there')
    expect(wrapper.find('input').element.value).toBe('https://files.test/menu.png')
  })

  it('asks for a link where a part is an attachment', () => {
    expect(mountField().find('input').attributes('type')).toBe('url')
  })

  it('reports edited text', async () => {
    const wrapper = mountField()

    await wrapper.find('textarea').setValue('Hi again')

    expect(lastParts(wrapper)[0]).toEqual({ key: 'a', type: 'text', text: 'Hi again' })
    expect(lastParts(wrapper)[1]).toEqual(PARTS[1])
  })

  it('reports an edited link', async () => {
    const wrapper = mountField()

    await wrapper.find('input').setValue('https://files.test/other.png')

    expect(lastParts(wrapper)[1].attachment).toBe('https://files.test/other.png')
  })

  it('adds an empty text part', async () => {
    const wrapper = mountField()

    await buttonWith(wrapper, 'Add text').trigger('click')

    expect(lastParts(wrapper)).toHaveLength(3)
    expect(lastParts(wrapper).at(-1)).toEqual({ key: expect.any(String), type: 'text', text: '' })
  })

  it('adds an empty attachment', async () => {
    const wrapper = mountField()

    await buttonWith(wrapper, 'Add attachment').trigger('click')

    expect(lastParts(wrapper).at(-1)).toEqual({
      key: expect.any(String),
      type: 'attachment',
      attachment: '',
    })
  })

  it('removes the part its button belongs to', async () => {
    const wrapper = mountField()

    await wrapper.find('[aria-label="Remove part 1"]').trigger('click')

    expect(lastParts(wrapper)).toEqual([PARTS[1]])
  })

  it('shows a message under the part it is about', () => {
    const wrapper = mountField({ errors: { 'parts.1': 'A link must be a web link' } })

    expect(wrapper.findAll('li')[1].text()).toContain('A link must be a web link')
    expect(wrapper.find('input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('textarea').attributes('aria-invalid')).toBeUndefined()
  })

  it('says when a message has nothing in it at all', () => {
    const wrapper = mountField({
      modelValue: [],
      errors: { parts: 'Add a message or an attachment' },
    })

    expect(wrapper.find('li').exists()).toBe(false)
    expect(wrapper.text()).toContain('Add a message or an attachment')
  })

  it('locks every control while the node is being saved', () => {
    const wrapper = mountField({ disabled: true })

    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
    expect(
      wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true)
  })
})
