<script setup>
import { ref, useTemplateRef } from 'vue'
import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'
import BaseIcon from '@/components/ui/BaseIcon/BaseIcon.vue'
import BaseSpinner from '@/components/ui/BaseSpinner/BaseSpinner.vue'
import EmptyState from '@/components/ui/EmptyState/EmptyState.vue'
import FlowCanvas from '@/components/canvas/FlowCanvas/FlowCanvas.vue'
import NodeDetailsDrawer from '@/components/drawer/NodeDetailsDrawer/NodeDetailsDrawer.vue'
import CreateNodeDrawer from '@/components/forms/CreateNodeDrawer/CreateNodeDrawer.vue'
import { useFlowLoader } from '@/composables/useFlowLoader'
import { useSelectedNode } from '@/composables/useSelectedNode'
import { useFlowStore } from '@/stores/flow'

const store = useFlowStore()
const { isPending, isError, isFetching, error, refetch } = useFlowLoader()
const { selectedNode, select, close } = useSelectedNode()

const canvas = useTemplateRef('canvas')
const isCreateOpen = ref(false)

/**
 * One panel at a time. The details drawer leaves the page usable, so the header button is still
 * live while it's open; the create form is modal, and two panels stacked on each other would leave
 * the one underneath visible but frozen.
 */
function openCreate() {
  close()
  isCreateOpen.value = true
}

/** The canvas moves to the new node, so the user sees where it was added. */
function onCreated(nodeId) {
  canvas.value?.focusNode(nodeId)
}
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-50 text-slate-900">
    <header
      class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4"
    >
      <h1 class="text-base font-semibold">Flow Builder</h1>

      <BaseButton v-if="store.isHydrated" size="sm" @click="openCreate">
        <BaseIcon name="plus" :size="16" />
        Create New Node
      </BaseButton>
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

      <FlowCanvas
        v-else-if="store.isHydrated"
        ref="canvas"
        :selected-id="selectedNode?.id ?? null"
        @select="select"
        @deselect="close"
      />

      <!-- The query succeeded but the store couldn't take the data: never show a blank canvas. -->
      <div v-else class="grid h-full place-items-center p-6">
        <EmptyState
          tone="error"
          title="Couldn't display the flow"
          message="The flow data loaded but couldn't be read."
        />
      </div>

      <CreateNodeDrawer :open="isCreateOpen" @close="isCreateOpen = false" @created="onCreated" />

      <!-- Driven by the route: /node/:id renders this same view with one node selected. -->
      <NodeDetailsDrawer :node="selectedNode" @close="close" />
    </main>
  </div>
</template>
