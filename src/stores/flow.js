import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { deriveEdges, normalizePayload } from '@/utils/graph'
import { computeLayout } from '@/utils/layout'
import { getNodeDescription, getNodeTitle } from '@/utils/nodeDescription'
import { getNodeConfig, getNodeSize } from '@/utils/nodeRegistry'
import { getInsertShift, positionBelow, shiftSubtree } from '@/utils/placement'

/**
 * How many changes can be taken back. Deep enough that a session never reaches it, and small
 * enough to stay bounded: this flow is under 2 KB as JSON, so fifty of them is well under 100 KB.
 */
export const HISTORY_LIMIT = 50

/**
 * Single source of truth for the flow graph. Vue Query only loads the payload; once it's
 * hydrated here, nothing reads the query cache for nodes again.
 */
export const useFlowStore = defineStore('flow', () => {
  /** @type {import('vue').Ref<import('@/utils/graph').FlowNode[]>} */
  const nodes = ref([])
  const isHydrated = ref(false)

  /**
   * Undo and redo, as a stack of snapshots: each entry is the whole node list as it was before one
   * change, plus a label saying what that change was.
   *
   * Snapshots rather than an inverse per action, because one action already needs one: creating a
   * condition re-lays out the entire flow, so undoing it means restoring every position. With that
   * case unavoidable, one mechanism beats two (Spec 06, decision 6a).
   *
   * @type {import('vue').Ref<{ label: string, nodes: import('@/utils/graph').FlowNode[] }[]>}
   */
  const past = ref([])
  const future = ref([])

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const undoLabel = computed(() => past.value.at(-1)?.label ?? '')
  const redoLabel = computed(() => future.value.at(-1)?.label ?? '')

  const nodeById = computed(() => new Map(nodes.value.map((node) => [node.id, node])))
  const edges = computed(() => deriveEdges(nodes.value))

  /**
   * Title and description per node. It reads only names and data, never positions, so a drag
   * doesn't recompute it and every node keeps the same display object.
   */
  const nodeDisplayById = computed(
    () =>
      new Map(
        nodes.value.map((node) => [
          node.id,
          { title: getNodeTitle(node), description: getNodeDescription(node) },
        ]),
      ),
  )

  /**
   * A deep copy with no reactivity left anywhere in it.
   *
   * A round trip through JSON, rather than `structuredClone`: the flow is JSON to begin with — it
   * arrives as a payload and is written back as one — and this is the only copy that works whatever
   * it is handed. `structuredClone` refuses a reactive proxy outright, and `toRaw` unwraps only the
   * outermost object, so a node holding a reactive `data` would still slip through.
   */
  const toPlain = (value) => JSON.parse(JSON.stringify(value))

  /**
   * The flow as it stands, copied so it can be put back. It has to be a copy: keeping a reference
   * would mean holding the same objects the store goes on changing, and "restoring" them later
   * would restore the state the user is already in.
   * @param {string} label
   */
  function takeSnapshot(label) {
    return { label, nodes: toPlain(nodes.value) }
  }

  /**
   * Remembers the flow as it is, before a change is made to it. Called at the top of every action
   * that changes nodes, which is the only place a change can come from.
   * @param {string} label  what the change was, for the button: "Delete Away Message"
   */
  function snapshot(label) {
    past.value.push(takeSnapshot(label))
    if (past.value.length > HISTORY_LIMIT) past.value.shift()
    // Doing something new ends the branch that redo was going to follow.
    future.value = []
  }

  /** Steps back one change. The state being left is kept, so redo can return to it. */
  function undo() {
    const entry = past.value.pop()
    if (!entry) return

    future.value.push(takeSnapshot(entry.label))
    nodes.value = entry.nodes
  }

  /** The same, the other way round. */
  function redo() {
    const entry = future.value.pop()
    if (!entry) return

    past.value.push(takeSnapshot(entry.label))
    nodes.value = entry.nodes
  }

  /** The title a change is described by, read before the change is made. */
  const titleOf = (id) => {
    const node = nodeById.value.get(id)
    return node ? getNodeTitle(node) : 'step'
  }

  /**
   * Seeds the store from the raw payload. Runs once: later calls are ignored so cached query
   * data can never overwrite changes made in the app.
   * @param {import('@/utils/graph').RawNode[]} raw
   */
  function hydrate(raw) {
    if (isHydrated.value) return

    // Query data arrives as a reactive proxy, which structuredClone can't copy.
    const normalized = normalizePayload(toRaw(raw))
    layoutFlow(normalized)
    nodes.value = normalized
    isHydrated.value = true

    // Seeding the flow isn't a change anyone made, and there is nothing behind it to go back to.
    past.value = []
    future.value = []
  }

  /**
   * Arranges the given nodes as a tidy tree and writes each position. It replaces every position,
   * including ones the user dragged, so it's only used where the shape of the tree changes.
   * Sizes come from the registry, so short branch pills sit closer than full cards.
   * @param {import('@/utils/graph').FlowNode[]} list
   */
  function layoutFlow(list) {
    const positions = computeLayout(list, deriveEdges(list), { getNodeSize })
    for (const node of list) {
      node.position = positions.get(node.id)
    }
  }

  /**
   * Adds created nodes to the flow, after the mutation that made them succeeded.
   *
   * The new node is inserted **between** its parent and whatever used to follow that parent, so an
   * ordinary step still has one next step. A condition (business hours) arrives with its own
   * success and failure branches, and the flow continues on the success one.
   *
   * @param {import('@/utils/graph').RawNode[]} created  payload-shaped nodes from the API
   * @param {{ insertedId: string, continuationId: string }} placement
   *   `insertedId` is the node the user created; `continuationId` is the node the previous
   *   followers now hang from (the same node, or its success branch).
   * @returns {string} the id of the created node
   */
  function insertNodes(created, { insertedId, continuationId }) {
    // 1. Normalise what the API returned, exactly like payload nodes (string ids, copied data).
    const normalized = normalizePayload(toRaw(created))

    // 2. Find the two nodes the caller named. Looking them up by id (rather than by position in
    //    the array) means the two arguments can never drift apart from the nodes themselves.
    const inserted = normalized.find((node) => node.id === insertedId)
    const continuation = normalized.find((node) => node.id === continuationId)
    if (!inserted) throw new Error(`Created nodes do not include the new node "${insertedId}"`)
    if (!continuation) {
      throw new Error(`Created nodes do not include the continuation "${continuationId}"`)
    }

    // 3. Check the parent: it has to exist, and it has to be a step that can take a next step.
    //    Business hours can't: what follows it is always its own success and failure branches.
    const parent = nodeById.value.get(inserted.parentId)
    if (!parent) throw new Error(`Cannot add a node after unknown node "${inserted.parentId}"`)
    if (!getNodeConfig(parent).canHaveChildren) {
      throw new Error(`Cannot add a node after "${parent.id}", which branches instead`)
    }

    // 4. Past the checks, so the flow really is about to change. Named after the node the user
    //    asked for, which is the one undo would take away again.
    snapshot(`Create ${getNodeTitle(inserted)}`)

    // 5. Everything the API created apart from the new node itself: a condition's two branches.
    const branches = normalized.filter((node) => node !== inserted)
    const followers = nodes.value.filter((node) => node.parentId === parent.id)

    // 6. Place the new node, unless a branch arrived with it (step 9 handles that case).
    if (!branches.length) {
      inserted.position = positionBelow(parent, inserted)

      // 7. Move the steps that followed the parent down by the space the insert just added. It's a
      //    distance, not a target, so a branch the user dragged keeps its offset and only moves down.
      if (followers.length) {
        const positions = shiftSubtree(
          nodes.value,
          followers.map((node) => node.id),
          getInsertShift(parent, continuation),
        )
        for (const node of nodes.value) {
          const position = positions.get(node.id)
          if (position) node.position = position
        }
      }
    }

    // 8. Reattach: what followed the parent now follows the new node, or its success branch.
    for (const follower of followers) {
      follower.parentId = continuationId
    }
    nodes.value.push(...normalized)

    // 9. A condition is wider than the step it follows: its two branches need an extra column, so
    //    neighbouring branches have to make room. Rather than nudging each one, the whole flow is
    //    arranged again. This is the one case where manual positions are replaced.
    if (branches.length) layoutFlow(nodes.value)

    return insertedId
  }

  /**
   * Takes a list because a drag can move several selected nodes at once.
   * @param {{ id: string, position: { x: number, y: number } }[]} updates
   */
  function updateNodePositions(updates) {
    // Nothing to remember when nothing moves: an entry that changes nothing is an Undo button that
    // looks like it will do something and doesn't, and it throws the redo branch away for free.
    const moving = updates.filter(({ id }) => nodeById.value.has(id))
    if (!moving.length) return

    snapshot(moving.length === 1 ? `Move ${titleOf(moving[0].id)}` : `Move ${moving.length} steps`)

    for (const { id, position } of moving) {
      nodeById.value.get(id).position = { x: position.x, y: position.y }
    }
  }

  /**
   * Swaps one node for an edited copy of itself. Its position is kept from the node already in the
   * store: editing a node's fields never moves it, and the copy comes from a form that knows
   * nothing about the canvas.
   * @param {import('@/utils/graph').FlowNode} updated
   */
  function replaceNode(updated) {
    const index = nodes.value.findIndex((node) => node.id === updated.id)
    if (index === -1) return

    // Named before the change, so undoing a rename says which node it is putting the name back on.
    snapshot(`Edit ${titleOf(updated.id)}`)

    // Stored as plain data, whatever the caller was holding: a node read out of the store and
    // spread into a new object still carries a reactive `data`, and the store's own contents have
    // to stay copyable.
    nodes.value[index] = { ...toPlain(updated), position: { ...nodes.value[index].position } }
  }

  /**
   * Deletes nodes, moves whatever hung from them up to their parent, and closes the gap they left.
   * The whole removal is worked out before this runs (`utils/nodeRemoval`), so the store only
   * applies it — and the positions are shifted before the nodes go, while the tree is still whole.
   * @param {import('@/utils/nodeRemoval').Removal} removal
   */
  function removeNodes({ removeIds, reparent = [], shift = null }) {
    if (!removeIds.length) return

    // The node the user asked about comes first; the rest is whatever went with it.
    snapshot(`Delete ${titleOf(removeIds[0])}`)

    if (shift) {
      const positions = shiftSubtree(nodes.value, shift.ids, { dy: shift.dy })
      for (const node of nodes.value) {
        const position = positions.get(node.id)
        if (position) node.position = position
      }
    }

    const gone = new Set(removeIds)
    const newParentById = new Map(reparent.map(({ id, parentId }) => [id, parentId]))

    // Rebuilt from the raw list: mapping over the reactive one would put proxies back into the
    // store, and the store's own contents have to stay plain enough to copy.
    nodes.value = toRaw(nodes.value)
      .filter((node) => !gone.has(node.id))
      .map((node) =>
        newParentById.has(node.id) ? { ...node, parentId: newParentById.get(node.id) } : node,
      )
  }

  return {
    nodes,
    isHydrated,
    nodeById,
    edges,
    nodeDisplayById,
    hydrate,
    insertNodes,
    updateNodePositions,
    replaceNode,
    removeNodes,
    undo,
    redo,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
  }
})
