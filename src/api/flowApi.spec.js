import { describe, expect, it, vi } from 'vitest'
import payload from '../../public/payload.json'
import {
  InvalidPayloadError,
  NodeValidationError,
  SIMULATED_LATENCY_MS,
  createNode,
  deleteNode,
  fetchFlow,
  shouldRetryFlowFetch,
  updateNode,
} from './flowApi'
import { deriveEdges, normalizePayload } from '@/utils/graph'
import { computeLayout } from '@/utils/layout'

/** The flow as the store holds it: ids normalised and every node given a position. */
const laidOutNodes = (() => {
  const list = normalizePayload(payload)
  const positions = computeLayout(list, deriveEdges(list))
  return list.map((node) => ({ ...node, position: positions.get(node.id) }))
})()

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

describe('createNode', () => {
  const nodes = normalizePayload(payload)
  const VALUES = {
    title: 'Follow up',
    description: 'Checks in later',
    type: 'sendMessage',
    parentId: 'b6a0c1',
  }
  const create = (overrides = {}) => createNode({ ...VALUES, ...overrides }, { nodes, delayMs: 0 })

  it('builds the node in the payload shape, ready for the store', async () => {
    const { nodes: created, insertedId, continuationId } = await create()

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      id: insertedId,
      parentId: 'b6a0c1',
      type: 'sendMessage',
      name: 'Follow up',
      data: { description: 'Checks in later', payload: [] },
    })
    expect(continuationId).toBe(insertedId)
  })

  it('assigns an id that is not already used in the flow', async () => {
    const { insertedId } = await create()

    expect(insertedId).toHaveLength(6)
    expect(nodes.some((node) => node.id === insertedId)).toBe(false)
  })

  it('creates the success and failure branches for business hours', async () => {
    const { nodes: created, insertedId, continuationId } = await create({ type: 'businessHours' })

    expect(created).toHaveLength(3)
    expect(created[0].data.connectors).toEqual([created[1].id, created[2].id])
    expect(continuationId).toBe(created[1].id)
    expect(continuationId).not.toBe(insertedId)
    expect(new Set(created.map((node) => node.id)).size).toBe(3)
  })

  describe('rejecting invalid values', () => {
    const errorFor = async (overrides) => {
      const error = await create(overrides).catch((thrown) => thrown)
      expect(error).toBeInstanceOf(NodeValidationError)
      return error
    }

    it('reports the field that is wrong', async () => {
      expect((await errorFor({ title: '  ' })).fieldErrors).toEqual({ title: 'Title is required' })
    })

    it('checks the values again, even though the form already did', async () => {
      expect((await errorFor({ type: 'trigger' })).fieldErrors).toEqual({
        type: 'Choose a node type',
      })
    })

    it('refuses a parent that is not in the flow', async () => {
      expect((await errorFor({ parentId: 'ghost' })).fieldErrors).toEqual({
        parentId: 'Choose where to add the node',
      })
    })

    it('refuses business hours as a parent, since it branches instead', async () => {
      expect((await errorFor({ parentId: 'd09c08' })).fieldErrors).toEqual({
        parentId: 'Choose where to add the node',
      })
    })

    it('fails before waiting, so the form reacts at once', async () => {
      vi.useFakeTimers()
      await expect(createNode({ ...VALUES, title: '' }, { nodes })).rejects.toBeInstanceOf(
        NodeValidationError,
      )
      vi.useRealTimers()
    })
  })

  it('answers after a short delay, so the pending state is real', async () => {
    vi.useFakeTimers()
    let settled = false
    const pending = createNode(VALUES, { nodes }).then(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(SIMULATED_LATENCY_MS - 1)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(settled).toBe(true)
    vi.useRealTimers()
  })
})

describe('updateNode', () => {
  const nodes = laidOutNodes

  const edited = (overrides = {}) => ({
    ...nodes.find((node) => node.id === 'e879e4'),
    name: 'Renamed',
    ...overrides,
  })

  it('answers with the saved node', async () => {
    await expect(updateNode(edited(), { nodes, delayMs: 0 })).resolves.toEqual(edited())
  })

  it('answers with a copy, so the caller cannot reach into the flow', async () => {
    const node = edited()
    const saved = await updateNode(node, { nodes, delayMs: 0 })

    expect(saved).not.toBe(node)
    expect(saved.data).not.toBe(node.data)
  })

  it('refuses a node that is no longer in the flow', async () => {
    await expect(updateNode(edited({ id: 'ghost' }), { nodes, delayMs: 0 })).rejects.toThrow(
      'That step is no longer in the flow.',
    )
  })

  it('checks the values again, even though the form already did', async () => {
    const promise = updateNode(edited({ name: 'x'.repeat(61) }), { nodes, delayMs: 0 })

    await expect(promise).rejects.toBeInstanceOf(NodeValidationError)
    await expect(promise).rejects.toMatchObject({
      fieldErrors: { title: 'Title must be 60 characters or fewer' },
    })
  })

  it('accepts a node the payload never named, like the trigger', async () => {
    // A missing name isn't missing data: the canvas and the drawer both call it by its kind.
    const trigger = nodes.find((node) => node.id === '1')

    await expect(updateNode(trigger, { nodes, delayMs: 0 })).resolves.toEqual(trigger)
  })

  it('checks the rules that belong to the kind', async () => {
    const businessHours = nodes.find((node) => node.id === 'd09c08')
    const broken = {
      ...businessHours,
      data: {
        ...businessHours.data,
        times: [{ day: 'mon', startTime: '17:00', endTime: '09:00' }],
      },
    }

    await expect(updateNode(broken, { nodes, delayMs: 0 })).rejects.toMatchObject({
      fieldErrors: { 'times.mon': 'Monday must end after it starts' },
    })
  })
})

describe('deleteNode', () => {
  const nodes = laidOutNodes

  it('answers with what goes and where that leaves the rest', async () => {
    await expect(deleteNode('b6a0c1', { nodes, delayMs: 0 })).resolves.toEqual({
      removeIds: ['b6a0c1'],
      reparent: [{ id: 'e879e4', parentId: '28c4b9' }],
      shift: { ids: ['e879e4'], dy: expect.any(Number) },
    })
  })

  it('takes a condition’s branches with it', async () => {
    const { removeIds } = await deleteNode('d09c08', { nodes, delayMs: 0 })

    expect(removeIds).toHaveLength(6)
  })

  it.each([
    ['the trigger', '1'],
    ['a branch pill', '161f52'],
    ['a node that is not in the flow', 'ghost'],
  ])('refuses %s', async (_, id) => {
    await expect(deleteNode(id, { nodes, delayMs: 0 })).rejects.toThrow(
      "That step can't be deleted.",
    )
  })
})
