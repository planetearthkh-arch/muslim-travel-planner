# iOS Privacy Notes

This is a developer checklist for App Store Connect privacy answers. It is not legal advice.

SafarOne does not include accounts, analytics SDKs, advertising SDKs, tracking, push notifications, background location, in-app purchases, contacts access, photo-library access, microphone access, camera access, health access, Bluetooth access, or direct calendar permission.

## Data and Permissions Used

- Location permission is requested only after user action for Qibla direction or nearby travel-place searches.
- Local Notifications permission is requested only after user action for prayer notifications.
- Saved trips, travel details, preferences, and caches are stored locally in browser/WKWebView storage.
- Calendar export creates a local `.ics` file and shares it through the system share sheet. It does not request calendar access.
- Share and Clipboard actions are initiated by the user.
- External services can receive normal request information when live map, place, weather, currency, attraction, report, or external-link features are used.

## Privacy Manifest

The iOS privacy manifest declares:

- No tracking.
- No tracking domains.
- No collected-data categories by the native app target.
- UserDefaults accessed for app functionality.

Review App Store Connect answers against the current production privacy policy before every submission.
