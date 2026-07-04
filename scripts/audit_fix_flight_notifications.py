from __future__ import annotations

from audit_fix_common import read, write, replace_once

# ---------------------------------------------------------------------------
# Flight route timestamp correctness
# ---------------------------------------------------------------------------
flight_path = 'src/flight-mode.ts'
flight = read(flight_path)
flight = replace_once(
    flight,
    "const elapsedMinutes = Math.max(0, Math.round(clamped * plan.durationMinutes));\n  const remainingMinutes = Math.max(0, plan.durationMinutes - elapsedMinutes);",
    "const elapsedMinutes = Math.max(0, Math.round(clamped * plan.durationMinutes));\n"
    "  const remainingMinutes = Math.max(0, plan.durationMinutes - elapsedMinutes);\n"
    "  const scheduledStart = Date.parse(plan.scheduledDepartureUtc);\n"
    "  const positionTimestamp = Number.isFinite(scheduledStart)\n"
    "    ? scheduledStart + clamped * plan.durationMinutes * 60_000\n"
    "    : nowMs;",
    'route-estimate timestamp',
)
flight = replace_once(
    flight,
    "timestamp: nowMs,\n      trackDegrees: route.trackDegrees,",
    "timestamp: positionTimestamp,\n      trackDegrees: route.trackDegrees,",
    'store route-estimate timestamp',
)
# Reject implausibly distant GPS fixes rather than projecting them onto the route.
flight = replace_once(
    flight,
    "const progress = projection?.progress ?? routeEstimate.progress;\n  const routeDistance = projection?.totalDistanceKm ?? routeEstimate.routeDistanceKm;",
    "const maximumCrossTrackKm = Math.max(100, routeEstimate.routeDistanceKm * 0.15);\n"
    "  if (!projection || projection.crossTrackDistanceKm > maximumCrossTrackKm) {\n"
    "    return { ...routeEstimate, lowAccuracy: true };\n"
    "  }\n"
    "  const progress = projection.progress;\n"
    "  const routeDistance = projection.totalDistanceKm;",
    'reject distant flight GPS fixes',
)
write(flight_path, flight)

# ---------------------------------------------------------------------------
# Notification scheduling and Android exact-alarm state
# ---------------------------------------------------------------------------
android_ts_path = 'src/android-athan.ts'
android_ts = read(android_ts_path)
android_ts = replace_once(
    android_ts,
    "  city: string;\n};",
    "  city: string;\n  audioReady?: boolean;\n};",
    'Android Athan audio readiness type',
)
android_ts = replace_once(
    android_ts,
    "  prepare(options: { audioUrl: string }): Promise<{ ready: boolean }>;\n  schedule(options: { alarms: AndroidAthanAlarm[] }): Promise<{ scheduled: number }>;",
    "  prepare(options: { audioUrl: string }): Promise<{ ready: boolean }>;\n"
    "  requestPermissions(): Promise<{ exactAlarmAllowed: boolean; notificationsAllowed: boolean }>;\n"
    "  schedule(options: { alarms: AndroidAthanAlarm[] }): Promise<{ scheduled: number }>;\n"
    "  pending(): Promise<{ scheduled: number }>;",
    'Android Athan plugin interface',
)
write(android_ts_path, android_ts)

athan_path = 'src/athan.ts'
athan = read(athan_path)
athan = replace_once(
    athan,
    "    await AndroidAthan.prepare({ audioUrl: ATHAN_AUDIO_URL });\n    const copy = copyFor(language);",
    "    let audioReady = false;\n"
    "    try {\n"
    "      audioReady = (await AndroidAthan.prepare({ audioUrl: ATHAN_AUDIO_URL })).ready;\n"
    "    } catch {\n"
    "      audioReady = false;\n"
    "    }\n"
    "    const alarmPermissions = await AndroidAthan.requestPermissions();\n"
    "    const copy = copyFor(language);",
    'Android Athan offline fallback and exact permission',
)
athan = replace_once(
    athan,
    "      .map((alarm) => ({\n        id: nativeNotificationId(alarm),\n        timestamp: alarm.timestamp,\n        prayer: `${copy.prayer[alarm.prayer]} ${copy.title}`,\n        city: `${alarm.city} · ${alarm.formattedTime}`,\n      }));",
    "      .map((alarm) => ({\n"
    "        id: nativeNotificationId(alarm),\n"
    "        timestamp: alarm.timestamp,\n"
    "        prayer: `${copy.prayer[alarm.prayer]} ${copy.title}`,\n"
    "        city: `${alarm.city} · ${alarm.formattedTime}`,\n"
    "        audioReady,\n"
    "      }));",
    'pass Android audio readiness',
)
athan = replace_once(
    athan,
    "    let exactAlarmAllowed = false;\n    try {\n      exactAlarmAllowed = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';\n    } catch {\n      exactAlarmAllowed = false;\n    }",
    "    const exactAlarmAllowed = alarmPermissions.exactAlarmAllowed;",
    'use custom exact-alarm permission result',
)
athan = replace_once(
    athan,
    "export async function disableAthanAlarms() {",
    "export async function hasScheduledAthanAlarms() {\n"
    "  try {\n"
    "    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {\n"
    "      return (await AndroidAthan.pending()).scheduled > 0;\n"
    "    }\n"
    "    if (Capacitor.isNativePlatform()) {\n"
    "      const pending = await LocalNotifications.getPending();\n"
    "      return pending.notifications.some((notification) => isSafarOneNotificationId(notification.id));\n"
    "    }\n"
    "    return browserTimers.length > 0;\n"
    "  } catch {\n"
    "    return false;\n"
    "  }\n"
    "}\n\n"
    "export async function disableAthanAlarms() {",
    'real scheduled-notification state',
)
write(athan_path, athan)

