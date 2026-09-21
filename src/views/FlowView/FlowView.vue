<script setup>
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import BaseSpinner from '@/components/ui/BaseSpinner/BaseSpinner.vue'
import EmptyState from '@/components/ui/EmptyState/EmptyState.vue'
import FlowCanvas from '@/components/canvas/FlowCanvas/FlowCanvas.vue'
import { useFlowLoader } from '@/composables/useFlowLoader'
import { useFlowStore } from '@/stores/flow'

const store = useFlowStore()
const { isPending, isError, isFetching, error, refetch } = useFlowLoader()
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-50 text-slate-900">
    <header class="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4">
      <h1 class="text-base font-semibold">Flow Builder</h1>
    </header>

    <main class="relative min-h-0 flex-1">
      <div v-if="isPending" class="grid h-full place-items-center">
        <BaseSpinner size="lg" label="Loading flow…" show-label />
      </div>

      <div v-else-if="isError" class="grid h-full place-items-center p-6">
        <EmptyState tone="error" title="Couldn't load the flow" :message="error?.message">
          <template #actions>
            <!-- Arrow function: refetch's first argument is options, not the click event. -->
            <BaseButton :loading="isFetching" @click="() => refetch()">Retry</BaseButton>
          </template>
        </EmptyState>
      </div>

      <FlowCanvas v-else-if="store.isHydrated" />

      <!-- The query succeeded but the store couldn't take the data: never show a blank canvas. -->
      <div v-else class="grid h-full place-items-center p-6">
        <EmptyState
          tone="error"
          title="Couldn't display the flow"
          message="The flow data loaded but couldn't be read."
        />
      </div>

      <!-- Spec 04: the node drawer renders here as a child route. -->
      <RouterView />
    </main>
  </div>
</template>
