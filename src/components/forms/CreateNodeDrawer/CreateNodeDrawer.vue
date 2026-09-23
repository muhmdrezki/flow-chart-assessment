<script setup>
import { computed, watch } from 'vue'
import CreateNodeForm from '@/components/forms/CreateNodeForm/CreateNodeForm.vue'
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import BaseDrawer from '@/components/ui/BaseDrawer/BaseDrawer.vue'
import { useCreateNode } from '@/composables/useCreateNode'
import { useFlowStore } from '@/stores/flow'
import { getNodeConfig } from '@/utils/nodeRegistry'
import { getAllowedParents } from '@/utils/validation'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** The step to add after, when the form was opened from a "+" on the canvas rather than a button. */
  afterId: { type: String, default: null },
})

const emit = defineEmits(['close', 'created'])

const FORM_ID = 'create-node-form'

const store = useFlowStore()
const { create, isPending, error, fieldErrors, reset } = useCreateNode()

const titleOf = (id) => store.nodeDisplayById.get(id)?.title ?? id

/**
 * Every step a node can be added after, named as it appears on the canvas. A branch is named after
 * the condition it belongs to ("Business Hours · Success"), because a flow with two conditions
 * would otherwise offer two identical "Success" entries.
 */
const parents = computed(() =>
  getAllowedParents(store.nodes).map((node) => {
    const isBranch = getNodeConfig(node).variant === 'pill'
    return {
      value: node.id,
      label: isBranch ? `${titleOf(node.parentId)} · ${titleOf(node.id)}` : titleOf(node.id),
    }
  }),
)

/** Anything that isn't about a single field: shown as one message above the buttons. */
const formError = computed(() =>
  error.value && !Object.keys(fieldErrors.value).length ? 'Could not add the node. Try again.' : '',
)

// A fresh form each time it opens: the fields are remounted, and last time's error is cleared.
watch(
  () => props.open,
  () => reset(),
)

async function onSubmit(values) {
  try {
    const insertedId = await create(values)
    emit('created', insertedId)
    emit('close')
  } catch {
    // Already reported through error/fieldErrors, which the form and the message above show.
  }
}
</script>

<template>
  <BaseDrawer
    :open="open"
    title="Create node"
    description="Add a step to the flow."
    icon="circle-plus"
    :dismissible="!isPending"
    @close="emit('close')"
  >
    <CreateNodeForm
      v-if="open"
      :id="FORM_ID"
      :parents="parents"
      :initial-parent-id="afterId"
      :pending="isPending"
      :server-errors="fieldErrors"
      @submit="onSubmit"
    />

    <template #footer>
      <p v-if="formError" class="mr-auto min-w-0 self-center text-sm text-red-600" role="alert">
        {{ formError }}
      </p>
      <BaseButton variant="secondary" :disabled="isPending" @click="emit('close')">
        Cancel
      </BaseButton>
      <BaseButton type="submit" :form="FORM_ID" :loading="isPending">Create node</BaseButton>
    </template>
  </BaseDrawer>
</template>
