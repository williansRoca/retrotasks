/* ============================================================
 * ui/settings.js — Ventana de configuración de la app
 *
 * Agrupa apariencia (tema), accesibilidad y comportamiento.
 * Los cambios se aplican al instante y se guardan solos.
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { setMeta } from "../db.js";
import { THEMES, changeTheme } from "../theme.js";
import { settings, updateSetting, FONT_SIZES } from "../settings.js";
import { playSound } from "../sound.js";
import { $, el } from "./dom.js";

export function closeSettings() {
  const r = $("#settings-root");
  if (r) r.remove();
}

export function openSettings() {
  closeSettings();

  const root = el("div", { class: "pt-overlay", id: "settings-root", onclick: closeSettings });
  const sheet = el("div", { class: "pt-sheet", onclick: (e) => e.stopPropagation() });

  const repaint = () => { build(); };

  function build() {
    sheet.innerHTML = "";
    sheet.append(el("div", { class: "pt-sheet-handle" }));
    sheet.append(el("h2", { class: "pt-pixel" }, "CONFIGURACIÓN"));

    /* ---------- Apariencia ---------- */
    sheet.append(seccion("Apariencia"));

    const activeThemeId = document.body.className.match(/theme-(\w+)/)?.[1] || "fogata";
    sheet.append(el("div", { class: "pt-set-row col" }, [
      el("div", { class: "pt-set-label" }, "Tema visual"),
      el("div", { class: "pt-theme-grid" },
        THEMES.map((theme) =>
          el("button", {
            class: "pt-theme-dot" + (activeThemeId === theme.id ? " active" : ""),
            style: { background: theme.bg },
            title: theme.label,
            onclick: async () => {
              await changeTheme(theme.id, setMeta);
              repaint();
              ui.render(true);
            },
          }, theme.emoji)
        )
      ),
      el("div", { class: "pt-set-hint" },
        activeThemeId === "sobrio"
          ? "Modo sobrio: sin tipografía pixel, colores claros y bordes suaves."
          : "El tema 📋 Sobrio ofrece un aspecto formal, sin estética arcade."),
    ]));

    /* ---------- Accesibilidad ---------- */
    sheet.append(seccion("Accesibilidad"));

    sheet.append(el("div", { class: "pt-set-row col" }, [
      el("div", { class: "pt-set-label" }, "Tamaño del texto"),
      el("div", { class: "pt-pills" },
        FONT_SIZES.map((f) =>
          el("button", {
            class: "pt-pill",
            "aria-pressed": String(settings.fontSize === f.id),
            onclick: async () => { await updateSetting("fontSize", f.id); repaint(); },
          }, f.label)
        )
      ),
      el("div", { class: "pt-set-hint" }, "Aumenta el texto de misiones, formularios y botones."),
    ]));

    sheet.append(toggleRow({
      label: "Alto contraste",
      hint: "Refuerza el contraste de textos y bordes para leer mejor.",
      value: settings.highContrast,
      onChange: async (v) => { await updateSetting("highContrast", v); repaint(); },
    }));

    /* ---------- Comportamiento ---------- */
    sheet.append(seccion("Comportamiento"));

    sheet.append(toggleRow({
      label: "Confirmar antes de eliminar",
      hint: "Pide confirmación al borrar una misión, además del botón Deshacer.",
      value: settings.confirmDelete,
      onChange: async (v) => { await updateSetting("confirmDelete", v); repaint(); },
    }));

    sheet.append(toggleRow({
      label: "Sonidos",
      hint: "Efectos de sonido al crear y completar misiones.",
      value: state.soundOn,
      onChange: async (v) => {
        state.soundOn = v;
        await setMeta("soundOn", v);
        if (v) playSound("create");
        repaint();
        ui.render(true);
      },
    }));

    /* ---------- Acerca de ---------- */
    sheet.append(seccion("Acerca de"));
    sheet.append(el("div", { class: "pt-set-about" }, [
      el("div", {}, "RetroTasks · versión 2.1"),
      el("a", {
        href: "https://williansroca.github.io/retrotasks/privacidad.html",
        target: "_blank", rel: "noopener",
      }, "Política de privacidad"),
    ]));

    sheet.append(el("div", { class: "pt-sheetacts" }, [
      el("button", { class: "pt-save", onclick: closeSettings }, "LISTO"),
    ]));
  }

  build();
  root.append(sheet);
  document.body.append(root);
}

function seccion(titulo) {
  return el("div", { class: "pt-set-section" }, titulo);
}

function toggleRow({ label, hint, value, onChange }) {
  return el("button", {
    class: "pt-set-row toggle",
    role: "switch",
    "aria-checked": String(!!value),
    onclick: () => onChange(!value),
  }, [
    el("div", { class: "pt-set-texts" }, [
      el("div", { class: "pt-set-label" }, label),
      el("div", { class: "pt-set-hint" }, hint),
    ]),
    el("span", { class: "pt-switch" + (value ? " on" : "") }, [
      el("span", { class: "pt-switch-knob" }),
    ]),
  ]);
}
