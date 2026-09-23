# Spec 06: Undo and Redo

Status: **Draft — awaiting confirmation** (decisions 6a–6i in §5).
Brief: _"Nice to have: undo/redo functionality for node movements and edits."_

---

## 1. Goal

Every change to the flow can be taken back, and put back again: creating a step, editing one,
deleting one, and dragging one. Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z, plus two buttons in the header that
say what they will undo.

**Out of scope:**

- Undoing across a reload. There is no persistence (see the README), so history starts empty.
- Undoing inside a text field beyond what the browser already does. Typing in the drawer is the
  browser's undo, not ours — see §2.5.
- Restoring which node was open. Undo puts the flow back, not the panel (decision 6g).

---

## 2. Design

### 2.1 There is already exactly one way in

Every change to the flow goes through one of four store actions, and there is no fifth:

| action                | what changed       |
| --------------------- | ------------------ |
| `insertNodes`         | a step was created |
| `replaceNode`         | a step was edited  |
| `removeNodes`         | a step was deleted |
| `updateNodePositions` | a step was dragged |

That is the seam undo needs, and it already exists — so this feature is additive rather than a
refactor. `hydrate` is deliberately not in the list: seeding the store is not a change a user made,
and there is nothing to go back to before it.

### 2.2 Snapshots, not inverse commands (decision 6a)

Two ways to build this:

|                  | inverse commands                                              | snapshots               |
| ---------------- | ------------------------------------------------------------- | ----------------------- |
| what is stored   | how to reverse each action                                    | the node list before it |
| memory           | a few fields per step                                         | the whole flow per step |
| code             | an inverse per action, each its own chance to be subtly wrong | one push, one pop       |
| the awkward case | has to be special-cased                                       | already handled         |

The awkward case decides it. Creating a Business Hours node **re-lays out the whole flow**, because a
condition is wider than the step it follows and its branches need a column (Spec 03, decision 3c). To
reverse that, every position in the flow has to be restored — which is a snapshot whatever it is
called. Once one action needs a snapshot, two mechanisms are worse than one.

The usual objection to snapshots is memory, and it doesn't hold here: a node is a small object, the
payload's flow has seven of them, and the stack is capped (§2.9). A snapshot of a 50-node flow is a
few tens of kilobytes.

### 2.3 What counts as one step (decision 6b)

**One store action, one entry.** That gives the behaviour a user expects without any grouping logic:

- Dragging three selected nodes is one `updateNodePositions` call, so one undo puts all three back.
- Creating a Business Hours node adds three nodes (the condition and both branches) in one
  `insertNodes` call, so one undo removes all three. Undoing a condition but leaving its branches
  behind would be a bug, not a feature.
- Typing in the drawer is not a change to the flow at all until **Save**, which is one `replaceNode`.
  So undo steps back over whole saves, not keystrokes.

### 2.4 Each entry is labelled (decision 6c)

An entry carries a short label describing the change it would take back, so the button can read
**"Undo delete Away Message"** rather than just "Undo". It costs one string per entry and it is the
difference between a control people trust and one they have to test on something they care about.

The label is built where the change happens, because that is the only place that knows what it was.

### 2.5 The keyboard (decision 6d)

- **Cmd+Z** / **Ctrl+Z** — undo
- **Cmd+Shift+Z** / **Ctrl+Shift+Z** / **Ctrl+Y** — redo

Both are ignored when the event came from a text field — an `input`, a `textarea`, a `select`, or
anything `contenteditable`. Inside the drawer, Cmd+Z should undo the sentence being typed, which is
the browser's own behaviour, not ours.

This matters more here than in most apps: the details drawer is deliberately non-modal (Spec 04,
decision 4b), so the canvas is live while the user types in it. Without the guard, undoing a typo
would delete a node.

### 2.6 Undo does not talk to the server (decision 6e)

The store actions run only after a mutation has succeeded, which is exactly where a snapshot should
be taken. An undo then writes to the store directly, without a request.

