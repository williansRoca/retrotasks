package com.retrotasks.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin nativo que programa alarmas REALES (a pantalla completa,
 * con sonido en volumen de alarma) usando AlarmManager.setAlarmClock,
 * que es exacto y exento de las restricciones de ahorro de energía.
 *
 * La JS lo usa solo para las misiones marcadas como "alarma"; el
 * resto sigue con notificaciones normales (@capacitor/local-notifications).
 */
@CapacitorPlugin(name = "AlarmScheduler")
public class AlarmSchedulerPlugin extends Plugin {

    private PendingIntent buildPendingIntent(int id, String title) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, AlarmReceiver.class);
        intent.setAction("com.retrotasks.app.ALARM_" + id);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(ctx, id, intent, flags);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        Integer id = call.getInt("id");
        Double at = call.getDouble("at");     // epoch en milisegundos
        String title = call.getString("title", "Misión");
        if (id == null || at == null) {
            call.reject("Faltan parámetros id/at");
            return;
        }

        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) { call.reject("AlarmManager no disponible"); return; }

        PendingIntent operation = buildPendingIntent(id, title);

        // Intent para abrir la app si el usuario toca el ícono de alarma
        Intent showIntent = new Intent(ctx, MainActivity.class);
        int sflags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) sflags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent show = PendingIntent.getActivity(ctx, id, showIntent, sflags);

        long triggerAt = (long) (double) at;
        try {
            // setAlarmClock: la máxima prioridad, suena aunque el equipo
            // esté en reposo profundo (Doze).
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(triggerAt, show), operation);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo programar la alarma: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) { call.reject("Falta id"); return; }
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            am.cancel(buildPendingIntent(id, ""));
        }
        call.resolve();
    }
}
