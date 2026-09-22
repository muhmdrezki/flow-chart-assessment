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

const config = computed(() => NODE_REGISTRY[props.type] ?? NODE_REGISTRY.unknown)
</script>

<template>
  <div
    class="flex h-[88px] w-[240px] flex-col gap-1.5 rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-shadow duration-150"
    :class="[
      selected ? 'border-(--accent) ring-2 ring-(--accent)/20' : 'border-slate-200',
      config.editable ? 'cursor-pointer hover:shadow-md' : 'cursor-default',
    ]"
    :style="{ '--accent': `var(${config.accent})` }"
    :data-kind="type"
    :data-editable="config.editable"
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
