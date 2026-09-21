<script setup>
defineProps({
  title: { type: String, required: true },
  message: { type: String, default: '' },
  tone: {
    type: String,
    default: 'neutral',
    validator: (value) => ['neutral', 'error'].includes(value),
  },
})
</script>

<template>
  <div
    class="flex max-w-sm flex-col items-center gap-2 text-center"
    :role="tone === 'error' ? 'alert' : undefined"
  >
    <h2
      class="text-base font-semibold"
      :class="tone === 'error' ? 'text-red-700' : 'text-slate-800'"
    >
      {{ title }}
    </h2>
    <p v-if="message" class="text-sm text-slate-600">{{ message }}</p>
    <div v-if="$slots.actions" class="mt-2 flex gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
