# Progress Log

Newest entries first.

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
