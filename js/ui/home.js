/* ============================================================
 * ui/home.js — Pestaña Inicio: lista de misiones, tarjetas con
 * gestos swipe, buscador, filtros rápidos y drawer de filtros.
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { TYPES, PRIORITIES, dueStatus, inScope, sortItems } from "../model.js";
import { $, el } from "./dom.js";
import { toggleDone, deleteItem } from "../store.js";
import { openSheet } from "./sheet.js";

/* ---------- Derivados ---------- */
function visibleItems() {
  const q = state.query.trim().toLowerCase();
  const filtered = state.items
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
  const items = visibleItems();

  if (items.length === 0) {
    const empty = state.items.length === 0
      ? el("div", { class: "pt-empty" }, [
          el("div", { class: "pt-pixel" }, "NADA POR AQUI"),
          el("p", { html: 'No hay misiones registradas.<br>Presiona el botón "+" para iniciar tu aventura.' }),
        ])
      : el("div", { class: "pt-empty" }, [
          el("div", { class: "pt-pixel" }, "SIN RESULTADOS"),
          el("p", { html: "Ninguna misión coincide con tus filtros o búsqueda." }),
        ]);
    list.append(empty);
    return;
  }

  items.forEach((it) => list.append(renderCard(it)));
}

/* ---------- Tarjeta individual con gestos swipe ---------- */
function renderCard(it) {
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
    state.activeBoardId && it.owner && it.owner !== state.syncNickname
      ? el("span", { class: "pt-owner", title: `Creado por: ${it.owner}` }, `👤 ${it.owner}`)
      : null,
  ]);

  const actions = el("div", { class: "pt-actions" }, [
    it.type !== "nota"
      ? el("button", {
          class: "pt-act" + (it.done ? " on" : ""), "aria-pressed": String(it.done),
          onclick: () => toggleDone(it.id),
        }, it.done ? "✓ Hecho" : "Marcar")
      : null,
    el("button", { class: "pt-act", onclick: () => openSheet(it) }, "Editar"),
    el("button", {
      class: "pt-act del", "aria-label": `Eliminar ${it.title}`,
      onclick: () => deleteItem(it.id),
    }, "Eliminar"),
  ]);

  const body = el("div", { class: "pt-cbody" }, [
    badges,
    el("div", { class: "pt-title" }, it.title),
    it.detail ? el("div", { class: "pt-detail" }, it.detail) : null,
    actions,
  ]);

  const cardElement = el("article", { class: "pt-card" + (it.done ? " pt-done" : ""), "data-id": it.id }, [
    el("div", { class: "pt-stripe", style: { background: catColor(it.category) } }),
    body,
  ]);

  // --- ANULACIÓN DE ANIMACIÓN CSS ---
  // Liberar la propiedad transform para que el arrastre sea 100% fluido en móviles
  cardElement.addEventListener('animationend', (e) => {
    if (e.animationName === "pt-card-in") {
      cardElement.style.animation = 'none';
    }
  }, { once: true });

  // --- Implementación de Gestos Swipe ---
  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  cardElement.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
    cardElement.style.transition = 'none';
  }, { passive: true });

  cardElement.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentX = e.touches[0].clientX;
    const diffX = currentX - startX;

    // Mover la tarjeta con el dedo
    cardElement.style.transform = `translateX(${diffX}px)`;
  }, { passive: true });

  cardElement.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    const diffX = currentX - startX;
    const threshold = window.innerWidth * 0.35; // 35% del ancho de pantalla para activar la acción

    if (diffX > threshold) {
      // Completar (Deslizar a la derecha)
      cardElement.style.transition = 'transform 0.2s ease-out';
      cardElement.style.transform = 'translateX(100%)';
      setTimeout(() => {
        toggleDone(it.id);
      }, 200);
    } else if (diffX < -threshold) {
      // Eliminar (Deslizar a la izquierda)
      cardElement.style.transition = 'transform 0.2s ease-out';
      cardElement.style.transform = 'translateX(-100%)';
      setTimeout(() => {
        deleteItem(it.id);
      }, 200);
    } else {
      // Rebotar a la posición inicial
      cardElement.style.transition = 'transform 0.2s ease-out';
      cardElement.style.transform = 'translateX(0px)';
    }
    startX = 0;
    currentX = 0;
  });

  return el("div", { class: "pt-card-wrapper" }, [
    el("div", { class: "pt-card-swipe-bg pt-swipe-left" }, "✓ Completar"),
    el("div", { class: "pt-card-swipe-bg pt-swipe-right" }, "🗑️ Eliminar"),
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
