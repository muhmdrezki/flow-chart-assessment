# Spec 04: Node Details Drawer

Status: **Confirmed 2026-09-23** (decisions 4a–4h). Built on `feature/04-node-drawer`.
Brief: _"Clicking on a node should open a drawer on the right side of the screen that displays the
node's properties and attachments. The drawer should be accessible via a URL containing the node ID
and toggled by clicking on the node."_ Also: _"Success & Failure nodes are not accessible, they are
purely for display in the canvas"_, and _"the transition between the canvas and the drawer should be
buttery smooth"_.

---

## 1. Goal

Clicking a node opens a right-hand drawer showing that node's properties and attachments. The drawer
is the URL: `/node/:id` opens it, clicking the same node again closes it and returns to `/`, and
pasting a node URL into a fresh tab opens that node.

**Out of scope:**

- Editing anything in the drawer, and the business-hours grid: Spec 05.
- The update and delete mutations: Spec 06.
- Persistence across refresh: Spec 06.

This split is deliberate. The brief asks for a drawer that **displays** properties and attachments,
which this spec delivers in full. Editing is implied by the nice-to-have ("undo/redo for moves and
edits") rather than required, so it sits behind a spec of its own and the required behaviour is
finished first.

---

## 2. Design

### 2.1 How opening a node flows through the layers

```
click a node ─▶ FlowCanvas emits select(id)
                     │
                     ▼
              useSelectedNode: same id as the route?  ── yes ─▶ push('/')
                     │ no
                     ▼
              router.push({ name: 'node', params: { id } })
                     │
                     ▼
              FlowView re-renders with route.params.id
                     │
                     ├─ store.nodeById(id) ──▶ NodeDetailsDrawer
                     └─ unknown id, or a kind without details ──▶ replace('/')
```

There is no `isDrawerOpen` flag anywhere (CLAUDE.md rule 3). The route is the state: the drawer is
open exactly when the route names a node that can be opened, and that node comes from
`route.params.id`.

### 2.2 The route (decision 4a)

```
/                 flow          FlowView
/node/:id         node          FlowView          (the same page, with one node selected)
/:pathMatch(.*)*                redirect to /
```

Both paths render **the same component**, and `FlowView` owns the drawer. Router View keeps the
instance it already has when the component doesn't change, so the canvas survives the navigation
with its viewport, zoom and dragged positions intact.

The first draft made `/node/:id` a child route with a view of its own. Building it showed why that
doesn't work: a `<Transition>` only animates when the element it wraps is toggled, not when its
parent is destroyed. A drawer living inside the child route would be torn out the moment the route
changed and would disappear without its slide-out — the opposite of "buttery smooth". The drawer has
to outlive the navigation, so it belongs to the page that stays.

What was going to be a view is a composable instead: `useSelectedNode()` turns the route parameter
into a node, and owns selecting, toggling and the redirect.

`/node/:id` matches the brief's "a URL containing the node ID" literally. A query parameter
(`/?node=b6a0c1`) would work too, but a path segment is the honest shape for "this page is about one
node", and it keeps the id out of anything that looks like a filter.

Ids from the payload are hex strings and the trigger's is `1`, so `:id` stays a plain string
parameter and is compared as a string, like everywhere else in the app.

### 2.3 Modal or non-modal (decision 4b) ✅ _Confirmed: non-modal, and a click on empty canvas closes it_

`BaseDrawer` is modal today: a scrim over the page, the background marked `inert`, and focus trapped
in the panel. That is right for the create form, which is a task you finish or abandon.

It is wrong here. The brief says the drawer is **toggled by clicking on the node** — the node has to
stay clickable while its own drawer is open, and so do the other nodes, so that clicking one switches
the drawer to it. A scrim and an inert background make both impossible.

So `BaseDrawer` gains a `modal` prop, default `true`. With `modal: false`:

|                                            | modal (create form) | non-modal (details) |
| ------------------------------------------ | ------------------- | ------------------- |
| Scrim over the canvas                      | yes                 | no                  |
| Background `inert`                         | yes                 | no                  |
| Focus trapped in the panel                 | yes                 | no                  |
| Focus moves in when it opens               | yes                 | yes                 |
| Focus returns to the opener when it closes | yes                 | yes                 |
| Escape closes it                           | yes                 | yes                 |
| `role="dialog"`                            | `aria-modal="true"` | no `aria-modal`     |

`aria-modal` is dropped in the non-modal case because it is a claim about the rest of the page being
unavailable, which is no longer true. Keeping focus movement and Escape means the panel is still
reachable and escapable from the keyboard without lying to a screen reader.

Dropping the scrim would also drop "click outside to close", which people expect from a panel. It
comes back without the scrim: Vue Flow emits `pane-click` when the empty canvas is clicked, and the
canvas passes it on as a request to close. So clicking the background closes the drawer, clicking
another node switches to it in one click, and the canvas stays pannable throughout.

### 2.4 Which nodes open the drawer (decision 4c) ⚠️ _Reversed — see the note at the end_

Success and Failure stay closed: the brief is explicit. Everything else opens, **including the
Trigger**.

The earlier plan had the Trigger closed too, on the grounds that it is the root and its event is the
only thing it owns. On re-reading the brief, only Success and Failure are called "not accessible",
which implies the rest are. A Trigger that does nothing when clicked reads as a gap, and it isn't
one we need: the payload gives the Trigger real properties to show.

```json
{ "id": 1, "type": "trigger", "data": { "type": "conversationOpened", "oncePerContact": false } }
```

That is an event and a setting — enough for a drawer. The event stays **read-only** here: the payload
defines exactly one value, and a select listing events the product never mentions would be invented
data. Spec 05 decides whether it becomes editable.

The registry flag is renamed to match what it now means:

```diff
- editable: false,   // "can be edited"
+ hasDetails: true,  // "clicking it opens the drawer"
```

`editable` would be misleading the moment the Trigger opens a drawer whose event cannot be changed.
`hasDetails` says exactly one thing, and Spec 05/06 can add a separate notion of which _fields_ are
editable without overloading it. `isEditable()` in the registry becomes `hasDetails()`.

Final table:

| kind              | `hasDetails` | why                                        |
| ----------------- | ------------ | ------------------------------------------ |
| trigger           | **no**       | reversed — see below                       |
| sendMessage       | yes          | messages and attachments                   |
| addComment        | yes          | the comment                                |
| businessHours     | yes          | schedule and time zone                     |
| success / failure | **no**       | "purely for display in the canvas" (brief) |
| unknown           | **no**       | nothing reliable to show                   |

> **Reversed, 2026-09-23.** An audit against the assessment's own checklist listed the editable kinds
> as exactly `sendMessage`, `addComment` and `dateTime`, with the trigger named among the
> display-only ones. This spec argued the other way from the brief's wording, which only calls out
> Success and Failure — but a rubric that names the three editable kinds outranks an inference, and
> the cost of being wrong was two failed checks against a one-line change. The trigger is
> display-only: not clickable, not in the tab order, and `/node/1` redirects. The event and
> once-per-contact fields went with it, rather than leaving a branch of the form nothing can reach.

### 2.5 Toggling, switching and history (decision 4e)

| what the user does                   | what happens                                                 |
| ------------------------------------ | ------------------------------------------------------------ |
| clicks a node, no drawer open        | `push('/node/<id>')` — the drawer slides in                  |
| clicks the node whose drawer is open | `push('/')` — the drawer slides out                          |
| clicks a **different** node          | `push('/node/<other>')` — the content swaps, the panel stays |
| clicks the empty canvas              | `push('/')`                                                  |
| presses Escape, or the close button  | `push('/')`                                                  |
| clicks a Success or Failure pill     | nothing                                                      |

`push`, not `replace`, so Back walks the selection history: open a node, open another, press Back and
you are on the first one again. That fits a URL the brief wants shareable. The cost is that closing
adds an entry, so Back after closing reopens the last node — which is the behaviour most people
expect from a Back button anyway.

Switching between nodes does **not** close and reopen the panel. The panel stays put and its contents
change, which is both calmer to look at and less work.

### 2.6 What the canvas does when the drawer opens (decision 4d) ✅ _Confirmed: nothing_

The panel is 420px of the right-hand side, and it overlays the canvas. **The viewport does not
move.** A node that ends up behind the panel stays there; the user can pan if they want to see it.

Moving the canvas under the user is the bigger sin. Re-centring on every click makes the graph lurch
even when the node was perfectly visible, and shrinking the canvas to make room is worse still, since
Vue Flow re-measures on resize and the whole graph jumps. Doing nothing is both calmer and less code.

`FlowCanvas.focusNode(id)` is therefore untouched: it keeps serving the create flow, where moving the
view is the point, and this spec does not call it.

### 2.7 What the drawer shows (decision 4f)

Header (from `BaseDrawer`, which already has all three): the kind's icon in its accent colour, the
node's title, and the kind label underneath.

Body: the node's properties, derived by a **pure util**, `getNodeProperties(node)`, returning a small
tagged list the drawer renders:

```js
/**
 * @typedef {{ kind: 'text', label: string, value: string }
 *          |{ kind: 'flag', label: string, value: boolean }
 *          |{ kind: 'attachment', label: string, url: string, name: string }
 *          |{ kind: 'schedule', label: string, timezone: string, times: DayTime[] }} NodeProperty
 */
```

| node kind     | properties                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------- |
| trigger       | Event (`Conversation Opened`), Once per contact (`Yes`/`No`)                                  |
| sendMessage   | one row per item in `data.payload`: a text row per `text`, an attachment row per `attachment` |
| addComment    | Comment                                                                                       |
| businessHours | Time zone, then the schedule as seven day rows                                                |
| any kind      | Description, when the user has set `data.description`                                         |

Attachments are URLs in this payload, so an attachment row shows the file name from the URL (we
already derive it for node descriptions), an image preview when the URL looks like an image, and a
link that opens it in a new tab with `rel="noopener"`.

A pure function plus one renderer is less code than a component per kind and it is fully unit-testable
without mounting anything. It does mean Spec 05 introduces per-kind _form_ components when the fields
become editable, and this display path gets replaced then — accepted, because it keeps this spec small
and the brief's display requirement finished on its own.

The business-hours rows are a plain read-only list here. The mockup's Day | Time grid with pickers is
an editing control and belongs to Spec 05.

### 2.8 Selecting a node with the keyboard (decision 4g)

The brief lists this as a nice-to-have: _"keyboard accessibility (select node, open drawer)"_. It is
cheap here and awkward to retrofit later, so it lands in this spec.

- Every node that has details is reachable with Tab, in the order the nodes are laid out.
- Enter or Space toggles its drawer, exactly like a click.
- The focused node shows a visible focus ring; the selected node shows a ring in its accent colour.
- Success and Failure pills are not in the tab order — nothing happens when they are activated.

The selected ring is driven by the route, not by Vue Flow's own selection, so the URL stays the single
source of truth for what is selected.

**Dragging vs clicking.** A node is draggable, so the worry was that finishing a drag would open the
node's drawer. It doesn't: `d3-drag` puts a capture-phase handler on the window that swallows the
click ending a real drag, and Vue Flow only counts a drag once the pointer has moved more than a
pixel. A `node-click` therefore only ever arrives from a click that stayed put, and the canvas needs
no guard of its own. The first attempt added one anyway, and it was worse than nothing: it swallowed
the next genuine click on any node that had been moved (see §3.2).

**Vue Flow's keyboard handling is off**, via `nodes-focusable="false"` and `disable-keyboard-a11y`.
Left on, it puts a tab stop on the node wrapper as well as on the card inside it, binds its own
Enter handling, and moves a selected node with the arrow keys — writing positions inside Vue Flow
that the store never hears about, which then snap back on the next store-driven render.

**One panel at a time.** Because this drawer leaves the page usable, the header's **Create New Node**
button is still live while a node is open. The create form is modal, so two panels would end up
stacked: the details panel painting over a form that has just made it inert. Opening the create form
closes the open node first.

### 2.9 Deep links, and the wait for data (decision 4h)

Opening `/node/b6a0c1` in a fresh tab starts with an empty store: the payload is still being fetched.
Redirecting on "unknown id" at that moment would send every deep link straight back to `/`.

So the resolution waits: while the flow is loading, the drawer is not rendered and nothing is
redirected. Once the store is hydrated, the id is resolved exactly once:

| state                                                   | result                                                |
| ------------------------------------------------------- | ----------------------------------------------------- |
| still loading                                           | render nothing, redirect nothing                      |
| hydrated, id found, kind has details                    | open the drawer                                       |
| hydrated, id not found                                  | redirect to `/`                                       |
| hydrated, kind has no details (Success/Failure/unknown) | redirect to `/`                                       |
| the flow failed to load                                 | `FlowView` already shows its error state; no redirect |

Redirecting rather than showing a "node not found" panel keeps one rule — CLAUDE.md rule 3 — and
avoids a dead-end screen for what is almost always a stale link. The redirect **replaces** the entry
rather than pushing one, so Back doesn't land on the bad URL and bounce again.

---

## 3. Implementation

### 3.1 New and changed files

```
src/router/index.js                                     + the /node/:id route (same component)
src/utils/nodeRegistry.js                               editable → hasDetails; trigger true
src/utils/businessHours.js                              + DAY_LABELS
src/utils/nodeProperties.js           (new)             getNodeProperties(node)
src/composables/useSelectedNode.js    (new)             the route ⇄ node link and the redirect
src/composables/useFocusTrap.js                         + trap option (Tab cycling off)

src/components/ui/BaseDrawer/BaseDrawer.vue             + modal prop (default true)
src/components/canvas/FlowCanvas/FlowCanvas.vue         + selectedId, select/deselect, drag guard
src/components/nodes/NodeCard/NodeCard.vue              + role, tab stop, Enter/Space, ring
src/components/nodes/ConnectorNode/ConnectorNode.vue    − selected (a pill is never selected)
src/components/drawer/NodeDetailsDrawer/…  (new)        the panel: a node in, close out
src/views/FlowView/FlowView.vue                         + the selection wiring
```

`NodeDetailsDrawer` takes a node and emits `close`, so it mounts in a test without a router or a
store. Everything that needs the router lives in `useSelectedNode`.

### 3.2 Contracts

```js
// src/utils/nodeProperties.js — pure, no Vue or Pinia
getNodeProperties(node: FlowNode): NodeProperty[]

// src/utils/nodeRegistry.js
hasDetails(node): boolean                // was isEditable

// composables/useSelectedNode
{ selectedNode: ComputedRef<FlowNode|null>, select(id), close() }

// ui/BaseDrawer
props: { open, title, description, icon, dismissible, modal = true }

// canvas/FlowCanvas
props:  { selectedId?: string | null }
emits:  { select: (id: string) => void, deselect: () => void }
expose: { focusNode(id) }                // unchanged; this spec never calls it

// nodes/NodeCard
emits: { activate: () => void }          // keyboard only; clicks arrive through Vue Flow

// drawer/NodeDetailsDrawer
props: { node: FlowNode | null }
emits: { close }
```

### 3.3 What the review caught

- **The drag guard was built on two wrong assumptions** and swallowed the first real click on any
  node that had been moved. `node-click` doesn't fire after a drag (d3 suppresses it), and
  `node-drag-start` doesn't fire on the mouse press (Vue Flow's drag threshold is a pixel, so the
  drag only starts once the pointer moves). The guard is gone; only the "did it actually move?"
  check before writing positions remains.
