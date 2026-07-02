# SafarOne TestFlight Checklist

This checklist is for the app owner. Do not commit Apple IDs, certificates, provisioning profiles, API keys, private keys, `.ipa` files, or archives to the repository.

## Before Archiving

1. Confirm active Apple Developer Program membership.
2. Register or confirm the bundle ID: `com.planetearthkids.muslimtravelplanner`.
3. Create the SafarOne app record in App Store Connect.
4. Set the primary language and SKU in App Store Connect.
5. Open `ios/App/App.xcworkspace`.
6. Select the owner’s Apple Development Team under Signing & Capabilities.
7. Keep automatic signing unless there is a specific reason not to.
8. Confirm no push notification, background location, in-app purchase, advertising, analytics, or tracking capability is enabled.
9. Confirm marketing version is `1.0.0`.
10. Confirm build number is `1` for the first upload.
11. Increment the build number for every future TestFlight upload.

## Archive and Upload

1. Select “Any iOS Device (arm64)” or the current generic device destination.
2. Choose Product → Archive.
3. In Organizer, choose Distribute App → App Store Connect → Upload.
4. Wait for App Store Connect build processing.
5. Complete export-compliance questions truthfully.
6. Add TestFlight beta information:
   - Beta app name: SafarOne
   - Feedback email: `planetearthkh@gmail.com`
   - Privacy URL: `https://planetearthkh-arch.github.io/muslim-travel-planner/privacy.html`
   - Support URL: `https://planetearthkh-arch.github.io/muslim-travel-planner/support.html`
7. Add internal testers first.
8. For external testers, complete beta review information before inviting them.

## What to Test Before External Review

1. Location permission allowed and denied.
2. Manual destination search after location denial.
3. Arabic RTL layout.
4. Bahasa Melayu language selection.
5. Saved trips offline.
6. Travel details offline.
7. Share Trip.
8. Copy itinerary.
9. Calendar export.
10. Prayer notifications and notification permission denial.
11. Print / Save PDF.
12. Privacy and Support pages from inside the app.

## iOS Prayer Notification Sound

SafarOne currently uses the default iOS local-notification sound for prayer notifications. Do not bundle or download third-party Athan audio without clear permission.

To add a custom iOS prayer notification sound later:

1. Obtain a licensed `.caf`, `.wav`, or `.aiff` file that complies with iOS local-notification sound limits.
2. Keep it short enough for iOS local notifications.
3. Add the file to the iOS app bundle through Xcode.
4. Update the Local Notifications schedule payload to use the bundled sound filename.
5. Update English, Arabic, Bahasa Indonesia, and Bahasa Melayu copy truthfully.
6. Re-run native verification and submit a new build with an incremented build number.
