# Progress Log

Newest entries first.

---

## 2026-09-23: Undo and redo move to the canvas, and the missing specs

Branch: `feature/10-time-picker` (same working branch)

**Done**

- **Undo and redo left the header** for the top of the canvas’s own control column, above the
  zoom buttons, built from Vue Flow’s `ControlButton` so the column reads as one set of controls.
  Taking a change back is something you do to the canvas, and the canvas already had a place for
  that; in the header they sat beside Create New Node, which opens a form instead. This reverses
  decision 6i, and Spec 06 §3.4 now says so rather than quietly disagreeing with the code.
- The canvas is told what the buttons say and whether they work; the view decides. That rule —
  `store.canUndo && !isWriting` — is the same one the shortcuts use, and stating it twice is how
  two halves of one feature drift apart.
- `BaseIconButton` existed only for the header pair and is gone with them. An unused component in
  a kit is a thing a reader has to rule out.
- **Spec 10** (the time picker) and **Spec 11** (adding a step at a point) written, and the log
  backfilled for features 06–09. Both specs say plainly that they were written after the build;
  the point of the record is that it is true, not that it flatters the order things happened in.

**Next**

- A code review over the whole working tree, then split it into branches by topic and open the
  PRs in order. Nothing is committed yet.

---

## 2026-09-23: Two more from reading the brief again

Branch: `feature/10-time-picker` (same working branch)

**A message appearing on a form the user was leaving**

Opening the create form and closing it again left "Title is required" on the field as the panel
slid away. The field is focused on open, so pressing Cancel blurred it, which marked it touched.
Keeping the auto-focus — it saves a click on a form whose first field is always filled — a field
is now marked only when focus moves to **another field in the form**. Leaving the form is not
moving on.

**The card was cutting the wrong line**

The brief says a node shows a truncated _description_, and neither it nor the mockup cuts the
message. Ours did the opposite once a description existed: the description took the first line and
squeezed the message into the second with an ellipsis. Now the description is the one cut to a
single line and the message gets three, with the card grown from 88px to 124px to hold them. Both
still end in an ellipsis when there is more than they can show — which, at three lines, a message
rarely does.

One height for every card, rather than each sizing to its own content: the layout spaces rows by
the height it is told, so per-node heights would mean measuring each card after it renders and
laying the flow out a second time. The cost is white space on a card with one line to say.

The tests that had the old height written into them now read it from the registry, and the ones
that checked positions against numbers taken from an earlier layout compare against the positions
they actually find — they were testing the arithmetic of one particular card size, not the rule.

---

## 2026-09-23: A "+" between steps, and two bugs the user found

Branch: `feature/10-time-picker` (same working branch as the picker below)

**Done**

- **The mockup’s "+" on a connector.** Every edge is now our own `FlowEdge` component, which draws
  the curve and puts a "+" halfway along it. Clicking one opens the create form already set to that
  place — still a field, so it can be thought better of without closing and starting again.
- **And under the end of a branch**, hanging off a short dashed stub: there is nothing there yet,
  and the "+" is the offer to put something there. Same button in both places, so it is one
  component with two placements rather than two that have to be kept looking alike.
- Where a "+" appears is the registry’s own rule, not a new one: a step can be added after anything
  that `canHaveChildren`. That is already false for a condition, so the two lines under Business
  Hours have no "+" — a Success or Failure branch has to stay attached to its condition.
- Tests: 53 files, 1017 tests. Lint clean, build fine.

**The two bugs**

- **A link could only be typed once.** An attachment part showed as a tile as soon as it had any
  value at all, so the first character turned the field into a tile and there was nowhere left to
  type. A link keeps its field until the user leaves it, and becomes a tile on blur.
- **Clicking quickly from step to step opened nothing.** `paneClickDistance` was raised for the
  canvas earlier, but a node has its own `nodeDragThreshold`, which Vue Flow defaults to one pixel.
  A click that drifts becomes a drag, and d3 swallows the click that ends a drag — so the drawer
  stayed on the step before. Both now use the same 4px slop, which is the same bug as the pane one
  and should have been fixed with it.

---

## 2026-09-23: Features 06–09, written up after the fact

Branches: `feature/06a-history-store` → `06b-history-ui`, `fix/audit-gaps`,
`feature/07-save-feedback`, `fix/pane-click-slop`, `feature/08-attachment-tiles`,
`feature/09-card-summary` · Spec: `docs/specs/06-undo-redo.md` (06 only)

These shipped in one long session and the log was not kept up. Recorded here from the branches
and the commits, so the record has no hole in it — briefly, and marked for what it is.

