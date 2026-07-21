/* ============================================================
 * ui/workspace.js — Selector de espacio de trabajo
 *
 * Chip en la cabecera que indica SIEMPRE dónde estás (personal o
 * qué tablero) y abre una hoja para cambiar de espacio en dos
 * toques, sin abandonar ningún tablero.
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { $, el } from "./dom.js";
import { switchWorkspace, activeWorkspaceName } from "../store.js";

const PERSONAL_ICON = "📁";
const BOARD_ICON = "🤝";

// Chip de la cabecera
export function renderWorkspaceChip() {
  const isPersonal = !state.activeBoardId;
  return el("button", {
    class: "pt-ws-chip" + (isPersonal ? "" : " shared"),
    "aria-label": "Cambiar de espacio de trabajo",
    onclick: openWorkspaceSheet,
  }, [
    el("span", { class: "pt-ws-chip-icon" }, isPersonal ? PERSONAL_ICON : BOARD_ICON),
    el("span", { class: "pt-ws-chip-name" }, activeWorkspaceName()),
    el("span", { class: "pt-ws-chip-caret" }, "▾"),
  ]);
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
    name: "Personal",
    hint: "Solo tú",
    active: !state.activeBoardId,
    onSelect: () => selectWorkspace(null),
  }));

  // Tableros compartidos
  state.boards.forEach((b) => {
    list.append(makeOption({
      icon: BOARD_ICON,
      name: b.name || b.id,
      hint: b.id,
      active: state.activeBoardId === b.id,
      onSelect: () => selectWorkspace(b.id),
    }));
  });

  sheet.append(list);

  // Ir a la pestaña Tableros para crear/unirse/abandonar
  sheet.append(el("button", {
    class: "pt-btn-primary",
    style: { marginTop: "14px" },
    onclick: () => {
      closeWorkspaceSheet();
      state.activeTab = "boards";
      ui.renderShell();
      ui.render();
    },
  }, "GESTIONAR TABLEROS"));

  root.append(sheet);
  document.body.append(root);
}

async function selectWorkspace(boardId) {
  closeWorkspaceSheet();
  await switchWorkspace(boardId);
  ui.renderShell();
  ui.render();
}

function makeOption({ icon, name, hint, active, onSelect }) {
  return el("button", {
    class: "pt-ws-option" + (active ? " active" : ""),
    onclick: onSelect,
  }, [
    el("span", { class: "pt-ws-option-icon" }, icon),
    el("span", { class: "pt-ws-option-text" }, [
      el("span", { class: "pt-ws-option-name" }, name),
      el("span", { class: "pt-ws-option-hint" }, hint),
    ]),
    active ? el("span", { class: "pt-ws-option-check" }, "✓") : null,
  ]);
}
