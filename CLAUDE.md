# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

Visual node-based flow editor, built as a take-home assessment for a senior frontend role.
It is graded on **code quality, tests, architecture and README**, not only on working features.
Every change should read like senior, idiomatic Vue.

- Feature specs: `docs/specs/NN-<feature>.md`, one per feature. Each has a Design part (why) and an
  Implementation part (files, contracts, tests, acceptance criteria). A spec must be confirmed by the
  user before implementation starts.
- Progress log: `docs/progress-log.md` (update at the end of every working chunk)

If this file disagrees with the specs, the specs win. Flag the conflict and don't pick one silently.

## Original brief: key points

The user has the original brief (respond.io PDF). It isn't committed, because the repo is public and the
document is theirs. Where it differs from summaries, **the original wins**:

- **Only Success & Failure** are explicitly "not accessible, purely for display in canvas". The brief
  doesn't mark the Trigger as non-editable. That's our decision (Spec 04) and must be justified.
- The drawer is "accessible via URL containing the node ID" and "**toggled** by clicking on the node":
  clicking the open node again closes it. It displays the node's "properties and attachments".
- Nodes show: icon, title, truncated description. The create form's types are `sendMessage`,
  `addComment` and `businessHours` (stored in the payload as `dateTime` + `action: 'businessHours'`).
- **localStorage persistence is not in the brief.** If we add it, it's our design decision and must
  be explained in the README.
- Key details: "buttery smooth" canvas↔drawer transition, validation on all inputs, optimized renders,
  utility functions in separate files, comprehensive unit tests, Pinia for data, Vue Router for routing,
  custom implementation (no copied open-source code), clear README.
- Nice to have: undo/redo for moves and edits, keyboard accessibility (select node, open drawer), CI.
- Delivery: public GitHub repo + Vercel.

**Mockup** (the brief says "feel free to adopt or create your own"):
- A top-down tree: Trigger → Business Hours → split → Welcome / Away Message → Add Comment.
- Success/Failure are drawn as **small pill labels** on the branch lines, not full cards.
- Each kind has its own icon and accent colour: Trigger pink ⚡, Business Hours orange 📅, Send Message
  teal ➤, Comment blue 💬. Edges take their source node's colour.
- Card descriptions: "Conversation Opened", "Business Hours - UTC", "Message: <text or attachment
  file name>", and the comment text.
