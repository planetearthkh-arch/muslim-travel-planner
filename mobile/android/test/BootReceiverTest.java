package com.planetearthkids.muslimtravelplanner;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class BootReceiverTest {
    @Test
    public void acceptsOnlyExpectedSystemActions() {
        assertTrue(BootReceiver.isAcceptedAction("android.intent.action.BOOT_COMPLETED"));
        assertTrue(BootReceiver.isAcceptedAction("android.intent.action.TIME_SET"));
        assertTrue(BootReceiver.isAcceptedAction("android.intent.action.TIMEZONE_CHANGED"));

        assertFalse(BootReceiver.isAcceptedAction(null));
        assertFalse(BootReceiver.isAcceptedAction(""));
        assertFalse(BootReceiver.isAcceptedAction("android.intent.action.PACKAGE_REPLACED"));
        assertFalse(BootReceiver.isAcceptedAction("com.example.UNEXPECTED"));
    }
}
