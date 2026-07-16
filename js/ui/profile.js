/* ============================================================
 * ui/profile.js — Pestaña Perfil: avatar, temas, estadísticas,
 * cierre de sesión y la Guía de Aventura (tutorial inicial).
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { setMeta } from "../db.js";
import { createItem } from "../model.js";
import { THEMES, changeTheme } from "../theme.js";
import { logout, deleteAccount } from "../auth.js";
import { initFirebase, saveUserItem, deleteAllUserData } from "../firebase.js";
import { showToast } from "./dom.js";
import { doc, setDoc, getDoc } from "../vendor/firebase-firestore.js";
import { el } from "./dom.js";

/* ---------- Preferencias del usuario (avatar + tutorial) ---------- */

// Carga las preferencias guardadas en Firestore y muestra el prompt
// de la Guía de Aventura si corresponde. Se llama al iniciar sesión.
export async function loadUserPreferences(uid) {
  const db = initFirebase();
  if (!db) return;
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      state.avatarId = userData.preferences?.avatarId || 1;
      if (userData.preferences && userData.preferences.showTutorialPrompt) {
        showTutorialModal(uid);
      }
    } else {
      state.avatarId = 1;
    }
  } catch (e) {
    console.warn("Error al buscar preferencias del usuario:", e);
    state.avatarId = 1;
  }
}

/* ---------- Guía de Aventura (Tutorial) ---------- */
function showTutorialModal(uid) {
  // Evitar duplicados del modal
  if (document.querySelector("#tutorial-root")) return;

  const root = el("div", { class: "pt-overlay", id: "tutorial-root" });
  const modal = el("div", {
    class: "pt-sheet",
    style: {
      maxWidth: '380px',
      textAlign: 'center',
      padding: '24px',
      borderRadius: '8px',
      border: '3px solid var(--accent)',
      boxShadow: '0 8px 0 rgba(0,0,0,0.4)'
    }
  }, [
    el("h2", { class: "pt-pixel", style: { fontSize: '10px', color: 'var(--accent)', marginBottom: '16px' } }, "⚔️ NUEVA AVENTURA ⚔️"),
    el("p", { style: { fontSize: '14.5px', lineHeight: '1.6', marginBottom: '24px', color: 'var(--text-primary)' } },
      "¿Deseas iniciar la Guía de Aventura para aprender a dominar tus misiones, o prefieres comenzar tu viaje solo?"
    ),
    el("div", { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
      el("button", {
        class: "pt-save",
        style: { width: '100%' },
        onclick: async () => {
          await startAdventureGuide(uid);
          root.remove();
        }
      }, "INICIAR GUÍA"),
      el("button", {
        class: "pt-cancel",
        style: { width: '100%' },
        onclick: async () => {
          await skipAdventureGuide(uid);
          root.remove();
        }
      }, "SALTAR TUTORIAL")
    ])
  ]);

  root.append(modal);
  document.body.append(root);
}

async function markTutorialSeen(uid) {
  const db = initFirebase();
  if (!db) return;
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      preferences: { showTutorialPrompt: false }
    }, { merge: true });
  } catch (e) {
    console.error("Error al actualizar estado del tutorial:", e);
  }
}

async function startAdventureGuide(uid) {
  const tutorials = [
    { id: "tut-1", type: "tarea", category: "Personal", priority: "alta", title: "🛡️ Crea tu primera misión", detail: "Presiona el botón '+' de abajo para crear una nueva misión.", done: false },
    { id: "tut-2", type: "tarea", category: "Personal", priority: "media", title: "🧭 Desliza esta tarjeta", detail: "Desliza esta tarjeta hacia la derecha para completarla, o a la izquierda para borrarla.", done: false },
    { id: "tut-3", type: "tarea", category: "Personal", priority: "baja", title: "🔮 Cambia tu Skin en Perfil", detail: "Ve a la pestaña Perfil (👤) y elige un nuevo color de tema.", done: false },
    { id: "tut-4", type: "tarea", category: "Personal", priority: "media", title: "🤝 Conéctate con un aliado", detail: "Crea o únete a un tablero colaborativo en la pestaña Tableros (🤝).", done: false }
  ];

  for (const item of tutorials) {
    const formattedItem = createItem({ ...item, owner: "Guía de Aventura" });
    await saveUserItem(uid, formattedItem);
  }

  await markTutorialSeen(uid);
}

async function skipAdventureGuide(uid) {
  await markTutorialSeen(uid);
}

