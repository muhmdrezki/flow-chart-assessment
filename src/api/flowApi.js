import { findPayloadError } from '@/utils/graph'

/** The payload was fetched but its content is unusable. Retrying can't fix that. */
export class InvalidPayloadError extends Error {
  name = 'InvalidPayloadError'
}

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
