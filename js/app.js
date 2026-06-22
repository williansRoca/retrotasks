/* ============================================================
 * app.js — Controlador principal de RetroTasks (JS puro)
 *
 * CAMBIO CONCEPTUAL respecto al prototipo React: alli la interfaz
 * se redibujaba sola al cambiar el estado. Aqui usamos un patron
 * explicito: un objeto `state` + una funcion `render()` que vuelve
 * a pintar la lista cuando algo cambia. Es predecible y suficiente
 * para una app de este tamaño.
 * ============================================================ */

import {
  getAllItems, putItem, removeItem, bulkReplaceItems, getMeta, setMeta,
  getActiveBoardId, setActiveBoardId, getSyncNickname, setSyncNickname,
} from "./db.js";
import {
  TYPES, PRIORITIES, REPEATS, DEFAULT_CATEGORIES, PALETTE,
  createItem, touchItem, fmtDate, nextDate, dueStatus, inScope, sortItems,
} from "./model.js";
import { playSound } from "./sound.js";
import {
  isFirebaseConfigured, initFirebase, checkBoardExists, createBoard,
  saveSharedItem, deleteSharedItem, subscribeToBoard,
} from "./firebase.js";

/* ---------- Estado en memoria ---------- */
const state = {
  items: [],
  categories: DEFAULT_CATEGORIES,
  soundOn: false,
  catFilter: "Todo",
  typeFilter: "todos",
  scope: "todo",
  query: "",
  searchOpen: false,
  filtersOpen: false,
  editing: null, // item en edicion, o null
  sheetOpen: false,
  // --- Estado Cooperativo ---
  activeBoardId: null,
  syncNickname: "",
  isFirebaseConfigured: false,
  syncUnsubscribe: null,
  syncStatusMessage: "",
  lastDeletedId: null,
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
};
const sfx = (name) => { if (state.soundOn) playSound(name); };

/* ---------- Notificaciones Colaborativas ---------- */
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendDesktopNotification(title, message) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body: message,
            icon: "./icons/icon-192.png",
            badge: "./icons/icon-192.png",
            vibrate: [200, 100, 200]
          });
        });
      } else {
        new Notification(title, {
          body: message,
          icon: "./icons/icon-192.png"
        });
      }
    } catch (e) {
      console.warn("Error mostrando notificación de escritorio:", e);
    }
  }
}

function showToast(message) {
  let container = document.querySelector(".pt-toast-container");
  if (!container) {
    container = el("div", { class: "pt-toast-container" });
    document.body.appendChild(container);
  }

  const toast = el("div", { class: "pt-toast" }, [
    el("span", {}, message)
  ]);

  toast.addEventListener("animationend", (e) => {
    if (e.animationName === "pt-toast-out") {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }
  });

  container.appendChild(toast);
}

function notifyEvent(title, message, soundName = "notify") {
  sfx(soundName);
  showToast(message);
  if (document.hidden) {
    sendDesktopNotification(title, message);
  }
}

function detectAndNotifyChanges(oldItems, newItems) {
  const nickname = (state.syncNickname || "").trim().toLowerCase();
  
  // 1. Tareas creadas por otros
  const added = newItems.filter(n => !oldItems.some(o => o.id === n.id));
  added.forEach(item => {
    const creator = item.owner || "Alguien";
    if (creator.trim().toLowerCase() !== nickname) {
      notifyEvent(
        "➕ Tarea nueva",
        `👤 ${creator} creó: "${item.title}"`,
        "create"
      );
    }
  });

  // 2. Tareas eliminadas por otros
  const deleted = oldItems.filter(o => !newItems.some(n => n.id === o.id));
  deleted.forEach(item => {
    if (state.lastDeletedId !== item.id) {
      notifyEvent(
        "🗑️ Tarea eliminada",
        `Se eliminó: "${item.title}"`,
        "delete"
      );
    }
  });
  state.lastDeletedId = null;

  // 3. Tareas modificadas (completadas/editadas) por otros
  newItems.forEach(n => {
    const o = oldItems.find(item => item.id === n.id);
    if (o) {
      const updater = n.lastUpdatedBy || n.owner || "Alguien";
      if (updater.trim().toLowerCase() !== nickname) {
        if (o.done !== n.done) {
          if (n.done) {
            notifyEvent(
              "✅ Tarea completada",
              `👤 ${updater} completó: "${n.title}"`,
              "complete"
            );
          } else {
            notifyEvent(
              "🔄 Tarea reactivada",
              `👤 ${updater} desmarcó: "${n.title}"`
            );
          }
        } else if (o.updatedAt !== n.updatedAt) {
          notifyEvent(
            "✏️ Tarea editada",
            `👤 ${updater} editó: "${n.title}"`
          );
        }
      }
    }
  });
}