/* ---------- Vista de Perfil ---------- */
export function renderProfileView(container) {
  container.innerHTML = "";

  const title = el("h2", { class: "pt-pixel", style: { fontSize: '11px', color: 'var(--accent)', marginBottom: '14px' } }, "PERFIL DEL AVENTURERO");

  const personalMissions = state.items.filter(i => i.type !== "nota");
  const completedCount = personalMissions.filter(i => i.done).length;

  // Cargar imagen de avatar seleccionada
  const avatarSrc = `./icons/avatar-${state.avatarId || 1}.png`;

  const hero = el("div", { class: "pt-profile-hero" }, [
    el("img", { class: "pt-avatar", src: avatarSrc, alt: "Avatar" }),
    el("div", { class: "pt-profile-name" }, state.syncNickname),
    el("div", { class: "pt-profile-email" }, state.user.email || "Registro local")
  ]);

  const stats = el("div", { class: "pt-stats-row" }, [
    createStatCard(String(completedCount), "Hechas"),
    createStatCard(String(state.items.length), "Misiones"),
    createStatCard(state.activeBoardId ? "Sync" : "Local", "Modo")
  ]);

  // Contenedor del Selector de Avatares (10 personajes pixel-art)
  const avatarSec = el("div", { class: "pt-profile-hero", style: { gap: '14px', alignItems: 'stretch' } }, [
    el("div", { class: "pt-stat-label", style: { textAlign: 'center' } }, "Selección de Avatar"),
    el("div", { class: "pt-theme-grid", style: { gridTemplateColumns: 'repeat(5, 1fr)' } },
      Array.from({ length: 10 }).map((_, idx) => {
        const id = idx + 1;
        const isActive = (state.avatarId || 1) === id;
        return el("button", {
          class: "pt-avatar-option" + (isActive ? " active" : ""),
          onclick: async () => {
            state.avatarId = id;
            // Guardar en Firestore
            const db = initFirebase();
            if (db && state.user) {
              const userRef = doc(db, "users", state.user.uid);
              await setDoc(userRef, {
                preferences: { avatarId: id }
              }, { merge: true });
            }
            ui.render();
          }
        }, [
          el("img", { src: `./icons/avatar-${id}.png` })
        ]);
      })
    )
  ]);

  // Contenedor de Temas
  const activeThemeId = document.body.className.replace('theme-', '') || 'fogata';

  const themeSec = el("div", { class: "pt-profile-hero", style: { gap: '14px', alignItems: 'stretch' } }, [
    el("div", { class: "pt-stat-label", style: { textAlign: 'center' } }, "Selección de Skin / Tema"),
    el("div", { class: "pt-theme-grid" },
      THEMES.map((theme) => {
        const isActive = activeThemeId === theme.id;
        return el("button", {
          class: "pt-theme-dot" + (isActive ? " active" : ""),
          style: { background: theme.bg },
          onclick: async () => {
            await changeTheme(theme.id, setMeta);
            ui.render();
          }
        }, theme.emoji);
      })
    )
  ]);

  const actions = el("div", { class: "pt-settings-list" }, [
    el("button", {
      class: "pt-settings-item danger",
      style: { width: '100%' },
      onclick: async () => {
        if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
          await logout();
        }
      }
    }, [
      el("span", { class: "pt-settings-icon", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" style="width: 18px; height: 18px; color: var(--red);"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>` }),
      el("span", {}, "Cerrar Sesión")
    ]),
    el("button", {
      class: "pt-settings-item danger",
      style: { width: '100%' },
      onclick: () => handleDeleteAccount(),
    }, [
      el("span", { class: "pt-settings-icon", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" style="width: 18px; height: 18px; color: var(--red);"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>` }),
      el("span", {}, "Eliminar mi Cuenta")
    ])
  ]);

  container.append(title, hero, stats, avatarSec, themeSec, actions);
}

/* ---------- Eliminación de cuenta (requisito de Google Play) ---------- */
async function handleDeleteAccount() {
  if (!state.user) return;
  if (!navigator.onLine) {
    showToast("⚠️ Necesitas conexión a internet para eliminar tu cuenta.");
    return;
  }

  const aviso = confirm(
    "⚠️ ELIMINAR CUENTA\n\n" +
    "Se borrarán PERMANENTEMENTE tu cuenta, todas tus misiones, tu perfil " +
    "y tus preferencias. Esta acción no se puede deshacer.\n\n¿Continuar?"
  );
  if (!aviso) return;

  const escrito = prompt('Para confirmar, escribe: ELIMINAR');
  if ((escrito || "").trim().toUpperCase() !== "ELIMINAR") {
    showToast("Eliminación cancelada.");
    return;
  }

  showToast("Eliminando tu cuenta...");

  // 1. Borrar datos de Firestore (requiere la sesión aún activa)
  const dataOk = await deleteAllUserData(state.user.uid);
  if (!dataOk) {
    showToast("⚠️ No se pudieron borrar los datos. Revisa tu conexión e inténtalo de nuevo.");
    return;
  }

  // 2. Borrar la cuenta de autenticación. watchAuthState detectará el
  //    cierre de sesión y llevará a la pantalla de login.
  const { error } = await deleteAccount();
  if (error) {
    showToast(`⚠️ ${error}`);
    return;
  }
  showToast("Tu cuenta fue eliminada. ¡Buen viaje, aventurero! ✦");
}

function createStatCard(value, label) {
  return el("div", { class: "pt-stat-card" }, [
    el("div", { class: "pt-stat-value" }, value),
    el("div", { class: "pt-stat-label" }, label)
  ]);
}
