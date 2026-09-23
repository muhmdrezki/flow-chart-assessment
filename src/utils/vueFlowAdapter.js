import { getEdgeColourKind, getNodeKind } from './nodeKind'
import { getNodeConfig } from './nodeRegistry'

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
 * The steps with nothing after them yet, which the mockup gives a "+" of their own — otherwise the
 * end of a branch is the one place on the canvas that can't be added to.
 *
 * Same rule as the "+" on a line, from the same place: a step can be added after anything that can
 * have children. A condition is left out, since its branches are made with it and nothing else may
 * come between.
 *
 * @param {import('./graph').FlowNode[]} nodes
 * @param {import('./graph').FlowEdge[]} edges
 * @returns {Set<string>} the ids to draw a "+" under
 */
export function getOpenEndIds(nodes, edges) {
  const hasChildren = new Set(edges.map((edge) => edge.source))

  return new Set(
    nodes
      .filter((node) => !hasChildren.has(node.id) && getNodeConfig(node).canHaveChildren)
      .map((node) => node.id),
  )
}

/**
 * Maps derived edges to Vue Flow edges. They all use our own edge component, which selects the
 * "edge-flow" slot in FlowCanvas and draws the "+" that adds a step at that point.
 *
 * `canInsert` is the source's own rule, straight from the registry: a step can be added after
 * anything that can have children. That is what keeps the "+" off the two lines under a condition,
 * where a Success or Failure branch has to stay attached to the condition it belongs to.
 *
 * @param {import('./graph').FlowEdge[]} edges
 * @param {Map<string, import('./graph').FlowNode>} nodeById
 * @param {Map<string, { title: string }>} displayById  names the step the "+" would add after
 */
export function toVueFlowEdges(edges, nodeById, displayById = new Map()) {
  return edges.map((edge) => {
    const source = nodeById.get(edge.source)
    return {
      ...edge,
      type: 'flow',
      class: `edge--${getEdgeColourKind(source)}`,
      data: {
        canInsert: Boolean(source) && getNodeConfig(source).canHaveChildren,
        sourceTitle: displayById.get(edge.source)?.title ?? '',
      },
    }
  })
}