/* ---------- Carga inicial ---------- */
let isFirstSync = true;
function setupFirebaseSubscription(boardId) {
  if (state.syncUnsubscribe) {
    state.syncUnsubscribe();
    state.syncUnsubscribe = null;
  }
  isFirstSync = true;
  state.syncUnsubscribe = subscribeToBoard(boardId, (items) => {
    if (isFirstSync) {
      state.items = items;
      isFirstSync = false;
      render();
      requestNotificationPermission();
      return;
    }
    
    detectAndNotifyChanges(state.items, items);
    state.items = items;
    render();
  });
}

async function disconnectBoard() {
  if (state.syncUnsubscribe) {
    state.syncUnsubscribe();
    state.syncUnsubscribe = null;
  }
  state.activeBoardId = null;
  await setActiveBoardId(null);
  state.items = await getAllItems();
  render();
}

function makeBoardId() {
  return "RT-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function handleCreateBoard() {
  if (!state.syncNickname.trim()) {
    alert("Por favor, ingresa tu apodo primero.");
    return;
  }
  const newBoardId = makeBoardId();
  state.syncStatusMessage = "Creando tablero...";
  renderDrawer();
  
  const success = await createBoard(newBoardId, state.syncNickname);
  if (success) {
    state.activeBoardId = newBoardId;
    await setActiveBoardId(newBoardId);
    state.syncStatusMessage = "";
    setupFirebaseSubscription(newBoardId);
    renderDrawer();
    render();
  } else {
    state.syncStatusMessage = "Error al crear tablero en Firebase.";
    renderDrawer();
  }
}

async function handleJoinBoard(boardIdInput) {
  const bId = (boardIdInput || "").trim().toUpperCase();
  if (!bId) {
    alert("Por favor, ingresa un código de tablero.");
    return;
  }
  if (!state.syncNickname.trim()) {
    alert("Por favor, ingresa tu apodo primero.");
    return;
  }
  state.syncStatusMessage = "Buscando tablero...";
  renderDrawer();
  
  const exists = await checkBoardExists(bId);
  if (exists) {
    state.activeBoardId = bId;
    await setActiveBoardId(bId);
    state.syncStatusMessage = "";
    setupFirebaseSubscription(bId);
    renderDrawer();
    render();
  } else {
    state.syncStatusMessage = "El código de tablero no existe.";
    renderDrawer();
  }
}

async function init() {
  try {
    state.categories = await getMeta("categories", DEFAULT_CATEGORIES);
    state.soundOn = await getMeta("soundOn", false);

    state.isFirebaseConfigured = isFirebaseConfigured();
    state.activeBoardId = await getActiveBoardId();
    state.syncNickname = await getSyncNickname();

    if (state.isFirebaseConfigured && state.activeBoardId) {
      setupFirebaseSubscription(state.activeBoardId);
    } else {
      state.items = await getAllItems();
    }
  } catch (e) {
    console.error("Error cargando datos:", e);
    try {
      state.items = await getAllItems();
    } catch (_) {}
  }
  renderShell();
  render();
}

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
const catColor = (name) => state.categories.find((c) => c.name === name)?.color || "#7B6A53";
const activeFilters = () => (state.catFilter !== "Todo" ? 1 : 0) + (state.typeFilter !== "todos" ? 1 : 0);

/* ============================================================
 * RENDER DEL CASCARON (header + filtros + contenedores fijos)
 * Se dibuja una sola vez. La lista se actualiza aparte.
 * ============================================================ */
