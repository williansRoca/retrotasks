/* ============================================================
 * ui/sheet.js — Hoja de creación / edición de misiones
 * (bottom sheet en móvil, modal centrado en pantallas anchas)
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { TYPES, PRIORITIES, REPEATS } from "../model.js";
import { $, el, field } from "./dom.js";
import { saveItem, addCategory } from "../store.js";

// Límites alineados con las reglas de seguridad de Firestore
// (firestore.rules): título <= 500, detalle <= 5000.
const TITLE_MAX = 500;
const DETAIL_MAX = 5000;

// Opciones de aviso previo (minutos antes del vencimiento)
const PRE_ALERTS = [
  { id: "no", label: "Sin aviso" },
  { id: "10", label: "10 min antes" },
  { id: "30", label: "30 min antes" },
  { id: "60", label: "1 h antes" },
  { id: "1440", label: "1 día antes" },
];

let _defaults = {}; // valores iniciales para creación (p. ej. fecha desde la Agenda)

export function openSheet(item, defaults = {}) {
  _defaults = defaults;
  state.editing = item;
  state.sheetOpen = true;
  renderSheet();

  // Rotar el FAB si existe
  const btn = $(".pt-fab button");
  if (btn) btn.classList.add("open");
}

export function closeSheet() {
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
    due: init?.due || _defaults.due || "",
    repeat: init?.repeat || "no",
    preAlert: init?.preAlert || "no",
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
      maxlength: String(TITLE_MAX),
      placeholder: form.type === "recordatorio" ? "Ej: Llamar al médico" : "Ej: Completar nivel",
      oninput: (e) => { form.title = e.target.value; } });
    sheet.append(field(form.type === "nota" ? "Título de la Nota" : "¿Qué hay que hacer?", titleInput));

    // Detalle
    const detailInput = el("textarea", { class: "pt-textarea",
      maxlength: String(DETAIL_MAX),
      placeholder: "Descripción, subtareas, notas de misión...",
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

        // Aviso previo (segunda notificación antes del vencimiento)
        const pre = el("div", {}, [
          el("div", { class: "pt-pills" }, PRE_ALERTS.map((a) =>
            el("button", { class: "pt-pill", "aria-pressed": String(form.preAlert === a.id),
              onclick: () => { form.preAlert = a.id; build(); } }, a.label))),
          form.preAlert !== "no"
            ? el("div", { class: "pt-hint" }, "Recibirás una notificación antes de la fecha límite, además de la del vencimiento.")
            : null,
        ]);
        sheet.append(field("Aviso Previo", pre));
      }
    }

    // Botones de acción
    const err = el("div", { class: "pt-err", style: { display: "none" } }, "El título es obligatorio.");
    const saveBtn = el("button", { class: "pt-save", onclick: () => {
      if (!form.title.trim()) { err.style.display = "block"; return; }
      saveItem({
        type: form.type, category: form.category, priority: form.priority,
        title: form.title, detail: form.detail,
        due: form.type === "nota" ? "" : form.due,
        repeat: form.type !== "nota" && form.due ? form.repeat : "no",
        preAlert: form.type !== "nota" && form.due ? form.preAlert : "no",
      });
      closeSheet();
      ui.render();
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
