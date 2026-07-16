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

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
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
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Guarda o actualiza un item personal
export async function saveUserItem(uid, item) {
  const firestoreDb = initFirebase();
  if (!firestoreDb || !uid) return;
  try {
    const ref = doc(firestoreDb, "users", uid, "items", item.id);
    await setDoc(ref, item);
  } catch (e) {
    console.error("Error al guardar item:", e);
  }
}

// Elimina un item personal
export async function deleteUserItem(uid, itemId) {
  const firestoreDb = initFirebase();
  if (!firestoreDb || !uid) return;
  try {
    const ref = doc(firestoreDb, "users", uid, "items", itemId);
    await deleteDoc(ref);
  } catch (e) {
    console.error("Error al eliminar item:", e);
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

// ─── Tableros Colaborativos: boards/{boardId}/ ───────────────

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

export async function createBoard(boardId, creatorName, creatorId) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return false;
  try {
    await setDoc(doc(firestoreDb, "boards", boardId), {
      createdAt: new Date().toISOString(),
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
  if (!firestoreDb) return;
  try {
    const ref = doc(firestoreDb, "boards", boardId, "items", item.id);
    await setDoc(ref, item);
  } catch (e) {
    console.error("Error guardando item cooperativo:", e);
  }
}

export async function deleteSharedItem(boardId, itemId) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return;
  try {
    const ref = doc(firestoreDb, "boards", boardId, "items", itemId);
    await deleteDoc(ref);
  } catch (e) {
    console.error("Error eliminando item cooperativo:", e);
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
