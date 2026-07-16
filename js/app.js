/* ============================================================
 * app.js — Controlador principal de RetroTasks v2 (Retro Moderno)
 *
 * CAMBIOS v2:
 *  - Integración de Firebase Auth (login por email y Google)
 *  - Navegación inferior con 4 Tabs (Inicio, Tableros, Alertas, Perfil)
 *  - Sincronización de tareas personales en users/{uid}/items/
 *  - Soporte de Temas con persistencia en IndexedDB y Firebase
 *  - Registro y recepción de Notificaciones Push nativas (FCM)
 *  - Íconos vectoriales SVG en estilo pixel art para barra de navegación
 *  - Gestos táctiles de deslizamiento (Swipe) para completar/eliminar
 *  - Alarmas de vencimiento con notificaciones nativas/locales
 *  - Guía de aventura para nuevos usuarios omitible
 *  - Solucionado bloqueo de arrastre anulando animación CSS en 'animationend'
 *  - Íconos superiores (Lupa y Sonido) reemplazados por SVG pixelados nativos
 *  - Selector de 10 avatares pixel art RPG en la pestaña Perfil
 * ============================================================ */

import {
  getMeta, setMeta, getActiveBoardId, setActiveBoardId
} from "./db.js";
import {
  TYPES, PRIORITIES, REPEATS, DEFAULT_CATEGORIES, PALETTE,
  createItem, touchItem, fmtDate, nextDate, dueStatus, inScope, sortItems,
} from "./model.js";
import { playSound } from "./sound.js";
import {
  isFirebaseConfigured, checkBoardExists, createBoard,
  saveSharedItem, deleteSharedItem, subscribeToBoard,
  saveUserItem, deleteUserItem, subscribeToUserItems, initFirebase
} from "./firebase.js";
import {
  watchAuthState, loginWithGoogle, loginWithEmail, registerWithEmail, logout, getCurrentUser
} from "./auth.js";
import {
  THEMES, initTheme, changeTheme
} from "./theme.js";
import {
  initPushNotifications
} from "./notifications.js";
import {
  doc, setDoc, getDoc
} from "./vendor/firebase-firestore.js";

/* ---------- Estado en memoria ---------- */
const state = {
  // Auth
  user: null,
  isAuthLoading: true,
  authMode: "login", // login | register
  authError: "",
  avatarId: 1, // ID de avatar seleccionado (1-10)

  // Datos
  items: [],
  categories: DEFAULT_CATEGORIES,
  soundOn: false,
  activeTab: "home", // home | boards | alerts | profile

  // Filtros
  catFilter: "Todo",
  typeFilter: "todos",
  scope: "todo",
  query: "",
  searchOpen: false,
  filtersOpen: false,
  editing: null,
  sheetOpen: false,

  // Cooperativo / Tableros
  activeBoardId: null,
  syncNickname: "",
  syncStatusMessage: "",
  lastDeletedId: null,

  // Alertas / Notificaciones recibidas localmente
  alerts: [],

  // Unsubscribers de Firebase
  syncUnsubscribe: null,
  userItemsUnsubscribe: null,
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);

// Generador de elementos DOM
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

// Función global para que notifications.js pueda mostrar toasts en primer plano
window.showLocalToast = (message) => {
  showToast(message);
  // Guardar en el historial de alertas
  state.alerts.unshift({
    id: Date.now(),
    message,
    timestamp: new Date().toISOString()
  });
  // Guardar en IndexedDB
  setMeta("alerts", state.alerts);
  if (state.activeTab === "alerts") render();
};

