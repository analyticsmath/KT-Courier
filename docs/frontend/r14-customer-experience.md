# R14 — Customer Account and Delivery Experience

## 1. Objective

R14 rebuilds the actual customer-owned protected account surface as a calm, mobile-first delivery desk. It preserves routes, guards, services, DTOs, forms, pricing, payments, locks, and ownership. It changes presentation only, except for eliminating the existing manual-address fallback's invented coordinates so that a provider-unavailable address cannot generate a fabricated route or quote.

## 2. Verified route inventory

The authoritative 27-route customer matrix is in [r14-customer-route-matrix.md](r14-customer-route-matrix.md). The live tree also confirmed no account-local loading, error, or not-found boundary. Root boundaries apply. R12's inventory was directionally useful but drifted from the current tree by omitting `business` and `payout-destinations` and treating several fixture-only pages as concrete.

## 3. Customer information architecture

High-frequency destinations are Overview, Request delivery, My deliveries, Wallet, and Notifications. R13's registry provides the customer bottom navigation. Addresses, Refunds, Profile, and Support remain grouped under More/desktop navigation. Actual unregistered routes are preserved; they are not forced into the bottom bar.

## 4. Overview architecture

The overview is server-rendered and has a compact heading, one Request delivery action, two direct-authority metrics, one deterministic active-delivery panel, recent delivery records, and account help links. It does not load wallet, payment, refund, membership, or notification data. The selected active delivery is ordered by `updatedAt DESC, id ASC`; no carousel is used.

## 5. Delivery-request architecture

The existing canonical `DeliveryRequestForm` remains the only request form. It retains its five existing steps, quote ID, pricing request, order submission, repeat prefill, field/API error handling, route estimate request, and success destination. Pricing, regions, validation, rate limiting, same-origin checks, and order creation remain server/API authorities.

The verified address map state is `PROVIDER_UNAVAILABLE` / `TEXT_ENTRY_ONLY` when address suggestions cannot load. Text entry remains available, but the former Johannesburg-coordinate fallback was removed. A quote and route estimate require provider-confirmed coordinates, exactly as the server pricing schema requires. No fake distance, map, ETA, or client-side price calculation is introduced.

## 6. Order-list architecture

The orders page uses the existing owned `OrderSummaryDto` query with its real exact status and page support. The desktop table is semantic and the compact view is a real list of structured records linking to the dedicated detail route. Active filter text is explicit and the mobile control uses the R13 protected drawer. There is no client-only global filter over a loaded page.

## 7. Order-detail architecture

Order detail is a dedicated server route. Its customer-safe presentation contains identity, current public status, pickup/destination, request details, server-issued amount when present, public proof of delivery, ordered public status history, cancellation where the existing state authority permits it, payment's existing canonical entry, and support. It deliberately omits map frames, route estimates, driver coordinates, driver contact, administrative notes, assignment detail, internal exception evidence, and raw/internal status fallback.

## 8. Tracking and timeline

Customer labels are explicitly mapped for every repository order status. Unknown values display “Status update unavailable” rather than a successful state. Timelines use ordered semantics and source timestamps. No anonymous tracking, public tracking-number entry, live vehicle motion, ETA, progress percentage, or fake map was added.

## 9. Address management

The existing customer-owned address manager remains the mutation island and retains create/edit/delete/default authority and validation. R14 wraps it in the protected presentation and preserves its touch card layout. Saved addresses remain server-owned. Provider-unavailable text entry never invents coordinates.

## 10. Wallet

Wallet summary and activity use existing customer wallet projections. Available and held values retain server-issued decimal text and explicit `ZAR`; wallet activity no longer exposes journal references or ledger account implementation fields. The wallet remains read-only and no spending, transfer, top-up, or checkout state is inferred.

## 11. Payments

The existing order payment entry is retained only on the canonical order detail. The account payment-method route had fixture cards and no connected customer DTO, so it is now an honest unavailable state. No card, provider payload, token, or payment-success inference is displayed.

