import { NODE_KIND, getNodeKind } from './nodeKind'

const CARD_SIZE = Object.freeze({ width: 240, height: 88 })
const PILL_SIZE = Object.freeze({ width: 96, height: 28 })

/**
 * Everything that differs between node kinds, in one place, so components never branch on type.
 *
 * - `icon` is a name that `ui/BaseIcon` maps to an SVG, which keeps this file free of Vue imports.
 * - `accent` is the CSS custom property shared by the node and its outgoing edges.
 * - `purpose` is the line under the drawer's title, saying what the step does (as in the mockup).
 * - `deletable` is false for the trigger, which a flow can't be without, and for the branch pills,
 *   which belong to their condition.
 * - `hasDetails` decides whether clicking a node opens the details drawer. Only the three kinds the
 *   brief calls editable have one: success and failure are "purely for display in the canvas", and
 *   the trigger is the flow's entry point rather than a step (Spec 04, decision 4c).
 * - `hasInput` is false for the trigger: a flow starts there, so nothing connects into it.
 * - `creatable` marks the kinds the create form offers. It is separate from `hasDetails` so the
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
    hasDetails: false,
    purpose: 'Starts the flow when this happens in a conversation.',
    deletable: false,
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
    hasDetails: true,
    purpose: 'Sends a message to the contact.',
    deletable: true,
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
    hasDetails: true,
    purpose: 'Leaves a note on the conversation for your team.',
    deletable: true,
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
    hasDetails: true,
    purpose: 'Branches the flow on date and time conditions.',
    deletable: true,
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
    hasDetails: false,
    purpose: 'The path taken when the condition is met.',
    deletable: false,
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
    hasDetails: false,
    purpose: 'The path taken when the condition is not met.',
    deletable: false,
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
    hasDetails: false,
    purpose: 'This kind of step is not supported yet.',
    deletable: false,
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

/**
 * Whether clicking the node opens the details drawer.
 * @param {{ type?: string, data?: Record<string, any> } | undefined} node
 */
export function hasDetails(node) {
  return getNodeConfig(node).hasDetails
}

/** The kinds the create form offers: sendMessage, addComment and businessHours. */
export const CREATABLE_KINDS = Object.freeze(
  Object.entries(NODE_REGISTRY)
    .filter(([, config]) => config.creatable)
    .map(([kind]) => kind),
)
