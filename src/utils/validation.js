import { isUploaded } from './attachments'
import { DAY_LABELS, isTimeString } from './businessHours'
import { NODE_KIND } from './nodeKind'
import { CREATABLE_KINDS, getNodeConfig } from './nodeRegistry'

export const TITLE_MAX_LENGTH = 60
export const DESCRIPTION_MAX_LENGTH = 200
/** Roomier than a description: a comment is the note a colleague reads on the conversation. */
export const COMMENT_MAX_LENGTH = 1000

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '')

/**
 * Each validator returns a message when the value is wrong, or null when it's fine, so they can be
 * chained with `??` and collected into one errors object.
 */

/** @returns {string|null} */
export function required(value, label) {
  return trimmed(value) ? null : `${label} is required`
}

/** @returns {string|null} */
export function maxLength(value, limit, label) {
  return trimmed(value).length > limit ? `${label} must be ${limit} characters or fewer` : null
}

/** @returns {string|null} */
export function oneOf(value, allowed, message) {
  return allowed.includes(value) ? null : message
}

/**
 * A link the browser can actually open. `new URL` accepts things like "mailto:", which an
 * attachment never is, so the scheme is checked too.
 * @returns {string|null}
 */
export function webUrl(value, label) {
  try {
    const { protocol } = new URL(trimmed(value))
    return protocol === 'http:' || protocol === 'https:' ? null : `${label} must be a web link`
  } catch {
    return `${label} must be a web link`
  }
}

/**
 * Where an attachment can come from: a link, or a file the user uploaded, which is carried as a
 * `data:` URL because the payload stores attachments as URLs and nothing else.
 * @returns {string|null}
 */
export function attachmentSource(value, label) {
  return isUploaded(value) ? null : webUrl(value, label)
}

/**
 * The nodes a new node can be added after. Business hours is excluded: what follows it is always
 * its success and failure branches, so a step is added after one of those instead.
 * @param {import('./graph').FlowNode[]} nodes
 * @returns {import('./graph').FlowNode[]}
 */
export function getAllowedParents(nodes) {
  return nodes.filter((node) => getNodeConfig(node).canHaveChildren)
}

/**
 * Checks the create-node form. Returns a message per invalid field, so an empty object means valid.
 * The simulated API runs this too, so bad input is rejected even if it didn't come from the form.
 * @param {{ title?: string, description?: string, type?: string, parentId?: string }} values
 * @param {{ allowedParentIds: string[] }} context
 * @returns {Record<string, string>}
 */
export function validateCreateNode(values, { allowedParentIds = [] } = {}) {
  const errors = {
    title: required(values.title, 'Title') ?? maxLength(values.title, TITLE_MAX_LENGTH, 'Title'),
    description:
      required(values.description, 'Description') ??
      maxLength(values.description, DESCRIPTION_MAX_LENGTH, 'Description'),
    type: oneOf(values.type, CREATABLE_KINDS, 'Choose a node type'),
    parentId: oneOf(values.parentId, allowedParentIds, 'Choose where to add the node'),
  }

  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== null))
}

/** One message per invalid message part, keyed "parts.<index>" so the form can place them. */
function validateParts(parts = []) {
  if (!parts.length) return { parts: 'Add a message or an attachment' }

  const errors = {}
  parts.forEach((part, index) => {
    const message =
      part.type === 'attachment'
        ? (required(part.attachment, 'An attachment') ??
          attachmentSource(part.attachment, 'An attachment'))
        : required(part.text, 'Message text')
    if (message) errors[`parts.${index}`] = message
  })
  return errors
}

/**
 * One message per invalid day, keyed "times.<day>". Times are wall-clock strings in the node's own
 * timezone, so once both are known to be HH:mm they compare directly: "09:00" < "17:00". No dates
 * and no timezone maths are involved, which is the point of storing them this way.
 */
function validateDays(days = []) {
  const errors = {}
  const open = days.filter((day) => day.isOpen)
  if (!open.length) return { days: 'Open at least one day' }

  for (const { day, startTime, endTime } of open) {
    if (!isTimeString(startTime) || !isTimeString(endTime)) {
      errors[`times.${day}`] = `${DAY_LABELS[day]} needs a start and an end time`
    } else if (endTime <= startTime) {
      errors[`times.${day}`] = `${DAY_LABELS[day]} must end after it starts`
    }
  }
  return errors
}

const DRAFT_RULES = {
  // A comment can be cleared: emptying one is how you take a note back off a step, and the canvas
  // already says "No comment" for a step that hasn't got one.
  [NODE_KIND.ADD_COMMENT]: (draft) => ({
    comment: maxLength(draft.comment, COMMENT_MAX_LENGTH, 'Comment'),
  }),
  [NODE_KIND.SEND_MESSAGE]: (draft) => validateParts(draft.parts),
  [NODE_KIND.BUSINESS_HOURS]: (draft) => ({
    timezone: required(draft.timezone, 'Time zone'),
    ...validateDays(draft.days),
  }),
}

/**
 * Checks an edited node. Returns a message per invalid field, so an empty object means valid.
 * The simulated API runs this too, so bad input is rejected even if it didn't come from the form.
 *
 * Description is optional here, unlike on the create form: none of the payload's own nodes has one,
 * and requiring it would block a save the user never meant to make.
 *
 * @param {import('./nodeEdit').Draft} draft
 * @param {string} kind  one of NODE_KIND
 * @returns {Record<string, string>}
 */
export function validateNodeDraft(draft, kind) {
  const errors = {
    title: required(draft.title, 'Title') ?? maxLength(draft.title, TITLE_MAX_LENGTH, 'Title'),
    description: maxLength(draft.description, DESCRIPTION_MAX_LENGTH, 'Description'),
    ...DRAFT_RULES[kind]?.(draft),
  }

  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== null))
}
