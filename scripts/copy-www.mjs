/* Copia la app web (raíz del repo) a www/ para que Capacitor la
 * empaquete en el APK. La raíz se mantiene como fuente única para
 * que GitHub Pages siga sirviendo la PWA sin cambios. */
import { cpSync, rmSync, mkdirSync } from "node:fs";

const OUT = "www";
const ENTRIES = [
  "index.html",
  "styles.css",
  "manifest.json",
  "service-worker.js",
  "js",
  "icons",
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const entry of ENTRIES) {
  cpSync(entry, `${OUT}/${entry}`, { recursive: true });
}
console.log(`Copiado a ${OUT}/: ${ENTRIES.join(", ")}`);
