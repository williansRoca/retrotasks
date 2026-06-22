/* ============================================================
 * firebase.js — Capa de sincronización cooperativa en tiempo real
 *
 * DETALLE DE DISEÑO:
 *  - Se conecta a Firebase Firestore usando ESM desde CDN para 
 *    mantener la compatibilidad con GitHub Pages sin requerir
 *    herramientas de compilación adicionales.
 *  - Habilita la persistencia local multientrada nativa para
 *    soporte sin conexión inmediato.
 * ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDoc,
  query,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// CONFIGURACIÓN DE FIREBASE
// Reemplaza este objeto con las credenciales de tu proyecto de Firebase Console.
// Las puedes obtener en: https://console.firebase.google.com/
const firebaseConfig = {
  // Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

const firebaseConfig = {
  apiKey: "AIzaSyDxxnGbwQhqC-bJfoEwqfTsQmJMpLlBcqI",
  authDomain: "retrotasks-903c9.firebaseapp.com",
  databaseURL: "https://retrotasks-903c9-default-rtdb.firebaseio.com",
  projectId: "retrotasks-903c9",
  storageBucket: "retrotasks-903c9.firebasestorage.app",
  messagingSenderId: "263400038199",
  appId: "1:263400038199:web:3dadcf228027e1d82404b2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
};

let app = null;
let db = null;

// Verifica si las credenciales por defecto han sido editadas.
export function isFirebaseConfigured() {
  return firebaseConfig && 
         firebaseConfig.projectId && 
         firebaseConfig.projectId !== "TU_PROJECT_ID" && 
         firebaseConfig.apiKey !== "TU_API_KEY";
}

// Inicializa Firebase y activa el soporte offline (persistencia local).
export function initFirebase() {
  if (!isFirebaseConfigured()) {
    return null;
  }
  if (db) return db;

  try {
    app = initializeApp(firebaseConfig);
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    console.log("Firebase & Firestore inicializados con caché offline persistente.");
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
  }
  return db;
}

// Verifica si un código de tablero ya existe en Firestore
export async function checkBoardExists(boardId) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return false;
  try {
    const boardRef = doc(firestoreDb, "boards", boardId);
    const docSnap = await getDoc(boardRef);
    return docSnap.exists();
  } catch (e) {
    console.error("Error comprobando existencia del tablero:", e);
    return false;
  }
}

// Crea un nuevo tablero en Firestore con metadatos iniciales
export async function createBoard(boardId, creatorName) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return false;
  try {
    const boardRef = doc(firestoreDb, "boards", boardId);
    await setDoc(boardRef, {
      createdAt: new Date().toISOString(),
      creator: (creatorName || "").trim() || "Anónimo"
    });
    return true;
  } catch (e) {
    console.error("Error creando tablero:", e);
    return false;
  }
}

// Guarda o actualiza un item (tarea, nota, recordatorio) en el tablero compartido
export async function saveSharedItem(boardId, item) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return;
  try {
    const itemRef = doc(firestoreDb, "boards", boardId, "items", item.id);
    await setDoc(itemRef, item);
  } catch (e) {
    console.error("Error guardando item cooperativo:", e);
  }
}

// Elimina un item del tablero compartido
export async function deleteSharedItem(boardId, itemId) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return;
  try {
    const itemRef = doc(firestoreDb, "boards", boardId, "items", itemId);
    await deleteDoc(itemRef);
  } catch (e) {
    console.error("Error eliminando item cooperativo:", e);
  }
}

// Se suscribe en tiempo real a los cambios de un tablero
// Ejecuta callback cada vez que hay cambios y devuelve la función para desuscribirse
export function subscribeToBoard(boardId, callback) {
  const firestoreDb = initFirebase();
  if (!firestoreDb) return () => {};

  const q = query(collection(firestoreDb, "boards", boardId, "items"));
  
  return onSnapshot(q, (snapshot) => {
    const items = [];
    snapshot.forEach((docSnap) => {
      items.push(docSnap.data());
    });
    callback(items);
  }, (error) => {
    console.error("Error en la suscripción a Firestore:", error);
  });
}
