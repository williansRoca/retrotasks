package com.retrotasks.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;

/**
 * Recibe la alarma disparada por AlarmManager y arranca el servicio
 * en primer plano que reproduce el sonido y muestra la pantalla de alarma.
 */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra("id", 0);
        String title = intent.getStringExtra("title");

        Intent svc = new Intent(context, AlarmService.class);
        svc.putExtra("id", id);
        svc.putExtra("title", title);
        ContextCompat.startForegroundService(context, svc);
    }
}
