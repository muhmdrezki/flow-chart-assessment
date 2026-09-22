import { isRootParent, normalizeId } from './ids'

/**
 * A node as it appears in payload.json.
 * @typedef {Object} RawNode
 * @property {string|number} id
 * @property {string|number} parentId  -1 for the root
 * @property {string} type
 * @property {string} [name]
 * @property {Record<string, any>} data
 */

/**
 * A node as the store holds it: the payload shape with ids normalised, plus a position.
 * @typedef {Object} FlowNode
 * @property {string} id
 * @property {string|null} parentId  null for the root
 * @property {string} type
 * @property {string} [name]
 * @property {Record<string, any>} data
 * @property {{ x: number, y: number }} [position]
 */

/**
 * @typedef {Object} FlowEdge
 * @property {string} id
 * @property {string} source
 * @property {string} target
 */

/**
 * Converts the payload into store nodes. `data` is deep-cloned so the store never shares
 * objects with the Vue Query cache.
 * @param {RawNode[]} raw
 * @returns {FlowNode[]}
 */
export function normalizePayload(raw) {
  return raw.map((node) => ({
    id: normalizeId(node.id),
    parentId: isRootParent(node.parentId) ? null : normalizeId(node.parentId),
    type: node.type,
    ...(node.name !== undefined && { name: node.name }),
    data: structuredClone(node.data ?? {}),
  }))
}

/**
 * Edges are derived from `parentId`, so they can never point at a node that no longer exists.
 * @param {FlowNode[]} nodes
 * @returns {FlowEdge[]}
 */
export function deriveEdges(nodes) {
  const ids = new Set(nodes.map((node) => node.id))

  return nodes
    .filter(({ id, parentId }) => parentId !== null && parentId !== id && ids.has(parentId))
    .map(({ id, parentId }) => ({ id: `e-${parentId}-${id}`, source: parentId, target: id }))
}
