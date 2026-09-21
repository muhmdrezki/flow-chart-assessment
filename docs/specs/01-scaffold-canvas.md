# Spec 01: Scaffold + Canvas

Status: **Confirmed 2026-09-21**
Brief: *"Vite/Vue/Pinia/Router/Vue Flow/Query set up. Load payload.json via Query into Pinia. Render nodes + edges with Vue Flow. Nodes are draggable across the canvas."*

---

## 1. Goal

When the app opens, the user sees the workflow from `payload.json` drawn as a top-down tree of connected
nodes, and can drag any node around the canvas. There is no editing yet.

**Out of scope for this spec:** custom node cards (Spec 02), create form (03), drawer (04/05),
mutations (06), localStorage persistence, undo/redo.

---

## 2. Design

### 2.1 Data flow

```
public/payload.json
      │  fetch (flowApi.fetchFlow)
      ▼
useQuery(['flow'])            ← Vue Query: I/O only, holds the raw payload in its cache
      │  on success, once
      ▼
flowStore.hydrate(raw)        ← Pinia: normalises, lays out, and OWNS the nodes from here on
      │
      ├─ store.nodes           (domain nodes, with positions)
      └─ store.edges           (computed from parentId, never stored)
      │
      ▼
FlowCanvas.vue                ← maps domain → Vue Flow shape (computed), renders <VueFlow>
      │  @node-drag-stop
      └────────▶ flowStore.updateNodePositions(...)
```

Principles:

- **Pinia owns the graph.** Vue Query's cache keeps the raw payload (that's inherent to Query), but no
  component reads it. The only consumer is the one-time `hydrate`.
- **Edges are derived, not stored.** Every node has a `parentId`, so edges are a `computed` over
  nodes. That removes a whole class of "edge points to a deleted node" bugs, because an edge can't
  exist without both nodes.
- **Vue Flow is a renderer.** It receives nodes and edges one way, from computed props. The only thing
  it reports back is the final position after a drag. Its built-in graph editing (connecting,
  deleting with the Backspace key) is turned off, because every graph change must go through our
  mutations (Spec 06).
- **Positions are saved once per drag,** on drag stop, not on every mouse move. This keeps renders cheap
  and gives undo/redo one clean step per move later.

### 2.2 Domain node shape

The payload stays as it is. We only normalise at the boundary (`hydrate`):

```js
/**
 * @typedef {Object} FlowNode
 * @property {string}        id        payload id, stringified (payload has number 1 and hex strings)
 * @property {string|null}   parentId  stringified; null for the root (payload uses -1)
 * @property {string}        type      payload type, unchanged ('trigger' | 'sendMessage' | 'addComment'
 *                                     | 'dateTime' | 'dateTimeConnector')
 * @property {string}        [name]    payload name, unchanged (trigger has none)
 * @property {Object}        data      payload data, unchanged (deep-cloned)
 * @property {{x:number,y:number}} position  added by layout on first hydrate
 */
```

The UI **kind** (`trigger | sendMessage | addComment | businessHours | success | failure`) is **derived**
by `getNodeKind(node)`, not stored, so it can never drift from `type`/`data`:

| `type` | condition | kind |
|---|---|---|
| `trigger` | any | `trigger` |
| `sendMessage` | any | `sendMessage` |
| `addComment` | any | `addComment` |
| `dateTime` | `data.action === 'businessHours'` | `businessHours` |
| `dateTimeConnector` | `data.connectorType === 'success'` or `'failure'` | `success` / `failure` |
| anything else | — | `unknown` (rendered as a plain node and never crashes) |

**Title (minimal, for this spec):** `node.name`, falling back to a humanised trigger type
(`conversationOpened` → "Conversation Opened"), then to the kind. Descriptions come in Spec 02.

### 2.3 Layout (decision 1a, 1b)

**Why a tree algorithm.** The payload stores a single `parentId` per node, so the format can't express
a node with two parents. The brief's mockup is also a tree (one root, splitting only at Business
Hours). We verified the payload is a tree (one root, every parent exists, no cycles), and our own
mutations keep it that way. A general graph layout (e.g. dagre) would add a dependency and complexity
for a case the data can't produce.

**Keeping that assumption in one place.** The layout takes **edges**, not `parentId`:
`computeLayout(nodes, edges)`. The tree algorithm is the current implementation, not the contract. If
the model ever allowed converging branches, only `deriveEdges` and this function's algorithm (e.g. a
layered layout) would change. The store, canvas and components would not.

Our own layout function, with no dependency:

