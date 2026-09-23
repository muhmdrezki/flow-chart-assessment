<script setup>
import { computed } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'

/**
 * The "+" that adds a step at a place on the canvas, as the mockup draws it. It sits in two
 * places — halfway along a line between two steps, and under a step with nothing after it yet —
 * which are the same button in the same clothes, so they are one component.
 *
 * `nodrag` and `nopan` are Vue Flow's own: without them a press on the button drags the step or
 * pans the canvas underneath. The click is stopped as well, so pressing it inside a card doesn't
 * also open that card's drawer.
 */
const props = defineProps({
  /** The step it would add after, to say so out loud. A bare "+" tells a screen reader nothing. */
  title: { type: String, default: '' },
  /**
   * A point on the canvas to sit on, for the one on a line. Left out, the button hangs under the
   * step it is rendered inside, which is where an open end wants it.
   */
  at: { type: Object, default: null },
})

defineEmits(['add'])

/**
 * The short line joining the button to the step above it, drawn as the edge below a step would be
 * but dashed: there is nothing there yet, and the "+" is the offer to put something there.
 */
const STUB =
  "before:absolute before:bottom-full before:left-1/2 before:h-4 before:w-0 before:-translate-x-1/2 before:border-l-2 before:border-dashed before:border-slate-300 before:content-['']"

const placement = computed(() =>
  props.at
    ? {
        class: 'absolute',
        // Half its own size back, so the point ends up at its middle rather than its corner.
        style: {
          transform: `translate(-50%, -50%) translate(${props.at.x}px, ${props.at.y}px)`,
        },
      }
    : { class: `absolute top-full left-1/2 mt-4 -translate-x-1/2 ${STUB}`, style: undefined },
)
</script>

<template>
  <button
    type="button"
    class="nodrag nopan pointer-events-auto grid size-5 cursor-pointer place-items-center rounded-full border border-slate-300 bg-white text-slate-400 transition-colors hover:border-(--color-accent) hover:text-(--color-accent) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40"
    :class="placement.class"
    :style="placement.style"
    :aria-label="title ? `Add a step after ${title}` : 'Add a step here'"
    @click.stop="$emit('add')"
  >
    <BaseIcon name="plus" :size="12" />
  </button>
</template>
