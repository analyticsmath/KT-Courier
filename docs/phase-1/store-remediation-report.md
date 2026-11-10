# KT Couriers — Phase 1 Store Remediation & Live Certification Report

## 1. Store Live Readiness Invariants (`isStorePubliclyCheckoutReady`)

A store is projected as publicly `Live` and eligible for customer marketplace checkout if and only if **every** prerequisite below is satisfied simultaneously ([`lib/storefront/store-publication-readiness.ts`](file:///d:/KT-Courier/lib/storefront/store-publication-readiness.ts) & [`lib/marketplace-checkout/checkout.service.ts`](file:///d:/KT-Courier/lib/marketplace-checkout/checkout.service.ts)):

1. **Store Record & Owner Authority**:
   - `Store.status === "ACTIVE"` with non-empty `name` and `slug`.
   - Store owner user account is `ACTIVE` with verified email (`emailVerifiedAt !== null`).
2. **Reviewed Seller Legal Identity (`StoreSellerLegalIdentity`)**:
   - Owner submits seller identity via `/store/profile` ([`StoreSellerIdentityForm.tsx`](file:///d:/KT-Courier/components/store/StoreSellerIdentityForm.tsx)) using a valid `identityVersion` (auto-suggested from trading/legal name, e.g., `PAMMY_BAKES_V1`) and a genuine uploaded `STORE_VERIFICATION_DOCUMENT` reference (`PMO-<uuid>`) or admin-registered external evidence (`EXT-...`).
   - Unregistered/individual sellers are supported (`vatRegistrationStatus: "NOT_REGISTERED"`, `invoiceClassification: "RECEIPT"`, optional `registrationReference` and `vatNumber`).
   - A separate administrator (`actorUserId !== store.ownerUserId`) with `STORES_APPROVE` and `LEGAL_DOCUMENTS_PUBLISH` permissions approves the proposal, creating an effective `APPROVED` `StoreSellerLegalIdentity` record.
3. **Complete Store-Owned Collection Address (`Address`)**:
   - Store has a dedicated `Address` record with `type = "PICKUP"` and `storeId = store.id` ([`completeStorePickupAddress()`](file:///d:/KT-Courier/lib/marketplace-checkout/store-pickup-selection.ts)).
   - Required fields: `line1`, `city`, `province` (active coverage province, currently `Gauteng`), `postalCode`, `country` (`South Africa` / `ZA`), Google `placeId`, and verified South African coordinates (`latitude`, `longitude`) inside an active `DeliveryRegion` (Johannesburg or Pretoria/Tshwane).
   - Never fabricated or guessed from flat text.
4. **Approved Store Operational Policy (`StoreOrderOperationalPolicy`)**:
   - Active policy (`status = "ACTIVE"`, `effectiveFrom <= now`, `effectiveTo === null || effectiveTo > now`) with `acceptanceWindowMinutes`, `preparationSlaMinutes`, `substitutionPolicy`, `partialFulfilmentAllowed`, and `approvedByUserId !== store.ownerUserId`.
5. **Published Storefront & Packed Catalog Offers**:
   - At least one published storefront catalog document (`documentsCount > 0`) and active sellable offers whose item weight/dimensions pack within active `SMALL`, `MEDIUM`, or `LARGE` `ParcelProfileVersion` limits ([`packStoreOrderItems()`](file:///d:/KT-Courier/lib/marketplace-checkout/store-item-packing.ts)).
6. **Two-Admin Store Checkout Certification (`StoreCheckoutCertification`)**:
   - Administrator A (`preparedByUserId`) prepares the certification bound to `pickupAddressId` and `pickupCertificationFingerprint(pickup)` with 64-hex SHA-256 `routeEvidenceDigest` and `checkoutEvidenceDigest`.
   - Administrator B (`approvedByUserId !== preparedByUserId`) independently approves the certification (`status = "APPROVED"`, `expiresAt > now`).
   - Any subsequent edit to the store's pickup address changes `pickupCertificationFingerprint(pickup)` and automatically invalidates public `Live` status until recertified.

## 2. Store Classification & Exact Remediation Checklist

| Store Classification | Public Visibility & Checkout Behavior | Exact Admin / Vendor Remediation Steps |
|---|---|---|
| **Incomplete / Uncertified Store** (missing `PICKUP` coordinates, missing `StoreSellerLegalIdentity`, missing `StoreOrderOperationalPolicy`, or unapproved `StoreCheckoutCertification`) | **Hidden from public Live checkout** (`isStorePubliclyCheckoutReady() === false`). Direct checkout attempts fail closed with specific code (`STORE_PICKUP_UNAVAILABLE`, `STORE_SELLER_IDENTITY_UNAVAILABLE`, `STORE_ORDER_POLICY_UNAVAILABLE`, `DELIVERY_PRICING_UNAVAILABLE`). | 1. **Store Owner (`/store/profile`)**: Upload verification document (`PDF`/`JPEG`/`PNG`/`WebP`) to generate `PMO-<uuid>`, confirm auto-suggested `identityVersion` (e.g., `PAMMY_BAKES_V1`), select `NOT_REGISTERED` + `RECEIPT` (or supply VAT number if registered), and submit.<br>2. **Store Owner (`/store/addresses`)**: Select the store collection address from Google Places autocomplete in Johannesburg or Pretoria so `placeId`, `latitude`, `longitude`, and `postalCode` are saved on the store's `PICKUP` address.<br>3. **Admin 1 (`/admin/stores/[id]/seller-identity` & `/admin/stores/[id]`)**: Review and approve seller identity; configure and activate `StoreOrderOperationalPolicy` and `PaymentMethodPolicy` (`DIGITAL_ONLY`); prepare `StoreCheckoutCertification` with route & test-checkout digests.<br>4. **Admin 2 (`/admin/stores/[id]`)**: Independently approve `StoreCheckoutCertification` (`approvedByUserId !== preparedByUserId`). |
| **Certified Live Store** (all 6 prerequisites active and unexpired, e.g., certified Pammy Bakes / verified Gauteng vendor) | **Publicly Live** on `/shop` and `/shop/stores/[slug]`; customers can add items to `/cart`, complete `/checkout/[reference]` via Paystack Card payment, and generate paid `MarketplaceOrder` + `MarketplaceStoreOrder` records. (`CODE_VERIFIED` & `STAGING_VERIFIED` on disposable PostgreSQL + Chromium E2E; real-world merchant promotion in production remains `EXTERNAL_APPROVAL_REQUIRED` pending authentic owner verification documents and independent 2-admin certification receipts.) | Maintain active `StoreCheckoutCertification` before `expiresAt`; if the physical collection address changes, re-run 2-admin checkout certification for the new `pickupCertificationFingerprint`. |