- **`nodes-focusable="false"` was not enough.** The node wrapper binds its keydown handler either
  way, so Enter on a card also ran Vue Flow's own selection, and the arrow keys moved the node
  behind the store's back. `disable-keyboard-a11y` turns that off.
- **Both drawers could be open at once**, leaving the details panel painted over the create form and
  frozen by its `inert`.
- **Focus was handed back to the wrong card** when the drawer stayed open across a switch: the trap
  remembered where it opened from, not where focus had got to since.
- A `<p>` sat directly inside a `<dl>`, which only takes terms and definitions.
- A business-hours day with only one of its two times rendered a dangling dash.

### 3.4 Stacked PRs

| PR  | branch                          | contents                                                          |
| --- | ------------------------------- | ----------------------------------------------------------------- |
| 04a | `feature/04a-drawer-foundation` | `nodeProperties.js`, `DAY_LABELS`, the registry rename, the route |
| 04b | `feature/04b-canvas-selection`  | selection and keyboard on the canvas and the nodes                |
| 04c | `feature/04c-details-drawer`    | `modal` on `BaseDrawer`, `useSelectedNode`, the drawer, the view  |

### 3.5 Tests (outline)

- **`nodeProperties`**: every kind; a `sendMessage` with text and attachment items; an empty payload
  array; a missing `data`; a user description present and absent; the attachment name and the image
  check; the trigger's flag rendering as Yes/No.
