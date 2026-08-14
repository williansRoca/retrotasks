/* ============================================================
 * ui/home.js — Pestaña Inicio: lista de misiones, tarjetas con
 * gestos swipe, buscador, filtros rápidos y drawer de filtros.
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { TYPES, PRIORITIES, dueStatus, inScope, sortItems, checklistProgress } from "../model.js";
import { $, el } from "./dom.js";
import {
  toggleDone, deleteItem, toggleChecklistItem, archiveItem, setArchived,
  enterSelectMode, toggleSelected, exitSelectMode, bulkAction,
} from "../store.js";
import { openSheet } from "./sheet.js";

/* ---------- Derivados ---------- */
function visibleItems() {
  const q = state.query.trim().toLowerCase();
  const filtered = state.items
    // Mostrar activas o archivadas según el modo actual
    .filter((i) => !!i.archived === !!state.showArchived)
    .filter((i) => state.catFilter === "Todo" || i.category === state.catFilter)
    .filter((i) => state.typeFilter === "todos" || i.type === state.typeFilter)
    .filter((i) => inScope(i, state.scope))
    .filter((i) => !q || i.title.toLowerCase().includes(q) || i.detail.toLowerCase().includes(q));
  return sortItems(filtered);
}

export const catColor = (name) => state.categories.find((c) => c.name === name)?.color || "#7B6A53";
const activeFilters = () => (state.catFilter !== "Todo" ? 1 : 0) + (state.typeFilter !== "todos" ? 1 : 0);

/* ---------- Lista de misiones ---------- */
export function renderHomeList() {
  const list = $("#list");
  list.innerHTML = "";

  // Barra superior: modo selección, o acceso a archivadas
  if (state.selectMode) {
    list.append(renderSelectionBar());
  } else if (state.showArchived) {
    list.append(el("div", { class: "pt-archive-banner" }, [
      el("span", {}, "📦 Viendo misiones archivadas"),
      el("button", { class: "pt-archive-back", onclick: () => { state.showArchived = false; ui.render(); } }, "Volver"),
    ]));
  }

  const items = visibleItems();

  if (items.length === 0) {
    let empty;
    if (state.showArchived) {
      empty = el("div", { class: "pt-empty" }, [
        el("div", { class: "pt-pixel" }, "SIN ARCHIVAR"),
        el("p", {}, "No tienes misiones archivadas."),
      ]);
    } else if (state.items.filter((i) => !i.archived).length === 0) {
      empty = el("div", { class: "pt-empty" }, [
        el("div", { class: "pt-pixel" }, "NADA POR AQUI"),
        el("p", { html: 'No hay misiones registradas.<br>Presiona el botón "+" para iniciar tu aventura.' }),
      ]);
    } else {
      empty = el("div", { class: "pt-empty" }, [
        el("div", { class: "pt-pixel" }, "SIN RESULTADOS"),
        el("p", { html: "Ninguna misión coincide con tus filtros o búsqueda." }),
      ]);
    }
    list.append(empty);
    return;
  }

  items.forEach((it) => list.append(renderCard(it)));
}

/* Barra de acciones cuando hay misiones seleccionadas */
function renderSelectionBar() {
  const n = state.selected.length;
  return el("div", { class: "pt-selbar" }, [
    el("button", { class: "pt-selbar-x", "aria-label": "Cancelar selección", onclick: exitSelectMode }, "✕"),
    el("span", { class: "pt-selbar-count" }, `${n} seleccionada${n === 1 ? "" : "s"}`),
    el("div", { class: "pt-selbar-acts" }, [
      state.showArchived
        ? el("button", { class: "pt-selbar-btn", title: "Restaurar", onclick: () => bulkAction("unarchive") }, "♻️")
        : el("button", { class: "pt-selbar-btn", title: "Marcar como hechas", onclick: () => bulkAction("done") }, "✓"),
      !state.showArchived
        ? el("button", { class: "pt-selbar-btn", title: "Archivar", onclick: () => bulkAction("archive") }, "📦")
        : null,
      el("button", { class: "pt-selbar-btn del", title: "Eliminar", onclick: () => bulkAction("delete") }, "🗑️"),
    ]),
  ]);
}

