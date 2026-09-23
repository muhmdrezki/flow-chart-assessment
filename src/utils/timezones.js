import { DEFAULT_TIMEZONE } from './businessHours'

/**
 * The time zones the business-hours select offers, labelled as the mockup shows them:
 * `(GMT+00:00) UTC`.
 *
 * The list comes from the browser's own IANA database rather than one kept by hand here, which
 * would go stale every time a country changed its rules.
 */

/** @returns {string[]} every zone the browser knows, or none when it can't say. */
function supportedZones() {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    // `supportedValuesOf` is recent, so an older browser falls back to what the flow already uses.
    return []
  }
}

/**
 * Today's offset for a zone, e.g. "GMT+08:00". Intl writes plain "GMT" for zero, which would read
 * oddly beside the others, so it is spelled out.
 *
 * The offset is today's: a zone on summer time reads GMT+01:00 in July and GMT+00:00 in January.
 * That is cosmetic. The app stores the zone's name and never converts a time with it — business
 * hours are wall-clock times in the node's own zone.
 *
 * @param {string} timeZone
 * @param {Date} now
 * @returns {string}
 */
export function getOffset(timeZone, now) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      timeZoneName: 'longOffset',
    }).formatToParts(now)
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
    return offset === 'GMT' ? 'GMT+00:00' : offset
  } catch {
    return 'GMT+00:00'
  }
}

/** "GMT+08:30" → 510, so the list can be ordered west to east rather than alphabetically. */
function toMinutes(offset) {
  const [hours, minutes] = offset.slice(4).split(':')
  const sign = offset[3] === '-' ? -1 : 1
  return sign * (Number(hours) * 60 + Number(minutes ?? 0))
}

/**
 * @param {{ include?: string[], now?: Date }} options
 *   `include` keeps zones the flow already uses in the list even if this browser doesn't know them,
 *   so a select can never be missing the value it is supposed to show.
 * @returns {{ value: string, label: string }[]}
 */
export function getTimezoneOptions({ include = [], now = new Date() } = {}) {
  const zones = [...new Set([...supportedZones(), DEFAULT_TIMEZONE, ...include.filter(Boolean)])]

  return zones
    .map((zone) => {
      const offset = getOffset(zone, now)
      return { value: zone, label: `(${offset}) ${zone}`, minutes: toMinutes(offset) }
    })
    .sort((one, other) => one.minutes - other.minutes || one.value.localeCompare(other.value))
    .map(({ value, label }) => ({ value, label }))
}
