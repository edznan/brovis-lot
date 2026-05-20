// ============================================================
//  Brovis - deklaracije paleta — router + screen controllers.
//  Single-locale Bosnian UI. All visible strings via UI_LABELS.
// ============================================================

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof el[k] !== "function") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
  return el;
}

const bxi = (name) => h("i", { class: `bx ${name}` });

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateShort(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// ---------- modal ----------
function showModal({ title, body, actions, allowEsc = true }) {
  return new Promise((resolve) => {
    const root = $("#modal-root");
    const backdrop = h("div", { class: "modal-backdrop" });
    const modal = h("div", { class: "modal" });
    if (title) modal.appendChild(h("div", { class: "modal-title" }, title));
    const bodyEl = h("div", { class: "modal-body" });
    if (typeof body === "string") bodyEl.innerHTML = body;
    else if (body instanceof Node) bodyEl.appendChild(body);
    modal.appendChild(bodyEl);
    const actionsEl = h("div", { class: "modal-actions" });
    (actions || []).forEach(a => {
      const b = h("button", { class: `btn ${a.variant || "btn-standard"}` }, a.label);
      b.addEventListener("click", () => { close(a.value); });
      if (a.autofocus) setTimeout(() => b.focus(), 0);
      actionsEl.appendChild(b);
    });
    modal.appendChild(actionsEl);
    backdrop.appendChild(modal);
    root.appendChild(backdrop);

    function close(v) {
      backdrop.remove();
      window.removeEventListener("keydown", onKey);
      resolve(v);
    }
    function onKey(e) { if (e.key === "Escape" && allowEsc) close(undefined); }
    window.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop && allowEsc) close(undefined); });
  });
}

function confirmModal({ title, message, confirmLabel, danger = false }) {
  return showModal({
    title,
    body: h("div", {}, message),
    actions: [
      { label: UI_LABELS.cancel, variant: "btn-subtle", value: false },
      { label: confirmLabel || UI_LABELS.confirm, variant: danger ? "btn-danger" : "btn-accent", value: true, autofocus: true }
    ]
  }).then(v => !!v);
}

// ---------- toasts ----------
function showToast({ message, variant = "info", duration = 3000, html: htmlBody }) {
  const host = $("#toast-host");
  const toast = h("div", { class: `toast toast-${variant}` });
  if (htmlBody) toast.innerHTML = htmlBody;
  else toast.textContent = message;
  const close = h("button", { class: "toast-close", "aria-label": UI_LABELS.close,
    onclick: () => dismiss() }, bxi("bx-x"));
  toast.appendChild(close);
  host.appendChild(toast);
  let timer = duration ? setTimeout(dismiss, duration) : null;
  function dismiss() {
    if (timer) clearTimeout(timer);
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 200);
  }
  return dismiss;
}

function toastSuccess(message) { return showToast({ message, variant: "success", duration: 2500 }); }
function toastError(message) { return showToast({ message, variant: "error", duration: 6000 }); }

function showErrorToast(messages, invalidEls, formEl) {
  // Clear previous highlights
  if (formEl) $$(".is-invalid", formEl).forEach(el => el.classList.remove("is-invalid"));
  // Highlight new invalid elements
  (invalidEls || []).forEach(el => el && el.classList.add("is-invalid"));
  const ul = messages.map(m => `<li>${escapeHTML(m)}</li>`).join("");
  showToast({
    variant: "error",
    duration: 6000,
    html: `<div class="toast-icon"><i class="bx bx-error-circle"></i></div>
           <div class="toast-body"><div class="toast-title">${escapeHTML(UI_LABELS.errFormHeader)}</div><ul>${ul}</ul></div>`
  });
  // Focus + scroll the first invalid into view
  const first = (invalidEls || []).find(Boolean);
  if (first) {
    first.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => first.focus(), 250);
  }
}

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

// ---------- state ----------
const state = {
  installPromptEvent: null,
  swRegistration: null
};

// ---------- splash + bootstrap ----------
async function bootstrap() {
  const splash = $("#splash");
  const app = $("#app");

  if (sessionStorage.getItem("splashShown") !== "1") {
    splash.hidden = false;
    await new Promise(r => setTimeout(r, 1200));
    sessionStorage.setItem("splashShown", "1");
    splash.hidden = true;
  }

  await DB.seedIfEmpty();
  if (navigator.storage && navigator.storage.persist) {
    try { await navigator.storage.persist(); } catch {}
  }

  app.hidden = false;
  await startApp();
}

// ---------- app startup ----------
async function startApp() {
  await applyStoredTheme();
  registerTopbarActions();
  registerImportHandler();
  registerInstallPrompt();
  registerServiceWorker();

  window.addEventListener("hashchange", route);
  if (!location.hash) location.hash = "#/dashboard";
  else route();
}

async function applyStoredTheme() {
  const theme = await DB.getSetting("theme");
  if (theme && theme !== "auto") document.documentElement.dataset.theme = theme;
  else document.documentElement.removeAttribute("data-theme");
}

function registerTopbarActions() {
  $("#nav-back").onclick = () => history.back();
  $("#btn-settings").onclick = () => (location.hash = "#/settings");
  $("#btn-types").onclick = () => (location.hash = "#/types");
  $("#btn-install").onclick = async () => {
    if (!state.installPromptEvent) return;
    state.installPromptEvent.prompt();
    const { outcome } = await state.installPromptEvent.userChoice;
    if (outcome === "accepted") $("#btn-install").hidden = true;
    state.installPromptEvent = null;
  };
}

