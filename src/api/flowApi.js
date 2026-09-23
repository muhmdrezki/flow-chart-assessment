import { buildNewNodes } from '@/utils/nodeFactory'
import { generateNodeId } from '@/utils/nodeIds'
import { findPayloadError } from '@/utils/payloadValidation'
import { getAllowedParents, validateCreateNode } from '@/utils/validation'

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
