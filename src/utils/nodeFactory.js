import { DEFAULT_TIMES, DEFAULT_TIMEZONE } from './businessHours'
import { NODE_KIND } from './nodeKind'
import { NODE_REGISTRY } from './nodeRegistry'

const connector = (id, parentId, connectorType) => ({
  id,
  parentId,
  type: 'dateTimeConnector',
  name: NODE_REGISTRY[connectorType].label,
  data: { connectorType },
})

const BUILDERS = {
  [NODE_KIND.SEND_MESSAGE]: ({ id, base }) => ({
    nodes: [{ ...base, id, type: 'sendMessage', data: { ...base.data, payload: [] } }],
    continuationId: id,
  }),

  [NODE_KIND.ADD_COMMENT]: ({ id, base }) => ({
    nodes: [{ ...base, id, type: 'addComment', data: { ...base.data, comment: '' } }],
    continuationId: id,
  }),

  // A condition needs both outcomes, so its success and failure branches are created with it
  // (Spec 03, decision 3d). Whatever followed the parent continues on the success path.
  [NODE_KIND.BUSINESS_HOURS]: ({ id, base, generateId }) => {
    const successId = generateId()
    const failureId = generateId()

    return {
      nodes: [
        {
          ...base,
          id,
          type: 'dateTime',
          data: {
            ...base.data,
            action: 'businessHours',
            timezone: DEFAULT_TIMEZONE,
            times: structuredClone(DEFAULT_TIMES),
            connectors: [successId, failureId],
          },
        },
        connector(successId, id, NODE_KIND.SUCCESS),
        connector(failureId, id, NODE_KIND.FAILURE),
      ],
      continuationId: successId,
    }
  },
}

/**
 * Builds the node(s) for a create, in the payload's own shape, so created and loaded nodes look
 * the same everywhere else. Ids come from `generateId`, as a real backend would assign them.
 *
 * @param {{ title: string, description: string, type: string, parentId: string }} values
 * @param {() => string} generateId
 * @returns {{ nodes: object[], insertedId: string, continuationId: string }}
 *   `insertedId` is the node the user created; `continuationId` is the node that whatever used to
 *   follow the parent should now hang from (the same node, or its success branch).
 */
export function buildNewNodes(values, generateId) {
  const build = BUILDERS[values.type]
  if (!build) throw new Error(`Cannot create a node of type "${values.type}"`)

  // A business-hours create needs three ids. The caller only knows the ids already in the flow,
  // so the ones minted here are also checked against each other.
  const issued = new Set()
  const nextId = () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const id = generateId()
      if (!issued.has(id)) {
        issued.add(id)
        return id
      }
    }
    throw new Error('Could not generate unique ids for the new nodes')
  }

  const id = nextId()
  const base = {
    parentId: values.parentId,
    name: values.title.trim(),
    data: { description: values.description.trim() },
  }

  const { nodes, continuationId } = build({ id, base, generateId: nextId })
  return { nodes, insertedId: id, continuationId }
}
