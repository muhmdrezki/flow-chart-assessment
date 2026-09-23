<script setup>
const model = defineModel({ type: Boolean, default: false })

defineProps({
  /** The text beside the box. It labels the input, so it is never decoration. */
  label: { type: String, required: true },
  /** Hides the text, for a box in a row that is already headed (a day in a week, say). */
  labelHidden: { type: Boolean, default: false },
  describedBy: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
})
</script>

<template>
  <!-- Wrapping the input labels it, and makes the text part of what you can click. -->
  <label
    class="inline-flex items-center gap-2 text-sm text-slate-700"
    :class="disabled ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer'"
  >
    <input
      v-model="model"
      type="checkbox"
      :disabled="disabled"
      :aria-describedby="describedBy"
      class="size-4 shrink-0 accent-(--color-accent) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40 disabled:cursor-not-allowed"
    />
    <span :class="{ 'sr-only': labelHidden }">{{ label }}</span>
  </label>
</template>
