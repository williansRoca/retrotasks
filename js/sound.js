/* ============================================================
 * sound.js — Motor de sonido 8-bit (Web Audio API)
 *
 * Sin archivos externos: los efectos se generan con osciladores
 * de onda cuadrada (timbre clasico de consola). El contexto se
 * crea de forma perezosa porque el navegador bloquea el audio
 * hasta la primera interaccion del usuario (autoplay policy).
 * ============================================================ */

let audioCtx = null;

function getCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function blip(ctx, freq, start, dur, gain = 0.06) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

const SOUNDS = {
  complete: [[523, 0.0, 0.09], [659, 0.09, 0.09], [784, 0.18, 0.14]], // Do-Mi-Sol
  create: [[440, 0.0, 0.07]],
  delete: [[330, 0.0, 0.06], [220, 0.06, 0.09]],
};

export function playSound(name) {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  (SOUNDS[name] || []).forEach(([f, off, d]) => blip(ctx, f, t0 + off, d));
}
