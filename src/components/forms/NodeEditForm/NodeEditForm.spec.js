import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import payload from '../../../../public/payload.json'
import BusinessHoursGrid from '@/components/forms/BusinessHoursGrid/BusinessHoursGrid.vue'
import MessagePartsField from '@/components/forms/MessagePartsField/MessagePartsField.vue'
import { normalizePayload } from '@/utils/graph'
import { toDraft } from '@/utils/nodeEdit'
import { getNodeKind } from '@/utils/nodeKind'
import NodeEditForm from './NodeEditForm.vue'

const nodes = normalizePayload(payload)
const node = (id) => nodes.find((candidate) => candidate.id === String(id))

/** Mounts the form on a payload node, the way the drawer does. */
function mountForm(id, props = {}) {
  const source = node(id)
  return mount(NodeEditForm, {
    props: {
      modelValue: toDraft(source),
      kind: getNodeKind(source),
      event: source.data?.type,
      ...props,
    },
  })
}

const labels = (wrapper) => wrapper.findAll('label').map((label) => label.text().replace(' *', ''))
const lastDraft = (wrapper) => wrapper.emitted('update:modelValue').at(-1)[0]

describe('NodeEditForm', () => {
  it('asks for a title and a description whatever the node is', () => {
    expect(labels(mountForm('e879e4'))).toContain('Title')
    expect(labels(mountForm('e879e4'))).toContain('Description')
  })

  it('reports a change without touching the draft it was given', async () => {
    const wrapper = mountForm('e879e4')
    const before = wrapper.props('modelValue')

    await wrapper.find('input').setValue('Renamed')

    expect(lastDraft(wrapper).title).toBe('Renamed')
    expect(before.title).toBe('Add Comment #1')
  })

  it('counts the description as it is typed', async () => {
    const wrapper = mountForm('e879e4')

    await wrapper.findAll('textarea')[0].setValue('  Four  ')

    expect(wrapper.text()).toContain('4 / 200')
  })

  it('edits a comment', async () => {
    const wrapper = mountForm('e879e4')

    expect(labels(wrapper)).toContain('Comment')
    await wrapper.findAll('textarea')[1].setValue('Looked at it')

    expect(lastDraft(wrapper).comment).toBe('Looked at it')
  })

  it('edits a message through its parts', async () => {
    const wrapper = mountForm('b0653a')
    const parts = wrapper.findComponent(MessagePartsField)

    expect(parts.props('modelValue')).toHaveLength(2)
    await parts.vm.$emit('update:modelValue', [{ key: 'a', type: 'text', text: 'Changed' }])

    expect(lastDraft(wrapper).parts).toEqual([{ key: 'a', type: 'text', text: 'Changed' }])
  })

  describe('business hours', () => {
    it('shows the week and the time zone', () => {
      const grid = mountForm('d09c08').findComponent(BusinessHoursGrid)

      expect(grid.props('days')).toHaveLength(7)
      expect(grid.props('timezone')).toBe('UTC')
    })

    it('reports an edited week', async () => {
      const wrapper = mountForm('d09c08')
      const grid = wrapper.findComponent(BusinessHoursGrid)

      await grid.vm.$emit('update:days', [{ day: 'mon', isOpen: false }])

      expect(lastDraft(wrapper).days).toEqual([{ day: 'mon', isOpen: false }])
    })

    it('reports an edited time zone', async () => {
      const wrapper = mountForm('d09c08')

      await wrapper.findComponent(BusinessHoursGrid).vm.$emit('update:timezone', 'Asia/Tokyo')

      expect(lastDraft(wrapper).timezone).toBe('Asia/Tokyo')
    })
  })

  it('shows a message under the field it belongs to', () => {
    const wrapper = mountForm('e879e4', { errors: { title: 'Title is required' } })

    expect(wrapper.text()).toContain('Title is required')
    expect(wrapper.find('input').attributes('aria-invalid')).toBe('true')
  })

  it('hands the messages about parts and days straight down', () => {
    const errors = { 'parts.0': 'Message text is required' }
    const wrapper = mountForm('b0653a', { errors })

    expect(wrapper.findComponent(MessagePartsField).props('errors')).toEqual(errors)
  })

  it('locks its fields while the node is being saved', () => {
    const wrapper = mountForm('e879e4', { disabled: true })

    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
    expect(
      wrapper.findAll('textarea').every((box) => box.attributes('disabled') !== undefined),
    ).toBe(true)
  })
})
