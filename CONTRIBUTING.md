# Contributing

Thanks for helping with `@lukez/svelte-dnd`. This guide covers how to report problems, set up the repository and get a change merged.

## Reporting bugs and requesting features

Open an issue with the [bug report](https://github.com/The-LukeZ/svelte-dnd/issues/new?template=bug_report.yml) or [feature request](https://github.com/The-LukeZ/svelte-dnd/issues/new?template=feature_request.yml) form.

- Include a reproduction: a [Svelte playground](https://svelte.dev/playground) link, a StackBlitz or a small repository. Bugs with a reproduction get fixed much faster.
- Check the [docs](https://svelte-dnd.js.org) first. Many problems come from an unkeyed `#each`, extra children inside a zone or transitions on the items, and the docs explain each of these.
- If the problem is also reported in the original [`svelte-dnd-action`](https://github.com/isaacHagoel/svelte-dnd-action/issues), link that issue.

## Repository layout

| Path                  | What it holds                                       |
| --------------------- | --------------------------------------------------- |
| `packages/svelte-dnd` | The library (`src`) and its tests (`test`)          |
| `apps/docs`           | The docs site, live at https://svelte-dnd.js.org    |
| `.changeset`          | Pending changesets, turned into releases by CI      |
| `archive`             | Notes from the upstream project, kept for reference |

## Setup

You need Node 24 or newer and pnpm (the version is pinned in `packageManager` in the root `package.json`; `corepack enable` picks it up).

```bash
pnpm install
pnpm --filter @lukez/svelte-dnd exec playwright install chromium firefox webkit
pnpm build
```

## Commands

Run these from the repository root.

| Command              | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `pnpm test`          | Library tests in Chromium                                      |
| `pnpm test:all`      | Library tests in Chromium, Firefox and WebKit, as CI runs them |
| `pnpm typecheck`     | `tsc` and `svelte-check` for the library                       |
| `pnpm test:types`    | Type tests of the public API (run `pnpm build` first)          |
| `pnpm lint`          | oxlint                                                         |
| `pnpm format`        | Prettier, writes changes (`pnpm format:check` only checks)     |
| `pnpm check:package` | Checks the built package exports with publint and attw         |
| `pnpm docs:dev`      | Builds the library and starts the docs site                    |
| `pnpm docs:check`    | `svelte-check` for the docs site                               |

A pre-commit hook runs oxlint and Prettier on the staged files.

## Making a change

1. Branch off `master`.
2. For a bug, write a test that fails first, then fix it. For a feature, add tests that show it works and that the default behaviour does not change.
3. Keep the change focused. Unrelated refactors belong in their own pull request.
4. Update the docs in `apps/docs` when behaviour or the API changes. The API tables on the docs site are generated from the TSDoc comments in `packages/svelte-dnd/src/types.ts`, so document new options there.
5. Add a changeset (see below) if the package changes.
6. Before opening the pull request, run `pnpm lint`, `pnpm typecheck`, `pnpm format:check` and `pnpm test:all`.

### Tests

Tests run in real browsers through Vitest browser mode and Playwright. Put them in `packages/svelte-dnd/test`. Tests that mount Svelte components go in `test/svelte`, with their components in `test/svelte/fixtures`. Follow the style of the existing tests next to the code you change.

### Changesets

Every change to `packages/svelte-dnd` needs a changeset. Run `pnpm changeset`, pick the bump and commit the file it creates.

- **patch**: bug fixes and internal changes users do not see.
- **minor**: new options, config keys, event fields or exports.
- **major**: anything that breaks existing code.

Write the summary for users: what changed and what they need to do, if anything. Changes to the docs site, CI or tests alone need no changeset.

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org): `fix:`, `feat:`, `docs:`, `test:`, `perf:`, `refactor:`, `chore:`, `ci:` and `style:`, with an optional scope, for example `fix(scroll): ...`.

When a commit addresses an issue of the original project, link it with a trailer in the commit body. Do not use `Fixes` or `Closes`, since that issue lives in another repository:

```
fix: accept an item whose id is inherited

Refs: isaacHagoel/svelte-dnd-action#471
```

For issues in this repository, `Fixes #123` in the pull request description is enough.

## Pull requests

Open the pull request against `master` and fill in the template. CI runs lint, typecheck, format check, the build, the type tests, the package check and the tests in all three browsers, and it builds and checks the docs site. All of it has to pass before merging.

## Releases

Maintainers release through changesets: when changesets land on `master`, CI opens a "Version Packages" pull request, and merging it publishes to npm. Contributors do not need to bump versions or edit the changelog.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
