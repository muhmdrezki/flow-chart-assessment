import { getEdgeColourKind, getNodeKind } from './nodeKind'

/**
 * Maps store nodes to Vue Flow nodes. Only `id`, `type`, `position` and `data` are passed:
 * Vue Flow merges these into its internal nodes, so passing internal keys (`selected`,
 * `dimensions`…) would reset them. Position is copied so Vue Flow never holds a reference to
 * store state.
 *
 * `type` is the node kind, which selects the "node-<type>" slot in FlowCanvas. `data` is the node's
 * display object, reused as-is, so it keeps its identity across drags.
 * @param {import('./graph').FlowNode[]} nodes
 * @param {Map<string, { title: string, description: string }>} displayById
 */
export function toVueFlowNodes(nodes, displayById) {
  return nodes.map((node) => ({
    id: node.id,
    type: getNodeKind(node),
    position: { ...node.position },
    data: displayById.get(node.id),
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
