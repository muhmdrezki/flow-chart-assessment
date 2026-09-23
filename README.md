# Flow Builder

A node-based flow editor for chat automation: a canvas of steps you can read, rearrange, add to,
edit and delete, built for the respond.io frontend assessment.

**Live:** <https://flow-chart-assessment.vercel.app/> · **Stack:** Vue 3 · Pinia · Vue Router ·
Vue Flow · TanStack Query · Tailwind v4 · Vitest · Vue Datepicker (the one UI dependency; the rest
of `ui/` is ours)

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run test:run   # 1019 tests, single run
npm run coverage   # with coverage
npm run build      # production build
npm run lint
```

Node 22.12 or newer (`.nvmrc` pins 24).

## What it does

- **Reads a flow.** `payload.json` is fetched once, normalised and laid out as a tree. The payload
  has no edges and no positions; both are derived.
- **Drag to rearrange.** Positions are saved when a drag ends, and nothing else moves them.
- **Create a step.** A form takes a title, a description, a type and the step to add it after. A new
  step is inserted into the chain, pushing whatever followed it down a row. Business Hours arrives
  with its Success and Failure branches.
- **Add one at a point.** The "+" on a connector — and the one on a dashed stub under a step with
  nothing after it yet — opens that same form with the place already filled in, as the mockup draws
  it. Both follow one rule: a step can be added after anything that may have children. That is what
  keeps them off a condition, whose Success and Failure branches have to stay attached to it.
- **Open a step.** Clicking a node opens a drawer at `/node/:id`; clicking it again closes it.
  The URL is the selection, so a node can be linked, bookmarked and navigated back to.
- **Edit it.** Each kind of step gets the fields it actually has — a message's texts and
  attachments, a comment, a week of opening hours where each time opens a clock picker and the zone
  is any the browser knows. Attachments are tiles — click a picture to see it full size — and new
  ones can be uploaded; every part can be changed or removed. Nothing reaches the store until Save.
- **Delete it.** A plain step closes the chain behind it; a condition takes its branches with it,
  after saying so.
- **See that it worked.** Saving keeps the drawer open so the card can be watched changing behind
  it, and a toast names what happened. Creating and deleting say so too.
- **Take it back.** Cmd/Ctrl+Z undoes any of the above, and the two buttons above the canvas's zoom
  controls say what they will undo — _"Undo: Delete Away Message"_. Inside a text field the
  shortcut belongs to the browser, as it should.

Keyboard throughout: Tab reaches a step, Enter or Space opens it, Escape closes the drawer, and
focus goes back where it came from. The same two keys open a time field's clock menu, and Escape
closes that instead of the drawer under it.

---

## How it is put together

```
public/payload.json ─useQuery─▶ Pinia flow store ─▶ adapter ─▶ Vue Flow canvas
                                      ▲
     UI actions ─useMutation (simulated)┘   (the store changes only on success)
```

Four rules hold the whole thing together:

**1. Pinia owns the flow.** The store is the single source of truth for nodes. Components read from
it; none of them keep their own copy.

**2. Query is only the way in and out.** `useQuery` fetches the payload once and seeds the store.
Mutations wrap the simulated create, update and delete calls and write to the store when they
succeed. No component reads nodes out of the query cache. The two libraries are easy to confuse:
Query is the request manager, Pinia is the application state, and the boundary between them is one
`hydrate` call and three `onSuccess` handlers.

**3. Writes are pessimistic.** The canvas never shows something the "server" rejected. Every write
validates twice — once in the form, once at the API boundary — because the form is one caller, not
the only conceivable one.

**4. The URL is the drawer.** `/node/:id` is the same page with one step selected. There is no
`isDrawerOpen` flag anywhere; `useSelectedNode` turns the route parameter into a node and owns
opening, toggling and the redirect for a link that can't be honoured.

### Where things live

```
src/
  api/          the simulated server: fetch, create, update, delete, and the query keys
  components/
    ui/         domain-free kit — no store, no router, no node types
    canvas/ nodes/ drawer/ forms/   feature components, built from ui/
  composables/  the query and mutation hooks, the selection, the focus trap, the shortcuts
  config/       the query client, configured in one place
  router/       two routes: the canvas, and the canvas with a step selected
  stores/       the flow store
  utils/        every pure decision: layout, graph, validation, drafts, removal
  views/        the one route-level page
