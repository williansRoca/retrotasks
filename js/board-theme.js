/* ============================================================
 * board-theme.js — Identidad visual de cada tablero
 *
 * Cada espacio de trabajo (el personal y cada tablero compartido)
 * tiene un color y un ícono propios. Mientras estás dentro de un
 * tablero, su color REEMPLAZA el acento del tema: botones, barra de
 * progreso, títulos y franjas lo adoptan. Así es imposible confundir
 * en qué tablero estás sin tener que leer el nombre.
 *
 * De dónde sale el color de un tablero, por orden de prioridad:
 *   1. El que el usuario eligió para sí mismo (users/{uid}.boards).
 *   2. El que definió quien creó el tablero (boards/{id}), copiado
 *      a la membresía al crear o al unirse.
 *   3. Uno derivado del código del tablero (mismo código → mismo
 *      color), para que nunca falte identidad aunque no se configure.
 * ============================================================ */

// 12 colores bien diferenciados entre sí (con 10 tableros posibles,
// la paleta de categorías de 6 se quedaba corta).
export const BOARD_COLORS = [
  { id: "rosa",     hex: "#D4537E", label: "Rosa" },
  { id: "rojo",     hex: "#D94343", label: "Rojo" },
  { id: "naranja",  hex: "#E0762E", label: "Naranja" },
  { id: "ambar",    hex: "#E0A02E", label: "Ámbar" },
  { id: "oliva",    hex: "#9BA83C", label: "Oliva" },
  { id: "verde",    hex: "#5BA84F", label: "Verde" },
  { id: "menta",    hex: "#3FB58F", label: "Menta" },
  { id: "cian",     hex: "#3FA3B5", label: "Cian" },
  { id: "azul",     hex: "#4A8FD4", label: "Azul" },
  { id: "indigo",   hex: "#6B72CC", label: "Índigo" },
  { id: "violeta",  hex: "#9B5FCF", label: "Violeta" },
  { id: "arena",    hex: "#B08A5F", label: "Arena" },
];

/* Íconos elegibles para un tablero. Son NOMBRES del catálogo
 * vectorial (js/ui/icons.js), no emojis: así siguen el estilo del
 * resto de la interfaz y heredan el color del tablero. */
export const BOARD_ICONS = [
  "board_team", "board_home", "board_work", "board_study",
  "board_gym", "board_shop", "board_travel", "board_game",
  "board_music", "board_pet", "board_plant", "board_star",
];

// Ícono del espacio personal (usa el acento del tema, no un color propio)
export const PERSONAL_ICON = "folder";

/* ---------- Utilidades de color ---------- */

// Oscurece un hex un porcentaje dado (para el borde/sombra del acento)
function darken(hex, amount = 0.25) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/* Hash FNV-1a: distribuye mucho mejor que un hash polinómico simple
 * con cadenas cortas y parecidas (todos los códigos empiezan por "RT-").
 * `salt` permite derivar dos valores distintos del mismo id. */
function hash(str, salt = 0) {
  let h = (0x811c9dc5 ^ salt) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Color derivado del código del tablero: mismo código → mismo color.
export function colorFromId(boardId) {
  return BOARD_COLORS[hash(boardId, 7) % BOARD_COLORS.length].hex;
}

export function iconFromId(boardId) {
  return BOARD_ICONS[hash(boardId, 42) % BOARD_ICONS.length];
}

/* Elige un color para un tablero nuevo evitando los que el usuario
 * ya usa. Con 12 colores y hasta 10 tableros siempre queda alguno
 * libre; si se agotaran, se cae al derivado del código. */
export function pickFreeColor(boardId, usedColors = []) {
  const preferido = colorFromId(boardId);
  if (!usedColors.includes(preferido)) return preferido;
  const libre = BOARD_COLORS.find((c) => !usedColors.includes(c.hex));
  return libre ? libre.hex : preferido;
}

/* ---------- Resolución de la identidad de un espacio ---------- */

/* Devuelve { color, icon } del espacio activo (board = null → personal).
 * `icon` es siempre un NOMBRE del catálogo vectorial.
 *
 * Retrocompatibilidad: las primeras versiones guardaban un emoji en
 * este campo. Si lo guardado no es un ícono conocido, se ignora y se
 * usa el derivado del código del tablero. */
export function boardStyle(board) {
  if (!board) return { color: null, icon: PERSONAL_ICON };
  const guardado = board.icon;
  const valido = typeof guardado === "string" && BOARD_ICONS.includes(guardado);
  return {
    color: board.color || colorFromId(board.id),
    icon: valido ? guardado : iconFromId(board.id),
  };
}

/* ---------- Aplicación del acento ---------- */

/* Aplica el color del tablero como acento de la interfaz.
 * color = null → quita la sobrescritura y vuelve al acento del tema
 * elegido por el usuario (fogata, helada, sobrio…). */
export function applyBoardAccent(color) {
  const s = document.body.style;
  if (!color) {
    s.removeProperty("--accent");
    s.removeProperty("--accent-dim");
    s.removeProperty("--accent-glow");
    document.body.classList.remove("board-accented");
    return;
  }
  s.setProperty("--accent", color);
  s.setProperty("--accent-dim", darken(color, 0.3));
  s.setProperty("--accent-glow", rgba(color, 0.22));
  document.body.classList.add("board-accented");
}
