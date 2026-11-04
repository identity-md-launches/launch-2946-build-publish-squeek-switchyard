# Validation record

**Completion: Incomplete.** The site's source and export are fully written, but no code has ever been executed and the required checks did not run. Nothing below counts as a pass unless it says how it was established.

## What blocked the checks

| Tool | What it answered | Effect |
| --- | --- | --- |
| Bash (every command, retried throughout the session, including `pwd` and `true`) | `Sandbox is required but failed to initialize: Failed to create bridge sockets after 5 attempts. Restart to retry. Running it outside the sandbox (dangerouslyDisableSandbox) is not allowed either.` | No `node`, `npm`, `git`, build, tests or typecheck. |
| Browser tool (`browser_navigate`) | `Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome. Run "npx playwright install chrome"` | No rendered check. The suggested install needs the shell. |
| WebFetch to `api.squeekchain.com`, `squeekchain.com` and `docs.squeekchain.com` | `HTTP 403 Forbidden` | The real API response was never seen. A browser may be treated differently, so this does not show the API is down. |
| WebSearch for the API's field names | No documentation found | The field that marks a row "safe" could not be confirmed. |

Only the file read, write and search tools worked.

## Results against the brief

| Requirement | Result | How established |
| --- | --- | --- |
| Live-data game to completion | **Not run** | Never executed. |
| Undo and replay in the UI | **Not run** | Logic covered by a test that has not been run. |
| Practice fallback in the UI | **Not run** | Never executed. |
| Fixture `[48,41,44,41,45]` gives capacities `[98,72,49]` and minimum 10 | **Worked by hand; code not run** | See below. `test/rules.test.mjs` asserts it, unrun. |
| Production build | **Not run** | `dist/` was written by hand with the same content as `src/`. Byte equality is unconfirmed until `test/dist.test.mjs` runs. |
| Typecheck | **Not run** | |
| `taste.mjs` design probe | **Not run** | Needs Node and Playwright. |
| 390 first screen shows the product and main action | **Not verified** | Estimated from CSS at about 640px tall. No screenshot exists. |
| Committed to git | **Not done** | `git` needs the shell, and `.git/` is off limits to direct edits. Files are in the working tree only. |
| Deployed site URL | **None** | Publishing happens after the job. No URL exists to report. |
| GitHub source URL | **None** | The repository has no remote. Footer links open the site's own source files. |

### Score math by hand

The total is 219. `floor(45*219/100) = 98`, `floor(33*219/100) = 72`, and the remainder is `219-98-72 = 49`.

Without overflow, tunnel A takes at most two wagons (the smallest three total 126), and B and C take at most one each (the smallest two total 82). That places only four wagons, so one tunnel must take an extra wagon. The cheapest cases are A with three (at least 28 over), B with two (at least 10 over) and C with two (at least 33 over), so overflow is at least 10. Routing `{48,44}`, `{41,41}`, `{45}` gives loads 92, 82 and 45, for overflow exactly 10. The minimum is 10.

## Unverified assumptions

1. **How rows are marked safe (`src/rules.js:41`, `src/rules.js:49`).** The brief does not name the field. A row counts as safe if `safe` or `isSafe` is true, or if `finality`, `safety`, `blockTag`, `confirmationStatus` or `status` reads `safe` or `finalized`, with `finality`, `safety` or `blockTag` also accepted at the top level. Anything else is rejected. If the real field differs, every live load shows the unavailable state, which is safe but means **no live game can start until this is corrected**. Unsafe data is not shown as safe.
2. **Other response details.** Field names come from the brief. Their exact types, and whether the API sends CORS headers that allow a browser fetch, are unconfirmed. Missing CORS would also produce the unavailable state.
3. **"Latest" means highest `settledThroughRound`,** with `logIndex` breaking ties. Rows with no round sort as oldest.

## Departures from the assignment's defaults

