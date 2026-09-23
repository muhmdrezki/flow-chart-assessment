<script setup>
import { ref, useId, useTemplateRef } from 'vue'
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import BaseInput from '@/components/ui/BaseInput/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea/BaseTextarea.vue'
import {
  getAttachmentLabel,
  isImageAttachment,
  isUploaded,
  readAttachment,
} from '@/utils/attachments'
import { createPart } from '@/utils/nodeEdit'

/** A message is a list of parts, sent in the order they appear. */
const parts = defineModel({ type: Array, required: true })

defineProps({
  /** Messages keyed "parts.<index>", plus "parts" when there are none at all. */
  errors: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
})

const fieldId = useId()
const messageId = (index) => `${fieldId}-${index}`

const fileInput = useTemplateRef('fileInput')
const uploadError = ref('')

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

    <ul v-if="parts.length" class="flex flex-col gap-3">
      <li v-for="(part, index) in parts" :key="part.key" class="flex flex-col gap-1">
        <div class="flex items-start gap-2">
          <BaseTextarea
            v-if="part.type === 'text'"
            :model-value="part.text"
            :rows="3"
            :disabled="disabled"
            :invalid="Boolean(errors[`parts.${index}`])"
            :described-by="errors[`parts.${index}`] ? messageId(index) : undefined"
            :aria-label="`Message text ${index + 1}`"
            @update:model-value="setPart(index, { text: $event })"
          />

          <!-- An attachment shows what it is: the picture itself, or a box naming the file. -->
          <div v-else class="flex min-w-0 flex-1 flex-col gap-2">
            <div class="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
              <img
                v-if="isImageAttachment(part.attachment)"
                :src="part.attachment"
                :alt="getAttachmentLabel(part.attachment)"
                loading="lazy"
                class="size-14 shrink-0 rounded-md border border-slate-200 object-cover"
              />
              <span
                v-else
                class="grid size-14 shrink-0 place-items-center rounded-md border border-slate-200 bg-slate-50 text-slate-400"
              >
                <BaseIcon name="paperclip" :size="18" />
              </span>

              <p class="min-w-0 truncate text-sm text-slate-700">
                {{ getAttachmentLabel(part.attachment) }}
              </p>
            </div>

            <!-- A link stays editable; an uploaded file has no address worth showing. -->
            <BaseInput
              v-if="!isUploaded(part.attachment)"
              type="url"
              placeholder="https://…"
              :model-value="part.attachment"
              :disabled="disabled"
              :invalid="Boolean(errors[`parts.${index}`])"
              :described-by="errors[`parts.${index}`] ? messageId(index) : undefined"
              :aria-label="`Attachment link ${index + 1}`"
              @update:model-value="setPart(index, { attachment: $event })"
            />
          </div>

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
        class="hidden"
        aria-hidden="true"
        tabindex="-1"
        @change="onFilesChosen"
      />
    </div>
  </div>
</template>