function registerImportHandler() {
  $("#import-file").onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let parsed;
    try { parsed = JSON.parse(await file.text()); }
    catch {
      return showModal({ title: UI_LABELS.importFailedTitle, body: UI_LABELS.importFailedJson, actions: [{ label: UI_LABELS.ok, variant: "btn-accent", value: true }] });
    }
    if (!parsed || !parsed.version || !Array.isArray(parsed.documents)) {
      return showModal({ title: UI_LABELS.importFailedTitle, body: UI_LABELS.importFailedShape, actions: [{ label: UI_LABELS.ok, variant: "btn-accent", value: true }] });
    }
    const mode = await showModal({
      title: UI_LABELS.modalImportTitle,
      body: UI_LABELS.modalImportBody(parsed.documents.length, (parsed.types || []).length),
      actions: [
        { label: UI_LABELS.cancel, variant: "btn-subtle", value: undefined },
        { label: UI_LABELS.importMerge, variant: "btn-standard", value: "merge" },
        { label: UI_LABELS.importReplace, variant: "btn-danger", value: "replace" }
      ]
    });
    if (!mode) return;
    if (mode === "replace") {
      for (const d of await DB.getAllDocuments()) await DB.deleteDocument(d.id);
      for (const t of await DB.getAllTypes()) await DB.deleteType(t.id);
    }
    for (const t of (parsed.types || [])) await DB.putType(t);
    for (const d of parsed.documents) {
      if (mode === "merge") {
        const existing = await DB.getDocument(d.id);
        if (existing) continue;
      }
      await DB.putDocument(d);
    }
    if (parsed.settings) {
      for (const [k, v] of Object.entries(parsed.settings)) {
        await DB.setSetting(k, v);
      }
    }
    showModal({ title: UI_LABELS.importDone, body: UI_LABELS.importDoneBody, actions: [{ label: UI_LABELS.ok, variant: "btn-accent", value: true }] });
    route();
  };
}

function registerInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.installPromptEvent = e;
    if (!window.matchMedia("(display-mode: standalone)").matches) {
      $("#btn-install").hidden = false;
    }
  });
  if (window.matchMedia("(display-mode: standalone)").matches) {
    $("#btn-install").hidden = true;
  }
  window.addEventListener("appinstalled", () => {
    $("#btn-install").hidden = true;
    state.installPromptEvent = null;
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./service-worker.js").then((reg) => {
    state.swRegistration = reg;
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateBanner();
        }
      });
    });
  }).catch(() => {});

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

function showUpdateBanner() {
  const slot = $("#infobar-slot");
  if ($("#update-bar")) return;
  const bar = h("div", { id: "update-bar", class: "infobar" },
    h("div", { class: "infobar-body" }, UI_LABELS.bannerUpdateAvailable),
    h("button", { class: "btn btn-accent",
      onclick: () => {
        const w = state.swRegistration && state.swRegistration.waiting;
        if (w) w.postMessage({ type: "SKIP_WAITING" });
        else window.location.reload();
      }
    }, UI_LABELS.bannerReload)
  );
  slot.appendChild(bar);
}

// ---------- router ----------
async function route() {
  const hash = location.hash || "#/dashboard";
  const parts = hash.replace(/^#\//, "").split("/");
  const root = $("#route-root");
  removeFAB();
  removeBackupBanner();
  $("#nav-back").hidden = parts[0] === "dashboard";

  try {
    if (parts[0] === "dashboard") return renderDashboard(root);
    if (parts[0] === "type" && parts[1]) return renderTypeDetail(root, parts[1]);
    if (parts[0] === "new" && parts[1]) return renderDocumentForm(root, { typeId: parts[1] });
    if (parts[0] === "edit" && parts[1]) return renderDocumentForm(root, { docId: parts[1] });
    if (parts[0] === "settings") return renderSettings(root);
    if (parts[0] === "types") return renderTypes(root);
    location.hash = "#/dashboard";
  } catch (err) {
    console.error(err);
    root.innerHTML = "";
    root.appendChild(h("div", { class: "empty-state" }, "Greška. Učitajte ponovo."));
  }
}

function setAppTitle(text) { $("#app-title").textContent = text; }

// ============================================================
//  DASHBOARD
// ============================================================
async function renderDashboard(root) {
  setAppTitle(UI_LABELS.dashboard);
  root.innerHTML = "";

  await maybeShowBackupReminder();

  const types = await DB.getAllTypes();
  const docs = await DB.getAllDocuments();
  const byType = new Map();
  for (const d of docs) {
    const arr = byType.get(d.typeId) || [];
    arr.push(d);
    byType.set(d.typeId, arr);
  }

  root.appendChild(h("div", { class: "page-title" }, UI_LABELS.dashboard));
  root.appendChild(h("div", { class: "page-subtitle" }, UI_LABELS.docsAcross(docs.length, types.length)));

  if (types.length === 0) {
    root.appendChild(h("div", { class: "empty-state" }, UI_LABELS.emptyNoTypes,
      h("a", { href: "#/types" }, UI_LABELS.createOne)));
    return;
  }

  const grid = h("div", { class: "tile-grid" });
  for (const t of types) {
    const ofType = byType.get(t.id) || [];
    const last = ofType.length
      ? ofType.reduce((a, b) => a.createdAt > b.createdAt ? a : b)
      : null;
    const tile = h("div", { class: "tile", tabIndex: "0",
      onclick: () => (location.hash = `#/type/${t.id}`),
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); location.hash = `#/type/${t.id}`; } }
    });
    tile.addEventListener("mousemove", (e) => {
      const r = tile.getBoundingClientRect();
      tile.style.setProperty("--reveal-x", `${e.clientX - r.left}px`);
      tile.style.setProperty("--reveal-y", `${e.clientY - r.top}px`);
    });
    tile.appendChild(h("div", { class: "tile-head" },
      h("span", { class: "tile-badge" }, String(ofType.length))
    ));
    tile.appendChild(h("div", { class: "tile-title" }, t.title.replace(/\s+/g, " ")));
    tile.appendChild(h("div", { class: "tile-meta" },
      last ? formatDateShort(last.createdAt.slice(0, 10)) : "—"));
    grid.appendChild(tile);
  }
  root.appendChild(grid);

  buildFAB(types);
}

