// ============================================================
//  Print rendering. Builds an HTML template inside #print-root
//  styled by print.css, then invokes window.print().
//  Layout matches the scanned originals (see images in repo root).
// ============================================================

const PRINT_ROOT_ID = "print-root";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}.`;
}

function nl2br(s) {
  return esc(s).replace(/\n/g, "<br>");
}

function num(v) {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return Number.isInteger(n) ? String(n) : String(n);
}

function renderTemplate(doc, type) {
  const palletWeightLabel = type.weightLabel === "palete-kaveza"
    ? BS_LABELS.tezinaPaleteKaveza
    : BS_LABELS.tezinaPalete;

  const isMSM = !!type.requiresChemicalAnalysis;
  const vetLabel = isMSM ? BS_LABELS.vetOznakaShort : BS_LABELS.vetOznaka;

  // Build the row-pair list. Each entry = { label, value, klass? }.
  const rows = [
    { label: vetLabel, value: doc.vetMarkNumber || "" },
    { label: BS_LABELS.primatelj, value: doc.recipient || "" },
    { label: BS_LABELS.porijekloUzgoja, value: doc.originOfBreeding || "" },
    { label: BS_LABELS.datumProizvodnje, value: fmtDate(doc.productionDate) },
    { label: BS_LABELS.najboljeUpotrijebiti, value: fmtDate(doc.bestBeforeDate) },
    { label: BS_LABELS.potrebnaTemperatura, value: doc.temperature || "", klass: "temp-row" },
    { label: BS_LABELS.ukupnoBlokova, value: num(doc.totalBlocks) },
    { label: BS_LABELS.netoTezina, value: num(doc.netWeight) },
    { label: palletWeightLabel, value: num(doc.palletWeight) },
    { label: BS_LABELS.brutoTezina, value: num(doc.grossWeight) }
  ];

  // For MSM, the chemical analysis 3-column table sits as the final row
  // inside the values column, with HEMIJSKA ANALIZA % : as the left label.
  const chemRowHTML = (isMSM && doc.chemicalAnalysis) ? `
    <div class="row chem-row">
      <div class="lbl">${esc(BS_LABELS.hemijskaAnaliza)}</div>
      <div class="val chem-val">
        <table class="chem-table">
          <thead>
            <tr>
              <th>${esc(BS_LABELS.mast)}</th>
              <th>${esc(BS_LABELS.protein)}</th>
              <th>${esc(BS_LABELS.vlaga)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${esc(num(doc.chemicalAnalysis.fat))}</td>
              <td>${esc(num(doc.chemicalAnalysis.protein))}</td>
              <td>${esc(num(doc.chemicalAnalysis.moisture))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>` : "";

  const rowsHTML = rows.map(r => `
    <div class="row ${r.klass || ""}">
      <div class="lbl">${nl2br(r.label)}</div>
      <div class="val">${esc(r.value)}</div>
    </div>
  `).join("");

  return `
    <div class="sheet">
      <header class="sheet-head">
        <div class="logo-block">
          <svg viewBox="0 0 200 100" class="logo-svg">
            <ellipse cx="100" cy="40" rx="90" ry="30" fill="none" stroke="black" stroke-width="2.5"/>
            <text x="100" y="50" text-anchor="middle" font-family="Times New Roman, serif" font-style="italic" font-weight="700" font-size="36" fill="black">Brovis</text>
            <text x="100" y="78" text-anchor="middle" font-family="Times New Roman, serif" font-size="10" letter-spacing="3" fill="black">AKOVA GROUP</text>
          </svg>
        </div>
        <div class="pallet-block">
          <span class="pallet-label">${esc(BS_LABELS.paletaBroj)}</span>
          <span class="pallet-number">${esc(doc.paletaBroj || "")}</span>
        </div>
        <div class="stamp-box"></div>
      </header>

      <section class="producer-box">
        <div class="producer-line"><b>${esc(BS_LABELS.proizvodjac)}</b></div>
        <div class="producer-name"><i><b>${esc(doc.producer.name)}</b></i></div>
        <div class="producer-address"><i>${esc(doc.producer.address)}</i></div>
        <div class="producer-vet">${esc(BS_LABELS.vetKontrolniBroj)} ${esc(doc.producer.vetControlNumber)}</div>
      </section>

      <section class="title-box">${esc(type.title).replace(/\n/g, "<br>")}</section>

      <section class="rows">
        ${rowsHTML}
        ${chemRowHTML}
      </section>

      <footer class="sheet-foot">${esc(doc.footer.place || "Visoko")}; ${esc(fmtDate(doc.footer.date))}</footer>
    </div>
  `;
}

async function printDocument(docId) {
  const doc = await DB.getDocument(docId);
  if (!doc) return;
  const type = await DB.getType(doc.typeId);
  if (!type) return;
  const root = document.getElementById(PRINT_ROOT_ID);
  root.innerHTML = renderTemplate(doc, type);
  await new Promise(r => requestAnimationFrame(() => r()));
  await new Promise(r => setTimeout(r, 30));
  const cleanup = () => {
    root.innerHTML = "";
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

async function startBatchPrint(ids) {
  if (!ids || ids.length === 0) return;
  let index = 0;
  let cancelled = false;

  return new Promise((resolve) => {
    const modalRoot = document.getElementById("modal-root");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "modal";
    backdrop.appendChild(modal);
    modalRoot.appendChild(backdrop);

    function render() {
      modal.innerHTML = "";
      const title = document.createElement("div");
      title.className = "modal-title";
      title.textContent = "Štampanje serije";
      modal.appendChild(title);

      const body = document.createElement("div");
      body.className = "modal-body";
      if (index >= ids.length) {
        body.textContent = `Završeno. Odštampano ${ids.length} dokument(a).`;
      } else {
        body.textContent = `Dokument ${index + 1} od ${ids.length}. Pritisnite "Štampaj sljedeći" da otvorite print dijalog.`;
      }
      modal.appendChild(body);

      const actions = document.createElement("div");
      actions.className = "modal-actions";
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn btn-subtle";
      cancelBtn.textContent = index >= ids.length ? "Zatvori" : "Otkaži";
      cancelBtn.onclick = () => {
        cancelled = true;
        backdrop.remove();
        resolve();
      };
      actions.appendChild(cancelBtn);

      if (index < ids.length) {
        const nextBtn = document.createElement("button");
        nextBtn.className = "btn btn-accent";
        nextBtn.textContent = "Štampaj sljedeći";
        nextBtn.onclick = async () => {
          const id = ids[index];
          index++;
          await printDocument(id);
          if (!cancelled) render();
        };
        actions.appendChild(nextBtn);
      }
      modal.appendChild(actions);
    }
    render();
  });
}

window.PDF = { printDocument, startBatchPrint };
