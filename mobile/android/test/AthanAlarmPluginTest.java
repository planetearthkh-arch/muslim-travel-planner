package com.planetearthkids.muslimtravelplanner;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Locale;
import org.junit.Test;

public class AthanAlarmPluginTest {
    @Test
    public void trustsOnlyAudioOrOctetStreamContentTypesUsingLocaleRoot() {
        Locale previous = Locale.getDefault();
        Locale.setDefault(new Locale("tr", "TR"));
        try {
            assertTrue(AthanAlarmPlugin.isTrustedAudioContentType(null));
            assertTrue(AthanAlarmPlugin.isTrustedAudioContentType("AUDIO/MPEG"));
            assertTrue(AthanAlarmPlugin.isTrustedAudioContentType("audio/mp3; charset=binary"));
            assertTrue(AthanAlarmPlugin.isTrustedAudioContentType("APPLICATION/OCTET-STREAM"));

            assertFalse(AthanAlarmPlugin.isTrustedAudioContentType("text/html"));
            assertFalse(AthanAlarmPlugin.isTrustedAudioContentType("application/json"));
        } finally {
            Locale.setDefault(previous);
        }
    }
}