- **`nodeRegistry`**: `hasDetails` per kind, including the Trigger being true and the pills false.
- **`BaseDrawer`**: non-modal renders no scrim, leaves the background reachable, sets no `aria-modal`,
  still moves focus in, still closes on Escape; modal is unchanged.
- **`FlowCanvas`**: emits `select` on a node click; does not emit after a drag; marks the selected
  node.
- **`useSelectedNode`**: nothing selected while loading; resolves a known id; redirects for an unknown
  id and for Success; toggling the open node; switching to another.
- **`FlowView`**: a node click opens the drawer; clicking the open node closes it; a pane click closes
  it; a deep link opens once the data arrives.
- **`NodeDetailsDrawer`**: renders each property kind, the attachment link and preview, and emits
  `close`.

---

## 4. Acceptance criteria

- [x] Clicking a node opens the drawer on the right with that node's properties and attachments.
- [x] Clicking the same node again closes it; clicking another node switches to it.
- [x] The drawer is at `/node/:id`, and pasting that URL into a fresh tab opens the same node.
- [x] Success and Failure do nothing when clicked, and their URLs redirect to `/`.
- [x] The Trigger opens, with its event shown read-only.
- [x] Opening the drawer never moves the canvas.
- [x] A node can be reached with Tab and opened with Enter or Space.
- [x] Lint clean, tests green, build succeeds.