```

`utils/` has no Vue and no Pinia imports, which is what makes the hard parts testable without
mounting anything: the tree layout, the payload mapping, the placement maths, the validation rules
and the removal rules are all plain functions.

### Decisions worth knowing

**Edges are derived, never stored.** Each node has one `parentId`, so the edges are a pure function
of the nodes. They cannot go stale, and deleting a node cannot leave an edge pointing at nothing.

**The layout is ours.** No `dagre`, no layout library: a single-parent graph is a tree, so it walks
the tree, gives each leaf a slot and centres every parent over its children. Node sizes come from
the registry, so branch pills sit closer together than full cards.

**The time picker is the one UI dependency.** The brief asks for a date-time picker on business
hours and the mockup draws a clock menu; `<input type="time">` shipped first and renders as a
browser preference rather than as the design. `@vuepic/vue-datepicker` in time-only mode matches the
mockup, themed by pointing its own `--dp-*` variables at our tokens, so it takes the app's colours
without a rule of its own being overridden. Everything else in `ui/` is built here. Its menu opens
on a click and nothing else, so the grid adds Enter and Space to open it and Escape to close it and
hand the field its focus back. `HH:mm` still goes in and comes out — `toClockParts` and
`fromClockParts` keep the picker's shape inside the one component that renders it.

**Node behaviour lives in one registry.** `utils/nodeRegistry.js` holds what differs per kind —
icon, accent colour, size, whether it opens a drawer, whether the create form offers it, whether it
can be deleted, whether anything may follow it, what its drawer says it does. No component branches
on node type, and a rule stated once is a rule everywhere: `canHaveChildren` is why a condition has
no "+" on the lines to its branches and none under it either. Adding a kind is an entry there plus a
slot on the canvas.

**Ids are normalised at the boundary.** The payload mixes types: the trigger's id is the number `1`
and the rest are hex strings. Everything downstream compares strings.

**Business hours are wall-clock times.** `09:00–17:00` in a `UTC` node means nine to five where the
business is, like the hours on a shop door. They are shown exactly as stored and never converted to
the viewer's zone — this app edits flows, it never runs them. That also makes "end after start" a
string comparison rather than date arithmetic.

**Attachments are URLs, so an uploaded file becomes one.** The payload stores an attachment as a URL
and nothing else. With a backend, a chosen file would be POSTed to an upload endpoint and the URL it
answered with stored on the node; there isn't one, so the file is read into a `data:` URL and _is_
the value. The payload's shape is untouched, uploads work offline, and the cost — the bytes live in
memory, and in every undo snapshot after them — is why there's a 2 MB limit. `utils/attachments.js`
holds all of it, so swapping in a real upload means changing one function.

**Renders are kept cheap.** The canvas gets nodes and edges from computed values, and each node's
display text is derived in a map that reads names and data but never positions — so dragging a node
doesn't recompute anything it doesn't have to, and every node keeps the same display object.
Positions are written once, when a drag ends. The time-zone list (some 400 zones, each needing its
own `Intl` formatter) is built once, not per keystroke.

---

## Where this differs from the brief

Every one of these was a decision, not an oversight.

| What                          | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Only three kinds open**     | `sendMessage`, `addComment` and `businessHours` open a drawer. The Trigger, Success and Failure are display-only — not clickable, not in the tab order, and their URLs redirect. The Trigger briefly did open one, on the reading that the brief only names Success and Failure; it is the flow's entry point rather than a step, so it went back to being read-only.                                                                                                                                                                                                |
| **Delete exists**             | The brief doesn't ask for it. A flow editor that can only add felt incomplete, so it's here — with rules stated up front about what a delete takes with it.                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Toasts exist**              | Also not in the brief. Saving leaves the drawer open, which suits editing but meant a save announced itself only by the Save button going grey. A toast naming what happened fixes the feedback without taking away the panel.                                                                                                                                                                                                                                                                                                                                       |
| **No persistence**            | Reload and you are back to the payload. The brief doesn't ask for it, and adding `localStorage` would have meant inventing a merge story between saved state and a fetched payload. The simulated API is the honest boundary instead.                                                                                                                                                                                                                                                                                                                                |
| **Undo doesn't call the API** | It writes to the store directly. Against a real backend it would send a compensating request, which can fail and needs its own handling; here the "server" is a delay in the same tab, so a request to it would be theatre. History is per-session and is not restored on a reload — the document is the durable thing, not the history, which is how every editor works.                                                                                                                                                                                            |
| **What a card says**          | Two lines under the title: what the user wrote, then what the step holds — the trigger's event, `Message: <the text>` as the mockup labels it, the comment, `Business Hours - UTC`. The brief truncates a node's description, so that is the line cut to one; the message is the reason the card is worth reading, so it gets three. Either ends in an ellipsis only when there is more than it can show, and the whole of it is a hover away and in the drawer. Every card is the same height, which costs some white space on a short one and keeps the rows even. |

---

## Testing

**1019 tests across 52 files**, 97% of statements covered. Tests sit beside the code they cover.

- **Utils** are tested as plain functions, edge cases included: mixed id types, missing fields,
  malformed times, a cyclic parent, an attachment with a query string.
- **The store** gets a fresh Pinia per test; every action and getter is covered.
- **Composables** run against a real `QueryClient` and assert the store changes only on success —
  and doesn't on failure.
- **Components** are tested through behaviour: what is rendered, what is emitted, which message
  appears, where focus goes. Vue Flow is stubbed where it isn't the thing under test.

Some bugs here were never going to fail a test. Two were the same shape — Vue's reactivity reaching a
layer that expects plain data, where `structuredClone` refuses a Proxy — and both now have tests
that pass a reactive object in. The rest were about what a browser does with a pointer and a key: a
click that drifts a pixel becomes a drag, and the drag swallows it, so a step opened nothing; a
picker's menu, teleported out to the body, took Escape with it and left the drawer to close instead.
Each is now pinned by a test, but each was found by using the thing, which is the argument for doing
both.

---

## Documentation

- `docs/specs/NN-*.md` — a spec per feature: the design and why, then the implementation, the
  decisions taken (with the alternatives), and what the code review found. Numbers follow the
  branch they were built on; 07–09 were small changes made in one session and have no spec of their
  own, so the sequence has a gap rather than a spec written to fill one. Specs 10 and 11 were
  written after the build and say so.
- `docs/progress-log.md` — a dated entry per working session.
- `CLAUDE.md` — the working rules for this repo.

## What I would do next

- **Persisting the flow**, so edits survive a reload. It is one watcher on the store — persistence
  belongs to the state, not to each action, or every new action has to remember to save. The real
  work is deciding what happens when the saved flow and the fetched payload disagree.
- **Guarding unsaved changes when switching steps.** Closing the drawer asks first; clicking straight
  onto another node doesn't, because the canvas is deliberately left clickable while a drawer is open.
- **Cards that size to their own content.** Every card is as tall as the longest thing one might
  hold, so a short step carries white space and a long message still stops at three lines. Sizing
  each to its content means measuring it after it renders and laying the flow out a second time —
  the layout already takes a size per node, so the work is the second pass, not the maths.
- **A layered layout**, if a step ever needed more than one parent. The tree walk assumes it doesn't,
  and that assumption is the one thing in the graph layer that wouldn't survive the change.
