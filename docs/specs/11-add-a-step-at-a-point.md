# Spec 11: Adding a step at a point on the canvas

Status: **Built 2026-09-23** (written after the fact, see Spec 10 §5).
Brief: the mockup draws a **"+" on the connectors between steps and under the ends of branches**.
The brief itself doesn't require it — it lists it as one possible way to create a node at a spot.

---

## 1. Goal

A step can be added where it goes, rather than by naming its place in a form. Clicking a "+" opens
the create form with that place already filled in.

**Out of scope:**

- A second way to create a step. It is the same form and the same mutation; only where it opens
  from is new.
- Dragging a step to a new parent. Nothing in the brief asks for re-parenting by hand.
- Adding a step before the trigger. Nothing can precede the entry point.

---

## 2. Design

### 2.1 Where a "+" belongs (decision 11a)

One rule, and it is one the registry already states: **a step can be added after anything that can
have children**.

| place                     | "+"? | why                                                            |
| ------------------------- | ---- | -------------------------------------------------------------- |
| on a line between steps   | yes  | the step above it can have children                            |
| under a step with nothing after it | yes | the end of a branch is otherwise the one place you can't add to |
| on a line to a branch pill | no   | `canHaveChildren` is false for a condition                     |
| under a condition          | no   | same rule, same reason                                         |

A Success or Failure branch is created with its condition and has to stay attached to it, so
nothing may come between them. That isn't a new rule written for this feature — it is
`canHaveChildren`, which the create form's "Add after" list has always used. Stating it once is the
point: a reviewer can check one registry entry and know where a "+" can appear.

### 2.2 The two placements are one button (decision 11b)

The "+" on a line and the "+" under an open end look the same and do the same thing, so they are
one component with two placements rather than two that have to be kept looking alike:

```
[Trigger]                      AddStepButton, given a point:
    ⊕   ← on the line          sits on it, centred.

[Away Message]                 AddStepButton, given nothing:
    ┆                          hangs under the step it renders inside,
    ⊕   ← under an open end    joined by a short dashed stub.
```

The stub is dashed because there is nothing there yet: the line says "something could follow",
where a solid line says "something does".

### 2.3 Why the buttons live where they do

| button              | rendered in                    | why                                                                     |
| ------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| on a line           | `FlowEdge`, our own edge type  | an edge draws its own curve; the "+" goes at its midpoint                |
| under an open end   | inside the node's slot          | it has to move with the step while the step is dragged                  |

Every edge became a custom type (`type: 'flow'`) so it can carry the button. Vue Flow in this
version has no viewport portal, so a floating overlay would have lagged a pixel behind every drag
until the pointer was released; rendering inside the node avoids that entirely.

### 2.4 What clicking it does (decision 11c)

It opens the **existing** create drawer with `parentId` already set to the step above the "+".

The field stays a field: it is prefilled, not locked. A misclick then costs a change of dropdown
rather than closing the form and starting again somewhere else. Everything after that — the
validation, the mutation, the insert that pushes the following step down a row, the toast, the
undo entry — is Spec 03's, unchanged.

---

## 3. Implementation

| file                                    | change                                                                |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `utils/vueFlowAdapter.js`                | `getOpenEndIds`; edges get `type: 'flow'` and `{ canInsert, sourceTitle }` |
| `components/canvas/AddStepButton/`       | the button, with its two placements                                   |
| `components/canvas/FlowEdge/`            | our edge: the curve, and the "+" at its middle                        |
| `components/canvas/FlowCanvas/`          | the edge slot, the open-end buttons, `insert-after`                   |
| `views/FlowView/FlowView.vue`            | `openCreate(afterId)`; passes it to the drawer                        |
| `components/forms/CreateNodeDrawer/`     | `afterId` prop, handed to the form                                    |
| `components/forms/CreateNodeForm/`       | `initialParentId`, the field's starting value                         |

### Tests

- `vueFlowAdapter.spec.js`: which steps are open ends, which edges offer a "+", the source's name.
- `AddStepButton.spec.js`: both placements, the dashed stub, the name it announces, `nodrag`.
- `FlowEdge.spec.js`: the curve, the button's presence and absence, what it emits.
- `FlowCanvas.spec.js`: a "+" under the ends and nowhere else, and one appearing when a branch
  loses its last step.
- `FlowView.spec.js` / `CreateNodeDrawer` / `CreateNodeForm`: the place travels to the field, and
  the header button still opens the form on nothing in particular.

### Acceptance criteria

- [x] A "+" sits on every line whose upper step may have children, and under every open end.
- [x] No "+" on either line under a condition, and none under the condition itself.
- [x] Clicking one opens the create form with that step chosen, and the choice can be changed.
- [x] The new step lands between the two it was added between, pushing the lower one down.
- [x] Pressing a "+" on a card doesn't also open that card's drawer.

---

## 4. Decisions

| #   | Decision      | Taken                                                           | Rejected                                        |
| --- | ------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| 11a | Where it goes | **`canHaveChildren`**, the registry's own rule                  | A new rule listing the kinds that may be followed |
| 11b | The button    | **One component, two placements**                               | Separate buttons for lines and ends             |
| 11c | What it opens | **The create form, prefilled and still editable**               | A quick type menu; a locked field               |
