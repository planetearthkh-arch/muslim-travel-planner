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

public class AthanPlaybackService extends Service {
    public static final String ACTION_STOP = "com.planetearthkids.muslimtravelplanner.STOP_ATHAN";
    private static final String CHANNEL_ID = "athan_alarm_channel";
    private static final int NOTIFICATION_ID = 4100;
    private MediaPlayer player;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
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

        startForeground(NOTIFICATION_ID, buildNotification(prayer, city));
        startPlayback();
        return START_NOT_STICKY;
    }

    private Notification buildNotification(String prayer, String city) {
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

        String body = city.isEmpty() ? "The Athan is playing." : city;
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(prayer + " prayer")
            .setContentText(body)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openPendingIntent)
            .addAction(android.R.drawable.ic_media_pause, "Stop Athan", stopPendingIntent)
            .setOngoing(true)
            .build();
    }

    private void startPlayback() {
        stopPlayer();
        String audioPath = AthanAlarmPlugin.preferences(this).getString(AthanAlarmPlugin.KEY_AUDIO_PATH, "");
        File audioFile = new File(audioPath == null ? "" : audioPath);
        if (!audioFile.exists() || audioFile.length() == 0) {
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

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Athan alarms",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Prayer-time Athan playback");
        channel.setSound(null, null);
        channel.enableVibration(true);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(channel);
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
