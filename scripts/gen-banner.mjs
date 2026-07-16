/* Genera el Feature Graphic 1024x500 para Google Play en pixel-art,
 * con el ícono "destello" y una mini-fuente pixel 3x5/5x5 propia.
 * Salida: SVG (rasterizar luego con sharp a PNG).
 *
 * Uso: node scripts/gen-banner.mjs [salida.svg]
 */
import { writeFileSync } from "node:fs";

const GOLD = "#FFD24A", GOLD_D = "#C49A20", DARK = "#1A1208",
      SOFT = "#2D2010", CREAM = "#F5EDD4", GLOW = "#FFF6E0";

/* Mini-fuente pixel (5 filas, ancho variable) */
const FONT = {
  A: ["###","#.#","###","#.#","#.#"],
  D: ["##.","#.#","#.#","#.#","##."],
  E: ["###","#..","###","#..","###"],
  I: ["###",".#.",".#.",".#.","###"],
  K: ["#.#","#.#","##.","#.#","#.#"],
  M: ["#...#","##.##","#.#.#","#...#","#...#"],
  N: ["#..#","##.#","#.##","#..#","#..#"],
  O: ["###","#.#","#.#","#.#","###"],
  R: ["##.","#.#","##.","#.#","#.#"],
  S: ["###","#..","###","..#","###"],
  T: ["###",".#.",".#.",".#.",".#."],
  U: ["#.#","#.#","#.#","#.#","###"],
  Y: ["#.#","#.#",".#.",".#.",".#."],
  " ": ["..","..","..","..",".."],
};

/* Ícono destello (16x16, mismo mapa que gen-icons.mjs) */
const DESTELLO = [
  "................",
  "..W.............",
  ".WWW.......W....",
  "..W.........GG..",
  "...........GGG..",
  "..........GGGD..",
  ".........GGGD...",
  "..GG....GGGD....",
  "..GGG..GGGD.....",
  "..DGGGGGGD......",
  "...DGGGGD.......",
  "....DGGD....W...",
  ".....DD....WWW..",
  "..............W.",
  "....W...........",
  "................",
];
const ICON_PAL = { G: GOLD, D: GOLD_D, W: GLOW };

let rects = "";
const px = (x, y, w, h, fill) => { rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`; };

/* Fondo */
px(0, 0, 1024, 500, DARK);
// Patrón sutil de puntos
for (let y = 20; y < 500; y += 60) {
  for (let x = 20 + ((y / 60) % 2) * 30; x < 1024; x += 60) {
    px(x, y, 4, 4, SOFT);
  }
}

/* Ícono destello a la izquierda (escala 18 → 288px) */
const S = 18, IX = 44, IY = 106;
DESTELLO.forEach((row, y) => {
  [...row].forEach((ch, x) => {
    const c = ICON_PAL[ch];
    if (c) px(IX + x * S, IY + y * S, S, S, c);
  });
});

/* Texto pixel */
function drawText(text, x0, y0, unit, fill, gap = 1) {
  let x = x0;
  for (const ch of text) {
    const glyph = FONT[ch];
    if (!glyph) continue;
    glyph.forEach((row, gy) => {
      [...row].forEach((cell, gx) => {
        if (cell === "#") px(x + gx * unit, y0 + gy * unit, unit, unit, fill);
      });
    });
    x += (glyph[0].length + gap) * unit;
  }
  return x;
}

// Título "RETROTASKS" — RETRO en crema, TASKS en dorado
const TU = 15; // unidad del título (letra de 5 filas → 75px de alto)
let tx = drawText("RETRO", 380, 158, TU, CREAM);
drawText("TASKS", tx, 158, TU, GOLD);

// Tagline "MISIONES Y TAREAS"
drawText("MISIONES Y TAREAS", 382, 290, 8, GOLD_D);

/* Destellos decorativos */
[[940, 60], [900, 400], [370, 70], [660, 420]].forEach(([x, y]) => {
  px(x, y - 8, 8, 24, GLOW); px(x - 8, y, 24, 8, GLOW);
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500" shape-rendering="crispEdges">${rects}</svg>`;
const out = process.argv[2] || "banner.svg";
writeFileSync(out, svg);
console.log(`Banner generado: ${out}`);
