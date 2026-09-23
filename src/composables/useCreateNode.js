import { useMutation } from '@tanstack/vue-query'
import { computed, toRaw } from 'vue'
import { NodeValidationError, createNode } from '@/api/flowApi'
import { useFlowStore } from '@/stores/flow'

/**
 * Creating a node: the request goes through Vue Query, and the store changes only once it has
 * succeeded, so the canvas never shows a node the "server" rejected.
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
