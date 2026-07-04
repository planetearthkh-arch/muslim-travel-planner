package com.planetearthkids.muslimtravelplanner;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import java.io.File;
import java.util.Locale;

public class AthanPlaybackService extends Service {
    public static final String ACTION_STOP = "com.planetearthkids.muslimtravelplanner.STOP_ATHAN";
    private static final String CHANNEL_ID = "athan_alarm_channel";
    private static final String FALLBACK_CHANNEL_ID = "prayer_notification_channel";
    private static final int NOTIFICATION_ID = 4100;
    private MediaPlayer player;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String prayer = intent == null ? "Prayer" : intent.getStringExtra("prayer");
        String city = intent == null ? "" : intent.getStringExtra("city");
        if (prayer == null || prayer.isEmpty()) prayer = "Prayer";
        if (city == null) city = "";
        String language = intent == null ? Locale.getDefault().getLanguage() : intent.getStringExtra("language");
        if (language == null || language.isEmpty()) language = Locale.getDefault().getLanguage();

        boolean audioReady = intent != null && intent.getBooleanExtra("audioReady", true);
        createNotificationChannel(language);
        startForeground(NOTIFICATION_ID, buildNotification(prayer, city, language));
        startPlayback(prayer, city, language, audioReady);
        return START_NOT_STICKY;
    }

    private Notification buildNotification(String prayer, String city, String language) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(this, StopAthanReceiver.class);
        PendingIntent stopPendingIntent = PendingIntent.getBroadcast(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String body = city.isEmpty() ? localized("playing", language) : city;
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(prayer)
            .setContentText(body)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentIntent(openPendingIntent)
            .addAction(android.R.drawable.ic_media_pause, localized("stop", language), stopPendingIntent)
            .setOngoing(true)
            .build();
    }

    private void startPlayback(String prayer, String city, String language, boolean audioReady) {
        stopPlayer();
        String audioPath = AthanAlarmPlugin.preferences(this).getString(AthanAlarmPlugin.KEY_AUDIO_PATH, "");
        File audioFile = new File(audioPath == null ? "" : audioPath);
        if (!audioReady || !audioFile.exists() || audioFile.length() == 0) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.notify(NOTIFICATION_ID + 1, new NotificationCompat.Builder(this, FALLBACK_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(prayer)
                .setContentText(city.isEmpty() ? localized("prayerTime", language) : city)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setAutoCancel(true)
                .build());
            stopSelf();
            return;
        }

        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MuslimTravelPlanner:AthanPlayback");
        wakeLock.acquire(5 * 60 * 1000L);

        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build());
            player.setDataSource(audioFile.getAbsolutePath());
            player.setOnPreparedListener(MediaPlayer::start);
            player.setOnCompletionListener(completedPlayer -> stopSelf());
            player.setOnErrorListener((failedPlayer, what, extra) -> {
                stopSelf();
                return true;
            });
            player.prepareAsync();
        } catch (Exception error) {
            stopSelf();
        }
    }

    private void createNotificationChannel(String language) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            localized("athanChannel", language),
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(localized("athanDescription", language));
        channel.setSound(null, null);
        channel.enableVibration(true);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(channel);
        NotificationChannel fallback = new NotificationChannel(
            FALLBACK_CHANNEL_ID,
            localized("prayerChannel", language),
            NotificationManager.IMPORTANCE_HIGH
        );
        fallback.setDescription(localized("prayerDescription", language));
        fallback.enableVibration(true);
        manager.createNotificationChannel(fallback);
    }

    private String localized(String key, String language) {
        String lang = language == null ? "en" : language.toLowerCase(Locale.ROOT);
        if (lang.startsWith("ar")) {
            if (key.equals("stop")) return "إيقاف الأذان";
            if (key.equals("playing")) return "يتم تشغيل الأذان.";
            if (key.equals("prayerTime")) return "حان وقت الصلاة";
            if (key.equals("athanChannel")) return "تنبيهات الأذان";
            if (key.equals("athanDescription")) return "تشغيل الأذان في وقت الصلاة";
            if (key.equals("prayerChannel")) return "إشعارات الصلاة";
            if (key.equals("prayerDescription")) return "إشعار احتياطي لوقت الصلاة";
        }
        if (lang.startsWith("ur")) {
            if (key.equals("stop")) return "اذان بند کریں";
            if (key.equals("playing")) return "اذان چل رہی ہے۔";
            if (key.equals("prayerTime")) return "نماز کا وقت";
            if (key.equals("athanChannel")) return "اذان کے الارم";
            if (key.equals("athanDescription")) return "نماز کے وقت اذان";
            if (key.equals("prayerChannel")) return "نماز کی اطلاعات";
            if (key.equals("prayerDescription")) return "نماز کے وقت متبادل اطلاع";
        }
        if (lang.startsWith("fr")) {
            if (key.equals("stop")) return "Arrêter l’adhan";
            if (key.equals("playing")) return "L’adhan est en cours.";
            if (key.equals("prayerTime")) return "Heure de la prière";
            if (key.equals("athanChannel")) return "Alarmes d’adhan";
            if (key.equals("athanDescription")) return "Lecture de l’adhan à l’heure de la prière";
            if (key.equals("prayerChannel")) return "Notifications de prière";
            if (key.equals("prayerDescription")) return "Notification de secours pour la prière";
        }
        if (lang.startsWith("id")) {
            if (key.equals("stop")) return "Hentikan azan";
            if (key.equals("playing")) return "Azan sedang diputar.";
            if (key.equals("prayerTime")) return "Waktu salat";
            if (key.equals("athanChannel")) return "Alarm azan";
            if (key.equals("athanDescription")) return "Pemutaran azan pada waktu salat";
            if (key.equals("prayerChannel")) return "Notifikasi salat";
            if (key.equals("prayerDescription")) return "Notifikasi cadangan waktu salat";
        }
        if (lang.startsWith("ms")) {
            if (key.equals("stop")) return "Hentikan azan";
            if (key.equals("playing")) return "Azan sedang dimainkan.";
            if (key.equals("prayerTime")) return "Waktu solat";
            if (key.equals("athanChannel")) return "Penggera azan";
            if (key.equals("athanDescription")) return "Main balik azan pada waktu solat";
            if (key.equals("prayerChannel")) return "Pemberitahuan solat";
            if (key.equals("prayerDescription")) return "Pemberitahuan sandaran waktu solat";
        }
        if (lang.startsWith("tr")) {
            if (key.equals("stop")) return "Ezanı durdur";
            if (key.equals("playing")) return "Ezan çalıyor.";
            if (key.equals("prayerTime")) return "Namaz vakti";
            if (key.equals("athanChannel")) return "Ezan alarmları";
            if (key.equals("athanDescription")) return "Namaz vaktinde ezan çalma";
            if (key.equals("prayerChannel")) return "Namaz bildirimleri";
            if (key.equals("prayerDescription")) return "Namaz vakti yedek bildirimi";
        }
        if (key.equals("stop")) return "Stop Athan";
        if (key.equals("playing")) return "The Athan is playing.";
        if (key.equals("prayerTime")) return "Prayer time";
        if (key.equals("athanChannel")) return "Athan alarms";
        if (key.equals("athanDescription")) return "Prayer-time Athan playback";
        if (key.equals("prayerChannel")) return "Prayer notifications";
        return "Prayer-time notification fallback";
    }

    private void stopPlayer() {
        if (player != null) {
            try {
                if (player.isPlaying()) player.stop();
            } catch (Exception ignored) {}
            player.release();
            player = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }

    @Override
    public void onDestroy() {
        stopPlayer();
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
