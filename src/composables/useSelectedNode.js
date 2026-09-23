import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFlowStore } from '@/stores/flow'
import { hasDetails } from '@/utils/nodeRegistry'

/**
 * The selected node, read from the URL (Spec 04). There is no `isDrawerOpen` flag anywhere: the
 * drawer is open exactly when the route names a node that can be opened.
 *
 * @returns {{
 *   selectedNode: import('vue').ComputedRef<import('@/utils/graph').FlowNode | null>,
 *   select: (id: string) => void,
 *   close: () => void,
 * }}
 */
export function useSelectedNode() {
  const route = useRoute()
  const router = useRouter()
  const store = useFlowStore()

  const routeNodeId = computed(() => (route.name === 'node' ? String(route.params.id) : null))

  const selectedNode = computed(() => {
    if (!routeNodeId.value || !store.isHydrated) return null
    const node = store.nodeById.get(routeNodeId.value)
    return node && hasDetails(node) ? node : null
  })

  /*
   * A URL can name a node that was deleted, never existed, or is display-only. It can't be judged
   * until the flow has loaded, though: on a fresh tab the store is still empty while payload.json
   * is being fetched, and redirecting then would break every shared link. So the check waits for
   * the data, and replaces rather than pushes, so Back doesn't land on the bad URL again.
   */
  watch(
    // `selectedNode` is watched too, so a node that is deleted while open takes its URL with it.
    [routeNodeId, () => store.isHydrated, selectedNode],
    ([id, isHydrated]) => {
      if (id && isHydrated && !selectedNode.value) router.replace({ name: 'flow' })
    },
    { immediate: true },
  )

  /** Clicking the open node closes its drawer, which is the toggle the brief asks for. */
  function select(id) {
    if (id === selectedNode.value?.id) return close()
    router.push({ name: 'node', params: { id } })
  }

  function close() {
    if (routeNodeId.value) router.push({ name: 'flow' })
  }

  return { selectedNode, select, close }
}
