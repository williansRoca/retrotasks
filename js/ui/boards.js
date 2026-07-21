/* ============================================================
 * ui/boards.js — Pestaña Tableros: gestión de espacios compartidos
 *
 * Lista los tableros del usuario, permite crear uno con nombre,
 * unirse por código, cambiar de espacio y abandonar tableros.
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { el, showToast } from "./dom.js";
import {
  handleCreateBoard, handleJoinBoard, leaveBoard, switchWorkspace,
  removeBoardForEveryone, isBoardCreator, MAX_BOARDS,
} from "../store.js";

// Límites informados al usuario (ver también MAX_BOARDS en store.js)
const MAX_MIEMBROS = 20;

export function renderBoardsView(container) {
  container.innerHTML = "";

  container.append(
    el("h2", { class: "pt-pixel", style: { fontSize: '11px', color: 'var(--accent)', marginBottom: '14px' } },
      "TABLEROS COLABORATIVOS")
  );

  /* ---- Espacio activo ---- */
  const activo = !state.activeBoardId
    ? { icon: "📁", name: "Personal", hint: "Solo tú puedes ver estas misiones" }
    : (() => {
        const b = state.boards.find((x) => x.id === state.activeBoardId);
        return { icon: "🤝", name: b?.name || state.activeBoardId, hint: `Código: ${state.activeBoardId}` };
      })();

  container.append(el("div", { class: "pt-ws-current" }, [
    el("div", { class: "pt-ws-current-label" }, "ESTÁS EN"),
    el("div", { class: "pt-ws-current-name" }, `${activo.icon} ${activo.name}`),
    el("div", { class: "pt-ws-current-hint" }, activo.hint),
  ]));

  /* ---- Mis tableros ---- */
  const listSec = el("div", { class: "pt-board-sec" }, [
    el("div", { class: "pt-stat-label" }, `MIS TABLEROS (${state.boards.length}/${MAX_BOARDS})`),
  ]);

  if (state.boards.length === 0) {
    listSec.append(el("div", { class: "pt-hint", style: { marginTop: "8px" } },
      "Aún no perteneces a ningún tablero. Crea uno para compartir misiones con otras personas."));
  } else {
    state.boards.forEach((b) => {
      const activoEste = state.activeBoardId === b.id;
      listSec.append(el("div", { class: "pt-board-row" + (activoEste ? " active" : "") }, [
        el("button", {
          class: "pt-board-open",
          onclick: async () => {
            await switchWorkspace(activoEste ? null : b.id);
            ui.renderShell();
            ui.render();
          },
        }, [
          el("span", { class: "pt-board-name" }, `🤝 ${b.name || b.id}`),
          el("span", { class: "pt-board-code" }, b.id),
        ]),
        el("button", {
          class: "pt-board-share",
          "aria-label": `Copiar código de ${b.name || b.id}`,
          onclick: () => copyCode(b.id),
        }, "⧉"),
        el("button", {
          class: "pt-board-leave",
          "aria-label": `Opciones de ${b.name || b.id}`,
          onclick: () => openBoardOptions(b),
        }, "⋯"),
      ]));
    });
  }
  container.append(listSec);

  /* ---- Crear tablero ---- */
  const nameInput = el("input", {
    type: "text", class: "pt-input", maxlength: "40",
    placeholder: "Nombre del tablero (ej: Casa)",
    style: { marginBottom: "10px" },
  });

  container.append(el("div", { class: "pt-board-sec" }, [
    el("div", { class: "pt-stat-label" }, "CREAR TABLERO"),
    nameInput,
    el("button", {
      class: "pt-btn-primary",
      onclick: () => {
        handleCreateBoard(nameInput.value);
        nameInput.value = "";
      },
    }, "+ CREAR TABLERO NUEVO"),
  ]));

  /* ---- Unirse por código ---- */
  const codeInput = el("input", {
    type: "text", class: "pt-input", maxlength: "12",
    placeholder: "RT-XXXXXX",
    style: { textTransform: "uppercase", textAlign: "center", letterSpacing: "1px", marginBottom: "10px" },
  });

  container.append(el("div", { class: "pt-board-sec" }, [
    el("div", { class: "pt-stat-label" }, "UNIRSE CON UN CÓDIGO"),
    codeInput,
    el("button", {
      class: "pt-btn-primary",
      style: { background: 'var(--bg-elevated)', color: 'var(--accent)', borderColor: 'var(--border)', boxShadow: '0 4px 0 var(--border)' },
      onclick: () => {
        handleJoinBoard(codeInput.value);
        codeInput.value = "";
      },
    }, "UNIRSE A TABLERO"),
  ]));

  if (state.syncStatusMessage) {
    container.append(el("div", { class: "pt-hint", style: { color: 'var(--accent)', marginTop: '10px', textAlign: 'center' } },
      state.syncStatusMessage));
  }

  /* ---- Límites ---- */
  container.append(el("div", { class: "pt-board-limits" }, [
    el("div", { class: "pt-stat-label" }, "LÍMITES"),
    el("ul", { class: "pt-limit-list" }, [
      el("li", {}, `Hasta ${MAX_BOARDS} tableros por cuenta`),
      el("li", {}, `Hasta ${MAX_MIEMBROS} participantes por tablero`),
      el("li", {}, "Cualquier participante puede crear, completar y eliminar misiones del tablero"),
    ]),
  ]));
}

