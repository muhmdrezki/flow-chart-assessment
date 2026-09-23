<script setup>
import { onScopeDispose, watch } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'

const props = defineProps({
  /** Empty means nothing to say; setting it shows the toast and starts its clock. */
  message: { type: String, default: '' },
  duration: { type: Number, default: 3000 },
})

const emit = defineEmits(['close'])

let timer

/*
 * The parent owns the message, so the toast asks to be cleared rather than hiding itself — one
 * place decides what is being said, and saying the same thing twice restarts the clock.
 */
watch(
  () => props.message,
  (message) => {
    clearTimeout(timer)
    if (message) timer = setTimeout(() => emit('close'), props.duration)
  },
  { immediate: true },
)

onScopeDispose(() => clearTimeout(timer))
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <!--
        `status`, not `alert`: this is confirmation, not a problem, so a screen reader mentions it
        when it next pauses instead of interrupting.

        Bottom left, but clear of the canvas's zoom controls, which are in that corner already.
      -->
      <p
        v-if="message"
        role="status"
        aria-live="polite"
        class="fixed bottom-4 left-14 z-50 flex items-center gap-2 rounded-lg bg-slate-900 py-2.5 pr-4 pl-3 text-sm font-medium text-white shadow-lg"
      >
        <BaseIcon name="check" :size="16" class="text-emerald-400" />
        {{ message }}
      </p>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 150ms ease-out,
    transform 150ms ease-out;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
