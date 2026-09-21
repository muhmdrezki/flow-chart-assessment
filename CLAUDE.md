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

## Stack (fixed, do not substitute or add alternatives)

- Vite + Vue 3: Composition API, `<script setup>` only, no Options API
- JavaScript (ES modules). No TypeScript. Use JSDoc `@typedef` / `@param` for the domain shapes.
- Pinia (setup-store syntax), Vue Router, `@vue-flow/core`
- `@tanstack/vue-query` for loading and mutations
- Tailwind CSS for styling. No component library: build the drawer, form controls and pickers ourselves.
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
  | `trigger` | `data.type` (e.g. `conversationOpened`) | trigger | no |
  | `sendMessage` | `data.payload[]` of `{type:'text',text}` / `{type:'attachment',attachment}` | sendMessage | yes |
  | `addComment` | `data.comment` | addComment | yes |
  | `dateTime` | `data.action === 'businessHours'`, `data.times[]`, `data.timezone`, `data.connectors[]` | businessHours | yes |
  | `dateTimeConnector` | `data.connectorType: 'success' \| 'failure'` | success / failure | no |
- No node has a `description`, and the trigger has no `name`. Titles and descriptions are **derived**
  when missing (see the design spec). A user-entered description is stored additively on
  `data.description`.
- `times[]` entries are `{ day: 'mon'..'sun', startTime: 'HH:mm', endTime: 'HH:mm' }`.

## Conventions

- File naming: components `PascalCase.vue`, everything else `camelCase.js`, stores `useXxxStore`.
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

- Tests sit next to the source as `*.spec.js`.
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
