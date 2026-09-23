import { CREATABLE_KINDS, getNodeConfig } from './nodeRegistry'

export const TITLE_MAX_LENGTH = 60
export const DESCRIPTION_MAX_LENGTH = 200

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
