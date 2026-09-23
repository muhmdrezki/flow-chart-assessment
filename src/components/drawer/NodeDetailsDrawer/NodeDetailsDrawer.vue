<script setup>
import { computed, ref, toRaw, watch } from 'vue'
import NodeEditForm from '@/components/forms/NodeEditForm/NodeEditForm.vue'
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import BaseDrawer from '@/components/ui/BaseDrawer/BaseDrawer.vue'
import { useDeleteNode } from '@/composables/useDeleteNode'
import { useUpdateNode } from '@/composables/useUpdateNode'
import { useFlowStore } from '@/stores/flow'
import { getNodeTitle } from '@/utils/nodeDescription'
import { fromDraft, isSameDraft, toDraft } from '@/utils/nodeEdit'
import { getNodeKind } from '@/utils/nodeKind'
import { countRemoved, getRemoval } from '@/utils/nodeRemoval'
import { getNodeConfig } from '@/utils/nodeRegistry'
import { validateNodeDraft } from '@/utils/validation'

const props = defineProps({
  /** The node the URL names, or null when nothing is selected. */
  node: { type: Object, default: null },
})

const emit = defineEmits(['close'])

const store = useFlowStore()
const { save, isPending, error, fieldErrors, reset } = useUpdateNode()
const { remove, isPending: isDeleting, error: deleteError, reset: resetDelete } = useDeleteNode()

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
const isConfirmingDelete = ref(false)

function load(node) {
  draft.value = toDraft(node)
  saved.value = toDraft(node)
  localErrors.value = {}
  isConfirmingDiscard.value = false
  isConfirmingDelete.value = false
  reset()
  resetDelete()
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

/*
 * Messages are about the values that were submitted, so editing clears them. It matters most for
 * the ones keyed by position — a message's parts are numbered, so removing one would otherwise
 * leave its message sitting under whichever part took its place.
 */
watch(draft, () => {
  if (Object.keys(localErrors.value).length) localErrors.value = {}
  if (error.value) reset()
  if (deleteError.value) resetDelete()
})

const config = computed(() => (shown.value ? getNodeConfig(shown.value) : null))
const kind = computed(() => (shown.value ? getNodeKind(shown.value) : ''))
const title = computed(() => (shown.value ? getNodeTitle(shown.value) : ''))
const isDirty = computed(() => !isSameDraft(draft.value, saved.value))

/** What the form shows under its fields: what we checked, then what the server sent back. */
const errors = computed(() => ({ ...localErrors.value, ...fieldErrors.value }))

const formError = computed(() => {
  if (deleteError.value) return 'Could not delete the step. Try again.'
  if (error.value && !Object.keys(fieldErrors.value).length) {
    return 'Could not save the step. Try again.'
  }
  return ''
})

/**
 * What deleting this step would take with it, spelled out before it happens. A plain step takes
 * nothing else; a condition takes both its branches and everything under them.
 */
const deleteWarning = computed(() => {
  if (!shown.value) return ''

  const removal = getRemoval(store.nodes, shown.value.id)
  if (!removal) return ''

  const { steps, branches } = countRemoved(store.nodes, removal)
  const alsoGoing = [
    branches ? 'both its branches' : '',
    steps ? `the ${steps} ${steps === 1 ? 'step' : 'steps'} under them` : '',
  ].filter(Boolean)

  return alsoGoing.length
    ? `Delete “${title.value}”, ${alsoGoing.join(' and ')}?`
    : `Delete “${title.value}”?`
})

async function onDelete() {
  if (!isConfirmingDelete.value) {
    isConfirmingDelete.value = true
    return
  }

  try {
    // Deleting the node makes its URL name something that is no longer there, and the selection
    // follows the flow: the drawer closes itself.
    await remove(shown.value.id)
  } catch {
    // The mutation holds the reason, and the footer says so.
  }
}

async function onSave() {
  localErrors.value = validateNodeDraft(draft.value, kind.value)
  if (Object.keys(localErrors.value).length) return

  try {
    /*
     * Built from the raw node, not the store's reactive one. `fromDraft` carries over the fields
     * it doesn't own — a business-hours node's `connectors`, say — and carrying over a reactive
     * array would hand a Proxy to the API, which `structuredClone` refuses to copy.
     */
    const node = await save(fromDraft(toRaw(shown.value), draft.value))
    saved.value = toDraft(node)
  } catch {
    // The mutation holds the reason; the drawer stays open so the user keeps what they typed.
  }
}

/** Backing out of a delete forgets that it failed, too: that message is no longer about anything. */
function keepStep() {
  isConfirmingDelete.value = false
  resetDelete()
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
    :dismissible="!isPending && !isDeleting"
    @close="requestClose"
  >
    <NodeEditForm
      v-if="shown"
      v-model="draft"
      :kind="kind"
      :event="shown.data?.type"
      :errors="errors"
      :disabled="isPending || isDeleting"
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

      <template v-else-if="isConfirmingDelete">
        <p class="mr-auto self-center text-xs text-slate-600">{{ deleteWarning }}</p>
        <BaseButton variant="secondary" size="sm" :disabled="isDeleting" @click="keepStep">
          Keep it
        </BaseButton>
        <BaseButton variant="danger" size="sm" :loading="isDeleting" @click="onDelete">
          Delete
        </BaseButton>
      </template>

      <template v-else>
        <BaseButton
          v-if="config?.deletable"
          variant="ghost"
          size="sm"
          class="mr-auto text-red-600 hover:bg-red-50"
          @click="onDelete"
        >
          Delete
        </BaseButton>

        <BaseButton :disabled="!isDirty" :loading="isPending" size="sm" @click="onSave">
          Save changes
        </BaseButton>
      </template>
    </template>
  </BaseDrawer>
</template>
