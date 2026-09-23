<script setup>
import { computed, ref, watch } from 'vue'
import BaseDrawer from '@/components/ui/BaseDrawer/BaseDrawer.vue'
import { getNodeTitle } from '@/utils/nodeDescription'
import { getNodeProperties } from '@/utils/nodeProperties'
import { getNodeConfig } from '@/utils/nodeRegistry'

const props = defineProps({
  /** The node the URL names, or null when nothing is selected. */
  node: { type: Object, default: null },
})

const emit = defineEmits(['close'])

/*
 * The panel takes 200ms to slide out, so it is still on screen after the selection is gone. It
 * keeps showing the node it had until a new one arrives, rather than emptying mid-animation.
 */
const shown = ref(props.node)
watch(
  () => props.node,
  (node) => {
    if (node) shown.value = node
  },
)

const config = computed(() => (shown.value ? getNodeConfig(shown.value) : null))
const title = computed(() => (shown.value ? getNodeTitle(shown.value) : ''))
const properties = computed(() => getNodeProperties(shown.value))

/*
 * The kind, under the node's name. A node that was never renamed is already called after its kind
 * ("Business Hours"), and the payload's own node is one of them, so the line is dropped rather than
 * printed twice.
 */
const kindLabel = computed(() => (config.value?.label === title.value ? '' : config.value?.label))
</script>

<template>
  <BaseDrawer
    :open="Boolean(node)"
    :title="title"
    :description="kindLabel"
    :icon="config?.icon"
    :modal="false"
    @close="emit('close')"
  >
    <dl class="space-y-5">
      <div v-for="(property, index) in properties" :key="`${property.kind}-${index}`">
        <dt class="text-xs font-semibold text-slate-500">{{ property.label }}</dt>

        <!-- Message text keeps the line breaks it was written with. -->
        <dd v-if="property.kind === 'text'" class="mt-1 text-sm whitespace-pre-line text-slate-800">
          {{ property.value }}
        </dd>

        <dd v-else-if="property.kind === 'flag'" class="mt-1 text-sm text-slate-800">
          {{ property.value ? 'Yes' : 'No' }}
        </dd>

        <dd v-else-if="property.kind === 'attachment'" class="mt-1">
          <a
            :href="property.url"
            target="_blank"
            rel="noopener"
            class="text-sm font-medium text-(--color-accent) underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40"
          >
            {{ property.name }}
          </a>
          <img
            v-if="property.isImage"
            :src="property.url"
            :alt="property.name"
            loading="lazy"
            class="mt-2 max-h-44 w-full rounded-lg border border-slate-200 object-cover"
          />
        </dd>

        <dd v-else-if="property.kind === 'schedule'" class="mt-1.5">
          <ul class="divide-y divide-slate-100 rounded-lg border border-slate-200">
            <li
              v-for="day in property.days"
              :key="day.day"
              class="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span class="text-slate-600">{{ day.label }}</span>
              <span v-if="day.startTime" class="font-medium text-slate-800">
                {{ day.startTime }} – {{ day.endTime }}
              </span>
              <span v-else class="text-slate-400">Closed</span>
            </li>
          </ul>
        </dd>
      </div>
    </dl>

    <!-- Outside the list: a description list takes only terms and definitions. -->
    <p v-if="!properties.length" class="text-sm text-slate-500">
      This step has nothing to show yet.
    </p>
  </BaseDrawer>
</template>
