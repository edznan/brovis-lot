# Brovis Pallet Declaration Generator — Build Spec

Build an installable Progressive Web App (PWA) for generating printable PDF pallet declaration sheets for a Bosnian poultry processor (Brovis DD Visoko). The app must work fully offline once installed, look and feel like a native Windows 11 (Fluent Design) application, and run in its own window when installed.

## Language Convention (strict)

- **All code, comments, variable names, function names, file names, UI chrome (buttons, menus, page titles, settings labels, error messages, tooltips, console logs) are in English.**
- **Bosnian appears ONLY in:**
  - Field labels on the document form and printed output (these match the source document text exactly: "Veterinarska oznaka No.", "Datum proizvodnje", "Najbolje upotrijebiti do", etc.)
  - Default data values (producer name, address, recipient name, place name)
  - Document type names (the title inside the bordered box on each printed declaration)

Treat Bosnian strings as data, not as code. Centralize them in a single `labels.js` constants file so they're easy to audit and update.

## Tech Stack (strict)

- **Plain HTML + CSS + vanilla JavaScript.** No frameworks, no bundlers, no build process.
- **PWA:** manifest.json + service worker for offline caching and installability.
- **IndexedDB** for storage. Write a thin Promise wrapper around native IndexedDB. Zero runtime dependencies.
- **PDF generation:** use `window.print()` with a dedicated print stylesheet. Render each document as an HTML template styled to match the source exactly, then trigger print. The user picks "Save as PDF" in the print dialog or sends to a physical printer. For batch printing (one PDF per document), queue prints with a user-driven "Next" confirmation between each, since browsers do not allow programmatic queueing of print dialogs.
- Single folder, flat structure. Suggested files:
  - `index.html`
  - `app.css` (Fluent styling, screen)
  - `print.css` (document layout, print only)
  - `app.js` (router, controllers)
  - `db.js` (IndexedDB layer, Promise-based)
  - `pdf.js` (print rendering)
  - `types.js` (seed document types)
  - `labels.js` (all Bosnian strings as constants)
  - `manifest.json`
  - `service-worker.js`
  - `icons/` (PWA icons — generate 192px and 512px PNG placeholders, plus 32px favicon and maskable variants)
  - `.gitattributes`
  - `README.md`

## Cross-Platform Development Notes

The developer works on Linux. The end user is on Windows. The browser is the runtime on both, so platform differences are minor, but these rules prevent silent breakage.

### File naming convention (strict)
- All file names and folder names: lowercase, hyphenated, ASCII only.
- Examples: `print.css`, `service-worker.js`, `icons/icon-192.png`.
- Never `Icon.png`, `serviceWorker.js`, or anything with spaces.
- Linux filesystems are case-sensitive. A file referenced as `Icon.png` but stored as `icon.png` will load on Windows and fail silently on Linux.

### Line endings
- Include a `.gitattributes` file at the project root with:
```
  * text=auto eol=lf
  *.bat text eol=crlf
  *.png binary
  *.jpg binary
  *.ico binary
```

### Service worker scope and paths
- All asset paths in `service-worker.js` precache list and in `manifest.json` must be **relative** (`./app.css`, not `/app.css`).
- Absolute paths break on GitHub Pages where the app lives under a subpath like `/repo-name/`.
- Set `start_url: "./index.html"` and `scope: "./"` in manifest.

### Local development
- Developer serves over HTTP locally: `python3 -m http.server 8000`, then visits `http://localhost:8000`.
- Tests in Chromium or Edge (PWA features). Firefox desktop lacks PWA install.

### Production deployment
- Target: GitHub Pages.
- Repo root contains the app files directly (no build step), deploys as-is.
- The user installs the PWA from the deployed HTTPS URL in Edge once. After that, the app runs in its own window and works offline.

## PWA Requirements

