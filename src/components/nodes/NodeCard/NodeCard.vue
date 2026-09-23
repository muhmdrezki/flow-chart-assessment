<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import { NODE_REGISTRY } from '@/utils/nodeRegistry'

const props = defineProps({
  /** The node kind, which is what the adapter passes to Vue Flow as the node type. */
  type: { type: String, required: true },
  /** Display text, derived once in the store's display map. */
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

const emit = defineEmits(['activate'])

const config = computed(() => NODE_REGISTRY[props.type] ?? NODE_REGISTRY.unknown)

/**
 * The card is a toggle: it opens its drawer, and opening the one that's already open closes it.
 * Pointer clicks arrive through Vue Flow, which owns dragging, so only the keyboard is handled
 * here. Space is prevented, or the canvas would scroll under the user.
 */
function onKeydown(event) {
  if (!config.value.hasDetails) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  emit('activate')
}
</script>

<template>
  <div
    class="flex h-[88px] w-[240px] flex-col gap-1.5 rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-shadow duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
    :class="[
      selected ? 'border-(--accent) ring-2 ring-(--accent)/20' : 'border-slate-200',
      config.hasDetails ? 'cursor-pointer hover:shadow-md' : 'cursor-default',
    ]"
    :style="{ '--accent': `var(${config.accent})` }"
    :role="config.hasDetails ? 'button' : undefined"
    :tabindex="config.hasDetails ? 0 : undefined"
    :aria-pressed="config.hasDetails ? selected : undefined"
    :data-kind="type"
    :data-has-details="config.hasDetails"
    @keydown="onKeydown"
  >
    <Handle v-if="config.hasInput" type="target" :position="Position.Top" />

    <div class="flex min-w-0 items-center gap-2">
      <span
        class="grid size-6 shrink-0 place-items-center rounded-md bg-(--accent)/10 text-(--accent)"
      >
        <BaseIcon :name="config.icon" :size="14" />
      </span>
      <p class="truncate text-sm font-semibold text-slate-800">{{ data.title }}</p>
    </div>

    <p
      v-if="data.description"
      class="line-clamp-2 text-xs leading-snug text-slate-500"
      :title="data.description"
    >
      {{ data.description }}
    </p>

    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>
