/* ============================================================
 * ui/workspace.js — Selector de espacio de trabajo
 *
 * Chip en la cabecera que indica SIEMPRE dónde estás (personal o
 * qué tablero), con el color e ícono propios de ese espacio, y abre
 * una hoja para cambiar de espacio en dos toques sin abandonar nada.
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { $, el } from "./dom.js";
import { switchWorkspace, activeWorkspaceName } from "../store.js";
import { boardStyle, PERSONAL_ICON } from "../board-theme.js";
import { icon as renderIcon } from "./icons.js";

// Chip de la cabecera
export function renderWorkspaceChip() {
  const isPersonal = !state.activeBoardId;
  const board = isPersonal ? null : state.boards.find((b) => b.id === state.activeBoardId);
  const { icon: ico } = boardStyle(board || (isPersonal ? null : { id: state.activeBoardId }));

  return el("button", {
    class: "pt-ws-chip" + (isPersonal ? "" : " shared"),
    "aria-label": "Cambiar de espacio de trabajo",
    onclick: openWorkspaceSheet,
  }, [
    el("span", { class: "pt-ws-chip-icon", html: renderIcon(isPersonal ? PERSONAL_ICON : ico, 16) }),
    el("span", { class: "pt-ws-chip-name" }, activeWorkspaceName()),
    el("span", { class: "pt-ws-chip-caret" }, "▾"),
  ]);
}

// Franja de color bajo la cabecera: refuerzo permanente del espacio
export function renderWorkspaceStripe() {
  const board = state.activeBoardId
    ? state.boards.find((b) => b.id === state.activeBoardId)
    : null;
  if (!state.activeBoardId) return null;
  const { color } = boardStyle(board || { id: state.activeBoardId });
  return el("div", { class: "pt-ws-stripe", style: { background: color } });
}

export function closeWorkspaceSheet() {
  const s = $("#ws-root");
  if (s) s.remove();
}

export function openWorkspaceSheet() {
  closeWorkspaceSheet();

  const root = el("div", { class: "pt-overlay", id: "ws-root", onclick: closeWorkspaceSheet });
  const sheet = el("div", { class: "pt-sheet", onclick: (e) => e.stopPropagation() });

  sheet.append(el("div", { class: "pt-sheet-handle" }));
  sheet.append(el("h2", { class: "pt-pixel" }, "CAMBIAR DE ESPACIO"));

  const list = el("div", { class: "pt-ws-list" });

  // Espacio personal
  list.append(makeOption({
    icon: PERSONAL_ICON,
    color: null,
    name: "Personal",
    hint: "Solo tú",
    active: !state.activeBoardId,
    onSelect: () => selectWorkspace(null),
  }));

  // Tableros compartidos, cada uno con su identidad
  state.boards.forEach((b) => {
    const { color, icon } = boardStyle(b);
    list.append(makeOption({
      icon,
      color,
      name: b.name || b.id,
      hint: b.id,
      active: state.activeBoardId === b.id,
      onSelect: () => selectWorkspace(b.id),
    }));
  });

  sheet.append(list);

  // Ir a la pestaña Tableros para crear/unirse/personalizar
  sheet.append(el("button", {
    class: "pt-btn-primary",
    style: { marginTop: "14px" },
    onclick: () => {
      closeWorkspaceSheet();
      state.activeTab = "boards";
      ui.renderShell();
      ui.render(true);
    },
  }, "GESTIONAR TABLEROS"));

  root.append(sheet);
  document.body.append(root);
}

async function selectWorkspace(boardId) {
  closeWorkspaceSheet();
  await switchWorkspace(boardId);
  ui.renderShell();
  ui.render(true);
}

function makeOption({ icon, color, name, hint, active, onSelect }) {
  return el("button", {
    class: "pt-ws-option" + (active ? " active" : ""),
    style: active && color ? { borderColor: color } : {},
    onclick: onSelect,
  }, [
    el("span", {
      class: "pt-ws-option-icon",
      style: color ? { background: color, color: "#fff" } : {},
      html: renderIcon(icon, 18),
    }),
    el("span", { class: "pt-ws-option-text" }, [
      el("span", { class: "pt-ws-option-name" }, name),
      el("span", { class: "pt-ws-option-hint" }, hint),
    ]),
    active ? el("span", { class: "pt-ws-option-check" }, "✓") : null,
  ]);
}
