<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  required: { type: Boolean, default: false },
  /** Shown under the field when there's no error (e.g. a character count). */
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
})

// One id per field, shared by the label, the control and its message, so screen readers can
// connect them. The control gets them through the slot.
const id = useId()
const messageId = computed(() => `${id}-message`)

const control = computed(() => ({
  id,
  required: props.required,
  invalid: Boolean(props.error),
  describedBy: props.error || props.hint ? messageId.value : undefined,
}))
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-[13px] font-semibold text-slate-600">
      {{ label }}
      <span v-if="required" class="text-slate-400" aria-hidden="true">*</span>
    </label>

    <slot v-bind="control" />

    <p
      v-if="error || hint"
      :id="messageId"
      class="text-xs"
      :class="error ? 'text-red-600' : 'text-slate-500'"
    >
      {{ error || hint }}
    </p>
  </div>
</template>
