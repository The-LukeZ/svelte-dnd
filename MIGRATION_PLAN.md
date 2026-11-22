# Migration Plan: `svelte-dnd-action` to `@lukez/svelte-dnd`

Rough spec for every stage. Each stage gets its own detailed spec and implementation plan when work on it starts ("start the spec for stage N"). Update this file when a stage lands or a decision changes.

## Why

This repo is a hard fork of [`svelte-dnd-action`](https://github.com/isaacHagoel/svelte-dnd-action) (v0.9.80). Upstream prioritizes API stability over modernization. The fork will be published as `@lukez/svelte-dnd`, a full breaking rewrite for Svelte 5 with modern tooling and integrated docs.

## Goals

- Svelte 5 native API: attachment (`{@attach}`) plus callback props.
- TypeScript source; types generated, not hand-written.
- pnpm monorepo containing the library and its docs site.
- Modern tooling: tsdown build, Vitest browser mode tests, a fast linter/formatter, changesets releases, CI.
- Keep the battle-tested drag and drop behavior: pointer, touch, keyboard, aria, auto-scroll, nested zones, drag handles, same-origin iframe and popup zones, flip-animation handling.

## Non-goals

- Compatibility with `svelte-dnd-action` or Svelte 3/4.
- Contributing changes upstream.
- Library-owned item state (reactive `DndZone` class). The user keeps owning `items`; the library proposes changes via callbacks.

## Anti-goals (failure even if it "works")

- Behavior regressions in the edge cases above slipping in because tests were dropped or weakened during the port.
- A big-bang rewrite where nothing is green for weeks.

## Approaches considered

- **Staged port (chosen).** Move and modernize in stages, tests green at the end of each stage. Protects behavior through every risky step; costs some throwaway work on code that stage 4 rewrites.
- **Clean-room rewrite.** Fresh TS package using old code as reference. Cleanest design, but no safety net until new tests exist.
- **Hybrid** (stages 1 and 2, then clean-room). Most existing specs test internals (`listUtil`, `styler`, `util`, ...) and would not survive a redesign.

## Decisions

| Area               | Decision                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Package name       | `@lukez/svelte-dnd`                                                                                                                |
| Svelte             | 5 only (`^5.32.0`: attachments need 5.29, `fromAction` needs 5.32)                                                                 |
| Language           | TypeScript                                                                                                                         |
| Package manager    | pnpm workspaces                                                                                                                    |
| Layout             | `packages/svelte-dnd` (library), `apps/docs` (docs site)                                                                           |
| Build              | tsdown, ESM + CJS dual output (drop UMD and Babel)                                                                                 |
| Tests              | Vitest browser mode with Playwright (replaces Cypress), Chromium + Firefox + WebKit in CI                                          |
| Lint/format        | oxlint (replaces ESLint) + Prettier (latest, with `prettier-plugin-svelte`)                                                        |
| Git hooks          | husky 9 + lint-staged (latest); pre-commit runs oxlint --fix and prettier --write on staged files                                  |
| Versioning         | changesets, release via GitHub Actions. Prereleases `1.0.0-next.x` (changesets pre mode) until stage 6 ships `1.0.0`               |
| Package checks     | publint + attw (`@arethetypeswrong/cli`) in CI, needed for the dual ESM/CJS types                                                  |
| Docs               | SvelteKit + [svelte-docsmith](https://github.com/geodask/svelte-docsmith) (`LiveExample` for real demos). Fallback: Astro + Svelte |
| Git history        | Kept. MIT license notice of the original author kept alongside the new one                                                         |
| Docs hosting       | Cloudflare Pages, static (`@sveltejs/adapter-static`), deployed from `dev` by GitHub Actions                                       |
| `release-notes.md` | Archived into the docs as upstream history; changesets writes a fresh `CHANGELOG.md`                                               |

## Branching

- `dev` is the integration branch for the whole migration. `master` stays at v0.9.80 until the migration is done.
- Each stage gets its own branch off `dev` (e.g. `stage/1-tooling`), merged back into `dev` when its "done when" holds. Merges use a merge commit (no squash or rebase) so commit hashes survive.
- `dev` merges into `master` after stage 6.

## Current state (after stage 5)

- ~3,100 lines of TypeScript DOM logic in `src/` (strict mode). No Svelte imports; `svelte` is only a peer dependency.
- Public runtime exports (`src/index.ts`, 10, checked by `scripts/check-exports.mjs`): `dndzone` and `dragHandleZone` (attachment factories that take an options getter), `dragHandle` (attachment), `configure`, `alertToScreenReader`, and the constants `TRIGGERS`, `SOURCES`, `SHADOW_ITEM_MARKER_PROPERTY_NAME`, `SHADOW_PLACEHOLDER_ITEM_ID`, `DRAGGED_ELEMENT_ID`. The setters and the feature flag are gone. See the docs migration page.
- Declarations (`.d.mts`, `.d.cts`) generated by tsdown from the TypeScript source. No `typings/` directory. `pnpm typecheck` (source) and `pnpm test:types` (type tests) run in CI.
- 69 test files in `packages/svelte-dnd/test/`: 816 passed and 3 skipped across Chromium, Firefox and WebKit (Vitest browser mode, Playwright). Other-window tests use real iframes and popups (`test/helpers/otherWindow.ts`). Svelte component tests live in `test/svelte/` and use `vitest-browser-svelte`.
- Tooling: pnpm workspace, TypeScript 6, tsdown (ESM + CJS), Vitest browser mode (Playwright), oxlint, Prettier 3, husky 9 + lint-staged, changesets (pre mode `next`), GitHub Actions CI. Originally Rollup 2 + Babel, ESLint 7, Prettier 2, husky 4, Yarn 1, no CI.
- `1.0.0-next.0` is published on npm (`next` tag).
- `apps/docs`: SvelteKit 3 + svelte-docsmith docs site (guides, 13 live demos, API reference generated from the library TSDoc, migration guide, upstream history from `archive/`). CI builds and smoke-tests it; `.github/workflows/docs.yml` deploys `dev` to Cloudflare Pages (`svelte-dnd.thelukez.com`) and same-repo PRs to previews. `examples/` is gone.

## Stages

### Stage 1: Monorepo and tooling (JS untouched) (done)

- Convert to pnpm workspace; remove `yarn.lock`.
- Move library to `packages/svelte-dnd` (keep JS source as-is; use `git mv` to preserve history).
- Rename package to `@lukez/svelte-dnd`, update repo metadata, author, README header.
- Move `release-notes.md` to an archive location (final home in docs in stage 5).
- Replace Rollup + Babel with tsdown (ESM + CJS output, copy hand-written `.d.ts` for now as `.d.ts` and `.d.cts`).
- Replace ESLint with oxlint; upgrade Prettier; upgrade to husky 9 + latest lint-staged.
- Keep Cypress running from the package for now so behavior stays guarded.
- Add CI (GitHub Actions): install, lint, build, test, publint, attw.
- Add changesets (config only, enter pre mode with tag `next`; no publish yet).
- Done when: `pnpm build`, `pnpm lint`, Cypress all green in CI.

### Stage 2: Tests to Vitest browser mode (done)

- Port all 15 Cypress specs to Vitest browser mode (Playwright: Chromium, Firefox, WebKit).
- Port the other-window harness (iframe and popup fixtures) and confirm those specs pass.
- Remove Cypress.
- Done when: every original assertion has a Vitest equivalent and CI is green. No assertions deleted without a written reason.

### Stage 3: TypeScript conversion (done)

- Convert `src/` to `.ts` file by file, behavior unchanged.
- Generate declarations via tsdown; delete `typings/index.d.ts`.
- Strict mode target; temporary `any` allowed only with a TODO.
- Convert tests to TS.
- Done when: `tsc --noEmit` clean, generated types cover the full public API, tests green.

### Between stages 3 and 4: bug fixes (done)

- [#4](https://github.com/The-LukeZ/svelte-dnd/issues/4): `findWouldBeIndex` can return `index: undefined` from a stale cached shadow rect.
- [#5](https://github.com/The-LukeZ/svelte-dnd/issues/5): the pointerAction drag-event handlers throw when a zone nested in the dragged item is destroyed mid-drag.
- Each fix gets its own `fix/` branch off `dev`, with a regression test, merged into `dev` before stage 4 starts.
- Done when: both issues are closed, each with a regression test, and CI is green on `dev`.

### Stage 4: Svelte 5 API rewrite (done)

- Replace the `dndzone` action with an attachment factory, e.g. `{@attach dndzone({ items, onconsider, onfinalize, ...options })}`.
- Replace `consider`/`finalize` DOM CustomEvents with callback props.
- Redesign drag handles (`dragHandleZone`, `dragHandle`) as attachments.
- Rethink global config functions (`overrideItemIdKeyNameBeforeInitialisingDndZones`, `setDebugMode`, `setFeatureFlag`, `setKeyboardDragTrigger`) as options or a single config call; remove dead feature flags.
- Revisit `svelteNodeClone` (Svelte `<select>` clone workaround) against Svelte 5.
- Bump `svelte` peer dependency to `^5.32.0`; add Svelte to the test setup.
- Tests rewritten against the new API where needed, keeping coverage of all behavior listed in Goals.
- Done when: new API covers every former capability, tests green, migration guide from `svelte-dnd-action` drafted.

### Between stages 4 and 5: bug fixes

- [x] [#7](https://github.com/The-LukeZ/svelte-dnd/issues/7): a zone nested in a dragged item is dead after the drop when the shadow hint is set. Fixed: the skipped zone is set up once the hint is removed.
- [x] A handle zone created again on the same element takes over the handles of the zone it replaces.
- [x] A drop's deferred finalize and teardown no longer reach a zone created on the same element during the drop animation, whatever its `type`.
- [x] `configure` validates every key before applying any.
- [x] `info.id` is inferred from an optional `id` field too.
- [x] Stage 4 review test gaps covered; `MIGRATING.md` links are absolute.

### Stage 5: Docs site (done)

- `apps/docs`: SvelteKit + svelte-docsmith, Tailwind v4, consuming the library via `workspace:*`.
- Port README content into docs pages; turn `examples/` REPL links into `LiveExample` demos.
- Pages: getting started, API reference (props tables from TS types), accessibility, recipes, migration guide from `svelte-dnd-action`.
- Deploy to Cloudflare via `@sveltejs/adapter-cloudflare`.
- Add archived upstream release notes as a history page.
- Done when: docs build in CI and deploy.

### Stage 6: First release

- Changesets release workflow publishing `@lukez/svelte-dnd` to npm (provenance enabled). `next` prereleases may ship earlier; stage 6 exits pre mode and ships `1.0.0`.
- Trim README to a short intro pointing to docs.
- Done when: first version published from CI.

## Open questions

None at plan level. Details are settled in each stage spec.
