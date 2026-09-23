export const DEFAULT_NODE_SIZE = Object.freeze({ width: 240, height: 96 })

/** Horizontal distance between neighbouring slot centres. Nodes created later reuse it. */
export const X_GAP = 280
/** Vertical space between a node's bottom and its children's top. */
export const Y_GAP = 64

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
  { xGap = X_GAP, yGap = Y_GAP, getNodeSize = () => DEFAULT_NODE_SIZE } = {},
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const order = new Map(nodes.map((node, index) => [node.id, index]))
  const children = new Map(nodes.map((node) => [node.id, []]))
  const hasParent = new Set()

  /*
   * First parent wins. A second edge into the same node is dropped rather than honoured, because
   * everything below assumes a tree: a node with two parents would be placed twice, and the second
   * placement would silently move it out from under the first. Dropping the edge keeps the picture
   * readable and wrong in one visible way, instead of correct-looking and wrong in several.
   */
  for (const { source, target } of edges) {
    if (!nodeById.has(source) || !nodeById.has(target) || hasParent.has(target)) continue
    children.get(source).push(target)
    hasParent.add(target)
  }
  // Siblings keep the payload's own order, so Success is always left of Failure — the layout is a
  // pure function of the data, and the same flow can't come out mirrored between two loads.
  for (const siblings of children.values()) {
    siblings.sort((a, b) => order.get(a) - order.get(b))
  }

  const positions = new Map()
  const visited = new Set()
  let nextSlot = 0

  /**
   * Places a subtree and returns the slot (horizontal centre) of its root.
   *
   * A "slot" is a column index, not a pixel. Only leaves claim one — `nextSlot++`, left to right in
   * the order they are reached — and every parent takes the midpoint of its first and last child.
   * That is the whole layout: the horizontal axis is decided by how many leaves a branch has, so a
   * condition sits centred over its two branches and widening one branch pushes the other aside
   * without any node needing to know about its siblings.
   *
   * Depth-first, and the recursion is what makes it work: a parent can't be placed until its
   * children are, because its position is derived from theirs.
   */
  function place(id, y) {
    visited.add(id)
    const size = getNodeSize(nodeById.get(id))
    // Rows are spaced by the height of the node above, so taller cards push their children down
    // rather than overlapping them — which is why a card's height lives in the registry.
    const childY = y + size.height + yGap

    const childSlots = []
    for (const childId of children.get(id)) {
      // `visited` is the cycle guard: a child that has already been placed is not descended into
      // again, so a → b → a lays out once instead of recursing until the stack gives out.
      if (!visited.has(childId)) childSlots.push(place(childId, childY))
    }

    const slot = childSlots.length
      ? (childSlots[0] + childSlots[childSlots.length - 1]) / 2
      : nextSlot++

    // Vue Flow positions a node by its top-left corner, so the slot's centre is shifted back by
    // half the node's width. Pills are narrower than cards and still line up with them.
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
