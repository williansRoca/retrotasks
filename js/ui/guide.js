/* ============================================================
 * ui/guide.js — Guía de uso: qué es RetroTasks y cómo se usa
 *
 * Pensada para quien abre la app por primera vez y se pregunta
 * "¿para qué sirve esto?". Accesible siempre desde Perfil.
 * ============================================================ */

import { $, el, showToast } from "./dom.js";
import { createItem } from "../model.js";
import { initFirebase, saveUserItem } from "../firebase.js";
import { doc, setDoc } from "../vendor/firebase-firestore.js";

const SECCIONES = [
  {
    icono: "⚔️",
    titulo: "¿Qué es RetroTasks?",
    parrafos: [
      "Es una app para organizar tus tareas, notas y recordatorios del día a día, con la apariencia de un videojuego de rol clásico.",
      "Cada tarea es una “misión”: la creas, la cumples y ves tu progreso avanzar en la barra dorada de arriba.",
    ],
  },
  {
    icono: "🎯",
    titulo: "Crear tu primera misión",
    pasos: [
      "Toca el botón + de abajo a la derecha.",
      "Elige el tipo: Tarea (algo que hacer), Nota (solo texto) o Recordatorio (con hora).",
      "Escribe qué hay que hacer y, si quieres, una categoría, prioridad y fecha límite.",
      "Toca INICIAR MISIÓN para guardarla.",
    ],
  },
  {
    icono: "👆",
    titulo: "Gestos y acciones",
    lista: [
      ["Deslizar a la derecha", "completa la misión"],
      ["Deslizar a la izquierda", "la elimina (con opción de deshacer)"],
      ["Marcar / Editar / Eliminar", "los botones de cada tarjeta hacen lo mismo"],
      ["Objetivos", "una misión puede tener una lista de pasos con casillas"],
    ],
  },
  {
    icono: "⏰",
    titulo: "Recordatorios que avisan",
    parrafos: [
      "Si le pones fecha límite a una misión, recibirás una notificación en el celular cuando llegue la hora, aunque la app esté cerrada.",
      "Con “Aviso previo” puedes pedir un recordatorio extra 10 minutos, 30 minutos, 1 hora o 1 día antes.",
    ],
    consejo: "Si no te llegan las notificaciones, revisa que la app tenga permiso de “Alarmas y recordatorios” y que no esté restringida en segundo plano.",
  },
  {
    icono: "🗓️",
    titulo: "Agenda",
    parrafos: [
      "La pestaña Agenda muestra el mes completo. Los puntos de colores indican los días con misiones pendientes según su categoría.",
      "Toca cualquier día para ver sus misiones o crear una nueva en esa fecha.",
    ],
  },
  {
    icono: "🤝",
    titulo: "Tableros compartidos",
    parrafos: [
      "Un tablero es una lista de misiones compartida con otras personas: la lista del supermercado, tareas de la casa o un proyecto de equipo.",
      "Cuando alguien crea, completa o elimina algo, todos lo ven al instante y reciben un aviso dentro de la app.",
    ],
    pasos: [
      "Ve a la pestaña Tableros y crea uno con un nombre.",
      "Copia el código (RT-XXXXXX) y compártelo con quien quieras invitar.",
      "Esa persona entra a Tableros, pega el código y toca UNIRSE.",
    ],
    consejo: "Usa el selector de arriba (📁 Personal / 🤝 Tablero) para cambiar entre tus misiones privadas y las compartidas. Tus misiones personales nunca se comparten.",
  },
  {
    icono: "🎨",
    titulo: "Ajustes a tu gusto",
    lista: [
      ["Temas", "6 estilos visuales, incluido el modo Sobrio sin estética arcade"],
      ["Avatares", "10 personajes para tu perfil"],
      ["Accesibilidad", "tamaño de texto, alto contraste y confirmación al eliminar"],
    ],
    consejo: "Todo esto está en Perfil → Configuración.",
  },
  {
    icono: "💡",
    titulo: "Recomendaciones",
    lista: [
      ["Usa categorías", "separa Hogar, Trabajo y Personal para filtrar rápido"],
      ["Prioridad alta", "resérvala para lo que de verdad no puede esperar"],
      ["Repetición", "para lo que se repite cada día o semana, no la vuelvas a crear"],
      ["Sin conexión", "la app funciona igual; se sincroniza al recuperar internet"],
    ],
  },
];

/* ---------- Misiones de ejemplo y marca de "ya vista" ---------- */

// Deja registrado que el usuario ya vio la bienvenida.
export async function markGuideSeen(uid) {
  const db = initFirebase();
  if (!db || !uid) return;
  try {
    await setDoc(doc(db, "users", uid), {
      preferences: { showTutorialPrompt: false }
    }, { merge: true });
  } catch (e) {
    console.error("No se pudo guardar el estado de la guía:", e);
  }
}