/* ---------- Inicialización de la aplicación ---------- */
async function init() {
  // Inicializar Firebase
  initFirebase();

  // Cargar preferencias guardadas localmente
  state.soundOn = await getMeta("soundOn", false);
  state.categories = await getMeta("categories", DEFAULT_CATEGORIES);
  state.activeBoardId = await getActiveBoardId();
  state.alerts = await getMeta("alerts", []);

  // Cargar e iniciar el tema visual seleccionado
  await initTheme(getMeta);

  // Escuchar cambios de autenticación
  watchAuthState(async (user) => {
    state.isAuthLoading = false;
    if (user) {
      state.user = user;
      state.syncNickname = user.displayName || "Aventurero";
      
      // Suscribirse a las tareas personales en Firestore
      setupUserItemsSubscription(user.uid);

      // Si hay un tablero compartido activo, suscribirse a él
      if (state.activeBoardId) {
        setupBoardSubscription(state.activeBoardId);
      }

      // Inicializar notificaciones push nativas si está en Android
      initPushNotifications(user.uid);

      // Inicializar alarmas de tareas
      initAlarms();

      // Verificar si hay que mostrar el prompt de la Guía de Aventura y cargar avatar
      const db = initFirebase();
      if (db) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            state.avatarId = userData.preferences?.avatarId || 1;
            if (userData.preferences && userData.preferences.showTutorialPrompt) {
              showTutorialModal(user.uid);
            }
          } else {
            state.avatarId = 1;
          }
        } catch (e) {
          console.warn("Error al buscar preferencias del usuario:", e);
          state.avatarId = 1;
        }
      }
    } else {
      // Limpiar estado y desuscribirse
      state.user = null;
      state.items = [];
      state.avatarId = 1;
      if (state.syncUnsubscribe) {
        state.syncUnsubscribe();
        state.syncUnsubscribe = null;
      }
      if (state.userItemsUnsubscribe) {
        state.userItemsUnsubscribe();
        state.userItemsUnsubscribe = null;
      }
    }
    renderShell();
    render();
  });
}

/* ---------- Alertas y Alarmas de Vencimiento ---------- */
let notifiedTasks = new Set();

async function initAlarms() {
  const savedNotified = await getMeta("notifiedTasks", []);
  notifiedTasks = new Set(savedNotified);

  // Revisar tareas cada 30 segundos
  setInterval(() => {
    checkDueTasks();
  }, 30000);
}

async function checkDueTasks() {
  if (state.items.length === 0) return;
  const now = new Date();

  state.items.forEach(async (item) => {
    if (item.type !== "nota" && item.due && !item.done) {
      const dueDate = new Date(item.due);
      if (dueDate <= now && !notifiedTasks.has(item.id)) {
        notifiedTasks.add(item.id);
        await setMeta("notifiedTasks", Array.from(notifiedTasks));

        // Notificación visual y sonido en la app
        notifyEvent("🚨 Misión Expirada", `¡El tiempo límite para "${item.title}" ha terminado!`, "delete");

        // Notificación de sistema (Android)
        sendDesktopNotification("🚨 RetroTasks: Misión Expirada", `¡El tiempo límite para "${item.title}" ha expirado!`);
      }
    }
  });
}

/* ---------- Guía de Aventura (Tutorial) ---------- */
function showTutorialModal(uid) {
  // Evitar duplicados del modal
  if ($("#tutorial-root")) return;

  const root = el("div", { class: "pt-overlay", id: "tutorial-root" });
  const modal = el("div", { 
    class: "pt-sheet", 
    style: { 
      maxWidth: '380px', 
      textAlign: 'center', 
      padding: '24px', 
      borderRadius: '8px',
      border: '3px solid var(--accent)',
      boxShadow: '0 8px 0 rgba(0,0,0,0.4)'
    } 
  }, [
    el("h2", { class: "pt-pixel", style: { fontSize: '10px', color: 'var(--accent)', marginBottom: '16px' } }, "⚔️ NUEVA AVENTURA ⚔️"),
    el("p", { style: { fontSize: '14.5px', lineHeight: '1.6', marginBottom: '24px', color: 'var(--text-primary)' } }, 
      "¿Deseas iniciar la Guía de Aventura para aprender a dominar tus misiones, o prefieres comenzar tu viaje solo?"
    ),
    el("div", { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
      el("button", { 
        class: "pt-save", 
        style: { width: '100%' },
        onclick: async () => {
          await startAdventureGuide(uid);
          root.remove();
        } 
      }, "INICIAR GUÍA"),
      el("button", { 
        class: "pt-cancel", 
        style: { width: '100%' },
        onclick: async () => {
          await skipAdventureGuide(uid);
          root.remove();
        } 
      }, "SALTAR TUTORIAL")
    ])
  ]);

  root.append(modal);
  document.body.append(root);
}

