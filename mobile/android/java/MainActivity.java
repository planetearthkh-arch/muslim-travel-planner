package com.planetearthkids.muslimtravelplanner;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AthanAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
