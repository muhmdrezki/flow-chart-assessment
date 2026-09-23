# Spec 05: Edit and Delete a Node

Status: **Confirmed 2026-09-23** (decisions 5a–5i). Delete is our addition: the brief does not ask for
it, and the README says so.
Brief: the drawer _"displays the node's properties and attachments"_, every input has _"necessary
validations"_, and data changes go through _"Query for data fetching and mutation updates"_. The
mockup's Business Hours drawer is the target: a header with a line about what the step does, a
**Day | Time** grid of `HH:mm ⏱ to HH:mm ⏱` for Mon–Sun, and a **Time Zone** select reading
`(GMT+00:00) UTC`.

---

## 1. Goal

The details drawer stops being read-only. Each kind of node gets the fields that belong to it, a
change is saved through a **mutation**, and the **Pinia** store is updated when it succeeds. A node
can also be deleted.

This is the last feature. It closes the two gaps the brief's wording implies but Spec 04 left open:
the flow can be created and read, but not updated or deleted.

**Out of scope:**

- **Undo/redo.** A nice-to-have in the brief, and the expensive one. Left out by decision.
- Persistence across a refresh. Not in the brief; the README says so and says why.
- Moving a node to a different parent. Nothing in the brief asks for re-parenting by hand.
- Uploading a file. There is no server to upload to; an attachment is a URL in this payload.

---

## 2. Design

### 2.1 How a save flows through the layers

The same path a create already takes, so there is one story for every write:

```
drawer fields ─▶ local draft ─▶ Save ─▶ validate ─▶ useUpdateNode (mutation)
                                                         │ onSuccess
                                                         ▼
                                            store.replaceNode(node)  ─▶ canvas + drawer
```

Nothing is written to the store while the user types. The drawer holds a **draft** copy, and the
store changes only when the mutation succeeds — pessimistic, exactly like the create (decision 3h).
That also means a failed save leaves the canvas untouched and the user's typing intact.

### 2.2 What each kind lets you change (decision 5a)

| kind              | fields                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| every kind        | **Title** (`name`), **Description** (`data.description`)                                                                       |
| trigger           | **Once per contact** (a checkbox). The **event** stays read-only                                                               |
| sendMessage       | the message parts: each text part in a textarea, each attachment with a **Remove**; **Add text** and **Add attachment by URL** |
| addComment        | **Comment** (textarea)                                                                                                         |
| businessHours     | the **Day \| Time** grid and the **Time zone** select (§2.5)                                                                   |
| success / failure | no drawer at all (brief)                                                                                                       |

The trigger's event stays read-only for the reason Spec 04 gave: the payload defines exactly one
event, and a select listing events the product never mentions would be invented data.
`oncePerContact` is a real boolean the payload already carries, so it is editable.

### 2.3 Draft, save and discard (decision 5b)

An explicit **Save**, not a save on every keystroke. One mutation per save keeps the pending and
error states legible, matches the create form, and means a half-typed time never reaches the store.

- The footer has **Save** and **Delete**. Save is disabled until something actually changed.
- Saving shows the button as busy, and the panel can't be dismissed while it is in flight (the
  `dismissible` prop `BaseDrawer` already has).
- A failure keeps the drawer open with the message under its field, like the create form.
- Closing the drawer with unsaved changes **discards them**, and the drawer says so before it does:
  a small inline confirmation in the footer, not a second dialog on top of a dialog.
- Switching to another node counts as closing.

### 2.4 Validation (decision 5c)

Shared validators from `src/utils/validation.js`, extended rather than duplicated:

