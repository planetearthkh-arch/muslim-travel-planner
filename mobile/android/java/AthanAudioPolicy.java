package com.planetearthkids.muslimtravelplanner;

import java.net.URL;
import java.util.Locale;

public final class AthanAudioPolicy {
    private AthanAudioPolicy() {}

    public static boolean isTrustedAudioUrl(String address) {
        try {
            URL url = new URL(address);
            String host = url.getHost() == null ? "" : url.getHost().toLowerCase(Locale.ROOT);
            boolean trustedHost = host.equals("assabile.com") || host.endsWith(".assabile.com");
            return "https".equalsIgnoreCase(url.getProtocol()) && trustedHost;
        } catch (Exception error) {
            return false;
        }
    }

    public static boolean isSupportedAudioContentType(String contentType) {
        if (contentType == null) return true;
        String normalizedContentType = contentType.toLowerCase(Locale.ROOT);
        return normalizedContentType.startsWith("audio/") || normalizedContentType.contains("octet-stream");
    }
}