// Crea 4 misiones de ejemplo para practicar.
export async function createSampleMissions(uid) {
  const ejemplos = [
    { type: "tarea", category: "Personal", priority: "alta",  title: "🛡️ Crea tu primera misión", detail: "Presiona el botón + de abajo para crear una nueva misión." },
    { type: "tarea", category: "Personal", priority: "media", title: "🧭 Desliza esta tarjeta", detail: "Deslízala a la derecha para completarla, o a la izquierda para borrarla." },
    { type: "tarea", category: "Personal", priority: "baja",  title: "🔮 Cambia el tema en Perfil", detail: "Ve a Perfil → Configuración y elige otro tema visual." },
    { type: "tarea", category: "Personal", priority: "media", title: "🤝 Comparte un tablero", detail: "Crea un tablero en la pestaña Tableros e invita a alguien con su código." },
  ];
  for (const e of ejemplos) {
    await saveUserItem(uid, createItem({ ...e, owner: "Guía de Aventura" }));
  }
}

/* ---------- Ventana de la guía ---------- */

export function closeGuide() {
  const r = $("#guide-root");
  if (r) r.remove();
}

/* opts.firstRun = true → modo bienvenida: se muestra sola tras el
 * registro, con opción de crear misiones de ejemplo y de saltarla. */
export function openGuide(opts = {}) {
  const { firstRun = false, uid = null } = opts;
  closeGuide();

  const cerrar = () => {
    closeGuide();
    if (firstRun && uid) markGuideSeen(uid);
  };

  const root = el("div", { class: "pt-overlay", id: "guide-root", onclick: cerrar });
  const sheet = el("div", { class: "pt-sheet", onclick: (e) => e.stopPropagation() });

  sheet.append(el("div", { class: "pt-sheet-handle" }));

  if (firstRun) {
    sheet.append(el("div", { class: "pt-guide-welcome" }, [
      el("div", { class: "pt-guide-welcome-icon" }, "⚔️"),
      el("h2", { class: "pt-pixel" }, "¡BIENVENIDO, AVENTURERO!"),
      el("p", { class: "pt-guide-intro", style: { marginBottom: "0" } },
        "Esta es tu guía rápida. Puedes volver a verla cuando quieras desde Perfil → Cómo usar la app."),
    ]));
  } else {
    sheet.append(el("h2", { class: "pt-pixel" }, "CÓMO USAR RETROTASKS"));
    sheet.append(el("p", { class: "pt-guide-intro" },
      "Una guía rápida para sacarle partido a la app."));
  }

  SECCIONES.forEach((s) => {
    const bloque = el("section", { class: "pt-guide-sec" });

    bloque.append(el("h3", { class: "pt-guide-title" }, [
      el("span", { class: "pt-guide-icon" }, s.icono),
      el("span", {}, s.titulo),
    ]));

    (s.parrafos || []).forEach((p) => {
      bloque.append(el("p", { class: "pt-guide-text" }, p));
    });

    if (s.pasos) {
      bloque.append(el("ol", { class: "pt-guide-steps" },
        s.pasos.map((p) => el("li", {}, p))));
    }

    if (s.lista) {
      bloque.append(el("ul", { class: "pt-guide-list" },
        s.lista.map(([termino, desc]) =>
          el("li", {}, [
            el("b", {}, termino),
            el("span", {}, ` — ${desc}`),
          ])
        )));
    }

    if (s.consejo) {
      bloque.append(el("div", { class: "pt-guide-tip" }, [
        el("span", { class: "pt-guide-tip-icon" }, "💡"),
        el("span", {}, s.consejo),
      ]));
    }

    sheet.append(bloque);
  });

  if (firstRun) {
    // En la bienvenida se ofrece practicar con misiones de ejemplo
    const ejemploBtn = el("button", {
      class: "pt-cancel",
      style: { width: "100%" },
      onclick: async () => {
        ejemploBtn.disabled = true;
        ejemploBtn.textContent = "CREANDO...";
        await createSampleMissions(uid);
        cerrar();
        showToast("Se crearon 4 misiones de ejemplo ✦");
      },
    }, "CREAR MISIONES DE EJEMPLO");

    sheet.append(el("div", { style: { display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" } }, [
      el("button", { class: "pt-save", style: { width: "100%" }, onclick: cerrar }, "EMPEZAR MI AVENTURA"),
      ejemploBtn,
    ]));
  } else {
    sheet.append(el("div", { class: "pt-sheetacts" }, [
      el("button", { class: "pt-save", onclick: cerrar }, "ENTENDIDO"),
    ]));
  }

  root.append(sheet);
  document.body.append(root);
  sheet.scrollTop = 0;
}
