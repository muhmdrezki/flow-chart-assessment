import { DEFAULT_TIMEZONE } from './businessHours'
import { NODE_KIND, getNodeKind } from './nodeKind'
import { NODE_REGISTRY, TRIGGER_EVENT_LABELS, getNodeConfig } from './nodeRegistry'

// Lets `URL` parse relative attachment paths ("uploads/a.png") as well as absolute URLs.
const URL_BASE = 'https://attachment.invalid'

/**
 * Trimmed text, or '' for anything that isn't a string. Blank text therefore counts as missing.
 * Line breaks and repeated spaces are left in: HTML collapses them when rendering, and the hover
 * tooltip keeps them.
 * @param {unknown} value
 * @returns {string}
 */
export function trimText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The file name at the end of an attachment URL, e.g. ".../id/396/536/354.jpg?hmac=…" → "354.jpg".
 * `URL` strips the query and hash. Falls back to the raw value when there's no file name to take.
 * @param {string} url
 * @returns {string}
 */
export function getAttachmentName(url) {
  let pathname
  try {
    pathname = new URL(url, URL_BASE).pathname
  } catch {
    return url
  }

  const segment = pathname.split('/').filter(Boolean).pop()
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
    .map((item) => trimText(item.text))
    .find(Boolean)
  if (text) return text

  const attachment = items.find((item) => item?.type === 'attachment' && item.attachment)
  if (attachment) return getAttachmentName(attachment.attachment)

  return 'No message content'
}

const DESCRIBERS = {
  [NODE_KIND.TRIGGER]: ({ type }) => {
    if (!type) return ''
    // hasOwn, so an event named e.g. "toString" doesn't pick up Object.prototype's function.
    return Object.hasOwn(TRIGGER_EVENT_LABELS, type) ? TRIGGER_EVENT_LABELS[type] : type
  },
  [NODE_KIND.SEND_MESSAGE]: describeMessage,
  [NODE_KIND.ADD_COMMENT]: (data) => trimText(data.comment) || 'No comment',
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
  const custom = trimText(data.description)
  if (custom) return custom

  return DESCRIBERS[getNodeKind(node)]?.(data) ?? ''
}
