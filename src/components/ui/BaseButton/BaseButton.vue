<script>
const VARIANT_CLASSES = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600',
  ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-400',
}

const SIZE_CLASSES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
}
</script>

<script setup>
import BaseSpinner from '../BaseSpinner/BaseSpinner.vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => Object.hasOwn(VARIANT_CLASSES, value),
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => Object.hasOwn(SIZE_CLASSES, value),
  },
  /** Defaults to "button" so a button inside a form never submits it by accident. */
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

function onClick(event) {
  if (props.disabled || props.loading) return
  emit('click', event)
}
</script>

<template>
  <button
    :type="type"
    class="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    :class="[VARIANT_CLASSES[variant], SIZE_CLASSES[size]]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @click="onClick"
  >
    <BaseSpinner v-if="loading" size="sm" label="" />
    <slot />
  </button>
</template>
