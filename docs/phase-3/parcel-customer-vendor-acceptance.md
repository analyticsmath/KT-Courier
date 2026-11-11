# Parcel Delivery & Cross-Persona Acceptance (PAR-01 through PAR-12)

**Phase**: Phase 3 Final Production Certification  
**Repository**: `analyticsmath/KT-Courier`  
**Scope**: Customer & Vendor Parcel Journeys, Dispatch Hardening, Driver Execution, and Marketplace Separation  
**Status**: ENGINEERING COMPLETE & VERIFIED  

---

## 1. Domain Separation: Parcel Courier vs. Marketplace Orders

The KT Couriers platform maintains strict architectural and ledger separation between two core business models:
1. **Direct Parcel Delivery (Point-to-Point)**:
   - On-demand courier service booked by individual customers or business vendors.
   - Fixed or distance/weight-based dynamic tariff.
   - Direct driver dispatch, pickup OTP from sender, delivery OTP from recipient, and photographic Proof of Delivery (POD).
   - Single payment capturing courier fee; balanced ledger credits driver earnings and platform courier revenue.
2. **Marketplace Catalog & Store Orders**:
   - Multi-vendor e-commerce checkout with store carts, variants, modifiers, and store groups.
   - Inventory reservation holds, catalog item consumption, and merchant settlement snapshots.
   - Seller identity evidence, commission calculations, promotional subsidy journals, and merchant payout schedules.

---

## 2. Requirements and Verification Matrix (PAR-01 through PAR-12)

| Requirement ID | Capability Description | Behavioral Specification | Supporting Test Suites & Evidence | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **PAR-01** | **Dynamic Parcel Quoting** | Instant pricing based on volumetric weight ($L \times W \times H / 5000$), physical weight, distance, route tier (standard, express, same-day), and vehicle class. | `tests/pricing/calculator.test.ts`<br>`tests/pricing/commercial-pricing-taxonomy.test.ts`<br>`tests/pricing/config.test.ts` | **PASS** |
| **PAR-02** | **Recipient & Sender Identification** | Mandatory email and phone capture for both sender and recipient; fail-closed validation before quote conversion. | `tests/client-platform/mandatory-parcel-recipient-email.test.ts`<br>`tests/client-platform/parcel-sender-recipient-email-authority.test.ts` | **PASS** |
| **PAR-03** | **Geocoding & Coverage** | Bounded South African coordinates (-35° to -22° Lat, 16° to 33° Lng); suburb and postal code resolution; high-risk suburb rate adjustments. | `tests/client-platform/checkout-address-safety.test.ts`<br>`tests/client-platform/coverage-freshness.test.ts`<br>`tests/pricing/owner-approved-initial-parcels.test.ts` | **PASS** |
| **PAR-04** | **Payment Method Selection & Processing** | Digital payment via Paystack/Payfast card checkout, corporate customer account billing, or driver cash on delivery where authorized. | `tests/api/parcel-payment-methods.test.ts`<br>`tests/payments/parcel-payment-method-selection.test.ts`<br>`tests/client-platform/parcel-payment-choice-ui.test.ts` | **PASS** |
| **PAR-05** | **Automated Dispatch & Driver Assignment** | Proximity-based driver matching, vehicle class compatibility check, driver availability verification, and immutable assignment commands. | `tests/integration/dispatch-lifecycle.integration.test.ts`<br>`tests/integration/dispatch-concurrency.integration.test.ts` | **PASS** |
| **PAR-06** | **Cryptographic Pickup & Delivery OTP** | 6-digit one-time PINs generated using HMAC-SHA256, delivered via secure SMS/email; prevents unauthorized package release. | `tests/driver-operations/parcel-sender-pickup-otp.test.ts`<br>`tests/integration/delivery-otp-atomicity.integration.test.ts` | **PASS** |
| **PAR-07** | **Proof of Delivery (POD) Validation** | Mandatory recipient signature capture, timestamp, driver GPS coordinates within delivery fence, and parcel photo attachment. | `tests/driver-operations/`<br>`tests/integration/driver-canonical-delivery.integration.test.ts` | **PASS** |
| **PAR-08** | **Balanced Double-Entry Ledger Posting** | Every paid delivery posts balanced journals debiting cash clearing and crediting customer funds held, driver payable, and courier revenue. | `tests/payments/paystack-financial-invariants.test.ts`<br>`tests/payments/ledger-boundary-source-audit.test.ts` | **PASS** |
| **PAR-09** | **Public & Authenticated Tracking** | Opaque tracking references (`TRK-...`), real-time status timeline (Quote $\to$ Paid $\to$ Dispatched $\to$ Picked Up $\to$ In Transit $\to$ Delivered). | `tests/tracking/parcel-tracking-reference.test.ts`<br>`tests/client-platform/public-route-family.test.ts` | **PASS** |
| **PAR-10** | **Vendor Portal Parcel Management** | Saved package profiles, bulk order creation, default pickup address binding, and monthly billing statements. | `tests/client-platform/parcel-profiles.test.ts`<br>`tests/client-platform/parcel-profiles-manager.test.ts` | **PASS** |
| **PAR-11** | **Delivery Exception Workflows** | Unreachable recipient, incorrect address, or driver breakdown; triggers formal exception log, reschedule, or return-to-sender. | `tests/client-platform/support-access.test.ts`<br>`tests/integration/` | **PASS** |
| **PAR-12** | **Cancellations & Automated Refunds** | Immediate refund calculation before driver dispatch; fee withholding post-dispatch; balanced journal reversals. | `tests/refunds/refund-state-machine.test.ts`<br>`tests/refunds/refundable-amount.test.ts` | **PASS** |

---

## 3. Persona Acceptance Scenarios

### 3.1. Customer Parcel Sender
- **Quote Flow**: User enters pickup address in Rosebank, destination in Centurion, selects standard box (3kg). System calculates ZAR 145.00 based on Gauteng provincial matrix.
- **Booking & Payment**: Enters recipient contact details. Selects card payment. Paystack modal initializes with reference `pay_...`. Succeeded webhook confirms payment.
- **Dispatch & Tracking**: Order assigned to nearby verified driver. Sender receives pickup OTP via SMS. Recipient receives live tracking link.
- **Handoff**: Driver arrives, enters pickup OTP to confirm receipt. Driver drives to destination, collects recipient delivery OTP, captures photo POD. Status transitions to `DELIVERED`.

### 3.2. Vendor Parcel Shipper
- **Bulk Booking**: Store owner logs into `/store/new-delivery`, loads saved package profile `"Large Apparel Box (5kg)"`.
- **Pickup Address Binding**: System automatically binds store's certified default pickup address (`StoreCheckoutCertification`).
- **Settlement & Invoicing**: Shipping fee deducted from store wallet balance or charged via linked payment method; VAT tax invoice generated.

### 3.3. Marketplace Customer Order (Contrast)
- **Multi-Store Checkout**: Customer adds items from Store A and Store B.
- **Inventory Hold**: Stock levels reserved in `CatalogInventoryLevel` with active movement intents.
- **Promotional Subsidy**: First-store welcome discount (ZAR 50.00) applied. Check constraint verifies `grandTotal = gross - 50.00`.
- **Merchant Finalization**: Distinct store orders generated (`MarketplaceStoreOrder`), commission deducted, platform subsidy debited from platform promotion expense and credited to customer held funds.
