import { describe, expect, it } from 'vitest'
import { NODE_KIND } from './nodeKind'
import { NODE_REGISTRY, getNodeConfig, getNodeSize, isEditable } from './nodeRegistry'

const nodes = {
  trigger: { type: 'trigger', data: { type: 'conversationOpened' } },
  sendMessage: { type: 'sendMessage', data: {} },
  addComment: { type: 'addComment', data: {} },
  businessHours: { type: 'dateTime', data: { action: 'businessHours' } },
  success: { type: 'dateTimeConnector', data: { connectorType: 'success' } },
  failure: { type: 'dateTimeConnector', data: { connectorType: 'failure' } },
  unknown: { type: 'webhook', data: {} },
}

describe('NODE_REGISTRY', () => {
  it('has an entry for every kind', () => {
    expect(Object.keys(NODE_REGISTRY).sort()).toEqual(Object.values(NODE_KIND).sort())
  })

  it.each(Object.entries(NODE_REGISTRY))('describes %s completely', (_, config) => {
    expect(config).toEqual({
      label: expect.any(String),
      icon: expect.any(String),
      variant: expect.stringMatching(/^(card|pill)$/),
      editable: expect.any(Boolean),
      hasInput: expect.any(Boolean),
      accent: expect.stringMatching(/^--color-kind-/),
      size: { width: expect.any(Number), height: expect.any(Number) },
    })
  })

  it('makes only the three editable types editable', () => {
    const editable = Object.entries(NODE_REGISTRY)
      .filter(([, config]) => config.editable)
      .map(([kind]) => kind)
    expect(editable.sort()).toEqual(['addComment', 'businessHours', 'sendMessage'])
  })

  it('draws success and failure as pills and everything else as cards', () => {
    const pills = Object.entries(NODE_REGISTRY)
      .filter(([, config]) => config.variant === 'pill')
      .map(([kind]) => kind)
    expect(pills.sort()).toEqual(['failure', 'success'])
  })

  it('gives every kind an input handle except the trigger, where a flow starts', () => {
    const withoutInput = Object.entries(NODE_REGISTRY)
      .filter(([, config]) => !config.hasInput)
      .map(([kind]) => kind)
    expect(withoutInput).toEqual(['trigger'])
  })

  it('makes pills shorter than cards', () => {
    expect(NODE_REGISTRY.success.size.height).toBeLessThan(NODE_REGISTRY.trigger.size.height)
  })

  it('cannot be modified', () => {
    expect(Object.isFrozen(NODE_REGISTRY)).toBe(true)
  })
})

describe('getNodeConfig', () => {
  it.each(Object.entries(nodes))('returns the %s entry', (kind, node) => {
    expect(getNodeConfig(node)).toBe(NODE_REGISTRY[kind])
  })

  it('falls back to the unknown entry for a missing node', () => {
    expect(getNodeConfig(undefined)).toBe(NODE_REGISTRY.unknown)
  })
})

describe('getNodeSize', () => {
  it('returns the kind’s size', () => {
    expect(getNodeSize(nodes.sendMessage)).toEqual({ width: 240, height: 88 })
    expect(getNodeSize(nodes.failure)).toEqual({ width: 96, height: 28 })
  })
})

describe('isEditable', () => {
  it.each([
    ['trigger', false],
    ['sendMessage', true],
    ['addComment', true],
    ['businessHours', true],
    ['success', false],
    ['failure', false],
    ['unknown', false],
  ])('%s → %s', (kind, editable) => {
    expect(isEditable(nodes[kind])).toBe(editable)
  })
})
