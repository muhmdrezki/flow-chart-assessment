import { useQuery } from '@tanstack/vue-query'
import { watch } from 'vue'
import { fetchFlow, shouldRetryFlowFetch } from '@/api/flowApi'
import { flowKeys } from '@/api/queryKeys'
import { useFlowStore } from '@/stores/flow'

/**
 * Loads the payload through Vue Query and hands it to the store once. Callers get the request
 * status only, never the data: the store is where nodes are read from.
 *
 * Returning `isPending`/`isError`/`refetch` but not `data` is the point, not an omission — it is
 * how the one-way boundary is enforced rather than merely intended. A view can render a spinner or
 * a retry button from this, and cannot accidentally start reading nodes out of the query cache,
 * where they would be one edit out of date.
 *
 * `retry` is a function rather than a number because the two failures are different: a network
 * blip is worth retrying, while a payload that parses but isn't a flow will fail identically three
 * times and only delay the error the user needs to see.
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
