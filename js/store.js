/* ============================================================
 * store.js — Ruta única de datos de RetroTasks
 *
 * Antes, cada acción (completar, borrar, guardar) repetía el
 * mismo árbol de decisión "¿tablero compartido, nube personal o
 * memoria local?". Aquí vive una sola vez.
 *
 * DETALLE OFFLINE IMPORTANTE: las escrituras de Firestore no se
 * "await-ean" para el flujo de UI. Sin conexión, esas promesas no
 * se resuelven hasta reconectar (esperan el ack del servidor),
 * pero la caché local dispara onSnapshot al instante, que es lo
 * que repinta la lista. El resultado de la promesa solo se usa
 * para avisar con un toast si la escritura realmente falló
 * (p. ej. rechazada por las reglas de seguridad).
 * ============================================================ */

import { state } from "./state.js";
import { ui } from "./bus.js";
import { setActiveBoardId, setMeta } from "./db.js";
import { createItem, touchItem, nextDate, PALETTE } from "./model.js";
import {
  checkBoardExists, createBoard, getUserItems,
  saveSharedItem, deleteSharedItem, subscribeToBoard,
  saveUserItem, deleteUserItem, subscribeToUserItems,
} from "./firebase.js";
import { sfx, showToast, pulseCard, createXpParticles } from "./ui/dom.js";
import { detectAndNotifyChanges } from "./ui/notify.js";

/* ---------- Persistencia unificada ---------- */

// Guarda un item donde corresponda. No bloquea la UI; si la
// escritura falla, avisa con un toast.
function persistItem(item) {
  let write;
  if (state.activeBoardId) {
    write = saveSharedItem(state.activeBoardId, item);
  } else if (state.user) {
    write = saveUserItem(state.user.uid, item);
  } else {
    // Sin sesión (no debería ocurrir): solo memoria.
    state.items = state.items.map((i) => (i.id === item.id ? item : i));
    if (!state.items.some((i) => i.id === item.id)) state.items = [item, ...state.items];
    ui.render();
    return;
  }
  write.then((ok) => {
    if (!ok) showToast(`⚠️ No se pudo guardar "${item.title}". Revisa tu conexión.`);
  });
}

// Elimina un item donde corresponda.
function unpersistItem(id, title = "") {
  let write;
  if (state.activeBoardId) {
    state.lastDeletedId = id; // evita notificar la eliminación propia
    write = deleteSharedItem(state.activeBoardId, id);
  } else if (state.user) {
    write = deleteUserItem(state.user.uid, id);
  } else {
    state.items = state.items.filter((i) => i.id !== id);
    ui.render();
    return;
  }
  write.then((ok) => {
    if (!ok) showToast(`⚠️ No se pudo eliminar${title ? ` "${title}"` : ""}. Revisa tu conexión.`);
  });
}

/* ---------- Acciones sobre items ---------- */

export function toggleDone(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  const willBeDone = !item.done;
  const isRecurring = willBeDone && item.repeat && item.repeat !== "no" && item.due;

  const user = state.syncNickname || "Anónimo";
  const updated = isRecurring
    ? touchItem(item, { due: nextDate(item.due, item.repeat), lastUpdatedBy: user })
    : touchItem(item, { done: !item.done, lastUpdatedBy: user });

  persistItem(updated);

  if (willBeDone) {
    sfx("complete");
    pulseCard(id);
    createXpParticles(id);
  }
}

export function deleteItem(id) {
  const item = state.items.find((i) => i.id === id);
  sfx("delete");
  unpersistItem(id, item?.title);
}

// Crea o actualiza desde el formulario. Devuelve el item persistido.
export function saveItem(data) {
  const user = state.syncNickname || "Anónimo";
  let item;
  if (state.editing) {
    item = touchItem(state.editing, { ...data, lastUpdatedBy: user });
  } else {
    item = createItem({ ...data, owner: user });
    sfx("create");
  }
  persistItem(item);
  return item;
}

export async function addCategory(name) {
  const cat = { name, color: PALETTE[state.categories.length % PALETTE.length] };
  state.categories = [...state.categories, cat];
  await setMeta("categories", state.categories);
  return cat;
}

/* ---------- Suscripciones en tiempo real ---------- */

export function setupUserItemsSubscription(uid) {
  if (state.userItemsUnsubscribe) {
    state.userItemsUnsubscribe();
  }
  state.userItemsUnsubscribe = subscribeToUserItems(uid, (items) => {
    if (!state.activeBoardId) {
      state.items = items;
      ui.render();
    }
  });
}

export function setupBoardSubscription(boardId) {
  if (state.syncUnsubscribe) {
    state.syncUnsubscribe();
    state.syncUnsubscribe = null;
  }

  let isFirstSync = true;
  state.syncUnsubscribe = subscribeToBoard(boardId, (items) => {
    if (isFirstSync) {
      state.items = items;
      isFirstSync = false;
      ui.render();
      return;
    }

    // Si hay cambios de otros, notificar en tiempo real
    detectAndNotifyChanges(state.items, items);
    state.items = items;
    ui.render();
  });
}

/* ---------- Tableros colaborativos ---------- */

function makeBoardId() {
  return "RT-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function handleCreateBoard() {
  if (!state.syncNickname.trim()) {
    alert("Por favor, ingresa tu apodo primero.");
    return;
  }
  const newBoardId = makeBoardId();
  state.syncStatusMessage = "Creando tablero...";
  ui.render();

  const success = await createBoard(newBoardId, state.syncNickname, state.user?.uid);
  if (success) {
    state.activeBoardId = newBoardId;
    await setActiveBoardId(newBoardId);
    state.syncStatusMessage = "";
    setupBoardSubscription(newBoardId);
  } else {
    state.syncStatusMessage = "Error al crear tablero en Firebase.";
  }
  ui.render();
}

export async function handleJoinBoard(boardIdInput) {
  const bId = (boardIdInput || "").trim().toUpperCase();
  if (!bId) {
    alert("Por favor, ingresa un código de tablero.");
    return;
  }
  state.syncStatusMessage = "Buscando tablero...";
  ui.render();

  const exists = await checkBoardExists(bId);
  if (exists) {
    state.activeBoardId = bId;
    await setActiveBoardId(bId);
    state.syncStatusMessage = "";
    setupBoardSubscription(bId);
  } else {
    state.syncStatusMessage = "El código de tablero no existe.";
  }
  ui.render();
}

// Detiene la sincronización colaborativa y vuelve al modo personal
export async function disconnectBoard() {
  if (state.syncUnsubscribe) {
    state.syncUnsubscribe();
    state.syncUnsubscribe = null;
  }
  state.activeBoardId = null;
  await setActiveBoardId(null);

  if (state.user) {
    state.items = await getUserItems(state.user.uid);
  } else {
    state.items = [];
  }
  ui.render();
}
