<script setup>
import { useId } from 'vue'
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import BaseInput from '@/components/ui/BaseInput/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea/BaseTextarea.vue'
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
          <BaseInput
            v-else
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

    <div class="flex gap-2">
      <BaseButton variant="secondary" size="sm" :disabled="disabled" @click="addPart('text')">
        Add text
      </BaseButton>
      <BaseButton variant="secondary" size="sm" :disabled="disabled" @click="addPart('attachment')">
        Add attachment
      </BaseButton>
    </div>
  </div>
</template>
