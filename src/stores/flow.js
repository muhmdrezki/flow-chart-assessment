import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { deriveEdges, normalizePayload } from '@/utils/graph'
import { computeLayout } from '@/utils/layout'

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
   * Seeds the store from the raw payload. Runs once: later calls are ignored so cached query
   * data can never overwrite changes made in the app.
   * @param {import('@/utils/graph').RawNode[]} raw
   */
  function hydrate(raw) {
    if (isHydrated.value) return

    // Query data arrives as a reactive proxy, which structuredClone can't copy.
    const normalized = normalizePayload(toRaw(raw))
    const positions = computeLayout(normalized, deriveEdges(normalized))
    nodes.value = normalized.map((node) => ({ ...node, position: positions.get(node.id) }))
    isHydrated.value = true
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

  return { nodes, isHydrated, nodeById, edges, hydrate, updateNodePositions }
})
