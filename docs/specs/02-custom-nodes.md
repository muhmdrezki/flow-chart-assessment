# Spec 02: Custom Node Components

Status: **Confirmed 2026-09-22**
Brief: *"Each node on the canvas should contain the following information: Icons, Title, Description
(truncated)."* Also: *"success & failure node should not be accessible, purely for display in canvas."*

---

## 1. Goal

Replace Vue Flow's plain default nodes with our own components, so the canvas looks like the mockup:

- **Card nodes** (trigger, sendMessage, addComment, businessHours): an accent-coloured icon, the title,
  and a truncated description.
- **Connector nodes** (success, failure): small **pill labels** on the branch lines, as in the mockup.
- Editable and display-only nodes **look** different (pointer vs default cursor, hover state), so the
  user can tell which ones will open a drawer.

**Out of scope:**
- Clicking a node and opening the drawer (Spec 04).
- Creating nodes (Spec 03).
- The "+" buttons from the mockup (not required).
- Keyboard navigation (nice-to-have, later).

---

## 2. Design

### 2.1 One registry for node-kind behaviour (CLAUDE.md rule 4)

Everything that differs by kind lives in **one pure config object**, so components never branch on
`type`:

```js
// src/utils/nodeRegistry.js (no Vue imports)
NODE_REGISTRY[kind] = {
  label: 'Send Message',       // title fallback + accessible name
  icon: 'send',                // icon *name*; the ui/BaseIcon maps names to SVGs
  variant: 'card' | 'pill',    // which component renders it
  editable: true | false,      // drives cursor/hover now, and whether the drawer opens (Spec 04)
  hasInput: true | false,      // false for the trigger only: a flow starts there (no top handle)
  accent: '--color-kind-…',    // the CSS custom property shared by the node and its edges
  size: { width, height },     // used by the layout, so spacing matches what's drawn
}
```

| kind | label | icon | variant | editable | colour token |
|---|---|---|---|---|---|
| trigger | Trigger | `zap` | card | **no** (decided in Spec 04, proposed no) | `--color-kind-trigger` |
| sendMessage | Send Message | `send` | card | yes | `--color-kind-send-message` |
| addComment | Add Comment | `message-square` | card | yes | `--color-kind-add-comment` |
| businessHours | Business Hours | `calendar-clock` | card | yes | `--color-kind-business-hours` |
| success | Success | `check` | pill | no | `--color-kind-success` |
| failure | Failure | `x` | pill | no | `--color-kind-failure` |
| unknown | Unknown | `circle-help` | card | no | `--color-kind-neutral` |

The **Vue component map** (kind → component) can't live in `utils/` because it imports `.vue` files.
It's a tiny file next to the components: `components/nodes/nodeTypes.js`, wrapped in `markRaw` so Vue
never makes component definitions reactive.

### 2.2 Titles and descriptions

**Title:** `node.name`, otherwise the kind's registry label.
- **Change from Spec 01:** a trigger without a name was titled "Conversation Opened". The mockup
  shows title **"Trigger"** with description **"Conversation Opened"**, so the event moves to the
  description.

**Description:** a user-entered `data.description` wins when it's non-blank (Spec 03's create form
stores it there). Otherwise it's derived per kind:

| kind | derived description | payload example → result |
|---|---|---|
| trigger | humanised `data.type` | `conversationOpened` → "Conversation Opened" |
| sendMessage | first text message, else the first attachment's **file name**, else "No message content" | "Sorry, we are currently away…"; attachment-only → "354.jpg" |
| addComment | the comment, else "No comment" | "User message during off hours" |
| businessHours | `<label> - <timezone>`, as in the mockup (see 2.3) | "Business Hours - UTC" |
| success / failure | none (pills show only the label) | — |
| unknown | "Unsupported node" | — |

Whitespace in derived text is collapsed (`"Hello there\n\nwelcome"` → `"Hello there welcome"`), so a
two-line clamp shows real words, not blank lines.

### 2.3 Business-hours description (decision 2c)

