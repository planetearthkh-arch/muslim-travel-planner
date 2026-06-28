package com.planetearthkids.muslimtravelplanner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
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