### `manifest.json`
```json
{
  "name": "Brovis Pallet Declarations",
  "short_name": "Brovis Pallets",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#0078D4",
  "background_color": "#F3F3F3",
  "lang": "en",
  "description": "Generate and print pallet declaration sheets for poultry processing.",
  "categories": ["business", "productivity"],
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "./icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Service Worker
- Cache-first strategy for all app assets.
- Cache version constant: `const CACHE_NAME = "brovis-v1";` — bump this on every release.
- On `install`: precache the full app shell (all files listed above).
- On `activate`: clean up old caches, `clients.claim()`.
- On `fetch`: serve from cache, fall back to network, fall back to a friendly offline page.
- Listen for `message` with `type: 'SKIP_WAITING'` to handle user-driven updates.

### Install Prompt
- Listen for `beforeinstallprompt`, stash the event.
- Show an "Install" button in the top-right of the dashboard, only when installable and not already installed.
- Detect installed state via `window.matchMedia('(display-mode: standalone)')` and hide the install button in that case.

### Update Flow
- When a new service worker is detected (`registration.onupdatefound`), show a Fluent-style InfoBar at the top: "An update is available. Reload to apply." with a Reload button that calls `registration.waiting.postMessage({type: 'SKIP_WAITING'})` then `window.location.reload()`.

## Storage Durability

- On first launch (after password setup), call `navigator.storage.persist()` to request persistent storage. This protects IndexedDB from automatic eviction under disk pressure.
- In Settings, show storage usage: call `navigator.storage.estimate()` and display "Using X MB of available Y GB" so the user can see they're nowhere near a limit.
- Surface a warning banner if usage exceeds 80% of quota (defensive, will rarely trigger).
- Nudge the user with a Fluent InfoBar on the dashboard if `lastExportDate` in settings is more than 7 days ago: "Backup recommended. Last export: 12 days ago. Export now."

## Domain Model

```javascript
// Document
{
  id: string,                 // uuid
  typeId: string,             // refs DocumentType.id
  paletaBroj: string,         // e.g. "01", "1903"
  producer: {
    name: string,             // default: "BROVIS DD VISOKO"
    address: string,          // default: "Dobrinje bb, Visoko, Bosna i Hercegovina"
    vetControlNumber: string  // default: "2-116"
  },
  recipient: string,          // default: "OVAKO d.o.o Mostarsko raskršće bb  Sarajevo"
  vetMarkNumber: string,      // "Veterinarska oznaka No.", e.g. "0012771"
  originOfBreeding: string,   // "Porijeklo uzgoja", e.g. "L-96", "LKT-60F6"
  productionDate: string,     // ISO date
  bestBeforeDate: string,     // ISO date, auto-calculated, overridable
  temperature: string,        // e.g. "-12 ° C" or "-18 ° C"
  totalBlocks: number,        // "Ukupno blokova"
  netWeight: number,          // "Neto težina kg"
  palletWeight: number,       // "Težina palete" or "Težina palete/kaveza"
  grossWeight: number,        // "Bruto težina", auto-calculated as net+pallet, overridable
  footer: {
    place: string,            // default: "Visoko"
    date: string              // ISO date, defaults to today
  },
  chemicalAnalysis: {         // null unless type.requiresChemicalAnalysis
    fat: number,              // MAST %
    protein: number,          // PROTEIN %
    moisture: number          // VLAGA %
  } | null,
  createdAt: string,          // ISO timestamp
  updatedAt: string           // ISO timestamp
}
```

## Document Types (seeded, but editable)

```javascript
// types.js
const SEED_TYPES = [
  {
    id: "pileci-file-ii",
    title: "PILEĆI FILE-II- ZAMRZNUT  ZA PRERADU",
    defaultTemperature: "-12 ° C",
    shelfLifeDays: 365,
    requiresChemicalAnalysis: false,
    weightLabel: "palete"  // renders as "Težina palete"
  },
  {
    id: "pileca-jetra-rinfuz",
    title: "PILEĆA JETRA RINFUZ\nZAMRZNUTA ZA PRERADU",
    defaultTemperature: "-12 ° C",
    shelfLifeDays: 365,
    requiresChemicalAnalysis: false,
    weightLabel: "palete-kaveza"  // renders as "Težina palete/kaveza"
  },
  {
    id: "pileca-kozica-ii",
    title: "PILEĆA KOŽICA-II- ZAMRZNUTA ZA PRERADU",
    defaultTemperature: "-12 ° C",
    shelfLifeDays: 365,
    requiresChemicalAnalysis: false,
    weightLabel: "palete"
  },
  {
    id: "pileci-batak-karabatak",
    title: "PILEĆI BATAK SA KARABATAKOM BEZ KOSTI I KOŽE-ZAMRZNUT ZA PRERADU",
    defaultTemperature: "-12 ° C",
    shelfLifeDays: 365,
    requiresChemicalAnalysis: false,
    weightLabel: "palete-kaveza"
  },
  {
    id: "msm-pilece-meso",
    title: "MEHANIČKI  SEPARISANO PILEĆE MESO – MSM   ZAMRZNUTO - ZA PRERADU",
    defaultTemperature: "-18 ° C",
    shelfLifeDays: 90,
    requiresChemicalAnalysis: true,
    weightLabel: "palete-kaveza"
  }
];
```

The Types management screen lets the user add, edit, and delete custom types with the same shape.

## Bosnian Labels Constants

```javascript
// labels.js
const BS_LABELS = {
  paletaBroj: "Paleta broj:",
  proizvodjac: "Proizvođač :",
  vetKontrolniBroj: "Veterinarski kontrolni broj  izvoznog objekta:",
  vetOznaka: "Veterinarska oznaka No.:",
  vetOznakaShort: "Veterinarska no.",  // MSM variant
  primatelj: "Primatelj / Uvoznik:",
  porijekloUzgoja: "Porijeklo uzgoja:",
  datumProizvodnje: "Datum proizvodnje:",
  najboljeUpotrijebiti: "Najbolje upotrijebiti do:",
  potrebnaTemperatura: "Potrebna temperatura\nskladištenja i transporta",
  ukupnoBlokova: "Ukupno blokova",
  netoTezina: "Neto težina kg:",
  tezinaPalete: "Težina palete :",
  tezinaPaleteKaveza: "Težina palete/kaveza :",
  brutoTezina: "Bruto težina:",
  hemijskaAnaliza: "HEMIJSKA ANALIZA % :",
  mast: "MAST",
  protein: "PROTEIN",
  vlaga: "VLAGA"
};

