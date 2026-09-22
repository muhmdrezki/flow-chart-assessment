/** Days as the payload names them, in week order. */
export const WEEK_DAYS = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])

/**
 * Used when a business-hours node has no timezone, and as the starting value for new ones.
 * Times are wall-clock times in the node's own timezone and are never converted.
 */
export const DEFAULT_TIMEZONE = 'UTC'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * A 24-hour `HH:mm` time, as the payload stores them ("09:00", "23:59").
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTimeString(value) {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}
