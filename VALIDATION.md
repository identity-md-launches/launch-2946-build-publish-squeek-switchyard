# Validation record

Revision checked on 2026-11-04 against the built `dist/`, served at a `/preview/` subpath. The implementation remains plain ES modules with JSDoc typechecking; no framework rewrite or runtime dependency was added.

The previous record's missing execution was reproduced. The build, typecheck, unit tests, browser checks and design probe have now run. **Completion of a genuine live-data game remains unverified because the public API did not return usable JSON from this machine.** Synthetic API tests below are not represented as live-data verification.

## Results against the brief

| Check | Observed result |
| --- | --- |
| `npm run build && git status --short dist` | Passed. Build copied the final `src/` into `dist/`; status lists the intended changed export files and new `dist/og.png`. |
| `npm test` | **14/14 passed**, including exact fixture math, safe-row selection, dedupe, latest-five order, wrong status/chain rejection, unknown versus zero, large decimal strings, undo/replay, PNG metadata, and export/source byte equality. |
| `npm run typecheck` | Passed, exit 0 (`tsc -p jsconfig.json`, `checkJs`, strict, no emit). |
| `node test/browser.mjs` | Passed deterministic checks in **Chromium 156 and WebKit 27.2**, at 390×844. Both engines also attempted the real API and recorded unavailable, not a pass. Machine browser paths were supplied externally, not embedded in source. |
| Genuine live-data game to completion | Attempted, **unavailable**. Public GET returned a Cloudflare HTTP 403 challenge (`cf-mitigated: challenge`) rather than settlement JSON. Browser requests also reached the game's explicit unavailable view. No real five-row board was obtained. |
| API-shaped fixture game to completion | Passed in both engines. Five synthetic rows marked `confirmationStatus: "safe"` render blocks, round ranges, work and five Sepolia receipt URLs. Missing work displays `unknown`; reported zero displays `0`. |
| Fixture score math | Passed in Node and both browsers: `[48,41,44,41,45]` → total 219, capacities `[98,72,49]`, exact minimum **10** over **243** routings. One optimal routing is **A, B, A, B, C**, with loads `[92,82,45]`. A deliberately poorer touch routing scores **13**, best **10**, gap **3**. |
| Undo and replay | Passed in both engines, mid-game and after completion. Undo restores only the last wagon; replay empties tunnels, resets the clock and preserves the five receipt URLs. Dispatch/undo/replay do not fetch again. |
| Clock regression | Reproduced the old 0:30 → 1:10 error using a controlled browser clock. After the fix, 40 seconds before first dispatch leaves 0:00; a 0:30 finish plus 40 seconds reading still resumes at 0:30. Five more seconds routing produces 0:35. Repeated result/Undo cycles retain 0:35. These are virtual time advances, not real waits. |
| Refresh regression | Reproduced losing a three-assignment board after N and a failed GET. Both engines now retain the board, receipts and assignments during a pending refresh and after network failure, HTTP 503, or only four eligible rows. Failure explains the retained board. A successful refresh swaps in a new empty game. Tested N and New game. |
| Practice fallback | Passed in both engines after initial network failure and after four eligible rows. Practice has a striped banner, blue surfaces and dashed borders, no fabricated receipts, and the fixed board. Completed, undid and replayed it. |
| Keyboard and touch | Passed 1/2/3, U, R, N, native Enter/Space and Tab. Disabling shortcuts prevents dispatch by number keys. Native result heading receives focus. Touch Send controls complete a game. Focus screenshot inspected. |
| Responsive and motion | No horizontal overflow at 320, 390, 768 or 1440 in both engines; also none at 390 with 200% text enlargement. Reduced motion disables Send transitions. No page script errors or failed local resources in deterministic checks. |
| First screen at 390 | Inspected in screenshots: product, five wagons, capacities and all three Send controls fit at 390×844. Each Send target is at least 44px high. Practice also fits its primary controls. |
| Share card | Exported and inspected a **1200×630 PNG**, linked by `og:image`, with image dimensions/type and `twitter:card=summary_large_image`. Favicon, title and descriptions are present. Actual hosted platform unfurling is not verified. |
| Deployed site and GitHub URLs | **After review, assigned by IMD.** No hosted addresses were supplied to this revision. The complete relative-path `dist/`, source and lockfile are delivered; footer links expose the local game and scoring source. |

