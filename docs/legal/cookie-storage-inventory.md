# R10 cookie and browser-storage inventory

Status: source-code audit. This is not an approved Cookie Notice and contains no cookie values.

| Storage item | Source | Purpose evidenced by code | First/third party | Lifetime | HTTP-only / secure / same-site / JS readable | Essential engineering assessment | Legal-review status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `kt_session` | `lib/auth/session.ts`; login and OTP routes | Authenticated session lookup | First party | 14 days (`SESSION_DURATION_DAYS`) | HTTP-only; secure in production; `Lax`; not JavaScript-readable | Required for signed-in session operation | Cookie disclosure approval required. |
| `kt_marketplace_cart` | `lib/marketplace-checkout/tokens.ts`; cart routes | Opaque guest-cart association | First party | 30 days | HTTP-only; secure in production; `Lax`; not JavaScript-readable | Code-supported marketplace capability, currently public-locked | Cookie and marketplace policy decision required before public enablement. |
| `kt_marketplace_checkout` | `lib/marketplace-checkout/tokens.ts` | Opaque guest checkout association | First party | Uses marketplace guest-cookie policy where set | HTTP-only; secure in production; `Lax`; not JavaScript-readable | Code-supported marketplace capability, currently public-locked | Cookie and checkout policy decision required. |
| `kt_marketplace_order` | `lib/marketplace-checkout/tokens.ts` | Opaque guest-order association | First party | Uses marketplace guest-cookie policy where set | HTTP-only; secure in production; `Lax`; not JavaScript-readable | Code-supported marketplace capability, currently public-locked | Cookie and order-access policy decision required. |
| Catalog draft local storage | `components/catalog/StoreCatalogWizard.tsx` | Draft recovery for a protected store catalog workflow | First party browser storage | Until overwritten or removed | JavaScript-readable; no cookie flags apply | Protected operational workflow, not a public marketing preference | Not included in a public Cookie Notice without counsel review. |

No Google Analytics, Google Tag Manager, advertising pixel, social pixel, consent-management package, or public third-party media embed was found by the R10 source scan. Google Maps and PayFast integration code exists for scoped operational flows, but the audit found no public marketing tracker or generic external script injection.

No cookie banner was added: the repository contains no identified non-essential tracking for which an approved consent model could be implemented.

