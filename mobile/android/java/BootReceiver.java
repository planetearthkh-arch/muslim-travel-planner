package com.planetearthkids.muslimtravelplanner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    public static boolean isSupportedAction(String action) {
        return Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action);
    }

    public static boolean isSupportedAction(Intent intent) {
        return intent != null && isSupportedAction(intent.getAction());
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
