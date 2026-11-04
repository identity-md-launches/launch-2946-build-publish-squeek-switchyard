# Squeek Switchyard

An unofficial, mobile-first browser puzzle for Squeekchain. You are a hamster rail dispatcher: route five wagons, each carrying the completed blocks of one real Sepolia settlement batch, into three tunnels with different capacities. Lowest total overflow wins, and you try to do it in under a minute. Scores are game rules, not protocol economics.

The site is static and has no backend, wallet, account, secrets, tracking, wagers or contracts. Its only data source is a public GET to `https://api.squeekchain.com/v1/settlements`.

The production export, typecheck and all 14 unit/export tests pass. Chromium and WebKit pass the fixture game, practice, undo/replay, timer, refresh and responsive checks. A genuine live game remains unverified: the public API returned a Cloudflare 403 challenge during this revision. See [VALIDATION.md](./VALIDATION.md) for results and evidence.

## Install

You need Node 20 or newer. There are no package dependencies, so `npm install` has nothing to download.

```sh
npm install
```

## Preview

```sh
npm run preview
```

This serves `dist/` at `http://127.0.0.1:4173/preview/`. The subpath shows up any broken relative asset URLs. Set `PORT` to use another port.

## Rebuild

```sh
npm run build
```

The game is plain ES modules, so the production export is a copy of `src/` in `dist/`. Edit `src/`, rebuild, and commit both. The publisher serves the committed `dist/` and does not rebuild.

## Check

```sh
npm test            # score math, data selection, undo and replay, and dist matching src
npm run typecheck   # TypeScript over the JSDoc in src/; downloads TypeScript through npx
```

For browser regression checks, make Playwright available to Node, or set `IMD_PLAYWRIGHT` to the absolute path of an external installation's `playwright/index.mjs`, then run:

```sh
node test/browser.mjs
```

Install Chromium and WebKit through that Playwright installation first. The script serves `dist/` at a temporary `/preview/` subpath, closes its own server and browsers, and writes results to `test/scratch/browser-checks/`. It distinguishes genuine API attempts from synthetic test responses. Optional `CHROMIUM_EXECUTABLE` and `BROWSER_ENGINES` settings select a local Chromium executable or a comma-separated subset of engines.

## Layout

| Path | Purpose |
| --- | --- |
| `src/rules.js` | Data selection, capacities, scoring and the 3^5 solver. No DOM or network. |
| `src/app.js` | Fetching, rendering, keyboard shortcuts and focus. |
| `src/index.html`, `src/styles.css` | Page structure and design tokens. |
| `dist/` | The static export to host. |
| `test/` | Node tests. |
| `DESIGN.md` | Tokens, typography, components and responsive behaviour. |
| `VALIDATION.md` | What was checked, what was not, and the design review. |

## Verification and publishing

The fixture `[48,41,44,41,45]` produces capacities `[98,72,49]`, a minimum overflow of `10`, and optimal routing `A, B, A, B, C` across all 243 assignments. The clock starts on the first dispatch, stops at the result, and resumes from that stopped time after Undo. Failed refreshes retain the current board and assignments.

IMD publishes the submitted `dist/` and assigns the deployed site and GitHub source URLs after review. Neither URL has been supplied in this workspace, so none is invented here. Footer links expose the site's own game and scoring source in the meantime. All runtime assets use relative paths, including the 1200×630 PNG share card.
