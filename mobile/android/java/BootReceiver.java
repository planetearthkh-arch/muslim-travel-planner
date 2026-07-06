package com.planetearthkids.muslimtravelplanner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    public static boolean isAcceptedAction(String action) {
        return Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_TIME_CHANGED.equals(action) ||
            Intent.ACTION_TIMEZONE_CHANGED.equals(action);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null || !isAcceptedAction(intent.getAction())) return;

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
