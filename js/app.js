/* ============================================================
 * app.js — Punto de entrada de RetroTasks v2 (Retro Moderno)
 *
 * Tras la reestructuración, este archivo solo orquesta:
 *  - Carga de preferencias locales (IndexedDB) y tema visual.
 *  - Escucha del estado de autenticación (Firebase Auth).
 *  - Suscripciones a datos (personales o de tablero) vía store.js.
 *  - Notificaciones push nativas y alarmas de vencimiento.
 *
 * El resto vive en módulos:
 *  - state.js ..... estado global en memoria
 *  - bus.js ....... conexión render <-> datos sin imports circulares
 *  - store.js ..... ruta única de guardado/eliminación/suscripción
 *  - alarms.js .... alarmas de vencimiento
 *  - ui/dom.js .... helpers DOM, toasts y efectos
 *  - ui/shell.js .. cascarón (header + nav) y orquestación de render
 *  - ui/home.js ... lista de misiones, tarjetas swipe y filtros
 *  - ui/sheet.js .. formulario de crear/editar
 *  - ui/boards.js . pestaña tableros | ui/alerts.js . pestaña alertas
 *  - ui/profile.js  pestaña perfil, avatares y Guía de Aventura
 *  - ui/auth-screen.js  pantalla de login/registro
 * ============================================================ */

import { state } from "./state.js";
import { ui } from "./bus.js";
import { getMeta, getActiveBoardId } from "./db.js";
import { DEFAULT_CATEGORIES } from "./model.js";
import { initFirebase } from "./firebase.js";
import { watchAuthState } from "./auth.js";
import { initTheme } from "./theme.js";
import { initPushNotifications } from "./notifications.js";
import { initAlarms } from "./alarms.js";
import { setupUserItemsSubscription, setupBoardSubscription } from "./store.js";
import { render, renderShell } from "./ui/shell.js";
import { loadUserPreferences } from "./ui/profile.js";
import "./ui/notify.js"; // registra window.showLocalToast para FCM

// Conectar el bus: los módulos de datos repintan a través de estas funciones.
ui.render = render;
ui.renderShell = renderShell;

/* ---------- Inicialización de la aplicación ---------- */
async function init() {
  // Inicializar Firebase
  initFirebase();

  // Cargar preferencias guardadas localmente
  state.soundOn = await getMeta("soundOn", false);
  state.categories = await getMeta("categories", DEFAULT_CATEGORIES);
  state.activeBoardId = await getActiveBoardId();
  state.alerts = await getMeta("alerts", []);

  // Cargar e iniciar el tema visual seleccionado
  await initTheme(getMeta);

  // Escuchar cambios de autenticación
  watchAuthState(async (user) => {
    state.isAuthLoading = false;
    if (user) {
      state.user = user;
      state.syncNickname = user.displayName || "Aventurero";

      // Suscribirse a las tareas personales en Firestore
      setupUserItemsSubscription(user.uid);

      // Si hay un tablero compartido activo, suscribirse a él
      if (state.activeBoardId) {
        setupBoardSubscription(state.activeBoardId);
      }

      // Inicializar notificaciones push nativas si está en Android
      initPushNotifications(user.uid);

      // Inicializar alarmas de tareas
      initAlarms();

      // Preferencias remotas: avatar elegido y prompt de la Guía de Aventura
      await loadUserPreferences(user.uid);
    } else {
      // Limpiar estado y desuscribirse
      state.user = null;
      state.items = [];
      state.avatarId = 1;
      if (state.syncUnsubscribe) {
        state.syncUnsubscribe();
        state.syncUnsubscribe = null;
      }
      if (state.userItemsUnsubscribe) {
        state.userItemsUnsubscribe();
        state.userItemsUnsubscribe = null;
      }
    }
    renderShell();
    render();
  });
}

/* ---------- Arranque ---------- */
init();

// Re-renderizar al cambiar el tamaño de la ventana (responsive tablet/PC)
let _resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => { render(); }, 200);
});

// Gancho de desarrollo: permite inspeccionar y simular estado desde la
// consola del navegador en local (no se expone en producción).
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  window.__rt = { state, render, renderShell };
}