async function maybeShowBackupReminder() {
  const lastExportDate = await DB.getSetting("lastExportDate");
  if (!lastExportDate) return;
  const days = Math.floor((Date.now() - new Date(lastExportDate).getTime()) / 86400000);
  if (days < 7) return;
  const slot = $("#infobar-slot");
  if ($("#backup-bar")) return;
  const bar = h("div", { id: "backup-bar", class: "infobar warning" },
    h("div", { class: "infobar-body" }, UI_LABELS.bannerBackupReminder(days)),
    h("button", { class: "btn btn-accent", onclick: () => exportBackup() }, UI_LABELS.bannerExportNow)
  );
  slot.appendChild(bar);
}

function removeBackupBanner() {
  const b = $("#backup-bar");
  if (b) b.remove();
}

// ---------- FAB ----------
function removeFAB() {
  const f = $("#fab-host");
  if (f) f.remove();
}

function buildFAB(types) {
  removeFAB();
  if (!types || types.length === 0) return;
  const host = h("div", { id: "fab-host", class: "fab-host" });
  const close = () => { host.classList.remove("open"); fab.classList.remove("open"); };
  const onDocClick = (e) => { if (!host.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };

  types.slice().reverse().forEach((t, i) => {
    const row = h("div", { class: "mini-fab-row", "data-stagger": String(i) },
      h("button", { class: "mini-fab-label", "aria-label": `${UI_LABELS.newDocument}: ${t.title}`,
        onclick: (e) => { e.stopPropagation(); close(); location.hash = `#/new/${t.id}`; }
      }, t.title.replace(/\s+/g, " ").slice(0, 60))
    );
    host.appendChild(row);
  });
  const fab = h("button", { class: "fab", "aria-label": UI_LABELS.newDocument,
    onclick: (e) => {
      e.stopPropagation();
      const open = host.classList.toggle("open");
      fab.classList.toggle("open", open);
      if (open) {
        document.addEventListener("click", onDocClick);
        document.addEventListener("keydown", onKey);
      } else {
        document.removeEventListener("click", onDocClick);
        document.removeEventListener("keydown", onKey);
      }
    }
  }, bxi("bx-plus"));
  host.appendChild(fab);
  document.body.appendChild(host);
}

// ============================================================
//  TYPE DETAIL (document list)
// ============================================================
async function renderTypeDetail(root, typeId) {
  const type = await DB.getType(typeId);
  if (!type) { location.hash = "#/dashboard"; return; }
  setAppTitle(type.title.split("\n")[0]);
  root.innerHTML = "";

  const allDocs = await DB.getDocumentsByType(typeId);
  const filter = { q: "", from: "", to: "", sort: "createdAt-desc" };
  const selection = new Set();

  root.appendChild(h("div", {},
    h("div", { class: "page-title" }, type.title.split("\n")[0]),
    h("div", { class: "page-subtitle" }, UI_LABELS.docsCount(allDocs.length))
  ));

  const toolbar = h("div", { class: "toolbar" });
  toolbar.appendChild(h("div", { class: "field search" },
    h("label", {}, UI_LABELS.search),
    h("input", { type: "search", placeholder: UI_LABELS.searchPlaceholder,
      oninput: (e) => { filter.q = e.target.value.toLowerCase(); refresh(); } })
  ));
  toolbar.appendChild(h("div", { class: "field" },
    h("label", {}, UI_LABELS.productionFrom),
    h("input", { type: "date", onchange: (e) => { filter.from = e.target.value; refresh(); } })
  ));
  toolbar.appendChild(h("div", { class: "field" },
    h("label", {}, UI_LABELS.productionTo),
    h("input", { type: "date", onchange: (e) => { filter.to = e.target.value; refresh(); } })
  ));
  const sortEl = h("select", { onchange: (e) => { filter.sort = e.target.value; refresh(); } });
  [
    ["createdAt-desc", UI_LABELS.sortNewest],
    ["createdAt-asc", UI_LABELS.sortOldest],
    ["productionDate-desc", UI_LABELS.sortProdDesc],
    ["productionDate-asc", UI_LABELS.sortProdAsc],
    ["paletaBroj-asc", UI_LABELS.sortPaletaAsc],
    ["paletaBroj-desc", UI_LABELS.sortPaletaDesc]
  ].forEach(([v, l]) => sortEl.appendChild(h("option", { value: v }, l)));
  toolbar.appendChild(h("div", { class: "field" }, h("label", {}, UI_LABELS.sort), sortEl));
  root.appendChild(toolbar);

  const bulkSlot = h("div");
  root.appendChild(bulkSlot);
  const listSlot = h("div");
  root.appendChild(listSlot);

  function applyFilter(docs) {
    let out = docs.slice();
    if (filter.q) {
      out = out.filter(d => [d.paletaBroj, d.vetMarkNumber, d.originOfBreeding]
        .some(f => String(f || "").toLowerCase().includes(filter.q)));
    }
    if (filter.from) out = out.filter(d => d.productionDate >= filter.from);
    if (filter.to) out = out.filter(d => d.productionDate <= filter.to);
    const [field, dir] = filter.sort.split("-");
    const mult = dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const av = a[field] || "", bv = b[field] || "";
      if (field === "paletaBroj") {
        const an = parseInt(av, 10), bn = parseInt(bv, 10);
        if (!isNaN(an) && !isNaN(bn)) return (an - bn) * mult;
      }
      return (av > bv ? 1 : av < bv ? -1 : 0) * mult;
    });
    return out;
  }

  function refresh() {
    const filtered = applyFilter(allDocs);
    listSlot.innerHTML = "";
    bulkSlot.innerHTML = "";

    if (selection.size > 0) {
      const bar = h("div", { class: "bulk-bar" },
        h("span", { class: "count" }, UI_LABELS.selectedCount(selection.size)),
        h("div", { class: "spacer" }),
        h("button", { class: "btn btn-standard", onclick: () => startBatchPrint([...selection]) }, UI_LABELS.printSelected),
        h("button", { class: "btn btn-danger", onclick: async () => {
          const ok = await confirmModal({ title: UI_LABELS.modalDeleteSelTitle, message: UI_LABELS.modalDeleteSelBody(selection.size), confirmLabel: UI_LABELS.delete, danger: true });
          if (!ok) return;
          for (const id of selection) await DB.deleteDocument(id);
          selection.clear();
          route();
        }}, UI_LABELS.deleteSelected)
      );
      bulkSlot.appendChild(bar);
    }

    if (filtered.length === 0) {
      listSlot.appendChild(h("div", { class: "empty-state" },
        allDocs.length === 0 ? UI_LABELS.emptyNoDocs : UI_LABELS.emptyNoMatch));
    } else {
      const wrap = h("div", { class: "table-wrap" });
      const table = h("table", { class: "data-table" });
      const allChecked = filtered.every(d => selection.has(d.id));
      table.appendChild(h("thead", {},
        h("tr", {},
          h("th", { style: "width:32px;" },
            h("input", { type: "checkbox", checked: allChecked,
              onchange: (e) => { filtered.forEach(d => e.target.checked ? selection.add(d.id) : selection.delete(d.id)); refresh(); }
            })),
          h("th", {}, UI_LABELS.thPallet),
          h("th", {}, UI_LABELS.thVet),
          h("th", {}, UI_LABELS.thProduction),
          h("th", {}, UI_LABELS.thNet),
          h("th", { class: "actions" }, UI_LABELS.thActions)
        )
      ));
      const tbody = h("tbody");
      filtered.forEach(d => {
        tbody.appendChild(h("tr", {},
          h("td", {},
            h("input", { type: "checkbox", checked: selection.has(d.id),
              onchange: (e) => { e.target.checked ? selection.add(d.id) : selection.delete(d.id); refresh(); }
            })
          ),
          h("td", {}, d.paletaBroj || "—"),
          h("td", {}, d.vetMarkNumber || "—"),
          h("td", {}, formatDateShort(d.productionDate)),
          h("td", {}, d.netWeight != null ? String(d.netWeight) : "—"),
          h("td", { class: "actions" },
            h("button", { class: "btn btn-subtle icon-only", title: UI_LABELS.edit, onclick: () => (location.hash = `#/edit/${d.id}`) }, bxi("bx-edit")),
            h("button", { class: "btn btn-subtle icon-only", title: UI_LABELS.print, onclick: () => printDocument(d.id) }, bxi("bx-printer")),
            h("button", { class: "btn btn-subtle icon-only", title: UI_LABELS.delete, style: "color:var(--danger);",
              onclick: async () => {
                const ok = await confirmModal({ title: UI_LABELS.modalDeleteDocTitle, message: UI_LABELS.modalDeleteDocBody(d.paletaBroj), confirmLabel: UI_LABELS.delete, danger: true });
                if (!ok) return;
                await DB.deleteDocument(d.id);
                route();
              }
            }, bxi("bx-trash"))
          )
        ));
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      listSlot.appendChild(wrap);
    }

    // Danger zone
    if (allDocs.length > 0) {
      const danger = h("div", { class: "danger-zone" },
        h("div", { class: "card-title" }, UI_LABELS.modalDeleteAllOfTypeTitle),
        h("button", { class: "btn btn-danger", onclick: async () => {
          const ok = await confirmModal({
            title: UI_LABELS.modalDeleteAllOfTypeTitle,
            message: UI_LABELS.modalDeleteAllOfTypeBody(type.title.split("\n")[0], allDocs.length),
            confirmLabel: UI_LABELS.delete,
            danger: true
          });
          if (!ok) return;
          await DB.deleteDocumentsByType(type.id);
          location.hash = "#/dashboard";
        }}, UI_LABELS.modalDeleteAllOfTypeTitle)
      );
      listSlot.appendChild(danger);
    }
  }

  refresh();

  // FAB for this type
  const host = h("div", { id: "fab-host", class: "fab-host" });
  const fab = h("button", { class: "fab", "aria-label": UI_LABELS.newDocument,
    onclick: () => (location.hash = `#/new/${type.id}`)
  }, bxi("bx-plus"));
  host.appendChild(fab);
  document.body.appendChild(host);
}

// ============================================================
//  NEW / EDIT DOCUMENT
// ============================================================
async function renderDocumentForm(root, { typeId, docId }) {
  root.innerHTML = "";
  let existing = null;
  if (docId) {
    existing = await DB.getDocument(docId);
    if (!existing) { location.hash = "#/dashboard"; return; }
    typeId = existing.typeId;
  }
  const type = await DB.getType(typeId);
  if (!type) { location.hash = "#/dashboard"; return; }

  const settings = await DB.getAllSettings();
  const producerDefault = settings.producer || { name: BS_DEFAULTS.producerName, address: BS_DEFAULTS.producerAddress, vetControlNumber: BS_DEFAULTS.producerVetControl };
  const recipientDefault = settings.defaultRecipient ?? BS_DEFAULTS.recipient;
  const placeDefault = settings.defaultPlace ?? BS_DEFAULTS.place;

  setAppTitle(existing ? UI_LABELS.editDocument : UI_LABELS.newDocument);

  const data = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: uuid(),
    typeId: type.id,
    paletaBroj: await suggestPaletaBroj(type.id),
    producer: { ...producerDefault },
    recipient: recipientDefault,
    vetMarkNumber: "",
    originOfBreeding: "",
    productionDate: todayISO(),
    bestBeforeDate: addDaysISO(todayISO(), type.shelfLifeDays),
    bestBeforeManual: false,
    temperature: type.defaultTemperature,
    totalBlocks: "",
    netWeight: "",
    palletWeight: "",
    grossWeight: "",
    grossWeightManual: false,
    footer: { place: placeDefault, date: todayISO() },
    chemicalAnalysis: type.requiresChemicalAnalysis ? { fat: "", protein: "", moisture: "" } : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existing) {
    const calc = addDaysISO(existing.productionDate, type.shelfLifeDays);
    data.bestBeforeManual = existing.bestBeforeDate !== calc;
    const calcGross = (Number(existing.netWeight) || 0) + (Number(existing.palletWeight) || 0);
    data.grossWeightManual = Number(existing.grossWeight) !== calcGross;
  }

  let dirty = false;
  const setDirty = () => { dirty = true; };

  // Refs to inputs that may be flagged invalid
  const refs = {};

  const form = h("form", { onsubmit: (e) => e.preventDefault() });

  root.appendChild(h("div", { class: "page-title" }, existing ? UI_LABELS.editDocument : UI_LABELS.newDocument));
  root.appendChild(h("div", { class: "page-subtitle" }, type.title.replace(/\s+/g, " ")));
  root.appendChild(form);

  // ---- Pallet ----
  refs.paletaBroj = inputBound("text", data, "paletaBroj", setDirty);
  form.appendChild(card(UI_LABELS.sectionPallet,
    field(UI_LABELS.fieldPaletaBroj, refs.paletaBroj, UI_LABELS.hintPaletaBroj)
  ));

  // ---- Producer (always expanded) ----
  const producerCard = card(UI_LABELS.sectionProducer);
  producerCard.appendChild(twoCol(
    field(UI_LABELS.fieldProducerName, inputBound("text", data.producer, "name", setDirty)),
    field(UI_LABELS.fieldVetControl, inputBound("text", data.producer, "vetControlNumber", setDirty))
  ));
  producerCard.appendChild(field(UI_LABELS.fieldProducerAddress, inputBound("text", data.producer, "address", setDirty)));
  form.appendChild(producerCard);

  // ---- Product ----
  const product = card(UI_LABELS.sectionProduct);
  product.appendChild(h("div", { class: "field" },
    h("label", {}, UI_LABELS.fieldType),
    h("input", { type: "text", value: type.title.replace(/\s+/g, " "), disabled: true })
  ));
  refs.recipient = inputBound("text", data, "recipient", setDirty);
  product.appendChild(field(UI_LABELS.fieldRecipient, refs.recipient));
  refs.vetMarkNumber = inputBound("text", data, "vetMarkNumber", setDirty);
  refs.originOfBreeding = inputBound("text", data, "originOfBreeding", setDirty);
  product.appendChild(twoCol(
    field(UI_LABELS.fieldVetMark, refs.vetMarkNumber),
    field(UI_LABELS.fieldOrigin, refs.originOfBreeding)
  ));
  form.appendChild(product);

  // ---- Dates ----
  const datesCard = card(UI_LABELS.sectionDates);
  refs.productionDate = inputBound("date", data, "productionDate", () => {
    setDirty();
    if (!data.bestBeforeManual) {
      data.bestBeforeDate = addDaysISO(data.productionDate, type.shelfLifeDays);
      refs.bestBeforeDate.value = data.bestBeforeDate;
    }
  });
  datesCard.appendChild(field(UI_LABELS.fieldProductionDate, refs.productionDate));
  refs.bestBeforeDate = inputBound("date", data, "bestBeforeDate", setDirty);
  const bestRow = h("div", { class: "field" },
    h("label", {}, UI_LABELS.fieldBestBefore),
    refs.bestBeforeDate,
    h("label", { class: "checkbox-row", style: "margin-top:6px;" },
      h("input", { type: "checkbox", checked: data.bestBeforeManual,
        onchange: (e) => {
          data.bestBeforeManual = e.target.checked;
          refs.bestBeforeDate.disabled = !data.bestBeforeManual;
          if (!data.bestBeforeManual) {
            data.bestBeforeDate = addDaysISO(data.productionDate, type.shelfLifeDays);
            refs.bestBeforeDate.value = data.bestBeforeDate;
          }
          setDirty();
        }
      }),
      h("span", {}, UI_LABELS.manualOverride)
    )
  );
  refs.bestBeforeDate.disabled = !data.bestBeforeManual;
  datesCard.appendChild(bestRow);
  form.appendChild(datesCard);

  // ---- Storage ----
  const storage = card(UI_LABELS.sectionStorage);
  refs.temperature = inputBound("text", data, "temperature", setDirty);
  storage.appendChild(field(UI_LABELS.fieldTemperature, refs.temperature));
  refs.totalBlocks = inputBound("number", data, "totalBlocks", setDirty);
  refs.netWeight = inputBound("number", data, "netWeight", () => { setDirty(); recalcGross(); });
  storage.appendChild(twoCol(
    field(UI_LABELS.fieldTotalBlocks, refs.totalBlocks),
    field(UI_LABELS.fieldNetWeight, refs.netWeight)
  ));
  refs.palletWeight = inputBound("number", data, "palletWeight", () => { setDirty(); recalcGross(); });
  refs.grossWeight = inputBound("number", data, "grossWeight", setDirty);
  function recalcGross() {
    if (data.grossWeightManual) return;
    const n = Number(data.netWeight) || 0;
    const p = Number(data.palletWeight) || 0;
    data.grossWeight = +(n + p).toFixed(3);
    refs.grossWeight.value = data.grossWeight;
  }
  const grossWrap = h("div", { class: "field" },
    h("label", {}, UI_LABELS.fieldGrossWeight),
    refs.grossWeight,
    h("label", { class: "checkbox-row", style: "margin-top:6px;" },
      h("input", { type: "checkbox", checked: data.grossWeightManual,
        onchange: (e) => { data.grossWeightManual = e.target.checked; refs.grossWeight.disabled = !data.grossWeightManual; recalcGross(); setDirty(); }
      }),
      h("span", {}, UI_LABELS.manualOverride)
    )
  );
  refs.grossWeight.disabled = !data.grossWeightManual;
  const palletLabel = type.weightLabel === "palete-kaveza" ? UI_LABELS.fieldPalletCageWeight : UI_LABELS.fieldPalletWeight;
  storage.appendChild(twoCol(
    field(palletLabel, refs.palletWeight),
    grossWrap
  ));
  recalcGross();
  form.appendChild(storage);

  // ---- Chemical analysis ----
  if (type.requiresChemicalAnalysis) {
    if (!data.chemicalAnalysis) data.chemicalAnalysis = { fat: "", protein: "", moisture: "" };
    const chem = card(UI_LABELS.sectionChemical);
    refs.fat = inputBound("number", data.chemicalAnalysis, "fat", setDirty);
    refs.protein = inputBound("number", data.chemicalAnalysis, "protein", setDirty);
    refs.moisture = inputBound("number", data.chemicalAnalysis, "moisture", setDirty);
    chem.appendChild(h("div", { class: "field-row three" },
      field(UI_LABELS.fieldFat, refs.fat),
      field(UI_LABELS.fieldProtein, refs.protein),
      field(UI_LABELS.fieldMoisture, refs.moisture)
    ));
    form.appendChild(chem);
  }

  // ---- Footer ----
  const footer = card(UI_LABELS.sectionFooter);
  footer.appendChild(twoCol(
    field(UI_LABELS.fieldPlace, inputBound("text", data.footer, "place", setDirty)),
    field(UI_LABELS.fieldDate, inputBound("date", data.footer, "date", setDirty))
  ));
  form.appendChild(footer);

  // ---- Action bar ----
  const actionBar = h("div", { class: "form-actionbar" });
  actionBar.appendChild(h("button", { type: "button", class: "btn btn-subtle",
    onclick: async () => {
      if (dirty) {
        const ok = await confirmModal({ title: UI_LABELS.modalDiscardTitle, message: UI_LABELS.modalDiscardBody, confirmLabel: UI_LABELS.modalDiscard, danger: true });
        if (!ok) return;
      }
      dirty = false;
      location.hash = `#/type/${type.id}`;
    }
  }, UI_LABELS.cancel));
  actionBar.appendChild(h("button", { type: "button", class: "btn btn-standard",
    onclick: () => save({ thenPrint: false })
  }, UI_LABELS.save));
  actionBar.appendChild(h("button", { type: "button", class: "btn btn-accent",
    onclick: () => save({ thenPrint: true })
  }, UI_LABELS.saveAndPrint));
  form.appendChild(actionBar);

  async function save({ thenPrint }) {
    const { messages, invalidEls } = validate();
    if (messages.length) {
      showErrorToast(messages, invalidEls, form);
      return;
    }
    $$(".is-invalid", form).forEach(el => el.classList.remove("is-invalid"));
    const clean = stripRuntimeFields(data);
    clean.updatedAt = new Date().toISOString();
    await DB.putDocument(clean);
    dirty = false;
    if (thenPrint) await printDocument(clean.id);
    location.hash = `#/type/${type.id}`;
  }

  function validate() {
    const messages = [];
    const invalidEls = [];
    const fail = (el, msg) => { invalidEls.push(el); messages.push(msg); };
    if (!data.paletaBroj) fail(refs.paletaBroj, UI_LABELS.errPaletaBroj);
    if (!data.vetMarkNumber) fail(refs.vetMarkNumber, UI_LABELS.errVetMark);
    if (!data.productionDate) fail(refs.productionDate, UI_LABELS.errProductionDate);
    if (!data.bestBeforeDate) fail(refs.bestBeforeDate, UI_LABELS.errBestBefore);
    if (!data.temperature) fail(refs.temperature, UI_LABELS.errTemperature);
    if (data.totalBlocks === "" || data.totalBlocks == null) fail(refs.totalBlocks, UI_LABELS.errTotalBlocks);
    if (data.netWeight === "" || data.netWeight == null) fail(refs.netWeight, UI_LABELS.errNetWeight);
    if (data.palletWeight === "" || data.palletWeight == null) fail(refs.palletWeight, UI_LABELS.errPalletWeight);
    return { messages, invalidEls };
  }

  window.addEventListener("beforeunload", beforeUnload);
  function beforeUnload(e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } }
  window.addEventListener("hashchange", () => window.removeEventListener("beforeunload", beforeUnload), { once: true });
}

