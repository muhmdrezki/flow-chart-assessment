/**
 * The payload mixes numeric and string ids (the trigger is `1`, the rest are hex strings).
 * Everything inside the app compares ids as strings.
 * @param {string|number} id
 * @returns {string}
 */
export function normalizeId(id) {
  return String(id)
}

/**
 * The payload marks the root with `parentId: -1`; a missing parent means the same thing.
 * @param {string|number|null|undefined} parentId
 * @returns {boolean}
 */
export function isRootParent(parentId) {
  return parentId == null || String(parentId) === '-1'
}