| field          | rule                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| Title          | required, ≤ 60 (the create form's limits)                               |
| Description    | ≤ 200. **Not required** when editing: the payload's own nodes have none |
| Comment        | required                                                                |
| Message        | at least one part, and a text part can't be blank                       |
| Attachment URL | required, and a URL the browser can parse                               |
| Business hours | each open day needs both times, valid `HH:mm`, and **end after start**  |

"End after start" is the one genuinely new rule. Times are wall-clock strings in the node's own
timezone, so they compare as strings once they are known to be `HH:mm` — `"09:00" < "17:00"`. No
dates, no timezone maths, which is the whole point of storing them this way.

Validation runs in `validateNode(node)` — one pure function, called by the drawer on save **and** by
the fake API before it accepts the change, the same double-check `createNode` already does.

### 2.5 The business-hours grid (decision 5d)

The mockup's centrepiece, and the last piece of it we haven't built:

```
Day        Time
Monday     [09:00] ⏱  to  [17:00] ⏱        [x] open
Tuesday    [09:00] ⏱  to  [17:00] ⏱        [x] open
…
Sunday     —                                [ ] open
```

- Seven rows, Monday to Sunday, always all seven: a closed day is stated, not missing.
- A checkbox opens or closes the day. Unchecking keeps the times on screen but greys them out, so
  re-opening a day doesn't mean typing them again; on save, a closed day is simply left out of
  `data.times`.
- The times are `<input type="time">`. It is a real, accessible, keyboard-friendly control that every
  target browser has, it produces exactly the `HH:mm` the payload stores, and it costs nothing —
  where a hand-built clock popup would cost a day and be worse. The mockup's ⏱ is the native
  control's own icon.
- A **Copy Monday to every day** shortcut, because filling seven identical rows by hand is the first
  thing anyone would complain about.

### 2.6 Time zones (decision 5e)

The select shows `(GMT+00:00) UTC`, as the mockup does. The list comes from
`Intl.supportedValuesOf('timeZone')` — every IANA zone the browser knows, with no dependency and no
hand-kept list to go stale. Each label's offset is read from `Intl.DateTimeFormat` with
`timeZoneName: 'longOffset'`, and the list is sorted by offset, then by name.

Two things to be honest about in the code:

- The offset shown is **today's** offset, so a zone on summer time reads `(GMT+01:00)`. That is
  cosmetic: the app stores the zone's name and never converts a time with it.
- `Intl.supportedValuesOf` is recent. If it is missing, the list falls back to the zones the flow
  already uses plus `UTC`, so the select always contains the node's own value.

### 2.7 Deleting a node (decisions 5f, 5g)

**Delete** sits in the drawer footer, styled as the destructive action and separated from Save. It
asks first — an inline confirmation in the footer that says exactly what will go.

What happens to what came after depends on the node:

| node                    | what is deleted                                          | what happens to the rest                             |
| ----------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| trigger                 | nothing: **no Delete button**                            | a flow has to start somewhere                        |
| sendMessage, addComment | just that node                                           | its children move up to its parent: the chain closes |
| businessHours           | the node **and both branches and everything under them** | nothing else moves                                   |
| success / failure       | no drawer, so no way to ask                              | they belong to their condition                       |

A condition can't close a chain up, because its two branches can't both become the parent's next
step. So Business Hours takes its subtree with it, and the confirmation names the count: _"Delete
Business Hours and the 4 steps under it?"_

**Positions.** A chain that closes up would otherwise leave a hole where the node was, so the
children that moved up are shifted into its place, along with everything under them — the same
`shiftSubtree` the insert uses, in the other direction. Deleting a branch leaves the rest of the
canvas exactly as it was. Neither case re-runs the layout, so hand-dragged positions survive.

After a delete the node is gone, so the drawer closes: `replace('/')`, not push — Back should not
return to a node that no longer exists.

### 2.8 The drawer's purpose line (decision 5h)

The mockup's drawer explains the step under its title: _"Allows a branch to be created based on date
& time conditions…"_. Spec 04 put the kind's label there instead, and then dropped it when it simply
repeated the title — so the Business Hours drawer currently has no second line at all.

Each kind gets a `purpose` in the registry, and the drawer shows that. It is the kind of copy that
makes an editor legible to someone who didn't build the flow, and the registry is already the one
place node-kind differences live.

---

## 3. Implementation

### 3.1 New and changed files

```
src/utils/validation.js                                 + validateNode, time rules
src/utils/timezones.js                (new)             the zone list and its labels
src/utils/nodeEdit.js                 (new)             draft ⇄ node: read fields, write them back
src/utils/nodeRemoval.js              (new)             what a delete takes with it, and the shift
src/utils/nodeRegistry.js                               + purpose, + deletable
src/api/flowApi.js                                      + updateNode, deleteNode
src/composables/useUpdateNode.js      (new)
src/composables/useDeleteNode.js      (new)
src/stores/flow.js                                      + replaceNode, removeNodes

src/components/ui/BaseCheckbox/…      (new)             the only control the kit is missing
src/components/forms/BusinessHoursGrid/…   (new)        the mockup's Day | Time grid
src/components/forms/MessagePartsField/…   (new)        text parts and attachments
src/components/forms/NodeEditForm/…        (new)        the fields for whichever kind is open
src/components/drawer/NodeDetailsDrawer/…               the draft, the footer, the confirmations
```

### 3.2 Contracts

```js
// utils — pure
validateNode(node): Record<string, string>          // {} when it is fine
getTimezoneOptions(now?): { value, label }[]        // "(GMT+00:00) UTC"
toDraft(node): Draft                                // flat, form-shaped
fromDraft(node, draft): FlowNode                    // a new node, payload-shaped
getRemoval(nodes, id): { removeIds, reparent, shift }

// api — simulated, validates again before it accepts
updateNode(node, { nodes, delayMs }): Promise<FlowNode>
deleteNode(id, { nodes, delayMs }): Promise<{ removeIds, reparent, shift }>

// store
replaceNode(node)
removeNodes({ removeIds, reparent, shift })

// composables
useUpdateNode(): { save, isPending, error, fieldErrors, reset }
useDeleteNode(): { remove, isPending, error }
```

### 3.3 PRs

| PR  | branch                  | contents                                                     |
| --- | ----------------------- | ------------------------------------------------------------ |
| 05a | `feature/05a-edit-data` | utils, the API calls, the store actions, the two composables |
| 05b | `feature/05b-edit-ui`   | the controls, the per-kind form, the drawer's draft and Save |
| 05c | `feature/05c-delete`    | the Delete button, its confirmation, and the removal         |

### 3.4 Tests

- **`validateNode`**: every kind's rules, an end before a start, an equal start and end, a malformed
  time, a blank text part, an unparseable attachment URL, and a valid node returning `{}`.
- **`timezones`**: the label's shape, UTC present, sorting, and the fallback when the browser has no
  `supportedValuesOf`.
- **`nodeEdit`**: a round trip for each kind leaves an unchanged node deep-equal; a closed day drops
  out of `times`; an empty description is removed rather than stored blank.
- **`nodeRemoval`**: a middle step's children move up; a leaf; a condition takes its branches; the
  shift closes the gap; the trigger is refused.
- **`store`**: `replaceNode` swaps one node and keeps positions; `removeNodes` drops the ids,
  re-parents and shifts.
- **Composables**: the store changes only on success; a failure leaves it alone.
- **Components**: the grid renders seven days and disables a closed one; copy-Monday fills the week;
  Save is disabled until something changes; a failed save keeps the drawer open; closing with
  changes asks first; Delete asks first and says how many steps go.

---

## 4. Acceptance criteria

- [ ] Every editable kind can be changed in the drawer and saved, and the canvas updates.
- [ ] Business Hours has the mockup's Day | Time grid and a `(GMT+00:00) UTC` time-zone select.
- [ ] Every input is validated, including end-after-start, with the message under its field.
- [ ] Saving goes through `useMutation`; Pinia changes only on success; pending and error show.
- [ ] Closing with unsaved changes asks before discarding.
- [ ] A step can be deleted: a plain step closes the chain, a condition takes its branches, and the
      trigger has no Delete.
- [ ] Deleting or saving never re-runs the layout, so dragged positions survive.
- [ ] Lint clean, tests green, build succeeds.

---

## 5. Decisions (confirmed 2026-09-23)

| #   | Question                 | Proposal                                                                                                                | Alternative(s)                                      |
| --- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 5a  | What can be edited       | **Title and description everywhere**; comment; message parts; the grid; the trigger's once-per-contact, event read-only | Title/description only; make the event editable too |
| 5b  | When it saves            | **An explicit Save**, with a draft until then; closing with changes asks first                                          | Save on blur, a mutation per field                  |
| 5c  | Description when editing | **Optional** (the payload's own nodes have none)                                                                        | Required, as the create form has it                 |
| 5d  | The times                | **Native `<input type="time">`**, seven rows always, plus copy-Monday-to-all                                            | A hand-built clock popup; free-text fields          |
| 5e  | The time-zone list       | **Every IANA zone** from `Intl.supportedValuesOf`, labelled with today's offset                                         | A short curated list                                |
| 5f  | Deleting a plain step    | **Its children move up**: the chain closes                                                                              | Delete the whole subtree every time                 |
| 5g  | Deleting a condition     | **It takes both branches with it**, after a confirmation naming the count                                               | Keep the Success branch and drop Failure            |
| 5h  | The drawer's second line | **A `purpose` per kind**, as the mockup has                                                                             | Keep the kind's label; show nothing                 |
| 5i  | How it ships             | **Three stacked PRs** (data → editing UI → delete)                                                                      | One PR, faster to open, heavier to read             |