/* Hoja de opciones de un tablero: compartir, abandonar y —solo para
 * quien lo creó— eliminarlo para todos los participantes. */
function openBoardOptions(board) {
  const previa = document.querySelector("#board-opts-root");
  if (previa) previa.remove();

  const close = () => { const r = document.querySelector("#board-opts-root"); if (r) r.remove(); };
  const root = el("div", { class: "pt-overlay", id: "board-opts-root", onclick: close });
  const sheet = el("div", { class: "pt-sheet", onclick: (e) => e.stopPropagation() });

  sheet.append(el("div", { class: "pt-sheet-handle" }));
  sheet.append(el("h2", { class: "pt-pixel" }, (board.name || board.id).toUpperCase()));
  sheet.append(el("div", { class: "pt-hint", style: { marginBottom: "14px" } },
    `Código para invitar: ${board.id}`));

  const acciones = el("div", { class: "pt-ws-list" });

  acciones.append(el("button", {
    class: "pt-ws-option",
    onclick: () => { copyCode(board.id); close(); },
  }, [
    el("span", { class: "pt-ws-option-icon" }, "⧉"),
    el("span", { class: "pt-ws-option-text" }, [
      el("span", { class: "pt-ws-option-name" }, "Copiar código"),
      el("span", { class: "pt-ws-option-hint" }, "Para invitar a otras personas"),
    ]),
  ]));

  acciones.append(el("button", {
    class: "pt-ws-option",
    onclick: () => {
      close();
      if (confirm(`¿Abandonar "${board.name || board.id}"?\n\nDejarás de ver sus misiones, pero seguirán disponibles para los demás participantes. Puedes volver con el código.`)) {
        leaveBoard(board.id).then(() => { ui.renderShell(); ui.render(true); });
      }
    },
  }, [
    el("span", { class: "pt-ws-option-icon" }, "🚪"),
    el("span", { class: "pt-ws-option-text" }, [
      el("span", { class: "pt-ws-option-name" }, "Abandonar tablero"),
      el("span", { class: "pt-ws-option-hint" }, "Solo tú dejas de verlo"),
    ]),
  ]));

  // La opción de eliminar solo se muestra si el servidor confirma
  // que esta cuenta creó el tablero.
  const zonaPeligro = el("div", {});
  acciones.append(zonaPeligro);
  isBoardCreator(board.id).then((esCreador) => {
    if (!esCreador) return;
    zonaPeligro.append(el("button", {
      class: "pt-ws-option danger",
      style: { marginTop: "8px" },
      onclick: () => {
        close();
        const aviso = confirm(
          `⚠️ ELIMINAR "${board.name || board.id}" PARA TODOS\n\n` +
          "Se borrarán todas las misiones del tablero y dejará de existir " +
          "para todos los participantes. Esta acción no se puede deshacer.\n\n¿Continuar?"
        );
        if (!aviso) return;
        removeBoardForEveryone(board.id).then(() => { ui.renderShell(); ui.render(true); });
      },
    }, [
      el("span", { class: "pt-ws-option-icon" }, "🗑️"),
      el("span", { class: "pt-ws-option-text" }, [
        el("span", { class: "pt-ws-option-name" }, "Eliminar tablero"),
        el("span", { class: "pt-ws-option-hint" }, "Lo borra para todos · solo el creador"),
      ]),
    ]));
  });

  sheet.append(acciones);
  sheet.append(el("button", { class: "pt-cancel", style: { width: "100%", marginTop: "14px" }, onclick: close }, "CANCELAR"));

  root.append(sheet);
  document.body.append(root);
}

// Copia el código al portapapeles para compartirlo fácilmente
async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    showToast(`Código ${code} copiado ✦`);
  } catch (_) {
    showToast(`Código del tablero: ${code}`);
  }
}
