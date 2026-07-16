/* ============================================================
 * notifications.js — Capacitor Push Notifications para RetroTasks
 *
 * Registra el dispositivo en Firebase Cloud Messaging (FCM),
 * obtiene el FCM Token y lo guarda en la colección fcmTokens/{userId}.
 * ============================================================ */

import { initFirebase } from "./firebase.js";
import { doc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Inicializa las notificaciones push nativas si está en la plataforma Capacitor
export async function initPushNotifications(userId) {
  // Verificar si Capacitor y el plugin de notificaciones están disponibles
  const hasCapacitor = window.Capacitor;
  const hasPushPlugin = hasCapacitor && window.Capacitor.isPluginAvailable('PushNotifications');

  if (!hasPushPlugin) {
    console.log("Notificaciones Push nativas no disponibles (plataforma Web).");
    return;
  }

  const PushNotifications = window.Capacitor.Plugins.PushNotifications;
  const db = initFirebase();

  try {
    // 1. Verificar y solicitar permisos de notificaciones
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions();
    }

    if (perm.receive === 'granted') {
      // 2. Registrar el dispositivo con APNS/FCM
      await PushNotifications.register();

      // 3. Listener para guardar el FCM token en Firestore
      await PushNotifications.removeAllListeners();

      PushNotifications.addListener('registration', async (token) => {
        const tokenValue = token.value;
        console.log('FCM Token de dispositivo obtenido:', tokenValue);
        
        if (db && userId) {
          try {
            const tokenRef = doc(db, "fcmTokens", userId);
            await setDoc(tokenRef, {
              tokens: arrayUnion(tokenValue),
              lastUpdated: new Date().toISOString()
            }, { merge: true });
            console.log("FCM Token registrado correctamente en Firestore.");
          } catch (err) {
            console.error("Error guardando FCM Token en Firestore:", err);
          }
        }
      });

      // Listener para manejar errores de registro
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error de registro en Push Notifications:', error);
      });

      // Listener al recibir una notificación en primer plano (Foreground)
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Notificación recibida en primer plano:', notification);
        // Si la función global existe en app.js, mostramos un toast pixel art
        if (window.showLocalToast) {
          window.showLocalToast(`🔔 ${notification.title || 'Misión Actualizada'}: ${notification.body || ''}`);
        }
      });

      // Listener al hacer click en la notificación (Background/Closed)
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('Notificación presionada:', action);
        // Aquí se puede redirigir al usuario a una pantalla específica en el futuro
      });
    } else {
      console.warn("Permiso de notificaciones denegado por el usuario.");
    }
  } catch (e) {
    console.error("Error inicializando Push Notifications nativas:", e);
  }
}
