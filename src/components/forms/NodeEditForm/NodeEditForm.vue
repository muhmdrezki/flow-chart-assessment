<script setup>
import { computed } from 'vue'
import BusinessHoursGrid from '@/components/forms/BusinessHoursGrid/BusinessHoursGrid.vue'
import MessagePartsField from '@/components/forms/MessagePartsField/MessagePartsField.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox/BaseCheckbox.vue'
import BaseInput from '@/components/ui/BaseInput/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea/BaseTextarea.vue'
import FormField from '@/components/ui/FormField/FormField.vue'
import { DESCRIPTION_MAX_LENGTH } from '@/utils/validation'
import { NODE_KIND } from '@/utils/nodeKind'
import { TRIGGER_EVENT_LABELS } from '@/utils/nodeRegistry'

/** The whole draft. Each field is replaced, never edited in place, so the parent hears about it. */
const draft = defineModel({ type: Object, required: true })

const props = defineProps({
  /** The node kind being edited, which decides the fields below the common two. */
  kind: { type: String, required: true },
  /** The trigger's event, shown but not editable: the payload defines exactly one. */
  event: { type: String, default: '' },
  errors: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
})

/** A writable view of one field, so `v-model` works without the form mutating its own prop. */
function field(name) {
  return computed({
    get: () => draft.value[name],
    set: (value) => {
      draft.value = { ...draft.value, [name]: value }
    },
  })
}

const title = field('title')
const description = field('description')
const comment = field('comment')
const parts = field('parts')
const days = field('days')
const timezone = field('timezone')
const oncePerContact = field('oncePerContact')

const descriptionCount = computed(
  () => `${description.value.trim().length} / ${DESCRIPTION_MAX_LENGTH}`,
)

const eventLabel = computed(() =>
  Object.hasOwn(TRIGGER_EVENT_LABELS, props.event)
    ? TRIGGER_EVENT_LABELS[props.event]
    : props.event,
)
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent>
    <FormField label="Title" required :error="errors.title">
      <template #default="control">
        <BaseInput v-bind="control" v-model="title" :disabled="disabled" />
      </template>
    </FormField>

    <FormField label="Description" :error="errors.description" :hint="descriptionCount">
      <template #default="control">
        <BaseTextarea v-bind="control" v-model="description" :rows="3" :disabled="disabled" />
      </template>
    </FormField>

    <template v-if="kind === NODE_KIND.TRIGGER">
      <div class="flex flex-col gap-1.5">
        <p class="text-[13px] font-semibold text-slate-600">Event</p>
        <!-- Read-only: the payload names one event, and a list of invented ones would be fiction. -->
        <p class="text-sm text-slate-800">{{ eventLabel }}</p>
      </div>

      <BaseCheckbox v-model="oncePerContact" label="Once per contact" :disabled="disabled" />
    </template>

    <MessagePartsField
      v-else-if="kind === NODE_KIND.SEND_MESSAGE"
      v-model="parts"
      :errors="errors"
      :disabled="disabled"
    />

    <FormField
      v-else-if="kind === NODE_KIND.ADD_COMMENT"
      label="Comment"
      required
      :error="errors.comment"
    >
      <template #default="control">
        <BaseTextarea v-bind="control" v-model="comment" :rows="4" :disabled="disabled" />
      </template>
    </FormField>

    <BusinessHoursGrid
      v-else-if="kind === NODE_KIND.BUSINESS_HOURS"
      v-model:days="days"
      v-model:timezone="timezone"
      :errors="errors"
      :disabled="disabled"
    />
  </form>
</template>