function renderShell() {
  const app = $("#app");
  app.innerHTML = "";

  // Header
  const header = el("header", { class: "pt-header" }, [
    el("div", { class: "pt-toprow" }, [
      el("div", { class: "pt-logo pt-pixel", html: "RETRO<b>TASKS</b>" }),
      el("div", { class: "pt-topbtns" }, [
        el("button", {
          class: "pt-sound", "aria-label": "Buscar", title: "Buscar",
          onclick: () => { state.searchOpen = !state.searchOpen; render(); },
        }, "\uD83D\uDD0D"),
        el("button", {
          class: "pt-sound", id: "btn-sound", "aria-label": "Sonido",
          onclick: async () => {
            state.soundOn = !state.soundOn;
            await setMeta("soundOn", state.soundOn);
            if (state.soundOn) playSound("create");
            render();
          },
        }, state.soundOn ? "\uD83D\uDD0A" : "\uD83D\uDD07"),
      ]),
    ]),
    el("div", { class: "pt-xpwrap" }, [
      el("div", { class: "pt-xptrack" }, [el("div", { class: "pt-xpfill", id: "xpfill" })]),
      el("div", { class: "pt-xpline", id: "xpline" }),
    ]),
  ]);

  // Zona de filtros (buscador + scope + boton filtros)
  const filters = el("div", { class: "pt-filters", id: "filters" });

  // Lista
  const list = el("main", { class: "pt-list", id: "list" });

  // Boton flotante
  const fab = el("div", { class: "pt-fab" }, [
    el("button", { onclick: () => openSheet(null) }, "+ Nuevo"),
  ]);

  app.append(header, filters, list, fab);
}

/* ============================================================
 * RENDER (actualiza lo que cambia: XP, filtros, lista)
 * ============================================================ */
function render() {
  renderXP();
  renderFilters();
  renderList();
  // Boton de sonido (icono cambia)
  const bs = $("#btn-sound");
  if (bs) bs.textContent = state.soundOn ? "\uD83D\uDD0A" : "\uD83D\uDD07";
}

function renderXP() {
  const completables = state.items.filter((i) => i.type !== "nota");
  const done = completables.filter((i) => i.done).length;
  const pct = completables.length ? Math.round((done / completables.length) * 100) : 0;
  const pend = completables.filter((i) => !i.done).length;
  $("#xpfill").style.width = pct + "%";
  const line = $("#xpline");
  line.innerHTML = "";
  line.append(
    el("span", { class: "pt-pixel" }, completables.length ? `${done}/${completables.length}` : "0/0"),
    el("span", {}, pend === 0 ? "Todo en orden \u2726" : `${pend} pendiente${pend > 1 ? "s" : ""}`)
  );
}

function renderFilters() {
  const box = $("#filters");
  box.innerHTML = "";

  if (state.searchOpen) {
    const wrap = el("div", { class: "pt-searchwrap" }, [
      el("input", {
        class: "pt-search", type: "search", value: state.query, autofocus: "true",
        placeholder: "Buscar por titulo o detalle...", "aria-label": "Buscar tareas",
        oninput: (e) => { state.query = e.target.value; renderList(); },
      }),
    ]);
    if (state.query) {
      wrap.append(el("button", {
        class: "pt-searchclear", "aria-label": "Limpiar busqueda",
        onclick: () => { state.query = ""; render(); },
      }, "\u2715"));
    }
    box.append(wrap);
  }

  const scopeRow = el("div", { class: "pt-scoperow" }, [
    el("div", { class: "pt-row pt-scope" },
      [["todo", "Todo"], ["hoy", "Hoy"], ["semana", "Semana"], ["sinfecha", "Sin fecha"]].map(([id, label]) =>
        el("button", {
          class: "pt-chip pt-scopechip", "aria-pressed": String(state.scope === id),
          onclick: () => { state.scope = id; render(); },
        }, label)
      )
    ),
    el("button", {
      class: "pt-filterbtn" + (activeFilters() > 0 ? " active" : ""),
      "aria-label": "Abrir filtros",
      onclick: () => openFilters(),
    }, "\u2699" + (activeFilters() > 0 ? ` ${activeFilters()}` : "")),
  ]);
  box.append(scopeRow);
}

function renderList() {
  const list = $("#list");
  list.innerHTML = "";
  const items = visibleItems();

  if (items.length === 0) {
    const empty = state.items.length === 0
      ? el("div", { class: "pt-empty" }, [
          el("div", { class: "pt-pixel" }, "NADA POR AQUI"),
          el("p", { html: 'No hay items todavia.<br>Toca "+ Nuevo" para empezar tu aventura del dia.' }),
        ])
      : el("div", { class: "pt-empty" }, [
          el("div", { class: "pt-pixel" }, "SIN RESULTADOS"),
          el("p", { html: "Ningun item coincide con el filtro o la busqueda.<br>Prueba ajustar el alcance o limpiar la busqueda." }),
        ]);
    list.append(empty);
    return;
  }

  items.forEach((it) => list.append(renderCard(it)));
}