async function startAdventureGuide(uid) {
  const tutorials = [
    { id: "tut-1", type: "tarea", category: "Personal", priority: "alta", title: "🛡️ Crea tu primera misión", detail: "Presiona el botón '+' de abajo para crear una nueva misión.", done: false },
    { id: "tut-2", type: "tarea", category: "Personal", priority: "media", title: "🧭 Desliza esta tarjeta", detail: "Desliza esta tarjeta hacia la derecha para completarla, o a la izquierda para borrarla.", done: false },
    { id: "tut-3", type: "tarea", category: "Personal", priority: "baja", title: "🔮 Cambia tu Skin en Perfil", detail: "Ve a la pestaña Perfil (👤) y elige un nuevo color de tema.", done: false },
    { id: "tut-4", type: "tarea", category: "Personal", priority: "media", title: "🤝 Conéctate con un aliado", detail: "Crea o únete a un tablero colaborativo en la pestaña Tableros (🤝).", done: false }
  ];

  const db = initFirebase();
  if (!db) return;

  for (const item of tutorials) {
    const formattedItem = createItem({ ...item, owner: "Guía de Aventura" });
    await saveUserItem(uid, formattedItem);
  }

  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      preferences: { showTutorialPrompt: false }
    }, { merge: true });
    console.log("Guía de Aventura cargada correctamente.");
  } catch (e) {
    console.error("Error al actualizar estado del tutorial:", e);
  }
}

async function skipAdventureGuide(uid) {
  const db = initFirebase();
  if (!db) return;
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      preferences: { showTutorialPrompt: false }
    }, { merge: true });
    console.log("Tutorial omitido.");
  } catch (e) {
    console.error("Error al omitir el tutorial:", e);
  }
}

/* ---------- Suscripciones Firebase ---------- */

// Tareas personales
function setupUserItemsSubscription(uid) {
  if (state.userItemsUnsubscribe) {
    state.userItemsUnsubscribe();
  }
  // Sincronización en tiempo real con Firestore para tareas personales
  state.userItemsUnsubscribe = subscribeToUserItems(uid, (items) => {
    if (!state.activeBoardId) {
      state.items = items;
      render();
    }
  });
}

// Tareas de tablero cooperativo
function setupBoardSubscription(boardId) {
  if (state.syncUnsubscribe) {
    state.syncUnsubscribe();
    state.syncUnsubscribe = null;
  }

  let isFirstSync = true;
  state.syncUnsubscribe = subscribeToBoard(boardId, (items) => {
    if (isFirstSync) {
      state.items = items;
      isFirstSync = false;
      render();
      return;
    }

    // Si hay cambios de otros, notificar en tiempo real
    detectAndNotifyChanges(state.items, items);
    state.items = items;
    render();
  });
}

// Detiene la sincronización colaborativa y vuelve al modo personal
async function disconnectBoard() {
  if (state.syncUnsubscribe) {
    state.syncUnsubscribe();
    state.syncUnsubscribe = null;
  }
  state.activeBoardId = null;
  await setActiveBoardId(null);

  // Volver a cargar las tareas personales desde la suscripción
  if (state.user) {
    state.items = await getUserItems(state.user.uid);
  } else {
    state.items = [];
  }
  render();
}

/* ---------- Notificaciones Locales y Detección de Cambios ---------- */
function showToast(message) {
  let container = $(".pt-toast-container");
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

function notifyEvent(title, message, soundName = "notify") {
  sfx(soundName);
  showToast(message);
  // Guardar en alertas
  state.alerts.unshift({
    id: Date.now(),
    message,
    timestamp: new Date().toISOString()
  });
  setMeta("alerts", state.alerts);
}

function detectAndNotifyChanges(oldItems, newItems) {
  const nickname = (state.syncNickname || "").trim().toLowerCase();
  
  // 1. Tareas creadas por otros
  const added = newItems.filter(n => !oldItems.some(o => o.id === n.id));
  added.forEach(item => {
    const creator = item.owner || "Alguien";
    if (creator.trim().toLowerCase() !== nickname) {
      notifyEvent("➕ Tarea nueva", `👤 ${creator} creó: "${item.title}"`, "create");
    }
  });

  // 2. Tareas eliminadas por otros
  const deleted = oldItems.filter(o => !newItems.some(n => n.id === o.id));
  deleted.forEach(item => {
    if (state.lastDeletedId !== item.id) {
      notifyEvent("🗑️ Tarea eliminada", `Se eliminó: "${item.title}"`, "delete");
    }
  });
  state.lastDeletedId = null;

  // 3. Tareas modificadas por otros
  newItems.forEach(n => {
    const o = oldItems.find(item => item.id === n.id);
    if (o) {
      const updater = n.lastUpdatedBy || n.owner || "Alguien";
      if (updater.trim().toLowerCase() !== nickname) {
        if (o.done !== n.done) {
          if (n.done) {
            notifyEvent("✅ Tarea completada", `👤 ${updater} completó: "${n.title}"`, "complete");
          } else {
            notifyEvent("🔄 Tarea reactivada", `👤 ${updater} desmarcó: "${n.title}"`);
          }
        } else if (o.updatedAt !== n.updatedAt) {
          notifyEvent("✏️ Tarea editada", `👤 ${updater} editó: "${n.title}"`);
        }
      }
    }
  });
}

/* ---------- Acciones del Tablero ---------- */
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
  render();
  
  const success = await createBoard(newBoardId, state.syncNickname, state.user?.uid);
  if (success) {
    state.activeBoardId = newBoardId;
    await setActiveBoardId(newBoardId);
    state.syncStatusMessage = "";
    setupBoardSubscription(newBoardId);
  } else {
    state.syncStatusMessage = "Error al crear tablero en Firebase.";
  }
  render();
}

