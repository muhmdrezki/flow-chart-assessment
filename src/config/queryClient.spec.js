import { describe, expect, it } from 'vitest'
import { queryClientConfig } from './queryClient'

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