- "+" buttons on edges and under leaves (not required; a possible way to create a node at a spot).
- Business Hours drawer: header plus description ("Allows a branch to be created based on date & time
  conditions…"), a Day | Time grid with `HH:mm ⏱ to HH:mm ⏱` for Mon–Sun, and a Time Zone select
  like `(GMT+00:00) UTC`.

## Stack (fixed, do not substitute or add alternatives)

- Vite + Vue 3: Composition API, `<script setup>` only, no Options API
- JavaScript (ES modules). No TypeScript. Use JSDoc `@typedef` / `@param` for the domain shapes.
- Pinia (setup-store syntax), Vue Router, `@vue-flow/core`
- `@tanstack/vue-query` for loading and mutations
- Tailwind CSS v4 for styling (see Styling). No component library: build the drawer, form controls and
  pickers ourselves in `components/ui/`.
- Vitest + `@vue/test-utils` (jsdom)
- npm

Ask before adding any other dependency.

## Commands

```bash
npm install
npm run dev          # Vite dev server
npm run build        # production build
npm run preview      # serve the build
npm run test         # Vitest, watch mode
npm run test:run     # Vitest, single run (CI)
npm run coverage     # Vitest with coverage
npm run lint         # ESLint
npm run format       # Prettier
```

## Architecture rules (non-negotiable)

Data flow:

```
public/payload.json ─useQuery─▶ Pinia flow store ─▶ Vue Flow canvas
                                   ▲
UI actions ─useMutation (simulated)┘  (onSuccess commits to the store)
```

1. **Pinia is the single source of truth** for nodes and edges. Components read from the store.
2. **Vue Query is only the I/O interface.** `useQuery` fetches the payload once and seeds the store.
   `useMutation` wraps the simulated create/update/delete calls and commits to the store on success.
   Don't read nodes from the Query cache in components, and don't keep node copies in component state.
3. **The drawer is URL-driven.** Route `/node/:id` opens it, and closing it navigates to `/`.
   The selected node comes from the route param. There is no separate `isDrawerOpen` flag.
   Unknown ids and non-editable types redirect to `/`.
4. **Node-type behaviour lives in one registry** (`src/utils/nodeTypes.js` or similar): component, icon,
   editability, description derivation. Don't scatter `if (type === ...)` checks across components.
5. **Pure logic goes in `src/utils/`** (payload ↔ graph mapping, layout, validation, business-hours
   helpers, id generation). Components stay thin and presentational. Utils have no Vue or Pinia imports.
6. The query client uses exactly this config:
   ```js
   defaultOptions: {
     queries: {
       refetchOnWindowFocus: false,
       networkMode: 'always',
       staleTime: Infinity,
       gcTime: 60 * 60 * 1000,
     },
   }
   ```

## Payload facts (`public/payload.json`, source: the assessment S3 URL)

Keep the payload's exact structure and don't invent a new schema. Adapt it at the boundary.

- A flat array of nodes. **It has no edges and no positions.** Edges are derived from `parentId`,
  and positions come from a layout util.
- The root has `parentId: -1`. **Ids mix types** (the trigger's id is the number `1`, the rest are
  hex strings). Normalise ids to strings at the boundary and compare as strings.
- Payload type → UI kind:
  | payload `type` | discriminator | UI kind | editable |
  |---|---|---|---|
  | `trigger` | `data.type` (e.g. `conversationOpened`) | trigger | proposed no (decided in Spec 04) |
  | `sendMessage` | `data.payload[]` of `{type:'text',text}` / `{type:'attachment',attachment}` | sendMessage | yes |
  | `addComment` | `data.comment` | addComment | yes |
  | `dateTime` | `data.action === 'businessHours'`, `data.times[]`, `data.timezone`, `data.connectors[]` | businessHours | yes |
  | `dateTimeConnector` | `data.connectorType: 'success' \| 'failure'` | success / failure | no |
- No node has a `description`, and the trigger has no `name`. Titles and descriptions are **derived**
  when missing (see Spec 01/02). A user-entered description is stored additively on
  `data.description`.
- `times[]` entries are `{ day: 'mon'..'sun', startTime: 'HH:mm', endTime: 'HH:mm' }`.

## Component structure

Two layers, with no strict atomic levels:

```
src/components/
  ui/          reusable, domain-free kit (atoms + molecules): BaseButton, BaseInput, FormField, BaseDrawer…
  canvas/      feature components (domain-aware), built from ui/
  nodes/
  drawer/ forms/ …
src/views/     route-level pages
```

**Every component (ui, feature or view) lives in its own folder:**

```
BaseButton/
  BaseButton.vue       the component; named file, so tabs, devtools and warnings show "BaseButton"
  BaseButton.spec.js   its unit tests
  BaseButton.css       ONLY if Tailwind can't express it (transitions, Vue Flow overrides)
```

- Import the file directly: `import BaseButton from '@/components/ui/BaseButton/BaseButton.vue'`. No `index.js`
  barrel files: they only shorten import paths and add a file per component.
- Name the file after the component, not `index.vue`: Vue infers the component name from the file name,
  so tabs, devtools and warnings show "BaseButton" rather than "Index".
- **`ui/` rules:** no store, router, Query or node-type imports. Only props, emits, slots and
  `defineModel`. Accessible by default (labels, `aria-invalid`, `aria-describedby`, visible focus).
  Variants and Tailwind classes live inside the component. Feature components compose `ui/` and
  don't restyle it.
- **Build a component when a spec first needs it,** never ahead of time.
- Utils, stores, composables, api and router stay single files, with `xxx.spec.js` beside them.

## Styling

- Tailwind utilities in templates are the default.
- Plain CSS (a component `.css` file, or `src/assets/main.css` for globals and Vue Flow theming)
  only where Tailwind can't express something. **No SCSS/Sass:** Tailwind v4 isn't designed to run
  with preprocessors.
- Colours are CSS custom properties (e.g. `--color-kind-<kind>`), shared by nodes and edges.

## Conventions

- File naming: components `PascalCase.vue` in a `PascalCase/` folder, everything else `camelCase.js`,
  stores `useXxxStore`.
- Composables in `src/composables/` are named `useXxx`. The query/mutation hooks live there.
- Props down, events up. No prop mutation. Use `defineModel` for two-way form bindings.
- Use `computed` for derived values and `shallowRef` / `markRaw` where deep reactivity isn't needed
  (e.g. node component maps) to keep renders cheap.
- Every user input is validated with shared validators from `src/utils/validation.js`.
- Accessibility: interactive elements are real buttons/inputs with labels and focus is visible.
  The drawer traps focus and closes on Esc.
- Comments explain *why*, not *what*. No commented-out code, no stray `console.log`.
- Formatting: Prettier defaults plus the repo config. Lint must pass before any commit.

## Testing

Tests are heavily weighted in grading.

- Tests sit next to the source as `*.spec.js`: inside the component's folder for components, and
  beside the file for utils, stores and composables. (The brief requires comprehensive unit tests but
  not where they go. Putting them next to the source is our choice.)
- **ui/ components:** every variant/prop, `v-model` round-trip, emitted events, slots, error display,
  and a11y attributes.
- **Utils:** full unit coverage, including edge cases (mixed id types, missing fields, invalid times).
- **Store:** every action and getter, using `createPinia()` / `setActivePinia` per test.
- **Composables:** mutations with a real `QueryClient` per test; assert the store is updated on success.
- **Components:** Vue Test Utils. Test behaviour (rendering, emitted events, validation messages,
  router navigation), not implementation details. Stub Vue Flow where it isn't under test.
- Tests are written after `/code-review` (see Workflow) but ship in the same chunk of work.
  Run `npm run test:run` before saying work is done.

## Workflow

Work one feature at a time, in the brief's build order.

### Git branching

- `main` is always releasable (tests green, deploys to Vercel). Never commit feature work directly to `main`.
- Each feature gets its own branch from an up-to-date `main`: `feature/NN-<feature>`
  (e.g. `feature/01-scaffold-canvas`). Fixes use `fix/<topic>` and docs-only work uses `docs/<topic>`.
- A feature is merged into `main` **only through a GitHub Pull Request**. The PR description links the spec,
  summarises the changes, lists the tests added and ticks off the spec's acceptance criteria.
- After merge: pull `main` and delete the feature branch.
- Commits, pushes, opening PRs and merging all happen **only when the user asks**.

### Per-feature cycle

1. Create the feature branch from `main`. Write `docs/specs/NN-<feature>.md` and wait for the user to
   confirm it. Don't jump ahead.
2. Implement exactly what the confirmed spec says and run lint.
3. Run `/code-review` on the change and fix what it finds.
4. Write or update the tests for the reviewed code, then run `npm run test:run` until it is green.
5. Add a dated entry to `docs/progress-log.md` (done / decisions / next).
6. **Never commit or push unless the user asks.** When asked, use Conventional Commits
   (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`) with small, focused commits, because the
   history is part of what gets reviewed.
7. If implementation shows the spec is wrong, stop, update the spec, and get it re-confirmed before
   continuing.
8. When the user asks: commit, push the branch, open the PR, and merge it into `main`.
9. Only then move to the next feature's spec.
