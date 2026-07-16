/* ============================================================
 * alarms.js — Alarmas de vencimiento de misiones
 *
 * Cada 30 segundos revisa las tareas con fecha límite vencida y
 * sin completar, y notifica una sola vez por tarea (el registro
 * de notificadas persiste en IndexedDB).
 * ============================================================ */

import { state } from "./state.js";
import { getMeta, setMeta } from "./db.js";
import { notifyEvent, sendDesktopNotification } from "./ui/notify.js";

let notifiedTasks = new Set();

export async function initAlarms() {
  const savedNotified = await getMeta("notifiedTasks", []);
  notifiedTasks = new Set(savedNotified);

  // Revisar tareas cada 30 segundos
  setInterval(() => {
    checkDueTasks();
  }, 30000);
}

async function checkDueTasks() {
  if (state.items.length === 0) return;
  const now = new Date();

  state.items.forEach(async (item) => {
    if (item.type !== "nota" && item.due && !item.done) {
      const dueDate = new Date(item.due);
      if (dueDate <= now && !notifiedTasks.has(item.id)) {
        notifiedTasks.add(item.id);
        await setMeta("notifiedTasks", Array.from(notifiedTasks));

        // Notificación visual y sonido en la app
        notifyEvent("🚨 Misión Expirada", `¡El tiempo límite para "${item.title}" ha terminado!`, "delete");

        // Notificación de sistema (Android)
        sendDesktopNotification("🚨 RetroTasks: Misión Expirada", `¡El tiempo límite para "${item.title}" ha expirado!`);
      }
    }
  });
}
