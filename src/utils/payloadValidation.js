import { WEEK_DAYS, isTimeString } from './businessHours'
import { normalizeId } from './ids'

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isValidId = (value) =>
  (typeof value === 'string' && value.trim() !== '') ||
  (typeof value === 'number' && Number.isFinite(value))

const isOptionalString = (value) => value === undefined || typeof value === 'string'

/** `data.payload` of a sendMessage node: text and attachment items. */
function findMessagePayloadError(payload) {
  if (payload === undefined) return null
  if (!Array.isArray(payload)) return 'invalid data.payload'

  for (const [index, item] of payload.entries()) {
    const path = `data.payload[${index}]`
    if (!isPlainObject(item)) return `invalid ${path}`
    if (item.type === 'text') {
      if (typeof item.text !== 'string') return `invalid ${path}.text`
    } else if (item.type === 'attachment') {
      if (typeof item.attachment !== 'string') return `invalid ${path}.attachment`
    } else {
      return `unknown ${path}.type`
    }
  }
  return null
}

/** `data.times` / `data.timezone` of a business-hours node. */
function findBusinessHoursError({ times, timezone }) {
  if (!isOptionalString(timezone)) return 'invalid data.timezone'
  if (times === undefined) return null
  if (!Array.isArray(times)) return 'invalid data.times'

  for (const [index, time] of times.entries()) {
    const path = `data.times[${index}]`
    if (!isPlainObject(time)) return `invalid ${path}`
    if (!WEEK_DAYS.includes(time.day)) return `invalid ${path}.day`
    if (!isTimeString(time.startTime)) return `invalid ${path}.startTime`
    if (!isTimeString(time.endTime)) return `invalid ${path}.endTime`
  }
  return null
}

/** Type-specific rules, for the fields the app reads. Returns a problem or null. */
const DATA_RULES = {
  sendMessage: (data) => findMessagePayloadError(data.payload),
  addComment: (data) => (isOptionalString(data.comment) ? null : 'invalid data.comment'),
  dateTime: (data) => (data.action === 'businessHours' ? findBusinessHoursError(data) : null),
}

/** Checks one node against the fields the app relies on. Returns a problem or null. */
function findNodeError(node, index) {
  if (!isPlainObject(node)) return `node at index ${index} is not an object`
  if (!isValidId(node.id)) return `node at index ${index} has an invalid id`

  const label = `node "${node.id}"`
  if (typeof node.type !== 'string' || node.type === '') return `${label} has an invalid type`
  if (!isValidId(node.parentId)) return `${label} has an invalid parentId`
  if (!isOptionalString(node.name)) return `${label} has an invalid name`
  if (node.data !== undefined && !isPlainObject(node.data)) return `${label} has invalid data`

  const data = node.data ?? {}
  if (!isOptionalString(data.type)) return `${label} has an invalid data.type`
  if (!isOptionalString(data.description)) return `${label} has an invalid data.description`

  const problem = DATA_RULES[node.type]?.(data)
  return problem ? `${label} has ${problem}` : null
}

/**
 * Validates the payload before it's accepted, so bad data fails as a load error instead of
 * crashing later. It checks the fields the app reads; later specs extend it as they read more.
 * Unknown node types are accepted (they render as "unknown"), and so are missing optional fields.
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