plugin_path = 'mobile/android/java/AthanAlarmPlugin.java'
plugin = read(plugin_path)
plugin = replace_once(
    plugin,
    "    @PluginMethod\n    public void cancelAll(PluginCall call) {",
    "    @PluginMethod\n"
    "    public void pending(PluginCall call) {\n"
    "        int scheduled = 0;\n"
    "        try {\n"
    "            String encoded = preferences(getContext()).getString(KEY_ALARMS, \"[]\");\n"
    "            JSONArray alarms = new JSONArray(encoded);\n"
    "            long now = System.currentTimeMillis();\n"
    "            for (int index = 0; index < alarms.length(); index += 1) {\n"
    "                if (alarms.getJSONObject(index).optLong(\"timestamp\", 0L) > now) scheduled += 1;\n"
    "            }\n"
    "        } catch (Exception ignored) {}\n"
    "        call.resolve(new JSObject().put(\"scheduled\", scheduled));\n"
    "    }\n\n"
    "    @PluginMethod\n"
    "    public void cancelAll(PluginCall call) {",
    'Android pending alarms API',
)
plugin = replace_once(
    plugin,
    "                String city = alarm.optString(\"city\", \"\");\n                scheduleOne(getContext(), id, timestamp, prayer, city);",
    "                String city = alarm.optString(\"city\", \"\");\n"
    "                boolean audioReady = alarm.optBoolean(\"audioReady\", false);\n"
    "                scheduleOne(getContext(), id, timestamp, prayer, city, audioReady);",
    'Android schedule audio readiness',
)
plugin = replace_once(
    plugin,
    "                    alarm.optString(\"city\", \"\")\n                );",
    "                    alarm.optString(\"city\", \"\"),\n"
    "                    alarm.optBoolean(\"audioReady\", false)\n"
    "                );",
    'Android reschedule audio readiness',
)
plugin = replace_once(
    plugin,
    "private static void scheduleOne(Context context, int id, long timestamp, String prayer, String city) {",
    "private static void scheduleOne(Context context, int id, long timestamp, String prayer, String city, boolean audioReady) {",
    'Android schedule signature',
)
plugin = replace_once(
    plugin,
    "        intent.putExtra(\"city\", city);",
    "        intent.putExtra(\"city\", city);\n"
    "        intent.putExtra(\"audioReady\", audioReady);",
    'Android alarm audio flag',
)
write(plugin_path, plugin)

receiver_path = 'mobile/android/java/AthanReceiver.java'
receiver = read(receiver_path)
receiver = replace_once(
    receiver,
    "        serviceIntent.putExtra(\"city\", intent.getStringExtra(\"city\"));",
    "        serviceIntent.putExtra(\"city\", intent.getStringExtra(\"city\"));\n"
    "        serviceIntent.putExtra(\"audioReady\", intent.getBooleanExtra(\"audioReady\", false));",
    'forward Android audio flag',
)
write(receiver_path, receiver)

service_path = 'mobile/android/java/AthanPlaybackService.java'
service = read(service_path)
service = replace_once(service, 'private static final String CHANNEL_ID = "athan_alarm_channel";', 'private static final String CHANNEL_ID = "athan_alarm_channel";\n    private static final String FALLBACK_CHANNEL_ID = "prayer_notification_channel";', 'fallback notification channel')
service = replace_once(
    service,
    "        startForeground(NOTIFICATION_ID, buildNotification(prayer, city));\n        startPlayback();",
    "        boolean audioReady = intent != null && intent.getBooleanExtra(\"audioReady\", true);\n"
    "        startForeground(NOTIFICATION_ID, buildNotification(prayer, city));\n"
    "        startPlayback(prayer, city, audioReady);",
    'Android service audio fallback entry',
)
service = service.replace('.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)', '.setVisibility(NotificationCompat.VISIBILITY_PRIVATE)')
service = replace_once(
    service,
    "    private void startPlayback() {\n        stopPlayer();",
    "    private void startPlayback(String prayer, String city, boolean audioReady) {\n"
    "        stopPlayer();",
    'Android playback signature',
)
service = replace_once(
    service,
    "        if (!audioFile.exists() || audioFile.length() == 0) {\n            stopSelf();\n            return;\n        }",
    "        if (!audioReady || !audioFile.exists() || audioFile.length() == 0) {\n"
    "            NotificationManager manager = getSystemService(NotificationManager.class);\n"
    "            manager.notify(NOTIFICATION_ID + 1, new NotificationCompat.Builder(this, FALLBACK_CHANNEL_ID)\n"
    "                .setSmallIcon(R.mipmap.ic_launcher)\n"
    "                .setContentTitle(prayer)\n"
    "                .setContentText(city.isEmpty() ? \"Prayer time\" : city)\n"
    "                .setCategory(NotificationCompat.CATEGORY_REMINDER)\n"
    "                .setPriority(NotificationCompat.PRIORITY_HIGH)\n"
    "                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)\n"
    "                .setAutoCancel(true)\n"
    "                .build());\n"
    "            stopSelf();\n"
    "            return;\n"
    "        }",
    'Android fallback notification',
)
service = replace_once(
    service,
    "        manager.createNotificationChannel(channel);",
    "        manager.createNotificationChannel(channel);\n"
    "        NotificationChannel fallback = new NotificationChannel(\n"
    "            FALLBACK_CHANNEL_ID,\n"
    "            \"Prayer notifications\",\n"
    "            NotificationManager.IMPORTANCE_HIGH\n"
    "        );\n"
    "        fallback.setDescription(\"Prayer-time notification fallback\");\n"
    "        fallback.enableVibration(true);\n"
    "        manager.createNotificationChannel(fallback);",
    'create Android fallback channel',
)
write(service_path, service)
