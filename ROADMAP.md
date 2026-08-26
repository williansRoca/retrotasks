# RetroTasks — Ideas para próximas versiones

Pendientes acordados, con su contexto. No son bugs: la app publicada
funciona sin ellos.

---

## v2.3 — Densidad de la lista (prioridad alta)

**Problema**: una misión con detalle largo y checklist puede ocupar ~300px
(media pantalla), así que se ven pocas a la vez y hay que hacer scroll.
Desglose actual: badges ~24px · título ~22px · detalle sin límite de
líneas · ~26px por objetivo · fila de botones ~48px.

**Solución acordada: modo compacto + recortes puntuales.**

1. **Modo compacto** (ajuste en Configuración → Accesibilidad, junto al
   tamaño de texto): aplica estilo denso a toda la lista — oculta el
   detalle, colapsa el checklist a su barra de progreso y esconde la fila
   de botones (las acciones ya están cubiertas por los gestos swipe y el
   toque largo). Cada usuario elige su densidad, como en Gmail.
2. **Recortes que aplican también en vista normal**:
   - Detalle truncado a 2 líneas con "ver más".
   - Checklist: mostrar los primeros 3 objetivos y "+N más".

**Descartado por ahora**: tarjetas plegables individuales (un toque para
expandir/colapsar). Más potente, pero añade estado por tarjeta que hay que
recordar y sincronizar. Reconsiderar si el modo compacto no basta.

---

## Otras mejoras pendientes

### Permiso de notificaciones en el onboarding
Hoy se pide cuando se programa la primera alarma. Un usuario que solo cree
tareas sin fecha no lo verá hasta más tarde. Pedirlo en la guía de
bienvenida. Esfuerzo: bajo.

### Recuperar la alarma a pantalla completa
Al declarar "Otro" en Play (RetroTasks no es un despertador), la alarma
aparece como ventana flotante de 60s en lugar de pantalla completa. El
sonido en bucle y la vibración se mantienen. Se puede recuperar pidiendo
al usuario que active "Notificaciones a pantalla completa" en Ajustes,
igual que ya hacemos con "Alarmas y recordatorios"
(ver `openExactAlarmSettings` en js/native-alarm.js como patrón).
Esfuerzo: bajo (~30 líneas).

### Widget de pantalla de inicio
Acceso rápido para crear tarea/nota/recordatorio. Los widgets NO pueden
usar WebView: todo en Java + XML (`RemoteViews`).
- Empezar por **App Shortcuts** (mantener presionado el ícono): ~30 min,
  solo un XML + deep links, cubre buena parte de la necesidad.
- Widget de acceso rápido: ~1 sesión, riesgo bajo.
- Widget con lista de misiones: 2-3 sesiones. Requiere espejar los datos
  de Firestore en almacenamiento nativo; riesgo de datos desactualizados.

### Integración con calendario
Escribir en el **calendario local del teléfono** (que ya sincroniza con
Google Calendar si el usuario tiene su cuenta). Plugins disponibles:
`@ebarooni/capacitor-calendar` o `@capgo/capacitor-calendar`.
Ojo: `WRITE_CALENDAR` es permiso peligroso → declaración extra en Play y
actualizar la política de privacidad. Decidir además qué pasa al editar o
borrar (guardar `eventId`), con recurrentes y con tableros compartidos.
Esfuerzo: 1-2 sesiones + trámite.
**Descartado**: Google Calendar API con OAuth (scope sensible, semanas de
verificación por parte de Google).

### Gamificación real
XP acumulada, niveles y rachas. Hoy la barra solo muestra progreso diario.
Es el diferenciador del producto y nunca se implementó.

### Push cooperativo (avisos con la app cerrada)
Que al crear/completar algo en un tablero les llegue notificación a los
demás. Requiere una Cloud Function → **plan Blaze** de Firebase (pago por
uso; con el volumen actual costaría prácticamente cero, pero exige tarjeta).

### Íconos de tablero de diseño propio
Los 12 íconos de identidad de tablero (`board_*` en js/ui/icons.js) los
diseñé yo siguiendo el estilo del resto. Reemplazables cuando haya arte
propio.

---

## Mantenimiento anual obligatorio

**Nivel de API objetivo**: Google exige apuntar a una API con menos de un
año. Cada agosto: subir `compileSdkVersion` y `targetSdkVersion` en
`android/variables.gradle` y, si el build falla, el AGP en
`android/build.gradle`. Ver PLAY_STORE.md §3.b.
