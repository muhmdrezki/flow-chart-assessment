import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import payload from '../../../../public/payload.json'
import BaseDrawer from '@/components/ui/BaseDrawer/BaseDrawer.vue'
import { normalizePayload } from '@/utils/graph'
import NodeDetailsDrawer from './NodeDetailsDrawer.vue'

const nodes = normalizePayload(payload)
const node = (id) => nodes.find((candidate) => candidate.id === String(id))

// The drawer teleports to the body, so its markup is looked up there.
const query = (selector) => document.body.querySelector(selector)
const queryAll = (selector) => [...document.body.querySelectorAll(selector)]
const panel = () => query('[role="dialog"]')

const mountDrawer = (props = {}) =>
  mount(NodeDetailsDrawer, { props: { node: node('b6a0c1'), ...props }, attachTo: document.body })

afterEach(() => {
  document.body.innerHTML = ''
})

describe('NodeDetailsDrawer', () => {
  it('is closed when no node is selected', () => {
    mountDrawer({ node: null })
    expect(panel()).toBeNull()
  })

  it('leaves the canvas usable, since the node has to stay clickable', () => {
    expect(mountDrawer().findComponent(BaseDrawer).props('modal')).toBe(false)
  })

  it('is headed by the node’s name and its kind', () => {
    mountDrawer()

    expect(query('h2').textContent).toBe('Away Message')
    expect(query('header p').textContent).toBe('Send Message')
  })

  it('calls a node without a name after its kind, as the canvas does', () => {
    mountDrawer({ node: node(1) })
    expect(query('h2').textContent).toBe('Trigger')
  })

  it('does not print the kind twice when the node is named after it', () => {
    mountDrawer({ node: node('d09c08') })

    expect(query('h2').textContent).toBe('Business Hours')
    expect(query('header p')).toBeNull()
  })

  describe('what it shows', () => {
    const rows = () => queryAll('dt').map((term) => term.textContent)
    const valueOf = (label) => {
      const index = rows().indexOf(label)
      return queryAll('dd')[index]
    }

    it('shows a trigger’s event and setting, read-only', () => {
      mountDrawer({ node: node(1) })

      expect(rows()).toEqual(['Event', 'Once per contact'])
      expect(valueOf('Event').textContent.trim()).toBe('Conversation Opened')
      expect(valueOf('Once per contact').textContent.trim()).toBe('No')
      expect(query('input')).toBeNull()
    })

    it('keeps the line breaks a message was written with', () => {
      mountDrawer({ node: node('b0653a') })

      expect(valueOf('Message').classList.contains('whitespace-pre-line')).toBe(true)
      expect(valueOf('Message').textContent.trim()).toBe('Hello there\n\nwelcome to the chat!')
    })

    it('links an attachment by its file name and previews it when it is an image', () => {
      mountDrawer({ node: node('b0653a') })
      const link = query('a')

      expect(link.textContent.trim()).toBe('354.jpg')
      expect(link.getAttribute('href')).toContain('picsum.photos')
      expect(link.getAttribute('rel')).toBe('noopener')
      expect(query('img').getAttribute('src')).toBe(link.getAttribute('href'))
    })

    it('does not preview an attachment that is not an image', () => {
      mountDrawer({
        node: {
          id: 'x',
          type: 'sendMessage',
          data: { payload: [{ type: 'attachment', attachment: 'https://files.test/terms.pdf' }] },
        },
      })

      expect(query('a').textContent.trim()).toBe('terms.pdf')
      expect(query('img')).toBeNull()
    })

    it('shows business hours as the whole week, closed days included', () => {
      mountDrawer({ node: node('d09c08') })

      const [monday] = queryAll('li')

      expect(rows()).toEqual(['Time zone', 'Opening hours'])
      expect(queryAll('li')).toHaveLength(7)
      expect(monday.textContent).toContain('Monday')
      expect(monday.textContent).toContain('09:00 – 17:00')
    })

    it('says a day with only half its hours is closed, rather than trailing a dash', () => {
      mountDrawer({
        node: {
          id: 'x',
          type: 'dateTime',
          data: { action: 'businessHours', times: [{ day: 'mon', startTime: '09:00' }] },
        },
      })

      expect(queryAll('li')[0].textContent).toContain('Closed')
      expect(queryAll('li')[0].textContent).not.toContain('09:00')
    })

    it('says a day is closed when there are no hours for it', () => {
      mountDrawer({
        node: {
          id: 'x',
          type: 'dateTime',
          data: {
            action: 'businessHours',
            times: [{ day: 'mon', startTime: '09:00', endTime: '17:00' }],
          },
        },
      })

      expect(queryAll('li').at(-1).textContent).toContain('Closed')
    })

    it('says so when a step has nothing to show yet', () => {
      mountDrawer({ node: { id: 'x', type: 'sendMessage', data: { payload: [] } } })

      expect(panel().textContent).toContain('This step has nothing to show yet')
      // A description list takes only terms and definitions, so the message sits outside it.
      expect(query('dl').textContent.trim()).toBe('')
    })
  })

  it('swaps its contents when another node is selected, without closing', async () => {
    const wrapper = mountDrawer()

    await wrapper.setProps({ node: node('e879e4') })

    expect(query('h2').textContent).toBe('Add Comment #1')
    expect(panel()).not.toBeNull()
  })

  it('keeps showing the node it had while it slides out', async () => {
    const wrapper = mountDrawer()

    await wrapper.setProps({ node: null })

    // The panel is on its way out, so emptying it now would blank the content mid-animation.
    expect(wrapper.findComponent(BaseDrawer).props('title')).toBe('Away Message')
  })

  it('asks to be closed when the panel does', () => {
    const wrapper = mountDrawer()

    wrapper.findComponent(BaseDrawer).vm.$emit('close')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
