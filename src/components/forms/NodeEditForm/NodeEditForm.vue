<script setup>
import { computed } from 'vue'
import BusinessHoursGrid from '@/components/forms/BusinessHoursGrid/BusinessHoursGrid.vue'
import MessagePartsField from '@/components/forms/MessagePartsField/MessagePartsField.vue'
import BaseInput from '@/components/ui/BaseInput/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea/BaseTextarea.vue'
import FormField from '@/components/ui/FormField/FormField.vue'
import { DESCRIPTION_MAX_LENGTH } from '@/utils/validation'
import { NODE_KIND } from '@/utils/nodeKind'

/** The whole draft. Each field is replaced, never edited in place, so the parent hears about it. */
const draft = defineModel({ type: Object, required: true })

defineProps({
  /** The node kind being edited, which decides the fields below the common two. */
  kind: { type: String, required: true },
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

const descriptionCount = computed(
  () => `${description.value.trim().length} / ${DESCRIPTION_MAX_LENGTH}`,
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

    <MessagePartsField
      v-if="kind === NODE_KIND.SEND_MESSAGE"
      v-model="parts"
      :errors="errors"
      :disabled="disabled"
    />

    <!-- Not required: a step can be left without a comment, and the canvas says so. -->
    <FormField v-else-if="kind === NODE_KIND.ADD_COMMENT" label="Comment" :error="errors.comment">
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
