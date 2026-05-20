// IndexedDB Promise wrapper for the Brovis pallet app.
// Database: brovis-pallet-app, version 1.
// Stores: documents, types, settings.

const DB_NAME = "brovis-pallet-app";
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains("documents")) {
        const s = db.createObjectStore("documents", { keyPath: "id" });
        s.createIndex("typeId", "typeId", { unique: false });
        s.createIndex("createdAt", "createdAt", { unique: false });
        s.createIndex("paletaBroj", "paletaBroj", { unique: false });
      }
      if (!db.objectStoreNames.contains("types")) {
        db.createObjectStore("types", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeNames, mode) {
  return openDB().then((db) => db.transaction(storeNames, mode));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const DB = {
  // ---------- documents ----------
  async getAllDocuments() {
    const t = await tx("documents", "readonly");
    return reqToPromise(t.objectStore("documents").getAll());
  },
  async getDocumentsByType(typeId) {
    const t = await tx("documents", "readonly");
    const idx = t.objectStore("documents").index("typeId");
    return reqToPromise(idx.getAll(IDBKeyRange.only(typeId)));
  },
  async getDocument(id) {
    const t = await tx("documents", "readonly");
    return reqToPromise(t.objectStore("documents").get(id));
  },
  async putDocument(doc) {
    const t = await tx("documents", "readwrite");
    return reqToPromise(t.objectStore("documents").put(doc));
  },
  async deleteDocument(id) {
    const t = await tx("documents", "readwrite");
    return reqToPromise(t.objectStore("documents").delete(id));
  },
  async deleteDocumentsByType(typeId) {
    const docs = await DB.getDocumentsByType(typeId);
    const t = await tx("documents", "readwrite");
    const store = t.objectStore("documents");
    return Promise.all(docs.map((d) => reqToPromise(store.delete(d.id))));
  },
  async countDocumentsByType(typeId) {
    const t = await tx("documents", "readonly");
    const idx = t.objectStore("documents").index("typeId");
    return reqToPromise(idx.count(IDBKeyRange.only(typeId)));
  },

  // ---------- types ----------
  async getAllTypes() {
    const t = await tx("types", "readonly");
    return reqToPromise(t.objectStore("types").getAll());
  },
  async getType(id) {
    const t = await tx("types", "readonly");
    return reqToPromise(t.objectStore("types").get(id));
  },
  async putType(type) {
    const t = await tx("types", "readwrite");
    return reqToPromise(t.objectStore("types").put(type));
  },
  async deleteType(id) {
    const t = await tx("types", "readwrite");
    return reqToPromise(t.objectStore("types").delete(id));
  },

  // ---------- settings ----------
  // single-row-per-key; value lives on the `value` property.
  async getSetting(key) {
    const t = await tx("settings", "readonly");
    const row = await reqToPromise(t.objectStore("settings").get(key));
    return row ? row.value : undefined;
  },
  async setSetting(key, value) {
    const t = await tx("settings", "readwrite");
    return reqToPromise(t.objectStore("settings").put({ key, value }));
  },
  async getAllSettings() {
    const t = await tx("settings", "readonly");
    const rows = await reqToPromise(t.objectStore("settings").getAll());
    const out = {};
    rows.forEach((r) => (out[r.key] = r.value));
    return out;
  },

  // ---------- meta ----------
  async wipeAll() {
    if (dbPromise) {
      const db = await dbPromise;
      db.close();
      dbPromise = null;
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve(); // best-effort
    });
  },

  // Seed types + settings on first run. Idempotent: only seeds missing rows.
  async seedIfEmpty() {
    const types = await DB.getAllTypes();
    if (types.length === 0) {
      for (const t of SEED_TYPES) {
        await DB.putType({ ...t });
      }
    }
    const settings = await DB.getAllSettings();
    if (settings.producer === undefined) {
      await DB.setSetting("producer", {
        name: BS_DEFAULTS.producerName,
        address: BS_DEFAULTS.producerAddress,
        vetControlNumber: BS_DEFAULTS.producerVetControl
      });
    }
    if (settings.defaultRecipient === undefined) {
      await DB.setSetting("defaultRecipient", BS_DEFAULTS.recipient);
    }
    if (settings.defaultPlace === undefined) {
      await DB.setSetting("defaultPlace", BS_DEFAULTS.place);
    }
    if (settings.theme === undefined) {
      await DB.setSetting("theme", "auto");
    }
  }
};

window.DB = DB;
