# Progress Log

Newest entries first.

---

## 2026-09-23: Day 3: Feature 3c (form UI kit)

Branch: `feature/03c-form-ui-kit` · Spec: `docs/specs/03-create-node.md` §3.4

**Done**
- Opened PR #8 for 3b (stacked on #7).
- Installed the `frontend-design` skill (personal skills folder, so it's available in every project)
  and wrote a design plan before any code. The owner steered it to "close to the brief, light and
  modern", so the drawer follows the mockup: white, hairline borders, one blue accent
  (`--color-accent`), node colours left to the canvas.
- UI kit: `FormField` (label, required marker, hint/error, and the ids that tie them together),
  `BaseInput`, `BaseTextarea`, `BaseSelect` (with a drawn arrow, since the native one can't be
  styled), `BaseDrawer` (mockup-style right panel, 200 ms slide, reduce-motion respected).
- `useFocusTrap`: focus moves in, Tab cycles, Esc asks to close, focus returns to the opener.
- The primary button moved from indigo to the shared accent token.
- Code review (high): 8 findings, all fixed.
- Tests: 33 files, 532 tests, all passing.

**Bugs found (mine and the review's)**
- The trap didn't arm when a panel mounted already open (the watcher wasn't immediate), and focus
  landed on the close button instead of the first field.
- `offsetParent`, the usual visibility check, always reports null in jsdom, so nothing counted as
  focusable in tests. Reachability is decided by attributes now.
- The review caught a **leaked key listener**: the handler was only removed when the panel closed,
  not when it was destroyed while open, which Spec 04's routed drawer will do. A detached trap would
  have swallowed every later Tab and Escape on the page.
- Also from the review: focus could stay outside a panel with read-only content; hidden and
  `tabindex="-1"` elements counted as focusable; the scrim swallowed clicks while fading out;
  `aria-modal` without inerting the background; `required` never reached the control; and Escape was
  handled globally, which would break popups inside the drawer (Spec 05's pickers).

**Open for Spec 04**
- The create drawer is **modal** (scrim, inert background, click-outside closes), which suits a form.
  The details drawer probably needs the opposite, since the brief has it "toggled by clicking on the
  node": the canvas must stay clickable. That likely means a `modal` prop on `BaseDrawer`.

**Next**
- PR 3d: the create form itself, the header button, and centring the canvas on the new node.

---

## 2026-09-23: Day 3: Feature 3b (create mutation)

Branch: `feature/03b-create-mutation` · Spec: `docs/specs/03-create-node.md`

**Done**
- Opened PR #7 for 3a.
- `flowApi.createNode`: the simulated server. It re-validates the values, assigns ids that aren't
  taken, builds the node(s) and answers after 300 ms, so the pending state is real. Invalid values
  throw `NodeValidationError`, carrying a message per field.
- `useCreateNode`: the mutation. `create(values)` resolves with the new node's id, and the store is
  updated only in `onSuccess`. It exposes `isPending`, `error`, `fieldErrors` and `reset`.
- Checked in the browser by driving the store from the console: a message inserted between Away
  Message and Add Comment #1, with the comment reattached and moved down.
- Code review (high): 2 findings, both fixed (below).
- Tests: 27 files, 479 tests, all passing.

**Bugs the review caught**
- The create mutation inherited TanStack's default `networkMode: 'online'`, because the brief's
  config sets `always` for queries only. With no connection the mutation is *paused*, so the drawer
  would sit on "Creating…" forever. Creating never leaves the browser, so the mutation now sets
  `networkMode: 'always'`. There's a test that creates while offline.
- Adding a **condition** could drop its new failure branch on top of an existing node, because only
  the reattached nodes were moved. Reproduced in the browser (the failure pill landed on Add Comment
  #1).

**Decisions**
- A create that **adds branches** re-runs the layout for the whole flow: a condition needs an extra
  column, so neighbouring branches have to make room. Ordinary inserts still keep dragged positions.
  Agreed with the user; spec §2.3 and decision 3c updated. A test asserts no two nodes overlap.
- `positionBranches` was removed, since branch positions now come from the re-layout.

**Next**
- PR 3c: the UI kit (inputs, select, form field, drawer), using the `frontend-design` skill.
- Then 3d: the form, the header button and centring on the new node.

---

## 2026-09-23: Day 3: Spec 03 + Feature 3a (create-node foundation)

Branch: `feature/03a-create-foundation` · Spec: `docs/specs/03-create-node.md` (confirmed)

**Done**
- Merged the Feature 2 stack (#4–#6) into `main`.
- Wrote Spec 03 and confirmed decisions 3a–3j with the user: an "Add after" select, inserting
  between steps, positions below the parent, business hours creating its own success/failure
  branches, Mon–Fri 09:00–17:00 defaults, payload-style ids, required title/description (60/200),
  a pessimistic store update, a right-hand drawer, and centring the canvas on the new node.
- PR 3a (logic only): `validation.js`, `nodeIds.js`, `nodeFactory.js`, `placement.js`, the registry's
  `creatable`/`canHaveChildren` flags, `DEFAULT_TIMES`, and the store's `insertNodes`.
- Code review (high): 9 findings, all addressed. Two were real bugs (see below).
- Tests: 26 files, 462 tests, all passing.

**Bugs the review caught**
- The follower shift was "snap under the new node" rather than "move down by the space added", so a
  branch the user had dragged far down would jump back up. It's now a relative shift, always downward.
- Reparented followers moved only vertically, so after a business-hours insert they stayed centred
  under the condition instead of under their new parent, and a later insert on the failure branch
  could overlap them. The shift now moves both axes.

**Decisions**
- The insert maths lives in `placement.js` (`getInsertShift`, `shiftSubtree`) as pure functions; the
  store only applies them, which makes the edge cases unit-testable.
- `creatable` is an explicit registry flag rather than being derived from `editable`, so Spec 04's
  trigger decision can't accidentally add "Trigger" to the create form.

**Next**
- PR 3b: `flowApi.createNode` + the `useCreateNode` mutation.
- Then 3c (UI kit: inputs, select, drawer) and 3d (the form, header button, centring), using the
  newly installed `frontend-design` skill.

---

## 2026-09-22: Day 2: Features 2b + 2c (node components, canvas wiring)

Branches: `feature/02b-node-components` → `feature/02c-node-canvas` (stacked on 2a)

**Done**
- 2b: `@lucide/vue` behind `ui/BaseIcon`; `NodeCard` (cards) and `ConnectorNode` (pills), both driven
  by the registry; `nodeTypes` derived from the registry; final colour palette.
- 2c: the store's `nodeDisplayById` (titles/descriptions, independent of positions) and registry
  sizes for the layout; the adapter passes the kind as the Vue Flow type and reuses the display
  objects; `FlowCanvas` registers `nodeTypes`; Nunito self-hosted via Fontsource; quieter handles.
- Checked in the browser: the canvas matches the mockup. Nunito loads from the bundle (no external
  request); editable cards show a pointer and the others the default cursor; the trigger has only an
  output handle; descriptions clamp at 2 lines; selection shows the accent border; dragging works.
- Code reviews:
  - 2b flagged the success/failure colours missing from `main.css`. The palette moved into 2b, so
    that PR is correct on its own.
  - 2b noted the components aren't wired in yet, which is by design (2c).
- Tests: 23 files, 343 tests, all passing.
- Pushed the 2a → 2b → 2c stack as PRs #4, #5, #6.

**Follow-ups on 2c (after review of the PRs)**
- Replaced the string regexes in the 2a utilities with step-by-step code: `trimText` (HTML already
  collapses whitespace), `new URL(url, base)` for attachment names, an explicit
  `TRIGGER_EVENT_LABELS` table (an i18n library in a real implementation), and a split-and-check
  `isTimeString`. The code review caught a prototype lookup in the label table, now guarded with
  `Object.hasOwn`.
- **Decision 2i:** node components are registered with named slots in `FlowCanvas`
  (`#node-<type>`), not a generated `nodeTypes` map, so the canvas template shows exactly what renders
  each kind. `nodeTypes.js` was removed. A test fails if a registered kind has no slot.
- Tests: 22 files, 357 tests, all passing.

**Issues hit**
- An HTML comment above the pill's root element made the component render two root nodes, so
  attributes and classes couldn't be read from its root. The comment moved into the script.
- With `nodeTypes`, Vue Flow passed every node prop to our components, and `inheritAttrs: false` kept
  them off the DOM. With slots, only `type`, `data` and `selected` are passed, so that guard was
  removed.
- Shell-generated file edits mangled `${…}` template literals and backticks twice. Those files are now
  written directly.

**Next**
- Merge #4 → #5 → #6 when the user asks.
- Then Spec 03: the Create Node form.

---

## 2026-09-22: Day 2: Feature 2a (node foundation)

Branch: `feature/02a-node-foundation` · Spec: `docs/specs/02-custom-nodes.md` (confirmed)

**Done**
- Merged the Feature 1 stack (#1–#3) into `main`.
- Spec 02 confirmed with decisions 2a–2h. The Business Hours card follows the mockup
  ("Business Hours - UTC"), and the app uses the Nunito font, self-hosted.
- `nodeRegistry.js`: one settings table per kind (label, icon, card/pill, editable, accent, size).
- `nodeDescription.js`: titles (the trigger is now "Trigger", as in the mockup) and derived descriptions.
- `businessHours.js`: day names, `DEFAULT_TIMEZONE = 'UTC'`, `HH:mm` check.
- `payloadValidation.js`: validation moved out of `graph.js` and extended to message items,
  comments, business-hours times/timezone and descriptions.
- Code review (high): no code issues; it flagged the two test files still using the moved functions,
  which were updated in the tests step.
- Tests: 19 files, 285 tests, all passing. Coverage 99.2% statements / 99.0% branches.

**Decisions**
- Business hours are wall-clock times in the node's own timezone, shown as stored and never converted.
  The default timezone is UTC (also for new nodes in Spec 03).
- `getNodeTitle` moved to `nodeDescription.js` to avoid a circular import (spec §3.4).
- ESLint ignores `.vite/` (Vite's dependency cache was being linted).

**Next**
- PR 2a on request, then 2b: `@lucide/vue`, BaseIcon, NodeCard, ConnectorNode.

---

## 2026-09-21: Day 1: Feature 1 (Scaffold + Canvas)

Branch: `feature/01-scaffold-canvas` · Spec: `docs/specs/01-scaffold-canvas.md`

**Done**
- Scaffolded Vite + Vue 3 + Pinia + Vue Router + Vue Flow + Vue Query + Tailwind v4, with ESLint,
  Prettier and Vitest set up.
- Payload → Query → `store.hydrate` (normalise ids, derive edges, tree layout) → Vue Flow. Nodes
  drag, and positions are saved once per drag.
- The first UI kit components: `BaseButton`, `BaseSpinner`, `EmptyState`.
- Checked in the browser: the tree matches the mockup, edges are coloured by source kind, dragging
  keeps selection, Backspace deletes nothing, and unknown paths redirect to `/`.
- The Vue Flow check (spec 3.4) passed in both the code and the running app, so we kept the one-way
  data flow.
- Code review (high): one finding. A malformed payload failed silently with a blank canvas. Fixed
  with `findPayloadError` validation in `fetchFlow`, `InvalidPayloadError` with no retries, and
  `FlowView` only rendering the canvas when the store has hydrated (spec 3.6).
- Tests: 15 files, 175 tests, all passing. Coverage 98.9% statements / 99.3% branches.

**Issues hit**
- Node 23.3 isn't supported by Vitest 4/5 (odd-numbered Node release) → moved to Node 24 LTS and
  added `.nvmrc` + `engines`.
- npm 11 blocks install scripts by default → approved `esbuild` and `vue-demi` in `allowScripts`.
- `structuredClone` throws on Vue Query's reactive data → `toRaw` in `hydrate`. The build didn't
  catch it, the browser did, and there's now a regression test.
- TanStack Query pauses retries while the tab isn't focused. That exposed pointless retries of
  invalid content, which led to the retry policy above.

**Decisions**
- Validation lives at the API boundary (one error path, through Query), plus a safety net in the
  view (never show a blank canvas as if it were an empty flow).
- Two ESLint Vue rules are turned off for `*.spec.js` only (test stubs define several components).

**Next**
- The user reviews Feature 1 → commit, push, PR, merge into `main` when asked.
- Then Spec 02: custom node components.

---

## 2026-09-21: Day 1: Setup & planning

**Done**
- Read the brief and downloaded `payload.json` into `public/` (unchanged from source).
- Analysed the payload: a flat node list with no edges and no positions; mixed id types; `businessHours` is
  stored as `dateTime`, and success/failure as `dateTimeConnector`; no descriptions.
- Wrote `CLAUDE.md` (stack, architecture rules, payload facts, conventions, workflow).
- Drafted `docs/specs/01-scaffold-canvas.md`.

**Decisions**
- JavaScript with JSDoc types (TS is optional in the brief); Tailwind with no component library; npm.
- Workflow per feature: spec → confirm → implement → code review → tests → log → commit on request.

**Next**
- Confirm Spec 01, then scaffold and implement it.
