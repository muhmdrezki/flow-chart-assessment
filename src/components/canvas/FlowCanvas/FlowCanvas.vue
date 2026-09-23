<script setup>
import { computed, nextTick } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { ControlButton, Controls } from '@vue-flow/controls'
import AddStepButton from '@/components/canvas/AddStepButton/AddStepButton.vue'
import FlowEdge from '@/components/canvas/FlowEdge/FlowEdge.vue'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import ConnectorNode from '@/components/nodes/ConnectorNode/ConnectorNode.vue'
import NodeCard from '@/components/nodes/NodeCard/NodeCard.vue'
import { useFlowStore } from '@/stores/flow'
import { getNodeSize, hasDetails } from '@/utils/nodeRegistry'
import { getOpenEndIds, toVueFlowEdges, toVueFlowNodes } from '@/utils/vueFlowAdapter'

defineProps({
  /** The node the URL names, drawn with a ring. Selection lives in the route, not in Vue Flow. */
  selectedId: { type: String, default: null },
  /*
   * Undo and redo sit in the canvas's own control column, but the rule for when they are allowed
   * belongs to the view: it is the same rule the keyboard shortcuts use, and a rule stated twice
   * is a rule that drifts. So the canvas is told what to show and says when it was pressed.
   */
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  undoLabel: { type: String, default: '' },
  redoLabel: { type: String, default: '' },
})

const emit = defineEmits(['select', 'deselect', 'insert-after', 'undo', 'redo'])

const store = useFlowStore()

// Calling this here (above <VueFlow>) provides the same flow instance to the canvas below, so the
// viewport can be moved from this component.
const { setCenter, getViewport } = useVueFlow()

const CENTRE_DURATION_MS = 400

/*
 * How far the pointer may wander between press and release and still count as a click rather than
 * a drag. Vue Flow allows none at all on the pane and a single pixel on a node, so a hand that
 * moves while clicking pans the canvas or nudges the step instead — and the click that would have
 * opened or closed the drawer never arrives, because the drag swallows it.
 */
const CLICK_SLOP = 4

/**
 * Moves the viewport to a node, keeping the current zoom. Used after creating one, so the user sees
 * where it landed. Opening the drawer deliberately doesn't move the view (Spec 04, decision 4d).
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
const edges = computed(() => toVueFlowEdges(store.edges, store.nodeById, store.nodeDisplayById))

/*
 * The ends of the flow, each drawn with its own "+". A new Set every time the flow changes, but
 * what a node is handed is one boolean, so a step only re-renders when its own answer changes.
 */
const openEnds = computed(() => getOpenEndIds(store.nodes, store.edges))

/*
 * Vue Flow moves nodes itself while dragging; the store is updated once, when the drag ends, and
 * only for nodes that really moved. Dragging doesn't open a drawer by accident: d3-drag swallows
 * the click that ends a drag, so `node-click` only arrives when the pointer stayed put.
 */
function onNodeDragStop({ nodes: draggedNodes }) {
  const moved = draggedNodes.filter(({ id, position }) => {
    const current = store.nodeById.get(id)?.position
    return current && (current.x !== position.x || current.y !== position.y)
  })
  if (moved.length) store.updateNodePositions(moved.map(({ id, position }) => ({ id, position })))
}

function onNodeClick({ node }) {
  if (hasDetails(store.nodeById.get(node.id))) emit('select', node.id)
}
</script>

<template>
  <!-- Connecting and key-deleting are off: graph changes go through the store's mutations only.
       Vue Flow's own keyboard handling is off too, because each node card takes its own keys.
       Left on, it would also move a selected node with the arrow keys, writing positions Vue Flow
       keeps to itself and the store never hears about. -->
  <VueFlow
    :nodes="nodes"
    :edges="edges"
    fit-view-on-init
    :nodes-connectable="false"
    :nodes-focusable="false"
    :pane-click-distance="CLICK_SLOP"
    :node-drag-threshold="CLICK_SLOP"
    disable-keyboard-a11y
    :delete-key-code="null"
    :min-zoom="0.2"
    :max-zoom="2"
    class="h-full w-full"
    @node-click="onNodeClick"
    @node-drag-stop="onNodeDragStop"
    @pane-click="emit('deselect')"
  >
    <!--
      One slot per node kind: Vue Flow renders the slot named "node-<type>" for each node and
      passes it the node's props. A new kind needs a registry entry and a slot here.
    -->

    <!-- Cards -->
    <template #node-trigger="{ id, type, data }">
      <NodeCard
        :type="type"
        :data="data"
        :selected="id === selectedId"
        @activate="emit('select', id)"
      />
      <AddStepButton v-if="openEnds.has(id)" :title="data.title" @add="emit('insert-after', id)" />
    </template>
    <template #node-sendMessage="{ id, type, data }">
      <NodeCard
        :type="type"
        :data="data"
        :selected="id === selectedId"
        @activate="emit('select', id)"
      />
      <AddStepButton v-if="openEnds.has(id)" :title="data.title" @add="emit('insert-after', id)" />
    </template>
    <template #node-addComment="{ id, type, data }">
      <NodeCard
        :type="type"
        :data="data"
        :selected="id === selectedId"
        @activate="emit('select', id)"
      />
      <AddStepButton v-if="openEnds.has(id)" :title="data.title" @add="emit('insert-after', id)" />
    </template>
    <template #node-businessHours="{ id, type, data }">
      <NodeCard
        :type="type"
        :data="data"
        :selected="id === selectedId"
        @activate="emit('select', id)"
      />
      <AddStepButton v-if="openEnds.has(id)" :title="data.title" @add="emit('insert-after', id)" />
    </template>
    <template #node-unknown="{ id, type, data }">
      <NodeCard
        :type="type"
        :data="data"
        :selected="id === selectedId"
        @activate="emit('select', id)"
      />
      <AddStepButton v-if="openEnds.has(id)" :title="data.title" @add="emit('insert-after', id)" />
    </template>

    <!-- Branch pills -->
    <template #node-success="{ id, type, data }">
      <ConnectorNode :type="type" :data="data" />
      <AddStepButton v-if="openEnds.has(id)" :title="data.title" @add="emit('insert-after', id)" />
    </template>
    <template #node-failure="{ id, type, data }">
      <ConnectorNode :type="type" :data="data" />
      <AddStepButton v-if="openEnds.has(id)" :title="data.title" @add="emit('insert-after', id)" />
    </template>

    <!-- Every edge is ours, so each can carry the "+" that adds a step at that point. -->
    <template #edge-flow="edgeProps">
      <FlowEdge v-bind="edgeProps" @insert="emit('insert-after', $event)" />
    </template>

    <Background :gap="16" />

    <!--
      Taking a change back is a canvas action, so it sits in the canvas's own column, above the
      zoom buttons and built from the same `ControlButton` so the whole column reads as one thing.
    -->
    <Controls :show-interactive="false">
      <template #top>
        <ControlButton :title="undoLabel" :disabled="!canUndo" @click="emit('undo')">
          <BaseIcon name="undo" :size="12" :label="undoLabel" />
        </ControlButton>
        <ControlButton :title="redoLabel" :disabled="!canRedo" @click="emit('redo')">
          <BaseIcon name="redo" :size="12" :label="redoLabel" />
        </ControlButton>
      </template>
    </Controls>
  </VueFlow>
</template>
