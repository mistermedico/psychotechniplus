# RevenueCat + App Store Connect Setup

This project is wired for RevenueCat purchases in `lib/purchases.ts`.
Use this file as the source of truth when creating the products in App Store Connect and RevenueCat.

## App Identity

- App name: `PsychoTechniPlus`
- App Store Connect app name: `פסיכוטכני פלוס`
- App Store Connect app ID: `6776568241`
- iOS bundle ID: `com.psychotechniplus.app`
- Android package: `com.psychotechniplus.app`
- RevenueCat offering: `default`
- RevenueCat production entitlement: `premium`
- Legacy entitlement still accepted by the app: `psychotechniplus Pro`

## Products

Create these products with exactly these identifiers.

| Plan | Product ID | Store type | Duration | Display price |
| --- | --- | --- | --- | --- |
| Weekly Premium | `com.psychotechniplus.premium.weekly` | Auto-renewable subscription | 1 week | NIS 49.90 |
| Monthly Premium | `com.psychotechniplus.premium.monthly` | Auto-renewable subscription | 1 month | NIS 99.90 |
| Lifetime Premium | `com.psychotechniplus.premium.lifetime` | Non-consumable | Lifetime | NIS 199.00 |

## App Store Connect Checklist

1. Make sure the Apple Developer Account Holder has accepted the Paid Apps Agreement.
2. Verify the app exists in App Store Connect with bundle ID `com.psychotechniplus.app`.
3. Under the app, create one subscription group, for example `PsychoTechniPlus Premium`.
4. Add the weekly and monthly auto-renewable subscriptions with the exact product IDs above.
5. Add localizations, review screenshots, pricing, availability, and tax category for each subscription.
6. Add the lifetime product as a non-consumable in-app purchase with the exact product ID above.
7. Add metadata, pricing, availability, review screenshot, and tax category for the lifetime product.
8. Configure App Store Server Notifications if RevenueCat asks for it in the Apple integration flow.
9. Use sandbox/TestFlight to verify all products are fetchable before submitting.
10. Submit the first in-app purchases together with a new app version when Apple requires it.

Apple notes from official docs:

- In-app purchase changes can take up to about 1 hour to appear in sandbox.
- Product IDs in the app must match App Store Connect exactly.
- First in-app purchases may need to be submitted with a new app version.

## RevenueCat Checklist

1. Create or open the RevenueCat project for `PsychoTechniPlus`.
2. Add an Apple app with bundle ID `com.psychotechniplus.app`.
3. Connect RevenueCat to App Store Connect using the required App Store Connect API key/issuer/key ID.
4. Add the three products listed above.
5. Create entitlement `premium`.
6. Attach all three products to `premium`.
7. Create offering `default`.
8. Add packages to `default`:
   - `$rc_weekly` or custom package `weekly` -> `com.psychotechniplus.premium.weekly`
   - `$rc_monthly` or custom package `monthly` -> `com.psychotechniplus.premium.monthly`
   - custom package `lifetime` -> `com.psychotechniplus.premium.lifetime`
9. Mark `default` as the current offering.
10. Configure a RevenueCat Paywall for the `default` offering.
11. Enable Customer Center if you want in-app subscription management.
12. Copy the public iOS SDK key into `.env` as `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`.

## Local Environment

Copy `.env.example` to `.env` and fill the real RevenueCat public SDK keys.

Do not commit `.env`, `.p8`, `.p12`, `.mobileprovision`, or private App Store Connect keys.
The existing `.gitignore` already blocks these sensitive files.

## EAS Submit

`eas.json` still needs real App Store Connect values before production submit:

- `appleId`
- `ascAppId`
- `appleTeamId`

After the values are set and an iOS build exists:

```sh
npx eas build --platform ios --profile production
npx eas submit --platform ios --profile production
```

## Implementation Files

- `lib/purchases.ts` initializes RevenueCat, loads offerings, purchases packages, restores purchases, checks entitlements, presents RevenueCat Paywall, and opens Customer Center.
- `store/purchaseStore.ts` syncs RevenueCat state into the user premium state.
- `app/paywall.tsx` renders the custom paywall and exposes RevenueCat Paywall / Customer Center actions.
- `.env.example` documents the public keys and App Store Connect values needed outside git.

## Official References

- RevenueCat Expo setup: https://www.revenuecat.com/docs/getting-started/installation/expo
- RevenueCat React Native setup: https://www.revenuecat.com/docs/getting-started/installation/reactnative
- Apple in-app purchase setup: https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/
- Apple auto-renewable subscriptions: https://developer.apple.com/app-store/subscriptions/
