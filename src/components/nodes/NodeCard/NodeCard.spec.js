import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import NodeCard from './NodeCard.vue'

// Handle needs a surrounding Vue Flow instance; a stub that records its props is enough here.
const stubs = vi.hoisted(() => ({}))
vi.mock('@vue-flow/core', async () => {
  const { defineComponent, h } = await import('vue')
  stubs.Handle = defineComponent({
    name: 'Handle',
    props: { type: String, position: String },
    setup: (props) => () => h('span', { 'data-handle': props.type }),
  })
  return { Handle: stubs.Handle, Position: { Top: 'top', Bottom: 'bottom' } }
})

const mountCard = (props = {}) =>
  mount(NodeCard, {
    props: {
      type: 'sendMessage',
      data: {
        title: 'Welcome Message',
        description: '',
        summary: { label: 'Message', text: 'Hello there welcome to the chat!' },
      },
      ...props,
    },
  })

/** The label is followed by a non-breaking space, which reads as an ordinary one. */
const NON_BREAKING_SPACE = String.fromCharCode(160)
const plainText = (element) => element.text().split(NON_BREAKING_SPACE).join(' ')

/** The card's text under the title: what the user wrote, then what the step holds. */
const textLines = (wrapper) => wrapper.findAll('p').slice(1)

const handles = (wrapper) => wrapper.findAllComponents(stubs.Handle).map((handle) => handle.props())

describe('NodeCard', () => {
  it('shows the title', () => {
    expect(mountCard().text()).toContain('Welcome Message')
  })

  describe('what the card says under the title', () => {
    it('labels the message and sets the message itself apart, as the mockup does', () => {
      const [summary] = textLines(mountCard())

      expect(plainText(summary)).toBe('Message: Hello there welcome to the chat!')
      expect(summary.find('.italic').text()).toBe('Hello there welcome to the chat!')
    })

    it('shows the whole thing on hover, in case it is longer than the card', () => {
      expect(textLines(mountCard())[0].attributes('title')).toBe(
        'Message: Hello there welcome to the chat!',
      )
    })

    it('leaves an unlabelled summary alone', () => {
      const wrapper = mountCard({
        type: 'trigger',
        data: { title: 'Trigger', description: '', summary: { label: '', text: 'Opened' } },
      })

      expect(textLines(wrapper)[0].text()).toBe('Opened')
      // Italic is for a message being quoted, not for a line describing the step.
      expect(wrapper.find('.italic').exists()).toBe(false)
    })

    it('shows what the user wrote above what the step holds, each on its own line', () => {
      const wrapper = mountCard({
        data: {
          title: 'Welcome Message',
          description: 'Greets a first-time visitor',
          summary: { label: 'Message', text: 'Hello there' },
        },
      })

      expect(textLines(wrapper).map(plainText)).toEqual([
        'Greets a first-time visitor',
        'Message: Hello there',
      ])
    })

    it('cuts the description to a line and gives the message three', () => {
      // The brief truncates a node’s description, so it gets the one line. The message is the
      // reason the card is worth reading, so it gets the rest; both end in an ellipsis when there
      // is more than they can show.
      const wrapper = mountCard({
        data: {
          title: 'Welcome Message',
          description: 'Greets a first-time visitor',
          summary: { label: 'Message', text: 'Hello there' },
        },
      })
      const [description, summary] = textLines(wrapper)

      expect(description.classes()).toContain('line-clamp-1')
      expect(summary.classes()).toContain('line-clamp-3')
    })
  })

  it('omits both lines when there is nothing to say', () => {
    const wrapper = mountCard({ data: { title: 'Trigger', description: '' } })
    expect(textLines(wrapper)).toHaveLength(0)
  })

  it.each([
    ['trigger', 'zap'],
    ['sendMessage', 'send'],
    ['addComment', 'message-square'],
    ['businessHours', 'calendar-clock'],
    ['unknown', 'circle-help'],
  ])('shows the %s icon', (type, icon) => {
    expect(mountCard({ type }).findComponent(BaseIcon).props('name')).toBe(icon)
  })

  it('uses the kind’s accent colour', () => {
    const style = mountCard({ type: 'businessHours' }).attributes('style')
    expect(style).toContain('--accent: var(--color-kind-business-hours)')
  })

  it('marks its kind on the element', () => {
    expect(mountCard({ type: 'addComment' }).attributes('data-kind')).toBe('addComment')
  })

  describe.each(['sendMessage', 'addComment', 'businessHours'])(
    'a %s node, which has a drawer',
    (type) => {
      it('looks clickable', () => {
        const wrapper = mountCard({ type })

        expect(wrapper.attributes('data-has-details')).toBe('true')
        expect(wrapper.classes()).toContain('cursor-pointer')
        expect(wrapper.classes()).toContain('hover:shadow-md')
      })

      it('is a button the keyboard can reach', () => {
        const wrapper = mountCard({ type })

        expect(wrapper.attributes('role')).toBe('button')
        expect(wrapper.attributes('tabindex')).toBe('0')
      })

      it.each(['Enter', ' '])('opens its drawer on %s', async (key) => {
        const wrapper = mountCard({ type })

        await wrapper.trigger('keydown', { key })

        expect(wrapper.emitted('activate')).toHaveLength(1)
      })

      it('says whether it is the open one, since it toggles', () => {
        expect(mountCard({ type, selected: true }).attributes('aria-pressed')).toBe('true')
        expect(mountCard({ type, selected: false }).attributes('aria-pressed')).toBe('false')
      })

      it('ignores other keys, so typing elsewhere is not swallowed', async () => {
        const wrapper = mountCard({ type })

        await wrapper.trigger('keydown', { key: 'a' })

        expect(wrapper.emitted('activate')).toBeUndefined()
      })
    },
  )

  describe.each(['trigger', 'unknown'])('a display-only %s node', (kind) => {
    it('does not look clickable', () => {
      const wrapper = mountCard({ type: kind })

      expect(wrapper.attributes('data-has-details')).toBe('false')
      expect(wrapper.classes()).toContain('cursor-default')
      expect(wrapper.classes()).not.toContain('hover:shadow-md')
    })

    it('is not a button and is out of the tab order', () => {
      const wrapper = mountCard({ type: kind })

      expect(wrapper.attributes('role')).toBeUndefined()
      expect(wrapper.attributes('tabindex')).toBeUndefined()
      expect(wrapper.attributes('aria-pressed')).toBeUndefined()
    })

    it('cannot be opened from the keyboard either', async () => {
      const wrapper = mountCard({ type: kind })

      await wrapper.trigger('keydown', { key: 'Enter' })

      expect(wrapper.emitted('activate')).toBeUndefined()
    })
  })

  it('highlights its border in the accent colour when selected', () => {
    expect(mountCard({ selected: true }).classes()).toContain('border-(--accent)')
    expect(mountCard({ selected: false }).classes()).toContain('border-slate-200')
  })

  it('has an input and an output handle', () => {
    expect(handles(mountCard())).toEqual([
      { type: 'target', position: 'top' },
      { type: 'source', position: 'bottom' },
    ])
  })

  it('gives the trigger no input handle, since a flow starts there', () => {
    expect(handles(mountCard({ type: 'trigger' }))).toEqual([
      { type: 'source', position: 'bottom' },
    ])
  })

  it('falls back to the unknown look for an unregistered type', () => {
    const wrapper = mountCard({ type: 'webhook' })

    expect(wrapper.findComponent(BaseIcon).props('name')).toBe('circle-help')
    expect(wrapper.attributes('data-has-details')).toBe('false')
  })
})