- Build a children map from the edges, keeping node order among siblings. Nodes with no incoming
  edge are roots.
- **Subtree width:** a leaf is 1 slot wide. A parent's width is the sum of its children's widths.
- Leaves are placed left to right in slots, and each parent is **centred over its children**.
- `x = slotCentre × X_GAP`.
- `y` is based on **node heights**: `child.y = parent.y + height(parent) + Y_GAP`. Heights come from
  an injected `getNodeSize(node)`, which returns a constant by default. Spec 02 passes kind-based
  sizes, so the compact Success/Failure pills from the mockup sit closer to their neighbours than
  full cards do. The layout itself stays unaware of node kinds.
- **Robustness (invalid data, not the payload):** orphans (a `parentId` pointing to a missing node)
  get no edge, so they become extra roots laid out side by side. Nodes in a cycle have no root, so
  any node still unvisited after traversal is laid out as a root. A visited-set ensures termination.
- It runs **once, on first hydrate.** After that, positions are user data: dragging changes them, and
  new nodes (Spec 03) are placed relative to their parent.

Payload result (illustrative):

```
                 [Conversation Opened]
                          │
                   [Business Hours]
                   ┌──────┴──────┐
               [Success]     [Failure]
                   │             │
          [Welcome Message] [Away Message]
                                 │
                          [Add Comment #1]
```

### 2.4 Edges (decision 1c, 1d)

- There is one edge per node whose `parentId` refers to an existing node: `{ id: 'e-<parent>-<child>',
  source: parentId, target: id }`. The payload gives 6 edges.
- `data.connectors` on businessHours is **not** used to draw edges, because `parentId` is the single
  rule that works for every type. It's kept as-is, and Spec 06 keeps it in sync on create/delete.
- **Edge colour follows the mockup:** an edge takes the accent colour of its **source** node's kind
  (Trigger → Business Hours is pink, Business Hours → branches is orange, Away Message → Comment is
  teal). Success/Failure connectors are part of the Business Hours branch, so edges leaving them use
  the Business Hours colour.
- Implementation: the adapter sets `class: 'edge--<colourKind>'`, and the colours are CSS custom
  properties (`--color-kind-<kind>`). This spec defines placeholder values. Spec 02 finalises the
  per-kind palette alongside node icons, so nodes and edges share one set of colour tokens.

### 2.5 Routing (decision 1f)

- `createWebHistory()`. `/` renders `FlowView` (header + canvas).
- A catch-all route redirects to `/`.
- Spec 04 adds `node/:id` as a **child route of `/`**, so the canvas stays mounted while the drawer
  opens (no remount, no lost viewport). This spec sets up the parent route so that's a one-line addition.
- `vercel.json` rewrites unknown paths to `index.html` so deep links work in production. Vercel serves
  real files (like `/payload.json`) before applying rewrites.

### 2.6 Loading & error UX

- **Loading:** a centred spinner with the text "Loading flow…".
- **Error:** the message plus a **Retry** button (calls `refetch`).
- **Success:** the canvas, with the viewport fitted to the nodes on init.

### 2.7 Canvas add-ons (decision 1e)

The `@vue-flow/background` dotted grid and `@vue-flow/controls` zoom and fit buttons. No minimap.

---

## 3. Implementation

### 3.1 Dependencies (latest stable at install time)

| runtime | dev |
|---|---|
| `vue`, `vue-router`, `pinia` | `vite`, `@vitejs/plugin-vue` |
| `@vue-flow/core`, `@vue-flow/background`, `@vue-flow/controls` | `vitest`, `@vue/test-utils`, `jsdom`, `@vitest/coverage-v8` |
| `@tanstack/vue-query` | `tailwindcss`, `@tailwindcss/vite` |
| | `eslint`, `@eslint/js`, `eslint-plugin-vue`, `globals`, `prettier`, `eslint-config-prettier` |

### 3.2 Files

