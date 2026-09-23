import { describe, expect, it } from 'vitest'
import { NODE_KIND } from './nodeKind'
import {
  CREATABLE_KINDS,
  NODE_REGISTRY,
  TRIGGER_EVENT_LABELS,
  getNodeConfig,
  getNodeSize,
  hasDetails,
} from './nodeRegistry'

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
      purpose: expect.any(String),
      deletable: expect.any(Boolean),
      hasDetails: expect.any(Boolean),
      hasInput: expect.any(Boolean),
      canHaveChildren: expect.any(Boolean),
      creatable: expect.any(Boolean),
      accent: expect.stringMatching(/^--color-kind-/),
      size: { width: expect.any(Number), height: expect.any(Number) },
    })
  })

  it('lets a step be deleted, but never the trigger or a branch pill', () => {
    const deletable = Object.entries(NODE_REGISTRY)
      .filter(([, config]) => config.deletable)
      .map(([kind]) => kind)

    // A flow has to start somewhere, and a branch belongs to the condition that made it.
    expect(deletable.sort()).toEqual(['addComment', 'businessHours', 'sendMessage'])
  })

  it('opens a drawer for everything except the display-only kinds', () => {
    const withDetails = Object.entries(NODE_REGISTRY)
      .filter(([, config]) => config.hasDetails)
      .map(([kind]) => kind)

    // Success and failure are "purely for display" per the brief; unknown has nothing to show.
    expect(withDetails.sort()).toEqual(['addComment', 'businessHours', 'sendMessage', 'trigger'])
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

  it('lets every kind have children except business hours, which branches instead', () => {
    const withoutChildren = Object.entries(NODE_REGISTRY)
      .filter(([, config]) => !config.canHaveChildren)
      .map(([kind]) => kind)
    expect(withoutChildren).toEqual(['businessHours'])
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

describe('hasDetails', () => {
  it.each([
    ['trigger', true],
    ['sendMessage', true],
    ['addComment', true],
    ['businessHours', true],
    ['success', false],
    ['failure', false],
    ['unknown', false],
  ])('%s → %s', (kind, expected) => {
    expect(hasDetails(nodes[kind])).toBe(expected)
  })
})

describe('TRIGGER_EVENT_LABELS', () => {
  it('labels the payload trigger event', () => {
    expect(TRIGGER_EVENT_LABELS.conversationOpened).toBe('Conversation Opened')
  })

  it('cannot be modified', () => {
    expect(Object.isFrozen(TRIGGER_EVENT_LABELS)).toBe(true)
  })
})

describe('CREATABLE_KINDS', () => {
  it('is built from the creatable flag, not from editability', () => {
    const flagged = Object.entries(NODE_REGISTRY)
      .filter(([, config]) => config.creatable)
      .map(([kind]) => kind)
    expect([...CREATABLE_KINDS]).toEqual(flagged)
  })

  it('lists exactly the three types the create form offers', () => {
    expect([...CREATABLE_KINDS].sort()).toEqual(['addComment', 'businessHours', 'sendMessage'])
  })
})
