/* Generador de íconos pixel-art de RetroTasks.
 * Define los diseños como mapas de píxeles 16x16 y produce SVGs
 * (que luego se rasterizan a PNG para Android/PWA).
 *
 * Uso: node scripts/gen-icons.mjs [salidaDir]
 */
import { writeFileSync, mkdirSync } from "node:fs";

const PAL = {
  ".": null,        // transparente
  "K": "#1A1208",  // fondo oscuro (fogata)
  "B": "#4A3826",  // borde madera
  "G": "#FFD24A",  // dorado
  "D": "#C49A20",  // dorado oscuro
  "C": "#F5EDD4",  // pergamino
  "I": "#5C4F3E",  // tinta
  "E": "#7BB661",  // verde éxito
  "F": "#5C9B45",  // verde oscuro
  "R": "#D94343",  // rojo sello
  "W": "#FFF6E0",  // brillo
};

/* A — Escudo del Aventurero: escudo dorado con check verde */
const escudo = [
  "................",
  "..BBBBBBBBBBBB..",
  ".BGGGGGGGGGGGGB.",
  ".BGWGGGGGGGGGGB.",
  ".BGKKKKKKKKKKGB.",
  ".BGKKKKKKKKKKGB.",
  ".BGKKKKKKKEEKGB.",
  ".BGKKKKKKEEKKGB.",
  ".BGKEEKKEEKKKGB.",
  ".BGKKEEEEKKKKGB.",
  ".BGKKKEEKKKKKGB.",
  "..BGKKKKKKKKGB..",
  "..BGGKKKKKKGGB..",
  "...BGGKKKKGGB...",
  ".....BGGGGB.....",
  ".......BB.......",
];

/* B — Pergamino de Misiones: scroll con líneas y check verde */
const pergamino = [
  "................",
  ".GGGGGGGGGGGGGG.",
  ".GDDDDDDDDDDDDG.",
  "..CCCCCCCCCCCC..",
  "..CIIIIIIIIICC..",
  "..CCCCCCCCCCCC..",
  "..CIIIIIICCCCC..",
  "..CCCCCCCCCCCC..",
  "..CIIIICCCCEEC..",
  "..CCCCCCCCEECC..",
  "..CEECCCCEECCC..",
  "..CCEECCEECCCC..",
  "..CCCEEEECCCCC..",
  ".GDDDDDDDDDDDDG.",
  ".GGGGGGGGGGGGGG.",
  "................",
];

/* C — Sello de Victoria: check dorado grueso con destellos */
const destello = [
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

function toSvg(map, { bg = null, scale = 1, pad = 0 } = {}) {
  const size = 16 + pad * 2;
  let rects = "";
  if (bg) rects += `<rect x="0" y="0" width="${size}" height="${size}" fill="${bg}"/>`;
  map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = PAL[ch];
      if (!color) return;
      rects += `<rect x="${x + pad}" y="${y + pad}" width="1" height="1" fill="${color}"/>`;
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${rects}</svg>`;
}

const outDir = process.argv[2] || "icon-drafts";
mkdirSync(outDir, { recursive: true });

const designs = { escudo, pergamino, destello };
for (const [name, map] of Object.entries(designs)) {
  // Versión "app icon": motivo sobre fondo oscuro con margen
  writeFileSync(`${outDir}/${name}.svg`, toSvg(map, { bg: "#1A1208", pad: 1 }));
  // Foreground adaptativo Android: transparente, motivo en la zona
  // segura central (~66% => pad 4 sobre malla de 16)
  writeFileSync(`${outDir}/${name}-fg.svg`, toSvg(map, { pad: 4 }));
  // Maskable PWA: fondo sólido con el mismo margen de seguridad
  writeFileSync(`${outDir}/${name}-maskable.svg`, toSvg(map, { bg: "#1A1208", pad: 4 }));
}
console.log(`SVGs generados en ${outDir}/: ${Object.keys(designs).join(", ")}`);
