# Spec 03: Create Node

Status: **Confirmed 2026-09-23** (decisions 3a–3j). PR 3a (utils + store) is built; 3b–3d are next.
Brief: *"Add a **Create New Node** button on the page for creating nodes with the following fields:
Title (text field), Description (text field), Type of Node (select field): Send Message
(`sendMessage`), Add Comments (`addComment`), Business Hours (`businessHours`)."* Also: *"All input fields
should have necessary validations"* and *"Utilized Query for data fetching and mutation updates"*.

---

## 1. Goal

A **Create New Node** button opens a form with Title, Description and Type, plus where to put the node.
On submit, the form is validated, the node is created through a **Vue Query mutation**, the
**Pinia store** is updated when it succeeds, and the new node appears on the canvas.

**Out of scope:**
- Editing or deleting nodes, and the drawer (Specs 04–05).
- Type-specific content: message texts, attachments, the business-hours grid (Spec 05). A new node
  starts with empty or default content.
- Persistence across refresh (localStorage, Spec 06).
- The mockup's "+" buttons on edges (not required; a possible later way into the same form).

---

## 2. Design

### 2.1 How a create flows through the layers

```
[Create New Node] button ──opens──▶ CreateNodeDrawer (form, slides in from the right)
        submit ──validate (utils/validation)──▶ errors? show them next to the fields, stop
            │ valid
            ▼
useCreateNode().mutate(values)                      ← composable wrapping useMutation
    mutationFn: flowApi.createNode(values)          ← the simulated "server": builds the node(s),
            │                                         assigns ids, resolves after a short delay
            │ isPending → "Creating…" button, form locked
            ▼ onSuccess(created)
flowStore.insertNodes(created, placement)           ← Pinia action: the only place state changes
            ▼
canvas re-renders; the drawer closes; the view centres on the new node
```

- **Query runs the request, Pinia holds the result.** The store changes only in `onSuccess`, after the
  "server" has accepted the node. That's the pessimistic approach (decision 3h).
- The `['flow']` query cache isn't touched: after loading, nothing reads it (Spec 01).
- **The "server" builds the node,** as a real backend would. It assigns the id and, for business
  hours, creates the Success/Failure branches. The store just inserts what it's given.

### 2.2 Where the new node goes (decisions 3a, 3b)

The brief's form has no "where" field, but a flow is a tree, and every step needs a place in it.

**3a. The form gets a required "Add after" select** listing the existing steps. ✅ *Confirmed.*
- The **Business Hours** node isn't offered: what comes after it is always its Success/Failure
  branches. To add a step on a branch, pick **Success** or **Failure**.
- The Trigger, messages, comments and the Success/Failure pills are offered.
- Alternatives: create the node **unconnected** (it floats on its own, and the tree has a second root),
  or add it from a **"+" on an edge** (closer to the mockup, but more UI work; could come later).

**3b. "Add after X" inserts the node between X and whatever currently follows X:**
```
before:  Away Message ──▶ Add Comment #1
add a Send Message after "Away Message":
after:   Away Message ──▶ New Message ──▶ Add Comment #1
```
- The new node's `parentId` = X. Every node whose parent was X now has the new node as its parent.
- **Why:** in an automation flow, an ordinary step has **one next step**; only conditions (business
  hours) branch. Inserting keeps that true. Adding as a **new branch** instead would give an ordinary
  step two next steps, which a flow can't mean.
- The alternative: always add as a new child (a sibling branch). It's simpler, but it produces
  meaningless branches.

**What the user sees (the question for 3b):** the payload's Failure branch, adding a Send Message
"after Away Message".

```
 BEFORE                                  AFTER (insert between, proposal)       AFTER (new branch, alternative)

   ✕ Failure                               ✕ Failure                              ✕ Failure
      │                                       │                                      │
 ┌──────────────┐                        ┌──────────────┐                       ┌──────────────┐
 │ ➤ Away       │                        │ ➤ Away       │                       │ ➤ Away       │
 │   Message    │                        │   Message    │                       │   Message    │
 └──────────────┘                        └──────────────┘                       └──────────────┘
      │                                       │                                   ┌──┴───────┐
 ┌──────────────┐                        ┌──────────────┐                ┌──────────────┐ ┌──────────────┐
 │ 💬 Add       │                        │ ➤ New        │  ← new         │ 💬 Add       │ │ ➤ New        │
 │   Comment #1 │                        │   Message    │                │   Comment #1 │ │   Message    │
 └──────────────┘                        └──────────────┘                └──────────────┘ └──────────────┘
                                              │
                                         ┌──────────────┐
                                         │ 💬 Add       │  ← moved down one row
                                         │   Comment #1 │
                                         └──────────────┘
```
- **Insert between:** the flow still reads as one line, "Away → New Message → Comment". The comment
  moves down to make room.