async function handleJoinBoard(boardIdInput) {
  const bId = (boardIdInput || "").trim().toUpperCase();
  if (!bId) {
    alert("Por favor, ingresa un código de tablero.");
    return;
  }
  state.syncStatusMessage = "Buscando tablero...";
  render();
  
  const exists = await checkBoardExists(bId);
  if (exists) {
    state.activeBoardId = bId;
    await setActiveBoardId(bId);
    state.syncStatusMessage = "";
    setupBoardSubscription(bId);
  } else {
    state.syncStatusMessage = "El código de tablero no existe.";
  }
  render();
}

/* ---------- Operaciones con Tareas/Items ---------- */
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
  } else if (state.user) {
    await saveUserItem(state.user.uid, updated);
  } else {
    state.items = state.items.map((i) => (i.id === id ? updated : i));
    render();
  }

  if (willBeDone) {
    sfx("complete");
    pulseCard(id);
    createXpParticles(id);
  }
}

async function deleteItem(id) {
  sfx("delete");
  if (state.activeBoardId) {
    state.lastDeletedId = id;
    await deleteSharedItem(state.activeBoardId, id);
  } else if (state.user) {
    await deleteUserItem(state.user.uid, id);
  } else {
    state.items = state.items.filter((i) => i.id !== id);
    render();
  }
}

async function saveFromSheet(data) {
  const user = state.syncNickname || "Anónimo";
  if (state.editing) {
    const updated = touchItem(state.editing, { ...data, lastUpdatedBy: user });
    if (state.activeBoardId) {
      await saveSharedItem(state.activeBoardId, updated);
    } else if (state.user) {
      await saveUserItem(state.user.uid, updated);
    }
  } else {
    const item = createItem({ ...data, owner: user });
    if (state.activeBoardId) {
      await saveSharedItem(state.activeBoardId, item);
    } else if (state.user) {
      await saveUserItem(state.user.uid, item);
    }
    sfx("create");
  }
  closeSheet();
  render();
}

async function addCategory(name) {
  const cat = { name, color: PALETTE[state.categories.length % PALETTE.length] };
  state.categories = [...state.categories, cat];
  await setMeta("categories", state.categories);
  return cat;
}

function pulseCard(id) {
  requestAnimationFrame(() => {
    const card = $(`.pt-card[data-id="${id}"]`);
    if (!card) return;
    card.classList.add("justdone");
    card.addEventListener("animationend", () => card.classList.remove("justdone"), { once: true });
  });
}

