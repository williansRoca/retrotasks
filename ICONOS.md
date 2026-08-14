# Inventario de íconos de RetroTasks

Lista completa de íconos de la app para rediseñarlos con arte propio (pixel-art),
reemplazando los emojis actuales. Estado a la fecha (v2.2 en desarrollo).

---

## Cómo está hoy

La app usa **tres fuentes** de íconos:

1. **Emojis** (🗑 📦 ✓ ⏰ …) — dependen del sistema, se ven distintos en cada
   teléfono y rompen la estética pixel. **Son los que hay que reemplazar.**
2. **SVG vectoriales en línea** (barra de navegación, botones superiores, perfil,
   login) — ya son consistentes, pero con trazo redondeado moderno, no pixel.
   Opcional unificarlos al nuevo estilo.
3. **PNG art** (ícono de la app, 10 avatares, hero del login) — ya definitivos.

---

## Especificaciones recomendadas

**Formato preferido: SVG** con `shape-rendering="crispEdges"` (pixel nítido a
cualquier tamaño y sin generar múltiples PNG). La app ya tiene un pipeline para
esto en `scripts/gen-icons.mjs` (mapa de píxeles → SVG), reutilizable.

- **Rejilla de diseño**: 24×24 px (íconos de acción/navegación) o 16×16 (badges pequeños).
- **Grosor de trazo**: 2 px de la rejilla, líneas rectas/diagonales de 45°, sin curvas suaves.
- **Color**: un solo color que herede `currentColor` (para que tome el `--accent`,
  `--red`, etc. del tema activo). Evitar colores fijos salvo en los ilustrativos.
- **Paleta de acentos por tema** (por si algún ícono los necesita):
  fogata `#FFD24A` · helada `#4FC3F7` · bosque `#A8E063` · amatista `#C77DFF` · rubí `#FF6B6B` · sobrio `#2F6FD0`.
- **Entrega**: si prefieres PNG, exporta @1x/@2x/@3x (24/48/72 px) con fondo transparente.

---

## 1. Íconos de ACCIÓN (prioridad alta — se ven todo el tiempo)

| Emoji actual | Significado | Dónde | Tamaño sugerido |
|---|---|---|---|
| 🗑 | Eliminar | Botón de tarjeta, swipe derecha, selección, tableros | 24×24 |
| 📦 | Archivar | Botón de tarjeta, swipe izquierda, selección | 24×24 |
| ♻ | Restaurar (desarchivar) | Tarjeta archivada, selección | 24×24 |
| ✓ | Completar / marcado | Botón "Marcar", casillas checklist, selección | 24×24 |
| ✕ | Cerrar / cancelar | Cerrar hojas, limpiar búsqueda, cancelar selección | 20×20 |
| ⚙ | Filtros / ajustes | Botón de filtros (Inicio) | 24×24 |
| ⟳ | Se repite | Distintivo en tarjetas recurrentes | 16×16 |
| ⏰ | Alarma sonora | Distintivo en tarjeta + toggle del formulario | 16×16 / 20×20 |
| 🔔 | Notificación normal | Toggle "Tipo de aviso" (estado off) | 20×20 |
| 👤 | Autor (colaborativo) | Distintivo de propietario en tarjetas de tablero | 16×16 |

## 2. Íconos de ESPACIOS Y NAVEGACIÓN

| Emoji actual | Significado | Dónde | Tamaño |
|---|---|---|---|
| 📁 | Espacio personal | Chip de cabecera, selector, pestaña Tableros | 20×20 |
| 🤝 | Tablero compartido | Chip de cabecera, selector, tableros | 20×20 |
| 🚪 | Abandonar tablero | Hoja de opciones de tablero | 24×24 |
| 📩 | Correo enviado | Pantalla de recuperar contraseña | 40×40 (ilustrativo) |

> La **barra inferior** (Inicio, Agenda, Tableros, Alertas, Perfil) y los botones
> superiores (buscar 🔍, sonido 🔊/🔇) ya son **SVG**. Si quieres unificar el
> estilo pixel, habría que rediseñar esos 7 + los 4 del perfil (guía, config,
> cerrar sesión, eliminar) y los 3 del login (nombre, correo, candado).

## 3. Íconos de NOTIFICACIONES internas (toasts)

| Emoji | Significado | Dónde |
|---|---|---|
| ➕ | Tarea nueva (de otro) | notify.js |
| ✅ | Tarea completada (de otro) | notify.js |
| 🔄 | Tarea reactivada | notify.js |
| ✏ | Tarea editada | notify.js |
| 🚨 | Misión vencida | alarms.js / notificación de sistema |
| ⏳ | Aviso previo | notificación de sistema |
| ⚠ | Error / advertencia | toasts de error |

## 4. Íconos de la GUÍA (pantalla "Cómo usar la app")

Ilustrativos, uno por sección. Podrían ser más grandes y a color:

| Emoji | Sección |
|---|---|
| ⚔ | ¿Qué es RetroTasks? / bienvenida |
| 🎯 | Crear tu primera misión |
| 👆 | Gestos y acciones |
| ⏰ | Recordatorios |
| 🗓 | Agenda |
| 🤝 | Tableros compartidos |
| 🎨 | Ajustes |
| 💡 | Recomendaciones / consejos |
| 🛡 🧭 🔮 | Misiones de ejemplo (tutorial) |

## 5. Íconos de TEMAS (selector de skins)

Los puntos de tema usan emoji. Podrían ser insignias pixel de 24×24:

| Emoji | Tema |
|---|---|
| 🔥 | Fogata |
| ❄ | Helada |
| 🌿 | Bosque |
| 💜 | Amatista |
| ❤ | Rubí |
| 📋 | Sobrio |

## 6. Decorativos

| Emoji | Uso |
|---|---|
| ✦ | Adorno en mensajes de éxito ("Todo en orden ✦") |
| → | Flechas en textos de la guía |

---

## Orden sugerido de reemplazo

1. **Grupo 1 (acción)** — mayor impacto visual, aparecen en cada tarjeta.
2. **Grupo 2 (espacios/navegación)** — refuerzan identidad.
3. **Grupo 5 (temas)** y **Grupo 4 (guía)** — pantallas secundarias.
4. **Grupo 3 (toasts)** y **6 (decorativos)** — menor prioridad; el emoji aquí molesta poco.

## Total a diseñar

- **Imprescindibles (grupos 1–2)**: ~14 íconos.
- **Completo (todos los grupos, sin contar los SVG ya hechos)**: ~35 íconos.
- **Si además unificas los SVG existentes al estilo pixel**: +14.

Cuando tengas el arte (o quieras que genere versiones pixel con el pipeline
`gen-icons.mjs`), los integramos creando un pequeño módulo `js/ui/icons.js` que
devuelva cada ícono como SVG — así se reemplazan de una vez en toda la app y
heredan el color del tema.
