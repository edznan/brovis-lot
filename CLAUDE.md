# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

A Progressive Web App (PWA) for **Brovis DD Visoko** (Bosnian poultry processor) that generates printable A4 pallet declaration sheets. Installed on Windows 11 via Edge/Chrome, must work fully offline, mimics Windows 11 Fluent Design, and prints output that closely matches scanned originals (see `viber_image_*.jpg` in repo root).

`PROMPT.md` is the original build spec — useful for domain model and field definitions, but the **language convention has been overridden**: see #3 below.

## Development commands

- **Serve locally** (required — `file://` breaks PWA features): `python3 -m http.server 8000`, then open `http://localhost:8000` in Chromium or Edge.
- **No build step.** Plain HTML/CSS/vanilla JS — no bundler, no package manager, no test runner.
- **Deploy:** push to GitHub; site serves from Pages at the repo subpath.
- **Ship an update:** bump `CACHE_NAME` in `service-worker.js` (e.g. `"brovis-v2"` → `"brovis-v3"`) so installed clients see the update banner.

## Hard constraints (will cause silent breakage if violated)

1. **No frameworks, no bundlers, no runtime npm dependencies.** Vanilla JS only. IndexedDB is wrapped by a hand-written Promise layer in `db.js`. Third-party assets are vendored locally (e.g. BoxIcons under `vendor/boxicons/`).
2. **All asset paths must be relative** (`./app.css`, never `/app.css`) — absolute paths break under the GitHub Pages subpath. This applies to `service-worker.js` precache list and `manifest.json`.
3. **Single-locale Bosnian.** All UI strings (page titles, buttons, modal labels, empty states, toasts, infobars) live in `labels.js` as `UI_LABELS`. Form-label and print-output strings live as `BS_LABELS`. Default data values live as `BS_DEFAULTS`. Code identifiers, filenames, console logs stay in English.
   - This **overrides** the original "Language Convention (strict)" section of `PROMPT.md`, which required English UI chrome. Treat `UI_LABELS` as the single source for screen text.
4. **No auth.** The app is open — no password gate, no session lock. Older versions had auth; do not reintroduce it without an explicit request.
5. **File and folder names: lowercase, hyphenated, ASCII only.** Linux is case-sensitive.
6. **PDFs are not generated programmatically.** Print output uses `window.print()` against `print.css`, rendering into a hidden `#print-root` div. Batch printing requires user-driven "Štampaj sljedeći" confirmation between docs.
7. **Printed output must visually match the scanned originals.** Field order, Bosnian labels (per `BS_LABELS`), box layout, and footer format (`Visoko; DD.MM.YYYY.` — trailing period preserved) are non-negotiable. The MSM type uses the short `Veterinarska no.` label and renders the chemical-analysis 3-col table as the last row of the values column.
8. **`.gitattributes` enforces LF line endings.**

## Architecture overview

Flat single-folder layout:

- **`app.js`** — hash-based router (`#/dashboard`, `#/type/:id`, `#/new/:typeId`, `#/edit/:id`, `#/settings`, `#/types`), splash, screen controllers, validation, toasts. No router library.
- **`db.js`** — Promise wrapper around native IndexedDB. Database `brovis-pallet-app` v1 with three stores: `documents` (indexes on `typeId`, `createdAt`, `paletaBroj`), `types`, `settings` (single-row-per-key).
- **`pdf.js`** — `printDocument(docId)` renders the print template into `#print-root`, calls `window.print()`, clears on `afterprint`. Also `startBatchPrint(ids)`.
- **`types.js`** — `SEED_TYPES` array (5 product types). Seeded into the `types` store on first run, then user-editable.
- **`labels.js`** — `BS_LABELS` + `BS_DEFAULTS` (printed/form Bosnian) and `UI_LABELS` (screen UI Bosnian).
- **`service-worker.js`** — cache-first; precaches the app shell + BoxIcons; `clients.claim()` on activate; listens for `{type: 'SKIP_WAITING'}`.
- **`vendor/boxicons/`** — vendored BoxIcons 2.1.4 (CSS + fonts). UI icons are `<i class="bx bx-..."></i>`. Print template stays SVG-only.

### Domain model

The `Document` shape (full schema in `PROMPT.md`) has two auto-calculated fields with manual-override toggles:

- `bestBeforeDate` = `productionDate + type.shelfLifeDays`
- `grossWeight` = `netWeight + palletWeight`

`paletaBroj` is suggested as `last paletaBroj for this type + 1`, preserving leading-zero formatting.

`chemicalAnalysis` (fat/protein/moisture) is rendered **only** when `type.requiresChemicalAnalysis` is true (currently only the MSM type).

### Form validation

- `validate()` returns `{ messages, invalidEls }`.
- On invalid save: `showErrorToast()` flashes a red bottom-left toast with a bulleted list of error messages and adds `.is-invalid` to each invalid field. The first invalid field is scrolled into view and focused.
- Typing into an `.is-invalid` field clears the highlight (`inputBound` handles this).

### Bootstrap flow

Splash (session-scoped) → seed `types` from `SEED_TYPES` + settings from `BS_DEFAULTS` → `navigator.storage.persist()` → dashboard. No auth.

## Testing

No automated test suite. The acceptance criteria are the manual checklist in `PROMPT.md` — exercise the full flow in Chromium against `python3 -m http.server 8000`, verify the service worker registers, verify offline mode in DevTools, and visually compare printed output against the scans in repo root.
