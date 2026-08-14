package com.retrotasks.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Pantalla de alarma a pantalla completa. Aparece sobre la pantalla de
 * bloqueo y enciende la pantalla. Botones: Descartar y Posponer 5 min.
 * La UI se construye por código para no depender de layouts XML.
 */
public class AlarmActivity extends Activity {

    private int alarmId;
    private String title;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Mostrar sobre el bloqueo y encender la pantalla
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }

        alarmId = getIntent().getIntExtra("id", 0);
        title = getIntent().getStringExtra("title");
        if (title == null) title = "Misión";

        setContentView(buildUi());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    private View buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#1A1208"));
        int pad = dp(28);
        root.setPadding(pad, pad, pad, pad);

        TextView icon = new TextView(this);
        icon.setText("⏰");
        icon.setTextSize(64);
        icon.setGravity(Gravity.CENTER);

        TextView heading = new TextView(this);
        heading.setText("¡ALARMA DE MISIÓN!");
        heading.setTextColor(Color.parseColor("#FFD24A"));
        heading.setTextSize(20);
        heading.setGravity(Gravity.CENTER);
        heading.setPadding(0, dp(16), 0, dp(8));

        TextView missionName = new TextView(this);
        missionName.setText(title);
        missionName.setTextColor(Color.parseColor("#F5EDD4"));
        missionName.setTextSize(17);
        missionName.setGravity(Gravity.CENTER);
        missionName.setPadding(0, 0, 0, dp(40));

        Button dismiss = new Button(this);
        dismiss.setText("DESCARTAR");
        dismiss.setAllCaps(true);
        dismiss.setTextColor(Color.parseColor("#1A1208"));
        dismiss.setBackgroundColor(Color.parseColor("#FFD24A"));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(240), dp(56));
        lp.bottomMargin = dp(14);
        dismiss.setLayoutParams(lp);
        dismiss.setOnClickListener(v -> { stopAlarm(); finish(); });

        Button snooze = new Button(this);
        snooze.setText("POSPONER 5 MIN");
        snooze.setAllCaps(true);
        snooze.setTextColor(Color.parseColor("#F5EDD4"));
        snooze.setBackgroundColor(Color.parseColor("#3D2E18"));
        snooze.setLayoutParams(new LinearLayout.LayoutParams(dp(240), dp(56)));
        snooze.setOnClickListener(v -> { snooze5min(); stopAlarm(); finish(); });

        root.addView(icon);
        root.addView(heading);
        root.addView(missionName);
        root.addView(dismiss);
        root.addView(snooze);
        return root;
    }

    private void stopAlarm() {
        Intent stop = new Intent(this, AlarmService.class);
        stop.setAction(AlarmService.ACTION_STOP);
        startService(stop);
    }

    private void snooze5min() {
        android.app.AlarmManager am =
                (android.app.AlarmManager) getSystemService(ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(this, AlarmReceiver.class);
        i.setAction("com.retrotasks.app.ALARM_" + alarmId);
        i.putExtra("id", alarmId);
        i.putExtra("title", title);
        int flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= android.app.PendingIntent.FLAG_IMMUTABLE;
        android.app.PendingIntent pi = android.app.PendingIntent.getBroadcast(this, alarmId, i, flags);
        long at = System.currentTimeMillis() + 5 * 60 * 1000L;
        try { am.setAlarmClock(new android.app.AlarmManager.AlarmClockInfo(at, pi), pi); } catch (Exception ignored) {}
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density);
    }
}