```
index.html
vite.config.js            Vue + Tailwind plugins, @ → src alias, Vitest config (jsdom, coverage)
eslint.config.js          flat config: js recommended + vue recommended + prettier
.prettierrc
vercel.json               SPA rewrite
public/payload.json       (already present, byte-for-byte from source)
src/
  main.js                 createApp + Pinia + Router + VueQueryPlugin({ queryClientConfig })
  App.vue                 <RouterView />
  assets/main.css         @import "tailwindcss"; Vue Flow core + theme CSS; edge classes
  config/queryClient.js   export const queryClientConfig = { ...exact config from brief }
  router/index.js         routes + catch-all
  api/flowApi.js          fetchFlow()
  api/queryKeys.js        flowKeys = { all: ['flow'] }
  composables/useFlowLoader.js
  stores/flow.js          useFlowStore (setup store)
  utils/ids.js            normalizeId, isRootParent
  utils/nodeKind.js       NODE_KIND constants, getNodeKind, getNodeTitle, getEdgeColourKind
  utils/graph.js          normalizePayload, deriveEdges
  utils/layout.js         computeLayout
  utils/vueFlowAdapter.js toVueFlowNodes, toVueFlowEdges
  views/FlowView/                 FlowView.vue, FlowView.spec.js
  components/
    canvas/FlowCanvas/            FlowCanvas.vue, FlowCanvas.spec.js
    ui/BaseButton/                BaseButton.vue, BaseButton.spec.js
    ui/BaseSpinner/               BaseSpinner.vue, BaseSpinner.spec.js
    ui/EmptyState/                EmptyState.vue, EmptyState.spec.js
```

Every util/store/composable/api/config file has a `*.spec.js` beside it (see section 4). Components
follow the folder convention in CLAUDE.md ("Component structure"). No component needs its own `.css`
file in this spec. Vue Flow theming and edge colours go in `assets/main.css`.

### 3.3 Module contracts

**`api/flowApi.js`**
- `fetchFlow(): Promise<RawNode[]>`: `fetch(`${import.meta.env.BASE_URL}payload.json`)`. Throws
  `Error('Failed to load flow (<status>)')` if `!res.ok`, and throws if the body isn't an array.

**`composables/useFlowLoader.js`**
- `useFlowLoader()` → `{ isPending, isError, error, refetch }`.
- Runs `useQuery({ queryKey: flowKeys.all, queryFn: fetchFlow })`.
- `watch(data, raw => raw && !store.isHydrated && store.hydrate(raw), { immediate: true })`.
- The `isHydrated` guard means a remount (cached data) never overwrites user changes. It's also the hook
  where localStorage restore will slot in later.

**`stores/flow.js`**: `useFlowStore`
- state: `nodes: ref<FlowNode[]>([])`, `isHydrated: ref(false)`
- getters: `nodeById: computed<Map<string, FlowNode>>`, `edges: computed(() => deriveEdges(nodes))`
- actions:
  - `hydrate(raw)`: `normalizePayload(raw)` → `computeLayout(nodes, deriveEdges(nodes))` → set `nodes`, `isHydrated = true`.
  - `updateNodePositions(updates: {id, position}[])`: updates matching nodes and ignores unknown ids.
    It takes an array because Vue Flow's drag-stop can report a multi-node drag.

**`utils/ids.js`**
- `normalizeId(id) → string` (`1` → `'1'`, `'b6a0c1'` → `'b6a0c1'`).
- `isRootParent(parentId) → boolean` (true for `-1`, `'-1'`, `null`, `undefined`).

**`utils/graph.js`**
- `normalizePayload(raw) → FlowNode[]` (without positions): stringifies ids, maps root parents to
  `null`, deep-clones `data` (`structuredClone`) so the store never aliases the Query cache.
- `deriveEdges(nodes) → Edge[]` of `{ id, source, target }`: skips root and orphan nodes. It stays
  presentation-free, so colour is decided in the adapter.

**`utils/nodeKind.js`** (additionally)
- `getEdgeColourKind(sourceNode) → kind`: the source's kind, except `success`/`failure` →
  `businessHours`, and `unknown` → `'neutral'`.

**`utils/layout.js`**
- `computeLayout(nodes, edges, { xGap = 280, yGap = 64, getNodeSize = () => ({ width: 240, height: 96 }) } = {})`
  → `Map<string, {x, y}>`. Pure and
  deterministic (see 2.3).

**`utils/vueFlowAdapter.js`**
- `toVueFlowNodes(nodes)` → `{ id, position, type: 'default', data: { label: getNodeTitle(node) } }`.
  Spec 02 switches `type` to the kind and registers custom components.
- `toVueFlowEdges(edges, nodeById)` → adds `class: 'edge--<colourKind>'` from the source node's kind
  (`success`/`failure` sources map to `businessHours`), via `getEdgeColourKind(sourceNode)`.

**`components/ui/` (first kit components; domain-free, see CLAUDE.md rules)**
- `BaseButton`: props `variant: 'primary' | 'secondary' | 'danger' | 'ghost'` (default `primary`),
  `size: 'sm' | 'md'`, `type` (default `'button'`, so it never submits a form by accident), `disabled`,
  `loading` (shows a spinner, sets `aria-busy`, blocks clicks). Default slot for the label.
