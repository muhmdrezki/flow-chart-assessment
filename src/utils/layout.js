export const DEFAULT_NODE_SIZE = Object.freeze({ width: 240, height: 96 })

/**
 * Top-down tree layout. The payload allows one parent per node, so a flow is a tree: each leaf
 * takes one horizontal slot and every parent is centred over its children.
 *
 * It takes edges rather than reading `parentId`, so only this function and `deriveEdges` would
 * change if converging branches were ever allowed.
 *
 * Invalid input doesn't break it: nodes whose parent is missing become extra roots, and nodes
 * caught in a cycle are laid out once the regular roots are done.
 *
 * @param {{ id: string }[]} nodes
 * @param {{ source: string, target: string }[]} edges
 * @param {Object} [options]
 * @param {number} [options.xGap]  horizontal distance between neighbouring slot centres
 * @param {number} [options.yGap]  vertical space between a parent's bottom and its children
 * @param {(node: object) => { width: number, height: number }} [options.getNodeSize]
 * @returns {Map<string, { x: number, y: number }>} top-left positions, as Vue Flow expects
 */
export function computeLayout(
  nodes,
  edges,
  { xGap = 280, yGap = 64, getNodeSize = () => DEFAULT_NODE_SIZE } = {},
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const order = new Map(nodes.map((node, index) => [node.id, index]))
  const children = new Map(nodes.map((node) => [node.id, []]))
  const hasParent = new Set()

  for (const { source, target } of edges) {
    if (!nodeById.has(source) || !nodeById.has(target) || hasParent.has(target)) continue
    children.get(source).push(target)
    hasParent.add(target)
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => order.get(a) - order.get(b))
  }

  const positions = new Map()
  const visited = new Set()
  let nextSlot = 0

  /** Places a subtree and returns the slot (horizontal centre) of its root. */
  function place(id, y) {
    visited.add(id)
    const size = getNodeSize(nodeById.get(id))
    const childY = y + size.height + yGap

    const childSlots = []
    for (const childId of children.get(id)) {
      if (!visited.has(childId)) childSlots.push(place(childId, childY))
    }

    const slot = childSlots.length
      ? (childSlots[0] + childSlots[childSlots.length - 1]) / 2
      : nextSlot++

    positions.set(id, { x: slot * xGap - size.width / 2, y })
    return slot
  }

  for (const node of nodes) {
    if (!hasParent.has(node.id)) place(node.id, 0)
  }
  // Anything left is part of a cycle (every node has a parent, so none was a root).
  for (const node of nodes) {
    if (!visited.has(node.id)) place(node.id, 0)
  }

  return positions
}
