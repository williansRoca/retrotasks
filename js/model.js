/* ============================================================
 * model.js — Definiciones y logica pura de RetroTasks
 *
 * "Logica pura" = funciones que no tocan el DOM ni la base de
 * datos. Reciben datos y devuelven datos. Esto las hace faciles
 * de probar y de reutilizar el dia que haya backend.
 * ============================================================ */

export const TYPES = [
  { id: "tarea", label: "Tarea" },
  { id: "nota", label: "Nota" },
  { id: "recordatorio", label: "Recordatorio" },
];

export const PRIORITIES = [
  { id: "baja", label: "Baja", color: "#5BA84F" },
  { id: "media", label: "Media", color: "#E0A02E" },
  { id: "alta", label: "Alta", color: "#D94343" },
];

export const REPEATS = [
  { id: "no", label: "No repetir" },
  { id: "diaria", label: "Diaria" },
  { id: "semanal", label: "Semanal" },
  { id: "mensual", label: "Mensual" },
];

export const DEFAULT_CATEGORIES = [
  { name: "Hogar", color: "#3FA34D" },
  { name: "Trabajo", color: "#3E7CDA" },
  { name: "Personal", color: "#E08A2E" },
];

export const PALETTE = ["#3FA34D", "#3E7CDA", "#E08A2E", "#8B5FBF", "#D94F70", "#2FA89B"];

// ID local. NOTA cooperativa: cuando exista backend, el servidor
// asignara IDs globales. Este prefijo "local-" ayuda a distinguir
// items aun no sincronizados.
export function makeId() {
  return "local-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ------------------------------------------------------------
 * FABRICA DE ITEMS — un solo lugar que define la forma del dato.
 * Los campos cooperativos van aqui desde ya (aunque no se usen):
 * cambiar la estructura con la app en uso es costoso; preverla
 * ahora es barato.
 * ------------------------------------------------------------ */
export function createItem(data) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    type: data.type || "tarea",
    category: data.category || "Personal",
    priority: data.priority || "media",
    title: (data.title || "").trim(),
    detail: (data.detail || "").trim(),
    due: data.due || "",
    repeat: data.repeat || "no",
    preAlert: data.preAlert || "no", // minutos de aviso previo: no|10|30|60|1440
    done: false,
    createdAt: now,
    updatedAt: now,

    // --- Campos preparados para COOPERACION (aun sin uso) ---
    owner: data.owner || "local-user", // quien creo el item
    sharedWith: [], // lista de usuarios con acceso (futuro)
    syncStatus: "local", // local | synced | pending | conflict
  };
}

// Toda modificacion pasa por aqui para mantener updatedAt y
// marcar el item como "pendiente de sincronizar" (futuro).
export function touchItem(item, changes) {
  return {
    ...item,
    ...changes,
    updatedAt: new Date().toISOString(),
    syncStatus: item.syncStatus === "synced" ? "pending" : item.syncStatus,
  };
}

/* ---------- Helpers de fecha ---------- */

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const hasTime = iso.includes("T");
  const base = `${d.getDate()} ${MESES[d.getMonth()]}`;
  if (!hasTime) return base;
  return `${base} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Avanza una fecha al siguiente ciclo (tareas recurrentes, opcion B).
export function nextDate(iso, freq) {
  if (!iso) return iso;
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  if (freq === "diaria") d.setDate(d.getDate() + 1);
  else if (freq === "semanal") d.setDate(d.getDate() + 7);
  else if (freq === "mensual") d.setMonth(d.getMonth() + 1);
  else return iso;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Estado de vencimiento calculado (no se guarda, se deriva).
export function dueStatus(iso, done) {
  if (!iso || done) return null;
  const now = new Date();
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startDue - startToday) / 86400000);
  if (d < now && diffDays < 0) return { id: "vencido", label: "Vencido", color: "#C0392B" };
  if (diffDays <= 0) return { id: "hoy", label: "Hoy", color: "#D97A1E" };
  if (diffDays <= 2) return { id: "pronto", label: "Pronto", color: "#3E7CDA" };
  return { id: "futuro", label: fmtDate(iso), color: "#5C7A4A" };
}

// Determina si un item entra en el alcance temporal elegido.
export function inScope(item, scope) {
  if (scope === "todo") return true;
  if (scope === "sinfecha") return !item.due;
  if (!item.due) return false;
  const d = new Date(item.due);
  if (isNaN(d)) return false;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((dueDay - start) / 86400000);
  if (scope === "hoy") return diff <= 0;
  if (scope === "semana") return diff <= 7;
  return true;
}

// Ordena: pendientes antes que hechas, luego por urgencia de fecha.
export function sortItems(items) {
  const rank = (it) => {
    const s = dueStatus(it.due, it.done);
    if (!s) return 5;
    return { vencido: 0, hoy: 1, pronto: 2, futuro: 3 }[s.id] ?? 5;
  };
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}
