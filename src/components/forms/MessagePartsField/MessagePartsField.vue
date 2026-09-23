<script setup>
import { ref, useId, useTemplateRef } from 'vue'
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import BaseInput from '@/components/ui/BaseInput/BaseInput.vue'
import BaseLightbox from '@/components/ui/BaseLightbox/BaseLightbox.vue'
import BaseTextarea from '@/components/ui/BaseTextarea/BaseTextarea.vue'
import { getAttachmentLabel, isImageAttachment, readAttachment } from '@/utils/attachments'
import { createPart } from '@/utils/nodeEdit'

/** A message is a list of parts, sent in the order they appear. */
const parts = defineModel({ type: Array, required: true })

const props = defineProps({
  /** Messages keyed "parts.<index>", plus "parts" when there are none at all. */
  errors: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
})

const fieldId = useId()
const messageId = (index) => `${fieldId}-${index}`

const fileInput = useTemplateRef('fileInput')
const uploadError = ref('')
const preview = ref(null)

/**
 * An attachment shows as a tile once it has a value worth showing. It falls back to a text field
 * while it is empty — a link just added, with nothing typed into it yet — and when the value was
 * refused, so a mistyped address can be corrected rather than removed and added again.
 */
const isTile = (part, index) => Boolean(part.attachment) && !props.errors[`parts.${index}`]

/** Parts are replaced rather than edited in place, so the parent's v-model hears every change. */
function setPart(index, patch) {
  parts.value = parts.value.map((part, position) =>
    position === index ? { ...part, ...patch } : part,
  )
}

function addPart(type) {
  parts.value = [...parts.value, createPart(type)]
}

function removePart(index) {
  parts.value = parts.value.filter((_, position) => position !== index)
}

/**
 * Uploaded files join the message as attachments, beside whatever is already there. The file
 * becomes the value, because the payload stores an attachment as a URL and nothing else.
 */
async function onFilesChosen(event) {
  uploadError.value = ''
  const chosen = [...event.target.files]
  // Cleared straight away, so choosing the same file twice still counts as a change.
  event.target.value = ''

  const added = []
  for (const file of chosen) {
    try {
      added.push({ ...createPart('attachment'), attachment: await readAttachment(file) })
    } catch (error) {
      uploadError.value = error.message
    }
  }

  if (added.length) parts.value = [...parts.value, ...added]
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <p class="text-[13px] font-semibold text-slate-600">Message</p>

    <!-- Texts take a row of their own; attachment tiles sit side by side until one breaks the line,
         which keeps the parts in the order they are sent. -->
    <ul v-if="parts.length" class="flex flex-wrap items-start gap-3">
      <li
        v-for="(part, index) in parts"
        :key="part.key"
        :class="isTile(part, index) ? 'w-36' : 'flex w-full flex-col gap-1'"
      >
        <div v-if="part.type === 'text'" class="flex items-start gap-2">
          <BaseTextarea
            :model-value="part.text"
            :rows="3"
            :disabled="disabled"
            :invalid="Boolean(errors[`parts.${index}`])"
            :described-by="errors[`parts.${index}`] ? messageId(index) : undefined"
            :aria-label="`Message text ${index + 1}`"
            @update:model-value="setPart(index, { text: $event })"
          />
          <BaseButton
            variant="ghost"
            size="sm"
            :disabled="disabled"
            :aria-label="`Remove part ${index + 1}`"
            @click="removePart(index)"
          >
            <BaseIcon name="x" :size="16" />
          </BaseButton>
        </div>

        <!-- A tile: the picture itself, or a box saying what the file is. -->
        <div
          v-else-if="isTile(part, index)"
          class="overflow-hidden rounded-lg border border-slate-200 bg-white"
        >
          <button
            v-if="isImageAttachment(part.attachment)"
            type="button"
            class="block w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
            :aria-label="`Preview ${getAttachmentLabel(part.attachment)}`"
            @click="preview = part"
          >
            <img
              :src="part.attachment"
              :alt="getAttachmentLabel(part.attachment)"
              loading="lazy"
              class="aspect-square w-full bg-slate-50 object-cover"
            />
          </button>
          <span
            v-else
            class="grid aspect-square w-full place-items-center bg-slate-50 text-slate-400"
          >
            <BaseIcon name="paperclip" :size="24" />
          </span>

          <div class="flex items-center gap-1 border-t border-slate-200 py-1 pr-1 pl-2">
            <span class="min-w-0 flex-1 truncate text-xs text-slate-600">
              {{ getAttachmentLabel(part.attachment) }}
            </span>
            <BaseButton
              variant="ghost"
              size="sm"
              class="shrink-0 px-1"
              :disabled="disabled"
              :aria-label="`Remove part ${index + 1}`"
              @click="removePart(index)"
            >
              <BaseIcon name="x" :size="14" />
            </BaseButton>
          </div>
        </div>

        <!-- Nothing worth previewing yet, or the address was refused: let it be typed. -->
        <div v-else class="flex items-start gap-2">
          <BaseInput
            type="url"
            placeholder="https://…"
            :model-value="part.attachment"
            :disabled="disabled"
            :invalid="Boolean(errors[`parts.${index}`])"
            :described-by="errors[`parts.${index}`] ? messageId(index) : undefined"
            :aria-label="`Attachment link ${index + 1}`"
            @update:model-value="setPart(index, { attachment: $event })"
          />
          <BaseButton
            variant="ghost"
            size="sm"
            :disabled="disabled"
            :aria-label="`Remove part ${index + 1}`"
            @click="removePart(index)"
          >
            <BaseIcon name="x" :size="16" />
          </BaseButton>
        </div>

        <p v-if="errors[`parts.${index}`]" :id="messageId(index)" class="text-xs text-red-600">
          {{ errors[`parts.${index}`] }}
        </p>
      </li>
    </ul>

    <p v-if="errors.parts" class="text-xs text-red-600">{{ errors.parts }}</p>
    <p v-if="uploadError" role="alert" class="text-xs text-red-600">{{ uploadError }}</p>

    <div class="flex gap-2">
      <BaseButton variant="secondary" size="sm" :disabled="disabled" @click="addPart('text')">
        Add text
      </BaseButton>
      <BaseButton variant="secondary" size="sm" :disabled="disabled" @click="addPart('attachment')">
        Add link
      </BaseButton>
      <BaseButton variant="secondary" size="sm" :disabled="disabled" @click="fileInput?.click()">
        Upload file
      </BaseButton>

      <!-- Hidden, so the button above can carry the app's own styling and focus ring. -->
      <input
        ref="fileInput"
        type="file"
        multiple
        :disabled="disabled"
        class="hidden"
        aria-hidden="true"
        tabindex="-1"
        @change="onFilesChosen"
      />
    </div>

    <BaseLightbox
      :src="preview?.attachment ?? ''"
      :alt="preview ? getAttachmentLabel(preview.attachment) : ''"
      @close="preview = null"
    />
  </div>
</template>
