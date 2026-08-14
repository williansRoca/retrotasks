/* ============================================================
 * local-alarms.js — Notificaciones locales programadas (Android)
 *
 * Programa una notificación de sistema para la fecha límite de
 * cada misión pendiente, usando @capacitor/local-notifications.
 * Suenan aunque la app esté cerrada — a diferencia del chequeo
 * de 30s de alarms.js, que solo vive mientras la app está abierta
 * (ese se mantiene para el aviso en primer plano con toast).
 *
 * Estrategia: cada vez que cambia la lista de items (snapshot de
 * Firestore), se cancela todo lo programado y se reprograma según
 * el estado actual. Es simple, idempotente y cubre creación,
 * edición, completado, eliminación y cambios hechos por
 * colaboradores u otros dispositivos. Con listas de tareas
 * domésticas (decenas de items) el costo es despreciable.
 *
 * En Web el plugin no existe: este módulo se convierte en no-op.
 * ============================================================ */

import { scheduleNativeAlarm, cancelNativeAlarm, hasNativeAlarm } from "./native-alarm.js";

const hasPlugin = () =>
  window.Capacitor && window.Capacitor.isPluginAvailable("LocalNotifications");

// Recuerda qué ids de alarma nativa se programaron, para cancelarlos
// al reprogramar (misiones completadas, borradas, archivadas, etc.).
function loadNativeIds() {
  try { return JSON.parse(localStorage.getItem("rt-native-alarm-ids") || "[]"); }
  catch { return []; }
}
function saveNativeIds(ids) {
  try { localStorage.setItem("rt-native-alarm-ids", JSON.stringify(ids)); } catch {}
}

