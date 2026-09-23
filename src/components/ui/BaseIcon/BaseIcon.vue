<script>
import {
  CalendarClock,
  Check,
  CircleHelp,
  CirclePlus,
  MessageSquare,
  Paperclip,
  Plus,
  Redo2,
  Send,
  Undo2,
  X,
  Zap,
} from '@lucide/vue'

// Icons are referenced by name so that callers (and the pure node registry) don't import SVGs.
// Only these are bundled; add one here when a new name is needed.
const ICONS = {
  'calendar-clock': CalendarClock,
  check: Check,
  'circle-help': CircleHelp,
  'circle-plus': CirclePlus,
  'message-square': MessageSquare,
  paperclip: Paperclip,
  plus: Plus,
  redo: Redo2,
  send: Send,
  undo: Undo2,
  x: X,
  zap: Zap,
}
</script>

<script setup>
defineProps({
  name: {
    type: String,
    required: true,
    validator: (value) => Object.hasOwn(ICONS, value),
  },
  size: { type: Number, default: 16 },
  /** Gives the icon an accessible name. Without one it's decorative and hidden from screen readers. */
  label: { type: String, default: '' },
})
</script>

<template>
  <component
    :is="ICONS[name]"
    :size="size"
    :stroke-width="2"
    focusable="false"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  />
</template>
