# SafarMate Google Play Release

## Release identity

- App name: **SafarMate**
- Android package: `com.planetearthkids.muslimtravelplanner`
- Version name: **1.1.0**
- Version code: **157**
- Target SDK: **Android 16 / API 36**
- Billing library: **Google Play Billing 9.1.0**
- Download price: **Free**
- One-time product: **SafarMate Premium Lifetime**
- Product ID: `com.planetearthkh.safarmate.premium.lifetime`
- Product type: **One-time product / non-consumable**
- Suggested U.S. base price: **$3.99**

## Implemented billing behavior

- The same Premium interface is available on Android and iOS.
- Product name, description, and price come from the customer’s Google Play storefront.
- Existing owned purchases are queried when the app starts.
- A completed one-time purchase unlocks Premium immediately.
- Pending purchases do not unlock Premium until Google Play reports `PURCHASED`.
- Non-consumable purchases are acknowledged and acknowledgement is retried on future status checks if a transient failure occurs.
- Restore Purchases queries the customer’s currently owned Google Play products.
- Premium entitlement is restored after restart, reinstall, and use on another Android device with the same Google Account.

## Build commands

Run the complete Android verification:

```bash
npm ci
npm run android:verify
```

Generate the release App Bundle:

```bash
npm run android:bundle
```

The bundle is created at:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

Without signing variables, the bundle is for automated verification only and is not ready for Play Console upload.

## Release signing

Create a private Google Play upload keystore on the release Mac. Never commit the keystore or passwords to GitHub.

Set these environment variables before running `npm run android:bundle`:

```text
SAFARMATE_ANDROID_KEYSTORE_PATH
SAFARMATE_ANDROID_KEYSTORE_PASSWORD
SAFARMATE_ANDROID_KEY_ALIAS
SAFARMATE_ANDROID_KEY_PASSWORD
```

When all four values are present, Gradle signs the release bundle with the private upload key. Google Play App Signing should be enabled when the app is created in Play Console.

## Play Console product setup

1. Create the SafarMate app with package name `com.planetearthkids.muslimtravelplanner`.
2. Complete developer-account, app-access, ads, content-rating, target-audience, Data Safety, privacy-policy, and store-listing requirements.
3. Under **Monetize with Play → Products → One-time products**, create:
   - Product ID: `com.planetearthkh.safarmate.premium.lifetime`
   - Name: `SafarMate Premium Lifetime`
   - Description: `Unlock all Premium features for life.`
4. Add and activate a buy option for the one-time product.
5. Set the U.S. base price to $3.99 and review Google’s localized prices.
6. Upload the signed `.aab` to the **Internal testing** track first.

## Required billing tests

Use a Google Play license tester and an install delivered by a Play testing track. Sideloaded APKs cannot fully test the production Play purchase flow.

Verify:

- Localized Play price appears in the SafarMate Premium sheet.
- Successful test purchase unlocks Premium immediately.
- Purchase remains active after force-closing and restarting the phone.
- Purchase remains active after reinstalling from the testing track.
- Restore Purchases returns Premium on the same Google Account.
- User cancellation keeps the app in Free Preview.
- A pending test payment does not unlock Premium early.
- A pending payment that completes later unlocks Premium after refresh/relaunch.
- A failed or unavailable billing service shows a calm error and does not unlock Premium.
- All result, map, direction, itinerary, transport, currency, and in-flight Premium gates match the iOS behavior.
- English, Arabic, Indonesian, Malay, Turkish, French, and Urdu layouts work correctly, including RTL.

## Production release gates

Do not publish to production until:

- Repository web, Android, and iOS CI checks pass.
- A signed App Bundle is generated with the private upload key.
- Internal-track billing tests pass on a physical Android phone.
- The one-time product is active in Play Console.
- Data Safety answers match the app’s actual data handling.
- The privacy policy is publicly accessible.
- Store screenshots and listing text are final.
- Any testing requirement shown by the specific Play developer account is completed.

## Security note

The current Android implementation uses Google Play Billing’s owned-purchase query and acknowledgement flow in the app. For stronger fraud resistance at scale, add server-side purchase-token verification with the Google Play Developer API and Play Integrity before a large production rollout.
