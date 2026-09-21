import { describe, expect, it, vi } from 'vitest'
import payload from '../../public/payload.json'
import { InvalidPayloadError, fetchFlow, shouldRetryFlowFetch } from './flowApi'

function mockFetch({ ok = true, status = 200, json = () => Promise.resolve(payload) } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('fetchFlow', () => {
  it('requests payload.json relative to the app base URL', async () => {
    const fetchMock = mockFetch()
    await fetchFlow()
    expect(fetchMock).toHaveBeenCalledWith('/payload.json')
  })

  it('returns the payload unchanged', async () => {
    mockFetch()
    await expect(fetchFlow()).resolves.toEqual(payload)
  })

  it('throws with the HTTP status when the request fails', async () => {
    mockFetch({ ok: false, status: 404 })
    const error = await fetchFlow().catch((e) => e)
    expect(error.message).toBe('Failed to load flow (404)')
    expect(error).not.toBeInstanceOf(InvalidPayloadError)
  })

  it('throws InvalidPayloadError when the body is not JSON', async () => {
    mockFetch({ json: () => Promise.reject(new SyntaxError('Unexpected token')) })
    const error = await fetchFlow().catch((e) => e)
    expect(error).toBeInstanceOf(InvalidPayloadError)
    expect(error.message).toBe('Invalid flow payload: not valid JSON')
  })

  it('throws InvalidPayloadError describing the first problem in the payload', async () => {
    mockFetch({ json: () => Promise.resolve([null]) })
    const error = await fetchFlow().catch((e) => e)
    expect(error).toBeInstanceOf(InvalidPayloadError)
    expect(error.message).toBe('Invalid flow payload: node at index 0 is not an object')
  })

  it('throws InvalidPayloadError when the body is not an array', async () => {
    mockFetch({ json: () => Promise.resolve({}) })
    await expect(fetchFlow()).rejects.toThrow('Invalid flow payload: expected an array of nodes')
  })
})

describe('shouldRetryFlowFetch', () => {
  it.each([0, 1, 2])('retries a network error after %i failures', (failureCount) => {
    expect(shouldRetryFlowFetch(failureCount, new Error('network'))).toBe(true)
  })

  it('stops after three failures', () => {
    expect(shouldRetryFlowFetch(3, new Error('network'))).toBe(false)
  })

  it('never retries invalid content', () => {
    expect(shouldRetryFlowFetch(0, new InvalidPayloadError('bad'))).toBe(false)
  })
})