## 12. Refunds

Refund list/detail pages use the existing customer-safe refund projections, exact amount strings, explicit currency, source history, and existing cancel/request islands. Provider, ledger, finance-review, reconciliation evidence, and internal reason details are not rendered. The existing production validation lock remains visible and unchanged.

## 13. Subscription/membership state

Membership, benefits, and invoices remain route-continuous, but their online subscription and billing state is locked. R14 shows no fictional free tier, entitlement, benefit quota, or invoice.

## 14. Marketplace-order state

No concrete customer marketplace-order account route exists in the current account tree. R14 adds none and does not activate marketplace checkout.

## 15. Notifications

The customer notification page uses a small server-only projection of ID, title, body, unread state, and timestamp. It is rendered as a semantic inbox list and exposes no raw model fields to a client island.

## 16. Profile/security

Profile keeps the existing profile form and secure reset link. The security route had fixture devices, IPs, locations, and non-working revoke actions; it now states that session controls lack a customer-safe projection. No security state is fabricated.

## 17. Server/client boundaries

Pages, headers, lists, financial projections, navigation, notifications, and detail views remain server-rendered. Existing client islands are limited to delivery request, address manager, profile, refund request/cancel, withdrawal request/cancel, order cancellation, and the small mobile filter drawer. No global customer store or raw Prisma model is passed to a new client component.

## 18. Mobile architecture

See [r14-customer-mobile-architecture.md](r14-customer-mobile-architecture.md). Compact order records use real list semantics, desktop tables do not squeeze into compact widths, and details are routes rather than modals.

## 19. Accessibility

Every R14 page has one `ProtectedPageHeader` H1. The account shell retains its skip link and main landmark. Tables have captions; the table foundation emits `aria-sort` only for genuinely sortable columns. Timelines are ordered lists; compact order records are semantic lists; statuses use text plus a marker. The form's top-level error is announced. Manual testing remains required for all field association, focus, forced-colours, reduced-motion, 200% zoom, 400% reflow, and keyboard behavior.

## 20. Performance

The overview uses four compact server queries and limits recent deliveries to five. It avoids a chart, map instance, wallet/notification aggregate, and broad detail history query. Orders, wallet, refunds, and withdrawals use the existing pagination services. New art is a local SVG; no dependency or chart/map package was added.

## 21. Security

Order detail, repeat prefill, exceptions, refunds, withdrawals, payout destinations, addresses, wallet, and profile retain existing server-side user/owner queries. Customer status maps are explicit; unknown values are neutral/unavailable. R14 does not render internal notes, ledger IDs, account numbers, provider content, driver location/contact, production-lock evidence, raw permissions, or session material.

## 22. Known backend limitations

- The request API does not expose a customer request-operation/idempotency value to the current form; R14 does not invent or bypass one.
- Customer order detail's service DTO contains `adminNote` server-side. R14's customer presentation never passes or renders it; a later DTO-boundary hardening phase should remove it from the customer detail DTO itself.
- Provider-unavailable text entry cannot satisfy the existing coordinate-required quote schema; a product-approved provider or server-approved manual-quote workflow is needed for full fallback booking.
- No customer-safe payment-method, recipient-book, session, business-team, promotion, membership contract, entitlement, or subscription invoice projection exists.

## 23. Production locks

Refund execution, production withdrawals, subscriptions, and marketplace checkout retain their existing locks. R14 only presents their current state and does not toggle flags, activate forms, infer payment success, or reveal lock evidence.

## 24. Known content/data gaps

The unsupported route states intentionally replace pre-existing fixture cards, people, coupon values, session/IP data, fake exception custody copy, and fictional membership content. Support has an existing contact pathway but no connected customer ticket DTO. Notification preferences and developer entry links are not concrete customer account routes.

## 25. R15 boundary

R15 — Store Operations Experience