/* ---------- Tarjeta individual con gestos swipe ---------- */
export function renderCard(it) {
  const prio = PRIORITIES.find((p) => p.id === it.priority);
  const due = dueStatus(it.due, it.done);
  const typeLabel = TYPES.find((t) => t.id === it.type)?.label;

  const badges = el("div", { class: "pt-badges" }, [
    el("span", { class: "pt-tag", style: { background: catColor(it.category) } }, it.category),
    el("span", { class: "pt-type" }, typeLabel),
    prio ? el("span", { class: "pt-prio", style: { background: prio.color } }, prio.label) : null,
    it.repeat && it.repeat !== "no"
      ? el("span", { class: "pt-repeat", title: `Se repite: ${it.repeat}` }, "⟳ " + it.repeat)
      : null,
    due ? el("span", { class: "pt-due", style: { background: due.color } }, due.label) : null,
    it.alarm ? el("span", { class: "pt-alarm-badge", title: "Notificación tipo alarma" }, "⏰") : null,
    state.activeBoardId && it.owner && it.owner !== state.syncNickname
      ? el("span", { class: "pt-owner", title: `Creado por: ${it.owner}` }, `👤 ${it.owner}`)
      : null,
  ]);

  // Acciones: en la vista de archivadas se puede restaurar; en la
  // normal, completar / archivar / editar / eliminar.
  const actions = state.showArchived
    ? el("div", { class: "pt-actions" }, [
        el("button", { class: "pt-act on", onclick: () => setArchived(it.id, false) }, "♻️ Restaurar"),
        el("button", { class: "pt-act del", onclick: () => deleteItem(it.id) }, "Eliminar"),
      ])
    : el("div", { class: "pt-actions" }, [
        it.type !== "nota"
          ? el("button", {
              class: "pt-act" + (it.done ? " on" : ""), "aria-pressed": String(it.done),
              onclick: () => toggleDone(it.id),
            }, it.done ? "✓ Hecho" : "Marcar")
          : null,
        el("button", { class: "pt-act", onclick: () => openSheet(it) }, "Editar"),
        el("button", { class: "pt-act", "aria-label": `Archivar ${it.title}`,
          onclick: () => archiveItem(it.id) }, "📦"),
        el("button", {
          class: "pt-act del", "aria-label": `Eliminar ${it.title}`,
          onclick: () => deleteItem(it.id),
        }, "Eliminar"),
      ]);

  // Objetivos (checklist) con progreso y marcado directo EN SITIO:
  // el toque actualiza el DOM sin reconstruir la lista (evita perder
  // toques al marcar varios seguidos).
  const prog = checklistProgress(it);
  let checklist = null;
  if (prog) {
    const barFill = el("div", { class: "pt-chk-bar-fill", style: { width: prog.pct + "%" } });
    const count = el("span", { class: "pt-chk-count" }, `${prog.done}/${prog.total}`);
    const itemsWrap = el("div", { class: "pt-chk-items" },
      it.checklist.map((c) =>
        el("button", {
          class: "pt-chk-item" + (c.done ? " done" : ""),
          "aria-pressed": String(c.done),
          onclick: (e) => {
            if (state.selectMode) return; // en selección, el toque no marca objetivos
            e.stopPropagation();
            const nuevo = toggleChecklistItem(it.id, c.id);
            if (nuevo === null) return;
            // Actualización en sitio del botón y la barra de progreso
            e.currentTarget.classList.toggle("done", nuevo);
            const box = e.currentTarget.querySelector(".pt-chk-box");
            box.classList.toggle("on", nuevo);
            box.textContent = nuevo ? "✓" : "";
            const item = state.items.find((x) => x.id === it.id);
            const p = checklistProgress(item);
            if (p) { barFill.style.width = p.pct + "%"; count.textContent = `${p.done}/${p.total}`; }
          },
        }, [
          el("span", { class: "pt-chk-box" + (c.done ? " on" : "") }, c.done ? "✓" : ""),
          el("span", { class: "pt-chk-label" }, c.text),
        ])
      )
    );
    checklist = el("div", { class: "pt-chk-view" }, [
      el("div", { class: "pt-chk-progress" }, [
        el("div", { class: "pt-chk-bar" }, [barFill]),
        count,
      ]),
      itemsWrap,
    ]);
  }

  const selected = state.selectMode && state.selected.includes(it.id);

  const body = el("div", { class: "pt-cbody" }, [
    badges,
    el("div", { class: "pt-title" }, it.title),
    it.detail ? el("div", { class: "pt-detail" }, it.detail) : null,
    checklist,
    state.selectMode ? null : actions, // en selección ocultamos los botones
  ]);

  const cardElement = el("article", {
    class: "pt-card" + (it.done ? " pt-done" : "") + (selected ? " pt-selected" : ""),
    "data-id": it.id,
  }, [
    state.selectMode
      ? el("span", { class: "pt-sel-check" + (selected ? " on" : "") }, selected ? "✓" : "")
      : el("div", { class: "pt-stripe", style: { background: catColor(it.category) } }),
    body,
  ]);

  // En modo selección, tocar la tarjeta la marca/desmarca
  if (state.selectMode) {
    cardElement.addEventListener("click", () => toggleSelected(it.id));
  }

  // --- ANULACIÓN DE ANIMACIÓN CSS ---
  // Liberar la propiedad transform para que el arrastre sea 100% fluido en móviles
  cardElement.addEventListener('animationend', (e) => {
    if (e.animationName === "pt-card-in") {
      cardElement.style.animation = 'none';
    }
  }, { once: true });

  /* --- Gestos Swipe ---
   * Reglas para no disparar acciones por accidente:
   *  - Un toque simple (sin movimiento) NUNCA cuenta como deslizamiento.
   *  - El eje se decide en el primer movimiento: si el dedo va más en
   *    vertical, es scroll de la lista y la tarjeta no se mueve.
   *  - La acción solo ocurre si se supera el umbral horizontal. */
  const AXIS_LOCK = 12;   // px antes de decidir el eje del gesto
  let startX = 0, startY = 0, currentX = 0;
  let axis = null;        // null | "h" | "v"
  let longPressTimer = null;
  let moved = false;

  const resetGesture = () => {
    startX = 0; startY = 0; currentX = 0; axis = null; moved = false;
    clearTimeout(longPressTimer);
  };

  cardElement.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    currentX = t.clientX; // clave: sin movimiento, el desplazamiento es 0
    axis = null;
    moved = false;
    cardElement.style.transition = 'none';

    // Mantener presionado (~500ms sin moverse) → modo selección
    if (!state.selectMode) {
      longPressTimer = setTimeout(() => {
        if (!moved) {
          if (navigator.vibrate) navigator.vibrate(30);
          enterSelectMode(it.id);
        }
      }, 500);
    }
  }, { passive: true });

  cardElement.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) { moved = true; clearTimeout(longPressTimer); }
    if (state.selectMode) return; // en selección no se arrastra

    if (axis === null) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      // Sesgo a favor del scroll vertical: arrastrar exige intención clara
      axis = Math.abs(dx) > Math.abs(dy) * 1.5 ? "h" : "v";
    }
    if (axis !== "h") return;

    currentX = t.clientX;
    cardElement.style.transform = `translateX(${dx}px)`;
    // Mostrar SOLO el fondo de la dirección actual (evita que ambos
    // se solapen y que el fondo se transparente en tarjetas hechas).
    const dx2 = t.clientX - startX;
    bgDelete.classList.toggle("show", dx2 > 0);   // derecha → eliminar
    bgArchive.classList.toggle("show", dx2 < 0);  // izquierda → archivar
  }, { passive: true });

  const hideBgs = () => {
    bgDelete.classList.remove("show");
    bgArchive.classList.remove("show");
  };

  const endGesture = () => {
    clearTimeout(longPressTimer);
    if (axis !== "h") { resetGesture(); hideBgs(); return; }
    const diffX = currentX - startX;
    // Umbral: 35% del ancho, acotado para pantallas grandes
    const threshold = Math.min(window.innerWidth * 0.35, 220);
    cardElement.style.transition = 'transform 0.2s ease-out';

    if (diffX > threshold) {
      // Deslizar a la derecha → ELIMINAR
      cardElement.style.transform = 'translateX(100%)';
      setTimeout(() => deleteItem(it.id), 200);
    } else if (diffX < -threshold) {
      // Deslizar a la izquierda → ARCHIVAR (o restaurar si ya está archivada)
      cardElement.style.transform = 'translateX(-100%)';
      setTimeout(() => state.showArchived ? setArchived(it.id, false) : archiveItem(it.id), 200);
    } else {
      cardElement.style.transform = 'translateX(0px)';
      hideBgs();
    }
    resetGesture();
  };

  cardElement.addEventListener('touchend', endGesture);
  cardElement.addEventListener('touchcancel', () => {
    clearTimeout(longPressTimer);
    cardElement.style.transition = 'transform 0.2s ease-out';
    cardElement.style.transform = 'translateX(0px)';
    hideBgs();
    resetGesture();
  });

  // Fondos de swipe (ocultos por defecto; se revelan al arrastrar)
  const bgDelete = el("div", { class: "pt-card-swipe-bg pt-swipe-left" }, "🗑️ Eliminar");
  const bgArchive = el("div", { class: "pt-card-swipe-bg pt-swipe-right" },
    state.showArchived ? "♻️ Restaurar" : "📦 Archivar");

  return el("div", { class: "pt-card-wrapper" }, [
    bgDelete,
    bgArchive,
    cardElement
  ]);
}

