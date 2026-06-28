package com.planetearthkids.muslimtravelplanner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

public class AthanReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Intent serviceIntent = new Intent(context, AthanPlaybackService.class);
        serviceIntent.putExtra("prayer", intent.getStringExtra("prayer"));
        serviceIntent.putExtra("city", intent.getStringExtra("city"));
        ContextCompat.startForegroundService(context, serviceIntent);
    }
}
