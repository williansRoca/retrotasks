/* ============================================================
 * ui/calendar.js — Pestaña Agenda: calendario mensual
 *
 * Cuadrícula del mes con puntos de color (categoría) en los días
 * que tienen misiones. Al tocar un día se listan sus misiones y
 * se puede crear una nueva prefijada a esa fecha.
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { el } from "./dom.js";
import { renderCard, catColor } from "./home.js";
import { openSheet } from "./sheet.js";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

// Clave local "YYYY-MM-DD" de una fecha due ("YYYY-MM-DDTHH:mm" o similar)
const dayKey = (iso) => (iso || "").slice(0, 10);

const todayKey = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function renderCalendarView(container) {
  container.innerHTML = "";

  if (state.calSelected === null) state.calSelected = todayKey();

  // Agrupar misiones por día (solo las que tienen fecha)
  const byDay = new Map();
  state.items.forEach((it) => {
    if (!it.due) return;
    const key = dayKey(it.due);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(it);
  });

  /* ---- Cabecera: navegación de mes ---- */
  const moveMonth = (delta) => {
    let m = state.calMonth + delta;
    let y = state.calYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    state.calMonth = m; state.calYear = y;
    ui.render();
  };

  const head = el("div", { class: "pt-cal-head" }, [
    el("button", { class: "pt-cal-nav", "aria-label": "Mes anterior", onclick: () => moveMonth(-1) }, "◀"),
    el("div", { class: "pt-cal-title pt-pixel" }, `${MESES[state.calMonth].toUpperCase()} ${state.calYear}`),
    el("button", { class: "pt-cal-nav", "aria-label": "Mes siguiente", onclick: () => moveMonth(1) }, "▶"),
  ]);

  const hoy = todayKey();
  const hoyBtn = el("button", {
    class: "pt-cal-today",
    onclick: () => {
      const d = new Date();
      state.calYear = d.getFullYear();
      state.calMonth = d.getMonth();
      state.calSelected = hoy;
      ui.render();
    }
  }, "Hoy");

  /* ---- Cuadrícula del mes (semana inicia lunes) ---- */
  const grid = el("div", { class: "pt-cal-grid" });
  DIAS.forEach((d) => grid.append(el("div", { class: "pt-cal-dow pt-pixel" }, d)));

  const first = new Date(state.calYear, state.calMonth, 1);
  const daysInMonth = new Date(state.calYear, state.calMonth + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // getDay(): 0=domingo → lunes=0

  for (let i = 0; i < offset; i++) {
    grid.append(el("div", { class: "pt-cal-day other" }));
  }

  const p = (n) => String(n).padStart(2, "0");
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${state.calYear}-${p(state.calMonth + 1)}-${p(day)}`;
    const dayItems = byDay.get(key) || [];
    const pendientes = dayItems.filter((i) => !i.done);

    const dots = el("div", { class: "pt-cal-dots" },
      pendientes.slice(0, 3).map((it) =>
        el("span", { class: "pt-cal-dot", style: { background: catColor(it.category) } })
      )
    );
    if (pendientes.length > 3) dots.append(el("span", { class: "pt-cal-more" }, "+"));

    const cls = "pt-cal-day"
      + (key === hoy ? " today" : "")
      + (key === state.calSelected ? " selected" : "")
      + (dayItems.length && !pendientes.length ? " alldone" : "");

    grid.append(el("button", {
      class: cls,
      "aria-label": `Día ${day}`,
      onclick: () => { state.calSelected = key; ui.render(); },
    }, [
      el("span", { class: "pt-cal-num" }, String(day)),
      dots,
    ]));
  }

  /* ---- Detalle del día seleccionado ---- */
  const sel = state.calSelected;
  const selItems = (byDay.get(sel) || []).sort((a, b) => (a.due < b.due ? -1 : 1));
  const selDate = new Date(sel + "T12:00");
  const selLabel = isNaN(selDate) ? sel
    : `${selDate.getDate()} de ${MESES[selDate.getMonth()].toLowerCase()}`;

  const dayHead = el("div", { class: "pt-cal-dayhead" }, [
    el("h3", { class: "pt-pixel" }, sel === hoy ? "HOY" : selLabel.toUpperCase()),
    el("button", {
      class: "pt-cal-add",
      onclick: () => openSheet(null, { due: `${sel}T09:00` }),
    }, "+ Misión"),
  ]);

  const dayList = el("div", { class: "pt-cal-daylist" });
  if (selItems.length === 0) {
    dayList.append(el("div", { class: "pt-empty", style: { padding: "24px 20px" } }, [
      el("div", { class: "pt-pixel", style: { fontSize: "10px" } }, "DÍA LIBRE"),
      el("p", {}, "No hay misiones para este día."),
    ]));
  } else {
    selItems.forEach((it) => dayList.append(renderCard(it)));
  }

  container.append(head, hoyBtn, grid, dayHead, dayList);
}
