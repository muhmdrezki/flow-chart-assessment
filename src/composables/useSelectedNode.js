import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFlowStore } from '@/stores/flow'
import { hasDetails } from '@/utils/nodeRegistry'

/**
 * The selected node, read from the URL (Spec 04). There is no `isDrawerOpen` flag anywhere: the
 * drawer is open exactly when the route names a node that can be opened.
 *
 * **Why the URL and not a flag.** The brief wants the drawer reachable by a link containing the
 * node id, which makes the route the selection whether we like it or not. Keeping a boolean beside
 * it would mean two things to hold in step, and every bug in that class looks the same: the URL
 * says one node and the panel shows another. Deriving the node from the route means the panel
 * cannot disagree with the address bar, and Back and Forward step through the nodes visited for
 * free, because that is what navigating already does.
 *
 * `selectedNode` returning null is what closes the drawer — an unknown id, a display-only kind and
 * "no node selected" are all simply *not a node*, so the same expression covers the three cases and
 * the drawer only has to know about one of them.
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
    /*
     * `hasDetails` is the registry's answer, asked here rather than decided here. It is the same
     * answer the canvas uses to decide whether a card is clickable and in the tab order, so a URL
     * typed by hand cannot reach a drawer the canvas refuses to open — the rule is enforced at both
     * doors because it is written down in one place.
     */
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
