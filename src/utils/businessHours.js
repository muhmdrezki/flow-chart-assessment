/** Days as the payload names them, in week order. */
export const WEEK_DAYS = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])

/**
 * Display labels for the days, spelled out rather than capitalised from the identifier.
 * In a real implementation these would come from an i18n library, like the other user-facing
 * labels (see `TRIGGER_EVENT_LABELS` in nodeRegistry.js).
 */
export const DAY_LABELS = Object.freeze({
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
})

/**
 * Used when a business-hours node has no timezone, and as the starting value for new ones.
 * Times are wall-clock times in the node's own timezone and are never converted.
 */
export const DEFAULT_TIMEZONE = 'UTC'

/** A new business-hours node starts open Monday to Friday, 09:00–17:00 (Spec 03, decision 3e). */
export const DEFAULT_TIMES = Object.freeze(
  ['mon', 'tue', 'wed', 'thu', 'fri'].map((day) =>
    Object.freeze({ day, startTime: '09:00', endTime: '17:00' }),
  ),
)

/** Exactly two characters, both 0–9. Rejects "9", " 9" and "9a" (Number() would accept " 9"). */
function isTwoDigits(part) {
  return part.length === 2 && [...part].every((char) => char >= '0' && char <= '9')
}

/**
 * A 24-hour `HH:mm` time, as the payload stores them ("09:00", "23:59").
 * Hours run 00–23 and minutes 00–59, so "24:00", "9:00" and "09:00:00" are rejected.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTimeString(value) {
  if (typeof value !== 'string') return false

  const parts = value.split(':')
  if (parts.length !== 2) return false

  const [hours, minutes] = parts
  if (!isTwoDigits(hours) || !isTwoDigits(minutes)) return false

  return Number(hours) <= 23 && Number(minutes) <= 59
}
