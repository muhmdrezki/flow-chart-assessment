import { useMutation } from '@tanstack/vue-query'
import { computed, toRaw } from 'vue'
import { NodeValidationError, updateNode } from '@/api/flowApi'
import { useFlowStore } from '@/stores/flow'

/**
 * Saving an edited node: the request goes through Vue Query, and the store changes only once it has
 * succeeded, so a rejected change never reaches the canvas and the user keeps what they typed.
 *
 * @returns {{
 *   save: (node: import('@/utils/graph').FlowNode) => Promise<import('@/utils/graph').FlowNode>,
 *   isPending: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<Error|null>,
 *   fieldErrors: import('vue').ComputedRef<Record<string, string>>,
 *   reset: () => void,
 * }}
 */
export function useUpdateNode() {
  const store = useFlowStore()

  const { mutateAsync, isPending, error, reset } = useMutation({
    // The brief's client config sets networkMode only for queries. Saving never leaves the browser,
    // so it must run even when offline, instead of being paused until a connection returns.
    networkMode: 'always',
    mutationFn: (node) => updateNode(node, { nodes: toRaw(store.nodes) }),
    onSuccess: (saved) => store.replaceNode(saved),
  })

  /** Messages the form shows under its fields, when the save was rejected as invalid. */
  const fieldErrors = computed(() =>
    error.value instanceof NodeValidationError ? error.value.fieldErrors : {},
  )

  return { save: mutateAsync, isPending, error, fieldErrors, reset }
}
