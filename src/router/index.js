import { createRouter, createWebHistory } from 'vue-router'
import FlowView from '@/views/FlowView/FlowView.vue'

export const routes = [
  // The node drawer is added as a child of this route in Spec 04, so the canvas stays mounted.
  { path: '/', name: 'flow', component: FlowView },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

/** A factory so tests can create a router with memory history. */
export function createAppRouter(history = createWebHistory(import.meta.env.BASE_URL)) {
  return createRouter({ history, routes })
}
