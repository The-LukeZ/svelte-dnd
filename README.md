# svelte-dnd

Monorepo for [`@lukez/svelte-dnd`](packages/svelte-dnd/README.md), a Svelte 5 drag and drop library forked from [`svelte-dnd-action`](https://github.com/isaacHagoel/svelte-dnd-action), and its docs site ([`apps/docs`](apps/docs), live at https://svelte-dnd.js.org).

## Development

```bash
pnpm install
pnpm --filter @lukez/svelte-dnd exec playwright install chromium
pnpm build
pnpm test
```

`pnpm test` runs the tests in Chromium. `pnpm test:all` runs them in Chromium, Firefox and WebKit, which CI uses; install those with `playwright install chromium firefox webkit`.

Also: `pnpm lint`, `pnpm format`, `pnpm check:package`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: branch off `master`, open a pull request to `master`, and add a changeset (`pnpm changeset`) for any change to the package.

## Releasing

When changesets land on `master`, CI opens a "Version Packages" pull request that bumps the version and updates the changelog. Merging that pull request publishes the new version to npm.
