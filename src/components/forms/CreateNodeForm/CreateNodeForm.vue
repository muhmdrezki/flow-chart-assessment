<script setup>
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import BaseInput from '@/components/ui/BaseInput/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea/BaseTextarea.vue'
import FormField from '@/components/ui/FormField/FormField.vue'
import { CREATABLE_KINDS, NODE_REGISTRY } from '@/utils/nodeRegistry'
import { DESCRIPTION_MAX_LENGTH, validateCreateNode } from '@/utils/validation'

const props = defineProps({
  /**
   * The form's id. The drawer's footer buttons sit outside the <form>, so they point at it with
   * their own `form` attribute, which is what a native submit button does.
   */
  id: { type: String, default: 'create-node-form' },
  /** Where the node can be added: `{ value, label }` per allowed step. */
  parents: { type: Array, required: true },
  /** True while the create is in flight: the form is locked and the button says so. */
  pending: { type: Boolean, default: false },
  /** Messages the API sent back, shown under their fields. */
  serverErrors: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['submit'])

const form = useTemplateRef('form')
const values = ref({ title: '', description: '', type: '', parentId: '' })
const touched = ref(new Set())
const submitted = ref(false)
/** What was sent last time, so a server message can be dropped as soon as its field changes. */
const sentValues = ref(null)

const typeOptions = CREATABLE_KINDS.map((kind) => ({
  value: kind,
  label: NODE_REGISTRY[kind].label,
}))

const clientErrors = computed(() =>
  validateCreateNode(values.value, {
    allowedParentIds: props.parents.map((parent) => parent.value),
  }),
)

/**
 * A field shows its message once the user has left it or tried to submit, so typing isn't
 * interrupted by errors about what hasn't been filled in yet. A message the API sent back wins,
 * until the user changes that field: it was about the value that was sent, not the current one.
 */
function errorFor(field) {
  const serverError = props.serverErrors[field]
  const unchangedSinceSent = sentValues.value?.[field] === values.value[field]
  if (serverError && unchangedSinceSent) return serverError

  const shouldShow = submitted.value || touched.value.has(field)
  return shouldShow ? (clientErrors.value[field] ?? '') : ''
}

const descriptionCount = computed(
  () => `${values.value.description.trim().length} / ${DESCRIPTION_MAX_LENGTH}`,
)

function markTouched(field) {
  touched.value = new Set(touched.value).add(field)
}

async function onSubmit() {
  submitted.value = true
  if (Object.keys(clientErrors.value).length) {
    // Put the cursor on the first thing that needs fixing.
    await nextTick()
    form.value?.querySelector('[aria-invalid="true"]')?.focus()
    return
  }

  sentValues.value = { ...values.value }
  emit('submit', { ...values.value })
}
</script>

<template>
  <form :id="id" ref="form" class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
    <FormField label="Title" required :error="errorFor('title')">
      <template #default="control">
        <BaseInput
          v-bind="control"
          v-model="values.title"
          placeholder="Welcome back message"
          :disabled="pending"
          @blur="markTouched('title')"
        />
      </template>
    </FormField>

    <FormField
      label="Description"
      required
      :hint="descriptionCount"
      :error="errorFor('description')"
    >
      <template #default="control">
        <BaseTextarea
          v-bind="control"
          v-model="values.description"
          placeholder="What this step does"
          :disabled="pending"
          @blur="markTouched('description')"
        />
      </template>
    </FormField>

    <FormField label="Type of node" required :error="errorFor('type')">
      <template #default="control">
        <BaseSelect
          v-bind="control"
          v-model="values.type"
          :options="typeOptions"
          placeholder="Choose a node type"
          :disabled="pending"
          @blur="markTouched('type')"
        />
      </template>
    </FormField>

    <FormField
      label="Add after"
      required
      hint="The new step is added after this one."
      :error="errorFor('parentId')"
    >
      <template #default="control">
        <BaseSelect
          v-bind="control"
          v-model="values.parentId"
          :options="parents"
          placeholder="Choose a step"
          :disabled="pending"
          @blur="markTouched('parentId')"
        />
      </template>
    </FormField>
  </form>
</template>