const BS_DEFAULTS = {
  producerName: "BROVIS DD VISOKO",
  producerAddress: "Dobrinje bb, Visoko, Bosna i Hercegovina",
  producerVetControl: "2-116",
  recipient: "OVAKO d.o.o Mostarsko raskršće bb  Sarajevo",
  place: "Visoko"
};
```

## Auto-Calculation Rules

- `bestBeforeDate` = `productionDate` + `type.shelfLifeDays` days. Editable via "Manual override" toggle.
- `grossWeight` = `netWeight` + `palletWeight`. Editable via override toggle.
- `paletaBroj`: when creating a new document, suggest `last paletaBroj for this type + 1`, formatted with leading zero if the previous one was 2 digits. Editable.
- `footer.date`: defaults to today, editable.

## Screens / Routes

Hash-based routing (`#/dashboard`, `#/type/:id`, `#/edit/:id`, `#/new/:typeId`, `#/settings`, `#/types`). No router library.

### Splash Screen
- Shows ONLY on first load of the session (`sessionStorage.getItem('splashShown')` check).
- Set the flag after splash completes so reloads within the same session skip it.
- Brovis-style branding (simple SVG placeholder logo), app name "Pallet Declarations", Fluent progress ring spinning ~1.2 seconds, fade into auth gate or dashboard.
- Mica/acrylic background.

### Password Gate
- After splash, before dashboard.
- Password stored as SHA-256 hash (use `crypto.subtle.digest`) + random salt in IndexedDB `settings` store.
- First run: prompts user to create a password (two fields, confirm match).
- Subsequent loads: single password field, Enter submits.
- Session-persistent auth via `sessionStorage.setItem('authed', '1')`.
- "Reset (wipes all data)" link below the password field, behind a confirmation modal that requires typing "RESET" to confirm.

