<script setup>
import { computed } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { nodeTypes } from '@/components/nodes/nodeTypes'
import { useFlowStore } from '@/stores/flow'
import { toVueFlowEdges, toVueFlowNodes } from '@/utils/vueFlowAdapter'

const store = useFlowStore()

const nodes = computed(() => toVueFlowNodes(store.nodes, store.nodeDisplayById))
const edges = computed(() => toVueFlowEdges(store.edges, store.nodeById))

// Vue Flow moves nodes itself while dragging; the store is updated once, when the drag ends.
function onNodeDragStop({ nodes: draggedNodes }) {
  store.updateNodePositions(draggedNodes.map(({ id, position }) => ({ id, position })))
}
</script>

<template>
  <!-- Connecting and key-deleting are off: graph changes go through the store's mutations only. -->
  <VueFlow
    :nodes="nodes"
    :edges="edges"
    :node-types="nodeTypes"
    fit-view-on-init
    :nodes-connectable="false"
    :delete-key-code="null"
    :min-zoom="0.2"
    :max-zoom="2"
    class="h-full w-full"
    @node-drag-stop="onNodeDragStop"
  >
    <Background :gap="16" />
    <Controls :show-interactive="false" />
  </VueFlow>
</template>