- `BaseSpinner`: props `size`, `label` (default "Loading"). Renders `role="status"` with a
  visually hidden label.
- `EmptyState`: props `title`, `message`, `tone: 'neutral' | 'error'` (error → `role="alert"`).
  An `actions` slot takes buttons (e.g. Retry).

**`components/canvas/FlowCanvas`**
- Reads the store, `computed` → adapter → `<VueFlow :nodes :edges>`.
- Props on `<VueFlow>`: `fit-view-on-init`, `:nodes-connectable="false"`, `:delete-key-code="null"`,
  `:min-zoom="0.2"`, `:max-zoom="2"`.
- `@node-drag-stop="({ nodes }) => store.updateNodePositions(nodes.map(n => ({ id: n.id, position: n.position })))"`.
- Children: `<Background />`, `<Controls />`.

**`views/FlowView`**
- Uses `useFlowLoader()`. Renders the header (app title only for now) plus exactly one of:
  `<BaseSpinner label="Loading flow…">`, `<EmptyState tone="error">` with a Retry `<BaseButton>`, or
  `<FlowCanvas>`. Includes a `<RouterView />` slot for the Spec 04 drawer child route.

### 3.4 Implementation risk to verify first (spike)

Vue Flow keeps its own internal node state. When we pass new `:nodes` arrays (after a store position
update), we must confirm that it **keeps each node's internal state**: measured dimensions,
selection, no flicker or re-fit. Check this against the installed version's API before building on it.
- **If it behaves:** keep the one-way `:nodes` + `@node-drag-stop` design above.
- **If not:** switch to Vue Flow's controlled mode (turn off its default change handling with
  `applyDefault`, and apply changes via `@nodes-change` into the store). The store stays the owner
  either way, and this spec gets a design note if we switch.

**Result (2026-09-21, `@vue-flow/core` 1.48.2): passes, so we keep the one-way design.**
- Code: when the `nodes` prop changes, `parseNode` does `Object.assign(existingNode, ourNode)`. That
  merges our fields into the existing internal node, which keeps dimensions, selection and handle
  bounds. The rule that follows: **the adapter must never pass internal keys** (`selected`,
  `dimensions`, …).
- Code: when applying a drag, Vue Flow **reassigns** `node.position` rather than mutating it. The
  adapter copies positions anyway, so Vue Flow never holds a reference to store state.
- Runtime: after a drag, the store position updated, edges followed, the node stayed selected, and
  there was no re-fit or flicker. Backspace on a selected node deleted nothing.

### 3.5 Deviations found during implementation
- `useFlowLoader` also returns `isFetching`. After an error, Vue Query keeps `status: 'error'` while
  a retry is in flight, so the Retry button uses `isFetching` for its loading state.
- `hydrate` calls `toRaw(raw)` before normalising. Query data is a reactive proxy, and
  `structuredClone` throws on proxies (found in the browser, not by the build).
- `deriveEdges` also skips self-references (`parentId === id`), so no self-loop edge is drawn.
- The router exports a `createAppRouter(history)` factory, so tests can use memory history.

### 3.6 Code-review fix: payload validation
The code review found that a malformed payload (e.g. `[null]`) failed **silently**. `fetchFlow` only
checked for an array, so Query reported success, `hydrate` then threw inside the `watch`, and
`FlowView` rendered an empty canvas with no error and no Retry.

- `utils/graph.js`: **`findPayloadError(raw) → string | null`** returns the first problem, or null.
  It checks: the payload is an array; each item is an object; `id` is a non-empty string or finite
  number and unique (compared as strings); `type` is a non-empty string; `parentId` is a valid id;
  `name` is a string if present; `data` is an object if present; `data.type` is a string if present.
  It only checks fields the app reads today. Later specs extend it as they read type-specific fields.
- `api/flowApi.js`: `fetchFlow` throws **`InvalidPayloadError`** for invalid JSON or a
  `findPayloadError` result, so bad content becomes a normal query error (error screen + Retry).
- `api/flowApi.js`: **`shouldRetryFlowFetch(failureCount, error)`** is set as the flow query's
  `retry`. Invalid content fails immediately, because retrying can't fix it. Other errors keep Query's
  default of 3 retries. It's a per-query option, so the brief's client config is untouched.
- `views/FlowView`: renders `FlowCanvas` only when `store.isHydrated`. Otherwise it shows "Couldn't
  display the flow", so a failed hydrate can never look like an empty flow.

