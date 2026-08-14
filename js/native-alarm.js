/* ============================================================
 * native-alarm.js — Puente con el plugin nativo AlarmScheduler
 *
 * Solo disponible en Android (app nativa). Programa alarmas REALES
 * a pantalla completa para las misiones marcadas como "alarma".
 * En web es un no-op.
 * ============================================================ */

let _plugin = null;
let _resolved = false;

// Obtiene el plugin nativo mediante la API oficial de Capacitor
// (registerPlugin), con respaldo al proxy Plugins. Solo en app nativa.
function plugin() {
  if (_resolved) return _plugin;
  _resolved = true;
  const C = window.Capacitor;
  if (!C || !(C.isNativePlatform && C.isNativePlatform())) { _plugin = null; return null; }
  try {
    if (typeof C.registerPlugin === "function") {
      _plugin = C.registerPlugin("AlarmScheduler");
    } else if (C.Plugins && C.Plugins.AlarmScheduler) {
      _plugin = C.Plugins.AlarmScheduler;
    }
  } catch (e) {
    console.warn("No se pudo obtener el plugin AlarmScheduler:", e);
    _plugin = null;
  }
  return _plugin;
}

export function hasNativeAlarm() {
  return !!plugin();
}

export async function scheduleNativeAlarm(id, atMs, title) {
  const p = plugin();
  if (!p) return;
  try {
    await p.schedule({ id, at: atMs, title: title || "Misión" });
  } catch (e) {
    console.warn("No se pudo programar la alarma nativa:", e);
  }
}

export async function cancelNativeAlarm(id) {
  const p = plugin();
  if (!p) return;
  try {
    await p.cancel({ id });
  } catch (e) {
    console.warn("No se pudo cancelar la alarma nativa:", e);
  }
}
