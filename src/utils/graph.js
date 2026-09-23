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
 *
 * This is the one place ids are normalised, and it matters: the payload mixes types — the trigger's
 * id is the number `1` while every other id is a hex string — so `node.parentId === node.id` would
 * be false for a pair that really do match. Normalising here means nothing downstream has to
 * remember, and `-1` (the payload's "no parent") becomes `null`, which is what "no parent" means
 * everywhere else in the app.
 *
 * The clone is not defensive tidiness: the store later hands its nodes to `structuredClone`, and
 * Vue Query's cached objects are reactive Proxies, which `structuredClone` refuses to copy.
 *
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
 *
 * The payload ships no edges, and we deliberately never store any. A node's one `parentId` already
 * says where its line comes from, so the edge list is a pure function of the nodes — which means
 * deleting a node cannot strand an edge, and no code path can forget to keep the two in step. The
 * whole class of "dangling edge" bugs is designed out rather than guarded against.
 *
 * The cost is that a node can have only one parent. Spec 01 took that as the payload's own shape
 * rather than a limitation to work around; converging branches would mean storing edges, and then
 * this function and `computeLayout` are the two places that would change.
 *
 * A branch pill (`dateTimeConnector`) needs no special case: the payload gives it the condition as
 * its `parentId` and the step after it names the pill as *its* parent, so the chain
 * condition → Success → step falls out of the same rule as everything else.
 *
 * The two filters are for input we don't control: a `parentId` pointing at a deleted or unknown
 * node, and a node claiming itself as its parent, which would draw a line from a node to itself.
 *
 * @param {FlowNode[]} nodes
 * @returns {FlowEdge[]}
 */
export function deriveEdges(nodes) {
  const ids = new Set(nodes.map((node) => node.id))

  // The edge id is built from both ends, so it is stable across reloads and unique without a
  // counter — which matters because Vue Flow keys its rendering on it.
  return nodes
    .filter(({ id, parentId }) => parentId !== null && parentId !== id && ids.has(parentId))
    .map(({ id, parentId }) => ({ id: `e-${parentId}-${id}`, source: parentId, target: id }))
}
