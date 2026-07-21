# SafarMate 1.1 Release Checklist

## Release identity

- App version: **1.1.0**
- iOS build: **156**
- Download price: **Free**
- In-App Purchase: **SafarMate Premium Lifetime**
- Product type: **Non-consumable**
- Product ID: `com.planetearthkh.safarmate.premium.lifetime`
- U.S. base price: **$3.99**

## Included in version 1.1

- Professional multilingual Lifetime Premium sheet.
- StoreKit 2 purchase flow using Apple’s localized product name and price.
- Restore Purchases.
- Verified entitlement checks at launch and when the app returns to the foreground.
- Automatic Premium access for verified production customers whose original App Store build is 154 or earlier.
- Free discovery previews show two results and a clean in-app preview map; full interactive maps, directions, all results, and external map actions require Premium.
- Premium gating for advanced in-flight prayer tools, currency tools, car rental, public transport, taxi tools, trip sharing, itinerary copying, calendar export, and trip duplication.
- English, Arabic, Bahasa Indonesia, Bahasa Melayu, Turkish, French, and Urdu Premium copy, including RTL layout.
- Native Apple WeatherKit transport for the commercial iPhone build, while preserving SafarMate’s existing weather UI and cache format.
- Apple Weather attribution and legal-source link on the weather screen.

## One-time Apple Developer setup

Before signing the App Store archive:

1. Open Apple Developer **Certificates, Identifiers & Profiles**.
2. Select the SafarMate App ID: `com.planetearthkids.muslimtravelplanner`.
3. Enable the **WeatherKit** capability and save.
4. In Xcode, confirm **Signing & Capabilities → WeatherKit** is present.
5. Allow Xcode to refresh the provisioning profile.

The project’s `npm run ios:sync` step configures `App/App.entitlements`, version 1.1.0, and build 156.

## Required StoreKit tests on a physical iPhone

Use Sandbox/TestFlight and verify:

- Product displays the App Store localized price.
- Successful purchase unlocks Premium immediately.
- User cancellation leaves Premium locked and shows a calm message.
- Ask-to-Buy/pending purchase does not unlock early.
- Restore Purchases unlocks after reinstalling the app.
- A purchase made on another device restores with the same Apple Account.
- An App Store version-1.0 installation upgraded to 1.1 receives early-supporter Premium automatically.
- A fresh 1.1 Sandbox installation is not incorrectly grandfathered.
- Premium remains unlocked after relaunch and after returning from the background.

## Required interface tests

- Test all seven languages.
- Test Arabic and Urdu RTL layout.
- Test the smallest supported iPhone and a large iPhone.
- Confirm the paywall scrolls, closes, restores focus, and respects Reduce Motion.
- Confirm free features still work normally.
- Confirm each Premium entry point opens the same paywall.
- Confirm the two free mosque and halal results remain visible with their in-app preview maps.
- Confirm external map and direction actions open the Premium offer for free users and work normally after purchase.
- Confirm existing saved trips are preserved after updating from version 1.0.
- Test WeatherKit on a real device after the capability is enabled.

## App Store Connect submission

1. Finish the In-App Purchase metadata and $3.99 pricing.
2. Upload a real screenshot of the in-app Premium sheet to **Review Information**.
3. Upload build 156.
4. Create the SafarMate 1.1 App Store version.
5. Attach **SafarMate Premium Lifetime** to the 1.1 submission.
6. Submit the app version and the first non-consumable together.

## Suggested App Review note

> SafarMate remains free to download. The app offers one optional non-consumable purchase, SafarMate Premium Lifetime (`com.planetearthkh.safarmate.premium.lifetime`). Open the app and tap the Premium badge in the main header. The sheet shows the localized App Store price, the permanent features included, the purchase button, and Restore Purchases. Free users can see two mosque or halal results and an in-app preview map. Full interactive maps, all results and directions unlock with Premium. Existing production customers whose verified original App Store build is 154 or earlier are granted Premium automatically. StoreKit Sandbox installations remain eligible to test the purchase normally.

## Release gate

Do not submit until repository CI, real-device StoreKit tests, the version-1.0 upgrade test, and WeatherKit capability testing all pass.
