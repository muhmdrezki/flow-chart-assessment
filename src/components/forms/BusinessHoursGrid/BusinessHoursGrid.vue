<script setup>
import { computed, onBeforeUnmount, onMounted, useId, useTemplateRef } from 'vue'
// A named export since v14, not a default one.
import { VueDatePicker } from '@vuepic/vue-datepicker'
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox/BaseCheckbox.vue'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import BaseSelect from '@/components/ui/BaseSelect/BaseSelect.vue'
import FormField from '@/components/ui/FormField/FormField.vue'
import { DAY_LABELS, WEEK_DAYS, fromClockParts, toClockParts } from '@/utils/businessHours'
import { getTimezoneOptions } from '@/utils/timezones'

/** The week, as the mockup draws it: a row per day, each with an open switch and two times. */
const days = defineModel('days', { type: Array, required: true })
const timezone = defineModel('timezone', { type: String, required: true })

const props = defineProps({
  /** Messages keyed "times.<day>", plus "days" for the week as a whole. */
  errors: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
})

const rowId = useId()
const messageId = (day) => `${rowId}-${day}`

/*
 * Built once: there are some 400 zones, each needing its own Intl formatter to read its offset, so
 * rebuilding the list on every pick would re-render 400 options to change one.
 */
const knownZones = getTimezoneOptions()

/**
 * The node's own zone is added when this browser has never heard of it, so the select can never be
 * missing the value it is showing. That is the rare case; the common one reuses the list above,
 * unchanged and un-re-rendered.
 */
const timezoneOptions = computed(() =>
  knownZones.some((option) => option.value === timezone.value)
    ? knownZones
    : getTimezoneOptions({ include: [timezone.value] }),
)

/*
 * Everything about a picker that doesn't depend on the day, built once at module scope.
 *
 * A fresh object here would be a changed prop there: Vue compares what a component is handed by
 * identity, so rebuilding these inline would hand all fourteen pickers new `timeConfig`,
 * `inputAttrs` and `ariaLabels` on every render — and re-render all fourteen because one day's
 * start time changed. There are only two states an input can be in, so there are only two objects.
 */
const TIME_CONFIG = Object.freeze({ is24: true, minutesIncrement: 5 })
// A day is always open at some hour: emptying a field would leave nothing to save.
const INPUT_ATTRS = Object.freeze({ clearable: false })
// `state: false` marks the field; leaving it out is what a valid day wants.
const INPUT_ATTRS_INVALID = Object.freeze({ clearable: false, state: false })

/** "Monday opens at", "Monday closes at", … — a bare time field says nothing on its own. */
const FIELD_LABELS = Object.freeze(
  Object.fromEntries(
    WEEK_DAYS.map((day) => [
      day,
      {
        'opens at': Object.freeze({ input: `${DAY_LABELS[day]} opens at` }),
        'closes at': Object.freeze({ input: `${DAY_LABELS[day]} closes at` }),
      },
    ]),
  ),
)

/**
 * The picker, set up the same way for all fourteen fields.
 *
 * It works in `{ hours, minutes, seconds }` while the payload stores `HH:mm`, so the two are
 * translated at this boundary (`toClockParts` / `fromClockParts`). Nothing behind this component
 * knows a picker is involved: the draft, the validation and `data.times` are unchanged.
 *
 * The menu is teleported to the body so it isn't clipped by the drawer it opens inside.
 */
const pickerOptions = (day, action) => ({
  timePicker: true,
  autoApply: true,
  teleport: true,
  disabled: props.disabled || !day.isOpen,
  timeConfig: TIME_CONFIG,
  inputAttrs: props.errors[`times.${day.day}`] ? INPUT_ATTRS_INVALID : INPUT_ATTRS,
  ariaLabels: FIELD_LABELS[day.day][action],
})

const root = useTemplateRef('root')
const pickers = useTemplateRef('pickers')

/**
 * Opening and closing a time menu from the keyboard, which the picker leaves to the mouse.
 *
 * A field opens on a click and nothing else, so Enter and Space — the keys that stand for a click —
 * are given to it as one. Escape then belongs to the open menu rather than to the drawer around it:
 * the menu is teleported to the body, so the drawer never reads the key as its own and would either
 * close itself or do nothing while the menu stayed open.
 *
 * Both are captured on the way down, because the picker stops these keys at its input and the
 * drawer answers Escape on the way up.
 */
