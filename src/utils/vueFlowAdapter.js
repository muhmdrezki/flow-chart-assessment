import { getNodeTitle } from './nodeDescription'
import { getEdgeColourKind } from './nodeKind'

/**
 * Maps store nodes to Vue Flow nodes. Only `id`, `type`, `position` and `data` are passed:
 * Vue Flow merges these into its internal nodes, so passing internal keys (`selected`,
 * `dimensions`…) would reset them. Position is copied so Vue Flow never holds a reference to
 * store state.
 * @param {import('./graph').FlowNode[]} nodes
 */
export function toVueFlowNodes(nodes) {
  return nodes.map((node) => ({
    id: node.id,
    type: 'default',
    position: { ...node.position },
    data: { label: getNodeTitle(node) },
  }))
}

/**
 * @param {import('./graph').FlowEdge[]} edges
 * @param {Map<string, import('./graph').FlowNode>} nodeById
 */
export function toVueFlowEdges(edges, nodeById) {
  return edges.map((edge) => ({
    ...edge,
    class: `edge--${getEdgeColourKind(nodeById.get(edge.source))}`,
  }))
}
