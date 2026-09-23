<script setup>
const model = defineModel({ type: String, default: '' })

defineProps({
  id: { type: String, default: undefined },
  rows: { type: Number, default: 3 },
  placeholder: { type: String, default: '' },
  required: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  describedBy: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
})
</script>

<template>
  <textarea
    :id="id"
    v-model="model"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :aria-invalid="invalid || undefined"
    :aria-describedby="describedBy"
    class="w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50"
    :class="
      invalid
        ? 'border-red-500 focus-visible:ring-red-500/30'
        : 'border-slate-300 focus-visible:border-(--color-accent) focus-visible:ring-(--color-accent)/25'
    "
  />
</template>
