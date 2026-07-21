/* ============================================================
 * ui/profile.js — Pestaña Perfil: avatar, temas, estadísticas,
 * configuración, guía y cierre de sesión.
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { setMeta } from "../db.js";

import { THEMES, changeTheme } from "../theme.js";
import { logout, deleteAccount } from "../auth.js";
import { initFirebase, deleteAllUserData } from "../firebase.js";

import { doc, setDoc, getDoc } from "../vendor/firebase-firestore.js";
import { el, showToast } from "./dom.js";
import { openSettings } from "./settings.js";
import { openGuide } from "./guide.js";

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
      // Primer inicio: mostrar la guía de bienvenida automáticamente
      if (userData.preferences && userData.preferences.showTutorialPrompt) {
        openGuide({ firstRun: true, uid });
      }
    } else {
      state.avatarId = 1;
    }
  } catch (e) {
    console.warn("Error al buscar preferencias del usuario:", e);
    state.avatarId = 1;
  }
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
      class: "pt-settings-item",
      style: { width: '100%' },
      onclick: () => openGuide(),
    }, [
      el("span", { class: "pt-settings-icon", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" style="width: 18px; height: 18px; color: var(--accent);"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17"/></svg>` }),
      el("span", {}, "Cómo usar la app")
    ]),
    el("button", {
      class: "pt-settings-item",
      style: { width: '100%' },
      onclick: () => openSettings(),
    }, [
      el("span", { class: "pt-settings-icon", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" style="width: 18px; height: 18px; color: var(--accent);"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>` }),
      el("span", {}, "Configuración")
    ]),
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
