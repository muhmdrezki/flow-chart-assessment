<script setup>
import { computed, onScopeDispose, ref, useId, watch } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  /** One line under the title, saying what this panel is for. */
  description: { type: String, default: '' },
  /** An icon name for the header (see BaseIcon). */
  icon: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const panel = ref(null)
const body = ref(null)
const titleId = useId()

const isOpen = computed(() => props.open)

useFocusTrap(panel, {
  active: isOpen,
  onEscape: () => emit('close'),
  // Opening lands on the first field, not on the close button that comes before it in the header.
  initialFocus: body,
})

/**
 * While the drawer is open, the rest of the page is `inert`: it can't be clicked, focused or read
 * by a screen reader's browse mode. Without it, `aria-modal` would promise something the markup
 * doesn't deliver. The drawer itself is teleported to the body, so it isn't affected.
 */
let inerted = []

function setBackgroundInert(isInert) {
  if (isInert) {
    inerted = [...document.body.children].filter((child) => !child.contains(panel.value))
  }
  for (const element of inerted) {
    element.inert = isInert
  }
  if (!isInert) inerted = []
}

watch(isOpen, async (open) => {
  await Promise.resolve()
  setBackgroundInert(open)
})

onScopeDispose(() => setBackgroundInert(false))
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="fixed inset-0 z-40 flex justify-end">
        <!-- A light scrim: the canvas stays visible behind the panel, but clicks go to the panel. -->
        <div class="absolute inset-0 bg-slate-900/10" @click="emit('close')" />

        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :aria-labelledby="titleId"
          class="drawer-panel relative flex h-full w-full max-w-100 flex-col border-l border-slate-200 bg-white shadow-xl"
        >
          <header class="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
            <span
              v-if="icon"
              class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"
            >
              <BaseIcon :name="icon" :size="16" />
            </span>

            <div class="min-w-0 flex-1">
              <h2 :id="titleId" class="text-lg font-bold text-slate-900">{{ title }}</h2>
              <p v-if="description" class="mt-0.5 text-sm text-slate-500">{{ description }}</p>
            </div>

            <button
              type="button"
              class="-m-1 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40"
              @click="emit('close')"
            >
              <BaseIcon name="x" :size="18" label="Close" />
            </button>
          </header>

          <div ref="body" class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <slot />
          </div>

          <footer
            v-if="$slots.footer"
            class="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* One piece of motion in the app: the panel sliding in. */
.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 200ms ease-out;
}

.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 200ms ease-out;
}

/* While it fades out, clicks belong to the canvas again, not to the disappearing scrim. */
.drawer-leave-active {
  pointer-events: none;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .drawer-enter-active,
  .drawer-leave-active,
  .drawer-enter-active .drawer-panel,
  .drawer-leave-active .drawer-panel {
    transition: none;
  }
}
</style>
