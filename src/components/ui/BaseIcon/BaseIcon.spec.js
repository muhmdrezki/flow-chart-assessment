import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseIcon from './BaseIcon.vue'

const NAMES = [
  'calendar-clock',
  'check',
  'circle-help',
  'circle-plus',
  'message-square',
  'plus',
  'send',
  'x',
  'zap',
]

describe('BaseIcon', () => {
  it.each(NAMES)('renders the %s icon as an svg', (name) => {
    const svg = mount(BaseIcon, { props: { name } }).find('svg')
    expect(svg.exists()).toBe(true)
  })

  it('renders different icons for different names', () => {
    const markup = (name) => mount(BaseIcon, { props: { name } }).html()
    expect(markup('zap')).not.toBe(markup('send'))
  })

  it('defaults to 16px', () => {
    const svg = mount(BaseIcon, { props: { name: 'zap' } }).find('svg')
    expect(svg.attributes('width')).toBe('16')
    expect(svg.attributes('height')).toBe('16')
  })

  it('applies a custom size', () => {
    const svg = mount(BaseIcon, { props: { name: 'zap', size: 12 } }).find('svg')
    expect(svg.attributes('width')).toBe('12')
  })

  it('is hidden from screen readers without a label', () => {
    const svg = mount(BaseIcon, { props: { name: 'zap' } }).find('svg')

    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('role')).toBeUndefined()
    expect(svg.attributes('aria-label')).toBeUndefined()
  })

  it('is announced as an image with a label', () => {
    const svg = mount(BaseIcon, { props: { name: 'zap', label: 'Trigger' } }).find('svg')

    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBe('Trigger')
    expect(svg.attributes('aria-hidden')).toBeUndefined()
  })

  it('never takes keyboard focus', () => {
    expect(
      mount(BaseIcon, { props: { name: 'zap' } })
        .find('svg')
        .attributes('focusable'),
    ).toBe('false')
  })

  it('only accepts known icon names', () => {
    const { validator } = BaseIcon.props.name
    expect(NAMES.every(validator)).toBe(true)
    expect(validator('rocket')).toBe(false)
  })
})
