<script setup>
import { computed, useId } from 'vue'
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox/BaseCheckbox.vue'
import BaseInput from '@/components/ui/BaseInput/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect/BaseSelect.vue'
import FormField from '@/components/ui/FormField/FormField.vue'
import { DAY_LABELS } from '@/utils/businessHours'
import { getTimezoneOptions } from '@/utils/timezones'

/** The week, as the mockup draws it: a row per day, each with an open switch and two times. */
const days = defineModel('days', { type: Array, required: true })
const timezone = defineModel('timezone', { type: String, required: true })

defineProps({
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
  <div class="flex flex-col gap-4">
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
      <div class="flex items-baseline justify-between">
        <p class="text-[13px] font-semibold text-slate-600">Opening hours</p>
        <BaseButton variant="ghost" size="sm" :disabled="disabled" @click="copyFirstDayToAll">
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

            <BaseInput
              type="time"
              :model-value="day.startTime"
              :disabled="disabled || !day.isOpen"
              :invalid="Boolean(errors[`times.${day.day}`])"
              :aria-label="`${DAY_LABELS[day.day]} opens at`"
              @update:model-value="setDay(index, { startTime: $event })"
            />
            <span class="text-xs text-slate-400">to</span>
            <BaseInput
              type="time"
              :model-value="day.endTime"
              :disabled="disabled || !day.isOpen"
              :invalid="Boolean(errors[`times.${day.day}`])"
              :aria-label="`${DAY_LABELS[day.day]} closes at`"
              @update:model-value="setDay(index, { endTime: $event })"
            />
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