---

## 4. Tests (written after code review, per workflow)

The fixture for the tests is the real `public/payload.json`, imported directly, so tests and app share one source.

| file | cases |
|---|---|
| `config/queryClient.spec.js` | config deep-equals the brief's exact values |
| `api/flowApi.spec.js` | ok → returns array; non-ok → throws with status; invalid JSON / invalid payload → throws `InvalidPayloadError`; `shouldRetryFlowFetch`: retries other errors up to 3, never `InvalidPayloadError` |
| `utils/ids.spec.js` | number and string ids; all root-parent variants; non-root values |
| `utils/nodeKind.spec.js` | every mapping row in 2.2, including `unknown`; title fallbacks (name → humanised trigger → kind); `getEdgeColourKind` for every kind (connectors → businessHours, unknown → neutral) |
| `utils/graph.spec.js` | `findPayloadError`: real payload → null, and one case per rule (non-array, non-object item, bad/missing/duplicate id incl. `1` vs `"1"`, bad type, bad parentId, bad name, bad data, bad data.type); payload → 7 nodes, all ids strings, root `parentId` null, `data` equal but not the same reference; 6 edges with the right pairs; orphans produce no edge; root produces no edge |
| `utils/layout.spec.js` | payload layout matches the expected tree shape; root at y=0; child y = parent y + parent height + gap (with default and custom `getNodeSize`); siblings share y and don't overlap; parent centred over children; orphan tree placed beside; cycle terminates; deterministic across calls |
| `utils/vueFlowAdapter.spec.js` | node mapping shape; edge class from source kind (trigger, businessHours, sendMessage); success/failure sources map to businessHours; unknown source gets neutral class |
| `components/ui/BaseButton/BaseButton.spec.js` | renders slot; each variant/size applies its classes; default `type="button"`; emits click; `disabled` and `loading` block clicks; `loading` sets `aria-busy` and shows a spinner |
| `components/ui/BaseSpinner/BaseSpinner.spec.js` | `role="status"`; default and custom label announced |
| `components/ui/EmptyState/EmptyState.spec.js` | title/message render; `tone="error"` sets `role="alert"`; `actions` slot renders |
| `stores/flow.spec.js` | hydrate sets nodes + positions + flag; hydrate accepts **reactive** input (the proxy bug found in the browser); a second hydrate is a no-op; `edges`/`nodeById` react to changes; `updateNodePositions` updates matching nodes and ignores unknown ids |
| `composables/useFlowLoader.spec.js` | real `QueryClient` + mocked `fetchFlow`: store hydrated on success; error exposed on failure; remount doesn't re-hydrate |
| `components/canvas/FlowCanvas/FlowCanvas.spec.js` | VueFlow stubbed: receives mapped nodes/edges; emitting `node-drag-stop` updates the store |
| `views/FlowView/FlowView.spec.js` | loading renders spinner; error renders alert and Retry calls `refetch`; success + hydrated renders `FlowCanvas`; success but not hydrated renders "Couldn't display the flow" |

---

## 5. Acceptance criteria

- [x] `npm run dev` shows the 7 payload nodes as a top-down tree with 6 edges, coloured by source node kind as in the mockup.
- [x] Nodes drag smoothly; after a drag the store holds the new position (checked in Vue devtools).
- [x] Dragging never creates or deletes edges; Backspace does nothing to the graph.
- [x] Loading and error states render; Retry recovers after a failed fetch.
- [x] An unknown path (e.g. `/foo`) redirects to `/`.
- [x] The query client config exactly matches the brief.
- [x] `npm run lint` is clean; `npm run test:run` is green.

## 6. Decisions in this spec (confirm or change)

| # | Decision | Proposal |
|---|---|---|
| 1a | Layout | Own tree-layout function, no dagre |
| 1b | Positions | Computed once on first load, then owned by the store |
| 1c | `connectors` field | Kept and synced, but edges come from `parentId` only |
| 1d | Edge styling | Colour by source node kind (mockup-style); connectors use the Business Hours colour; palette finalised in Spec 02 |
| 1e | Canvas add-ons | Background + Controls; no minimap |
| 1f | Routing | `/` parent route; drawer is a child route in Spec 04; catch-all → `/`; Vercel rewrite |
| 1g | Edges not stored | Edges are a `computed` from `parentId` (new, see 2.1) |
| 1h | Kind not stored | Kind is derived by `getNodeKind`, never persisted (new, see 2.2) |
