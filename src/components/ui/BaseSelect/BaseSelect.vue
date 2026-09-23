<script setup>
const model = defineModel({ type: String, default: '' })

/*
 * Passed on from the `<select>` inside. This component's root is the wrapper that draws the arrow,
 * and `blur` does not bubble — so a `@blur` written on `<BaseSelect>` would land on the wrapper and
 * never fire. Anything that wants to know when the field was left has to be handed it.
 */
const emit = defineEmits(['blur'])

defineProps({
  id: { type: String, default: undefined },
  /** `{ value, label }` pairs, in the order they should appear. */
  options: { type: Array, required: true },
  /** Shown as a disabled first option while nothing is chosen. */
  placeholder: { type: String, default: 'Choose one' },
  required: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  describedBy: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
})
</script>

<template>
  <div class="relative">
    <select
      :id="id"
      v-model="model"
      :disabled="disabled"
      :required="required"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedBy"
      class="h-10 w-full appearance-none rounded-lg border bg-white pr-9 pl-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50"
      :class="[
        model ? 'text-slate-900' : 'text-slate-400',
        invalid
          ? 'border-red-500 focus-visible:ring-red-500/30'
          : 'border-slate-300 focus-visible:border-(--color-accent) focus-visible:ring-(--color-accent)/25',
      ]"
      @blur="emit('blur', $event)"
    >
      <option value="" disabled>{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>

    <!-- The native arrow can't be styled, so it's hidden above and drawn here. -->
    <svg
      class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>
