import { describe, expect, it, vi } from 'vitest'
import { isReactive, reactive } from 'vue'
import { NODE_REGISTRY } from '@/utils/nodeRegistry'
import ConnectorNode from './ConnectorNode/ConnectorNode.vue'
import NodeCard from './NodeCard/NodeCard.vue'
import { nodeTypes } from './nodeTypes'

vi.mock('@vue-flow/core', () => ({ Handle: {}, Position: { Top: 'top', Bottom: 'bottom' } }))

describe('nodeTypes', () => {
  it('has a component for every registered kind', () => {
    expect(Object.keys(nodeTypes).sort()).toEqual(Object.keys(NODE_REGISTRY).sort())
  })

  it('renders pills with ConnectorNode and everything else with NodeCard', () => {
    expect(nodeTypes).toEqual({
      trigger: NodeCard,
      sendMessage: NodeCard,
      addComment: NodeCard,
      businessHours: NodeCard,
      success: ConnectorNode,
      failure: ConnectorNode,
      unknown: NodeCard,
    })
  })

  it('is never made reactive, even when placed in reactive state', () => {
    expect(isReactive(reactive({ nodeTypes }).nodeTypes)).toBe(false)
  })
})