### Dashboard
- Page title "Dashboard", 28px / 600.
- Top bar: app title left; right side: Install button (when applicable), Settings icon, Types icon, Export icon.
- **Big tiles** in responsive grid (3 cols ≥1200px, 2 cols ≥720px, 1 col below). One per document type:
  - Type title (truncated if multi-line)
  - Document count badge
  - Last-created date
  - Inline SVG icon distinct per type (chicken fillet, liver, skin, leg, ground meat — simple monochrome line icons)
  - 200px tall, 8px corners, Mica background, reveal-on-hover (radial gradient following cursor via CSS variables updated on `mousemove`)
- **FAB** bottom-right:
  - 56px circular, accent color, plus icon
  - Click expands UPWARD into a stack of mini-FABs (40px), one per type, with label pill to the left
  - Staggered 50ms animation on entry
  - Click outside or Esc to collapse
  - Click a mini-FAB → navigate to `#/new/:typeId`

### Type Detail (Document List)
- Route: `#/type/:typeId`
- Header: back button, type title, document count.
- Search bar: filters across `paletaBroj`, `vetMarkNumber`, `originOfBreeding`.
- Filters: date range (production date from/to); sort by created date / production date / paleta broj (asc/desc).
- Table columns: checkbox, Paleta broj, Vet. mark, Production date, Net kg, Actions (Edit, Print, Delete).
- Bulk action bar when ≥1 row checked: "Print selected", "Delete selected".
- Empty state: friendly message + "Tap + to create one."
- Danger zone at bottom: "Delete all documents of this type" — confirmation modal requires typing the exact type title.

### New / Edit Document
- Route: `#/new/:typeId` or `#/edit/:id`
- Form grouped in Fluent cards:
  - **Pallet:** paletaBroj (auto-suggested, editable)
  - **Producer:** collapsed by default; expanded shows name, address, vet control number (pre-filled from settings)
  - **Product:** type title (read-only), recipient (pre-filled), vet mark number, origin of breeding
  - **Dates:** production date (date input), best-before date (auto-calc with "Manual override" toggle)
  - **Storage:** temperature (pre-filled from type), total blocks, net weight, pallet weight, gross weight (auto-calc with override toggle)
  - **Chemical analysis:** rendered ONLY if `type.requiresChemicalAnalysis`. Three numeric inputs: fat, protein, moisture. Decimals allowed.
  - **Footer:** place (default "Visoko"), date (default today)
- Sticky bottom action bar: Cancel (subtle), Save (standard), Save & Print (accent).
- Required-field validation with inline error messages in English under each field.
- Unsaved-changes guard: navigating away or closing prompts confirmation.

### Settings
- Route: `#/settings`
- Sections:
  - **Producer defaults:** name, address, vet control number.
  - **Default recipient.**
  - **Default place.**
  - **Change password** (current + new + confirm).
  - **Theme:** Auto (system) / Light / Dark.
  - **Storage:** display usage and quota from `navigator.storage.estimate()`.
  - **Data management:** Export all (JSON), Import (file picker with "Replace all" or "Merge by id" options), Delete all data (requires typing "DELETE ALL").

### Document Types Management
- Route: `#/types`
- List of types with edit / delete icons.
- "Add new type" button → modal form: title (textarea, allows line breaks), default temperature, shelf-life days, requires chemical analysis (checkbox), weight label (radio: "Težina palete" / "Težina palete/kaveza").
- Cannot delete a type that has documents — show count, force user to delete or reassign first.

## PDF / Print Output

Critical. Must closely match the original documents.

### Layout (A4 portrait, 210mm × 297mm, ~20mm margins)

- **Header row:**
  - Left: Brovis logo placeholder (oval SVG, "Brovis" text, small "AKOVA GROUP" subtitle).
  - Center: "Paleta broj:" label + the pallet number in large bold (~42pt).
  - Right: empty bordered rectangle ~80mm × 50mm (reserved for stamp).