function createXpParticles(id) {
  const card = $(`.pt-card[data-id="${id}"]`);
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const container = document.body;

  for (let i = 0; i < 6; i++) {
    const p = el("div", {
      style: {
        position: 'fixed',
        left: `${rect.left + rect.width / 2}px`,
        top: `${rect.top + rect.height / 2}px`,
        width: '8px',
        height: '8px',
        background: '#FFD24A',
        pointerEvents: 'none',
        zIndex: '100',
        borderRadius: '50%',
        boxShadow: '0 0 6px #FFD24A',
        '--tx': `${(Math.random() - 0.5) * 120}px`,
        '--ty': `${-Math.random() * 80 - 20}px`,
        animation: 'pt-particle 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards'
      }
    });
    p.addEventListener("animationend", () => p.remove());
    container.appendChild(p);
  }
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
 * RENDERIZACIÓN DE VISTAS (SHELL + TABS)
 * ============================================================ */

// Render del cascarón (Header + Main Container + Nav Bar)
function renderShell() {
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

  // Iconos del Sound en formato pixel SVG nativo
  const soundOnSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" style="width: 18px; height: 18px;"><path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  const soundOffSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" style="width: 18px; height: 18px;"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/></svg>`;

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

  // Barra de navegación inferior con íconos vectoriales SVG en lugar de emojis
  const nav = el("nav", { class: "pt-bottom-nav" }, [
    createNavItem("home", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"><path d="M4 11V20H9V15H15V20H20V11L12 4L4 11Z"/></svg>`, "Inicio"),
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
function render() {
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
    
    if (state.activeTab === "boards") {
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
    const soundOnSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" style="width: 18px; height: 18px;"><path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
    const soundOffSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" style="width: 18px; height: 18px;"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/></svg>`;
    soundSpan.innerHTML = state.soundOn ? soundOnSvg : soundOffSvg;
  }
}

/* ---------- Vistas de Navegación ---------- */

// Vista Home: Lista de tareas
function renderHomeList() {
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

// Vista Tableros: Colaboración
function renderBoardsView(container) {
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
            render();
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

// Vista Alertas: Historial de notificaciones
function renderAlertsView(container) {
  container.innerHTML = "";

  const titleRow = el("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' } }, [
    el("h2", { class: "pt-pixel", style: { fontSize: '11px', color: 'var(--accent)' } }, "HISTORIAL DE EVENTOS"),
    state.alerts.length > 0 ? el("button", {
      class: "pt-act del",
      onclick: () => {
        state.alerts = [];
        setMeta("alerts", []);
        render();
      }
    }, "Limpiar") : null
  ]);

  const list = el("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });

  if (state.alerts.length === 0) {
    list.append(
      el("div", { class: "pt-empty" }, [
        el("div", { class: "pt-pixel", style: { fontSize: '10px' } }, "SIN NOVEDADES"),
        el("p", { html: "Aquí aparecerán las alertas cuando tus colaboradores realicen cambios." })
      ])
    );
  } else {
    state.alerts.forEach((alert) => {
      const card = el("div", {
        class: "pt-card",
        style: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }
      }, [
        el("div", { style: { fontSize: '13px', fontWeight: '700' } }, alert.message),
        el("div", { style: { fontSize: '10px', color: 'var(--text-muted)' } }, fmtDate(alert.timestamp))
      ]);
      list.append(card);
    });
  }

  container.append(titleRow, list);
}

// Vista Perfil: Ajustes, Avatares y Temas
function renderProfileView(container) {
  container.innerHTML = "";

  const title = el("h2", { class: "pt-pixel", style: { fontSize: '11px', color: 'var(--accent)', marginBottom: '14px' } }, "PERFIL DEL AVENTURERO");

  const personalMissions = state.items.filter(i => i.type !== "nota");
  const completedCount = personalMissions.filter(i => i.done).length;

  // Cargar imagen de avatar seleccionada
  const avatarSrc = `./icons/avatar-${state.avatarId || 1}.png`;

  const hero = el("div", { class: "pt-profile-hero" }, [
    el("img", { class: "pt-avatar", src: avatarSrc, alt: "Avatar" }),
    el("div", { class: "pt-profile-name" }, state.syncNickname),
    el("div", { class: "pt-profile-email" }, state.user.email || "Registro local")
  ]);

  const stats = el("div", { class: "pt-stats-row" }, [
    createStatCard(String(completedCount), "Hechas"),
    createStatCard(String(state.items.length), "Misiones"),
    createStatCard(state.activeBoardId ? "Sync" : "Local", "Modo")
  ]);

  // Contenedor del Selector de Avatares (10 personajes pixel-art)
  const avatarSec = el("div", { class: "pt-profile-hero", style: { gap: '14px', alignItems: 'stretch' } }, [
    el("div", { class: "pt-stat-label", style: { textAlign: 'center' } }, "Selección de Avatar"),
    el("div", { class: "pt-theme-grid", style: { gridTemplateColumns: 'repeat(5, 1fr)' } }, 
      Array.from({ length: 10 }).map((_, idx) => {
        const id = idx + 1;
        const isActive = (state.avatarId || 1) === id;
        return el("button", {
          class: "pt-avatar-option" + (isActive ? " active" : ""),
          onclick: async () => {
            state.avatarId = id;
            // Guardar en Firestore
            const db = initFirebase();
            if (db && state.user) {
              const userRef = doc(db, "users", state.user.uid);
              await setDoc(userRef, {
                preferences: { avatarId: id }
              }, { merge: true });
            }
            render();
          }
        }, [
          el("img", { src: `./icons/avatar-${id}.png` })
        ]);
      })
    )
  ]);

  // Contenedor de Temas
  const activeThemeId = document.body.className.replace('theme-', '') || 'fogata';
  
  const themeSec = el("div", { class: "pt-profile-hero", style: { gap: '14px', alignItems: 'stretch' } }, [
    el("div", { class: "pt-stat-label", style: { textAlign: 'center' } }, "Selección de Skin / Tema"),
    el("div", { class: "pt-theme-grid" }, 
      THEMES.map((theme) => {
        const isActive = activeThemeId === theme.id;
        return el("button", {
          class: "pt-theme-dot" + (isActive ? " active" : ""),
          style: { background: theme.bg },
          onclick: async () => {
            await changeTheme(theme.id, setMeta);
            render();
          }
        }, theme.emoji);
      })
    )
  ]);

  const actions = el("div", { class: "pt-settings-list" }, [
    el("button", {
      class: "pt-settings-item danger",
      style: { width: '100%' },
      onclick: async () => {
        if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
          await logout();
        }
      }
    }, [
      el("span", { class: "pt-settings-icon", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" style="width: 18px; height: 18px; color: var(--red);"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>` }),
      el("span", {}, "Cerrar Sesión")
    ])
  ]);

  container.append(title, hero, stats, avatarSec, themeSec, actions);
}

function createStatCard(value, label) {
  return el("div", { class: "pt-stat-card" }, [
    el("div", { class: "pt-stat-value" }, value),
    el("div", { class: "pt-stat-label" }, label)
  ]);
}

/* ============================================================
 * COMPONENTES DE INTERFAZ
 * ============================================================ */

// Card de tarea individual con soporte para Gestos Swipe
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
      el("span", {}, pend === 0 ? "Todo en orden \u2726" : `${pend} pendiente${pend > 1 ? "s" : ""}`)
    );
  }
}

