<script setup>
import { computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'

const props = defineProps({
  /** An icon name (see BaseIcon). */
  icon: { type: String, required: true },
  /**
   * What the button does, in words. Required, because an icon on its own says nothing to a screen
   * reader — and it doubles as the tooltip, for anyone unsure what the picture means.
   */
  label: { type: String, required: true },
  variant: { type: String, default: 'secondary' },
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false },
})

defineEmits(['click'])

/** The square sizes, so an icon doesn't sit in padding meant for words beside it. */
const buttonSize = computed(() => (props.size === 'sm' ? 'icon-sm' : 'icon'))
</script>

<template>
  <BaseButton
    :variant="variant"
    :size="buttonSize"
    :disabled="disabled"
    :aria-label="label"
    :title="label"
    @click="$emit('click', $event)"
  >
    <BaseIcon :name="icon" :size="16" />
  </BaseButton>
</template>
