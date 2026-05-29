# RevenueCat Setup

This project uses one entitlement and three purchase packages. Keep these values in sync with `lib/purchases.ts` and the landing page pricing.

## Source of truth

Entitlement identifier:

- `psychotechniplus Pro`

Offering:

- `default`

Packages:

| Package | Product ID | Type | App price |
| --- | --- | --- | --- |
| `weekly` / `$rc_weekly` | `weekly` | Auto-renewing subscription, 1 week | NIS 49.90 |
| `monthly` / `$rc_monthly` | `monthly` | Auto-renewing subscription, 1 month | NIS 99.90 |
| `lifetime` / `$rc_lifetime` | `lifetime` | Lifetime / non-consumable access | NIS 199 |

## Dashboard checklist

1. Create the products first in App Store Connect and Google Play Console with the exact product IDs above.
2. In RevenueCat, create or verify the `premium` entitlement.
3. Add the three store products to the RevenueCat app.
4. Attach all three products to the `premium` entitlement.
5. Create or verify the `default` offering.
6. Add the packages `weekly`, `monthly`, and `lifetime` to the `default` offering.
7. Confirm the package order shown to users is weekly, monthly, lifetime.
8. Verify the RevenueCat SDK key in `lib/purchases.ts`: `test_QEWYAtjdTugtGFWGvpOncFXuwYS`.
9. The native SDKs are installed with `npx expo install react-native-purchases react-native-purchases-ui`.
10. Configure a RevenueCat Paywall for the `default` offering and enable Customer Center when you want subscription management inside the app.

Project dashboard:

- https://app.revenuecat.com/projects/709b2d2f/overview

Implementation files:

- `lib/purchases.ts` configures RevenueCat, offerings, customer info, entitlement checks, purchases, restore, Paywall, and Customer Center.
- `store/purchaseStore.ts` keeps the current CustomerInfo and syncs `isPremium`.
- `app/paywall.tsx` includes the custom paywall and buttons for RevenueCat Paywall and Customer Center.

Official RevenueCat references:

- Products: https://www.revenuecat.com/docs/offerings/products-overview
- Entitlements: https://www.revenuecat.com/docs/getting-started/entitlements
- Offerings and packages: https://www.revenuecat.com/docs/offerings/overview

## Notes

- The landing page reads pricing from the shared purchase package data, so changing the prices in `lib/purchases.ts` updates the landing pricing too.
- The current RevenueCat project is configured against the Test Store product IDs `weekly`, `monthly`, and `lifetime`. For production App Store / Google Play products, create matching real store products and update `PRODUCT_IDS` only if the real store identifiers differ.
- RevenueCat cannot create App Store Connect or Google Play products by itself; those products must exist in the stores before RevenueCat can attach them.
- Account configuration requires access to your RevenueCat project or an authenticated RevenueCat API token. Do not commit private API keys or service tokens.