The card follows the mockup: **`Business Hours - UTC`**, i.e. the kind's label, then the node's
timezone. The brief only asks for a truncated description, so the mockup decides. The actual hours are
shown day by day in the drawer (Spec 05), which is where the user reads and edits them.

**Timezones.** Business hours are **wall-clock times in the node's own timezone** (`data.timezone`). They
are shown as stored and never converted to the viewer's local time: `09:00–17:00` in a `UTC` node means
9 to 5 where the business is, like the hours on a shop sign. Converting (e.g. to `16:00–00:00` for a
viewer in Jakarta) would show each viewer different numbers from what was configured. This app is only
the editor: it never runs the flow or checks the current time, so no time conversion happens anywhere.

- **Default timezone: `UTC`.** It's used when a node has no `data.timezone` (the card then reads
  "Business Hours - UTC"), and it will be the starting value for business-hours nodes created in
  Spec 03. It matches the payload, and it's an explicit choice for this project, rather than the
  browser's timezone.

### 2.4 Truncation (decision 2d)

The brief says "truncated". We use **CSS line clamping** (`line-clamp-2`), not a JS character limit:
- it truncates at the real rendered width, with the ellipsis in the right place for any font;
- the full text goes in the `title` attribute, so hovering shows it.

### 2.5 Rendering performance ("optimized renders")

Today `toVueFlowNodes` rebuilds every node's title (and, with this spec, its description) whenever the
store changes, **including after every drag**, even though a drag only changes a position.

Instead:
- A `computed` **display map** (`id → { title, description }`) is derived from the nodes' `name`/`data`
  only. It **doesn't depend on positions**, so a drag never recomputes titles or descriptions (e.g. the
  business-hours text).
- The adapter reuses those objects as each Vue Flow node's `data`, so after a drag every node's
  `data` keeps the **same object identity**. Vue Flow sees no data change for nodes that didn't move.
- The node component map is `markRaw`, and node components are pure presentational (props in, markup
  out, no store access), so any re-render is cheap.

**What we can't control (checked in `@vue-flow/core` 1.48.2):** Vue Flow's node wrapper renders each
custom node with a **new `events` object** and the live `computedPosition` on every render
(`vue-flow-core.mjs`, the `h(nodeCmp, { … events: { ...node.events, ...on } … })` call). So when a
wrapper re-renders, its node component re-renders too, whatever we pass in `data`. Preventing that would
mean fighting the library, and it isn't worth it for a handful of cheap presentational components. The
win we *can* guarantee and test is that derivation work isn't repeated.

### 2.6 Node look

**Cards** (240 × 88, fixed size so the layout's spacing matches what's drawn):
```
┌──────────────────────────────┐
│ [icon] Title                 │   icon in the kind's accent colour on a tinted background
│ Description that is clamped  │
│ to two lines with an elli…   │
└──────────────────────────────┘
```
- The border takes the accent colour when **selected**. Visible focus ring.
- **Editable:** `cursor-pointer`, hover shadow. **Display-only:** `cursor-default`, no hover lift.
  Every node stays **draggable** (the brief requires it for all nodes).
- Handles: a small dot at the top (target) and bottom (source). The trigger has no target handle
  (`hasInput: false` in the registry, so the component has no kind check).
  Connecting is already off (Spec 01), so the handles are just visual anchors for the edges.

**Pills** (96 × 28): a rounded label with a small icon. Success is green and Failure is red
(decision 2e). There's no top/bottom text, just the label, sitting on the branch line.