function handleKeys(event) {
  if (event.key === 'Escape') {
    // At most one field is expanded: opening a menu closes the one before it. The key is answered
    // wherever it came from, since by now focus is inside the menu and the menu is off in the body.
    const field = root.value?.querySelector('input[aria-expanded="true"]')
    if (!field) return

    event.stopPropagation()
    pickers.value.forEach((picker) => picker.closeMenu())
    // Focus is inside the menu, which has just been hidden around it, so it goes back to the field.
    field.focus()
    return
  }

  if (event.key !== 'Enter' && event.key !== ' ') return
  if (!root.value?.contains(event.target)) return

  const field = event.target.closest('input[aria-expanded="false"]')
  if (!field) return

  // Stopped as well as prevented: the picker answers Enter itself, by closing what we just opened.
  event.preventDefault()
  event.stopPropagation()
  field.click()
}

onMounted(() => document.addEventListener('keydown', handleKeys, true))
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeys, true))

/** Days are replaced rather than edited in place, so the parent's v-model hears every change. */
function setDay(index, patch) {
  days.value = days.value.map((day, position) => (position === index ? { ...day, ...patch } : day))
}

/** Most weeks are the same day seven times over; typing it seven times is nobody's idea of a form. */
function copyFirstDayToAll() {
  const [first] = days.value
  days.value = days.value.map((day) => ({
    ...day,
    isOpen: first.isOpen,
    startTime: first.startTime,
    endTime: first.endTime,
  }))
}
</script>

<template>
  <div ref="root" class="flex flex-col gap-4">
    <FormField label="Time zone" required :error="errors.timezone">
      <template #default="control">
        <BaseSelect
          v-bind="control"
          v-model="timezone"
          :options="timezoneOptions"
          :disabled="disabled"
        />
      </template>
    </FormField>

    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-3">
        <p class="text-[13px] font-semibold text-slate-600">Opening hours</p>
        <!-- Bordered, not a bare label: beside a heading, a ghost button reads as a second heading. -->
        <BaseButton variant="secondary" size="sm" :disabled="disabled" @click="copyFirstDayToAll">
          Copy Monday to every day
        </BaseButton>
      </div>

      <ul class="divide-y divide-slate-100 rounded-lg border border-slate-200">
        <li v-for="(day, index) in days" :key="day.day" class="px-3 py-2.5">
          <div class="flex items-center gap-2">
            <BaseCheckbox
              :model-value="day.isOpen"
              :label="DAY_LABELS[day.day]"
              label-hidden
              :disabled="disabled"
              :described-by="errors[`times.${day.day}`] ? messageId(day.day) : undefined"
              @update:model-value="setDay(index, { isOpen: $event })"
            />
            <span class="w-24 shrink-0 text-sm text-slate-600">{{ DAY_LABELS[day.day] }}</span>

            <VueDatePicker
              ref="pickers"
              v-bind="pickerOptions(day, 'opens at')"
              :model-value="toClockParts(day.startTime)"
              @update:model-value="setDay(index, { startTime: fromClockParts($event) })"
            >
              <!-- A clock, not the calendar the picker shows by default: these fields hold no date. -->
              <template #input-icon><BaseIcon name="clock" :size="14" /></template>
            </VueDatePicker>
            <span class="text-xs text-slate-400">to</span>
            <VueDatePicker
              ref="pickers"
              v-bind="pickerOptions(day, 'closes at')"
              :model-value="toClockParts(day.endTime)"
              @update:model-value="setDay(index, { endTime: fromClockParts($event) })"
            >
              <template #input-icon><BaseIcon name="clock" :size="14" /></template>
            </VueDatePicker>
          </div>

          <p
            v-if="errors[`times.${day.day}`]"
            :id="messageId(day.day)"
            class="mt-1 text-xs text-red-600"
          >
            {{ errors[`times.${day.day}`] }}
          </p>
        </li>
      </ul>

      <p v-if="errors.days" class="text-xs text-red-600">{{ errors.days }}</p>
    </div>
  </div>
</template>
