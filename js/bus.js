/* ============================================================
 * bus.js — Punto de encuentro entre módulos
 *
 * Evita imports circulares: los módulos de datos (store, alarms)
 * necesitan repintar la interfaz, y los de interfaz necesitan los
 * datos. En lugar de importarse entre sí, todos importan este bus;
 * app.js asigna las funciones reales al arrancar.
 * ============================================================ */

export const ui = {
  render: () => {},
  renderShell: () => {},
};
