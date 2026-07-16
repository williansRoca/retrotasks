/* ============================================================
 * ui/auth-screen.js — Pantalla de inicio de sesión / registro
 * ============================================================ */

import { state } from "../state.js";
import { ui } from "../bus.js";
import { loginWithGoogle, loginWithEmail, registerWithEmail } from "../auth.js";
import { $, el } from "./dom.js";

export function renderAuthScreen(container) {
  const errorNode = el("div", { class: "pt-auth-error" }, state.authError);

  const emailInput = el("input", {
    type: "email", class: "pt-auth-input", placeholder: "Correo electrónico", required: "true"
  });

  const passwordInput = el("input", {
    type: "password", class: "pt-auth-input", placeholder: "Contraseña", required: "true"
  });

  const nameInput = el("input", {
    type: "text", class: "pt-auth-input", placeholder: "Tu Nombre o Alias", required: "true"
  });

  const isLogin = state.authMode === "login";

  const form = el("form", {
    class: "pt-auth-form",
    onsubmit: async (e) => {
      e.preventDefault();
      state.authError = "";
      errorNode.textContent = "";

      const submitBtn = $("button[type='submit']", form);
      if (submitBtn) submitBtn.disabled = true;

      let result;
      if (isLogin) {
        result = await loginWithEmail(emailInput.value, passwordInput.value);
      } else {
        result = await registerWithEmail(emailInput.value, passwordInput.value, nameInput.value);
      }

      if (submitBtn) submitBtn.disabled = false;

      if (result.error) {
        state.authError = result.error;
        errorNode.textContent = result.error;
        // Animación de shake en caso de error
        form.classList.add("pt-shake");
        form.addEventListener("animationend", () => form.classList.remove("pt-shake"), { once: true });
      }
    }
  }, [
    !isLogin ? el("div", { class: "pt-auth-input-wrap" }, [
      el("span", { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' }),
      nameInput
    ]) : null,
    el("div", { class: "pt-auth-input-wrap" }, [
      el("span", { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' }),
      emailInput
    ]),
    el("div", { class: "pt-auth-input-wrap" }, [
      el("span", { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' }),
      passwordInput
    ]),
    el("button", { type: "submit", class: "pt-btn-primary" }, isLogin ? "INICIAR SESIÓN" : "REGISTRARSE")
  ]);

  const toggleBtn = el("button", {
    onclick: () => {
      state.authMode = isLogin ? "register" : "login";
      state.authError = "";
      ui.renderShell();
    }
  }, isLogin ? "Registrate aquí" : "Inicia sesión");

  const toggleText = el("div", { class: "pt-auth-toggle" }, [
    isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? ",
    toggleBtn
  ]);

  const googleBtn = el("button", {
    class: "pt-btn-google",
    onclick: async () => {
      state.authError = "";
      errorNode.textContent = "";
      const result = await loginWithGoogle();
      if (result.error) {
        state.authError = result.error;
        errorNode.textContent = result.error;
      }
    }
  }, [
    el("span", { html: '<svg viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 15.01.5 12 .5 7.4.5 3.49 3.12 1.58 6.96l3.87 3C6.39 6.83 8.97 5.04 12 5.04z"/><path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.44-1.09 2.66-2.31 3.48l3.6 2.79c2.1-1.94 3.76-4.8 3.76-8.37z"/><path fill="#FBBC05" d="M5.45 14.04c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.58 6.46C.57 8.48 0 10.74 0 13.12s.57 4.64 1.58 6.66l3.87-3.04z"/><path fill="#34A853" d="M12 23.5c3.24 0 5.97-1.07 7.96-2.92l-3.6-2.79c-1 .67-2.28 1.07-3.6 1.07-3.03 0-5.61-1.79-6.53-4.42l-3.87 3.04c1.91 3.84 5.82 6.46 10.42 6.46z"/></svg>' }),
    el("span", {}, "Continuar con Google")
  ]);

  const view = el("div", { class: "pt-auth" }, [
    // Imagen del guerrero pixel art
    el("img", { class: "pt-auth-hero", src: "./icons/hero.png", alt: "RetroTasks Hero" }),
    el("h1", { class: "pt-auth-logo pt-pixel" }, "RETROTASKS"),
    el("p", { class: "pt-auth-sub pt-pixel", style: { fontSize: '9px' } }, "Tu aventura del día"),
    googleBtn,
    el("div", { class: "pt-auth-divider pt-pixel" }, "o"),
    form,
    errorNode,
    toggleText
  ]);

  container.append(view);
}
