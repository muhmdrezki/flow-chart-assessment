import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { deriveEdges, normalizePayload } from '@/utils/graph'
import { computeLayout } from '@/utils/layout'
import { getNodeDescription, getNodeTitle } from '@/utils/nodeDescription'
import { getNodeConfig, getNodeSize } from '@/utils/nodeRegistry'
import { getInsertShift, positionBelow, positionBranches, shiftSubtree } from '@/utils/placement'

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
    // Sizes come from the registry, so short branch pills sit closer than full cards.
    const positions = computeLayout(normalized, deriveEdges(normalized), { getNodeSize })
    nodes.value = normalized.map((node) => ({ ...node, position: positions.get(node.id) }))
    isHydrated.value = true
  }

  /**
   * Adds created nodes to the flow, after the mutation that made them succeeded.
   *
   * The new node goes one row below its parent. Whatever used to follow that parent is reattached
   * below the new node (its success branch for a condition) and moved down, so the flow still reads
   * as one line and nothing overlaps. The layout isn't re-run, so the user's own drags are kept.
   *
   * @param {import('@/utils/graph').RawNode[]} created  payload-shaped nodes from the API
   * @param {{ insertedId: string, continuationId: string }} placement
   */
  function insertNodes(created, { insertedId, continuationId }) {
    const normalized = normalizePayload(toRaw(created))
    const inserted = normalized.find((node) => node.id === insertedId)
    const continuation = normalized.find((node) => node.id === continuationId)
    if (!inserted) throw new Error(`Created nodes do not include the new node "${insertedId}"`)
    if (!continuation) {
      throw new Error(`Created nodes do not include the continuation "${continuationId}"`)
    }

    const parent = nodeById.value.get(inserted.parentId)
    if (!parent) throw new Error(`Cannot add a node after unknown node "${inserted.parentId}"`)
    if (!getNodeConfig(parent).canHaveChildren) {
      throw new Error(`Cannot add a node after "${parent.id}", which branches instead`)
    }

    const branches = normalized.filter((node) => node !== inserted)
    inserted.position = positionBelow(parent, inserted)
    positionBranches(inserted, branches).forEach((position, index) => {
      branches[index].position = position
    })

    // Whatever followed the parent now follows the new node (its success branch for a condition),
    // and moves by the space the insert added, so dragged branches keep their own offsets.
    const followers = nodes.value.filter((node) => node.parentId === parent.id)
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
      for (const follower of followers) {
        follower.parentId = continuationId
      }
    }

    nodes.value.push(...normalized)
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
