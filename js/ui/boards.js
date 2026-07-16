/* ============================================================
 * ui/boards.js — Pestaña Tableros: colaboración en tiempo real
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { el } from "./dom.js";
import { handleCreateBoard, handleJoinBoard, disconnectBoard } from "../store.js";

export function renderBoardsView(container) {
  container.innerHTML = "";

  const title = el("h2", { class: "pt-pixel", style: { fontSize: '11px', color: 'var(--accent)', marginBottom: '14px' } }, "TABLEROS COLABORATIVOS");

  const content = el("div", { class: "pt-profile-hero" });

  if (state.activeBoardId) {
    content.append(
      el("span", { style: { fontSize: '32px' } }, "🤝"),
      el("div", { class: "pt-profile-name" }, `Tablero activo: ${state.activeBoardId}`),
      el("div", { class: "pt-profile-email", style: { textAlign: 'center', marginBottom: '16px' } },
        "Las misiones de este tablero se sincronizan con tus colaboradores."
      ),
      el("button", {
        class: "pt-btn-primary",
        style: { background: 'var(--red)', borderColor: 'darkred', boxShadow: '0 4px 0 darkred' },
        onclick: () => {
          if (confirm("¿Desconectarse del tablero compartido? Volverás a tus misiones personales.")) {
            disconnectBoard();
            ui.render();
          }
        }
      }, "DESCONECTAR TABLERO")
    );
  } else {
    const boardInput = el("input", {
      type: "text",
      class: "pt-input",
      style: { textTransform: "uppercase", textAlign: "center", letterSpacing: "1px", marginBottom: "12px" },
      placeholder: "RT-XXXXXX"
    });

    content.append(
      el("span", { style: { fontSize: '32px' } }, "📁"),
      el("div", { class: "pt-profile-name", style: { marginBottom: '8px' } }, "Modo Personal"),
      el("div", { class: "pt-profile-email", style: { textAlign: 'center', marginBottom: '16px' } },
        "Estás en tu almacenamiento en la nube privado. Únete a un tablero para colaborar."
      ),
      boardInput,
      el("button", {
        class: "pt-btn-primary",
        style: { marginBottom: '12px' },
        onclick: () => handleJoinBoard(boardInput.value)
      }, "UNIRSE A TABLERO"),
      el("button", {
        class: "pt-btn-primary",
        style: { background: 'var(--bg-elevated)', color: 'var(--accent)', borderColor: 'var(--border)', boxShadow: '0 4px 0 var(--border)' },
        onclick: handleCreateBoard
      }, "+ CREAR TABLERO NUEVO")
    );
  }

  if (state.syncStatusMessage) {
    content.append(el("div", { class: "pt-auth-toggle", style: { marginTop: '12px', color: 'var(--accent)' } }, state.syncStatusMessage));
  }

  container.append(title, content);
}
