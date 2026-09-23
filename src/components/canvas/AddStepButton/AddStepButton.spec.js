import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AddStepButton from './AddStepButton.vue'

const mountButton = (props = {}) => mount(AddStepButton, { props })

/*
 * The "+" that adds a step, in both the places it appears: on the line between two steps, and under
 * a step with nothing after it yet. One component with two placements, so these tests are mostly
 * about it staying one — the look and the accessible name must not drift apart between them.
 *
 * The two Vue Flow classes are load-bearing rather than cosmetic: without them, pressing the button
 * drags the step or pans the canvas underneath it.
 */
describe('AddStepButton', () => {
  it('asks for a step to be added', async () => {
    const wrapper = mountButton()

    await wrapper.trigger('click')

    expect(wrapper.emitted('add')).toHaveLength(1)
  })

  it('says which step it would add after, since a bare "+" says nothing', () => {
    expect(mountButton({ title: 'Away Message' }).attributes('aria-label')).toBe(
      'Add a step after Away Message',
    )
  })

  it('still says what it does when the step has no name', () => {
    expect(mountButton().attributes('aria-label')).toBe('Add a step here')
  })

  it('keeps its press off the canvas underneath', () => {
    // Vue Flow's own classes: without them, pressing the button drags the step or pans the canvas.
    expect(mountButton().classes()).toEqual(expect.arrayContaining(['nodrag', 'nopan']))
  })

  it('hangs under the step it belongs to by default', () => {
    const wrapper = mountButton()

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['absolute', 'top-full']))
    expect(wrapper.attributes('style')).toBeUndefined()
  })

  it('is joined to that step by a dashed line, since nothing is there yet', () => {
    expect(mountButton().classes()).toEqual(
      expect.arrayContaining(['before:border-l-2', 'before:border-dashed']),
    )
  })

  it('sits on the point it is given instead, for the one on a line', () => {
    const wrapper = mountButton({ at: { x: 40, y: 90 } })

    expect(wrapper.classes()).not.toContain('top-full')
    expect(wrapper.attributes('style')).toContain('translate(40px, 90px)')
    // Half its own size back, so the point is its middle rather than its corner.
    expect(wrapper.attributes('style')).toContain('translate(-50%, -50%)')
  })

  it('has no line of its own there, since it already sits on one', () => {
    expect(mountButton({ at: { x: 40, y: 90 } }).classes()).not.toContain('before:border-dashed')
  })
})