function stripRuntimeFields(d) {
  const c = JSON.parse(JSON.stringify(d));
  const numFields = ["totalBlocks", "netWeight", "palletWeight", "grossWeight"];
  numFields.forEach(k => { if (c[k] !== "" && c[k] != null) c[k] = Number(c[k]); });
  if (c.chemicalAnalysis) {
    ["fat", "protein", "moisture"].forEach(k => {
      if (c.chemicalAnalysis[k] !== "" && c.chemicalAnalysis[k] != null) c.chemicalAnalysis[k] = Number(c.chemicalAnalysis[k]);
    });
  }
  return c;
}

async function suggestPaletaBroj(typeId) {
  const docs = await DB.getDocumentsByType(typeId);
  if (docs.length === 0) return "01";
  let lastNum = 0;
  let lastWidth = 2;
  for (const d of docs) {
    const s = String(d.paletaBroj || "").trim();
    const n = parseInt(s, 10);
    if (!isNaN(n) && n >= lastNum) {
      lastNum = n;
      lastWidth = s.length;
    }
  }
  const next = lastNum + 1;
  const out = String(next);
  return out.length < lastWidth ? out.padStart(lastWidth, "0") : out;
}

// ---- form atoms ----
function card(title, ...children) {
  const c = h("div", { class: "card card-section" });
  if (title) c.appendChild(h("div", { class: "card-title" }, title));
  children.forEach(ch => c.appendChild(ch));
  return c;
}
function field(label, control, hint) {
  const f = h("div", { class: "field" });
  if (label) f.appendChild(h("label", {}, label));
  f.appendChild(control);
  if (hint) f.appendChild(h("div", { class: "hint" }, hint));
  return f;
}
function twoCol(a, b) { return h("div", { class: "field-row" }, a, b); }
function inputBound(type, obj, key, onChange) {
  const initial = obj[key];
  const attrs = { type, value: initial == null ? "" : String(initial) };
  if (type === "number") attrs.step = "0.001";
  const el = h("input", attrs);
  el.addEventListener("input", () => {
    obj[key] = el.value;
    if (el.classList.contains("is-invalid")) el.classList.remove("is-invalid");
    onChange && onChange();
  });
  return el;
}
function collapsible(title, startCollapsed) {
  const root = h("div", { class: `card card-section collapsible ${startCollapsed ? "collapsed" : ""}` });
  const head = h("div", { class: "section-head" },
    h("span", {}, title),
    h("i", { class: "bx bx-chevron-right chev" })
  );
  const body = h("div", { class: "section-body" });
  head.addEventListener("click", () => root.classList.toggle("collapsed"));
  root.appendChild(head);
  root.appendChild(body);
  return { root, body };
}