- **New branch:** "Away" now has two next steps side by side. In a real automation that's ambiguous
  (which one runs?), which is why this spec proposes inserting between.
- *Status: ✅ confirmed: insert between.*

### 2.3 Where it's drawn: positions (decision 3c)

The layout isn't re-run for the whole flow, because that would throw away the user's drags. Instead:
- the new node goes **directly below X** (centred under it, one row down);
- everything that now comes after it (the subtree it was inserted above) **moves down by one row**
  (the new node's height + the gap), so nothing overlaps.

```
before                     after inserting N after X
   X  (y)                     X  (y)
   │                          │
   A  (y+row)                 N  (y+row)       ← new
   │                          │
   B  (y+2 rows)              A  (y+2 rows)    ← A and its subtree moved down one row
                              │
                              B  (y+3 rows)
```
- Implemented as two small pure functions: `positionBelow(parent)` and
  `shiftSubtree(nodes, rootIds, dy)`. Both are easy to test and explain.
- Alternatives: re-run `computeLayout` for everything (neat, but loses drags), or drop the node at the
  centre of the screen and let the user drag it (no overlap handling at all).

**Where the *add button* is (the question for 3c).** There are two separate things:

1. **Where the user clicks to add.** With 3a, there's **one** button, **Create New Node** in the page
   header. The position is chosen in the form's "Add after" dropdown. There's **no** button between
   nodes on the canvas.
2. **Where the new node appears.** That's the positions described above: below the chosen step,
   with the following steps moved down.

```
┌─ Header ─────────────────────────────────────────────────────┐
│ Flow Builder                              [ + Create New Node ]│   ← the only add button
└──────────────────────────────────────────────────────────────┘
```

**An option, not part of this proposal:** the mockup also shows small **"+" circles on the edges**
between nodes. If we add them, clicking the "+" between *Away Message* and *Add Comment #1* would
open the same drawer with **"Add after: Away Message" already selected**, so it's a shortcut into the
same form, not a second way of creating. It fits "insert between" naturally, because the "+" sits
exactly where the node will go. It's more canvas work (a custom edge component), so it could be a
follow-up.
- *Status: ✅ confirmed: the header button only. The "+" on edges stays a possible follow-up.*

### 2.4 What a new node looks like in the data (decision 3d)

It uses the **payload's own shape**, so the rest of the app treats created and loaded nodes the same:

| Type chosen | Nodes created (payload shape) |
|---|---|
| Send Message | `{ id, parentId, type: 'sendMessage', name: title, data: { description, payload: [] } }` |
| Add Comments | `{ id, parentId, type: 'addComment', name: title, data: { description, comment: '' } }` |
| Business Hours | **3 nodes**: the `dateTime` node `{ …, data: { description, action: 'businessHours', timezone: 'UTC', times: DEFAULT_TIMES, connectors: [successId, failureId] } }`, plus a `dateTimeConnector` **Success** and a **Failure** node, both children of it |

- **Title → `name`**, as the payload's other nodes use it.
- **Description → `data.description`**, the additive field planned in Spec 02. The card shows it.
- **Business hours always gets its two branches,** exactly as in the payload. A business-hours node
  without them has no meaning in a flow.

**Is this in the brief? (the question for 3d)** **Not directly.** The brief never says "creating a
Business Hours node also creates Success and Failure". What it does say, and show:
- *"Note that success & failure node should not be accessible, purely for display in canvas"*: the
  brief expects Success/Failure nodes to **exist** on the canvas, but gives the user **no way to
  create or edit them**, since they aren't in the create form's type list;
- the **payload** always pairs a Business Hours node with one Success and one Failure node
  (`data.connectors` lists both);
- the **mockup** draws Business Hours with its two branches.

So if creating Business Hours *didn't* add them, a new Business Hours node could **never** get
branches: there's no other way to create them. Auto-creating them is our **inference** from the
brief, not a stated requirement. The README should say so.
- *Status: ✅ confirmed: a business-hours node needs both a success and a failure path, so both are created.*
- **Default business hours (3e):** **Mon–Fri 09:00–17:00**, the typical working week, with timezone
  **UTC** (the default agreed in Spec 02). Alternative: all 7 days, like the payload.
- **Content starts empty:** a message has no texts (`payload: []`), and a comment is `''`. They're
  filled in through the drawer in Spec 05.
- **"Insert between" with business hours:** the nodes that followed X go under the new node's
  **Success** branch, so the existing flow continues on the "open" path. (Alternative: under
  Failure.)

### 2.5 Ids (decision 3f)

New ids look like the payload's: **6 lowercase hex characters** (e.g. `a3f09c`), made from
`crypto.getRandomValues`, and retried if one is already taken. The simulated server assigns them,
as a real backend would. (Alternative: `crypto.randomUUID()`, which is longer but a single built-in call.)

### 2.6 Validation (decision 3g)

Every field is checked **when you leave it (blur)** and **all at once on submit**. The error shows
under the field, and focus moves to the first invalid field on submit.

| Field | Rules | Message |
|---|---|---|
| Title | required (after trimming); max **60** characters | "Title is required" / "Title must be 60 characters or fewer" |
| Description | required (after trimming); max **200** characters | "Description is required" / "…200 characters or fewer" |
| Type | required; one of the three types | "Choose a node type" |
| Add after | required; must be an existing node that is allowed as a parent | "Choose where to add the node" |

- **Why the description is required:** the brief lists all three fields as the form, and says every
  input needs validation. Required also means every created card has a real description.
  (Alternative: optional, and the card falls back to the derived description, as payload nodes do.)
- The limits (60/200) keep titles to one line and descriptions short. They're proposals.
- Validators are plain functions in `utils/validation.js` (`required`, `maxLength`, `oneOf`), combined
  by `validateCreateNode(values, context)` into `{ field: message }`. There are no regexes.
- The same check runs again in the simulated server, so bad input is rejected even if it didn't come
  from the form.

### 2.7 The form's container: a drawer (decision 3i) ✅ *Confirmed: a drawer, like the brief's mockup*

The form opens in a **right-hand drawer**, the same kind of side panel the mockup uses for node
details. The canvas stays visible to its left, so the user sees the new node appear.

```
┌─ Header ──────────────────────────────────────────────────────────────────────────┐
│ Flow Builder                                                  [ + Create New Node ] │
├───────────────────────────────────────────────┬────────────────────────────────────┤
│                                               │ ✚ Create New Node              ✕  │
│            (canvas stays visible)             │ Add a step to the flow.            │
│                                               │────────────────────────────────────│
│       ┌──────────┐                            │ Title *                            │
│       │ Trigger  │                            │ ┌────────────────────────────────┐ │
│       └────┬─────┘                            │ │ Welcome back message           │ │
│       ┌────┴──────────┐                       │ └────────────────────────────────┘ │
│       │ Business Hours│                       │                                    │
│       └───────────────┘                       │ Description *                      │
│              …                                │ ┌────────────────────────────────┐ │
│                                               │ │ Greets returning visitors      │ │
│                                               │ │                                │ │
│                                               │ └────────────────────────────────┘ │
│                                               │                          24 / 200  │
│                                               │ Type of node *                     │
│                                               │ ┌────────────────────────────────┐ │
│                                               │ │ Send Message                 ▾ │ │
│                                               │ └────────────────────────────────┘ │
│                                               │ Add after *                        │
│                                               │ ┌────────────────────────────────┐ │
│                                               │ │ Away Message                 ▾ │ │
│                                               │ └────────────────────────────────┘ │
│                                               │ ⚠ Choose where to add the node     │  ← an error
│                                               │────────────────────────────────────│
│                                               │            [ Cancel ] [ Create ]   │
└───────────────────────────────────────────────┴────────────────────────────────────┘
```

- **Look:** the drawer header follows the mockup's style (icon + title + a short description line),
  the fields are stacked, and the actions are pinned at the bottom. It uses the same Nunito type, the
  slate greys and the accent style as the cards.
- **Motion:** it slides in from the right (about 200 ms, ease-out) and out on close. With the
  system's "reduce motion" setting on, it appears without sliding.
- **Keyboard and screen readers:**
  - `role="dialog"` with an accessible name ("Create New Node");
  - focus moves to the Title field on open and stays inside the drawer while it's open;
  - **Esc** or **✕** closes it, and focus returns to the Create New Node button;
  - every field has a visible label, a `*` for required, and its error linked with
    `aria-describedby` / `aria-invalid`.
- **One drawer component for both uses:** a `ui/BaseDrawer` (the shell: panel, header, close, focus
  handling, motion) is built here and **reused by Spec 04's node-details drawer**. Only one is open at
  a time: opening Create closes a details drawer (by navigating to `/`), and vice versa.
- **Not in the URL (proposal):** the brief only asks for the *details* drawer to live in the URL
  (`/node/:id`), so Create uses local state. (Alternative: a `/create` route, consistent with
  details, but not required.)
- **Closing** (Esc, ✕, Cancel) discards the form. On submit, the drawer stays open **until the
  mutation succeeds**, so a failure can be shown inside it.

### 2.8 After a successful create (decision 3j) ✅ *Confirmed*

The drawer closes, and the canvas **smoothly centres on the new node** (`setCenter` from Vue Flow's
`useVueFlow`), so the user sees where it went.

---

## 3. Implementation (outline; detailed contracts follow once the decisions are confirmed)

### 3.1 New and changed files

```
src/utils/
  validation.js          required, maxLength, oneOf, validateCreateNode, getAllowedParents
  nodeIds.js             generateNodeId(existingIds)
  nodeFactory.js         buildNewNodes(values, ids)  → the payload-shaped node(s) from 2.4
  placement.js           positionBelow, positionBranches, getInsertShift, shiftSubtree, collectSubtreeIds
  businessHours.js       + DEFAULT_TIMES (Mon–Fri 09:00–17:00)
  nodeRegistry.js        + creatable, canHaveChildren, CREATABLE_KINDS
src/stores/flow.js       + insertNodes(created, { insertedId, continuationId })
src/api/flowApi.js       + createNode(values)  (validates, builds, assigns ids, short delay)
src/composables/
  useCreateNode.js       useMutation wrapper → store.insertNodes on success
src/components/ui/
  BaseInput/  BaseTextarea/  BaseSelect/  FormField/  BaseDrawer/   (BaseDrawer is reused by the Spec 04 details drawer)
src/components/forms/
  CreateNodeForm/        fields, validation display, submit/cancel
src/components/canvas/FlowCanvas   centre on the new node
src/views/FlowView       header "Create New Node" button + the create drawer
```

### 3.2 Deviations found while building PR 3a

- **Two new registry flags, instead of rules inside `validation.js`** (CLAUDE.md rule 4: node-type
  behaviour lives in one registry):
  - `canHaveChildren` (false for business hours) drives "Add after" and guards the store action;
  - `creatable` marks the three types the form offers, and `CREATABLE_KINDS` is built from it.
    Deriving it from `editable` would have coupled the form's list to Spec 04's trigger decision, so
    making the trigger editable would offer a type the factory can't build.
- **The insert maths is in `placement.js`, not the store:** `getInsertShift(parent, continuation)`
  returns `{ dx, dy }` and `shiftSubtree(nodes, rootIds, shift)` returns a map of new positions. The
  store only applies them, and the arithmetic is unit-tested directly.
- **`insertNodes(created, { insertedId, continuationId })`:** it finds both nodes **by id** rather
  than by array position, and refuses (with a clear error) when the new node or the continuation is
  missing, when the parent no longer exists, or when the parent is a node that branches.
- **`buildNewNodes` keeps its own set of issued ids,** so the three ids of a business-hours create
  are unique against each other, not only against the ids already in the flow.
- **`validateCreateNode(values)`** works without a context, reporting "Choose where to add the node"
  instead of throwing.

**Two bugs the code review caught, both now tested:**
1. **Followers could jump upwards.** The shift was computed as "put the follower directly under the
   new node". A branch the user had dragged far down would be pulled back up. It's now "move down by
   the space the insert added", which is always positive and keeps the user's own offsets.
2. **Business-hours inserts could overlap.** Reparented followers only moved vertically, so they
   stayed centred under the condition instead of under their new parent (the success branch), and a
   later insert on the failure branch landed on top of them. The shift now moves both axes.

### 3.3 Stacked PRs

| PR | Contents |
|---|---|
| 3a | Where does the new node connect? | ✅ A required **"Add after"** select (Business Hours excluded; pick Success/Failure instead) | Unconnected node; "+" buttons on edges |
| 3b | "Add after" a step that already has a next step | ✅ **Insert between** (see the before/after in 2.2) | Add as a new branch |
| 3c | Position of the new node, and where the add button is | ✅ **Below its parent**, the following steps shift down one row; the **header button** is the only add button | Re-run the full layout; drop at the screen centre; add "+" on edges as a shortcut (possible follow-up) |
| 3d | Business Hours creation | ✅ **Also creates Success + Failure** (a condition needs both paths; inferred from the brief, see 2.4); the following steps continue under **Success** | Continue under Failure; no auto-branches |

### 3.4 Tests (outline)
- **Validation:** every rule and message; trimming; the parent rules (Business Hours not allowed).
- **Ids:** format, uniqueness against existing ids.
- **Factory:** each type's exact shape; business hours makes 3 nodes wired together, with `connectors`.
- **Placement:** below the parent; the subtree shifts by one row; nodes outside it don't move.
- **Store `insertNodes`:** insertion between X and its children; business hours reparents under
  Success; edges update; positions.
- **Mutation:** a real `QueryClient`; the store is updated only on success; a failure leaves the store
  untouched and exposes the error.
- **UI kit:** each control's `v-model`, label/`aria-invalid`/`aria-describedby`, error display; the
  drawer opens and closes, moves focus in and back, and closes on Esc.
- **Form:** errors on blur and submit; focus on the first error; the submit payload; pending state;
  server error shown; closes on success.

---

## 4. Acceptance criteria (draft)

- [ ] A **Create New Node** button in the header opens the form.
- [ ] Title, Description, Type and Add after are all validated, with clear messages.
- [ ] Creating inserts the node after the chosen step; later steps move down one row; nothing overlaps.
- [ ] A new Business Hours node comes with Success and Failure branches.
- [ ] The create goes through `useMutation`; Pinia changes only on success; pending and error states
      are shown.
- [ ] The drawer is keyboard-accessible (focus moves in and is kept there, Esc closes, focus returns to the button) and the view centres on the new node.
- [ ] Lint clean, tests green, build succeeds.

## 5. Decisions (all confirmed 2026-09-23)

| # | Question | Proposal | Alternative(s) |
|---|---|---|---|
| 3a | Where does the new node connect? | ✅ A required **"Add after"** select (Business Hours excluded; pick Success/Failure instead) | Unconnected node; "+" buttons on edges |
| 3b | "Add after" a step that already has a next step | ✅ **Insert between** (see the before/after in 2.2) | Add as a new branch |
| 3c | Position of the new node, and where the add button is | ✅ **Below its parent**, the following steps shift down one row; the **header button** is the only add button | Re-run the full layout; drop at the screen centre; "+" on edges as a later shortcut |
| 3d | Business Hours creation | ✅ **Also creates Success + Failure** (a condition needs both paths; inferred from the brief, see 2.4); the following steps continue under **Success** | Continue under Failure; no auto-branches |
| 3e | Default business hours | ✅ **Mon–Fri 09:00–17:00, UTC** | Mon–Sun, like the payload |
| 3f | New id format | ✅ **6 hex characters**, like the payload | `crypto.randomUUID()` |
| 3g | Validation rules | ✅ Title and Description **required**, max **60 / 200**; checked on blur and on submit | Description optional; other limits |
| 3h | When the store updates | ✅ **After the mutation succeeds** (pessimistic) | Optimistic update with rollback |
| 3i | Form container | ✅ A **right-hand drawer** (like the mockup), built on a reusable `ui/BaseDrawer`; local state, not in the URL | A `/create` route |
| 3j | After creating | ✅ Close, then **centre the canvas on the new node** | Leave the view as it is |
