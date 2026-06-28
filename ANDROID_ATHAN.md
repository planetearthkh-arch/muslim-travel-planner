# Android Athan alarms

This feature adds real calculated prayer times and Android alarms that can play the full Athan while the app is closed.

## One-time setup

1. Install Node.js and Android Studio.
2. Run `npm install`.
3. Run `npm run android:setup`.
4. Run `npm run android:open`.
5. In Android Studio, connect an Android phone and press Run.

## Enable the Athan

1. Select the city, trip date, and prayer calculation method.
2. Press **Enable Athan alarms**.
3. Allow notifications.
4. When Android opens the exact-alarm settings, allow this app to schedule alarms.
5. Return to the app and press **Update Athan alarms** once more.

The app calculates Fajr, Dhuhr, Asr, Maghrib, and Isha using the selected city coordinates and timezone. Sunrise is displayed but does not trigger an Athan.

The supplied Athan recording is downloaded once and stored privately on the phone so later alarms can play without internet access. Confirm that you have permission to use the recording before publishing the app publicly.

## Updating the web code

After changing the web app, run:

```bash
npm run android:sync
```

Then rebuild from Android Studio.