## Evidence and reproducibility

Run from the repository root:

```sh
npm run build && git status --short dist
npm test
npm run typecheck
node test/browser.mjs
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

The browser check needs a separate development installation of Playwright with Chromium and WebKit and their host libraries. `IMD_PLAYWRIGHT` may point to its `index.mjs`; `CHROMIUM_EXECUTABLE` optionally selects Chromium. This run used external Playwright and provisioned WebKit's missing runtime libraries solely under disposable `test/scratch/`. No browser, package cache, library archive or vendored registry is part of the delivery. The supplied browser tool failed to launch; the same export was inspected through programmatic Playwright instead.

Packaging checked: the seven production files total **106,904 bytes**; all submitted project files, selected evidence and finding responses are under **1.2 MiB**, below the 8 MiB budget. No ignore file was changed. The lockfile was validated with `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` and remained unchanged. `git diff --check` and documentation-link checks pass.

The pinned probe is an input removed before submission. Its observed results are preserved in [probe-results.json](./test/evidence/probe-results.json). The optional test harness writes fresh files into `test/scratch/browser-checks/`; selected revision evidence is retained below:

- [Browser results](./test/evidence/browser-results.json): both engines, passed deterministic cases and explicitly unavailable live attempts.
- [390 API fixture](./test/evidence/390-api-fixture.png) and [1440 API fixture](./test/evidence/1440-api-fixture.png): synthetic input only; the app's normal live-data view is exercised without claiming these are real settlements.
- [390 WebKit practice](./test/evidence/390-practice-webkit.png), [practice result](./test/evidence/390-practice-result.png), and [visible keyboard focus](./test/evidence/390-focus-webkit.png).
- [Actual unavailable view](./test/evidence/390-unavailable.png) from the unmodified public-API attempt.

## Live data contract and limitations

The supplied independent review reports observing `status: "available"`, `chain.chainId: "11155111"`, decimal-string counts and **`confirmationStatus: "safe"` on rows** on 2026-11-04. That is attributed evidence from the review, not an independently observed JSON response in this revision. `src/rules.js:42` already includes `confirmationStatus`; a new executed unit test confirms `safe` qualifies and `pending` does not. Its selection behavior is unchanged.

Independent schema, CORS and real receipt/value matching could not be verified against the current public response: it was an HTML Cloudflare challenge. Squeekchain must serve accessible settlement JSON to complete that check; a repository change cannot make its service return it. No alternate endpoint, backend proxy, saved "live" board or invented API success was added. Re-run the harness when the API is accessible; its genuine API branch completes a selected board, checks the exact solver result and exercises undo/replay.

“Latest” retains the accepted interpretation: highest settled-through round, log index for ties, unknown rounds oldest. Older browsers without `AbortSignal.timeout` still take the unavailable path. Physical iOS devices, assistive screen-reader sessions, browser-native zoom, forced-colors mode, translated/RTL layouts, and actual social-platform unfurling were not tested. Text enlargement is not claimed as browser-native zoom.

## Better Interface review

Read the pinned workflow, the six domains' core principles and documentation method. Preserved the established cream rail yard, colored tunnel arches, hamster and distinct practice palette. Rendered checks covered the affected game, failure, refresh, result and replay states in Chromium and WebKit; the review is not a full accessibility certification.

| Domain | Coverage and result | Remaining limits |
| --- | --- | --- |
| Accessibility | Native buttons/links, descriptive receipt names, live status region and result focus checked in source; keyboard, touch, shortcut toggle, visible focus, reduced motion and enlarged text exercised. | No screen-reader, physical-device, native zoom or forced-colors session. |
| Layout | Inspected 390 and 1440 screenshots; measured 320/390/768/1440 reflow, all five wagons and three controls, full receipt wrapping, result and retry layouts. | No RTL/localization testing. |
| Writing | Verified consistent wagon/tunnel/overflow terms, game-rule disclaimer, explicit practice labeling, error reason and retry action. Refresh now says which board remains active. | Live API failure details are limited to what fetch exposes. |
| Typography | Five tokens, weights 400/700/800, tabular numbers and hashes reviewed; mobile h1 is 28px and result h2 20px; wrapping checked at 200% text. | Exact native font face varies by device. |
| Colors | Computed foreground/background pairs measured in both engines for normal and practice boards; every sampled active text pair exceeds 4.5:1. State words accompany colors. | Arbitrary device color rendering and every transition frame were not measured. |
| UI | Loading, unavailable, ready, assigned, overflow, finished, Undo, replay, refresh pending/error/success and disabled Send states exercised. Focus screenshot inspected; transitions are named properties, 150ms, opt-in to motion. | Animations-panel replay at 10% speed not performed. |

Measured rendered WCAG contrast (same values in both engines):

| Foreground / actual background | Ratio |
| --- | --- |
| Ink / live page | 15.11:1 |
| Muted text / live page | 7.66:1 |
| Muted labels / live surface | 8.10:1 |
| White / tunnel A button | 6.05:1 |
| White / tunnel B button | 6.80:1 |
| White / tunnel C button | 8.65:1 |
| Ink / practice page | 13.29:1 |
| Muted text / practice page | 7.26:1 |
| White / practice banner's solid text area | 16.13:1 |

### Findings and corrections

| Location | Reproduced finding | Correction and recheck |
| --- | --- | --- |
| `src/app.js:72`, `src/app.js:379` | Result-reading time entered elapsed time after Undo; clock ran before dispatch. | Nullable start time and adjustment for each stopped result interval. Both engines pass repeated Undo/timer regression. |
| `src/app.js:82` | New game discarded the frozen board before fetch succeeded. | Retain active game; swap only on successful selection. Both engines preserve three assignments for pending and all tested failed refreshes. |
| `src/styles.css:613` | At 390, result h2 equaled h1 at 28px. | Reuse `--text-lg`; both engines measure result 20px, title 28px. |
| `src/index.html:11`, `src/og.svg:5` | SVG-only share image and missing large-card metadata; original subtitle clipped when rasterized. | PNG export, dimensions and card tag; reduce the artwork subtitle to 32px so its right edge is inside the 1200px canvas. PNG dimensions tested and image inspected. |
| `src/styles.css:346`, `src/styles.css:514`, `src/styles.css:603` | Enlarging text to 200% widened the 390px page to 534px via wagon/tunnel labels and the result table. | Add `overflow-wrap: anywhere` to these three components. Both engines now remain 390px wide at 200% text. |

### Pinned taste probe

The exact unmodified probe command above passes **16/16** on the actual unavailable view at 320, 390 and 1440. Additional runs used a scratch-only Playwright adapter to feed synthetic API data and enter the practice result; no app or probe source was modified for these runs:

- API-shaped game: **15/16**. The only candidate is `eyebrows`: the monospace transaction hash in the last manifest row sits near the following “How to play” heading (`src/app.js:231`). Screenshot inspection confirms it is the required receipt data, not a heading kicker. Preserved the full receipt and did not alter the accepted layout to satisfy this false positive.
- Practice result: **16/16**.

All runs pass rendering, layout, targets, contrast, type sizes/families, casing/tracking, motion, share metadata and the remaining copy checks. The unavailable-view probe reports one target under the comfortable 44px size but passes the 24px/spacing baseline; primary Send controls were separately measured at least 44px. Screenshots were viewed, including the 390 first screen and desktop. No rendered observation is inferred solely from source.
