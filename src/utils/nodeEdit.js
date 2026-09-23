import { DEFAULT_TIMEZONE, WEEK_DAYS } from './businessHours'
import { getNodeTitle, trimText } from './nodeDescription'
import { NODE_KIND, getNodeKind } from './nodeKind'

/**
 * The drawer edits a **draft**: one flat, form-shaped object per node. It exists because the
 * payload's shapes don't suit form controls — a week of business hours is a sparse list, and a
 * message is a list of differently shaped parts — and because nothing should reach the store until
 * the user saves.
 *
 * @typedef {{ key: string, type: 'text', text: string }} TextPart
 * @typedef {{ key: string, type: 'attachment', attachment: string }} AttachmentPart
 * @typedef {{ day: string, isOpen: boolean, startTime: string, endTime: string }} DraftDay
 * @typedef {{
 *   title: string,
 *   description: string,
 *   oncePerContact?: boolean,
 *   comment?: string,
 *   parts?: (TextPart|AttachmentPart)[],
 *   days?: DraftDay[],
 *   timezone?: string,
 * }} Draft
 */

/** A day that was never open still shows times, so opening it doesn't mean typing them first. */
const FALLBACK_HOURS = Object.freeze({ startTime: '09:00', endTime: '17:00' })

/*
 * Message parts are added and removed while editing, so `v-for` needs a key that isn't the index —
 * removing the first part would otherwise renumber every part after it and move the focus.
 */
let partCounter = 0
const nextPartKey = () => `part-${(partCounter += 1)}`

/** A new, empty part for the form to add. @returns {TextPart|AttachmentPart} */
export function createPart(type) {
  return type === 'attachment'
    ? { key: nextPartKey(), type: 'attachment', attachment: '' }
    : { key: nextPartKey(), type: 'text', text: '' }
}

function toParts(data) {
  const items = Array.isArray(data.payload) ? data.payload : []

  return items.flatMap((item) => {
    if (item?.type === 'text') return [{ key: nextPartKey(), type: 'text', text: item.text ?? '' }]
    if (item?.type === 'attachment')
      return [{ key: nextPartKey(), type: 'attachment', attachment: item.attachment ?? '' }]
    return []
  })
}

function toDays(data) {
  const times = Array.isArray(data.times) ? data.times : []
  const byDay = new Map(times.filter((time) => time?.day).map((time) => [time.day, time]))

  return WEEK_DAYS.map((day) => {
    const time = byDay.get(day)
    return {
      day,
      isOpen: Boolean(time),
      startTime: time?.startTime || FALLBACK_HOURS.startTime,
      endTime: time?.endTime || FALLBACK_HOURS.endTime,
    }
  })
}

const READERS = {
  [NODE_KIND.TRIGGER]: (data) => ({ oncePerContact: Boolean(data.oncePerContact) }),
  [NODE_KIND.SEND_MESSAGE]: (data) => ({ parts: toParts(data) }),
  [NODE_KIND.ADD_COMMENT]: (data) => ({
    comment: typeof data.comment === 'string' ? data.comment : '',
  }),
  [NODE_KIND.BUSINESS_HOURS]: (data) => ({
    timezone: trimText(data.timezone) || DEFAULT_TIMEZONE,
    days: toDays(data),
  }),
}

/**
 * The node as the form shows it. The title is what the canvas displays, so a node the payload never
 * named (the trigger) starts from "Trigger" rather than an empty required field.
 * @param {import('./graph').FlowNode} node
 * @returns {Draft}
 */
export function toDraft(node) {
  const data = node?.data ?? {}
  const read = READERS[getNodeKind(node)]

  return {
    title: node ? getNodeTitle(node) : '',
    description: trimText(data.description),
    ...read?.(data),
  }
}

const WRITERS = {
  [NODE_KIND.TRIGGER]: (draft) => ({ oncePerContact: Boolean(draft.oncePerContact) }),
  [NODE_KIND.SEND_MESSAGE]: (draft) => ({
    payload: (draft.parts ?? []).map((part) =>
      part.type === 'attachment'
        ? { type: 'attachment', attachment: part.attachment.trim() }
        : { type: 'text', text: part.text.trim() },
    ),
  }),
  [NODE_KIND.ADD_COMMENT]: (draft) => ({ comment: draft.comment.trim() }),
  [NODE_KIND.BUSINESS_HOURS]: (draft) => ({
    timezone: draft.timezone,
    // A closed day is simply absent, which is how the payload says "not open then".
    times: (draft.days ?? [])
      .filter((day) => day.isOpen)
      .map(({ day, startTime, endTime }) => ({ day, startTime, endTime })),
  }),
}

/**
 * The draft written back onto the node, payload-shaped. Everything it doesn't own is carried over
 * untouched — a business-hours node keeps its `action` and its `connectors`.
 *
 * It converts; it doesn't sanitise. A blank message part survives, so the simulated API can reject
 * it the same way it would reject anything else that arrived without going through the form.
 *
 * @param {import('./graph').FlowNode} node
 * @param {Draft} draft
 * @returns {import('./graph').FlowNode}
 */
export function fromDraft(node, draft) {
  const description = draft.description.trim()
  const write = WRITERS[getNodeKind(node)]
  const data = { ...(node.data ?? {}) }
  delete data.description

  return {
    ...node,
    name: draft.title.trim(),
    data: {
      ...data,
      ...write?.(draft),
      // Blank means "no description", not an empty one.
      ...(description ? { description } : {}),
    },
  }
}

/** A part's key identifies a row in the form; it isn't a value the user can change. */
const withoutKeys = (draft) => ({
  ...draft,
  ...(draft.parts && {
    parts: draft.parts.map(({ type, text, attachment }) => ({ type, text, attachment })),
  }),
})

/**
 * Whether two drafts hold the same values, so Save can be offered only when something changed.
 * Both come from `toDraft`, so their keys are in the same order and comparing the text is enough.
 * @returns {boolean}
 */
export function isSameDraft(one, other) {
  return JSON.stringify(withoutKeys(one)) === JSON.stringify(withoutKeys(other))
}
