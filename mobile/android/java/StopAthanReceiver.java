package com.planetearthkids.muslimtravelplanner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class StopAthanReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Intent serviceIntent = new Intent(context, AthanPlaybackService.class);
        serviceIntent.setAction(AthanPlaybackService.ACTION_STOP);
        context.startService(serviceIntent);
    }
}