/* ---------- Filtros superiores ---------- */
export function renderFilters() {
  const box = $("#filters");
  if (!box) return;
  box.innerHTML = "";
  const isWide = window.innerWidth >= 768;

  // Buscador
  if (state.searchOpen || isWide) {
    const wrap = el("div", { class: "pt-searchwrap" }, [
      el("input", {
        class: "pt-search", type: "search", value: state.query,
        autofocus: isWide ? null : "true",
        placeholder: "Buscar misión...", "aria-label": "Buscar tareas",
        oninput: (e) => { state.query = e.target.value; renderHomeList(); },
      }),
    ]);
    if (state.query) {
      wrap.append(el("button", {
        class: "pt-searchclear", "aria-label": "Limpiar busqueda",
        onclick: () => { state.query = ""; ui.render(); },
      }, "✕"));
    }
    box.append(wrap);
  }

  // Scope row (filtros rápidos de tiempo)
  const scopeRow = el("div", { class: "pt-scoperow" }, [
    el("div", { class: "pt-row pt-scope" },
      [["todo", "Todo"], ["hoy", "Hoy"], ["semana", "Semana"], ["sinfecha", "Sin fecha"]].map(([id, label]) =>
        el("button", {
          class: "pt-chip pt-scopechip", "aria-pressed": String(state.scope === id),
          onclick: () => { state.scope = id; ui.render(); },
        }, label)
      )
    ),
    // Botón filtros avanzados (abre el Drawer lateral)
    el("button", {
      class: "pt-filterbtn" + (activeFilters() > 0 ? " active" : ""),
      "aria-label": "Abrir filtros",
      onclick: () => openFilters(),
    }, "⚙" + (activeFilters() > 0 ? ` ${activeFilters()}` : "")),
  ]);
  box.append(scopeRow);
}