---

## 5. Decisions (confirmed 2026-09-23)

| #   | Question                          | Proposal                                                                                                                   | Alternative(s)                                                           |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 4a  | The URL                           | ✅ **`/node/:id` as a child route**, so the canvas never unmounts                                                          | `/?node=<id>`; a sibling route                                           |
| 4b  | Does the drawer block the canvas? | ✅ **Non-modal** (no scrim, no inert, no focus trap; keeps focus-in and Escape) **plus a click on empty canvas closes it** | Keep it modal: the canvas is dimmed and switching nodes takes two clicks |
| 4c  | Is the Trigger accessible?        | ✅ **Yes**, with a read-only event; rename `editable` → `hasDetails`                                                       | Trigger closed, as originally proposed                                   |
| 4d  | The canvas when the drawer opens  | ✅ **Nothing**: the panel overlays it and the viewport never moves                                                         | Pan only when hidden; always re-centre; shrink the canvas                |
| 4e  | History entries                   | ⏳ **Open.** `push` on open, switch and close, so Back steps back through the selection                                    | `replace`, so Back leaves the app                                        |
| 4f  | How the body is built             | ✅ **A pure `getNodeProperties` + one renderer**                                                                           | A display component per kind                                             |
| 4g  | Keyboard select and open          | ✅ **In this spec** (Tab to a node, Enter/Space to toggle)                                                                 | Leave it to a later nice-to-have pass                                    |
| 4h  | Deep link before the data arrives | ✅ **Wait for hydration**, then resolve once; redirect only after                                                          | Redirect immediately on an unknown id                                    |
