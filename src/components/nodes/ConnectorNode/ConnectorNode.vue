<script setup>
// A branch label (success/failure) drawn as a pill on the branch line. It's display-only, so it has
// no pointer cursor or hover state.
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import { NODE_REGISTRY } from '@/utils/nodeRegistry'

const props = defineProps({
  type: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

const config = computed(() => NODE_REGISTRY[props.type] ?? NODE_REGISTRY.unknown)
</script>

<template>
  <div
    class="flex h-7 w-24 cursor-default items-center justify-center gap-1 rounded-full border bg-white text-xs font-semibold text-(--accent)"
    :class="selected ? 'border-(--accent) ring-2 ring-(--accent)/20' : 'border-(--accent)/40'"
    :style="{ '--accent': `var(${config.accent})` }"
    :data-kind="type"
    data-editable="false"
  >
    <Handle v-if="config.hasInput" type="target" :position="Position.Top" />
    <BaseIcon :name="config.icon" :size="12" />
    <span>{{ data.title }}</span>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>
