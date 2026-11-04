# Squeek Switchyard design

Taken from the final source. Nothing here has been observed in a browser, because rendering could not be run (see `VALIDATION.md`). Sizes and layout behaviour are what the CSS declares.

## Overview

A one-screen dispatch game for phone players. It reads as a toy rail yard: a train of five wagons on a rail, dotted switch rails fanning out, and three arched tunnel mouths with their controls inside them. Data stays plain and legible, and the playfulness comes from shapes and the hamster dispatcher, not from decorated numbers.

The system-wide rule is that the board's source is always obvious. Live data uses warm cream and solid borders. Practice re-tints every surface blue, dashes the data borders and adds a striped banner.

## Colors

Defined in `src/styles.css` under `:root`, with practice overrides under `body[data-board="practice"]`. Notation is hex.

| Token | Live | Practice | Use |
| --- | --- | --- | --- |
| `--color-bg` | `#fff4dc` | `#e4e9f7` | Page background |
| `--color-surface` | `#fffbf0` | `#f4f6fd` | Wagons, tunnels, result and notice panels |
| `--color-ink` | `#2a1c10` | `#16203a` | Main text, current wagon fill, primary button |
| `--color-ink-muted` | `#5e4a36` | `#3f4a66` | Secondary text and labels |
| `--color-line` | `#8b7355` | `#5d6a8c` | Borders and table rules |
| `--color-rail` | `#8b7355` | `#5d6a8c` | Train rail and switch rails |
| `--color-neutral-fill` | `#e5d9c3` | `#cdd5ea` | Disabled controls, meter track, button hover |

These do not change between boards:

| Token | Value | Use |
| --- | --- | --- |
| `--color-tunnel-a` | `#0b6e6e` | Tunnel A and wagons sent to it |
| `--color-tunnel-b` | `#8a4b00` | Tunnel B and wagons sent to it |
| `--color-tunnel-c` | `#6b2f8f` | Tunnel C and wagons sent to it |
| `--color-on-fill` | `#ffffff` | Text on tunnel and practice fills |
| `--color-over` | `#b3261e` | Overflow only, always with the word "Over" |
| `--color-live` | `#0b6e6e` | Round marker beside "Live Sepolia data" |
| `--color-focus` | `#1b4dff` | Focus ring |
| `--color-practice` | `#16203a` | Practice banner and Practice button |
| `--color-practice-soft` | `#e4e9f7` | Practice button fill |
| `--color-practice-stripe` | `#ffd34d` | Practice banner stripes |

Hand-computed contrast values and their limits are in `VALIDATION.md`.

## Typography

No web fonts are loaded, which keeps the site fast. Which face renders depends on the device and has not been checked.

- `--font-body`: `ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Nunito", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
- `--font-data`: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`, for transaction hashes only

| Token | Size | Role |
| --- | --- | --- |
| `--text-2xl` | 2.25rem | `h1` from 62rem up |
| `--text-xl` | 1.75rem | `h1` on phones, result headline |
| `--text-lg` | 1.25rem | `h2`, wagon block counts |
| `--text-base` | 1rem | Body, `h3`, buttons |
| `--text-sm` | 0.875rem | Facts, labels, notes, footer |

Weights are 400 for body and hashes, 700 for labels, links and buttons, and 800 for headings and key values. Body line height is 1.5 and headings use 1.15. `h1` has -0.02em tracking. Changing numbers use `tabular-nums`, and long values wrap with `overflow-wrap: anywhere` so they are never clipped.

## Layout

Spacing uses `--space-1` to `--space-8` (0.25, 0.5, 0.75, 1, 1.5 and 2rem). `.page` caps at 72rem with 0.75rem side margins that respect safe areas.

- **Under 62rem:** one column in this order: header, line, status, train, current wagon, rails, tunnels, rules note, result, controls, manifest, how-to, footer. The train stays five columns and the tunnels three, down to 320px wide. Long labels wrap in place.
- **62rem and up:** `.layout` becomes `minmax(0, 1fr) 20rem` with the how-to in the side column. Tunnels gain more padding and the manifest becomes two columns.

The CSS is estimated, not measured, to put the tunnels and their Send buttons on the first screen at 390 wide.

## Elevation & Depth

The system is flat, with no shadows. Depth comes from the surface colour against the background and from borders.

## Shapes

- `--radius-sm` 0.5rem: wagons, practice banner, meter
- `--radius-md` 0.75rem: buttons and panels
- `--radius-arch` 2.5rem: top corners of tunnels, which is what makes them read as tunnel mouths

Wheels are two circles drawn with `.wagon::before` and `::after`.

## Components

All are patterns rendered by `src/app.js` and styled in `src/styles.css`, not library exports.

- **Wagon (`.wagon`)**: one train tile showing number, blocks and state. `data-state` is `now` (ink fill), `waiting` (surface) or `sent` (tunnel colour). The text "Now", "Wait" or "To A" repeats the state.
- **Tunnel (`.tunnel`)**: arch with name, state word (Room, Full, Over), meter, load, capacity, overflow and its Send button. `data-tunnel` picks the colour. `data-state="over"` adds the red border, hatched meter and red overflow value.
- **Send button (`.send`)**: the three dispatch controls. Keys 1, 2 and 3 do the same. Native `disabled` applies once all wagons are sent.
- **Button (`.btn`)**: outlined for controls, `.btn-primary` for the single filled action, `.btn-practice` with a dashed border for entering practice. Minimum height is 2.75rem, and pressing scales to 0.96 when motion is allowed.
- **Facts (`.facts`)**: label and value rows built on `dl`, used in the current wagon, result and manifest.
- **Result (`.result`)**: shows after the fifth wagon and receives focus. Holds the player's overflow, best result, time and a routing table.
- **Notice panel (`.notice-panel`)**: loading and unavailable states. Unavailable gives the reason plus Try again and Practice buttons.
- **Status region (`#announcer`)**: a stable `role="status"` element for spoken updates.

## Do's and Don'ts

- Do show every new data value as `unknown` when absent and `0` when reported as zero, using `formatCount`.
- Do keep the practice tint, banner and dashed borders on anything that shows practice values.
- Do pair each state colour with a word. `--color-over` never appears alone.
- Don't use a tunnel colour for anything except that tunnel.
- Don't describe a score without calling it a game rule.
- Don't add a shadow, a seventh type size or a fourth weight.

To add a page, start from `.page`, use the existing tokens, take actions from `.btn`, and show data with `.facts`.
