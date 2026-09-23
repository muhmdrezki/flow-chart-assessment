<script setup>
import { computed, ref, useId } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = defineProps({
  /** The image to show full size. Empty means closed. */
  src: { type: String, default: '' },
  /** What the picture is, for anyone who can't see it. */
  alt: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const panel = ref(null)
const titleId = useId()
const isOpen = computed(() => Boolean(props.src))

/*
 * Modal, unlike the drawer it opens from: a picture at full size covers the page, so there is
 * nothing else to reach and Tab should stay inside it.
 */
useFocusTrap(panel, { active: isOpen, onEscape: () => emit('close') })
</script>

<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div
        v-if="src"
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        class="fixed inset-0 z-60 flex flex-col items-center justify-center gap-3 bg-slate-950/80 p-6"
        @click.self="emit('close')"
      >
        <img
          :src="src"
          :alt="alt"
          class="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
        />

        <p :id="titleId" class="max-w-full truncate text-sm text-slate-200">{{ alt }}</p>

        <button
          type="button"
          class="absolute top-4 right-4 rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          @click="emit('close')"
        >
          <BaseIcon name="x" :size="20" label="Close preview" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 150ms ease-out;
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .lightbox-enter-active,
  .lightbox-leave-active {
    transition: none;
  }
}
</style>
