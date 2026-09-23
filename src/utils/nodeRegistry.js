import { NODE_KIND, getNodeKind } from './nodeKind'

const CARD_SIZE = Object.freeze({ width: 240, height: 88 })
const PILL_SIZE = Object.freeze({ width: 96, height: 28 })

/**
 * Everything that differs between node kinds, in one place, so components never branch on type.
 *
 * - `icon` is a name that `ui/BaseIcon` maps to an SVG, which keeps this file free of Vue imports.
 * - `accent` is the CSS custom property shared by the node and its outgoing edges.
 * - `editable` decides whether a node can open the details drawer. Success and failure are
 *   display-only per the brief; the trigger is display-only by our decision (Spec 04).
 * - `hasInput` is false for the trigger: a flow starts there, so nothing connects into it.
 * - `creatable` marks the kinds the create form offers. It is separate from `editable` so the
 *   form's type list can never offer a kind the node factory cannot build.
 * - `canHaveChildren` is false for business hours: what follows it is always its success and
 *   failure branches, so a new step is added after one of those instead.
 * - `size` is what the layout uses, so its spacing matches what's drawn.
 */
export const NODE_REGISTRY = Object.freeze({
  [NODE_KIND.TRIGGER]: {
    label: 'Trigger',
    icon: 'zap',
    variant: 'card',
    editable: false,
    creatable: false,
    hasInput: false,
    canHaveChildren: true,
    accent: '--color-kind-trigger',
    size: CARD_SIZE,
  },
  [NODE_KIND.SEND_MESSAGE]: {
    label: 'Send Message',
    icon: 'send',
    variant: 'card',
    editable: true,
    creatable: true,
    hasInput: true,
    canHaveChildren: true,
    accent: '--color-kind-send-message',
    size: CARD_SIZE,
  },
  [NODE_KIND.ADD_COMMENT]: {
    label: 'Add Comment',
    icon: 'message-square',
    variant: 'card',
    editable: true,
    creatable: true,
    hasInput: true,
    canHaveChildren: true,
    accent: '--color-kind-add-comment',
    size: CARD_SIZE,
  },
  [NODE_KIND.BUSINESS_HOURS]: {
    label: 'Business Hours',
    icon: 'calendar-clock',
    variant: 'card',
    editable: true,
    creatable: true,
    hasInput: true,
    canHaveChildren: false,
    accent: '--color-kind-business-hours',
    size: CARD_SIZE,
  },
  [NODE_KIND.SUCCESS]: {
    label: 'Success',
    icon: 'check',
    variant: 'pill',
    editable: false,
    creatable: false,
    hasInput: true,
    canHaveChildren: true,
    accent: '--color-kind-success',
    size: PILL_SIZE,
  },
  [NODE_KIND.FAILURE]: {
    label: 'Failure',
    icon: 'x',
    variant: 'pill',
    editable: false,
    creatable: false,
    hasInput: true,
    canHaveChildren: true,
    accent: '--color-kind-failure',
    size: PILL_SIZE,
  },
  [NODE_KIND.UNKNOWN]: {
    label: 'Unknown',
    icon: 'circle-help',
    variant: 'card',
    editable: false,
    creatable: false,
    hasInput: true,
    canHaveChildren: true,
    accent: '--color-kind-neutral',
    size: CARD_SIZE,
  },
})

/**
 * Display labels for trigger events (`data.type` of a trigger node). Trigger events are a fixed,
 * known list, so they're spelled out rather than generated from the identifier. An event missing
 * here is shown as its raw identifier.
 *
 * In a real implementation these would come from an i18n library (e.g. vue-i18n message keys such
 * as `triggers.conversationOpened`), like the other user-facing labels in this file.
 */
export const TRIGGER_EVENT_LABELS = Object.freeze({
  conversationOpened: 'Conversation Opened',
})

/**
 * Always returns an entry: nodes of an unrecognised kind get the `unknown` one.
 * @param {{ type?: string, data?: Record<string, any> } | undefined} node
 */
export function getNodeConfig(node) {
  return NODE_REGISTRY[getNodeKind(node)]
}

/** @param {{ type?: string, data?: Record<string, any> } | undefined} node */
export function getNodeSize(node) {
  return getNodeConfig(node).size
}

/** @param {{ type?: string, data?: Record<string, any> } | undefined} node */
export function isEditable(node) {
  return getNodeConfig(node).editable
}

/** The kinds the create form offers: sendMessage, addComment and businessHours. */
export const CREATABLE_KINDS = Object.freeze(
  Object.entries(NODE_REGISTRY)
    .filter(([, config]) => config.creatable)
    .map(([kind]) => kind),
)
