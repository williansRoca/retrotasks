/* ============================================================
 * settings.js — Preferencias de la app (incluye accesibilidad)
 *
 * Se guardan en IndexedDB (local, inmediato) y se aplican como
 * clases en <body>, igual que los temas. Así el CSS hace todo el
 * trabajo y no hay que repintar la interfaz.
 * ============================================================ */

import { getMeta, setMeta } from "./db.js";

export const FONT_SIZES = [
  { id: "sm", label: "Pequeño" },
  { id: "md", label: "Normal" },
  { id: "lg", label: "Grande" },
  { id: "xl", label: "Muy grande" },
];

const DEFAULTS = {
  fontSize: "md",       // sm | md | lg | xl
  highContrast: false,  // refuerza contraste de texto y bordes
  confirmDelete: false, // pedir confirmación antes de eliminar
  sound: null,          // (reservado)
};

export const settings = { ...DEFAULTS };

// Aplica las preferencias al documento (clases en <body>).
export function applySettings() {
  const body = document.body;

  FONT_SIZES.forEach((f) => body.classList.remove(`font-${f.id}`));
  if (settings.fontSize !== "md") body.classList.add(`font-${settings.fontSize}`);

  body.classList.toggle("high-contrast", !!settings.highContrast);
}

// Carga las preferencias guardadas y las aplica.
export async function initSettings() {
  try {
    const guardadas = await getMeta("settings", null);
    if (guardadas && typeof guardadas === "object") {
      Object.assign(settings, DEFAULTS, guardadas);
    }
  } catch (e) {
    console.warn("No se pudieron cargar las preferencias:", e);
  }
  applySettings();
  return settings;
}

// Cambia una preferencia, la aplica y la persiste.
export async function updateSetting(key, value) {
  if (!(key in DEFAULTS)) return;
  settings[key] = value;
  applySettings();
  try {
    await setMeta("settings", { ...settings });
  } catch (e) {
    console.warn("No se pudo guardar la preferencia:", e);
  }
}
