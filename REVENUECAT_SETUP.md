# RevenueCat Setup

This project uses one entitlement and three purchase packages. Keep these values in sync with `lib/purchases.ts` and the landing page pricing.

## Source of truth

Entitlement:

- `premium`

Offering:

- `default`

Packages:

| Package | Product ID | Type | App price |
| --- | --- | --- | --- |
| `weekly` | `com.psychotechniplus.premium.weekly` | Auto-renewing subscription, 1 week | NIS 49.90 |
| `monthly` | `com.psychotechniplus.premium.monthly` | Auto-renewing subscription, 1 month | NIS 99.90 |
| `lifetime` | `com.psychotechniplus.premium.lifetime` | Lifetime / non-consumable access | NIS 199 |

## Dashboard checklist

1. Create the products first in App Store Connect and Google Play Console with the exact product IDs above.
2. In RevenueCat, create or verify the `premium` entitlement.
3. Add the three store products to the RevenueCat app.
4. Attach all three products to the `premium` entitlement.
5. Create or verify the `default` offering.
6. Add the packages `weekly`, `monthly`, and `lifetime` to the `default` offering.
7. Confirm the package order shown to users is weekly, monthly, lifetime.
8. Copy the public iOS and Android SDK keys into `lib/purchases.ts`.
9. Install the native SDK with `npx expo install react-native-purchases`.
10. Change `USE_REAL_PURCHASES` in `lib/purchases.ts` to `true`.

Official RevenueCat references:

- Products: https://www.revenuecat.com/docs/offerings/products-overview
- Entitlements: https://www.revenuecat.com/docs/getting-started/entitlements
- Offerings and packages: https://www.revenuecat.com/docs/offerings/overview

## Notes

- The landing page reads pricing from the shared purchase package data, so changing the prices in `lib/purchases.ts` updates the landing pricing too.
- RevenueCat cannot create App Store Connect or Google Play products by itself; those products must exist in the stores before RevenueCat can attach them.
- Account configuration requires access to your RevenueCat project or an authenticated RevenueCat API token. Do not commit private API keys or service tokens.
