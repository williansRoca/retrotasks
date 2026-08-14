/* Íconos pixel-art de RetroTasks.
 *
 * Cada ícono se define como un mapa de 12x12 celdas ("X" = píxel encendido,
 * "." = transparente). El render escala cada celda a un bloque de 2x2 sobre un
 * lienzo de 24x24, de modo que el "grosor de trazo" natural es de 2 px y las
 * líneas quedan nítidas con shape-rendering="crispEdges".
 *
 * Todos heredan `currentColor`, así que toman el --accent / --red / etc. del
 * tema activo. Uso:
 *
 *   import { icon } from "./icons.js";
 *   el("button", { html: icon("trash") }, ...)
 *   el("span", { html: icon("check", { size: 16 }) })
 *
 * Grupo actual: ACCIÓN (grupo 1 del inventario ICONOS.md).
 */

const CELL = 2;          // px por celda (=> trazo de 2 px)
const GRID = 12;         // celdas por lado
const VIEW = GRID * CELL; // 24

/* ---- Mapas 12x12 (grupo ACCIÓN) ------------------------------------------ */

const MAPS = {
  /* Eliminar — cesto de basura con tapa, asa y ranuras verticales */
  trash: [
    "............",
    "...XXXXXX...",
    ".XXXXXXXXXX.",
    "............",
    "..XXXXXXXX..",
    "..X.X..X.X..",
    "..X.X..X.X..",
    "..X.X..X.X..",
    "..X.X..X.X..",
    "..X.X..X.X..",
    "..XXXXXXXX..",
    "............",
  ],

  /* Archivar — caja de archivo: tapa ancha + cuerpo con ranura */
  archive: [
    "............",
    ".XXXXXXXXXX.",
    ".X........X.",
    ".XXXXXXXXXX.",
    "..X......X..",
    "..X.XXXX.X..",
    "..X......X..",
    "..X......X..",
    "..X......X..",
    "..XXXXXXXX..",
    "............",
    "............",
  ],

  /* Restaurar — flecha circular antihoraria con punta triangular */
  restore: [
    "............",
    ".....XXXX...",
    ".........X..",
    "..X.......X.",
    ".XX.......X.",
    "XXX.......X.",
    ".XX.......X.",
    "..X.......X.",
    "...X.....X..",
    "....X...X...",
    ".....XXX....",
    "............",
  ],

  /* Completar — palomita gruesa */
  check: [
    "............",
    "..........X.",
    ".........XX.",
    "........XX..",
    ".X.....XX...",
    ".XX...XX....",
    "..XX.XX.....",
    "...XXX......",
    "....X.......",
    "............",
    "............",
    "............",
  ],

  /* Cerrar / cancelar — aspa */
  close: [
    "............",
    ".X........X.",
    ".XX......XX.",
    "..XX....XX..",
    "...XX..XX...",
    "....XXXX....",
    "....XXXX....",
    "...XX..XX...",
    "..XX....XX..",
    ".XX......XX.",
    ".X........X.",
    "............",
  ],

  /* Filtros / ajustes — engranaje simétrico con hueco central */
  gear: [
    ".....XX.....",
    ".....XX.....",
    "...XXXXXX...",
    "..XX....XX..",
    "XXX......XXX",
    "XX........XX",
    "XX........XX",
    "XXX......XXX",
    "..XX....XX..",
    "...XXXXXX...",
    ".....XX.....",
    ".....XX.....",
  ],

  /* Se repite — bucle circular horario con punta triangular (badge recurrente) */
  repeat: [
    "............",
    "...XXXX.....",
    "..X.........",
    ".X.......X..",
    ".X.......XX.",
    ".X.......XXX",
    ".X.......XX.",
    ".X.......X..",
    "..X.....X...",
    "...X...X....",
    "....XXX.....",
    "............",
  ],

  /* Alarma sonora — reloj despertador con campanas y patas */
  alarm: [
    "..X......X..",
    ".XX......XX.",
    "..XXXXXXXX..",
    ".X........X.",
    "X....X....X.",
    "X....X....X.",
    "X....XX...X.",
    "X.........X.",
    ".X........X.",
    "..XXXXXXXX..",
    "..X......X..",
    ".X........X.",
  ],

  /* Notificación — campana */
  bell: [
    "....XX......",
    "....XX......",
    "...XXXX.....",
    "..XX..XX....",
    "..X....X....",
    ".X......X...",
    ".X......X...",
    "X........X..",
    "XXXXXXXXXX..",
    "....XX......",
    "...XXXX.....",
    "............",
  ],

  /* Autor / propietario — busto (cabeza + hombros) */
  user: [
    "....XXXX....",
    "...X....X...",
    "...X....X...",
    "...X....X...",
    "....XXXX....",
    "............",
    "..XXXXXXXX..",
    ".X........X.",
    "X..........X",
    "X..........X",
    "............",
    "............",
  ],
};

/* ---- Render --------------------------------------------------------------- */

function toRects(map) {
  let rects = "";
  map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "X") {
        rects += `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}"/>`;
      }
    });
  });
  return rects;
}

/**
 * Devuelve el SVG (string) de un ícono de acción.
 * @param {string} name  clave de MAPS (trash, archive, restore, check, close,
 *                        gear, repeat, alarm, bell, user)
 * @param {object} [opts]
 * @param {number} [opts.size=24]   tamaño en px del cuadro
 * @param {string} [opts.cls=""]    clases CSS extra
 * @param {string} [opts.title]     título accesible (aria-label + <title>)
 */
export function icon(name, { size = 24, cls = "", title } = {}) {
  const map = MAPS[name];
  if (!map) return "";
  const a11y = title
    ? ` role="img" aria-label="${title}"`
    : ` aria-hidden="true"`;
  const titleEl = title ? `<title>${title}</title>` : "";
  const classAttr = cls ? ` class="${cls}"` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}"` +
    ` width="${size}" height="${size}" fill="currentColor"` +
    ` shape-rendering="crispEdges"${classAttr}${a11y}>${titleEl}${toRects(map)}</svg>`
  );
}

/** Nombres disponibles (útil para previsualizar / iterar). */
export const iconNames = Object.keys(MAPS);

/** Mapas crudos 12x12 (para herramientas de previsualización). */
export const iconMaps = MAPS;