- **Plain ES modules instead of Vite, React and TypeScript.** The toolchain could not be installed or run. Zero dependencies let the export work without a build step. JSDoc types stand in for TypeScript.
- **`package-lock.json` was written by hand.** It is correct for a project with no dependencies, and `npm install` should leave it unchanged or nearly so. No integrity hashes were invented.
- **`og:image` is an SVG (`src/index.html:11`).** A PNG cannot be produced with text-only file tools. Many link unfurlers ignore SVG, so replace it with a PNG once the shell works.

## Design review

**Coverage: source only.** Better Interface's "without a browser" checks were applied by reading the code. Every "with a browser" check is **Not verified**.

| Domain | Status | Inspected | Not verified |
| --- | --- | --- | --- |
| Accessibility | Checked (source) | Native buttons and links, button names, `:focus-visible`, status region, reduced-motion guards, focus moves after finish, undo and replay, shortcut off switch | Tab walk, visible focus, accessibility tree, screen reader, 200% zoom |
| Layout | Checked (source) | Logical properties, content-based 62rem breakpoint, DOM order, wrapping rows | All widths, overflow at 320, 390 and 1440 |
| Writing | Checked (source; no browser required) | Verb-first buttons, plain error reasons with a next step, consistent terms, descriptive links | None |
| Typography | Checked (source) | Five sizes, three weights, tabular numbers, wrapping | Actual fonts, wrapping at real data lengths |
| Colors | Checked (source) | Semantic tokens, contrast computed by hand from token values, not measured | Every rendered pair |
| UI | Checked (source) | Named transition properties, press scale 0.96, 150ms motion, no endless animation, no border-plus-shadow | All states, WebKit |

Contrast computed by hand from declared tokens, not measured on a rendered page:

| Pair | Approx. ratio |
| --- | --- |
| White on tunnel A `#0b6e6e` | 6.1:1 |
| White on tunnel B `#8a4b00` | 6.8:1 |
| White on tunnel C `#6b2f8f` | 8.6:1 |
| `--color-ink-muted` on `--color-bg`, live | 7.7:1 |
| `--color-ink-muted` on `--color-bg`, practice | 7.3:1 |
| `--color-over` on `--color-surface`, live | 6.3:1 |

### Findings fixed while building

All were found by reading the source. None has been rechecked in a browser.

| Severity | Location | Finding | Fix |
| --- | --- | --- | --- |
| Medium | `src/index.html:142`, `src/app.js:386` | Single-key shortcuts had no off switch (WCAG 2.1.4). | Added a "Use keyboard shortcuts" checkbox. |
| Medium | `src/styles.css` | Four font weights against a bar of three. | Removed 600. Weights are 400, 700 and 800. |
| Medium | `src/styles.css:457` | The current wagon's receipt link was a small tap target. | Minimum height of 2.75rem. |
| Low | `src/styles.css:9` | A "disabled" token also painted the meter track and hover states. | Renamed to `--color-neutral-fill`, and added role tokens for live and practice colours. |
| Low | `src/app.js:24` | A long repeated practice placeholder would trip the repetition check and crowd narrow rows. | Shortened to `none (practice)`. |
| Low | `src/styles.css:284` | The practice banner's stripes relied on a fragile `border-image`. | Replaced with a background layer. |

### Remaining limitations

- Older browsers without `AbortSignal.timeout` (`src/app.js:96`), such as Safari before 16, always show the unavailable state.
- Practice is offered only from the unavailable state, as the brief describes.
- RTL and translated text are not supported.

## Checks to run

Run these from the repository root once the shell works, and replace the results above with what they report:

```sh
npm test
npm run typecheck
npm run build && git status --short dist   # expect no changes in dist/
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

Then, in a browser at 320, 390 and 1440 wide, in Chromium and WebKit:

1. Play the live board to the result. Confirm the wagon values and receipt links match the API response.
2. Undo mid-game and after the result, then replay. Confirm the same board returns.
3. Block the API, confirm the unavailable state, then finish the practice board. Its best result should be 10.
4. Complete a game with the keyboard only, then turn the shortcuts off and confirm the keys stop working.
