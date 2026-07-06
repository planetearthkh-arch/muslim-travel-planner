package com.planetearthkids.muslimtravelplanner;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.Intent;
import org.junit.Test;

public class BootReceiverTest {
    @Test
    public void acceptsOnlyExpectedSystemActions() {
        assertTrue(BootReceiver.isSupportedAction(Intent.ACTION_BOOT_COMPLETED));
        assertTrue(BootReceiver.isSupportedAction(Intent.ACTION_TIME_CHANGED));
        assertTrue(BootReceiver.isSupportedAction(Intent.ACTION_TIMEZONE_CHANGED));
        assertFalse(BootReceiver.isSupportedAction((String) null));
        assertFalse(BootReceiver.isSupportedAction("com.example.UNEXPECTED"));
        assertFalse(BootReceiver.isSupportedAction("android.intent.action.PACKAGE_ADDED"));
    }
}