**Undo and redo (PRs #18, #19).** Snapshots rather than inverse commands, because creating a
condition re-lays out the whole flow and reversing that is a snapshot whatever it is called. One
store action, one entry; each entry labelled, so a button can say what it would take back.
Cmd/Ctrl+Z, ignored inside a text field — the drawer is non-modal, so without that guard undoing
a typo would have deleted a node.

**The audit (PR #20).** A pass against the brief’s own checklist found four gaps. The trigger
went back to display-only: Spec 04 had argued from the brief’s wording, which names only Success
and Failure, but the checklist names the three editable kinds and that outranks an inference.
Attachments became preview tiles, files could be uploaded, and a comment could be cleared.

**Saying what happened (PR #21).** Saving leaves the drawer open, which suits editing but meant a
save announced itself only by a button going grey. A toast in the bottom-left corner, clear of the
zoom controls, names what happened; `role="status"`, so a screen reader hears it at the next pause.

**A pixel of drift (PR #22).** Clicking the canvas to close the drawer sometimes did nothing: Vue
Flow allows no movement at all between press and release before it calls the gesture a pan, and a
pan swallows the click. Reported by the user, not by a test. The same bug on nodes was found later
(see above) — the fix here should have covered both.

**Attachments as tiles, and a lightbox (PR #23).** The brief asks for tile previews; ours were a
row of URL fields. A picture shows itself and opens full size; a file shows a named box.

**What a card holds (PR #24).** Writing a description replaced the message on the card, which is
the one thing the card is for. Both now show, on their own lines.

---

## 2026-09-23: A real time picker for business hours

Branch: `feature/10-time-picker`

**Done**

- The brief asks for a date-time picker on business hours, and the mockup draws a clock menu. The
  fourteen `<input type="time">` fields became `@vuepic/vue-datepicker` in time-only mode: 24-hour,
  five-minute steps, its menu teleported to the body so the drawer cannot clip it, themed by
  pointing its own `--dp-*` variables at our tokens rather than overriding its rules.
- `toClockParts` / `fromClockParts` in `utils/businessHours.js` are the whole of the translation
  between the payload’s `HH:mm` and the picker’s `{ hours, minutes }`. Nothing behind the grid —
  the draft, the validation, `data.times` — knows a picker is involved.
- A clock icon in place of the picker’s default calendar, through its `input-icon` slot: these
  fields hold no date.
- Tests: 51 files, 971 tests. Lint clean, build fine.

**What the browser caught, twice over**

The picker’s menu opens on a click and nothing else, so a keyboard user could reach a time field
and never open it — worse than the native input it replaced. And because the menu is teleported to
the body, the drawer around it read Escape as coming from somewhere else: the menu stayed open, or
the whole drawer closed under it. The grid now answers both keys on the way down — Enter and Space
stand for the click the picker wants, Escape closes the menu and hands the field its focus back —
and passes Escape on when no menu is open, so it is still the drawer’s.

Along the way, three things that only reading the library’s own types settled: v14 exports
`VueDatePicker` by name, groups `is24`/`minutesIncrement` under `timeConfig` and `clearable`/`state`
under `inputAttrs` (passed flat, they are silently ignored), and renames its classes from `dp__x` to
`dp--x`. A test asserting the invalid state is what surfaced the second one.

**Next**

- The user reviews it in the browser → commit, push, PR when asked.

---

## 2026-09-23: Day 3: Feature 5 (edit and delete a node)

Branches: `feature/05a-edit-data` → `05b-edit-ui` → `05c-delete` · Spec: `docs/specs/05-edit-node.md`

**Done**

- Merged PR #11 (the details drawer). Then wrote and confirmed Spec 05, which merges what was going
  to be two specs: editing and deleting share the drawer and the mutation pattern.
- **05a, the data layer.** A node is edited as a _draft_ — one flat, form-shaped object — which
  converts back into the payload's own shapes on save. Validation per kind, including a day that
  must end after it starts. `updateNode` and `deleteNode` on the simulated API, both re-checking
  what they are given; `replaceNode` and `removeNodes` on the store; a composable each.
- **05b, the editing UI.** The mockup's Day | Time grid with a time-zone select reading
  `(GMT+00:00) UTC` (420 zones, straight from the browser's own IANA list), a message-parts editor,
  the comment, and the trigger's once-per-contact. Save appears only once something changed, and
  closing with unsaved changes asks first.
- **05c, delete.** A plain step closes the chain — what followed it moves up to its parent and into
  the row it left. A condition takes both branches with it, after a confirmation naming what goes.
  The trigger has no Delete at all.
- Checked in the browser: saved a time zone and watched the card change to "Business Hours -
  Asia/Tokyo"; end-before-start was refused; deleted Away Message and watched Add Comment #1
  reattach to the Failure branch while the URL returned to `/` on its own.
- Tests: 46 files, 816 tests. Lint clean, build fine.

**The bug the browser caught and the tests didn't**

Saving a business-hours node failed with "Could not save the step" — every time, while all 800-odd
tests passed. `fromDraft` carries over the fields a form doesn't own, and one of those is
`connectors`, taken from the store's node, which is reactive. `structuredClone` refuses a Proxy.
The unit tests never saw it because they all pass plain objects.

It is the same shape as the bug in Spec 01, where `hydrate` tried to clone Vue Query's proxy: Vue's
reactivity leaking into a layer that is meant to be plain data. The drawer now builds from
`toRaw(node)`, and a test mounts it on a reactive node and checks what reaches the API — the kind of
test that only gets written after the browser shows you the problem.

**What the review caught**

- The API's second check couldn't fail for two fields: it validated the node by drafting it, and the
  draft fills in what the canvas would show, so a blank name passed the very guard meant to catch
  input that never went through the form.
- A failed delete left its message behind for good — through "Keep it", through a later successful
  save, and it would have hidden that save's own failure.
- The time-zone list was rebuilt on every pick: 400 zones, a formatter each, re-sorted and
  re-rendered to change one value.
- Messages keyed by position went stale when a message part was removed.
- A delete worked out its consequences 400 ms before applying them, while the canvas stayed usable.

**Next**

- Vercel, then the README. Those two are the only required things still missing.
- Undo/redo stays out, by decision.

---

## 2026-09-23: Day 3: Feature 4 (node details drawer)

Branch: `feature/04-node-drawer` · Spec: `docs/specs/04-node-drawer.md`

**Done**

- Merged the Feature 3 stack (#7 → #8 → #9 → #10) into `main`, retargeting each PR before deleting
  any branch. `main` is green: 572 tests at that point, build fine.
- Wrote and confirmed Spec 04 (decisions 4a–4h), then built all three layers on one branch.
- `getNodeProperties(node)`: a pure list of what a node has to show — the trigger's event and its
  once-per-contact setting, a message's parts in order, a comment, and business hours as the whole
  week with a time zone. Attachments carry their file name and whether they look like an image.
- `useSelectedNode()`: the route is the selection. It resolves `/node/:id` to a node, toggles the
  open one closed, switches straight to another, and sends a link that can't be opened back to `/`.
- `NodeDetailsDrawer` + a `modal` prop on `BaseDrawer`, so this panel leaves the canvas live.
- The canvas: a ring on the selected node, a click to open, a click on the empty canvas to close,
  Tab to reach a card and Enter or Space to open it.
- The trigger is now accessible, with its event read-only. The registry flag `editable` is
  `hasDetails`, which is the question it actually answers.
- Code review (high): 6 findings, all fixed.
- Tests: 38 files, 675 tests. Lint clean, build fine.

**What the review caught**

- **The drag guard was wrong in both directions.** Written to stop a drag from opening a drawer, it
  instead swallowed the first real click on any node that had been moved. Vue Flow's own drag
  threshold means a press isn't a drag, and d3 already swallows the click that ends one. Checked in
  the library source, then deleted the guard.
- **Turning off `nodes-focusable` wasn't enough**: the node wrapper binds its keydown handler
  regardless, so the arrow keys moved nodes inside Vue Flow without the store ever knowing.
- Both drawers could be open at once, leaving the details panel painted over a form that had just
  made it inert.

**Worth knowing**

- Checked in the browser: the deep link, the toggle, switching, Escape, the pane click, the pill
  redirect, one tab stop per card, and the arrow keys no longer moving anything. The panel's own
  slide can't be seen there — the automated tab is backgrounded, so Chrome doesn't paint it.

**Next**

- Spec 05: editing inside the drawer, including the mockup's Day | Time grid.

---

## 2026-09-23: Day 3: Feature 3d (create form) — Spec 03 complete

Branch: `feature/03d-create-form` · Spec: `docs/specs/03-create-node.md` §3.5

**Done**

- Opened PR #9 for 3c (stacked on #8).
- `CreateNodeForm`: the four fields, messages shown once a field is left or submit is pressed, a live
  character count, the cursor jumping to the first problem, and fields locked while saving. Its
  submit button sits in the drawer footer, linked by form id.
- `CreateNodeDrawer`: the steps a node can be added after (branches named after their condition),
  the mutation, per-field server messages, and it stays open on failure.
- `FlowView`: the **Create New Node** button, and the canvas centring on the new node.
- `FlowCanvas.focusNode(id)`: moves the viewport, keeping the zoom, skipping the animation under
  reduced motion.
- Checked in the browser by driving the form from the console: the drawer opened with all four
  fields, "Add after" listed six steps with Business Hours excluded, and creating added the node and
  moved the canvas.
- Code review (high): 5 findings, all fixed.
- Tests: 35 files, 572 tests, all passing. Coverage 98.4%.

**Bugs the review caught**

- **Focus was handed back to an inert element.** On close, focus was restored before the background
  stopped being inert, so it fell to the body and the next Tab restarted at the top of the page.
- **Closing during a save didn't cancel it**, so the node still arrived and the canvas panned to it
  after the user had backed out. `BaseDrawer` gained a `dismissible` prop.
- A server message stuck to a field after it had been corrected, and `CreateNodeForm` declared an
  event it never emitted.

**Worth knowing**

- The automated browser tab runs in the background, where Chrome throttles CSS transitions and
  animation frames, so the closing and centring animations freeze part-way there. The logic was
  verified and the rest is covered by tests; the animations need a foreground window.

**Next**

- Merge PRs #7–#10 when the user has reviewed them.
- Then Spec 04: the details drawer, URL-driven, including whether `BaseDrawer` needs a non-modal mode.

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
  config sets `always` for queries only. With no connection the mutation is _paused_, so the drawer
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
