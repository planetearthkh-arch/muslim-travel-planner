package com.planetearthkids.muslimtravelplanner;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Locale;
import org.junit.Test;

public class AthanAudioPolicyTest {
    @Test
    public void acceptsOnlyTrustedHttpsAssabileUrls() {
        assertTrue(AthanAudioPolicy.isTrustedAudioUrl("https://assabile.com/audio.mp3"));
        assertTrue(AthanAudioPolicy.isTrustedAudioUrl("https://cdn.assabile.com/audio.mp3"));
        assertFalse(AthanAudioPolicy.isTrustedAudioUrl("http://assabile.com/audio.mp3"));
        assertFalse(AthanAudioPolicy.isTrustedAudioUrl("https://evilassabile.com/audio.mp3"));
        assertFalse(AthanAudioPolicy.isTrustedAudioUrl("https://example.com/audio.mp3"));
        assertFalse(AthanAudioPolicy.isTrustedAudioUrl("not a url"));
    }

    @Test
    public void contentTypeChecksAreLocaleSafe() {
        Locale original = Locale.getDefault();
        try {
            Locale.setDefault(new Locale("tr", "TR"));
            assertTrue(AthanAudioPolicy.isSupportedAudioContentType("AUDIO/MPEG"));
            assertTrue(AthanAudioPolicy.isSupportedAudioContentType("application/octet-stream"));
            assertTrue(AthanAudioPolicy.isSupportedAudioContentType(null));
            assertFalse(AthanAudioPolicy.isSupportedAudioContentType("text/html"));
        } finally {
            Locale.setDefault(original);
        }
    }
}