- **Producer box** (below logo, left side): bordered rectangle:
  - "Proizvođač :" (bold)
  - Producer name (italic bold)
  - Address (italic)
  - "Veterinarski kontrolni broj  izvoznog objekta: 2-116" (smaller)
- **Product title box** (below producer box): bordered rectangle, centered text, the document type's title. Respects `\n` line breaks.
- **Main data table:** two columns
  - Left: Bosnian labels, plain text.
  - Right: single bordered column with stacked cells separated by horizontal dividers, each containing one value.
  - Row order: Veterinarska oznaka No. / Primatelj / Porijeklo uzgoja / Datum proizvodnje / Najbolje upotrijebiti do / Potrebna temperatura / Ukupno blokova / Neto težina kg / [pallet weight label per type] / Bruto težina.
- **For MSM only:** below the main table, a 3-column table for HEMIJSKA ANALIZA % with headers MAST | PROTEIN | VLAGA and one value row.
- **Footer (bottom):** "Visoko; DD.MM.YYYY." (trailing period preserved). Format the date as DD.MM.YYYY.
- Body labels use a serif font (Times New Roman or similar) to match originals. Titles in bordered boxes are bold serif.

### Print mechanism

- Hidden `<div id="print-root">` in `index.html`.
- `print.css` with `@media print`:
  - Hide everything except `#print-root`.
  - `@page { size: A4 portrait; margin: 0; }` (instruct user in README to disable browser headers/footers).
  - Use exact mm units throughout.
- `printDocument(docId)` function:
  1. Fetch document + type from DB.
  2. Render full HTML into `#print-root` using the print template.
  3. Call `window.print()`.
  4. On `afterprint` event, clear `#print-root`.
- "Print selected" (batch): modal lists selected documents in order. User clicks "Print next" for each, which renders and prints one. Progress indicator: "3 of 7". Cancel button stops the queue.

## Windows 11 / Fluent Design

- **Colors:**
  - Light: bg `#F3F3F3`, surface `#FBFBFB`, Mica via `backdrop-filter: blur(60px) saturate(125%)` on semi-transparent white.
  - Dark: bg `#202020`, surface `#2B2B2B`.
  - Accent: `#0078D4` (light) / `#4CC2FF` (dark).
  - Defaults to system via `@media (prefers-color-scheme: dark)`, overridable in settings.
- **Typography:** `font-family: "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;`
  - Title 28/600, Subtitle 20/600, Body 14/400, Caption 12/400.
- **Corners:** 8px on cards/tiles/buttons, 4px on inputs, 50% on FAB.
- **Elevation 1:** `0 2px 4px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`.
- **Buttons:**
  - Accent: solid accent fill, white text, 1px darker border.
  - Standard: light gray fill, dark text, 1px border.
  - Subtle: transparent, dark text, hover light bg.
  - All buttons get a 1px inset light line at top for the Fluent reveal-style highlight.
- **Inputs:** 32px tall, 4px corners, 1px border, accent border + 2px outline glow on focus.
- **Animations:**
  - Page transitions: 200ms ease-out fade + 8px translateY.
  - FAB expansion: 250ms cubic-bezier(0.16, 1, 0.3, 1) staggered.
  - Hover states: 150ms ease.

## Storage Schema (IndexedDB)

Database: `brovis-pallet-app`, version 1.

- `documents` (keyPath `id`, indexes: `typeId`, `createdAt`, `paletaBroj`).
- `types` (keyPath `id`).
- `settings` (keyPath `key`, single-row pattern; keys: `producer`, `defaultRecipient`, `defaultPlace`, `passwordHash`, `passwordSalt`, `theme`, `lastExportDate`).

On first run: seed `types` with `SEED_TYPES`, seed `settings` with defaults from `BS_DEFAULTS`.

## Data Management

