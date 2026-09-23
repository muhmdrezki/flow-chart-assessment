import { getNodeConfig } from './nodeRegistry'
import { collectSubtreeIds } from './placement'

/**
 * What deleting a node takes with it, and where that leaves everything else.
 *
 * @typedef {{
 *   removeIds: string[],
 *   reparent: { id: string, parentId: string|null }[],
 *   shift: { ids: string[], dy: number } | null,
 * }} Removal
 */

/**
 * Deleting a plain step closes the chain: whatever came after it hangs from its parent instead, and
 * moves up into the space it left, so the flow has no hole in it.
 *
 * A condition can't do that. Its success and failure branches can't both become the parent's next
 * step, and there is no sense in choosing one, so it takes everything below it with it. The drawer
 * says so, and how much, before anything happens.
 *
 * Nothing here re-runs the layout: the rest of the canvas keeps the positions it had, including
 * ones the user dragged.
 *
 * @param {import('./graph').FlowNode[]} nodes
 * @param {string} id
 * @returns {Removal|null} null when that node can't be deleted (the trigger, a branch pill, or an
 *   id that isn't in the flow)
 */
export function getRemoval(nodes, id) {
  const node = nodes.find((candidate) => candidate.id === id)
  if (!node) return null

  const config = getNodeConfig(node)
  if (!config.deletable) return null

  // `canHaveChildren` is false only for a condition, because what follows it is its own branches.
  if (!config.canHaveChildren) {
    return { removeIds: [...collectSubtreeIds(nodes, [id])], reparent: [], shift: null }
  }

  const children = nodes.filter((candidate) => candidate.parentId === id)
  if (!children.length) return { removeIds: [id], reparent: [], shift: null }

  const highestChild = Math.min(...children.map((child) => child.position.y))

  return {
    removeIds: [id],
    reparent: children.map((child) => ({ id: child.id, parentId: node.parentId })),
    // Negative: the children and everything under them move up into the deleted node's row.
    shift: { ids: children.map((child) => child.id), dy: node.position.y - highestChild },
  }
}

/**
 * How many nodes go, for the confirmation. Branch pills are counted apart from real steps: "and
 * both its branches" reads as what it is, where "and 5 steps" would count two labels as work.
 * @param {import('./graph').FlowNode[]} nodes
 * @param {Removal} removal
 * @returns {{ steps: number, branches: number }}
 */
export function countRemoved(nodes, removal) {
  const removed = nodes.filter((node) => removal.removeIds.includes(node.id))
  const branches = removed.filter((node) => getNodeConfig(node).variant === 'pill').length

  // The node the user asked about isn't part of the count: the confirmation names it already.
  return { steps: removed.length - branches - 1, branches }
}
