import { createRouter, createWebHistory } from 'vue-router'
import FlowView from '@/views/FlowView/FlowView.vue'

export const routes = [
  { path: '/', name: 'flow', component: FlowView },
  /*
   * The drawer is the URL (Spec 04): `/node/:id` is the same page with one node selected, so it
   * renders the same component. Router View keeps the instance it already has when the component
   * doesn't change, which is what makes the canvas survive: the viewport, the zoom and any dragged
   * positions stay put, and the drawer slides in and out instead of the page being replaced.
   */
  { path: '/node/:id', name: 'node', component: FlowView },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

/** A factory so tests can create a router with memory history. */
export function createAppRouter(history = createWebHistory(import.meta.env.BASE_URL)) {
  return createRouter({ history, routes })
}