**Final palette** (replaces Spec 01's placeholders, shared by nodes and edges):

| token | value |
|---|---|
| `--color-kind-trigger` | `#e11d48` (rose-600) |
| `--color-kind-business-hours` | `#ea580c` (orange-600) |
| `--color-kind-send-message` | `#0d9488` (teal-600) |
| `--color-kind-add-comment` | `#2563eb` (blue-600) |
| `--color-kind-success` | `#16a34a` (green-600) |
| `--color-kind-failure` | `#dc2626` (red-600) |
| `--color-kind-neutral` | `#94a3b8` (slate-400) |

The 600 shades give readable contrast for icons on white. Edge colours stay as in Spec 01 (by source
kind; connectors use the business-hours colour).

### 2.7 Typeface: Nunito (decision 2h)

The whole app uses **Nunito**, a rounded sans-serif that suits a friendly, chat-product feel.

- **Self-hosted** with `@fontsource-variable/nunito` (OFL licence). Vite bundles the font files, so there's
  no request to Google, it works offline, and nothing third-party loads on the page. It's one
  **variable** font file covering every weight, so we don't ship a separate file per weight.
- Wired in through Tailwind's theme, so every `font-sans` utility (the default) uses it:
  ```css
  @import '@fontsource-variable/nunito';
  @theme { --font-sans: 'Nunito Variable', ui-sans-serif, system-ui, sans-serif; }
  ```
- Vue Flow's own UI (the zoom controls) inherits the font from the page.
- The system fonts in the fallback stack keep text readable while the font loads (`font-display: swap`,
  which Fontsource sets by default).

The alternative is a Google Fonts `<link>` in `index.html`. That avoids a dependency, but adds a
third-party request (privacy, and a render-blocking stylesheet).

Nunito's letters are slightly wider than the default font's, so the 240px card width and the two-line
clamp are checked visually with the real payload texts.

### 2.8 Layout sizes

`store.hydrate` passes `getNodeSize = (node) => NODE_REGISTRY[getNodeKind(node)].size` into
`computeLayout`. The pills are short (28px), so the branch labels sit close to Business Hours and to
their child, as in the mockup.

### 2.9 Validation grows with what we read (decision 2f)

Descriptions read type-specific fields (`data.payload`, `data.comment`, `data.times`, `data.timezone`,
`data.description`). As planned in Spec 01 §3.6, **validation is extended to cover them**, so bad
content is still rejected at the API boundary:

- `data.description`: a string, if present.
- `sendMessage`: `data.payload`, if present, is an array of `{ type: 'text', text: string }` or
  `{ type: 'attachment', attachment: string }`.
- `addComment`: `data.comment` is a string, if present.
- `dateTime` + `businessHours`: `data.times`, if present, is an array of
  `{ day: 'mon'…'sun', startTime: 'HH:mm', endTime: 'HH:mm' }`; `data.timezone` is a string, if present.

The description functions also **tolerate missing fields** (fallback text), so a node that's valid but
sparse (e.g. freshly created) still renders.

Validation has outgrown `graph.js`, so it moves to its own file, **`utils/payloadValidation.js`**
(`findPayloadError` keeps its name and behaviour, and its tests move with it).

---

## 3. Implementation

### 3.1 Dependencies (decisions 2a, 2h)

- **`@lucide/vue`** (ISC licence, tree-shakable, so only the ~7 icons used are bundled). Its older name
  `lucide-vue-next` is deprecated. The alternative is hand-copying 7 SVG paths into `BaseIcon`: no
  dependency, but more code to maintain and review.
- **`@fontsource-variable/nunito`** (OFL licence): the self-hosted Nunito variable font (see 2.7).

### 3.2 Files

```
src/utils/
  nodeRegistry.js        NEW   NODE_REGISTRY, getNodeConfig(node), getNodeSize(node), isEditable(node)
  nodeDescription.js     NEW   getNodeTitle(node) (moved from nodeKind.js), getNodeDescription(node), getAttachmentName(url), collapseWhitespace(text)
  businessHours.js       NEW   WEEK_DAYS, DEFAULT_TIMEZONE, isTimeString(value)
  payloadValidation.js   NEW   findPayloadError (moved from graph.js + type-specific rules)
  nodeKind.js            EDIT  getNodeTitle removed (moved, see 3.4); humanize exported for descriptions
  graph.js               EDIT  validation removed (moved)
  vueFlowAdapter.js      EDIT  type = kind; data = display object from the display map
src/stores/flow.js       EDIT  hydrate passes getNodeSize; new getter nodeDisplayById
src/api/flowApi.js       EDIT  import path of findPayloadError
src/components/
  ui/BaseIcon/           NEW   BaseIcon.vue (+ spec): name → Lucide icon; decorative unless given a label
  nodes/nodeTypes.js     NEW   markRaw({ trigger: NodeCard, …, success: ConnectorNode, failure: ConnectorNode })
  nodes/NodeCard/        NEW   NodeCard.vue (+ spec)
  nodes/ConnectorNode/   NEW   ConnectorNode.vue (+ spec)
  canvas/FlowCanvas/     EDIT  :node-types, display map → adapter
src/assets/main.css      EDIT  Nunito import + --font-sans, final palette, handle and node styles
```

### 3.3 Contracts

**`utils/nodeRegistry.js`**
- `NODE_REGISTRY`: frozen, keyed by `NODE_KIND` (table 2.1).
- `getNodeConfig(node)` → the registry entry for `getNodeKind(node)` (always defined; unknown → `unknown`).
- `getNodeSize(node)` → `getNodeConfig(node).size`. `isEditable(node)` → `getNodeConfig(node).editable`.

**`utils/nodeDescription.js`**
- `collapseWhitespace(text)` → trimmed, with runs of whitespace replaced by single spaces.
- `getAttachmentName(url)` → the last path segment, without query/hash and URL-decoded
  (`https://x/id/396/536/354.jpg?hmac=…` → `354.jpg`). An invalid URL falls back to the raw string.
- `getNodeDescription(node)` → the string from table 2.2 (`''` for pills).

**`utils/businessHours.js`** (the business-hours domain, grown further by Spec 05)
- `WEEK_DAYS = ['mon', …, 'sun']`, and `DEFAULT_TIMEZONE = 'UTC'`.
- `isTimeString(value)` → true for a valid 24-hour `HH:mm` (`'09:00'`, `'23:59'`; not `'24:00'`, `'9:00'`).
- Used by the validation (day names, time format) and by the description's timezone fallback.

**`stores/flow.js`**
- New getter `nodeDisplayById: computed<Map<id, { title, description }>>`. It reads only `name` and
  `data`, never `position`.
- `hydrate` lays out with `getNodeSize`.

**`utils/vueFlowAdapter.js`**
- `toVueFlowNodes(nodes, displayById)` → `{ id, type: kind, position: {...}, data: displayById.get(id) }`.

**`components/nodes/NodeCard`**
- Props (as Vue Flow passes them): `id`, `type`, `data: { title, description }`, `selected`.
- Reads its icon, label, colour and editability from `NODE_REGISTRY[type]`. It never touches the store.
- Renders `<Handle>`s from `@vue-flow/core` (none at the top for the trigger).
- Root has `data-kind` and `data-editable` attributes, which the CSS and the tests use.

**`components/nodes/ConnectorNode`**: props `type`, `data`, `selected`. Renders the pill, with handles.

**`components/ui/BaseIcon`**: props `name` (required, validated against its icon map), `size`
(default 16), `label` (if set: `role="img"` + `aria-label`; otherwise `aria-hidden="true"`).

### 3.4 Deviation found during implementation

- **`getNodeTitle` lives in `nodeDescription.js`, not `nodeKind.js`.** Its fallback is now the registry label,
  and the registry imports `NODE_KIND` from `nodeKind.js`. Keeping it there would create a circular import
  (`nodeKind` → `nodeRegistry` → `nodeKind`), and `NODE_KIND` would be read before it exists. Titles and
  descriptions are both display text, so they now sit together.

### 3.5 Stacked PRs

| PR | Branch | Contents |
|---|---|---|
| 2a | `feature/02a-node-foundation` | This spec; `.gitignore` (.vite); registry, descriptions, business-hours constants, validation move + extension, title change, + tests |
| 2b | `feature/02b-node-components` | `@lucide/vue`; BaseIcon, NodeCard, ConnectorNode, nodeTypes map, final colour palette (the components read it), + tests |
| 2c | `feature/02c-node-canvas` | `@fontsource-variable/nunito`; store display map + sizes, adapter, FlowCanvas wiring, font + handle styles, + tests, docs |

---

## 4. Tests

| file | cases |
|---|---|
| `utils/nodeRegistry.spec.js` | every kind has a complete entry; editable is true only for the 3 editable kinds; `getNodeConfig`/`getNodeSize` for each kind and for unknown/missing nodes |
| `utils/nodeDescription.spec.js` | `getNodeTitle`: name wins (trimmed), otherwise the registry label, so the trigger is "Trigger"; `data.description` wins, but blank ones are ignored; every row of table 2.2 against the real payload; text → attachment → fallback order; whitespace collapsed; `getAttachmentName` for the payload URL, query/hash, encoded names, trailing slash, invalid URL |
| `utils/businessHours.spec.js` | `WEEK_DAYS` order; `DEFAULT_TIMEZONE`; `isTimeString` accepts `00:00`/`09:00`/`23:59` and rejects `24:00`, `9:00`, `09:60`, `0900`, non-strings |
| `utils/payloadValidation.spec.js` | all existing `findPayloadError` cases (moved), plus one case per new rule in 2.9; the real payload is still valid |
| `utils/nodeKind.spec.js` | `humanize` (camelCase → words, first letter capitalised); title tests move to `nodeDescription.spec.js` |
| `utils/vueFlowAdapter.spec.js` | `type` is the kind; `data` is the **same object** as in the display map |
| `stores/flow.spec.js` | `nodeDisplayById` values for the payload; **not recomputed when positions change** (same object identity after `updateNodePositions`); layout uses pill sizes (the pills' y spacing is smaller than the cards') |
| `components/ui/BaseIcon/BaseIcon.spec.js` | renders an svg for each name; size; decorative vs labelled a11y; invalid name is rejected by the validator |
| `components/nodes/NodeCard/NodeCard.spec.js` | title, description, icon per kind; clamp class + `title` tooltip with the full text; `data-editable` true/false; selected state; the trigger has no target handle and the others do (Handle stubbed) |
| `components/nodes/ConnectorNode/ConnectorNode.spec.js` | label and icon for success/failure; tone attribute; handles |
| `components/canvas/FlowCanvas/FlowCanvas.spec.js` | passes `nodeTypes` covering every kind; nodes carry kind types and display data |

---

## 5. Acceptance criteria

- [ ] Cards show icon + title + a description clamped to 2 lines; hovering shows the full text.
- [ ] Trigger: "Trigger" / "Conversation Opened". Business Hours: "Business Hours - UTC".
      Messages show their text. The comment shows the comment.
- [ ] Success/Failure render as green/red pills on the branch lines.
- [ ] Editable cards show a pointer and a hover state; display-only nodes don't; all nodes still drag.
- [ ] After a drag, titles and descriptions aren't recomputed (display objects keep their identity; tested).
- [ ] The real payload still validates; malformed type-specific fields are rejected with a clear message.
- [ ] The whole app, including the Vue Flow controls, renders in Nunito, served from the app bundle (no Google request).
- [ ] `npm run lint` is clean; `npm run test:run` is green; `npm run build` succeeds.

## 6. Decisions (confirmed 2026-09-22)

| # | Decision | Proposal |
|---|---|---|
| 2a | Icons | ✅ Add `@lucide/vue` (tree-shaken), behind our own `ui/BaseIcon` |
| 2b | Components | ✅ One `NodeCard` for all card kinds + one `ConnectorNode` for pills, driven by the registry (not one component per kind) |
| 2c | Business hours description | ✅ Follow the mockup: "Business Hours - <timezone>" (the hours are shown in the Spec 05 drawer) |
| 2d | Truncation | ✅ CSS `line-clamp-2` + a `title` tooltip, not a JS character limit |
| 2e | Pill colours | ✅ Green Success / red Failure (the mockup has both light blue) |
| 2f | Validation | ✅ Moved to `utils/payloadValidation.js` and extended to the fields we now read |
| 2g | Trigger title | ✅ "Trigger", with the event as its description (matches the mockup; changes Spec 01) |
| 2h | Typeface | ✅ Nunito, self-hosted via `@fontsource-variable/nunito` (not a Google Fonts link) |
