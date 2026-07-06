package com.planetearthkids.muslimtravelplanner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    public static boolean isSupportedAction(Intent intent) {
        if (intent == null) return false;
        String action = intent.getAction();
        return Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!isSupportedAction(intent)) return;
        PendingResult result = goAsync();
        new Thread(() -> {
            try {
                AthanAlarmPlugin.rescheduleStored(context.getApplicationContext());
            } finally {
                result.finish();
            }
        }).start();
    }
}
