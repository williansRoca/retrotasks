/* ============================================================
 * ui/alerts.js — Pestaña Alertas: historial de notificaciones
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { setMeta } from "../db.js";
import { fmtDate } from "../model.js";
import { el } from "./dom.js";

export function renderAlertsView(container) {
  container.innerHTML = "";

  const titleRow = el("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' } }, [
    el("h2", { class: "pt-pixel", style: { fontSize: '11px', color: 'var(--accent)' } }, "HISTORIAL DE EVENTOS"),
    state.alerts.length > 0 ? el("button", {
      class: "pt-act del",
      onclick: () => {
        state.alerts = [];
        setMeta("alerts", []);
        ui.render();
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
