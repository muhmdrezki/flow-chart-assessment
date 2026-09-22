import { markRaw } from 'vue'
import { NODE_REGISTRY } from '@/utils/nodeRegistry'
import ConnectorNode from './ConnectorNode/ConnectorNode.vue'
import NodeCard from './NodeCard/NodeCard.vue'

const COMPONENT_BY_VARIANT = { card: NodeCard, pill: ConnectorNode }

/**
 * Vue Flow's `nodeTypes`: node kind → component, derived from the registry so a new kind only
 * needs a registry entry. markRaw keeps Vue from making component definitions reactive.
 */
export const nodeTypes = markRaw(
  Object.fromEntries(
    Object.entries(NODE_REGISTRY).map(([kind, config]) => [
      kind,
      COMPONENT_BY_VARIANT[config.variant],
    ]),
  ),
)
