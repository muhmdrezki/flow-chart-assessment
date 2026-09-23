import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseLightbox from './BaseLightbox.vue'

// The lightbox teleports to the body, so its markup is looked up there.
const panel = () => document.body.querySelector('[role="dialog"]')
const query = (selector) => document.body.querySelector(selector)

const mountLightbox = (props = {}) =>
  mount(BaseLightbox, {
    props: { src: 'https://files.test/menu.png', alt: 'menu.png', ...props },
    attachTo: document.body,
  })

afterEach(() => {
  document.body.innerHTML = ''
})

/*
 * The full-size picture view. It is a genuine modal — the only one in the app that stacks on top of
 * another panel — so the focus and Escape behaviour is what matters: it takes focus when it opens,
 * gives it back when it closes, and closes on Escape, the backdrop and the button.
 */
describe('BaseLightbox', () => {
  it('shows nothing when there is no picture', () => {
    mountLightbox({ src: '' })
    expect(panel()).toBeNull()
  })

  it('shows the picture at full size', () => {
    mountLightbox()

    expect(query('img').getAttribute('src')).toBe('https://files.test/menu.png')
    expect(query('img').getAttribute('alt')).toBe('menu.png')
  })

  it('names the picture, both on screen and to a screen reader', () => {
    mountLightbox()

    expect(panel().textContent).toContain('menu.png')
    expect(panel().getAttribute('aria-labelledby')).toBe(query('p').id)
  })

  it('takes over the page while it is open, unlike the drawer it came from', () => {
    mountLightbox()
    expect(panel().getAttribute('aria-modal')).toBe('true')
  })

  it('asks to close from its button', async () => {
    const wrapper = mountLightbox()

    await query('button').click()

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('asks to close when the space around the picture is clicked', async () => {
    const wrapper = mountLightbox()

    panel().dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('stays open when the picture itself is clicked', async () => {
    const wrapper = mountLightbox()

    query('img').dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('asks to close on Escape', () => {
    const wrapper = mountLightbox()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('moves focus into itself, and gives it back when it closes', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const wrapper = mount(BaseLightbox, {
      props: { src: '', alt: 'menu.png' },
      attachTo: document.body,
    })
    await wrapper.setProps({ src: 'https://files.test/menu.png' })
    await vi.waitFor(() => expect(panel().contains(document.activeElement)).toBe(true))

    await wrapper.setProps({ src: '' })

    await vi.waitFor(() => expect(document.activeElement).toBe(opener))
  })
})
