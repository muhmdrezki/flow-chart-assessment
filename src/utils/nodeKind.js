/**
 * UI kinds. The payload's `type` alone isn't enough to tell nodes apart (business hours is a
 * `dateTime` node, success/failure are `dateTimeConnector` nodes), so the kind is derived from
 * `type` + `data` and never stored.
 */
export const NODE_KIND = Object.freeze({
  TRIGGER: 'trigger',
  SEND_MESSAGE: 'sendMessage',
  ADD_COMMENT: 'addComment',
  BUSINESS_HOURS: 'businessHours',
  SUCCESS: 'success',
  FAILURE: 'failure',
  UNKNOWN: 'unknown',
})

const CONNECTOR_KINDS = {
  success: NODE_KIND.SUCCESS,
  failure: NODE_KIND.FAILURE,
}

/**
 * The one place the payload's shape is read. Two of the five kinds need a second field to identify
 * them, and that discriminator is exactly the sort of knowledge that spreads through a codebase if
 * it isn't fenced in: `data.action === 'businessHours'` appearing in three components is three
 * places to update when a sixth kind arrives.
 *
 * Anything unrecognised is `UNKNOWN` rather than an error. A flow is a document, and a document
 * from a newer version of the product should still be readable — the canvas draws a plain card with
 * a question mark and refuses to edit it, which is friendlier than a blank screen and safer than
 * guessing.
 *
 * @param {{ type?: string, data?: Record<string, any> } | undefined} node
 * @returns {string} one of NODE_KIND
 */
export function getNodeKind(node) {
  switch (node?.type) {
    case 'trigger':
      return NODE_KIND.TRIGGER
    case 'sendMessage':
      return NODE_KIND.SEND_MESSAGE
    case 'addComment':
      return NODE_KIND.ADD_COMMENT
    case 'dateTime':
      return node.data?.action === 'businessHours' ? NODE_KIND.BUSINESS_HOURS : NODE_KIND.UNKNOWN
    case 'dateTimeConnector':
      return CONNECTOR_KINDS[node.data?.connectorType] ?? NODE_KIND.UNKNOWN
    default:
      return NODE_KIND.UNKNOWN
  }
}

/**
 * Edges take their source node's accent colour. Success/failure connectors belong to the
 * business-hours branch, so their outgoing edges use its colour.
 * @param {{ type?: string, data?: Record<string, any> } | undefined} sourceNode
 * @returns {string}
 */
export function getEdgeColourKind(sourceNode) {
  const kind = getNodeKind(sourceNode)
  if (kind === NODE_KIND.SUCCESS || kind === NODE_KIND.FAILURE) return NODE_KIND.BUSINESS_HOURS
  if (kind === NODE_KIND.UNKNOWN) return 'neutral'
  return kind
}
