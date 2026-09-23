import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { deriveEdges, normalizePayload } from '@/utils/graph'
import { computeLayout } from '@/utils/layout'
import { getNodeDescription, getNodeTitle } from '@/utils/nodeDescription'
import { getNodeConfig, getNodeSize } from '@/utils/nodeRegistry'
import { getInsertShift, positionBelow, shiftSubtree } from '@/utils/placement'

/**
 * Single source of truth for the flow graph. Vue Query only loads the payload; once it's
 * hydrated here, nothing reads the query cache for nodes again.
 */
export const useFlowStore = defineStore('flow', () => {
  /** @type {import('vue').Ref<import('@/utils/graph').FlowNode[]>} */
  const nodes = ref([])
  const isHydrated = ref(false)

  const nodeById = computed(() => new Map(nodes.value.map((node) => [node.id, node])))
  const edges = computed(() => deriveEdges(nodes.value))

  /**
   * Title and description per node. It reads only names and data, never positions, so a drag
   * doesn't recompute it and every node keeps the same display object.
   */
  const nodeDisplayById = computed(
    () =>
      new Map(
        nodes.value.map((node) => [
          node.id,
          { title: getNodeTitle(node), description: getNodeDescription(node) },
        ]),
      ),
  )

  /**
   * Seeds the store from the raw payload. Runs once: later calls are ignored so cached query
   * data can never overwrite changes made in the app.
   * @param {import('@/utils/graph').RawNode[]} raw
   */
  function hydrate(raw) {
    if (isHydrated.value) return

    // Query data arrives as a reactive proxy, which structuredClone can't copy.
    const normalized = normalizePayload(toRaw(raw))
    layoutFlow(normalized)
    nodes.value = normalized
    isHydrated.value = true
  }

  /**
   * Arranges the given nodes as a tidy tree and writes each position. It replaces every position,
   * including ones the user dragged, so it's only used where the shape of the tree changes.
   * Sizes come from the registry, so short branch pills sit closer than full cards.
   * @param {import('@/utils/graph').FlowNode[]} list
   */
  function layoutFlow(list) {
    const positions = computeLayout(list, deriveEdges(list), { getNodeSize })
    for (const node of list) {
      node.position = positions.get(node.id)
    }
  }

  /**
   * Adds created nodes to the flow, after the mutation that made them succeeded.
   *
   * The new node is inserted **between** its parent and whatever used to follow that parent, so an
   * ordinary step still has one next step. A condition (business hours) arrives with its own
   * success and failure branches, and the flow continues on the success one.
   *
   * @param {import('@/utils/graph').RawNode[]} created  payload-shaped nodes from the API
   * @param {{ insertedId: string, continuationId: string }} placement
   *   `insertedId` is the node the user created; `continuationId` is the node the previous
   *   followers now hang from (the same node, or its success branch).
   * @returns {string} the id of the created node
   */
  function insertNodes(created, { insertedId, continuationId }) {
    // 1. Normalise what the API returned, exactly like payload nodes (string ids, copied data).
    const normalized = normalizePayload(toRaw(created))

    // 2. Find the two nodes the caller named. Looking them up by id (rather than by position in
    //    the array) means the two arguments can never drift apart from the nodes themselves.
    const inserted = normalized.find((node) => node.id === insertedId)
    const continuation = normalized.find((node) => node.id === continuationId)
    if (!inserted) throw new Error(`Created nodes do not include the new node "${insertedId}"`)
    if (!continuation) {
      throw new Error(`Created nodes do not include the continuation "${continuationId}"`)
    }

    // 3. Check the parent: it has to exist, and it has to be a step that can take a next step.
    //    Business hours can't: what follows it is always its own success and failure branches.
    const parent = nodeById.value.get(inserted.parentId)
    if (!parent) throw new Error(`Cannot add a node after unknown node "${inserted.parentId}"`)
    if (!getNodeConfig(parent).canHaveChildren) {
      throw new Error(`Cannot add a node after "${parent.id}", which branches instead`)
    }

    // 4. Everything the API created apart from the new node itself: a condition's two branches.
    const branches = normalized.filter((node) => node !== inserted)
    const followers = nodes.value.filter((node) => node.parentId === parent.id)

    // 5. Place the new node, unless a branch arrived with it (step 8 handles that case).
    if (!branches.length) {
      inserted.position = positionBelow(parent, inserted)

      // 6. Move the steps that followed the parent down by the space the insert just added. It's a
      //    distance, not a target, so a branch the user dragged keeps its offset and only moves down.
      if (followers.length) {
        const positions = shiftSubtree(
          nodes.value,
          followers.map((node) => node.id),
          getInsertShift(parent, continuation),
        )
        for (const node of nodes.value) {
          const position = positions.get(node.id)
          if (position) node.position = position
        }
      }
    }

    // 7. Reattach: what followed the parent now follows the new node, or its success branch.
    for (const follower of followers) {
      follower.parentId = continuationId
    }
    nodes.value.push(...normalized)

    // 8. A condition is wider than the step it follows: its two branches need an extra column, so
    //    neighbouring branches have to make room. Rather than nudging each one, the whole flow is
    //    arranged again. This is the one case where manual positions are replaced.
    if (branches.length) layoutFlow(nodes.value)

    return insertedId
  }

  /**
   * Takes a list because a drag can move several selected nodes at once.
   * @param {{ id: string, position: { x: number, y: number } }[]} updates
   */
  function updateNodePositions(updates) {
    for (const { id, position } of updates) {
      const node = nodeById.value.get(id)
      if (node) node.position = { x: position.x, y: position.y }
    }
  }

  return {
    nodes,
    isHydrated,
    nodeById,
    edges,
    nodeDisplayById,
    hydrate,
    insertNodes,
    updateNodePositions,
  }
})
