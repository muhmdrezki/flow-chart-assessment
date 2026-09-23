import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MessagePartsField from './MessagePartsField.vue'

const PARTS = [
  { key: 'a', type: 'text', text: 'Hello there' },
  { key: 'b', type: 'attachment', attachment: 'https://files.test/menu.png' },
]

/** A file the user uploaded: its value is the file itself, so there is no address to show. */
const UPLOADED_PDF = 'data:application/pdf;base64,JVBERi0='

const mountField = (props = {}) =>
  mount(MessagePartsField, { props: { modelValue: PARTS, ...props } })

const lastParts = (wrapper) => wrapper.emitted('update:modelValue').at(-1)[0]
const buttonWith = (wrapper, text) =>
  wrapper.findAll('button').find((button) => button.text().includes(text))

describe('MessagePartsField', () => {
  it('shows a box per part, in the order they are sent', () => {
    const wrapper = mountField()
    const [text, attachment] = wrapper.findAll('li')

    expect(text.find('textarea').element.value).toBe('Hello there')
    expect(attachment.text()).toContain('menu.png')
  })

  it('asks for a link while an attachment has none yet', () => {
    const wrapper = mountField({ modelValue: [{ key: 'a', type: 'attachment', attachment: '' }] })

    expect(wrapper.find('input[type="url"]').exists()).toBe(true)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('reports edited text', async () => {
    const wrapper = mountField()

    await wrapper.find('textarea').setValue('Hi again')

    expect(lastParts(wrapper)[0]).toEqual({ key: 'a', type: 'text', text: 'Hi again' })
    expect(lastParts(wrapper)[1]).toEqual(PARTS[1])
  })

  describe('a link being typed', () => {
    /** The parent this field reports to: what it emits comes back as what it shows. */
    const applyEdits = (wrapper) => wrapper.setProps({ modelValue: lastParts(wrapper) })

    async function addLink(wrapper) {
      await buttonWith(wrapper, 'Add link').trigger('click')
      await applyEdits(wrapper)
      return wrapper.find('input[type="url"]')
    }

    it('keeps the field of a link that was already there while it is edited', async () => {
      // A link the node arrived with is not "new", but editing `…/a.pdf` into `…/a.png` makes it a
      // picture mid-word — and a tile appearing under the cursor takes the rest of the address.
      const wrapper = mountField({
        modelValue: [{ key: 'a', type: 'attachment', attachment: 'https://files.test/terms.pdf' }],
      })
      const field = wrapper.find('input[type="url"]')
      await field.trigger('focus')

      await field.setValue('https://files.test/terms.png')
      await wrapper.setProps({ modelValue: lastParts(wrapper) })

      expect(wrapper.find('input[type="url"]').element.value).toBe('https://files.test/terms.png')
      expect(wrapper.find('img').exists()).toBe(false)

      // And becomes the picture it now points at once the cursor leaves.
      await wrapper.find('input[type="url"]').trigger('blur')

      expect(wrapper.find('img').exists()).toBe(true)
    })

    it('keeps its field, however little has been typed so far', async () => {
      const wrapper = mountField({ modelValue: [] })
      const field = await addLink(wrapper)

      // The first character is enough to give the part a value; the field has to survive it.
      await field.setValue('h')
      await applyEdits(wrapper)

      expect(wrapper.find('input[type="url"]').element.value).toBe('h')
    })

    it('becomes a tile once the field is left', async () => {
      const wrapper = mountField({ modelValue: [] })
      const field = await addLink(wrapper)

      await field.setValue('https://files.test/other.png')
      await applyEdits(wrapper)
      await field.trigger('blur')

      expect(wrapper.find('input[type="url"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('other.png')
    })

    it('keeps its field when it is left empty, since there is nothing to show', async () => {
      const wrapper = mountField({ modelValue: [] })
      const field = await addLink(wrapper)

      await field.trigger('blur')

      expect(wrapper.find('input[type="url"]').exists()).toBe(true)
    })
  })

  it('reports a link as it is typed', async () => {
    const wrapper = mountField({ modelValue: [{ key: 'a', type: 'attachment', attachment: '' }] })

    await wrapper.find('input[type="url"]').setValue('https://files.test/other.png')

    expect(lastParts(wrapper)[0].attachment).toBe('https://files.test/other.png')
  })

  it('adds an empty text part', async () => {
    const wrapper = mountField()

    await buttonWith(wrapper, 'Add text').trigger('click')

    expect(lastParts(wrapper)).toHaveLength(3)
    expect(lastParts(wrapper).at(-1)).toEqual({ key: expect.any(String), type: 'text', text: '' })
  })

  it('adds an empty attachment link', async () => {
    const wrapper = mountField()

    await buttonWith(wrapper, 'Add link').trigger('click')

    expect(lastParts(wrapper).at(-1)).toEqual({
      key: expect.any(String),
      type: 'attachment',
      attachment: '',
    })
  })

  describe('an attachment', () => {
    const UPLOADED = 'data:image/png;base64,iVBORw0KGgo='

    it('is previewed as the picture it is', () => {
      const wrapper = mountField()

      expect(wrapper.find('img').attributes('src')).toBe('https://files.test/menu.png')
    })

    it('is shown as a named box when an uploaded file is not a picture', () => {
      const wrapper = mountField({
        modelValue: [{ key: 'a', type: 'attachment', attachment: UPLOADED_PDF }],
      })

      expect(wrapper.find('img').exists()).toBe(false)
      expect(wrapper.text()).toContain('Uploaded PDF')
    })

    it('leaves a link that is not a picture as a link', () => {
      // A box with a paperclip in it says less about a link than its address does, and a link is
      // the one kind of attachment that can still be read and corrected where it stands.
      const wrapper = mountField({
        modelValue: [{ key: 'a', type: 'attachment', attachment: 'https://files.test/terms.pdf' }],
      })

      expect(wrapper.find('input[type="url"]').element.value).toBe('https://files.test/terms.pdf')
      expect(wrapper.find('img').exists()).toBe(false)
    })

    it('goes back to a text field when the address was refused, so it can be corrected', () => {
      const wrapper = mountField({ errors: { 'parts.1': 'An attachment must be a web link' } })

      expect(wrapper.find('input[type="url"]').element.value).toBe('https://files.test/menu.png')
      expect(wrapper.find('img').exists()).toBe(false)
    })

    it('shows an uploaded file without an address nobody can read', () => {
      const wrapper = mountField({
        modelValue: [{ key: 'a', type: 'attachment', attachment: UPLOADED }],
      })

      expect(wrapper.find('img').attributes('src')).toBe(UPLOADED)
      expect(wrapper.text()).toContain('Uploaded PNG')
      expect(wrapper.find('input[type="url"]').exists()).toBe(false)
    })
  })

  describe('the preview', () => {
    const lightbox = () => document.body.querySelector('[role="dialog"]')

    afterEach(() => {
      document.body.innerHTML = ''
    })

    it('opens the picture full size when its tile is clicked', async () => {
      const wrapper = mountField({ attachTo: document.body })

      await wrapper.find('[aria-label="Preview menu.png"]').trigger('click')

      expect(lightbox().querySelector('img').getAttribute('src')).toBe(
        'https://files.test/menu.png',
      )
      expect(lightbox().textContent).toContain('menu.png')
    })

    it('closes again', async () => {
      const wrapper = mountField()
      await wrapper.find('[aria-label="Preview menu.png"]').trigger('click')

      await wrapper.findComponent({ name: 'BaseLightbox' }).vm.$emit('close')

      expect(lightbox()).toBeNull()
    })

    it('is not offered for a file that is not a picture', () => {
      const wrapper = mountField({
        modelValue: [{ key: 'a', type: 'attachment', attachment: UPLOADED_PDF }],
      })

      expect(wrapper.find('[aria-label^="Preview"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('Uploaded PDF')
    })
  })

  describe('uploading', () => {
    const chooseFiles = async (wrapper, files) => {
      const input = wrapper.find('input[type="file"]')
      Object.defineProperty(input.element, 'files', { value: files, writable: true })
      await input.trigger('change')
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    const fileOf = (name = 'photo.png') =>
      new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' })

    it('adds the file beside whatever is already there', async () => {
      const wrapper = mountField()

      await chooseFiles(wrapper, [fileOf()])

      const added = lastParts(wrapper)
      expect(added).toHaveLength(3)
      expect(added[0]).toEqual(PARTS[0])
      expect(added.at(-1).attachment.startsWith('data:image/png;base64,')).toBe(true)
    })

    it('takes several files at once', async () => {
      const wrapper = mountField()

      await chooseFiles(wrapper, [fileOf('one.png'), fileOf('two.png')])

      expect(lastParts(wrapper)).toHaveLength(4)
    })

    it('says so when a file is too big to carry, and adds nothing', async () => {
      const wrapper = mountField()
      const huge = fileOf('huge.png')
      Object.defineProperty(huge, 'size', { value: 3 * 1024 * 1024 })

      await chooseFiles(wrapper, [huge])

      expect(wrapper.find('[role="alert"]').text()).toContain('larger than 2 MB')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
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
    expect(wrapper.find('input[type="file"]').attributes('disabled')).toBeDefined()
    expect(
      wrapper
        .findAll('button')
        .filter((button) => button.attributes('aria-label') !== 'Preview menu.png')
        .every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true)
  })
})
