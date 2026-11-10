# Cross-Persona Journey Acceptance Certification

**Phase**: Phase 3 Final Production Certification  
**Repository**: `analyticsmath/KT-Courier`  
**Branch**: `main`  
**Audited Baseline SHA**: `e47fdae93fa8ce8d1113a63617443a2b774cf6bb`  
**Viewports Certified**: 320px (compact mobile), 390px (standard mobile), 1440px (desktop)  

---

## 1. Persona Matrix & Access Control Policy

KT Couriers enforces strict Role-Based Access Control (RBAC) and Broken Object-Level Authorization (BOLA) protections across four distinct system personas:

| Persona | Allowed Roles | Default Workspace Path | Core Business Domains | BOLA Boundary Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | `CUSTOMER` | `/account` | Profile, addresses, parcel booking, store shopping, order tracking, wallet, reviews, refunds | Enforces `ownerUserId === session.user.id` on all orders, addresses, and wallets. |
| **Driver** | `DRIVER` | `/driver` | Availability, vehicle documents, dispatch acceptance, navigation, OTP / POD capture, earnings | Enforces `driverId === session.user.driverProfile.id` on assignments and earnings. |
| **Store** | `STORE` | `/store` | Store profile, pickup map point, catalog, stock, operational policy, handoffs, earnings | Enforces `storeId === session.user.storeId` on all products, orders, and settlements. |
| **Admin** | `ADMIN`, `SUPER_ADMIN` | `/admin` | Store approvals, driver compliance, catalog moderation, dispatch, ledger, finance, disputes | Enforces granular permission keys (e.g. `CUSTOMERS_UPDATE`, `REFUNDS_APPROVE`). |

---

## 2. Customer Persona Acceptance

### User Journey Walkthrough
1. **Discovery & Address Setup**:
   - Customer accesses `/` or `/shop`, searches products or stores with real-time autocomplete.
   - Saves delivery address at `/account/addresses` with verified South African coordinates (lat -35 to -22, lng 16 to 33).
2. **Parcel Booking**:
   - Customer enters pickup and dropoff addresses at `/quote`.
   - Tariff engine calculates Economy, Standard, or Express rates with distance and volume pricing.
   - Card payment initiated via Paystack checkout; redirected upon success to `/track` with live parcel milestone timeline.
3. **Marketplace Shopping & Multi-Store Basket**:
   - Adds items from certified active stores to cart (`/cart`).
   - Line items snapshot unit price, modifier options, and selling units.
   - Proceeds to `/checkout/[reference]/review`: applies R50 first-store welcome offer or valid coupon.
   - Executes Paystack card payment; redirected to `/order-confirmation/[publicReference]`.
4. **Order Tracking & Aftercare**:
   - Views order details at `/account/orders/[id]`.
   - In-transit driver position rendered without leaking driver private contact information.
   - Delivery verified by OTP handoff.
   - Customer submits store and driver reviews (`/account/reviews`); requests partial or full refund if damaged (`/account/refunds`).

### Engineering Verification
- `tests/marketplace-checkout/customer-checkout-prefill.test.ts`: Passed.
- `tests/marketplace-checkout/cart-mutation.service.test.ts`: 19/19 passed.
- `tests/services/customer-wallet-visibility.test.ts`: 3/3 passed.

---

## 3. Driver Persona Acceptance

### User Journey Walkthrough
1. **Onboarding & Document Verification**:
   - Driver uploads South African ID, PrDP driver's license, vehicle registration, and roadworthy certificate at `/driver/onboarding`.
   - Uploads are sanitized, stripped of EXIF metadata, and hashed before storage in Cloudinary.
2. **Shift Management & Dispatch**:
   - Driver toggles online status at `/driver/availability`.
   - System auto-assigns eligible deliveries within the driver's licensed vehicle capacity (Motorcycle, Bakkie, Panel Van).
   - Driver accepts dispatch assignment at `/driver/assignments/[id]`.
3. **Pickup & In-Transit Custody**:
   - Navigates to merchant pickup location; merchant confirms handoff.
   - Status updates to `IN_TRANSIT` with tamper-resistant audit log.
