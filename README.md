# Squeek Switchyard

An unofficial, mobile-first browser puzzle for Squeekchain. You are a hamster rail dispatcher: route five wagons, each carrying the completed blocks of one real Sepolia settlement batch, into three tunnels with different capacities. Lowest total overflow wins, and you try to do it in under a minute. Scores are game rules, not protocol economics.

The site is static and has no backend, wallet, account, secrets, tracking, wagers or contracts. Its only data source is a public GET to `https://api.squeekchain.com/v1/settlements`.

> **Status: written but never run.** This machine's shell and browser tools failed for the whole session, so the build, tests, typecheck and all browser checks are still outstanding, nothing is committed, and there is no deployed URL yet. See [VALIDATION.md](./VALIDATION.md) before relying on it.

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

## Before publishing

1. Run the commands in [VALIDATION.md](./VALIDATION.md#checks-to-run) and fix anything they find.
2. Compare a live API response with the `isSafeRow` assumption in `src/rules.js:49`. If the field differs, no live game can start.
3. When the GitHub repository exists, point the footer source links in `src/index.html:150` at it. They currently open the site's own `app.js` and `rules.js`.
