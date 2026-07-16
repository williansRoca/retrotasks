/* ============================================================
 * ui/notify.js — Notificaciones locales y detección de cambios
 *
 * Todo lo que "avisa" al usuario: toasts con historial en la
 * pestaña Alertas, notificaciones del sistema, y la comparación
 * de snapshots del tablero cooperativo para anunciar cambios
 * hechos por otros colaboradores.
 * ============================================================ */

import { state } from "../state.js";
import { setMeta } from "../db.js";
import { sfx, showToast } from "./dom.js";
import { ui } from "../bus.js";

export function sendDesktopNotification(title, message) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body: message,
            icon: "./icons/icon-192.png",
            badge: "./icons/icon-192.png",
            vibrate: [200, 100, 200]
          });
        });
      } else {
        new Notification(title, {
          body: message,
          icon: "./icons/icon-192.png"
        });
      }
    } catch (e) {
      console.warn("Error mostrando notificación de escritorio:", e);
    }
  }
}

export function notifyEvent(title, message, soundName = "notify") {
  sfx(soundName);
  showToast(message);
  // Guardar en alertas
  state.alerts.unshift({
    id: Date.now(),
    message,
    timestamp: new Date().toISOString()
  });
  setMeta("alerts", state.alerts);
}

export function detectAndNotifyChanges(oldItems, newItems) {
  const nickname = (state.syncNickname || "").trim().toLowerCase();

  // 1. Tareas creadas por otros
  const added = newItems.filter(n => !oldItems.some(o => o.id === n.id));
  added.forEach(item => {
    const creator = item.owner || "Alguien";
    if (creator.trim().toLowerCase() !== nickname) {
      notifyEvent("➕ Tarea nueva", `👤 ${creator} creó: "${item.title}"`, "create");
    }
  });

  // 2. Tareas eliminadas por otros
  const deleted = oldItems.filter(o => !newItems.some(n => n.id === o.id));
  deleted.forEach(item => {
    if (state.lastDeletedId !== item.id) {
      notifyEvent("🗑️ Tarea eliminada", `Se eliminó: "${item.title}"`, "delete");
    }
  });
  state.lastDeletedId = null;

  // 3. Tareas modificadas por otros
  newItems.forEach(n => {
    const o = oldItems.find(item => item.id === n.id);
    if (o) {
      const updater = n.lastUpdatedBy || n.owner || "Alguien";
      if (updater.trim().toLowerCase() !== nickname) {
        if (o.done !== n.done) {
          if (n.done) {
            notifyEvent("✅ Tarea completada", `👤 ${updater} completó: "${n.title}"`, "complete");
          } else {
            notifyEvent("🔄 Tarea reactivada", `👤 ${updater} desmarcó: "${n.title}"`);
          }
        } else if (o.updatedAt !== n.updatedAt) {
          notifyEvent("✏️ Tarea editada", `👤 ${updater} editó: "${n.title}"`);
        }
      }
    }
  });
}

// Función global para que notifications.js (FCM nativo) pueda
// mostrar toasts y registrar alertas cuando la app está en primer plano.
window.showLocalToast = (message) => {
  showToast(message);
  state.alerts.unshift({
    id: Date.now(),
    message,
    timestamp: new Date().toISOString()
  });
  setMeta("alerts", state.alerts);
  if (state.activeTab === "alerts") ui.render();
};
