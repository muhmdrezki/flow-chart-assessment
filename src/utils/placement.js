import { Y_GAP } from './layout'
import { getNodeSize } from './nodeRegistry'

const centreX = (node) => node.position.x + getNodeSize(node).width / 2
const bottomY = (node) => node.position.y + getNodeSize(node).height

/**
 * A position one row below `parent`, centred on it. Used for a newly created node, so the flow
 * isn't re-laid out and the user's own drags are kept.
 * @returns {{ x: number, y: number }}
 */
export function positionBelow(parent, node) {
  return {
    x: centreX(parent) - getNodeSize(node).width / 2,
    y: bottomY(parent) + Y_GAP,
  }
}

/**
 * How far the steps that used to follow `parent` have to move once a node is inserted between
 * them: the distance from the parent's bottom to the new continuation's bottom (vertically), and
 * between their centres (horizontally, for a branch that sits to one side).
 *
 * It's a distance, not a target position, so a branch the user dragged keeps its own offset and
 * can only ever move **down**, never back up.
 *
 * @param {import('./graph').FlowNode} parent  the step the node was added after
 * @param {import('./graph').FlowNode} continuation  the node the followers now hang from
 * @returns {{ dx: number, dy: number }}
 */
export function getInsertShift(parent, continuation) {
  return {
    dx: centreX(continuation) - centreX(parent),
    dy: bottomY(continuation) - bottomY(parent),
  }
}

/**
 * New positions for `rootIds` and everything below them, moved by `{ dx, dy }`.
 * Pure: it returns a map and never touches the nodes it's given.
 * @param {import('./graph').FlowNode[]} nodes
 * @param {string[]} rootIds
 * @param {{ dx?: number, dy?: number }} shift
 * @returns {Map<string, { x: number, y: number }>}
 */
export function shiftSubtree(nodes, rootIds, { dx = 0, dy = 0 }) {
  const moved = collectSubtreeIds(nodes, rootIds)

  return new Map(
    nodes
      .filter((node) => moved.has(node.id))
      .map((node) => [node.id, { x: node.position.x + dx, y: node.position.y + dy }]),
  )
}

/**
 * The ids of the given nodes and everything below them, so a whole branch can be moved together.
 * A visited set keeps invalid data (a cycle) from looping forever.
 * @param {import('./graph').FlowNode[]} nodes
 * @param {string[]} rootIds
 * @returns {Set<string>}
 */
export function collectSubtreeIds(nodes, rootIds) {
  const childrenByParent = new Map()
  for (const node of nodes) {
    if (node.parentId === null) continue
    const siblings = childrenByParent.get(node.parentId)
    if (siblings) siblings.push(node.id)
    else childrenByParent.set(node.parentId, [node.id])
  }

  const collected = new Set()
  const queue = [...rootIds]
  while (queue.length) {
    const id = queue.pop()
    if (collected.has(id)) continue
    collected.add(id)
    queue.push(...(childrenByParent.get(id) ?? []))
  }
  return collected
}
