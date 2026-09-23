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

/** A summary with no label: the text stands on its own. */
const plain = (text) => ({ label: '', text })

/** The first thing the message actually sends, which is what the mockup puts on the card. */
function describeMessage({ payload }) {
  const items = Array.isArray(payload) ? payload : []
  const text = items
    .filter((item) => item?.type === 'text')
    .map((item) => trimText(item.text))
    .find(Boolean)
  if (text) return { label: 'Message', text }

  const attachment = items.find((item) => item?.type === 'attachment' && item.attachment)
  if (attachment) return { label: 'Message', text: getAttachmentName(attachment.attachment) }

  return { label: 'Message', text: 'No content' }
}

const DESCRIBERS = {
  [NODE_KIND.TRIGGER]: ({ type }) => {
    if (!type) return plain('')
    // hasOwn, so an event named e.g. "toString" doesn't pick up Object.prototype's function.
    return plain(Object.hasOwn(TRIGGER_EVENT_LABELS, type) ? TRIGGER_EVENT_LABELS[type] : type)
  },
  [NODE_KIND.SEND_MESSAGE]: describeMessage,
  [NODE_KIND.ADD_COMMENT]: (data) => plain(trimText(data.comment) || 'No comment'),
  // As in the mockup ("Business Hours - UTC"); the hours themselves are shown in the drawer.
  [NODE_KIND.BUSINESS_HOURS]: (data) =>
    plain(
      `${NODE_REGISTRY[NODE_KIND.BUSINESS_HOURS].label} - ${data.timezone || DEFAULT_TIMEZONE}`,
    ),
  [NODE_KIND.UNKNOWN]: () => plain('Unsupported node'),
}

/**
 * What a card says under its title, in two parts, because they answer different questions.
 *
 * `description` is what the user wrote about this step — why it's here. `summary` is what the step
 * actually holds, derived from the payload: the message, the comment, the event, the time zone.
 * The card shows both when there are both, so writing a description no longer hides the message.
 *
 * The message is labelled, as the mockup labels it, and the two parts are kept separate so the card
 * can set the message itself in italic without the label going with it.
 *
 * Pills (success/failure) show only their label, so they have neither.
 *
 * @typedef {{ description: string, summary: { label: string, text: string } }} NodeDisplayText
 * @param {{ type?: string, data?: Record<string, any> }} node
 * @returns {NodeDisplayText}
 */
export function getNodeText(node) {
  if (getNodeConfig(node).variant === 'pill') {
    return { description: '', summary: { label: '', text: '' } }
  }

  const data = node.data ?? {}
  return {
    description: trimText(data.description),
    summary: DESCRIBERS[getNodeKind(node)]?.(data) ?? { label: '', text: '' },
  }
}
