/* ============================================================
 * theme.js — Gestor de temas de RetroTasks
 *
 * Gestiona los 5 temas de la app y persiste la selección
 * del usuario en IndexedDB a través de db.js (getMeta/setMeta).
 * ============================================================ */

export const THEMES = [
  { id: 'fogata',   emoji: '🔥', label: 'Fogata',   bg: '#1A1208', accent: '#FFD24A' },
  { id: 'helada',   emoji: '❄️', label: 'Helada',   bg: '#0A1628', accent: '#4FC3F7' },
  { id: 'bosque',   emoji: '🌿', label: 'Bosque',   bg: '#0D1A0D', accent: '#A8E063' },
  { id: 'amatista', emoji: '💜', label: 'Amatista', bg: '#150D1E', accent: '#C77DFF' },
  { id: 'rubi',     emoji: '❤️', label: 'Rubí',     bg: '#1E0808', accent: '#FF6B6B' },
];

const DEFAULT_THEME = 'fogata';

// Aplica un tema al DOM de forma instantánea (sin recarga).
export function applyTheme(themeId) {
  const valid = THEMES.find(t => t.id === themeId);
  const id = valid ? themeId : DEFAULT_THEME;

  // Quitar todas las clases de tema anteriores
  THEMES.forEach(t => document.body.classList.remove(`theme-${t.id}`));

  // Aplicar nuevo tema (fogata es el default, no necesita clase extra)
  if (id !== DEFAULT_THEME) {
    document.body.classList.add(`theme-${id}`);
  }

  // Actualizar el meta theme-color del navegador/PWA
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    const theme = THEMES.find(t => t.id === id);
    if (theme) metaTheme.setAttribute('content', theme.accent);
  }

  return id;
}

// Recupera el tema guardado y lo aplica al arrancar.
export async function initTheme(getMeta) {
  try {
    const saved = await getMeta('theme', DEFAULT_THEME);
    return applyTheme(saved);
  } catch {
    return applyTheme(DEFAULT_THEME);
  }
}

// Cambia el tema y lo guarda en la persistencia.
export async function changeTheme(themeId, setMeta) {
  const applied = applyTheme(themeId);
  try {
    await setMeta('theme', applied);
  } catch (e) {
    console.warn('No se pudo guardar el tema:', e);
  }
  return applied;
}