4. **Delivery Completion & POD**:
   - Driver requests customer delivery OTP; enters OTP into `/driver/delivery`.
   - Captures photographic Proof of Delivery (POD) photo.
   - Order completed; driver credited with 70% tariff share in `/driver/earnings`.
5. **Withdrawal**:
   - Driver views cleared earnings; requests payout to registered South African bank account at `/driver/withdrawals`.

### Engineering Verification
- `tests/driver-operations/custody-policy.test.ts`: Passed.
- `tests/driver-operations/pod-policy.test.ts`: Passed.
- `tests/driver-operations/otp-policy.test.ts`: Passed.
- `tests/driver-earnings/driver-earning-account.service.test.ts`: Passed.

---

## 4. Store / Merchant Persona Acceptance

### User Journey Walkthrough
1. **Store Identity & Pickup Point Certification**:
   - Merchant configures store profile, legal trading identity, and VAT registration at `/store/profile`.
   - Pins collection address on map; system verifies address completeness (street, suburb, 4-digit postal code, province, country 'ZA', and non-zero lat/lng).
   - Generates cryptographic `pickupCertificationFingerprint`.
2. **Catalog & Inventory Authoring**:
   - Merchant creates product drafts with variants and optional modifier groups at `/store/catalog/products/new`.
   - Submits offers for administrative moderation; approved items reflect in public catalog.
3. **Order Preparation & Handoff**:
   - Merchant receives incoming order alert at `/store/orders`.
   - Prepares items and marks order `READY_FOR_COLLECTION`.
   - Handoff verified by driver badge and transfer PIN.
4. **Earnings & Settlement**:
   - Merchant tracks gross sales, 8% platform commission deduction, and net store earnings at `/store/earnings`.
   - Mature earnings automatically clear after order completion window.
   - Requests bank settlement to registered business bank account at `/store/withdrawals`.

### Engineering Verification
- `tests/admin/store-pickup-readiness.test.ts`: 5/5 passed.
- `tests/storefront/store-publication-readiness.test.ts`: 15/15 passed.
- `tests/store-earnings/store-earning-admin-ui-contract.test.ts`: Passed.

---

## 5. Admin & Operator Persona Acceptance

### User Journey Walkthrough
1. **Compliance & Approvals**:
   - Admin reviews driver KYC documents at `/admin/drivers/[id]`; approves or rejects with formal reason.
   - Reviews store legal identities and operational policies at `/admin/stores/[id]`.
   - Executes dual-operator store checkout certification:
     $$\text{approvedByUserId} \ne \text{preparedByUserId}$$
2. **Commercial & Catalog Operations**:
   - Reviews flagged products and offers at `/admin/catalog/moderation`.
   - Manages platform commission policies (default 8% store, 30% courier) at `/admin/commission-plans`.
3. **Dispatch & Incident Management**:
   - Monitors live dispatch map at `/admin/dispatch`.
   - Reassigns stalled deliveries or resolves delivery exceptions at `/admin/delivery-exceptions`.
4. **Financial Control & Ledger Auditing**:
   - Inspects real-time double-entry ledger balance sheet at `/admin/ledger`.
   - Dual-approves customer refunds exceeding R500.00 at `/admin/refunds`.
   - Reconciles Paystack settlements and merchant payouts at `/admin/finance`.

### Engineering Verification
- `tests/services/admin-permissions.service.test.ts`: 14/14 passed.
- `tests/refunds/refund-dual-control.test.ts`: 3/3 passed.
- `tests/security/bola-negative-authorization.test.ts`: 14/14 passed.
- `tests/security/bola-object-authorization.test.ts`: 9/9 passed.

---

## 6. Viewport and Accessibility Verification

- **Responsive Viewports**: All shared navigation bars, checkout steps, order tracking maps, and admin grids verified across 320px, 390px, and 1440px viewports with zero horizontal overflow or clipping.
- **Accessibility & Contrast**: Typography and contrast conform to WCAG 2.1 AA requirements using standard high-contrast neutral scales.
- **Security Isolation**: Cross-tab and same-browser session switching verifies that customer, driver, and merchant tokens remain strictly isolated.

All persona journeys meet verified production-grade engineering standards.
