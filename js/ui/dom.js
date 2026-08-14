/* ============================================================
 * ui/dom.js — Helpers de DOM y efectos visuales compartidos
 * ============================================================ */

import { state } from "../state.js";
import { playSound } from "../sound.js";

export const $ = (sel, ctx = document) => ctx.querySelector(sel);

// Generador de elementos DOM
export const el = (tag, props = {}, children = []) => {
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

// Sonido condicionado a la preferencia del usuario
export const sfx = (name) => { if (state.soundOn) playSound(name); };

// Campo de formulario etiquetado
export function field(labelText, control) {
  return el("div", { class: "pt-field" }, [
    el("label", {}, labelText),
    control,
  ]);
}

// Toast flotante (se autodestruye al terminar su animación de salida)
export function showToast(message) {
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

/* Habilita cerrar un bottom sheet arrastrándolo hacia abajo.
 * Reutilizable por cualquier hoja modal (configuración, guía, etc.). */
export function enableSheetSwipeClose(sheet, closeFn) {
  let startY = 0, currentY = 0, dragging = false;

  sheet.addEventListener("touchstart", (e) => {
    // Solo iniciar el arrastre si la hoja está en su tope (no scrolleada)
    if (sheet.scrollTop > 0) { dragging = false; return; }
    startY = e.touches[0].clientY;
    currentY = startY;
    dragging = true;
  }, { passive: true });

  sheet.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const dy = currentY - startY;
    if (dy > 0) {
      sheet.style.transform = `translateY(${dy}px)`;
      sheet.style.transition = "none";
    }
  }, { passive: true });

  sheet.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    const dy = currentY - startY;
    if (dy > 110) {
      // Deslizar fuera de pantalla antes de cerrar (animación de salida)
      sheet.style.transition = "transform 0.22s ease-in";
      sheet.style.transform = "translateY(100%)";
      const overlay = sheet.parentElement;
      if (overlay) overlay.style.transition = "opacity 0.22s ease-in";
      if (overlay) overlay.style.opacity = "0";
      setTimeout(closeFn, 210);
    } else {
      // Volver a su sitio con un pequeño rebote
      sheet.style.transform = "";
      sheet.style.transition = "transform 0.25s cubic-bezier(0.34, 1.2, 0.64, 1)";
    }
    startY = 0; currentY = 0;
  });
}

// Toast con acción (p. ej. "Deshacer"). Se cierra al pulsar la
// acción o cuando termina su animación de salida.
export function showActionToast(message, actionLabel, onAction) {
  let container = $(".pt-toast-container");
  if (!container) {
    container = el("div", { class: "pt-toast-container" });
    document.body.appendChild(container);
  }

  const toast = el("div", { class: "pt-toast" }, [
    el("span", { style: { flex: "1" } }, message),
    el("button", {
      class: "pt-toast-action",
      onclick: () => { toast.remove(); onAction(); },
    }, actionLabel),
  ]);

  toast.addEventListener("animationend", (e) => {
    if (e.animationName === "pt-toast-out") {
      toast.remove();
      if (container.children.length === 0) container.remove();
    }
  });

  container.appendChild(toast);
}

// Pulso visual sobre una tarjeta recién completada
export function pulseCard(id) {
  requestAnimationFrame(() => {
    const card = $(`.pt-card[data-id="${id}"]`);
    if (!card) return;
    card.classList.add("justdone");
    card.addEventListener("animationend", () => card.classList.remove("justdone"), { once: true });
  });
}

// Partículas doradas de XP al completar una misión
export function createXpParticles(id) {
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
