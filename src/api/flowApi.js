import { toDraft } from '@/utils/nodeEdit'
import { buildNewNodes } from '@/utils/nodeFactory'
import { generateNodeId } from '@/utils/nodeIds'
import { getNodeKind } from '@/utils/nodeKind'
import { getRemoval } from '@/utils/nodeRemoval'
import { findPayloadError } from '@/utils/payloadValidation'
import { getAllowedParents, validateCreateNode, validateNodeDraft } from '@/utils/validation'

/** The payload was fetched but its content is unusable. Retrying can't fix that. */
export class InvalidPayloadError extends Error {
  name = 'InvalidPayloadError'
}

/** The create form's values were rejected. `fieldErrors` maps a field name to its message. */
export class NodeValidationError extends Error {
  name = 'NodeValidationError'

  constructor(fieldErrors) {
    super('The new node is not valid')
    this.fieldErrors = fieldErrors
  }
}

/** Stands in for network latency, so the UI's pending state is real. */
export const SIMULATED_LATENCY_MS = 300

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Loads the flow payload. It's served from `public/` so this stays a real async request,
 * with loading and error states, rather than JSON bundled into the app.
 *
 * The payload is validated here, so a bad file becomes a query error (shown with Retry)
 * instead of crashing later while the store hydrates.
 * @returns {Promise<import('@/utils/graph').RawNode[]>}
 */
export async function fetchFlow() {
  const response = await fetch(`${import.meta.env.BASE_URL}payload.json`)
  if (!response.ok) {
    throw new Error(`Failed to load flow (${response.status})`)
  }

  let body
  try {
    body = await response.json()
  } catch {
    throw new InvalidPayloadError('Invalid flow payload: not valid JSON')
  }

  const problem = findPayloadError(body)
  if (problem) {
    throw new InvalidPayloadError(`Invalid flow payload: ${problem}`)
  }
  return body
}

/**
 * Retry policy for the flow query: network and server errors get Vue Query's usual three
 * retries, but invalid content fails straight away because it would fail the same way again.
 * @param {number} failureCount
 * @param {Error} error
 */
export function shouldRetryFlowFetch(failureCount, error) {
  return !(error instanceof InvalidPayloadError) && failureCount < 3
}

/**
 * Creates a node. There's no backend, so this stands in for one: it validates the form values
 * again (a server never trusts its client), assigns the ids, builds the node(s) and answers after
 * a short delay. Swapping in a real API means changing only this function.
 *
 * @param {{ title: string, description: string, type: string, parentId: string }} values
 * @param {{ nodes: import('@/utils/graph').FlowNode[], delayMs?: number }} context
 *   `nodes` is the current flow: it decides which parents are allowed and which ids are taken.
 * @returns {Promise<{ nodes: object[], insertedId: string, continuationId: string }>}
 * @throws {NodeValidationError} when the values are invalid
 */
export async function createNode(values, { nodes, delayMs = SIMULATED_LATENCY_MS }) {
  const allowedParentIds = getAllowedParents(nodes).map((node) => node.id)
  const fieldErrors = validateCreateNode(values, { allowedParentIds })
  if (Object.keys(fieldErrors).length) {
    throw new NodeValidationError(fieldErrors)
  }

  const existingIds = nodes.map((node) => node.id)
  const created = buildNewNodes(values, () => generateNodeId(existingIds))

  await wait(delayMs)
  return created
}

/**
 * Saves an edited node. Like `createNode`, it checks the values again before accepting them: the
 * form is one caller, not the only conceivable one, and the check is the same pure function.
 *
 * @param {import('@/utils/graph').FlowNode} node  the edited node, payload-shaped
 * @param {{ nodes: import('@/utils/graph').FlowNode[], delayMs?: number }} context
 * @returns {Promise<import('@/utils/graph').FlowNode>}
 * @throws {NodeValidationError} when a field is invalid
 */
export async function updateNode(node, { nodes, delayMs = SIMULATED_LATENCY_MS }) {
  if (!nodes.some((candidate) => candidate.id === node.id)) {
    throw new Error('That step is no longer in the flow.')
  }

  /*
   * `toDraft` fills in what the canvas would show — a node the payload never named is drafted as
   * its kind's label, and a missing timezone as UTC. That is right for a form, but it would make
   * the two rules that ask for those fields unfailable here. So where the node actually carries
   * them, the stored values are what gets checked.
   */
  const stored = {
    ...(node.name !== undefined && { title: node.name }),
    ...(node.data?.timezone !== undefined && { timezone: node.data.timezone }),
  }

  const fieldErrors = validateNodeDraft({ ...toDraft(node), ...stored }, getNodeKind(node))
  if (Object.keys(fieldErrors).length) {
    throw new NodeValidationError(fieldErrors)
  }

  await wait(delayMs)
  return structuredClone(node)
}

/**
 * Deletes a node. What that takes with it is decided by `getRemoval`, so the rule lives in one
 * place and the store only applies the answer.
 *
 * @param {string} id
 * @param {{ nodes: import('@/utils/graph').FlowNode[], delayMs?: number }} context
 * @returns {Promise<import('@/utils/nodeRemoval').Removal>}
 */
export async function deleteNode(id, { nodes, delayMs = SIMULATED_LATENCY_MS }) {
  await wait(delayMs)

  /*
   * Worked out after the wait, not before it. The canvas stays usable while this is in flight, so
   * a removal decided up front could be applied to a flow that has moved on — shifting a node the
   * user dragged in the meantime, or leaving a step that was added under the doomed one pointing
   * at a parent that no longer exists.
   */
  const removal = getRemoval(nodes, id)
  if (!removal) {
    throw new Error("That step can't be deleted.")
  }

  return removal
}
