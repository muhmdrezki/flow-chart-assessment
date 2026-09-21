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

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isValidId = (value) =>
  (typeof value === 'string' && value.trim() !== '') ||
  (typeof value === 'number' && Number.isFinite(value))

/** Checks one node against the fields the app relies on. Returns a problem or null. */
function findNodeError(node, index) {
  if (!isPlainObject(node)) return `node at index ${index} is not an object`
  if (!isValidId(node.id)) return `node at index ${index} has an invalid id`

  const label = `node "${node.id}"`
  if (typeof node.type !== 'string' || node.type === '') return `${label} has an invalid type`
  if (!isValidId(node.parentId)) return `${label} has an invalid parentId`
  if (node.name !== undefined && typeof node.name !== 'string') {
    return `${label} has an invalid name`
  }
  if (node.data !== undefined && !isPlainObject(node.data)) return `${label} has invalid data`
  if (node.data?.type !== undefined && typeof node.data.type !== 'string') {
    return `${label} has an invalid data.type`
  }
  return null
}

/**
 * Validates the payload before it's accepted, so bad data fails as a load error instead of
 * crashing later. Only checks what the app currently reads; type-specific fields (message
 * payloads, business hours…) are checked by the specs that start using them.
 * @param {unknown} raw
 * @returns {string|null} the first problem found, or null if the payload is valid
 */
export function findPayloadError(raw) {
  if (!Array.isArray(raw)) return 'expected an array of nodes'

  const seenIds = new Set()
  for (const [index, node] of raw.entries()) {
    const nodeError = findNodeError(node, index)
    if (nodeError) return nodeError

    // Ids are compared as strings, so 1 and "1" are the same node.
    const id = normalizeId(node.id)
    if (seenIds.has(id)) return `duplicate node id "${id}"`
    seenIds.add(id)
  }
  return null
}

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
