<script setup>
import { computed, ref, watch } from 'vue'
import NodeEditForm from '@/components/forms/NodeEditForm/NodeEditForm.vue'
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import BaseDrawer from '@/components/ui/BaseDrawer/BaseDrawer.vue'
import { useUpdateNode } from '@/composables/useUpdateNode'
import { getNodeTitle } from '@/utils/nodeDescription'
import { fromDraft, isSameDraft, toDraft } from '@/utils/nodeEdit'
import { getNodeKind } from '@/utils/nodeKind'
import { getNodeConfig } from '@/utils/nodeRegistry'
import { validateNodeDraft } from '@/utils/validation'

const props = defineProps({
  /** The node the URL names, or null when nothing is selected. */
  node: { type: Object, default: null },
})

const emit = defineEmits(['close'])

const { save, isPending, error, fieldErrors, reset } = useUpdateNode()

/*
 * The panel takes 200ms to slide out, so it is still on screen after the selection is gone. It
 * keeps showing the node it had until a new one arrives, rather than emptying mid-animation.
 */
const shown = ref(props.node)

/** What the user is editing, and what they started from, so a save can be offered only if needed. */
const draft = ref(toDraft(props.node))
const saved = ref(toDraft(props.node))
const localErrors = ref({})
const isConfirmingDiscard = ref(false)

function load(node) {
  draft.value = toDraft(node)
  saved.value = toDraft(node)
  localErrors.value = {}
  isConfirmingDiscard.value = false
  reset()
}

watch(
  () => props.node,
  (node) => {
    if (!node) return
    shown.value = node
    /*
     * Switching nodes starts again from the new one. Unsaved changes are lost, and deliberately
     * not guarded: this panel leaves the canvas clickable on purpose (Spec 04, decision 4b), and
     * the only way to ask first would be to block the clicks that make that true.
     */
    load(node)
  },
)

const config = computed(() => (shown.value ? getNodeConfig(shown.value) : null))
const kind = computed(() => (shown.value ? getNodeKind(shown.value) : ''))
const title = computed(() => (shown.value ? getNodeTitle(shown.value) : ''))
const isDirty = computed(() => !isSameDraft(draft.value, saved.value))

/** What the form shows under its fields: what we checked, then what the server sent back. */
const errors = computed(() => ({ ...localErrors.value, ...fieldErrors.value }))

const formError = computed(() =>
  error.value && !Object.keys(fieldErrors.value).length
    ? 'Could not save the step. Try again.'
    : '',
)

async function onSave() {
  localErrors.value = validateNodeDraft(draft.value, kind.value)
  if (Object.keys(localErrors.value).length) return

  try {
    const node = await save(fromDraft(shown.value, draft.value))
    saved.value = toDraft(node)
  } catch {
    // The mutation holds the reason; the drawer stays open so the user keeps what they typed.
  }
}

/** Closing throws away unsaved work, so it says so first. */
function requestClose() {
  if (isDirty.value && !isConfirmingDiscard.value) {
    isConfirmingDiscard.value = true
    return
  }
  emit('close')
}
</script>

<template>
  <BaseDrawer
    :open="Boolean(node)"
    :title="title"
    :description="config?.purpose"
    :icon="config?.icon"
    :modal="false"
    :dismissible="!isPending"
    @close="requestClose"
  >
    <NodeEditForm
      v-if="shown"
      v-model="draft"
      :kind="kind"
      :event="shown.data?.type"
      :errors="errors"
      :disabled="isPending"
    />

    <template #footer>
      <p v-if="formError" role="alert" class="mr-auto self-center text-xs text-red-600">
        {{ formError }}
      </p>

      <template v-if="isConfirmingDiscard">
        <p class="mr-auto self-center text-xs text-slate-600">Discard your changes?</p>
        <BaseButton variant="secondary" size="sm" @click="isConfirmingDiscard = false">
          Keep editing
        </BaseButton>
        <BaseButton variant="danger" size="sm" @click="emit('close')">Discard</BaseButton>
      </template>

      <BaseButton v-else :disabled="!isDirty" :loading="isPending" size="sm" @click="onSave">
        Save changes
      </BaseButton>
    </template>
  </BaseDrawer>
</template>
