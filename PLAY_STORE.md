# RetroTasks — Kit de publicación en Google Play

Todo lo necesario para llenar Play Console. Los textos respetan los límites de caracteres.

---

## 1. Ficha de la tienda

**Título** (máx. 30):
```
RetroTasks: Misiones y Tareas
```

**Descripción corta** (máx. 80):
```
Convierte tus tareas en misiones RPG. Recordatorios, notas y modo cooperativo.
```

**Descripción larga** (máx. 4000):
```
⚔️ TU LISTA DE TAREAS, CONVERTIDA EN AVENTURA

RetroTasks transforma tus quehaceres diarios en misiones de un RPG clásico de
16 bits. Completa tareas, gana experiencia y mantén tu día en orden con una
interfaz pixel-art llena de personalidad.

✅ GESTIONA TUS MISIONES
• Tareas, notas y recordatorios con categorías, prioridades y colores
• Desliza para completar o eliminar (gestos swipe)
• Tareas recurrentes: diarias, semanales o mensuales
• Buscador y filtros por tiempo, tipo y categoría

📅 AGENDA INTEGRADA
• Calendario mensual con tus misiones marcadas por color
• Toca cualquier día para ver o crear misiones en esa fecha

⏰ RECORDATORIOS QUE SÍ LLEGAN
• Notificaciones exactas al vencer cada misión, incluso con la app cerrada
• Aviso previo configurable: 10 min, 30 min, 1 hora o 1 día antes

🤝 MODO COOPERATIVO
• Crea un tablero compartido y trabaja en equipo con un código simple
• Ve en tiempo real quién crea, completa o edita cada misión

🎨 HECHA PARA DISFRUTARSE
• 5 temas visuales (skins) y 10 avatares pixel-art de aventurero
• Barra de progreso estilo XP y efectos retro
• Guía de Aventura para empezar en segundos

☁️ TUS DATOS, SEGUROS Y SINCRONIZADOS
• Sincronización en la nube entre todos tus dispositivos
• Funciona sin conexión: tus misiones siempre disponibles
• Sin publicidad y sin venta de datos

¡Empieza tu aventura hoy y convierte cada día en una partida ganada!
```

**Categoría**: Productividad
**Etiquetas sugeridas**: tareas, recordatorios, to-do list, gamificación
**Política de privacidad (URL)**: `https://williansroca.github.io/retrotasks/privacidad.html`
**URL de eliminación de datos**: `https://williansroca.github.io/retrotasks/privacidad.html#eliminar`

**Gráficos requeridos**:
- Ícono de la tienda: 512×512 → usar `assets/icon-only.png` reescalado (o `icons/icon-512.png`)
- Gráfico destacado (feature graphic): 1024×500 — PENDIENTE de diseñar
- Screenshots: mínimo 2 de teléfono (recomendado 4-8). Capturar: Inicio con misiones,
  Agenda, formulario de nueva misión, Perfil con avatares/temas.

---

## 2. Declaración de Data Safety (Seguridad de los datos)

Respuestas para el formulario, basadas en lo que la app realmente hace:

| Pregunta | Respuesta |
|---|---|
| ¿Recopila o comparte datos del usuario? | Sí, recopila. **No comparte** con terceros. |
| ¿Los datos se cifran en tránsito? | Sí (HTTPS/TLS). |
| ¿Permite solicitar la eliminación de datos? | Sí (correo + URL de la política, sección "Eliminar"). |

**Tipos de datos a declarar:**

| Tipo | ¿Se recopila? | Finalidad | ¿Obligatorio? |
|---|---|---|---|
| Info personal → Nombre | Sí | Funcionalidad de la app (perfil, tableros) | Sí |
| Info personal → Email | Sí | Gestión de cuenta | Sí |
| Fotos → (foto de perfil de Google) | Sí (solo si usa login Google) | Funcionalidad de la app | No |
| Mensajes/Otro contenido → contenido del usuario (tareas/notas) | Sí | Funcionalidad de la app | Sí |
| IDs del dispositivo → token FCM | Sí | Funcionalidad (notificaciones push) | No |

Todo lo demás (ubicación, contactos, historial, datos financieros, salud): **No se recopila**.

---

## 3. Declaración de permisos sensibles

- **SCHEDULE_EXACT_ALARM**: declarar el caso de uso "la función principal de la app son
  recordatorios/alarmas programadas por el usuario" — es el caso permitido por la política.
- **POST_NOTIFICATIONS**: notificaciones de vencimiento y colaboración.

---

## 4. Checklist de lanzamiento (en orden)

1. [ ] **Commit + push** de todo lo pendiente.
2. [ ] Verificar que la política es accesible: https://williansroca.github.io/retrotasks/privacidad.html
3. [ ] **Generar keystore de release** (Android Studio → Build → Generate Signed Bundle →
       Create new). ⚠️ GUARDAR el `.jks` y sus contraseñas FUERA del PC (Drive/USB).
       Sin ese archivo, jamás podrás actualizar la app publicada.
4. [ ] **Compilar el `.aab`** firmado (Generate Signed Bundle → Android App Bundle → release).
5. [ ] **SHA-1 de release en Firebase**: `cd android && ./gradlew signingReport`, copiar el
       SHA-1 de la variante `release`, y agregarlo en Firebase Console → Configuración del
       proyecto → app Android → "Agregar huella digital". Descargar el `google-services.json`
       actualizado y reemplazarlo en `android/app/`. Sin esto, el login de Google falla en
       la app firmada.
6. [ ] Crear cuenta de Google Play Console (USD $25, pago único).
7. [ ] Crear la app en Play Console → llenar ficha (sección 1), Data Safety (sección 2),
       clasificación de contenido (cuestionario: app de productividad, sin contenido sensible)
       y permisos (sección 3).
8. [ ] Subir el `.aab` a **Prueba interna** primero. Probar con tu propia cuenta:
       login Google, sincronización, notificaciones.
9. [ ] Promover a **Producción** cuando la prueba interna esté verificada.

---

## 5. Pendiente recomendado antes de producción

- **Eliminación de cuenta dentro de la app**: la política de Play exige que las apps con
  creación de cuentas ofrezcan una vía de eliminación. La política de privacidad ya cubre la
  vía por correo + URL, pero un botón "Eliminar mi cuenta" en la pestaña Perfil (borra
  Firestore + Auth) deja el requisito cumplido de la forma más sólida.
- **Feature graphic** 1024×500 para la ficha.
