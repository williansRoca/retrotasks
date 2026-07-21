/* ============================================================
 * firebase.js — Capa de datos Firebase de RetroTasks v2
 *
 * CAMBIOS v2:
 *  - Exporta firebaseConfig para que auth.js pueda reutilizarlo.
 *  - Añade funciones para leer/escribir items en la colección
 *    personal del usuario: users/{uid}/items/{itemId}
 *  - Mantiene las funciones de tableros colaborativos.
 *  - Habilita persistencia offline con caché multitab.
 * ============================================================ */

import { initializeApp, getApps } from "./vendor/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  onSnapshot,
  getDoc,
  query,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "./vendor/firebase-firestore.js";

// ─── Configuración ───────────────────────────────────────────
export const firebaseConfig = {
  apiKey: "AIzaSyDxxnGbwQhqC-bJfoEwqfTsQmJMpLlBcqI",
  authDomain: "retrotasks-903c9.firebaseapp.com",
  databaseURL: "https://retrotasks-903c9-default-rtdb.firebaseio.com",
  projectId: "retrotasks-903c9",
  storageBucket: "retrotasks-903c9.firebasestorage.app",
  messagingSenderId: "263400038199",
  appId: "1:263400038199:web:3dadcf228027e1d82404b2"
};

let db = null;

// ─── Inicialización ───────────────────────────────────────────
export function initFirebase() {
  if (db) return db;
  try {
    const app = getApps().length
      ? getApps()[0]
      : initializeApp(firebaseConfig);

    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    console.log("Firestore inicializado con caché offline.");
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
  }
  return db;
}

export function isFirebaseConfigured() {
  return !!(firebaseConfig?.projectId);
}

// ─── Items Personales: users/{uid}/items/ ────────────────────

// Obtiene todos los items personales del usuario
export async function getUserItems(uid) {
  const firestoreDb = initFirebase();
  if (!firestoreDb || !uid) return [];
  try {
    const snap = await getDocs(
      collection(firestoreDb, "users", uid, "items")
    );
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error("Error al obtener items del usuario:", e);
    return [];
  }
}

// Guarda o actualiza un item personal. Devuelve true si tuvo éxito,
// para que la interfaz pueda avisar cuando una escritura falla.
export async function saveUserItem(uid, item) {
  const firestoreDb = initFirebase();
  if (!firestoreDb || !uid) return false;
  try {
    const ref = doc(firestoreDb, "users", uid, "items", item.id);
    await setDoc(ref, item);
    return true;
  } catch (e) {
    console.error("Error al guardar item:", e);
    return false;
  }
}

// Elimina un item personal. Devuelve true si tuvo éxito.
export async function deleteUserItem(uid, itemId) {
  const firestoreDb = initFirebase();
  if (!firestoreDb || !uid) return false;
  try {
    const ref = doc(firestoreDb, "users", uid, "items", itemId);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error("Error al eliminar item:", e);
    return false;
  }
}

// Suscripción en tiempo real a los items del usuario
export function subscribeToUserItems(uid, callback) {
  const firestoreDb = initFirebase();
  if (!firestoreDb || !uid) return () => {};
  const q = query(collection(firestoreDb, "users", uid, "items"));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => d.data());
    callback(items);
  }, (error) => {
    console.error("Error en suscripción de items:", error);
  });
}

// Borra TODOS los datos del usuario en Firestore: sus items, su
// documento de perfil y su token de notificaciones. Se usa en la
// eliminación de cuenta (debe ejecutarse con la sesión aún activa).
export async function deleteAllUserData(uid) {
  const firestoreDb = initFirebase();
  if (!firestoreDb || !uid) return false;
  try {
    const itemsSnap = await getDocs(collection(firestoreDb, "users", uid, "items"));
    for (const d of itemsSnap.docs) {
      await deleteDoc(d.ref);
    }
    await deleteDoc(doc(firestoreDb, "users", uid));
    await deleteDoc(doc(firestoreDb, "fcmTokens", uid));
    return true;
  } catch (e) {
    console.error("Error al borrar los datos del usuario:", e);
    return false;
  }
}

