/* ============================================================
 * state.js — Estado global en memoria de RetroTasks
 *
 * Objeto singleton mutable. Los módulos lo importan y lo leen o
 * modifican directamente; tras modificar, llaman a ui.render()
 * (ver bus.js) para repintar.
 * ============================================================ */

import { DEFAULT_CATEGORIES } from "./model.js";

export const state = {
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
  activeTab: "home", // home | calendar | boards | alerts | profile

  // Calendario (pestaña Agenda)
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(), // 0-11
  calSelected: null, // "YYYY-MM-DD" del día seleccionado

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
  activeBoardId: null,        // null = espacio personal
  boards: [],                 // [{ id, name }] membresías del usuario
  syncNickname: "",
  syncStatusMessage: "",
  lastDeletedId: null,

  // Alertas / Notificaciones recibidas localmente
  alerts: [],

  // Unsubscribers de Firebase
  syncUnsubscribe: null,
  userItemsUnsubscribe: null,
};
