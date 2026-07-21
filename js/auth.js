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

import { initializeApp, getApps } from "./vendor/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  deleteUser,
  sendPasswordResetEmail,
  GoogleAuthProvider,
} from "./vendor/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "./vendor/firebase-firestore.js";

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

/* Login con Google.
 *
 * IMPORTANTE: signInWithPopup NO funciona dentro del WebView de
 * Capacitor (no hay ventana emergente que devuelva el resultado; la
 * pantalla se quedaba en blanco). En Android usamos el plugin nativo
 * @capacitor-firebase/authentication: abre el selector de cuentas del
 * sistema y nos devuelve un idToken que canjeamos por una credencial
 * de Firebase. En la web se mantiene el popup de siempre. */
function isNativePlatform() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

export async function loginWithGoogle() {
  const auth = getAuthInstance();
  try {
    if (isNativePlatform()) {
      const FirebaseAuthentication = window.Capacitor.Plugins.FirebaseAuthentication;
      if (!FirebaseAuthentication) {
        return { user: null, error: "El inicio de sesión con Google no está disponible en este dispositivo." };
      }
      // 1. Selector de cuentas nativo de Android
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result?.credential?.idToken;
      if (!idToken) {
        return { user: null, error: "Se canceló el inicio de sesión." };
      }
      // 2. Canjear el token por una sesión del SDK web (que es el que
      //    usa el resto de la app para leer y escribir en Firestore)
      const credential = GoogleAuthProvider.credential(idToken);
      const cred = await signInWithCredential(auth, credential);
      await ensureUserProfile(cred.user);
      return { user: cred.user, error: null };
    }

    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserProfile(result.user);
    return { user: result.user, error: null };
  } catch (e) {
    console.error("Error en login con Google:", e);
    if (e?.message?.includes("cancel") || e?.code === "auth/popup-closed-by-user") {
      return { user: null, error: "Se canceló el inicio de sesión." };
    }
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

/* Envía el correo para restablecer la contraseña.
 * Por privacidad, Firebase no revela si el correo existe o no; se
 * responde siempre con el mismo mensaje para no filtrar qué cuentas
 * están registradas. */
export async function resetPassword(email) {
  const auth = getAuthInstance();
  const correo = (email || "").trim();
  if (!correo) return { error: "Escribe tu correo electrónico primero." };
  try {
    await sendPasswordResetEmail(auth, correo);
    return { error: null };
  } catch (e) {
    if (e.code === "auth/invalid-email") {
      return { error: "El correo electrónico no es válido." };
    }
    if (e.code === "auth/user-not-found") {
      return { error: null }; // no revelar si existe
    }
    return { error: friendlyError(e.code) };
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

// Elimina la CUENTA de autenticación del usuario actual.
// Los datos de Firestore deben borrarse ANTES de llamar aquí
// (las reglas exigen sesión activa para poder borrarlos).
export async function deleteAccount() {
  const auth = getAuthInstance();
  if (!auth.currentUser) return { error: "No hay sesión activa." };
  try {
    await deleteUser(auth.currentUser);
    return { error: null };
  } catch (e) {
    if (e.code === "auth/requires-recent-login") {
      return { error: "Por seguridad, cierra sesión, vuelve a iniciarla y repite la eliminación." };
    }
    return { error: friendlyError(e.code) };
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
