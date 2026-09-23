<script setup>
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@vue-flow/core'
import AddStepButton from '@/components/canvas/AddStepButton/AddStepButton.vue'

/**
 * The line between two steps, with the "+" that adds one at that point, as the mockup draws it.
 * Vue Flow works out where the two ends are and hands them to a custom edge; the shape and
 * anything drawn along it are ours.
 */
const props = defineProps({
  id: { type: String, required: true },
  /** The step above the line. Adding here means adding after it, which pushes this branch down. */
  source: { type: String, required: true },
  sourceX: { type: Number, required: true },
  sourceY: { type: Number, required: true },
  targetX: { type: Number, required: true },
  targetY: { type: Number, required: true },
  sourcePosition: { type: String, default: 'bottom' },
  targetPosition: { type: String, default: 'top' },
  /** From the adapter: `canInsert` and the source's `sourceTitle`, to name the button. */
  data: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['insert'])

/** `[path, labelX, labelY]` — the curve, and the point along it to put the button on. */
const curve = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  }),
)
</script>

<template>
  <BaseEdge :id="id" :path="curve[0]" />

  <!--
    The button is HTML rather than SVG, so it goes in Vue Flow's label layer, which is drawn over
    the whole canvas and ignores the pointer — hence the point to sit on, and the button taking the
    pointer back for itself.
  -->
  <EdgeLabelRenderer v-if="data.canInsert">
    <AddStepButton
      :at="{ x: curve[1], y: curve[2] }"
      :title="data.sourceTitle"
      @add="emit('insert', source)"
    />
  </EdgeLabelRenderer>
</template>
