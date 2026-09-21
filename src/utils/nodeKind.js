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

/** 'conversationOpened' → 'Conversation Opened' */
function humanize(identifier) {
  return identifier
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (first) => first.toUpperCase())
}

/**
 * Display title. The trigger has no `name` in the payload, so it falls back to its event type.
 * @param {{ name?: string, type?: string, data?: Record<string, any> }} node
 * @returns {string}
 */
export function getNodeTitle(node) {
  const name = node.name?.trim()
  if (name) return name

  const kind = getNodeKind(node)
  if (kind === NODE_KIND.TRIGGER && node.data?.type) return humanize(node.data.type)
  return humanize(kind)
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