/* ---------- Drawer de filtros avanzados ---------- */
function openFilters() { state.filtersOpen = true; renderDrawer(); }
function closeFilters() { state.filtersOpen = false; const d = $("#drawer-root"); if (d) d.remove(); }

function renderDrawer() {
  const existing = $("#drawer-root");
  if (existing) existing.remove();
  const root = el("div", { class: "pt-drawer-overlay", id: "drawer-root", onclick: closeFilters });
  const drawer = el("aside", { class: "pt-drawer", role: "dialog", "aria-label": "Filtros Avanzados", onclick: (e) => e.stopPropagation() });

  drawer.append(
    el("div", { class: "pt-drawer-head" }, [
      el("h2", { class: "pt-pixel" }, "FILTROS"),
      el("button", { class: "pt-drawer-x", "aria-label": "Cerrar", onclick: closeFilters }, "×"),
    ])
  );

  // Categorías
  const catPills = el("div", { class: "pt-pills" }, [
    el("button", { class: "pt-pill", "aria-pressed": String(state.catFilter === "Todo"),
      onclick: () => { state.catFilter = "Todo"; renderDrawer(); ui.render(); } }, "Todas"),
    ...state.categories.map((c) =>
      el("button", {
        class: "pt-pill tinted", "aria-pressed": String(state.catFilter === c.name),
        style: state.catFilter === c.name ? { background: c.color } : {},
        onclick: () => { state.catFilter = c.name; renderDrawer(); ui.render(); },
      }, c.name)
    ),
  ]);
  drawer.append(el("div", { class: "pt-drawer-sec" }, [
    el("label", { class: "pt-drawer-label" }, "Categoría"), catPills,
  ]));

  // Tipos
  const typePills = el("div", { class: "pt-pills" }, [
    el("button", { class: "pt-pill", "aria-pressed": String(state.typeFilter === "todos"),
      onclick: () => { state.typeFilter = "todos"; renderDrawer(); ui.render(); } }, "Todos"),
    ...TYPES.map((t) =>
      el("button", { class: "pt-pill", "aria-pressed": String(state.typeFilter === t.id),
        onclick: () => { state.typeFilter = t.id; renderDrawer(); ui.render(); } }, t.label)
    ),
  ]);
  drawer.append(el("div", { class: "pt-drawer-sec" }, [
    el("label", { class: "pt-drawer-label" }, "Tipo"), typePills,
  ]));

  // Acceso a misiones archivadas
  const archCount = state.items.filter((i) => i.archived).length;
  drawer.append(el("div", { class: "pt-drawer-sec" }, [
    el("label", { class: "pt-drawer-label" }, "Archivo"),
    el("button", {
      class: "pt-pill" + (state.showArchived ? " tinted" : ""),
      "aria-pressed": String(state.showArchived),
      style: state.showArchived ? { background: "var(--accent)", color: "var(--bg-deep)" } : {},
      onclick: () => { state.showArchived = !state.showArchived; closeFilters(); ui.render(); },
    }, `📦 Ver archivadas (${archCount})`),
  ]));

  // Acciones finales del drawer
  drawer.append(el("div", { class: "pt-drawer-acts" }, [
    el("button", { class: "pt-cancel", disabled: activeFilters() === 0 ? "true" : null,
      style: { flex: '1' },
      onclick: () => { state.catFilter = "Todo"; state.typeFilter = "todos"; renderDrawer(); ui.render(); } }, "Limpiar"),
    el("button", { class: "pt-save", onclick: closeFilters }, "Aplicar"),
  ]));

  root.append(drawer);
  document.body.append(root);
}