- **Export JSON:** download `brovis-backup-YYYY-MM-DD.json` with `{ version, exportedAt, types, documents, settings (passwordHash/Salt excluded) }`. Update `lastExportDate` in settings.
- **Import JSON:** validate version, prompt "Replace all" or "Merge by id (skip duplicates)".
- **Delete all data:** wipes all object stores, re-seeds defaults, returns to password setup. Requires typing "DELETE ALL".
- **Delete all of type:** wipes documents of that type. Requires typing the exact type title.
- **Delete single document:** standard confirmation modal.

## Non-Negotiables

1. Fully offline after first load. Service worker caches everything.
2. Installable as PWA on Windows 11 (Edge or Chrome). Once installed, runs in its own window.
3. All code, file names, variable names, UI chrome in English. Bosnian only in form labels, document content, and default values.
4. Printed output visually matches the originals: same field order, same Bosnian labels, same box layout, same footer format (`Visoko; DD.MM.YYYY.`).
5. No console errors. No broken states. Empty states everywhere.
6. Keyboard accessible: Tab navigation, Enter submits, Esc cancels modals.
7. Single user, password-gated. SHA-256 hash + random salt in IndexedDB.
8. Storage durability: `navigator.storage.persist()` called once on first run. Backup reminder banner if `lastExportDate` is over 7 days old.
9. All asset paths relative, never absolute (GitHub Pages subpath compatibility).
10. File names lowercase with hyphens, ASCII only (Linux case-sensitivity).

## Testing Checklist (must pass before considering done)

1. Open in Linux Chromium via `python3 -m http.server 8000`. Click through full flow: password setup, create one document of each type, edit one, delete one, print one, export JSON, import JSON, change a setting.
2. Verify service worker registers (DevTools → Application → Service Workers).
3. Verify install prompt appears, install the PWA, confirm it opens in its own window.
4. Verify offline mode: DevTools → Network → Offline → reload → app still works.
5. Verify all assets load with no 404s in DevTools Network tab.
6. Verify printed output visually matches the originals: pallet number prominent, Bosnian labels in correct order, footer format correct.
7. Verify storage usage display in Settings shows reasonable numbers.
8. Verify auto-calculations: change production date, confirm best-before shifts; change net weight, confirm gross weight updates.
9. Verify danger zones require typed confirmation.
10. Verify password reset wipes all data and returns to password setup.

## README.md Content

Include:
1. **What this is** — one-paragraph summary.
2. **For the developer (Linux):** "Serve over HTTP locally: `python3 -m http.server 8000`, then visit `http://localhost:8000` in Chromium or Edge. `file://` does not work for PWA features. Push to GitHub to deploy via Pages."
3. **For the end user (Windows):** "Visit [your-pages-url] in Microsoft Edge. Click the install icon in the address bar, or use the Install button in the app. The app will open in its own window and work offline after that."
4. **First-run setup:** Create your password. Open Settings to confirm producer/recipient defaults match.
5. **Backup:** Settings → Export all. Save the JSON file somewhere safe (USB stick, cloud drive). The IndexedDB lives in the browser profile and is wiped by "Clear browsing data" or browser reinstall. The exported JSON is the only durable record.
6. **Printing tips:** In the print dialog, disable "Headers and footers" and set margins to Default or None for best fidelity. Use "Save as PDF" as destination to generate a PDF file.
7. **Supported browsers:** Edge and Chrome on Windows 11. Firefox desktop lacks PWA install. Safari is untested.
8. **Resetting password:** On the password screen, click Reset. This wipes all data, so export a backup first.
9. **Updating the app:** Push changes to GitHub, bump `CACHE_NAME` in `service-worker.js`. The user's installed PWA shows an "Update available" banner on next launch.

## Stretch (only after the above works)

- Drag-to-reorder document types on the dashboard.
- Print preview modal before triggering print dialog.
- Window controls overlay (`display: "window-controls-overlay"` in manifest) for true app-window feel.
- Keyboard shortcuts: Ctrl+N for new document, Ctrl+F for search.
- Auto-backup option: write JSON backup to a chosen folder via File System Access API on each app launch.