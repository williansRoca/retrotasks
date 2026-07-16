# RetroTasks

Gestor de tareas, notas y recordatorios con estilo pixel-RPG. PWA + app Android (Capacitor).

> **Nota de recuperación (jul 2026):** el código v2 "Retro Moderno" de este repo fue
> recuperado desde los assets del APK (`app-debug.apk`), ya que las carpetas del
> proyecto original se perdieron. La carpeta `android/` debe regenerarse (pasos abajo).

## Estructura

- Raíz del repo = la app web (PWA). GitHub Pages la sirve directamente.
- `scripts/copy-www.mjs` copia la app a `www/` (ignorada por git), que es el
  `webDir` que Capacitor empaqueta en el APK.
- `firestore.rules` — reglas de seguridad de Firestore (desplegar con Firebase CLI).

## Regenerar el proyecto Android

```bash
npm install
npm run copy:www
npx cap add android          # crea la carpeta android/ (solo la primera vez)
```

Luego, pasos manuales una sola vez:

1. Descargar `google-services.json` desde Firebase Console
   (Configuración del proyecto → Tus apps → Android `com.retrotasks.app`)
   y colocarlo en `android/app/`. Está en `.gitignore` — no se sube.
2. Para publicar: generar/usar la firma `.jks` en Android Studio
   (Build → Generate Signed Bundle) y compilar el `.aab`.

## Ciclo de desarrollo Android

```bash
npm run sync:android   # copia la web a www/ y sincroniza con android/
npm run open:android   # abre Android Studio
```

## Desplegar reglas de Firestore

```bash
firebase deploy --only firestore:rules
```

⚠️ Las reglas requieren usuario autenticado. Verificar en Firebase Console →
Authentication que los proveedores Google y Email/Contraseña estén habilitados.