// ============================================================
//  SETTINGS
// ============================================================
async function renderSettings(root) {
  setAppTitle(UI_LABELS.settings);
  root.innerHTML = "";
  const settings = await DB.getAllSettings();
  const producer = settings.producer || { name: BS_DEFAULTS.producerName, address: BS_DEFAULTS.producerAddress, vetControlNumber: BS_DEFAULTS.producerVetControl };

  root.appendChild(h("div", { class: "page-title" }, UI_LABELS.settings));

  const grid = h("div", { class: "settings-grid" });

  // ---- Producer defaults ----
  const p = card(UI_LABELS.producerDefaults);
  const pName = h("input", { type: "text", value: producer.name });
  const pAddr = h("input", { type: "text", value: producer.address });
  const pVet = h("input", { type: "text", value: producer.vetControlNumber });
  p.appendChild(field(UI_LABELS.fieldProducerName, pName));
  p.appendChild(field(UI_LABELS.fieldProducerAddress, pAddr));
  p.appendChild(field(UI_LABELS.fieldVetControl, pVet));
  p.appendChild(h("button", { class: "btn btn-accent", onclick: async () => {
    await DB.setSetting("producer", { name: pName.value, address: pAddr.value, vetControlNumber: pVet.value });
    toastSuccess(UI_LABELS.toastProducerSaved);
  }}, UI_LABELS.saveProducerDefaults));
  grid.appendChild(p);

  // ---- Default recipient + place ----
  const r = card(UI_LABELS.defaultRecipientPlace);
  const rRec = h("input", { type: "text", value: settings.defaultRecipient ?? BS_DEFAULTS.recipient });
  const rPlace = h("input", { type: "text", value: settings.defaultPlace ?? BS_DEFAULTS.place });
  r.appendChild(field(UI_LABELS.defaultRecipient, rRec));
  r.appendChild(field(UI_LABELS.defaultPlace, rPlace));
  r.appendChild(h("button", { class: "btn btn-accent", onclick: async () => {
    await DB.setSetting("defaultRecipient", rRec.value);
    await DB.setSetting("defaultPlace", rPlace.value);
    toastSuccess(UI_LABELS.toastDefaultsSaved);
  }}, UI_LABELS.saveDefaults));
  grid.appendChild(r);

  // ---- Theme ----
  const themeCard = card(UI_LABELS.theme);
  const themeSel = h("select");
  [["auto", UI_LABELS.themeAuto], ["light", UI_LABELS.themeLight], ["dark", UI_LABELS.themeDark]].forEach(([v, l]) =>
    themeSel.appendChild(h("option", { value: v, selected: (settings.theme || "auto") === v }, l)));
  themeSel.onchange = async () => {
    await DB.setSetting("theme", themeSel.value);
    await applyStoredTheme();
  };
  themeCard.appendChild(field(UI_LABELS.theme, themeSel));
  grid.appendChild(themeCard);

  // ---- Storage ----
  const storageCard = card(UI_LABELS.storage);
  const sLine = h("div", { class: "meta" }, UI_LABELS.storageCalculating);
  storageCard.appendChild(sLine);
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(({ usage, quota }) => {
      const mb = (b) => (b / 1024 / 1024).toFixed(2);
      const gb = (b) => (b / 1024 / 1024 / 1024).toFixed(2);
      const pct = quota ? Math.round((usage / quota) * 100) : 0;
      sLine.textContent = UI_LABELS.storageUsage(mb(usage), gb(quota), pct);
      if (pct >= 80) {
        storageCard.appendChild(h("div", { class: "infobar warning", style: "margin-top:8px;" },
          h("div", { class: "infobar-body" }, UI_LABELS.storageOver80)));
      }
    });
  } else {
    sLine.textContent = UI_LABELS.storageNoApi;
  }
  grid.appendChild(storageCard);

  // ---- Data management ----
  const dm = card(UI_LABELS.dataManagement);
  dm.appendChild(h("div", { class: "row-spread", style: "margin-bottom:12px;" },
    h("div", {}, UI_LABELS.exportDesc),
    h("button", { class: "btn btn-accent", onclick: () => exportBackup() }, UI_LABELS.exportAll)
  ));
  dm.appendChild(h("div", { class: "row-spread", style: "margin-bottom:12px;" },
    h("div", {}, UI_LABELS.importDesc),
    h("button", { class: "btn btn-standard", onclick: () => $("#import-file").click() }, UI_LABELS.importBtn)
  ));
  const lastExp = await DB.getSetting("lastExportDate");
  dm.appendChild(h("div", { class: "small muted" },
    lastExp ? UI_LABELS.lastExport(formatDateShort(lastExp.slice(0, 10))) : UI_LABELS.noExports));

  const danger = h("div", { class: "danger-zone", style: "margin-top:16px;" },
    h("div", { class: "card-title" }, UI_LABELS.deleteAllData),
    h("div", { style: "margin-bottom:8px;" }, UI_LABELS.deleteAllDataDesc),
    h("button", { class: "btn btn-danger", onclick: async () => {
      const ok = await confirmModal({
        title: UI_LABELS.modalDeleteAllDataTitle,
        message: UI_LABELS.modalDeleteAllDataBody,
        confirmLabel: UI_LABELS.delete,
        danger: true
      });
      if (!ok) return;
      await DB.wipeAll();
      sessionStorage.clear();
      location.reload();
    }}, UI_LABELS.deleteAllData)
  );
  dm.appendChild(danger);
  grid.appendChild(dm);

  root.appendChild(grid);
}

