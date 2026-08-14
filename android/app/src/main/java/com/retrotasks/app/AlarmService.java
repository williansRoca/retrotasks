package com.retrotasks.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * Servicio en primer plano que, al dispararse una alarma:
 *  - Reproduce el sonido de alarma EN BUCLE, en el stream de ALARMA
 *    (volumen de alarma, suena aunque el teléfono esté en silencio).
 *  - Vibra de forma insistente.
 *  - Muestra una notificación de pantalla completa que abre AlarmActivity
 *    (aparece sobre la pantalla de bloqueo).
 * Se detiene cuando el usuario descarta la alarma en AlarmActivity.
 */
public class AlarmService extends Service {
    public static final String CHANNEL_ID = "rt_fullscreen_alarm";
    public static final String ACTION_STOP = "com.retrotasks.app.STOP_ALARM";

    private MediaPlayer player;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopEverything();
            return START_NOT_STICKY;
        }

        int id = intent != null ? intent.getIntExtra("id", 0) : 0;
        String title = intent != null ? intent.getStringExtra("title") : null;
        if (title == null) title = "Misión";

        createChannel();

        // Notificación de pantalla completa → abre AlarmActivity
        Intent full = new Intent(this, AlarmActivity.class);
        full.putExtra("id", id);
        full.putExtra("title", title);
        full.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent fullPi = PendingIntent.getActivity(this, id, full, piFlags);

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        b.setContentTitle("⏰ RetroTasks: ¡Alarma de misión!")
                .setContentText(title)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setCategory(Notification.CATEGORY_ALARM)
                .setPriority(Notification.PRIORITY_MAX)
                .setOngoing(true)
                .setAutoCancel(false)
                .setFullScreenIntent(fullPi, true)
                .setContentIntent(fullPi);

        Notification notif = b.build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1001, notif, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(1001, notif);
        }

        acquireWakeLock();
        startSound();
        startVibration();
        return START_STICKY;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Alarma a pantalla completa", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Alarmas de misiones importantes");
        // El sonido lo reproduce el servicio (stream de alarma), no el canal.
        ch.setSound(null, null);
        ch.enableVibration(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    private void startSound() {
        try {
            Uri sound = Uri.parse("android.resource://" + getPackageName() + "/raw/alarm");
            player = new MediaPlayer();
            player.setDataSource(this, sound);
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)              // volumen de ALARMA
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            player.setLooping(true);
            player.prepare();
            player.start();
        } catch (Exception e) {
            // Si falla el sonido, la alarma visual + vibración siguen.
        }
    }

    private void startVibration() {
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        long[] pattern = {0, 600, 500, 600, 500};
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
        } else {
            vibrator.vibrate(pattern, 0);
        }
    }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "retrotasks:alarm");
        wakeLock.acquire(5 * 60 * 1000L); // como máximo 5 minutos
    }

    private void stopEverything() {
        try { if (player != null) { player.stop(); player.release(); player = null; } } catch (Exception ignored) {}
        try { if (vibrator != null) vibrator.cancel(); } catch (Exception ignored) {}
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) {}
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopEverything();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
