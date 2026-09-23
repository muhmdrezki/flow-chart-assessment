const ID_BYTES = 3 // 3 bytes → 6 hex characters, the same shape as the payload's ids
const MAX_ATTEMPTS = 50

const toHex = (byte) => byte.toString(16).padStart(2, '0')

/**
 * A new node id in the payload's format: 6 lowercase hex characters, e.g. "a3f09c".
 * Retries on the tiny chance of a collision, so ids stay unique within the flow.
 * @param {Iterable<string>} [existingIds]
 * @returns {string}
 */
export function generateNodeId(existingIds = []) {
  const taken = new Set(existingIds)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(ID_BYTES))
    const id = Array.from(bytes, toHex).join('')
    if (!taken.has(id)) return id
  }

  // 16.7M possible ids, so this means something is wrong (e.g. a stubbed random source).
  throw new Error('Could not generate a unique node id')
}
