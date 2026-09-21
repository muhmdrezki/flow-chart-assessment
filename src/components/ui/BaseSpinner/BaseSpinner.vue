<script>
const SIZE_CLASSES = {
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-10 border-[3px]',
}
</script>

<script setup>
defineProps({
  size: {
    type: String,
    default: 'md',
    validator: (value) => Object.hasOwn(SIZE_CLASSES, value),
  },
  /** Announced to screen readers. An empty label makes the spinner purely decorative. */
  label: { type: String, default: 'Loading' },
  /** Shows the label next to the spinner instead of keeping it screen-reader only. */
  showLabel: { type: Boolean, default: false },
})
</script>

<template>
  <span
    class="inline-flex items-center gap-3"
    :role="label ? 'status' : undefined"
    :aria-hidden="label ? undefined : 'true'"
  >
    <span
      class="animate-spin rounded-full border-current border-t-transparent"
      :class="SIZE_CLASSES[size]"
      aria-hidden="true"
    />
    <span v-if="label" :class="showLabel ? 'text-sm text-slate-600' : 'sr-only'">{{ label }}</span>
  </span>
</template>