That is a simplification, and the README says so: against a real backend, undo would send a
compensating request and be subject to failing, so it would go through `useMutation` like every other
write. Here the "server" is a delay and a validator in the same tab; sending a request to it would be
theatre, not honesty.

**While a save or delete is in flight, undo and redo are disabled.** Otherwise a response landing
after an undo would apply to a flow that had moved underneath it.

### 2.7 Undo is not the Back button (decision 6f)

There are two histories, and merging them would be wrong:

|           | what it moves                                              |
| --------- | ---------------------------------------------------------- |
| **Cmd+Z** | the flow's content — nodes created, edited, deleted, moved |
| **Back**  | the selection — which node's drawer is open (`/node/:id`)  |

Back stepping over a deletion is not what anyone means by "go back" after clicking through four
nodes. They stay separate, and the README says which is which.

### 2.8 The selection, when history moves under it (decision 6g)

Undo restores the flow, not the panel. If the node whose drawer is open disappears because a create
was undone, `useSelectedNode` already notices and returns to the canvas — that behaviour exists for
delete and needs nothing new.

The alternative, snapshotting the route alongside the nodes, would mean undoing a delete reopens the
drawer. Tempting, but it makes undo responsible for UI state as well as data, and the first time it
disagrees with the URL somebody has a bad afternoon.

### 2.9 Limits (decision 6h)

- **50 entries.** Beyond that the oldest is dropped. At a snapshot per change this is far more than a
  session needs and still trivial in memory.
- **A new change clears the redo stack.** Standard, and the only sane answer to "what does redo mean
  after you did something else".
- **`hydrate` clears both stacks**, so a reload starts clean.

---

## 3. Implementation

### 3.1 New and changed files

```
src/stores/flow.js                              + past, future, snapshot, undo, redo, canUndo…
src/composables/useHistoryShortcuts.js  (new)   the key handling, and the guard for text fields
src/components/ui/BaseIconButton/…      (new)   an icon-only button with an accessible name
src/views/FlowView/FlowView.vue                 + the two header buttons
src/utils/nodeDescription.js                    (reuse) getNodeTitle, for the labels
```

Only one existing file gains behaviour. The four actions each grow one line.

### 3.2 Contracts

```js
// stores/flow.js
snapshot(label: string)          // internal: called at the top of each mutating action
undo(): void
redo(): void
canUndo: ComputedRef<boolean>
canRedo: ComputedRef<boolean>
undoLabel: ComputedRef<string>   // "Delete Away Message", for the button's title
redoLabel: ComputedRef<string>
HISTORY_LIMIT = 50

// composables/useHistoryShortcuts
useHistoryShortcuts({ enabled: Ref<boolean> })   // binds Cmd/Ctrl+Z and friends, cleans up after itself
```

### 3.3 The store, step by step

```js
const past = ref([]) // [{ label, nodes }], oldest first
const future = ref([])

/** The flow as it is now, kept so it can be put back. Raw and cloned: the store's own nodes are
 *  reactive, and a snapshot that shares references with them isn't a snapshot. */
function snapshot(label) {
  past.value.push({ label, nodes: structuredClone(toRaw(nodes.value)) })
  if (past.value.length > HISTORY_LIMIT) past.value.shift()
  future.value = []
}

function undo() {
  const entry = past.value.pop()
  if (!entry) return
  future.value.push({ label: entry.label, nodes: structuredClone(toRaw(nodes.value)) })
  nodes.value = entry.nodes
}

function redo() {
  /* the same, the other way round */
}
```

Then one line at the top of each action:

```js
function removeNodes({ removeIds, reparent = [], shift = null }) {
  snapshot(`Delete ${getNodeTitle(nodeById.value.get(removeIds[0]))}`)
  …
}
```

Labels per action:

| action                | label                                  |
| --------------------- | -------------------------------------- |
| `insertNodes`         | `Create ${title of the inserted node}` |
| `replaceNode`         | `Edit ${title}`                        |
| `removeNodes`         | `Delete ${title}`                      |
| `updateNodePositions` | `Move ${title}` or `Move 3 steps`      |

