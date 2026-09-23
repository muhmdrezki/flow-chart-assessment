<script setup>
import { computed, nextTick } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import ConnectorNode from '@/components/nodes/ConnectorNode/ConnectorNode.vue'
import NodeCard from '@/components/nodes/NodeCard/NodeCard.vue'
import { useFlowStore } from '@/stores/flow'
import { getNodeSize } from '@/utils/nodeRegistry'
import { toVueFlowEdges, toVueFlowNodes } from '@/utils/vueFlowAdapter'

const store = useFlowStore()

// Calling this here (above <VueFlow>) provides the same flow instance to the canvas below, so the
// viewport can be moved from this component.
const { setCenter, getViewport } = useVueFlow()

const CENTRE_DURATION_MS = 400

/**
 * Moves the viewport to a node, keeping the current zoom. Used after creating one, so the user sees
 * where it landed.
 * @param {string} id
 */
async function focusNode(id) {
  await nextTick()
  const node = store.nodeById.get(id)
  if (!node) return

  const { width, height } = getNodeSize(node)
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  setCenter(node.position.x + width / 2, node.position.y + height / 2, {
    zoom: getViewport().zoom,
    duration: reduceMotion ? 0 : CENTRE_DURATION_MS,
  })
}

defineExpose({ focusNode })

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
