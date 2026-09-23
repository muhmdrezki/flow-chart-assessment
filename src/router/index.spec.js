import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from './index'

/*
 * Two routes, and the second is the drawer: /node/:id is the same page with one step selected.
 * Deliberately not a child route with its own component — the panel has to outlive the navigation
 * so it can animate out, and the selection is read from the route rather than rebuilt from it.
 */
describe('router', () => {
  it('serves the flow view at the root', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/')

    expect(router.currentRoute.value.name).toBe('flow')
  })

  it('serves a node URL with the id as a parameter', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/node/b6a0c1')

    expect(router.currentRoute.value.name).toBe('node')
    expect(router.currentRoute.value.params.id).toBe('b6a0c1')
  })

  it('keeps the same page on both routes, so the canvas survives opening a node', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/')
    const [flow] = router.currentRoute.value.matched
    await router.push('/node/b6a0c1')
    const [node] = router.currentRoute.value.matched

    expect(node.components.default).toBe(flow.components.default)
  })

  it.each(['/foo', '/foo/bar', '/node'])('redirects unknown path %s to the root', async (path) => {
    const router = createAppRouter(createMemoryHistory())
    await router.push(path)

    expect(router.currentRoute.value.fullPath).toBe('/')
  })
})