// ─── Tableros Colaborativos: boards/{boardId}/ ───────────────

// Lista de tableros a los que pertenece el usuario. Se guarda como
// arreglo dentro de users/{uid} (no en una subcolección) para que
// encaje con las reglas de seguridad ya publicadas.
export async function getUserBoards(uid) {
  const firestoreDb = initFirebase();
  if (!firestoreDb || !uid) return [];
  try {
    const snap = await getDoc(doc(firestoreDb, "users", uid));
    const list = snap.exists() ? snap.data().boards : null;
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error("Error al leer los tableros del usuario:", e);
    return [];
  }
}

// Guarda la lista completa de membresías del usuario.
export async function setUserBoards(uid, boards) {
  const firestoreDb = initFirebase();
  if (!firestoreDb || !uid) return false;
  try {
    await setDoc(doc(firestoreDb, "users", uid), { boards }, { merge: true });
    return true;
  } catch (e) {
    console.error("Error al guardar los tableros del usuario:", e);
    return false;
  }
}

// Devuelve los datos del tablero (incluido su nombre) o null.
export async function getBoardInfo(boardId) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return null;
  try {
    const snap = await getDoc(doc(firestoreDb, "boards", boardId));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("Error al leer el tablero:", e);
    return null;
  }
}

/* Elimina un tablero por completo: sus misiones y el documento del
 * tablero. Solo el creador puede hacerlo (lo exigen las reglas de
 * Firestore). Devuelve { ok, error }. */
export async function deleteBoard(boardId) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return { ok: false, error: "Sin conexión con la base de datos." };
  try {
    const itemsSnap = await getDocs(collection(firestoreDb, "boards", boardId, "items"));
    for (const d of itemsSnap.docs) {
      await deleteDoc(d.ref);
    }
    await deleteDoc(doc(firestoreDb, "boards", boardId));
    return { ok: true, error: null };
  } catch (e) {
    console.error("Error al eliminar el tablero:", e);
    if (e.code === "permission-denied") {
      return { ok: false, error: "Solo quien creó el tablero puede eliminarlo." };
    }
    return { ok: false, error: "No se pudo eliminar el tablero. Revisa tu conexión." };
  }
}

export async function checkBoardExists(boardId) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return false;
  try {
    const snap = await getDoc(doc(firestoreDb, "boards", boardId));
    return snap.exists();
  } catch (e) {
    console.error("Error comprobando tablero:", e);
    return false;
  }
}

export async function createBoard(boardId, creatorName, creatorId, boardName) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return false;
  try {
    await setDoc(doc(firestoreDb, "boards", boardId), {
      createdAt: new Date().toISOString(),
      name: (boardName || "").trim() || "Tablero compartido",
      creator: (creatorName || "").trim() || "Anónimo",
      creatorId: creatorId || null,
      members: [{ userId: creatorId, nickname: creatorName, joinedAt: new Date().toISOString() }],
    });
    return true;
  } catch (e) {
    console.error("Error creando tablero:", e);
    return false;
  }
}

export async function saveSharedItem(boardId, item) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return false;
  try {
    const ref = doc(firestoreDb, "boards", boardId, "items", item.id);
    await setDoc(ref, item);
    return true;
  } catch (e) {
    console.error("Error guardando item cooperativo:", e);
    return false;
  }
}

export async function deleteSharedItem(boardId, itemId) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return false;
  try {
    const ref = doc(firestoreDb, "boards", boardId, "items", itemId);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error("Error eliminando item cooperativo:", e);
    return false;
  }
}

export function subscribeToBoard(boardId, callback) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return () => {};
  const q = query(collection(firestoreDb, "boards", boardId, "items"));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => d.data());
    callback(items);
  }, (error) => {
    console.error("Error en suscripción de tablero:", error);
  });
}
