import { useQuery } from '@tanstack/vue-query'
import { watch } from 'vue'
import { fetchFlow, shouldRetryFlowFetch } from '@/api/flowApi'
import { flowKeys } from '@/api/queryKeys'
import { useFlowStore } from '@/stores/flow'

/**
 * Loads the payload through Vue Query and hands it to the store once. Callers get the request
 * status only, never the data: the store is where nodes are read from.
 */
export function useFlowLoader() {
  const store = useFlowStore()
  const { data, isPending, isError, isFetching, error, refetch } = useQuery({
    queryKey: flowKeys.all,
    queryFn: fetchFlow,
    retry: shouldRetryFlowFetch,
  })

  // When data shows up and the store doesn't have its data yet, give it to the store.
  // "Yet" matters: Query can hand back its cached copy later (e.g. on remount), and that must
  // never overwrite changes the user has made since. `immediate` covers data that is already
  // cached when this runs.
  watch(
    data,
    (raw) => {
      if (raw && !store.isHydrated) store.hydrate(raw)
    },
    { immediate: true },
  )

  return { isPending, isError, isFetching, error, refetch }
}
