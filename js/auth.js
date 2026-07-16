/* ============================================================
 * auth.js — Firebase Authentication para RetroTasks
 *
 * Maneja:
 *  - Login con Google (popup)
 *  - Login con Email + Contraseña
 *  - Registro de nuevos usuarios
 *  - Logout
 *  - Listener de cambio de sesión (onAuthStateChanged)
 * ============================================================ */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Importar la config de Firebase desde firebase.js
import { firebaseConfig } from "./firebase.js";

let _auth = null;
let _db = null;
const googleProvider = new GoogleAuthProvider();

function getAuthInstance() {
  if (_auth) return _auth;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  _auth = getAuth(app);
  _db = getFirestore(app);
  return _auth;
}

// Crea o actualiza el documento del usuario en Firestore
async function ensureUserProfile(user) {
  if (!_db) return;
  try {
    const ref = doc(_db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        displayName: user.displayName || "Aventurero",
        email: user.email || "",
        photoUrl: user.photoURL || "",
        createdAt: serverTimestamp(),
        preferences: {
          soundOn: false,
          notificationsEnabled: true,
          theme: "fogata",
        },
        categories: [
          { name: "Hogar",    color: "#7BB661" },
          { name: "Trabajo",  color: "#5B93C7" },
          { name: "Personal", color: "#E0A02E" },
        ],
      });
    }
  } catch (e) {
    console.warn("Error al crear perfil de usuario:", e);
  }
}

// Observa el estado de autenticación y llama al callback.
// Devuelve la función para desuscribirse.
export function watchAuthState(callback) {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, async (user) => {
    if (user) await ensureUserProfile(user);
    callback(user);
  });
}

// Login con Google (abre popup)
export async function loginWithGoogle() {
  const auth = getAuthInstance();
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserProfile(result.user);
    return { user: result.user, error: null };
  } catch (e) {
    return { user: null, error: friendlyError(e.code) };
  }
}

// Login con email + contraseña
export async function loginWithEmail(email, password) {
  const auth = getAuthInstance();
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (e) {
    return { user: null, error: friendlyError(e.code) };
  }
}

// Registro de nuevo usuario con email + contraseña
export async function registerWithEmail(email, password, displayName) {
  const auth = getAuthInstance();
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    await ensureUserProfile({ ...result.user, displayName });
    return { user: result.user, error: null };
  } catch (e) {
    return { user: null, error: friendlyError(e.code) };
  }
}

// Cerrar sesión
export async function logout() {
  const auth = getAuthInstance();
  try {
    await signOut(auth);
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}

// Devuelve el usuario actualmente autenticado (o null)
export function getCurrentUser() {
  const auth = getAuthInstance();
  return auth.currentUser;
}

// Transforma códigos de error de Firebase en mensajes amigables
function friendlyError(code) {
  const map = {
    "auth/user-not-found":         "No existe una cuenta con ese correo.",
    "auth/wrong-password":         "Contraseña incorrecta. Inténtalo de nuevo.",
    "auth/email-already-in-use":   "Ese correo ya está registrado.",
    "auth/invalid-email":          "El correo electrónico no es válido.",
    "auth/weak-password":          "La contraseña debe tener al menos 6 caracteres.",
    "auth/popup-closed-by-user":   "Se canceló el inicio de sesión.",
    "auth/network-request-failed": "Sin conexión a internet. Revisa tu red.",
    "auth/too-many-requests":      "Demasiados intentos. Espera un momento.",
    "auth/invalid-credential":     "Correo o contraseña incorrectos.",
  };
  return map[code] || "Ocurrió un error inesperado. Intenta de nuevo.";
}
