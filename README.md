# Brovis - deklaracije paleta

A small Progressive Web App for generating and printing pallet declaration sheets for **Brovis DD Visoko** (poultry processor). Works fully offline once installed. Plain HTML/CSS/JavaScript — no build step, no runtime dependencies. Single-locale: the UI is in Bosnian throughout.

## For the developer (Linux)

Serve the folder over HTTP locally:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in Chromium or Edge. `file://` does not work for PWA features (service worker, install prompt, persistent storage).

Push to GitHub to deploy via GitHub Pages — the repo root contains the app files directly, no build step required. The site lives at `https://<user>.github.io/<repo>/`.

## For the end user (Windows)

1. Open `<your-pages-url>` in **Microsoft Edge** (or Chrome).
2. Click the install icon in the address bar, or use the **Instaliraj** button in the top-right of the app.
3. The app opens in its own window and works offline from then on.

## First-run setup

Open **Postavke** to confirm the producer name, address, vet. control number, default recipient, and default place. These pre-fill every new document.

## Backup

The app stores everything in IndexedDB inside the browser profile. **"Clear browsing data" or a browser reinstall will wipe it.** The exported JSON is the only durable record.

- **Postavke → Upravljanje podacima → Izvezi sve** downloads `brovis-backup-YYYY-MM-DD.json`. Save it to a USB stick or cloud drive.
- A reminder banner appears on the dashboard if it has been more than 7 days since the last export.
- **Uvezi** offers two modes: "Spoji po ID-u" (skip duplicates) or "Zamijeni sve" (wipe first).

## Printing tips

- In the print dialog: disable **Headers and footers**, set **Margins** to **Default** or **None** for best fidelity.
- Use **Save as PDF** as the destination to generate a PDF file instead of printing.
- Batch printing: select multiple documents in the type list, click **Štampaj odabrane**, and confirm **Štampaj sljedeći** for each. Browsers don't allow programmatic queueing of print dialogs.

## Supported browsers

- **Edge** and **Chrome** on Windows 11 (recommended).
- **Firefox** desktop lacks PWA install — runs in a tab only.
- **Safari** is untested.

## Updating the app

1. Edit files locally.
2. Bump `CACHE_NAME` in `service-worker.js` (e.g. `"brovis-v2"` → `"brovis-v3"`).
3. Push to GitHub.

Installed clients will see a **"Dostupno je ažuriranje"** banner on next launch — click **Učitaj ponovo** to apply.

## Icons

UI icons are provided by [BoxIcons](https://boxicons.com) vendored locally under `vendor/boxicons/`. The service worker precaches the CSS + WOFF/WOFF2/TTF font files so icons render offline.