function renderCard(it) {
  const prio = PRIORITIES.find((p) => p.id === it.priority);
  const due = dueStatus(it.due, it.done);
  const typeLabel = TYPES.find((t) => t.id === it.type)?.label;

  const badges = el("div", { class: "pt-badges" }, [
    el("span", { class: "pt-tag", style: { background: catColor(it.category) } }, it.category),
    el("span", { class: "pt-type" }, typeLabel),
    prio ? el("span", { class: "pt-prio", style: { background: prio.color } }, prio.label) : null,
    it.repeat && it.repeat !== "no"
      ? el("span", { class: "pt-repeat", title: `Se repite: ${it.repeat}` }, "\u27F3 " + it.repeat)
      : null,
    due ? el("span", { class: "pt-due", style: { background: due.color } }, due.label) : null,
    state.activeBoardId && it.owner && it.owner !== "local-user"
      ? el("span", { class: "pt-owner", title: `Creado por: ${it.owner}` }, `👤 ${it.owner}`)
      : null,
  ]);

  const actions = el("div", { class: "pt-actions" }, [
    it.type !== "nota"
      ? el("button", {
          class: "pt-act" + (it.done ? " on" : ""), "aria-pressed": String(it.done),
          onclick: () => toggleDone(it.id),
        }, it.done ? "\u2713 Hecho" : "Marcar")
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

  return el("article", { class: "pt-card" + (it.done ? " pt-done" : ""), "data-id": it.id }, [
    el("div", { class: "pt-stripe", style: { background: catColor(it.category) } }),
    body,
  ]);
}

/* ============================================================
 * ACCIONES (modifican estado + persisten + re-renderizan)
 * ============================================================ */
async function toggleDone(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  const willBeDone = !item.done;
  const isRecurring = willBeDone && item.repeat && item.repeat !== "no" && item.due;

  let updated;
  const user = state.syncNickname || "Anónimo";
  if (isRecurring) {
    updated = touchItem(item, { due: nextDate(item.due, item.repeat), lastUpdatedBy: user });
  } else {
    updated = touchItem(item, { done: !item.done, lastUpdatedBy: user });
  }

  if (state.activeBoardId) {
    await saveSharedItem(state.activeBoardId, updated);
  } else {
    state.items = state.items.map((i) => (i.id === id ? updated : i));
    await putItem(updated);
    render();
  }

  if (willBeDone) {
    sfx("complete");
    pulseCard(id); // tras render: la tarjeta ya esta en el DOM
  }
}

async function deleteItem(id) {
  sfx("delete");
  if (state.activeBoardId) {
    state.lastDeletedId = id; // Evitar disparar notificación de eliminación propia
    await deleteSharedItem(state.activeBoardId, id);
  } else {
    state.items = state.items.filter((i) => i.id !== id);
    await removeItem(id);
    render();
  }
}

async function saveFromSheet(data) {
  const user = state.syncNickname || "Anónimo";
  if (state.editing) {
    const updated = touchItem(state.editing, { ...data, lastUpdatedBy: user });
    if (state.activeBoardId) {
      await saveSharedItem(state.activeBoardId, updated);
    } else {
      state.items = state.items.map((i) => (i.id === state.editing.id ? updated : i));
      await putItem(updated);
    }
  } else {
    const item = createItem({ ...data, owner: user });
    if (state.activeBoardId) {
      await saveSharedItem(state.activeBoardId, item);
    } else {
      state.items = [item, ...state.items];
      await putItem(item);
    }
    sfx("create");
  }
  closeSheet();
  if (!state.activeBoardId) {
    render();
  }
}

async function addCategory(name) {
  const cat = { name, color: PALETTE[state.categories.length % PALETTE.length] };
  state.categories = [...state.categories, cat];
  await setMeta("categories", state.categories);
  return cat;
}

// Pequeño pulso visual al completar. render() ya volvio a pintar la
// lista, asi que buscamos la tarjeta por su data-id y le aplicamos
// la clase; se quita sola al terminar la animacion.
function pulseCard(id) {
  requestAnimationFrame(() => {
    const card = document.querySelector(`.pt-card[data-id="${id}"]`);
    if (!card) return;
    card.classList.add("justdone");
    card.addEventListener("animationend", () => card.classList.remove("justdone"), { once: true });
  });
}

/* ---------- Respaldo JSON ---------- */
function exportData() {
  const payload = { version: 1, exportedAt: new Date().toISOString(), items: state.items, categories: state.categories };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: `retrotasks-respaldo-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !Array.isArray(data.items)) {
        alert("Archivo invalido: no contiene una lista de items.");
        return;
      }
      const ok = window.confirm(
        `Esto reemplazara tus datos actuales (${state.items.length} items) por los del archivo (${data.items.length} items). No se puede deshacer. Continuar?`
      );
      if (!ok) return;
      state.items = data.items;
      await bulkReplaceItems(data.items);
      if (Array.isArray(data.categories) && data.categories.length) {
        state.categories = data.categories;
        await setMeta("categories", data.categories);
      }
      closeFilters();
      render();
    } catch (err) {
      alert("No se pudo leer el archivo. Verifica que sea un respaldo JSON valido.");
    }
  };
  reader.readAsText(file);
}

/* ============================================================
 * DRAWER DE FILTROS (categoria + tipo + respaldo)
 * ============================================================ */
function openFilters() { state.filtersOpen = true; renderDrawer(); }
function closeFilters() { state.filtersOpen = false; const d = $("#drawer-root"); if (d) d.remove(); }

function renderDrawer() {
  const existing = $("#drawer-root"); // limpia el drawer previo si lo hay
  if (existing) existing.remove();
  const root = el("div", { class: "pt-drawer-overlay", id: "drawer-root", onclick: closeFilters });
  const drawer = el("aside", { class: "pt-drawer", role: "dialog", "aria-label": "Filtros",
    onclick: (e) => e.stopPropagation() });

  drawer.append(
    el("div", { class: "pt-drawer-head" }, [
      el("h2", { class: "pt-pixel" }, "FILTROS"),
      el("button", { class: "pt-drawer-x", "aria-label": "Cerrar", onclick: closeFilters }, "\u2715"),
    ])
  );

  // Categoria
  const catPills = el("div", { class: "pt-pills" }, [
    el("button", { class: "pt-pill", "aria-pressed": String(state.catFilter === "Todo"),
      onclick: () => { state.catFilter = "Todo"; renderDrawer(); render(); } }, "Todas"),
    ...state.categories.map((c) =>
      el("button", {
        class: "pt-pill tinted", "aria-pressed": String(state.catFilter === c.name),
        style: state.catFilter === c.name ? { background: c.color } : {},
        onclick: () => { state.catFilter = c.name; renderDrawer(); render(); },
      }, c.name)
    ),
  ]);
  drawer.append(el("div", { class: "pt-drawer-sec" }, [
    el("label", { class: "pt-drawer-label" }, "Categoria"), catPills,
  ]));

  // Tipo
  const typePills = el("div", { class: "pt-pills" }, [
    el("button", { class: "pt-pill", "aria-pressed": String(state.typeFilter === "todos"),
      onclick: () => { state.typeFilter = "todos"; renderDrawer(); render(); } }, "Todos"),
    ...TYPES.map((t) =>
      el("button", { class: "pt-pill", "aria-pressed": String(state.typeFilter === t.id),
        onclick: () => { state.typeFilter = t.id; renderDrawer(); render(); } }, t.label)
    ),
  ]);
  drawer.append(el("div", { class: "pt-drawer-sec" }, [
    el("label", { class: "pt-drawer-label" }, "Tipo"), typePills,
  ]));

  // Cooperación (Firebase)
  if (!state.isFirebaseConfigured) {
    drawer.append(el("div", { class: "pt-drawer-sec" }, [
      el("label", { class: "pt-drawer-label" }, "Cooperación Pixel"),
      el("div", { class: "pt-hint", style: { color: "#D94343", fontStyle: "normal", fontWeight: "bold" } }, 
        "⚠️ Configuración requerida: Edita el archivo `js/firebase.js` con las credenciales de tu proyecto de Firebase para habilitar el modo cooperativo."
      ),
    ]));
  } else {
    const syncBox = el("div", { class: "pt-drawer-sec" });
    syncBox.append(el("label", { class: "pt-drawer-label" }, "Cooperación Pixel"));
    
    const nameInput = el("input", {
      type: "text",
      class: "pt-input",
      style: { "margin-bottom": "8px", "padding": "6px", "width": "100%" },
      placeholder: "Tu apodo (ej: Juan)",
      value: state.syncNickname,
      oninput: async (e) => {
        state.syncNickname = e.target.value;
        await setSyncNickname(state.syncNickname);
      }
    });
    
    syncBox.append(el("div", { style: { "margin-bottom": "8px" } }, [
      el("div", { class: "pt-hint", style: { "margin-bottom": "4px" } }, "Escribe tu nombre para identificar tus tareas:"),
      nameInput
    ]));

    if (state.activeBoardId) {
      syncBox.append(el("div", {}, [
        el("div", { class: "pt-hint", style: { "color": "#5BA84F", "font-weight": "bold", "margin-bottom": "8px" } }, 
          `🟢 Conectado al Tablero: ${state.activeBoardId}`
        ),
        el("div", { class: "pt-pills" }, [
          el("button", {
            class: "pt-pill del",
            onclick: () => {
              if (confirm("¿Estás seguro de desconectarte del tablero? Volverás a tus tareas locales.")) {
                disconnectBoard();
                renderDrawer();
              }
            }
          }, "Desconectar")
        ])
      ]));
    } else {
      const boardInput = el("input", {
        type: "text",
        class: "pt-input",
        style: { "width": "120px", "text-transform": "uppercase", "margin-right": "8px", "padding": "6px" },
        placeholder: "RT-XXXX"
      });

      const joinBtn = el("button", {
        class: "pt-pill",
        onclick: () => {
          handleJoinBoard(boardInput.value);
        }
      }, "Unirse");

      const createBtn = el("button", {
        class: "pt-pill tinted",
        style: { "background": "var(--soil-d)", "color": "#fff" },
        onclick: () => {
          handleCreateBoard();
        }
      }, "+ Crear Tablero");

      syncBox.append(el("div", {}, [
        el("div", { class: "pt-hint", style: { "margin-bottom": "8px" } }, "Tablero actual: 📁 Local (Solo tú)"),
        el("div", { style: { "display": "flex", "align-items": "center", "margin-bottom": "8px" } }, [
          boardInput,
          joinBtn
        ]),
        el("div", {}, [createBtn])
      ]));
    }

    if (state.syncStatusMessage) {
      syncBox.append(el("div", { class: "pt-hint", style: { "color": "#E0A02E", "margin-top": "6px" } }, state.syncStatusMessage));
    }

    drawer.append(syncBox);
  }

  // Datos / respaldo
  const importLabel = el("label", { class: "pt-pill", style: { cursor: "pointer" } }, "\u2912 Importar");
  importLabel.append(el("input", {
    type: "file", accept: "application/json,.json", style: { display: "none" },
    onchange: (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; },
  }));
  drawer.append(el("div", { class: "pt-drawer-sec" }, [
    el("label", { class: "pt-drawer-label" }, "Datos (respaldo)"),
    el("div", { class: "pt-pills" }, [
      el("button", { class: "pt-pill", onclick: exportData }, "\u2913 Exportar"),
      importLabel,
    ]),
    el("div", { class: "pt-hint" }, "Sin sincronizacion en la nube: exporta de vez en cuando para no perder tus datos."),
  ]));

  // Acciones
  drawer.append(el("div", { class: "pt-drawer-acts" }, [
    el("button", { class: "pt-cancel", disabled: activeFilters() === 0 ? "true" : null,
      onclick: () => { state.catFilter = "Todo"; state.typeFilter = "todos"; renderDrawer(); render(); } }, "Limpiar"),
    el("button", { class: "pt-save", onclick: closeFilters }, "Aplicar"),
  ]));

  root.append(drawer);
  document.body.append(root);
}

/* ============================================================
 * HOJA DE CREACION / EDICION (bottom sheet)
 * ============================================================ */
function openSheet(item) { state.editing = item; state.sheetOpen = true; renderSheet(); }
function closeSheet() { state.editing = null; state.sheetOpen = false; const s = $("#sheet-root"); if (s) s.remove(); }

function renderSheet() {
  const old = $("#sheet-root"); if (old) old.remove();
  const init = state.editing;

  // Estado local del formulario
  const form = {
    type: init?.type || "tarea",
    category: init?.category || (state.catFilter !== "Todo" ? state.catFilter : state.categories[0]?.name),
    priority: init?.priority || "media",
    title: init?.title || "",
    detail: init?.detail || "",
    due: init?.due || "",
    repeat: init?.repeat || "no",
  };
  let cats = [...state.categories];

  const root = el("div", { class: "pt-overlay", id: "sheet-root", onclick: closeSheet });
  const sheet = el("div", { class: "pt-sheet", onclick: (e) => e.stopPropagation() });

  const rerender = () => { renderSheet._rebuild(); };

  function build() {
    sheet.innerHTML = "";
    sheet.append(el("h2", { class: "pt-pixel" }, init ? "EDITAR ITEM" : "NUEVO ITEM"));

    // Tipo
    sheet.append(field("Tipo", el("div", { class: "pt-pills" },
      TYPES.map((t) => el("button", { class: "pt-pill", "aria-pressed": String(form.type === t.id),
        onclick: () => { form.type = t.id; build(); } }, t.label))
    )));

    // Categoria
    const catPills = el("div", { class: "pt-pills" }, [
      ...cats.map((c) => el("button", {
        class: "pt-pill tinted", "aria-pressed": String(form.category === c.name),
        style: form.category === c.name ? { background: c.color } : {},
        onclick: () => { form.category = c.name; build(); },
      }, c.name)),
      el("button", { class: "pt-pill", onclick: async () => {
        const name = (prompt("Nombre de la nueva categoria:") || "").trim();
        if (!name) return;
        if (!cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
          const cat = await addCategory(name);
          cats.push(cat);
        }
        form.category = name; build();
      } }, "+ Categoria"),
    ]);
    sheet.append(field("Categoria", catPills));

    // Prioridad (no en notas)
    if (form.type !== "nota") {
      sheet.append(field("Prioridad", el("div", { class: "pt-pills" },
        PRIORITIES.map((p) => el("button", {
          class: "pt-pill tinted", "aria-pressed": String(form.priority === p.id),
          style: form.priority === p.id ? { background: p.color } : {},
          onclick: () => { form.priority = p.id; build(); },
        }, p.label))
      )));
    }

    // Titulo
    const titleInput = el("input", { class: "pt-input", value: form.title,
      placeholder: form.type === "recordatorio" ? "Ej: Llamar al dentista" : "Ej: Corregir evaluaciones",
      oninput: (e) => { form.title = e.target.value; } });
    sheet.append(field(form.type === "nota" ? "Titulo de la nota" : "Que hay que hacer?", titleInput));

    // Detalle
    const detailInput = el("textarea", { class: "pt-textarea", placeholder: "Notas, contexto, subtareas...",
      oninput: (e) => { form.detail = e.target.value; } });
    detailInput.value = form.detail;
    sheet.append(field("Detalle (opcional)", detailInput));

    // Fecha (no en notas)
    if (form.type !== "nota") {
      const dateInput = el("input", { type: "datetime-local", class: "pt-date", value: form.due,
        oninput: (e) => { form.due = e.target.value; build(); } });
      sheet.append(field("Fecha limite (opcional)", dateInput));

      // Repetir (solo si hay fecha)
      if (form.due) {
        const rep = el("div", {}, [
          el("div", { class: "pt-pills" }, REPEATS.map((r) =>
            el("button", { class: "pt-pill", "aria-pressed": String(form.repeat === r.id),
              onclick: () => { form.repeat = r.id; build(); } }, r.label))),
          form.repeat !== "no"
            ? el("div", { class: "pt-hint" }, "Al marcarla como hecha, saltara a la siguiente fecha en vez de completarse.")
            : null,
        ]);
        sheet.append(field("Repetir", rep));
      }
    }

    // Acciones
    const err = el("div", { class: "pt-err", style: { display: "none" } }, "El titulo es obligatorio.");
    const saveBtn = el("button", { class: "pt-save", onclick: () => {
      if (!form.title.trim()) { err.style.display = "block"; return; }
      saveFromSheet({
        type: form.type, category: form.category, priority: form.priority,
        title: form.title, detail: form.detail,
        due: form.type === "nota" ? "" : form.due,
        repeat: form.type !== "nota" && form.due ? form.repeat : "no",
      });
    } }, init ? "Guardar cambios" : "Crear");
    sheet.append(err);
    sheet.append(el("div", { class: "pt-sheetacts" }, [
      saveBtn,
      el("button", { class: "pt-cancel", onclick: closeSheet }, "Cancelar"),
    ]));
  }

  renderSheet._rebuild = build;
  build();
  root.append(sheet);
  document.body.append(root);
}

function field(labelText, control) {
  return el("div", { class: "pt-field" }, [
    el("label", {}, labelText),
    control,
  ]);
}

/* ---------- Arranque ---------- */
init();
