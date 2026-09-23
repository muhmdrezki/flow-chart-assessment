import { describe, expect, it } from 'vitest'
import { queryClientConfig } from './queryClient'

/*
 * The query client's defaults are fixed by the brief, so this suite exists to stop them drifting:
 * the flow is fetched once and never refetched behind the user's back, which is what makes the
 * store safe to treat as the newer truth.
 */
describe('queryClientConfig', () => {
  it('matches the configuration required by the brief exactly', () => {
    expect(queryClientConfig).toStrictEqual({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          networkMode: 'always',
          staleTime: Infinity,
          gcTime: 60 * 60 * 1000,
        },
      },
    })
  })
})
