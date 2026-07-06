package com.planetearthkids.muslimtravelplanner;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "AthanAlarm")
public class AthanAlarmPlugin extends Plugin {
    public static final String PREFS_NAME = "athan_alarm_preferences";
    public static final String KEY_ALARMS = "scheduled_alarms";
    public static final String KEY_AUDIO_PATH = "audio_path";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 8841;
    private static final long MIN_AUDIO_BYTES = 50_000L;
    private static final long MAX_AUDIO_BYTES = 8_000_000L;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void prepare(PluginCall call) {
        String audioUrl = call.getString("audioUrl");
        if (audioUrl == null || audioUrl.isEmpty()) {
            call.reject("An Athan audio URL is required.");
            return;
        }
        executor.execute(() -> {
            try {
                File destination = new File(getContext().getFilesDir(), "athan.mp3");
                if (!isValidAudioFile(destination)) {
                    File temporary = new File(getContext().getCacheDir(), "athan-download.tmp");
                    if (temporary.exists()) temporary.delete();
                    try {
                        download(audioUrl, temporary);
                        if (!isValidAudioFile(temporary)) throw new IllegalStateException("Downloaded Athan audio is invalid.");
                        if (destination.exists() && !destination.delete()) throw new IllegalStateException("Could not replace the Athan audio file.");
                        if (!temporary.renameTo(destination)) copyFile(temporary, destination);
                    } finally {
                        if (temporary.exists()) temporary.delete();
                    }
                }
                preferences(getContext()).edit().putString(KEY_AUDIO_PATH, destination.getAbsolutePath()).apply();
                call.resolve(new JSObject().put("ready", true));
            } catch (Exception error) {
                call.reject("Could not download the Athan audio.", error);
            }
        });
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                getActivity(),
                new String[] { Manifest.permission.POST_NOTIFICATIONS },
                NOTIFICATION_PERMISSION_REQUEST
            );
        }

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        boolean exactAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms();
        if (!exactAllowed && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            intent.setData(Uri.parse("package:" + context.getPackageName()));
            getActivity().startActivity(intent);
        }

        boolean notificationsAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        call.resolve(new JSObject()
            .put("exactAlarmAllowed", exactAllowed)
            .put("notificationsAllowed", notificationsAllowed));
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        boolean exactAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms();
        boolean notificationsAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        call.resolve(new JSObject()
            .put("exactAlarmAllowed", exactAllowed)
            .put("notificationsAllowed", notificationsAllowed));
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray alarms = call.getArray("alarms");
        if (alarms == null) {
            call.reject("No prayer alarms were supplied.");
            return;
        }
        try {
            cancelStored(getContext());
            JSONArray stored = new JSONArray();
            int scheduled = 0;
            long now = System.currentTimeMillis();
            for (int index = 0; index < alarms.length(); index += 1) {
                JSONObject alarm = alarms.getJSONObject(index);
                int id = alarm.optInt("id", index + 1);
                long timestamp = alarm.optLong("timestamp", 0L);
                if (timestamp <= now) continue;
                String prayer = alarm.optString("prayer", "Prayer");
                String city = alarm.optString("city", "");
                String language = alarm.optString("language", "en");
                boolean audioReady = alarm.optBoolean("audioReady", false);
                scheduleOne(getContext(), id, timestamp, prayer, city, language, audioReady);
                stored.put(alarm);
                scheduled += 1;
            }
            preferences(getContext()).edit().putString(KEY_ALARMS, stored.toString()).apply();
            call.resolve(new JSObject().put("scheduled", scheduled));
        } catch (Exception error) {
            call.reject("Could not schedule Athan alarms.", error);
        }
    }

    @PluginMethod
    public void pending(PluginCall call) {
        int scheduled = 0;
        try {
            String encoded = preferences(getContext()).getString(KEY_ALARMS, "[]");
            JSONArray alarms = new JSONArray(encoded);
            JSONArray active = new JSONArray();
            long now = System.currentTimeMillis();
            for (int index = 0; index < alarms.length(); index += 1) {
                JSONObject alarm = alarms.getJSONObject(index);
                int id = alarm.optInt("id", index + 1);
                if (alarm.optLong("timestamp", 0L) <= now) continue;
                Intent intent = new Intent(getContext(), AthanReceiver.class);
                PendingIntent pendingIntent = PendingIntent.getBroadcast(getContext(), id, intent, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
                if (pendingIntent == null) continue;
                active.put(alarm);
                scheduled += 1;
            }
            preferences(getContext()).edit().putString(KEY_ALARMS, active.toString()).apply();
        } catch (Exception ignored) {}
        call.resolve(new JSObject().put("scheduled", scheduled));
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        cancelStored(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), AthanPlaybackService.class);
        intent.setAction(AthanPlaybackService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void test(PluginCall call) {
        Intent intent = new Intent(getContext(), AthanPlaybackService.class);
        intent.putExtra("prayer", call.getString("prayer", "SafarOne prayer notification"));
        intent.putExtra("city", call.getString("city", "Prayer notification sound"));
        intent.putExtra("language", call.getString("language", "en"));
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    public static void rescheduleStored(Context context) {
        try {
            String encoded = preferences(context).getString(KEY_ALARMS, "[]");
            JSONArray alarms = new JSONArray(encoded);
            long now = System.currentTimeMillis();
            for (int index = 0; index < alarms.length(); index += 1) {
                JSONObject alarm = alarms.getJSONObject(index);
                long timestamp = alarm.optLong("timestamp", 0L);
                if (timestamp <= now) continue;
                scheduleOne(
                    context,
                    alarm.optInt("id", index + 1),
                    timestamp,
                    alarm.optString("prayer", "Prayer"),
                    alarm.optString("city", ""),
                    alarm.optString("language", "en"),
                    alarm.optBoolean("audioReady", false)
                );
            }
        } catch (Exception ignored) {}
    }

    private static void scheduleOne(Context context, int id, long timestamp, String prayer, String city, String language, boolean audioReady) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, AthanReceiver.class);
        intent.putExtra("alarmId", id);
        intent.putExtra("prayer", prayer);
        intent.putExtra("city", city);
        intent.putExtra("language", language);
        intent.putExtra("audioReady", audioReady);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent);
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent);
        }
    }

    private static void cancelStored(Context context) {
        try {
            String encoded = preferences(context).getString(KEY_ALARMS, "[]");
            JSONArray alarms = new JSONArray(encoded);
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            for (int index = 0; index < alarms.length(); index += 1) {
                int id = alarms.getJSONObject(index).optInt("id", index + 1);
                Intent intent = new Intent(context, AthanReceiver.class);
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    id,
                    intent,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
                );
                if (pendingIntent != null) {
                    alarmManager.cancel(pendingIntent);
                    pendingIntent.cancel();
                }
            }
        } catch (Exception ignored) {}
        preferences(context).edit().remove(KEY_ALARMS).apply();
    }

    public static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static URL validateAudioUrl(String address) throws Exception {
        URL url = new URL(address);
        String host = url.getHost() == null ? "" : url.getHost().toLowerCase(Locale.ROOT);
        boolean trustedHost = host.equals("assabile.com") || host.endsWith(".assabile.com");
        if (!"https".equalsIgnoreCase(url.getProtocol()) || !trustedHost) {
            throw new IllegalStateException("Athan audio URL is not trusted.");
        }
        return url;
    }

    public static boolean isTrustedAudioContentType(String contentType) {
        if (contentType == null) return true;
        String normalized = contentType.toLowerCase(Locale.ROOT);
        return normalized.startsWith("audio/") || normalized.contains("octet-stream");
    }

    private static void download(String address, File destination) throws Exception {
        URL sourceUrl = validateAudioUrl(address);
        HttpURLConnection connection = (HttpURLConnection) sourceUrl.openConnection();
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(30_000);
        connection.setInstanceFollowRedirects(true);
        connection.connect();
        validateAudioUrl(connection.getURL().toString());
        int responseCode = connection.getResponseCode();
        if (responseCode < 200 || responseCode >= 300) {
            connection.disconnect();
            throw new IllegalStateException("Audio download returned HTTP " + responseCode);
        }
        String contentType = connection.getContentType();
        if (!isTrustedAudioContentType(contentType)) {
            connection.disconnect();
            throw new IllegalStateException("Audio download returned an unexpected content type.");
        }
        long contentLength = connection.getContentLengthLong();
        if (contentLength > MAX_AUDIO_BYTES) {
            connection.disconnect();
            throw new IllegalStateException("Athan audio file is too large.");
        }
        long total = 0L;
        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(destination)) {
            byte[] buffer = new byte[16_384];
            int length;
            while ((length = input.read(buffer)) >= 0) {
                total += length;
                if (total > MAX_AUDIO_BYTES) throw new IllegalStateException("Athan audio file exceeded the size limit.");
                output.write(buffer, 0, length);
            }
        } finally {
            connection.disconnect();
        }
        if (total < MIN_AUDIO_BYTES) throw new IllegalStateException("Athan audio file is incomplete.");
    }

    private static boolean isValidAudioFile(File file) {
        if (!file.exists() || file.length() < MIN_AUDIO_BYTES || file.length() > MAX_AUDIO_BYTES) return false;
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] header = new byte[3];
            if (input.read(header) < 2) return false;
            boolean id3 = header[0] == 'I' && header[1] == 'D' && header[2] == '3';
            boolean frameSync = (header[0] & 0xFF) == 0xFF && (header[1] & 0xE0) == 0xE0;
            return id3 || frameSync;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static void copyFile(File source, File destination) throws Exception {
        try (InputStream input = new java.io.FileInputStream(source); FileOutputStream output = new FileOutputStream(destination)) {
            byte[] buffer = new byte[16_384];
            int length;
            while ((length = input.read(buffer)) >= 0) output.write(buffer, 0, length);
        }
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
