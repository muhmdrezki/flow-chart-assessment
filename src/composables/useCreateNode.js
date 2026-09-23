import { useMutation } from '@tanstack/vue-query'
import { computed, toRaw } from 'vue'
import { NodeValidationError, createNode } from '@/api/flowApi'
import { useFlowStore } from '@/stores/flow'

/**
 * Creating a node: the request goes through Vue Query, and the store changes only once it has
 * succeeded, so the canvas never shows a node the "server" rejected.
 *
 * This is the shape all three writes share, and it is the whole of the Query-to-Pinia boundary:
 * `mutationFn` sends, `onSuccess` commits. Query owns what is in flight — pending, the error, the
 * retry policy — and the store owns what is true. Nothing here writes optimistically.
 *
 * Optimistic updates would be the wrong trade here even though they look faster: this flow is a
 * document being edited, so a rollback would have to put back positions and parent links that other
 * changes may have touched in between — the same problem undo has, and undo needs a full snapshot
 * to solve it. Waiting for a simulated request costs a few hundred milliseconds and removes the
 * entire class of "it appeared, then vanished" states.
 *
 * The store is passed `toRaw(store.nodes)`: the API validates against the current flow and then
 * clones what it is given, and `structuredClone` refuses a reactive Proxy.
 *
 * @returns {{
 *   create: (values: object) => Promise<string>,
 *   isPending: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<Error|null>,
 *   fieldErrors: import('vue').ComputedRef<Record<string, string>>,
 *   reset: () => void,
 * }}
 */
export function useCreateNode() {
  const store = useFlowStore()

  const { mutateAsync, isPending, error, reset } = useMutation({
    // The brief's client config sets networkMode only for queries. Creating a node never leaves the
    // browser, so it must run even when offline, instead of being paused until a connection returns.
    networkMode: 'always',
    mutationFn: (values) => createNode(values, { nodes: toRaw(store.nodes) }),
    onSuccess: ({ nodes, insertedId, continuationId }) =>
      store.insertNodes(nodes, { insertedId, continuationId }),
  })

  /** Messages the form shows under its fields, when the create was rejected as invalid. */
  const fieldErrors = computed(() =>
    error.value instanceof NodeValidationError ? error.value.fieldErrors : {},
  )

  /** Resolves with the new node's id (the canvas centres on it); rejects so the form can react. */
  async function create(values) {
    const { insertedId } = await mutateAsync(values)
    return insertedId
  }

  return { create, isPending, error, fieldErrors, reset }
}
