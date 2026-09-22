import { DEFAULT_TIMEZONE } from './businessHours'
import { NODE_KIND, getNodeKind, humanize } from './nodeKind'
import { NODE_REGISTRY, getNodeConfig } from './nodeRegistry'

/**
 * Makes text safe for a clamped single paragraph: "Hello there\n\nwelcome" → "Hello there welcome".
 * @param {unknown} text
 * @returns {string}
 */
export function collapseWhitespace(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
}

/**
 * The file name at the end of an attachment URL, e.g. ".../id/396/536/354.jpg?hmac=…" → "354.jpg".
 * Falls back to the raw value when there's no file name to take.
 * @param {string} url
 * @returns {string}
 */
export function getAttachmentName(url) {
  let path
  try {
    path = new URL(url).pathname
  } catch {
    path = String(url).split(/[?#]/)[0]
  }

  const segment = path.split('/').filter(Boolean).pop()
  if (!segment) return url
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * The node's name, or its kind's label. The payload's trigger has no name, so it reads "Trigger",
 * with its event as the description (as in the brief's mockup).
 * @param {{ name?: string, type?: string, data?: Record<string, any> }} node
 * @returns {string}
 */
export function getNodeTitle(node) {
  return node.name?.trim() || getNodeConfig(node).label
}

function describeMessage({ payload }) {
  const items = Array.isArray(payload) ? payload : []
  const text = items
    .filter((item) => item?.type === 'text')
    .map((item) => collapseWhitespace(item.text))
    .find(Boolean)
  if (text) return text

  const attachment = items.find((item) => item?.type === 'attachment' && item.attachment)
  if (attachment) return getAttachmentName(attachment.attachment)

  return 'No message content'
}

const DESCRIBERS = {
  [NODE_KIND.TRIGGER]: (data) => (data.type ? humanize(data.type) : ''),
  [NODE_KIND.SEND_MESSAGE]: describeMessage,
  [NODE_KIND.ADD_COMMENT]: (data) => collapseWhitespace(data.comment) || 'No comment',
  // As in the mockup ("Business Hours - UTC"); the hours themselves are shown in the drawer.
  [NODE_KIND.BUSINESS_HOURS]: (data) =>
    `${NODE_REGISTRY[NODE_KIND.BUSINESS_HOURS].label} - ${data.timezone || DEFAULT_TIMEZONE}`,
  [NODE_KIND.UNKNOWN]: () => 'Unsupported node',
}

/**
 * The card's description: what the user typed, otherwise a summary derived from the node's data.
 * Pills (success/failure) show only their label, so they have none.
 * @param {{ type?: string, data?: Record<string, any> }} node
 * @returns {string}
 */
export function getNodeDescription(node) {
  if (getNodeConfig(node).variant === 'pill') return ''

  const data = node.data ?? {}
  const custom = collapseWhitespace(data.description)
  if (custom) return custom

  return DESCRIBERS[getNodeKind(node)]?.(data) ?? ''
}
