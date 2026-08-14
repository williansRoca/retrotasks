/* Rasteriza los mapas de íconos a un PNG (sin dependencias) para inspección. */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { iconMaps, iconNames } from "../js/ui/icons.js";

const SCALE = 8;        // px por celda de la malla 12x12
const ICON = 12 * SCALE;
const GAP = 16;
const COLS = 5;
const rows = Math.ceil(iconNames.length / COLS);
const W = COLS * (ICON + GAP) + GAP;
const H = rows * (ICON + GAP) + GAP;

const BG = [26, 18, 8, 255];      // #1A1208
const FG = [255, 210, 74, 255];   // #FFD24A
const GRIDC = [58, 42, 24, 255];  // sutil rejilla

const buf = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) buf.set(BG, i * 4);

function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  buf.set(c, (y * W + x) * 4);
}

iconNames.forEach((name, idx) => {
  const ox = GAP + (idx % COLS) * (ICON + GAP);
  const oy = GAP + Math.floor(idx / COLS) * (ICON + GAP);
  const map = iconMaps[name];
  // rejilla tenue de la malla 12x12
  for (let gy = 0; gy <= 12; gy++)
    for (let x = 0; x < ICON; x++) px(ox + x, oy + gy * SCALE, GRIDC);
  for (let gx = 0; gx <= 12; gx++)
    for (let y = 0; y < ICON; y++) px(ox + gx * SCALE, oy + y, GRIDC);
  // píxeles del ícono
  map.forEach((row, cy) => {
    [...row].forEach((ch, cx) => {
      if (ch !== "X") return;
      for (let dy = 0; dy < SCALE; dy++)
        for (let dx = 0; dx < SCALE; dx++)
          px(ox + cx * SCALE + dx, oy + cy * SCALE + dy, FG);
    });
  });
});

/* ---- Codificador PNG mínimo ---------------------------------------------- */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0, 0);
  return Buffer.concat([len, td, crc]);
}
const CRCTAB = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRCTAB[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync("scripts/action-icons-sheet.png", png);
console.log("PNG", W, "x", H, "->", "scripts/action-icons-sheet.png");
