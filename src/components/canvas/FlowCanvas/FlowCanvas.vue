<script setup>
import { computed } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import ConnectorNode from '@/components/nodes/ConnectorNode/ConnectorNode.vue'
import NodeCard from '@/components/nodes/NodeCard/NodeCard.vue'
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
    fit-view-on-init
    :nodes-connectable="false"
    :delete-key-code="null"
    :min-zoom="0.2"
    :max-zoom="2"
    class="h-full w-full"
    @node-drag-stop="onNodeDragStop"
  >
    <!--
      One slot per node kind: Vue Flow renders the slot named "node-<type>" for each node and
      passes it the node's props. A new kind needs a registry entry and a slot here.
    -->

    <!-- Cards -->
    <template #node-trigger="{ type, data, selected }">
      <NodeCard :type="type" :data="data" :selected="selected" />
    </template>
    <template #node-sendMessage="{ type, data, selected }">
      <NodeCard :type="type" :data="data" :selected="selected" />
    </template>
    <template #node-addComment="{ type, data, selected }">
      <NodeCard :type="type" :data="data" :selected="selected" />
    </template>
    <template #node-businessHours="{ type, data, selected }">
      <NodeCard :type="type" :data="data" :selected="selected" />
    </template>
    <template #node-unknown="{ type, data, selected }">
      <NodeCard :type="type" :data="data" :selected="selected" />
    </template>

    <!-- Branch pills -->
    <template #node-success="{ type, data, selected }">
      <ConnectorNode :type="type" :data="data" :selected="selected" />
    </template>
    <template #node-failure="{ type, data, selected }">
      <ConnectorNode :type="type" :data="data" :selected="selected" />
    </template>

    <Background :gap="16" />
    <Controls :show-interactive="false" />
  </VueFlow>
</template>
