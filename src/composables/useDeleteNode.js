import { useMutation } from '@tanstack/vue-query'
import { toRaw } from 'vue'
import { deleteNode } from '@/api/flowApi'
import { useFlowStore } from '@/stores/flow'

/**
 * Deleting a node, and whatever the rules say goes with it. Like every other write, the store
 * changes only once the request has succeeded.
 *
 * @returns {{
 *   remove: (id: string) => Promise<import('@/utils/nodeRemoval').Removal>,
 *   isPending: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<Error|null>,
 *   reset: () => void,
 * }}
 */
export function useDeleteNode() {
  const store = useFlowStore()

  const { mutateAsync, isPending, error, reset } = useMutation({
    // Deleting never leaves the browser either, so it runs offline rather than waiting for a line.
    networkMode: 'always',
    mutationFn: (id) => deleteNode(id, { nodes: toRaw(store.nodes) }),
    onSuccess: (removal) => store.removeNodes(removal),
  })

  return { remove: mutateAsync, isPending, error, reset }
}
