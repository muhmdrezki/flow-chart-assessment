import { DAY_LABELS, DEFAULT_TIMEZONE, WEEK_DAYS, isTimeString } from './businessHours'
import { getAttachmentName, trimText } from './nodeDescription'
import { NODE_KIND, getNodeKind } from './nodeKind'
import { TRIGGER_EVENT_LABELS } from './nodeRegistry'

/**
 * One row in the details drawer. The drawer renders each row by its `kind`, so what a node shows
 * is decided here rather than in a component per node kind.
 *
 * @typedef {{ kind: 'text', label: string, value: string }} TextProperty
 * @typedef {{ kind: 'flag', label: string, value: boolean }} FlagProperty
 * @typedef {{ kind: 'attachment', label: string, url: string, name: string, isImage: boolean }} AttachmentProperty
 * @typedef {{ day: string, label: string, startTime: string|null, endTime: string|null }} ScheduleDay
 * @typedef {{ kind: 'schedule', label: string, days: ScheduleDay[] }} ScheduleProperty
 * @typedef {TextProperty | FlagProperty | AttachmentProperty | ScheduleProperty} NodeProperty
 */

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg']

/** Attachments are plain URLs in the payload, so the file name is all there is to go on. */
function isImageName(name) {
  const lowerCase = name.toLowerCase()
  return IMAGE_EXTENSIONS.some((extension) => lowerCase.endsWith(extension))
}

/** @returns {AttachmentProperty} */
function toAttachment(url) {
  const name = getAttachmentName(url)
  return { kind: 'attachment', label: 'Attachment', url, name, isImage: isImageName(name) }
}

function describeTrigger(data) {
  const event = trimText(data.type)
  return [
    {
      kind: 'text',
      label: 'Event',
      // Own properties only: an event called "constructor" must not reach up the prototype chain.
      value: Object.hasOwn(TRIGGER_EVENT_LABELS, event) ? TRIGGER_EVENT_LABELS[event] : event,
    },
    { kind: 'flag', label: 'Once per contact', value: Boolean(data.oncePerContact) },
  ]
}

/** A message is a list of parts, each either text or an attachment, in the order they're sent. */
function describeMessage(data) {
  const items = Array.isArray(data.payload) ? data.payload : []

  return items.flatMap((item) => {
    if (item?.type === 'text')
      return [{ kind: 'text', label: 'Message', value: trimText(item.text) }]
    if (item?.type === 'attachment' && item.attachment) return [toAttachment(item.attachment)]
    return []
  })
}

function describeComment(data) {
  return [{ kind: 'text', label: 'Comment', value: trimText(data.comment) }]
}

/**
 * All seven days are listed, so a day the flow is closed on is stated rather than left out.
 * Times are wall-clock times in the node's own timezone and are shown exactly as stored.
 */
function describeBusinessHours(data) {
  const times = Array.isArray(data.times) ? data.times : []
  const byDay = new Map(times.filter((time) => time?.day).map((time) => [time.day, time]))

  return [
    { kind: 'text', label: 'Time zone', value: trimText(data.timezone) || DEFAULT_TIMEZONE },
    {
      kind: 'schedule',
      label: 'Opening hours',
      days: WEEK_DAYS.map((day) => {
        // A day is open only if it has both ends of its opening hours: half a range says nothing.
        const time = byDay.get(day)
        const isOpen = isTimeString(time?.startTime) && isTimeString(time?.endTime)
        return {
          day,
          label: DAY_LABELS[day],
          startTime: isOpen ? time.startTime : null,
          endTime: isOpen ? time.endTime : null,
        }
      }),
    },
  ]
}

const DESCRIBERS = {
  [NODE_KIND.TRIGGER]: describeTrigger,
  [NODE_KIND.SEND_MESSAGE]: describeMessage,
  [NODE_KIND.ADD_COMMENT]: describeComment,
  [NODE_KIND.BUSINESS_HOURS]: describeBusinessHours,
}

/**
 * What the details drawer shows for a node: its own description first, then whatever its kind
 * carries. Kinds with no describer (success, failure, unknown) have no details to show, which is
 * also why they never open the drawer.
 *
 * @param {import('./graph').FlowNode | null | undefined} node
 * @returns {NodeProperty[]}
 */
export function getNodeProperties(node) {
  const describe = DESCRIBERS[getNodeKind(node)]
  if (!describe) return []

  const data = node.data ?? {}
  const description = trimText(data.description)
  const rows = [
    ...(description ? [{ kind: 'text', label: 'Description', value: description }] : []),
    ...describe(data),
  ]

  // A text row with nothing in it says less than no row at all.
  return rows.filter((row) => row.kind !== 'text' || row.value)
}