// ============================================================
//  TYPES MANAGEMENT
// ============================================================
async function renderTypes(root) {
  setAppTitle(UI_LABELS.types);
  root.innerHTML = "";
  const types = await DB.getAllTypes();
  const docs = await DB.getAllDocuments();
  const counts = new Map();
  docs.forEach(d => counts.set(d.typeId, (counts.get(d.typeId) || 0) + 1));

  root.appendChild(h("div", { class: "row-spread" },
    h("div", {},
      h("div", { class: "page-title" }, UI_LABELS.types),
      h("div", { class: "page-subtitle" }, UI_LABELS.typesCount(types.length))
    ),
    h("button", { class: "btn btn-accent", onclick: () => editType(null) }, UI_LABELS.addNewType)
  ));

  if (types.length === 0) {
    root.appendChild(h("div", { class: "empty-state" }, UI_LABELS.emptyNoTypes));
    return;
  }

  const wrap = h("div", { class: "table-wrap" });
  const table = h("table", { class: "data-table" });
  table.appendChild(h("thead", {}, h("tr", {},
    h("th", {}, UI_LABELS.typeTitle),
    h("th", {}, UI_LABELS.typeTemperature),
    h("th", {}, UI_LABELS.typeShelfLife),
    h("th", {}, UI_LABELS.thChem),
    h("th", {}, UI_LABELS.thWeightLabel),
    h("th", {}, UI_LABELS.thDocs),
    h("th", { class: "actions" }, UI_LABELS.thActions)
  )));
  const tbody = h("tbody");
  for (const t of types) {
    const count = counts.get(t.id) || 0;
    tbody.appendChild(h("tr", {},
      h("td", {}, t.title.replace(/\s+/g, " ")),
      h("td", {}, t.defaultTemperature),
      h("td", {}, `${t.shelfLifeDays}`),
      h("td", {}, t.requiresChemicalAnalysis ? "Da" : "Ne"),
      h("td", {}, t.weightLabel === "palete-kaveza" ? UI_LABELS.typeWeightPaleteKaveza : UI_LABELS.typeWeightPalete),
      h("td", {}, String(count)),
      h("td", { class: "actions" },
        h("button", { class: "btn btn-subtle icon-only", title: UI_LABELS.edit, onclick: () => editType(t) }, bxi("bx-edit")),
        h("button", { class: "btn btn-subtle icon-only", title: UI_LABELS.delete, style: "color:var(--danger);",
          onclick: async () => {
            if (count > 0) {
              showModal({ title: UI_LABELS.modalCannotDeleteTitle, body: UI_LABELS.modalCannotDeleteBody(count), actions: [{ label: UI_LABELS.ok, variant: "btn-accent", value: true }] });
              return;
            }
            const ok = await confirmModal({ title: UI_LABELS.modalDeleteTypeTitle, message: UI_LABELS.modalDeleteTypeBody(t.title.split("\n")[0]), confirmLabel: UI_LABELS.delete, danger: true });
            if (!ok) return;
            await DB.deleteType(t.id);
            renderTypes(root);
          }
        }, bxi("bx-trash"))
      )
    ));
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  root.appendChild(wrap);
}

async function editType(existing) {
  const body = h("div", {});
  const titleEl = h("textarea", { rows: "2" });
  titleEl.value = existing ? existing.title : "";
  const tempEl = h("input", { type: "text", value: existing ? existing.defaultTemperature : "-12 ° C" });
  const shelfEl = h("input", { type: "number", value: existing ? existing.shelfLifeDays : 365 });
  const chemEl = h("input", { type: "checkbox" });
  chemEl.checked = existing ? !!existing.requiresChemicalAnalysis : false;
  const weightP = h("input", { type: "radio", name: "weightLabel", value: "palete" });
  const weightPK = h("input", { type: "radio", name: "weightLabel", value: "palete-kaveza" });
  if (existing && existing.weightLabel === "palete-kaveza") weightPK.checked = true;
  else weightP.checked = true;

  body.appendChild(field(UI_LABELS.typeTitle, titleEl));
  body.appendChild(field(UI_LABELS.typeTemperature, tempEl));
  body.appendChild(field(UI_LABELS.typeShelfLife, shelfEl));
  body.appendChild(h("label", { class: "checkbox-row" }, chemEl, h("span", {}, UI_LABELS.typeRequiresChem)));
  body.appendChild(h("div", { class: "field" },
    h("label", {}, UI_LABELS.typeWeightLabel),
    h("label", { class: "checkbox-row" }, weightP, h("span", {}, UI_LABELS.typeWeightPalete)),
    h("label", { class: "checkbox-row" }, weightPK, h("span", {}, UI_LABELS.typeWeightPaleteKaveza))
  ));

  const result = await showModal({
    title: existing ? UI_LABELS.editType : UI_LABELS.newType,
    body,
    actions: [
      { label: UI_LABELS.cancel, variant: "btn-subtle", value: false },
      { label: UI_LABELS.save, variant: "btn-accent", value: true }
    ]
  });
  if (!result) return;
  if (!titleEl.value.trim()) return;
  const id = existing ? existing.id : titleEl.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + uuid().slice(0, 6);
  await DB.putType({
    id,
    title: titleEl.value,
    defaultTemperature: tempEl.value,
    shelfLifeDays: Number(shelfEl.value) || 0,
    requiresChemicalAnalysis: chemEl.checked,
    weightLabel: weightPK.checked ? "palete-kaveza" : "palete"
  });
  route();
}

// ============================================================
//  EXPORT
// ============================================================
async function exportBackup() {
  const types = await DB.getAllTypes();
  const documents = await DB.getAllDocuments();
  const settings = await DB.getAllSettings();
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    types,
    documents,
    settings
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: `brovis-backup-${todayISO()}.json` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  await DB.setSetting("lastExportDate", new Date().toISOString());
  toastSuccess(UI_LABELS.toastBackupDownloaded);
}

// ============================================================
//  PRINT (delegates to pdf.js)
// ============================================================
async function printDocument(docId) { return window.PDF.printDocument(docId); }
async function startBatchPrint(ids) { return window.PDF.startBatchPrint(ids); }

// ============================================================
//  BOOT
// ============================================================
window.addEventListener("DOMContentLoaded", bootstrap);