`structuredClone(toRaw(...))` for the reason Feature 5 found the hard way: the store's nodes are
reactive, and `structuredClone` refuses a Proxy.

### 3.4 The UI

Two icon buttons in the header, left of **Create New Node**:

```
[↶] [↷]            Create New Node
```

- Disabled when the stack is empty, or while a mutation is in flight.
- The accessible name and the tooltip carry the label: _"Undo delete Away Message"_.
- `BaseIconButton` is the one new kit component: an icon-only button that requires a `label`, so an
  icon can never ship without a name for screen readers.

### 3.5 Stacked PRs

| PR  | branch                      | contents                                                |
| --- | --------------------------- | ------------------------------------------------------- |
| 06a | `feature/06a-history-store` | `past`/`future`, `snapshot`, `undo`, `redo`, the labels |
| 06b | `feature/06b-history-ui`    | `BaseIconButton`, the two buttons, the shortcuts        |

### 3.6 Tests

- **Store**: each of the four actions pushes one entry, with the right label; undo restores the
  previous nodes exactly (including positions); redo puts them back; a new change clears the redo
  stack; the stack stops at 50; `hydrate` clears both; undo on an empty stack does nothing.
- **Store, the awkward case**: creating a Business Hours node re-lays out the flow, so undo has to
  restore every position — a test drags a node first, creates the condition, undoes, and checks the
  dragged position came back.
- **Store, snapshots are copies**: mutating the flow after a snapshot doesn't change what the
  snapshot holds, and a snapshot taken from reactive state isn't a Proxy.
- **`useHistoryShortcuts`**: Cmd+Z and Ctrl+Z undo; Shift and Ctrl+Y redo; a key from an `input`,
  `textarea`, `select` or `contenteditable` is ignored; the listener is removed on unmount.
- **`BaseIconButton`**: the label reaches the accessible name, the icon is hidden from readers,
  disabled state.
- **`FlowView`**: both buttons disabled on a fresh flow; enabled after a change; the title says what
  will be undone; clicking undoes; both disabled while a save is pending.

---

## 4. Acceptance criteria

- [ ] Creating, editing, deleting and dragging can each be undone and redone.
- [ ] One user action is one undo — a condition and its branches go back together.
- [ ] The buttons say what they will undo, and are disabled when there is nothing to.
- [ ] Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z work on the canvas and are ignored while typing in a field.
- [ ] Undoing a create whose node is open in the drawer closes the drawer rather than stranding it.
- [ ] History does not survive a reload, and the README says why.
- [ ] Lint clean, tests green, build succeeds.

---

## 5. Decisions (to confirm)

| #   | Question                | Proposal                                                                                   | Alternative(s)                           |
| --- | ----------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| 6a  | How history is stored   | **A snapshot of the nodes per change**                                                     | An inverse per action; a mix             |
| 6b  | What one undo covers    | **One store action** — a condition with its branches, a multi-node drag                    | Per node; time-based grouping            |
| 6c  | Labels                  | **Yes**, one per entry, shown on the buttons                                               | Plain "Undo" / "Redo"                    |
| 6d  | Shortcuts               | **Cmd/Ctrl+Z**, **Cmd/Ctrl+Shift+Z**, **Ctrl+Y**; ignored in text fields                   | Buttons only                             |
| 6e  | Does undo call the API? | **No** — it writes to the store, and the README says why                                   | Route it through a compensating mutation |
| 6f  | Undo vs the Back button | **Separate**: content vs selection                                                         | Make Back undo changes too               |
| 6g  | The open drawer         | **Undo restores the flow, not the panel**; the existing guard handles a node that vanishes | Snapshot the route as well               |
| 6h  | Limit                   | **50 entries**, cleared by `hydrate`                                                       | Unbounded; a smaller cap                 |
| 6i  | Where the buttons live  | **The header**, left of Create New Node                                                    | On the canvas, beside the zoom controls  |
