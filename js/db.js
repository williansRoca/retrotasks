/* ============================================================
 * db.js — Capa de datos de RetroTasks (IndexedDB)
 *
 * POR QUE IndexedDB y no localStorage:
 *  - localStorage es sincrono (bloquea la interfaz), solo guarda
 *    texto y tiene tope ~5MB. IndexedDB es asincrono, estructurado
 *    y escala mejor hacia un futuro con sincronizacion en la nube.
 *
 * DISEÑO: esta capa NO sabe nada de la interfaz. Expone funciones
 * (getAll, put, remove, bulkReplace) que devuelven Promesas. Asi,
 * el dia que exista un backend, se reemplaza esta capa por llamadas
 * a una API sin tocar el resto de la app.
 * ============================================================ */

const DB_NAME = "retrotasks";
const DB_VERSION = 1;
const STORE_ITEMS = "items";
const STORE_META = "meta"; // categorias, preferencias, etc.

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    // Se ejecuta solo al crear/actualizar el esquema.
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const store = db.createObjectStore(STORE_ITEMS, { keyPath: "id" });
        // Indices pensados para consultas futuras (filtros, sync).
        store.createIndex("by_category", "category", { unique: false });
        store.createIndex("by_due", "due", { unique: false });
        store.createIndex("by_owner", "owner", { unique: false });
        store.createIndex("by_sync", "syncStatus", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

// Envuelve una transaccion en una Promesa para usar async/await.
function tx(storeName, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const result = fn(store);
        transaction.oncomplete = () => resolve(result.value);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
  );
}

/* ---------- ITEMS ---------- */

export async function getAllItems() {
  return tx(STORE_ITEMS, "readonly", (store) => {
    const box = {};
    store.getAll().onsuccess = (e) => (box.value = e.target.result || []);
    return box;
  });
}

export async function putItem(item) {
  return tx(STORE_ITEMS, "readwrite", (store) => {
    const box = {};
    store.put(item).onsuccess = () => (box.value = item);
    return box;
  });
}

export async function removeItem(id) {
  return tx(STORE_ITEMS, "readwrite", (store) => {
    const box = {};
    store.delete(id).onsuccess = () => (box.value = id);
    return box;
  });
}

// Reemplaza TODOS los items (usado al importar un respaldo).
export async function bulkReplaceItems(items) {
  return tx(STORE_ITEMS, "readwrite", (store) => {
    const box = {};
    store.clear().onsuccess = () => {
      items.forEach((it) => store.put(it));
      box.value = items;
    };
    return box;
  });
}

/* ---------- META (categorias / preferencias) ---------- */

export async function getMeta(key, fallback = null) {
  return tx(STORE_META, "readonly", (store) => {
    const box = { value: fallback };
    store.get(key).onsuccess = (e) => {
      if (e.target.result) box.value = e.target.result.value;
    };
    return box;
  });
}

export async function setMeta(key, value) {
  return tx(STORE_META, "readwrite", (store) => {
    const box = {};
    store.put({ key, value }).onsuccess = () => (box.value = value);
    return box;
  });
}

/* ---------- COOPERATIVO METADATA ---------- */

export async function getActiveBoardId() {
  return getMeta("activeBoardId", null);
}

export async function setActiveBoardId(boardId) {
  return setMeta("activeBoardId", boardId);
}

export async function getSyncNickname() {
  return getMeta("syncNickname", "");
}

export async function setSyncNickname(name) {
  return setMeta("syncNickname", name);
}

