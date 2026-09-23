import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FlowEdge from './FlowEdge.vue'

/** What Vue Flow hands a custom edge: the id, the two ends it worked out, and our own data. */
const ENDS = { sourceX: 0, sourceY: 0, targetX: 100, targetY: 80 }

const mountEdge = (data = { canInsert: true, sourceTitle: 'Business Hours' }) =>
  mount(FlowEdge, {
    props: { id: 'e-1-bh', source: '1', ...ENDS, data },
    global: {
      stubs: {
        // Both render into Vue Flow's own layers, which only exist inside a canvas.
        BaseEdge: { props: { path: String }, template: '<path :d="path" />' },
        EdgeLabelRenderer: { template: '<div><slot /></div>' },
      },
    },
  })

const insertButton = (wrapper) => wrapper.find('button')

describe('FlowEdge', () => {
  it('draws a line between the two ends', () => {
    const path = mountEdge().find('path').attributes('d')

    expect(path).toContain('M0,0')
    expect(path).toContain('100,80')
  })

  it('offers a "+" where a step may be added', () => {
    expect(insertButton(mountEdge()).exists()).toBe(true)
  })

  it('asks for a step after the one above the line', async () => {
    const wrapper = mountEdge()

    await insertButton(wrapper).trigger('click')

    expect(wrapper.emitted('insert')).toEqual([['1']])
  })

  it('says which step it would add after, since a bare "+" says nothing', () => {
    expect(insertButton(mountEdge()).attributes('aria-label')).toBe(
      'Add a step after Business Hours',
    )
  })

  it('still says what it does when the step has no name', () => {
    const wrapper = mountEdge({ canInsert: true, sourceTitle: '' })

    expect(insertButton(wrapper).attributes('aria-label')).toBe('Add a step here')
  })

  it('has no "+" where a step may not be added', () => {
    const wrapper = mountEdge({ canInsert: false, sourceTitle: 'Business Hours' })

    expect(insertButton(wrapper).exists()).toBe(false)
    expect(wrapper.find('path').exists()).toBe(true)
  })

  it('keeps a press on the button from dragging the canvas under it', () => {
    // Vue Flow's own classes: without them the pane pans while the button is being clicked.
    expect(insertButton(mountEdge()).classes()).toEqual(expect.arrayContaining(['nodrag', 'nopan']))
  })

  it('sits on the line rather than at the canvas origin', () => {
    const style = insertButton(mountEdge()).attributes('style')

    expect(style).toContain('translate(-50%, -50%)')
    expect(style).toMatch(/translate\(\d+(\.\d+)?px, \d+(\.\d+)?px\)/)
  })
})
