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
  checkBoardExists, createBoard, deleteBoard, getUserItems, getBoardInfo,
  getUserBoards, setUserBoards,
  saveSharedItem, deleteSharedItem, subscribeToBoard,
  saveUserItem, deleteUserItem, subscribeToUserItems,
} from "./firebase.js";
import { sfx, showToast, showActionToast, pulseCard, createXpParticles } from "./ui/dom.js";
import { detectAndNotifyChanges } from "./ui/notify.js";
import { scheduleLocalAlarms } from "./local-alarms.js";
import { settings } from "./settings.js";

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

// Marca o desmarca un objetivo de la checklist de una misión.
export function toggleChecklistItem(itemId, checkId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item || !Array.isArray(item.checklist)) return;

  const checklist = item.checklist.map((c) =>
    c.id === checkId ? { ...c, done: !c.done } : c
  );
  const updated = touchItem(item, {
    checklist,
    lastUpdatedBy: state.syncNickname || "Anónimo",
  });

  // Respuesta inmediata en pantalla; la nube confirma después.
  state.items = state.items.map((i) => (i.id === itemId ? updated : i));
  ui.render();

  sfx("complete");
  persistItem(updated);
}

export function deleteItem(id) {
  const item = state.items.find((i) => i.id === id);

  // Preferencia de accesibilidad: confirmar antes de eliminar
  if (settings.confirmDelete && item) {
    const ok = window.confirm(`¿Eliminar "${item.title}"?`);
    if (!ok) {
      ui.render(true); // restaura la tarjeta si venía de un deslizamiento
      return;
    }
  }

  sfx("delete");
  unpersistItem(id, item?.title);

  // Red de seguridad: permitir restaurar la misión recién borrada.
  if (item) {
    showActionToast(`🗑️ "${item.title}" eliminada`, "Deshacer", () => {
      persistItem(item);
      showToast("Misión restaurada ✦");
    });
  }
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
      scheduleLocalAlarms(state.items);
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
      scheduleLocalAlarms(state.items);
      ui.render();
      return;
    }

    // Si hay cambios de otros, notificar en tiempo real
    detectAndNotifyChanges(state.items, items);
    state.items = items;
    scheduleLocalAlarms(state.items);
    ui.render();
  });
}

/* ---------- Tableros colaborativos ---------- */

// Límites (ver también LIMITES en la pantalla de tableros)
export const MAX_BOARDS = 10;

function makeBoardId() {
  return "RT-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Carga las membresías del usuario al iniciar sesión.
export async function loadUserBoards(uid) {
  state.boards = await getUserBoards(uid);
  return state.boards;
}

async function saveMemberships() {
  if (state.user) await setUserBoards(state.user.uid, state.boards);
}

/* Cambia de espacio de trabajo SIN abandonar ningún tablero:
 * boardId = null  → espacio personal
 * boardId = "RT-…" → ese tablero compartido */
export async function switchWorkspace(boardId) {
  if (state.syncUnsubscribe) {
    state.syncUnsubscribe();
    state.syncUnsubscribe = null;
  }
  state.activeBoardId = boardId;
  await setActiveBoardId(boardId);

  if (boardId) {
    state.items = [];       // evita mostrar las misiones del espacio anterior
    ui.render();
    setupBoardSubscription(boardId);
  } else {
    state.items = state.user ? await getUserItems(state.user.uid) : [];
    scheduleLocalAlarms(state.items);
    ui.render();
  }
}

export async function handleCreateBoard(boardName) {
  if (!state.syncNickname.trim()) {
    showToast("⚠️ Necesitas un nombre de perfil para crear un tablero.");
    return;
  }
  if (state.boards.length >= MAX_BOARDS) {
    showToast(`⚠️ Alcanzaste el máximo de ${MAX_BOARDS} tableros. Abandona uno para crear otro.`);
    return;
  }
  const name = (boardName || "").trim() || "Tablero compartido";
  const newBoardId = makeBoardId();
  state.syncStatusMessage = "Creando tablero...";
  ui.render();

  const success = await createBoard(newBoardId, state.syncNickname, state.user?.uid, name);
  if (success) {
    state.boards = [...state.boards, { id: newBoardId, name }];
    await saveMemberships();
    state.syncStatusMessage = "";
    await switchWorkspace(newBoardId);
    showToast(`🤝 Tablero "${name}" creado. Código: ${newBoardId}`);
  } else {
    state.syncStatusMessage = "Error al crear el tablero. Revisa tu conexión.";
  }
  ui.render();
}

export async function handleJoinBoard(boardIdInput) {
  const bId = (boardIdInput || "").trim().toUpperCase();
  if (!bId) {
    showToast("⚠️ Ingresa un código de tablero.");
    return;
  }
  if (state.boards.some((b) => b.id === bId)) {
    showToast("Ya perteneces a ese tablero.");
    await switchWorkspace(bId);
    return;
  }
  if (state.boards.length >= MAX_BOARDS) {
    showToast(`⚠️ Alcanzaste el máximo de ${MAX_BOARDS} tableros.`);
    return;
  }
  state.syncStatusMessage = "Buscando tablero...";
  ui.render();

  const info = await getBoardInfo(bId);
  if (info) {
    state.boards = [...state.boards, { id: bId, name: info.name || bId }];
    await saveMemberships();
    state.syncStatusMessage = "";
    await switchWorkspace(bId);
    showToast(`🤝 Te uniste a "${info.name || bId}"`);
  } else {
    state.syncStatusMessage = "El código de tablero no existe.";
  }
  ui.render();
}

// Abandona un tablero: lo quita de las membresías del usuario.
// Las misiones del tablero permanecen para el resto de participantes.
export async function leaveBoard(boardId) {
  state.boards = state.boards.filter((b) => b.id !== boardId);
  await saveMemberships();
  if (state.activeBoardId === boardId) {
    await switchWorkspace(null);
  } else {
    ui.render();
  }
}

/* Elimina el tablero para TODOS (solo el creador puede).
 * Si el servidor lo rechaza, se conserva la membresía. */
export async function removeBoardForEveryone(boardId) {
  const { ok, error } = await deleteBoard(boardId);
  if (!ok) {
    showToast(`⚠️ ${error}`);
    return false;
  }
  await leaveBoard(boardId);
  showToast("Tablero eliminado para todos los participantes.");
  return true;
}

// ¿El usuario actual creó este tablero? Se consulta al servidor.
export async function isBoardCreator(boardId) {
  const info = await getBoardInfo(boardId);
  return !!(info && state.user && info.creatorId === state.user.uid);
}

// Nombre legible del espacio activo (para la cabecera)
export function activeWorkspaceName() {
  if (!state.activeBoardId) return "Personal";
  const b = state.boards.find((x) => x.id === state.activeBoardId);
  return b ? b.name : state.activeBoardId;
}