// El id de notificación de Android es un entero de 32 bits; los ids
// de items son strings. Hash FNV-1a acotado a int31 positivo.
function numericId(strId) {
  let h = 0x811c9dc5;
  for (let i = 0; i < strId.length; i++) {
    h ^= strId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1; // positivo y nunca 0
}

// IDs de canales de notificación (Android). Una vez creado un canal,
// su importancia y sonido los controla el usuario en Ajustes.
const CH_DEFAULT = "rt_reminders";
const CH_ALARM = "rt_alarm";

let permissionGranted = null; // cache de permiso dentro de la sesión
let channelsReady = false;

// Crea los canales: uno normal y uno tipo alarma (alta prioridad,
// sonido de alarma y vibración insistente).
async function ensureChannels(LN) {
  if (channelsReady || typeof LN.createChannel !== "function") return;
  try {
    await LN.createChannel({
      id: CH_DEFAULT, name: "Recordatorios",
      description: "Avisos de vencimiento de misiones",
      importance: 4, vibration: true, visibility: 1,
    });
    await LN.createChannel({
      id: CH_ALARM, name: "Alarmas de misiones",
      description: "Avisos importantes con sonido de alarma",
      importance: 5, sound: "alarm", vibration: true, visibility: 1, lights: true,
    });
    channelsReady = true;
  } catch (e) {
    console.warn("No se pudieron crear los canales de notificación:", e);
  }
}

async function ensurePermission(LN) {
  if (permissionGranted !== null) return permissionGranted;
  let perm = await LN.checkPermissions();
  if (perm.display !== "granted") {
    perm = await LN.requestPermissions();
  }
  permissionGranted = perm.display === "granted";
  return permissionGranted;
}

/* Android 12+ difiere las alarmas "inexactas" hasta 1-2 horas para
 * ahorrar batería. Para que el recordatorio suene puntual hace falta
 * el acceso especial "Alarmas y recordatorios" (SCHEDULE_EXACT_ALARM,
 * ya declarado en AndroidManifest). En Android 14+ viene denegado por
 * defecto: se lo pedimos al usuario UNA sola vez, con opción de abrir
 * la pantalla de ajustes del sistema. */
async function ensureExactAlarms(LN) {
  if (typeof LN.checkExactNotificationSetting !== "function") return;
  try {
    const { exact_alarm } = await LN.checkExactNotificationSetting();
    if (exact_alarm === "granted") return;

    const yaPreguntado = localStorage.getItem("rt-exact-alarm-asked");
    if (yaPreguntado) return; // no insistir; quedará en modo inexacto
    localStorage.setItem("rt-exact-alarm-asked", "1");

    const abrir = confirm(
      "Para que los recordatorios de misiones suenen a la hora exacta, " +
      "RetroTasks necesita el permiso \"Alarmas y recordatorios\".\n\n" +
      "¿Abrir los ajustes para activarlo?"
    );
    if (abrir) {
      await LN.changeExactNotificationSetting();
    }
  } catch (e) {
    console.warn("No se pudo verificar el permiso de alarmas exactas:", e);
  }
}

// Reprograma todas las alarmas según la lista actual de items.
async function syncLocalAlarms(items) {
  if (!hasPlugin()) return;
  const LN = window.Capacitor.Plugins.LocalNotifications;

  try {
    if (!(await ensurePermission(LN))) return;
    await ensureChannels(LN);
    await ensureExactAlarms(LN);

    // Cancelar todo lo pendiente (reprogramación total idempotente)
    const pending = await LN.getPending();
    if (pending.notifications && pending.notifications.length) {
      await LN.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }

    // Programar las misiones pendientes con fecha límite futura.
    // Cada misión puede generar hasta 2 notificaciones: el aviso
    // previo (si está configurado) y la del vencimiento.
    const now = Date.now();
    const etiquetaPrevio = { "10": "10 minutos", "30": "30 minutos", "60": "1 hora", "1440": "1 día" };

    // Cancelar las alarmas nativas programadas antes (reprogramación total)
    const prevNativeIds = loadNativeIds();
    if (hasNativeAlarm()) {
      for (const nid of prevNativeIds) await cancelNativeAlarm(nid);
    }
    const nuevasNativeIds = [];

    const notifications = [];
    const candidatas = items
      .filter((i) => i.type !== "nota" && i.due && !i.done && !i.archived)
      .map((i) => ({ item: i, at: new Date(i.due).getTime() }))
      .filter(({ at }) => !isNaN(at) && at > now)
      .sort((a, b) => a.at - b.at)
      .slice(0, 30); // margen prudente frente a límites del sistema

    for (const { item, at } of candidatas) {
      // Alarma real (pantalla completa) si el equipo lo soporta; si no,
      // se usa el canal de alta prioridad como respaldo.
      const esAlarma = item.alarm === true;
      const usarNativa = esAlarma && hasNativeAlarm();

      // Aviso previo: siempre como notificación normal
      const preMin = parseInt(item.preAlert, 10);
      if (preMin > 0) {
        const preAt = at - preMin * 60000;
        if (preAt > now) {
          notifications.push({
            id: numericId(item.id + "::pre"),
            title: esAlarma ? "⏰ RetroTasks: ¡Misión próxima!" : "⏳ RetroTasks: Misión próxima",
            body: `"${item.title}" vence en ${etiquetaPrevio[item.preAlert] || `${preMin} min`}.`,
            schedule: { at: new Date(preAt), allowWhileIdle: true },
            channelId: esAlarma ? CH_ALARM : CH_DEFAULT,
          });
        }
      }

      // Vencimiento
      if (usarNativa) {
        const nid = numericId(item.id);
        await scheduleNativeAlarm(nid, at, item.title);
        nuevasNativeIds.push(nid);
      } else {
        notifications.push({
          id: numericId(item.id),
          title: esAlarma ? "⏰ RetroTasks: ¡ALARMA DE MISIÓN!" : "🚨 RetroTasks: Misión por vencer",
          body: `¡El tiempo límite para "${item.title}" ha llegado!`,
          schedule: { at: new Date(at), allowWhileIdle: true },
          channelId: esAlarma ? CH_ALARM : CH_DEFAULT,
        });
      }
    }

    saveNativeIds(nuevasNativeIds);

    if (notifications.length) {
      await LN.schedule({ notifications });
    }
  } catch (e) {
    console.warn("No se pudieron programar las alarmas locales:", e);
  }
}

// Versión con debounce: los snapshots de Firestore pueden llegar en
// ráfaga (p. ej. al conectar); reprogramamos una sola vez al final.
let _syncTimer = null;
export function scheduleLocalAlarms(items) {
  if (!hasPlugin()) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => syncLocalAlarms(items), 1500);
}
