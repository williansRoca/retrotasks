/* ============================================================
 * ui/shell.js — Cascarón de la app y orquestación del render
 *
 * renderShell(): header + contenedores + barra de navegación.
 * render(): repinta el contenido según la pestaña activa.
 * ============================================================ */

import { state } from "../state.js";
import { setMeta } from "../db.js";
import { playSound } from "../sound.js";
import { $, el } from "./dom.js";
import { openSheet } from "./sheet.js";
import { renderFilters, renderHomeList } from "./home.js";
import { renderCalendarView } from "./calendar.js";
import { renderBoardsView } from "./boards.js";
import { renderAlertsView } from "./alerts.js";
import { renderProfileView } from "./profile.js";
import { renderAuthScreen } from "./auth-screen.js";

const soundOnSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" style="width: 18px; height: 18px;"><path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
const soundOffSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" style="width: 18px; height: 18px;"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/></svg>`;

// Render del cascarón (Header + Main Container + Nav Bar)
export function renderShell() {
  const app = $("#app");
  app.innerHTML = "";

  if (state.isAuthLoading) {
    // Pantalla de carga
    app.append(el("div", { class: "pt-auth" }, [
      el("div", { class: "pt-auth-logo pt-pixel", html: "CARGANDO..." })
    ]));
    return;
  }

  if (!state.user) {
    // Si no está autenticado, renderizar pantalla de Login
    renderAuthScreen(app);
    return;
  }

  // Header principal (con soporte para Safe Area / Notch y botones pixel art SVG)
  const header = el("header", { class: "pt-header" }, [
    el("div", { class: "pt-toprow" }, [
      el("div", { class: "pt-logo pt-pixel", html: "RETRO<b>TASKS</b>" }),
      el("div", { class: "pt-topbtns" }, [
        // Botón de búsqueda SVG Pixel (solo visible en el Home)
        state.activeTab === "home" ? el("button", {
          class: "pt-icon-btn" + (state.searchOpen ? " active" : ""), "aria-label": "Buscar",
          onclick: () => { state.searchOpen = !state.searchOpen; render(); },
        }, [el("span", { style: { display: 'flex' }, html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" style="width: 18px; height: 18px;"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.35-4.35"/></svg>` })]) : null,
        // Botón de sonido SVG Pixel
        el("button", {
          class: "pt-icon-btn", id: "btn-sound", "aria-label": "Sonido",
          onclick: async () => {
            state.soundOn = !state.soundOn;
            await setMeta("soundOn", state.soundOn);
            if (state.soundOn) playSound("create");
            render();
          },
        }, [el("span", { id: "sound-icon-span", style: { display: 'flex' }, html: state.soundOn ? soundOnSvg : soundOffSvg })]),
      ]),
    ]),
    el("div", { class: "pt-xpwrap" }, [
      el("div", { class: "pt-xptrack" }, [el("div", { class: "pt-xpfill", id: "xpfill" })]),
      el("div", { class: "pt-xpline", id: "xpline" }),
    ]),
  ]);

  // Contenedores dinámicos
  const filters = el("div", { class: "pt-filters", id: "filters" });
  const list = el("main", { class: "pt-list", id: "list" });

  // Botón flotante para nueva tarea (FAB)
  const fab = el("div", { class: "pt-fab", id: "fab" }, [
    el("button", { onclick: () => openSheet(null) }, "+"),
  ]);

  // Barra de navegación inferior con íconos vectoriales SVG
  const nav = el("nav", { class: "pt-bottom-nav" }, [
    createNavItem("home", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"><path d="M4 11V20H9V15H15V20H20V11L12 4L4 11Z"/></svg>`, "Inicio"),
    createNavItem("calendar", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"><path d="M3 5H21V21H3V5ZM3 9H21M8 3V7M16 3V7M7 13H9M11 13H13M15 13H17M7 17H9M11 17H13"/></svg>`, "Agenda"),
    createNavItem("boards", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"><path d="M3 3H10V10H3V3ZM14 3H21V10H14V3ZM14 14H21V21H14V14ZM3 14H10V21H3V14Z"/></svg>`, "Tableros"),
    createNavItem("alerts", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"><path d="M12 2C8 2 5 5 5 9V17H3V19H21V17H19V9C19 5 16 2 12 2ZM10 21C10 22 11 23 12 23C13 23 14 22 14 21H10Z"/></svg>`, "Alertas", state.alerts.length),
    createNavItem("profile", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"><path d="M12 2C9.8 2 8 3.8 8 6C8 8.2 9.8 10 12 10C14.2 10 16 8.2 16 6C16 3.8 14.2 2 12 2ZM6 20C6 16.7 8.7 14 12 14C15.3 14 18 16.7 18 20V22H6V20Z"/></svg>`, "Perfil")
  ]);

  app.append(header, filters, list, fab, nav);
}

// Crea un ítem para la barra de navegación (inyectando SVG nativo)
function createNavItem(tabId, iconSvg, label, badgeCount = 0) {
  const item = el("button", {
    class: "pt-nav-item" + (state.activeTab === tabId ? " active" : ""),
    onclick: () => {
      state.activeTab = tabId;
      renderShell();
      render();
    }
  }, [
    el("span", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center' }, html: iconSvg }),
    el("span", {}, label)
  ]);

  if (badgeCount > 0) {
    item.appendChild(el("span", { class: "pt-nav-badge" }, String(badgeCount)));
  }

  return item;
}

// Render principal de contenidos según el Tab activo
export function render() {
  if (!state.user) return;

  renderXP();

  const isWide = window.innerWidth >= 768;
  const list = $("#list");
  const filters = $("#filters");
  const fab = $("#fab");

  // Mostrar u ocultar FAB según la vista
  if (fab) {
    fab.style.display = state.activeTab === "home" ? "block" : "none";
  }

  if (state.activeTab === "home") {
    filters.style.display = "block";
    renderFilters();
    renderHomeList();
  } else {
    // Si no estamos en Home, vaciar y ocultar sección de filtros móviles
    if (!isWide) filters.style.display = "none";

    if (state.activeTab === "calendar") {
      renderCalendarView(list);
    } else if (state.activeTab === "boards") {
      renderBoardsView(list);
    } else if (state.activeTab === "alerts") {
      renderAlertsView(list);
    } else if (state.activeTab === "profile") {
      renderProfileView(list);
    }
  }

  // Actualizar ícono de sonido
  const soundSpan = $("#sound-icon-span");
  if (soundSpan) {
    soundSpan.innerHTML = state.soundOn ? soundOnSvg : soundOffSvg;
  }
}

// XP Bar updater
function renderXP() {
  const completables = state.items.filter((i) => i.type !== "nota");
  const done = completables.filter((i) => i.done).length;
  const pct = completables.length ? Math.round((done / completables.length) * 100) : 0;
  const pend = completables.filter((i) => !i.done).length;

  const fill = $("#xpfill");
  const line = $("#xpline");
  if (fill) fill.style.width = pct + "%";
  if (line) {
    line.innerHTML = "";
    line.append(
      el("span", { class: "pt-pixel" }, completables.length ? `${done}/${completables.length} XP` : "0/0 XP"),
      el("span", {}, pend === 0 ? "Todo en orden ✦" : `${pend} pendiente${pend > 1 ? "s" : ""}`)
    );
  }
}