// Filtros superiores en pantalla
function renderFilters() {
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
        onclick: () => { state.query = ""; render(); },
      }, "\u2715"));
    }
    box.append(wrap);
  }

  // Scope row (filtros rápidos de tiempo)
  const scopeRow = el("div", { class: "pt-scoperow" }, [
    el("div", { class: "pt-row pt-scope" },
      [["todo", "Todo"], ["hoy", "Hoy"], ["semana", "Semana"], ["sinfecha", "Sin fecha"]].map(([id, label]) =>
        el("button", {
          class: "pt-chip pt-scopechip", "aria-pressed": String(state.scope === id),
          onclick: () => { state.scope = id; render(); },
        }, label)
      )
    ),
    // Botón filtros avanzados (abre el Drawer lateral)
    el("button", {
      class: "pt-filterbtn" + (activeFilters() > 0 ? " active" : ""),
      "aria-label": "Abrir filtros",
      onclick: () => openFilters(),
    }, "\u2699" + (activeFilters() > 0 ? ` ${activeFilters()}` : "")),
  ]);
  box.append(scopeRow);
}

/* ============================================================
 * SCREEN: AUTENTICACIÓN
 * ============================================================ */
function renderAuthScreen(container) {
  const errorNode = el("div", { class: "pt-auth-error" }, state.authError);
  
  const emailInput = el("input", {
    type: "email", class: "pt-auth-input", placeholder: "Correo electrónico", required: "true"
  });
  
  const passwordInput = el("input", {
    type: "password", class: "pt-auth-input", placeholder: "Contraseña", required: "true"
  });

  const nameInput = el("input", {
    type: "text", class: "pt-auth-input", placeholder: "Tu Nombre o Alias", required: "true"
  });

  const isLogin = state.authMode === "login";

  const form = el("form", {
    class: "pt-auth-form",
    onsubmit: async (e) => {
      e.preventDefault();
      state.authError = "";
      errorNode.textContent = "";
      
      const submitBtn = $("button[type='submit']", form);
      if (submitBtn) submitBtn.disabled = true;

      let result;
      if (isLogin) {
        result = await loginWithEmail(emailInput.value, passwordInput.value);
      } else {
        result = await registerWithEmail(emailInput.value, passwordInput.value, nameInput.value);
      }

      if (submitBtn) submitBtn.disabled = false;

      if (result.error) {
        state.authError = result.error;
        errorNode.textContent = result.error;
        // Animación de shake en caso de error
        form.classList.add("pt-shake");
        form.addEventListener("animationend", () => form.classList.remove("pt-shake"), { once: true });
      }
    }
  }, [
    !isLogin ? el("div", { class: "pt-auth-input-wrap" }, [
      el("span", { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' }),
      nameInput
    ]) : null,
    el("div", { class: "pt-auth-input-wrap" }, [
      el("span", { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' }),
      emailInput
    ]),
    el("div", { class: "pt-auth-input-wrap" }, [
      el("span", { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' }),
      passwordInput
    ]),
    el("button", { type: "submit", class: "pt-btn-primary" }, isLogin ? "INICIAR SESIÓN" : "REGISTRARSE")
  ]);

  const toggleBtn = el("button", {
    onclick: () => {
      state.authMode = isLogin ? "register" : "login";
      state.authError = "";
      renderShell();
    }
  }, isLogin ? "Registrate aquí" : "Inicia sesión");

  const toggleText = el("div", { class: "pt-auth-toggle" }, [
    isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? ",
    toggleBtn
  ]);

  const googleBtn = el("button", {
    class: "pt-btn-google",
    onclick: async () => {
      state.authError = "";
      errorNode.textContent = "";
      const result = await loginWithGoogle();
      if (result.error) {
        state.authError = result.error;
        errorNode.textContent = result.error;
      }
    }
  }, [
    el("span", { html: '<svg viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 15.01.5 12 .5 7.4.5 3.49 3.12 1.58 6.96l3.87 3C6.39 6.83 8.97 5.04 12 5.04z"/><path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.44-1.09 2.66-2.31 3.48l3.6 2.79c2.1-1.94 3.76-4.8 3.76-8.37z"/><path fill="#FBBC05" d="M5.45 14.04c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.58 6.46C.57 8.48 0 10.74 0 13.12s.57 4.64 1.58 6.66l3.87-3.04z"/><path fill="#34A853" d="M12 23.5c3.24 0 5.97-1.07 7.96-2.92l-3.6-2.79c-1 .67-2.28 1.07-3.6 1.07-3.03 0-5.61-1.79-6.53-4.42l-3.87 3.04c1.91 3.84 5.82 6.46 10.42 6.46z"/></svg>' }),
    el("span", {}, "Continuar con Google")
  ]);

  const view = el("div", { class: "pt-auth" }, [
    // Imagen del guerrero pixel art
    el("img", { class: "pt-auth-hero", src: "./icons/icon-192.png", alt: "RetroTasks Hero" }),
    el("h1", { class: "pt-auth-logo pt-pixel" }, "RETROTASKS"),
    el("p", { class: "pt-auth-sub pt-pixel", style: { fontSize: '9px' } }, "Tu aventura del día"),
    googleBtn,
    el("div", { class: "pt-auth-divider pt-pixel" }, "o"),
    form,
    errorNode,
    toggleText
  ]);

  container.append(view);
}

/* ============================================================
 * DRAWER DE FILTROS (móvil)
 * ============================================================ */
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
    el("label", { class: "pt-drawer-label" }, "Categoría"), catPills,
  ]));

  // Tipos
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

  // Acciones finales del drawer
  drawer.append(el("div", { class: "pt-drawer-acts" }, [
    el("button", { class: "pt-cancel", disabled: activeFilters() === 0 ? "true" : null,
      style: { flex: '1' },
      onclick: () => { state.catFilter = "Todo"; state.typeFilter = "todos"; renderDrawer(); render(); } }, "Limpiar"),
    el("button", { class: "pt-save", onclick: closeFilters }, "Aplicar"),
  ]));

  root.append(drawer);
  document.body.append(root);
}

/* ============================================================
 * HOJA DE CREACIÓN / EDICIÓN (Bottom sheet modal)
 * ============================================================ */
function openSheet(item) { 
  state.editing = item; 
  state.sheetOpen = true; 
  renderSheet(); 
  
  // Rotar el FAB si existe
  const btn = $(".pt-fab button");
  if (btn) btn.classList.add("open");
}

function closeSheet() { 
  state.editing = null; 
  state.sheetOpen = false; 
  const s = $("#sheet-root"); 
  if (s) s.remove(); 

  // Regresar rotación del FAB
  const btn = $(".pt-fab button");
  if (btn) btn.classList.remove("open");
}

function renderSheet() {
  const old = $("#sheet-root"); if (old) old.remove();
  const init = state.editing;

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

  // --- ANULACIÓN DE ANIMACIÓN CSS ---
  // Quita el bloqueo de la animación una vez que sube, para permitir arrastrarlo con el dedo
  sheet.addEventListener('animationend', (e) => {
    if (e.animationName === "pt-sheet-in" || e.animationName === "pt-modal-in") {
      sheet.style.animation = 'none';
    }
  }, { once: true });

  // --- Gesto Swipe Down en el tirador para cerrar ---
  let startY = 0;
  let currentY = 0;

  sheet.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    currentY = e.touches[0].clientY;
    const diffY = currentY - startY;
    if (diffY > 0) {
      sheet.style.transform = `translateY(${diffY}px)`;
      sheet.style.transition = 'none';
    }
  }, { passive: true });

  sheet.addEventListener('touchend', () => {
    const diffY = currentY - startY;
    if (diffY > 120) {
      closeSheet();
    } else {
      sheet.style.transform = '';
      sheet.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.2, 0.64, 1)';
    }
    startY = 0;
    currentY = 0;
  });

  function build() {
    sheet.innerHTML = "";
    sheet.append(el("div", { class: "pt-sheet-handle" }));
    sheet.append(el("h2", { class: "pt-pixel" }, init ? "EDITAR MISIÓN" : "NUEVA MISIÓN"));

    // Tipo
    sheet.append(field("Tipo de Misión", el("div", { class: "pt-pills" },
      TYPES.map((t) => el("button", { class: "pt-pill", "aria-pressed": String(form.type === t.id),
        onclick: () => { form.type = t.id; build(); } }, t.label))
    )));

    // Categoría
    const catPills = el("div", { class: "pt-pills" }, [
      ...cats.map((c) => el("button", {
        class: "pt-pill tinted", "aria-pressed": String(form.category === c.name),
        style: form.category === c.name ? { background: c.color } : {},
        onclick: () => { form.category = c.name; build(); },
      }, c.name)),
      el("button", { class: "pt-pill", onclick: async () => {
        const name = (prompt("Nombre de la nueva categoría:") || "").trim();
        if (!name) return;
        if (!cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
          const cat = await addCategory(name);
          cats.push(cat);
        }
        form.category = name; build();
      } }, "+ Nueva"),
    ]);
    sheet.append(field("Categoría", catPills));

    // Prioridad (no se muestra en Notas)
    if (form.type !== "nota") {
      sheet.append(field("Nivel de Prioridad", el("div", { class: "pt-pills" },
        PRIORITIES.map((p) => el("button", {
          class: "pt-pill tinted", "aria-pressed": String(form.priority === p.id),
          style: form.priority === p.id ? { background: p.color } : {},
          onclick: () => { form.priority = p.id; build(); },
        }, p.label))
      )));
    }

    // Título
    const titleInput = el("input", { class: "pt-input", value: form.title,
      placeholder: form.type === "recordatorio" ? "Ej: Llamar al médico" : "Ej: Completar nivel",
      oninput: (e) => { form.title = e.target.value; } });
    sheet.append(field(form.type === "nota" ? "Título de la Nota" : "¿Qué hay que hacer?", titleInput));

    // Detalle
    const detailInput = el("textarea", { class: "pt-textarea", placeholder: "Descripción, subtareas, notas de misión...",
      oninput: (e) => { form.detail = e.target.value; } });
    detailInput.value = form.detail;
    sheet.append(field("Detalles (Opcional)", detailInput));

    // Fecha límite (no se muestra en Notas)
    if (form.type !== "nota") {
      const dateInput = el("input", { type: "datetime-local", class: "pt-date", value: form.due,
        oninput: (e) => { form.due = e.target.value; build(); } });
      sheet.append(field("Fecha Límite (Opcional)", dateInput));

      // Repetición periódica
      if (form.due) {
        const rep = el("div", {}, [
          el("div", { class: "pt-pills" }, REPEATS.map((r) =>
            el("button", { class: "pt-pill", "aria-pressed": String(form.repeat === r.id),
              onclick: () => { form.repeat = r.id; build(); } }, r.label))),
          form.repeat !== "no"
            ? el("div", { class: "pt-hint" }, "Al completarla, avanzará automáticamente al siguiente ciclo.")
            : null,
        ]);
        sheet.append(field("Frecuencia", rep));
      }
    }

    // Botones de acción
    const err = el("div", { class: "pt-err", style: { display: "none" } }, "El título es obligatorio.");
    const saveBtn = el("button", { class: "pt-save", onclick: () => {
      if (!form.title.trim()) { err.style.display = "block"; return; }
      saveFromSheet({
        type: form.type, category: form.category, priority: form.priority,
        title: form.title, detail: form.detail,
        due: form.type === "nota" ? "" : form.due,
        repeat: form.type !== "nota" && form.due ? form.repeat : "no",
      });
    } }, init ? "GUARDAR CAMBIOS" : "INICIAR MISIÓN");
    
    sheet.append(err);
    sheet.append(el("div", { class: "pt-sheetacts" }, [
      saveBtn,
      el("button", { class: "pt-cancel", onclick: closeSheet }, "CANCELAR"),
    ]));
  }

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

// Re-renderizar filtros al cambiar el tamaño de la ventana (para responsive tablet/PC)
let _resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => { render(); }, 200);
});
