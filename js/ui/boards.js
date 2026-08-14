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
  removeBoardForEveryone, isBoardCreator, setBoardStyle, MAX_BOARDS,
} from "../store.js";
import { BOARD_COLORS, BOARD_ICONS, boardStyle, PERSONAL_ICON } from "../board-theme.js";
import { icon } from "./icons.js";

// Límites informados al usuario (ver también MAX_BOARDS en store.js)
const MAX_MIEMBROS = 20;

export function renderBoardsView(container) {
  container.innerHTML = "";

  container.append(
    el("h2", { class: "pt-pixel", style: { fontSize: '11px', color: 'var(--accent)', marginBottom: '14px' } },
      "TABLEROS COLABORATIVOS")
  );

  /* ---- Espacio activo ---- */
  const activeBoard = state.activeBoardId
    ? state.boards.find((x) => x.id === state.activeBoardId)
    : null;
  const activo = !state.activeBoardId
    ? { icon: PERSONAL_ICON, color: null, name: "Personal", hint: "Solo tú puedes ver estas misiones" }
    : (() => {
        const st = boardStyle(activeBoard || { id: state.activeBoardId });
        return {
          icon: st.icon, color: st.color,
          name: activeBoard?.name || state.activeBoardId,
          hint: `Código: ${state.activeBoardId}`,
        };
      })();

  container.append(el("div", {
    class: "pt-ws-current",
    style: activo.color ? { borderColor: activo.color } : {},
  }, [
    el("div", { class: "pt-ws-current-label" }, "ESTÁS EN"),
    el("div", { class: "pt-ws-current-name" }, [
      el("span", { class: "rt-icon-wrap", style: activo.color ? { color: activo.color } : {},
        html: icon(activo.icon, 22) }),
      el("span", {}, activo.name),
    ]),
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
      const st = boardStyle(b);
      listSec.append(el("div", {
        class: "pt-board-row" + (activoEste ? " active" : ""),
        style: activoEste ? { borderColor: st.color } : {},
      }, [
        el("button", {
          class: "pt-board-open",
          style: { borderLeftColor: st.color, borderLeftWidth: "6px" },
          onclick: async () => {
            await switchWorkspace(activoEste ? null : b.id);
            ui.renderShell();
            ui.render(true);
          },
        }, [
          el("span", { class: "pt-board-name" }, [
            el("span", { class: "rt-icon-wrap", style: { color: st.color }, html: icon(st.icon, 17) }),
            el("span", {}, b.name || b.id),
          ]),
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

  /* ---- Crear tablero (con identidad visual) ---- */
  const nameInput = el("input", {
    type: "text", class: "pt-input", maxlength: "40",
    placeholder: "Nombre del tablero (ej: Casa)",
    style: { marginBottom: "12px" },
  });

  // Selección del creador: la heredan quienes se unan
  const nuevo = { color: BOARD_COLORS[0].hex, icon: BOARD_ICONS[0] };
  const crearSec = el("div", { class: "pt-board-sec" });

  const pintarCrear = () => {
    crearSec.innerHTML = "";
    crearSec.append(
      el("div", { class: "pt-stat-label" }, "CREAR TABLERO"),
      nameInput,
      el("div", { class: "pt-style-label" }, "Color"),
      el("div", { class: "pt-color-grid" },
        BOARD_COLORS.map((c) =>
          el("button", {
            class: "pt-color-dot" + (nuevo.color === c.hex ? " active" : ""),
            style: { background: c.hex },
            title: c.label,
            "aria-label": c.label,
            onclick: () => { nuevo.color = c.hex; pintarCrear(); },
          }, nuevo.color === c.hex ? "✓" : "")
        )
      ),
      el("div", { class: "pt-style-label" }, "Ícono"),
      el("div", { class: "pt-icon-grid" },
        BOARD_ICONS.map((ic) =>
          el("button", {
            class: "pt-icon-pick" + (nuevo.icon === ic ? " active" : ""),
            style: nuevo.icon === ic ? { borderColor: nuevo.color } : {},
            onclick: () => { nuevo.icon = ic; pintarCrear(); },
            html: icon(ic, 20),
          })
        )
      ),
      el("div", { class: "pt-hint", style: { marginBottom: "10px" } },
        "Quien se una verá este color e ícono, y podrá cambiarlos en su propia app."),
      el("button", {
        class: "pt-btn-primary",
        style: { background: nuevo.color, borderColor: nuevo.color },
        onclick: () => {
          handleCreateBoard(nameInput.value, { color: nuevo.color, icon: nuevo.icon });
          nameInput.value = "";
        },
      }, "+ CREAR TABLERO NUEVO")
    );
  };
  pintarCrear();
  container.append(crearSec);

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
    onclick: () => { close(); openBoardStyleSheet(board); },
  }, [
    el("span", { class: "pt-ws-option-icon",
      style: { background: boardStyle(board).color, color: "#fff" },
      html: icon(boardStyle(board).icon, 18) }),
    el("span", { class: "pt-ws-option-text" }, [
      el("span", { class: "pt-ws-option-name" }, "Personalizar"),
      el("span", { class: "pt-ws-option-hint" }, "Color e ícono, solo para ti"),
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
    el("span", { class: "pt-ws-option-icon", html: icon("leave_board", 18) }),
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
      el("span", { class: "pt-ws-option-icon", html: icon("trash", 18) }),
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

/* Hoja para personalizar cómo ve ESTE usuario un tablero.
 * Es una preferencia local: no cambia lo que ven los demás. */
function openBoardStyleSheet(board) {
  const previa = document.querySelector("#board-style-root");
  if (previa) previa.remove();

  const close = () => { const r = document.querySelector("#board-style-root"); if (r) r.remove(); };
  const root = el("div", { class: "pt-overlay", id: "board-style-root", onclick: close });
  const sheet = el("div", { class: "pt-sheet", onclick: (e) => e.stopPropagation() });

  const actual = boardStyle(board);
  const sel = { color: actual.color, icon: actual.icon };

  const pintar = () => {
    sheet.innerHTML = "";
    sheet.append(el("div", { class: "pt-sheet-handle" }));
    sheet.append(el("h2", { class: "pt-pixel" }, "PERSONALIZAR"));

    // Vista previa
    sheet.append(el("div", { class: "pt-style-preview", style: { borderColor: sel.color } }, [
      el("span", { class: "pt-style-preview-icon", style: { background: sel.color, color: "#fff" },
        html: icon(sel.icon, 22) }),
      el("span", { class: "pt-style-preview-name" }, board.name || board.id),
    ]));

    sheet.append(el("div", { class: "pt-style-label" }, "Color"));
    sheet.append(el("div", { class: "pt-color-grid" },
      BOARD_COLORS.map((c) =>
        el("button", {
          class: "pt-color-dot" + (sel.color === c.hex ? " active" : ""),
          style: { background: c.hex },
          title: c.label,
          "aria-label": c.label,
          onclick: () => { sel.color = c.hex; pintar(); },
        }, sel.color === c.hex ? "✓" : "")
      )
    ));

    sheet.append(el("div", { class: "pt-style-label" }, "Ícono"));
    sheet.append(el("div", { class: "pt-icon-grid" },
      BOARD_ICONS.map((ic) =>
        el("button", {
          class: "pt-icon-pick" + (sel.icon === ic ? " active" : ""),
          style: sel.icon === ic ? { borderColor: sel.color } : {},
          onclick: () => { sel.icon = ic; pintar(); },
          html: icon(ic, 20),
        })
      )
    ));

    sheet.append(el("div", { class: "pt-hint" },
      "Solo cambia cómo ves tú este tablero. Los demás participantes conservan el suyo."));

    sheet.append(el("div", { class: "pt-sheetacts" }, [
      el("button", {
        class: "pt-save",
        onclick: async () => {
          close();
          await setBoardStyle(board.id, sel);
          showToast("Identidad del tablero actualizada ✦");
        },
      }, "GUARDAR"),
      el("button", { class: "pt-cancel", onclick: close }, "CANCELAR"),
    ]));
  };

  pintar();
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
