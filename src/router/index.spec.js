import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from './index'

describe('router', () => {
  it('serves the flow view at the root', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/')

    expect(router.currentRoute.value.name).toBe('flow')
  })

  it.each(['/foo', '/foo/bar', '/node'])('redirects unknown path %s to the root', async (path) => {
    const router = createAppRouter(createMemoryHistory())
    await router.push(path)

    expect(router.currentRoute.value.fullPath).toBe('/')
  })
})
