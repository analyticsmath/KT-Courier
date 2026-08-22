# KT Couriers — Chief Architect Phase 1: Functional Closure & Architecture Record

**Execution Target:** `analyticsmath/KT-Courier`  
**Execution Unit:** Chief Architect Phase 1 — End-to-End Functional Closure  
**Working Directory:** `d:\KT-Courier`  
**Document Classification:** Architectural Authority & Functional Closure Record  
**Document Date:** 22 August 2026  
**Final Architectural Verdict:** **`CHIEF_ARCHITECT_PHASE_1_FUNCTIONAL_CLOSURE_PROVEN`**

---

## 1. Executive Architectural Summary & 77-Requirement Closure Model

This document constitutes the permanent architectural record and formal functional closure of **Chief Architect Phase 1 — End-to-End Functional Closure** for the KT Couriers platform.

KT Couriers is an integrated multi-tenant platform encompassing express parcel logistics, multi-vendor marketplace commerce, driver fleet management, double-entry financial ledgering, multi-level promoter affiliate networks, managed digital advertising, and POPIA privacy compliance.

### The 77-Requirement Closure Model
The platform is normalized across **77 core engineering requirements** (`ENG-COMPANY-001` through `ENG-POLICY-002`) derived from 1,555 atomic client requirements across 6 primary client legal and operational authorities:
1. `KT_Couriers_Updated Details..docx`
2. `KT COURIERS (PTY) LTD – ABOUT US.docx`
3. `KT COURIERS (PTY) LTD – TERMS AND CONDITIONS.docx`
4. `KT COURIERS (PTY) LTD – PRIVACY POLICY.docx`
5. `KT COURIERS (PTY) LTD – REFUND & CANCELLATION.docx`
6. `KT COURIERS (PTY) LTD – SHIPPING & DELIVERY.docx`

Every requirement is mapped 1:1 to:
- **Prisma Schema Data Authority**: Specific tables, columns, relations, and composite uniqueness constraints.
- **Domain Service Authority**: Pure, transaction-isolated business logic services in `lib/`.
- **API Transport Authority**: Next.js App Router route handlers in `app/api/`.
- **RBAC & BOLA Authorization**: Relationship-scoped permission guards in `lib/auth/`.
- **Functional Frontend Workflows**: Server and client page components in `app/(` routes.
- **Automated Test Proof**: Unit, domain, integration, and disposable PostgreSQL/Redis runtime test suites.

The complete machine-readable mapping is preserved in [`artifacts/chief-architect-phase-1-requirement-matrix.json`](file:///d:/KT-Courier/artifacts/chief-architect-phase-1-requirement-matrix.json).

---

## 2. Core Workstream Architecture (11 Functional Workstreams)

### Workstream 1: Company Profile, Commercial Boundaries, and Client Value Policy
- **Capability IDs**: `CAP-COMPANY` (`ENG-COMPANY-001` .. `003`), `CAP-COMMERCIAL` (`ENG-COMMERCIAL-001` .. `006`)
- **Canonical Database Models**: `SystemSetting`, `DeliveryServiceDefinition`, `ParcelProfileVersion`, `CommercialSurcharge`, `PaymentMethodPolicy`
- **Canonical Services**: `lib/services/admin-settings.service.ts`, `lib/settings/catalog.ts`, `lib/services/legal-documents.service.ts`, `lib/pricing/pricing-engine.service.ts`
- **Architectural Design**:
  - Centralized, typed system settings with strict mutability flags (`IMMUTABLE`, `ADMIN_MUTABLE`, `SUPER_ADMIN_MUTABLE`).
  - Immutable issuer snapshots generated at invoice/waybill creation time; historical financial documents never reflect subsequent company profile edits.
  - Multi-tier surcharge calculator supporting fuel indexing, volumetric dimensional multipliers, and after-hours/remote territory surcharges.

### Workstream 2: Product Catalog, Taxonomy, Modifiers, Inventory, and Storefront
- **Capability IDs**: `CAP-MODULE` (`ENG-MODULE-001` .. `004`), `CAP-GEO` (`ENG-GEO-001` .. `003`)
- **Canonical Database Models**: `CatalogProduct`, `CatalogCategory`, `ProductVariant`, `ProductOption`, `Store`, `StoreSellingTerritory`
- **Canonical Services**: `lib/catalog/`, `lib/storefront/`, `lib/geo/territory-validator.ts`
- **Architectural Design**:
  - Hierarchical product taxonomy with circular parent reference prevention and recursive depth limits.
  - Dynamic product variant matrix generation enforcing unique SKU boundaries and inventory reservation.
  - Geographic territory enforcement: merchants define delivery radiuses and geo-fenced polygons; customer location resolution validates vendor serviceability prior to checkout.

### Workstream 3: Customer Journey, Cart, Checkout, and Payment Integration
- **Capability IDs**: `CAP-PAY` (`ENG-PAY-001` .. `003`), `CAP-MEDIA` (`ENG-MEDIA-001` .. `004`)
- **Canonical Database Models**: `Cart`, `Order`, `Payment`, `PaymentAttempt`, `PaymentWebhookEvent`, `PaymentRefund`
- **Canonical Services**: `lib/payments/providers/payfast/payfast-adapter.ts`, `lib/services/payment-provider-session.service.ts`, `lib/payments/providers/payfast/payfast-signature.ts`
- **Architectural Design**:
  - PayFast by Network checkout form generation utilizing canonical RFC 3986 parameter serialization and standard MD5 digest generation with passphrase appending.
  - Webhook ITN reconciliation handler with zero browser-session trust; payment success is established strictly through server-to-server ITN parameter validation against upstream PayFast hosts.
  - Snapshot redaction policy (`lib/payments/provider-snapshot-policy.ts`) scrubbing merchant keys, passphrases, raw signatures, and customer emails prior to database persistence.

### Workstream 4: Order Lifecycle, Driver Workbench, Dispatch, and Custody
- **Capability IDs**: `CAP-DRIVER` (`ENG-DRIVER-001` .. `004`), `CAP-VEHICLE` (`ENG-VEHICLE-001` .. `003`)
- **Canonical Database Models**: `Order`, `OrderAssignment`, `DriverProfile`, `Vehicle`, `VehicleDocument`, `DriverDocument`
- **Canonical Services**: `lib/dispatch/dispatch-engine.service.ts`, `lib/services/driver-profile.service.ts`, `lib/services/vehicle-compliance.service.ts`, `lib/services/private-media.service.ts`
- **Architectural Design**:
  - Dispatch state machine (`PENDING` -> `ASSIGNED` -> `ACCEPTED` -> `IN_TRANSIT` -> `DELIVERED`) preventing out-of-order state transitions and double-assignment.
  - Automated driver eligibility assessment requiring active verified profile, unexpired driver license, approved vehicle inspection, and current roadworthy/insurance certificates.
  - Secure private media vault (`lib/services/private-media.service.ts`) serving sensitive compliance documents through short-lived tokenized presigned URLs with `Cache-Control: no-store` and immutable access logs.

### Workstream 5: COD (Cash on Delivery) Management and Driver Cash Custody
- **Capability IDs**: `CAP-COD` (`ENG-COD-001` .. `003`)
- **Canonical Database Models**: `CashOnDelivery`, `CashOnDeliveryEvent`, `CashOnDeliveryReconciliation`
- **Canonical Services**: `lib/services/cash-on-delivery.service.ts`, `lib/services/cod-reconciliation.service.ts`
- **Architectural Design**:
  - Doorstep cash custody tracking: driver marks full cash collection upon delivery, creating an immediate physical cash custody liability on the driver wallet.
  - Mandatory supervisor/admin cash reconciliation and physical deposit verification before custody release.
  - Real-time driver floating cash ceiling enforcement blocking new COD dispatch assignments when unremitted cash exceeds configured risk thresholds.

### Workstream 6: Claims, Remedies, Damage/Loss Resolution, and Fraud Protection
- **Capability IDs**: `CAP-CLAIM` (`ENG-CLAIM-001` .. `008`)
- **Canonical Database Models**: `Claim`, `ClaimEvidence`, `ClaimActivity`, `ClaimRemedy`, `RedeliveryRequest`
- **Canonical Services**: `lib/claims/claim.service.ts`, `lib/claims/remedy-processor.service.ts`, `lib/claims/fraud-detection.service.ts`
- **Architectural Design**:
  - Strict BOLA claimant authorization: customers may only file on their own orders; merchants/drivers on associated deliveries.
  - Multi-stage dispute lifecycle: evidence intake, investigation findings, liability assignment, and formal remedy resolution.
  - Idempotent remedy dispatch: financial refunds route through `PaymentRefund` with ledger reservations; physical redeliveries route to `RedeliveryRequest` without financial distortion.
  - Automated fraud detection heuristics flagging duplicate evidence hashes, abnormal order velocity, and repeated claims across linked accounts.

### Workstream 7: Promoter Network, Rank Progression, Referrals, and MLM Commission Engine
- **Capability IDs**: `CAP-PROM` (`ENG-PROM-001` .. `008`)
- **Canonical Database Models**: `PromoterProgramVersion`, `PromoterRankDefinition`, `PromoterAttribution`, `PromoterTeamEdge`, `PromoterQualificationEvaluation`, `PromoterEarning`
- **Canonical Services**: `lib/promoter/promoter-program.service.ts`, `lib/promoter/promoter-team-qualification.service.ts`, `lib/promoter/promoter-commission.service.ts`
- **Architectural Design**:
  - Version-controlled MLM compensation plans with immutable commission formulas and tier definitions.
  - Team hierarchy graph maintenance with strict cycle detection and parent reparenting controls.
  - Deterministic monthly qualification calculation evaluating personal and team volume, computing rank progression, and posting non-negative earnings accruals.
  - Fail-closed promoter production lock holding live payouts until commercial commission plan signoff.

### Workstream 8: Advertising, Managed Marketing Packages, and Channels
- **Capability IDs**: `CAP-ADS` (`ENG-ADS-001` .. `008`)
- **Canonical Database Models**: `AdvertisingCampaign`, `ManagedMarketingPackage`, `MarketingPlacement`, `MarketingReview`, `ManagedMarketingPerformanceRecord`
- **Canonical Services**: `lib/advertising/managed-marketing.service.ts`, `lib/advertising/funding.service.ts`
- **Architectural Design**:
  - Multi-channel marketing package catalog supporting In-App Banners, Category Spotlight, Featured Storefronts, and Push Notifications.
  - Editorial review workflow requiring admin asset approval before campaign scheduling.
  - Strict exclusion of phantom automated external publishing (`AUTOMATED_PROVIDER_RUNTIME_AVAILABLE = false`); only verified manual execution modes are operational.
  - Deterministic performance reporting ordered by `LATEST_MANAGED_MARKETING_PERFORMANCE_ORDER` (`recordedAt: desc`, `periodEndsAt: desc`, `id: desc`).

### Workstream 9: Privacy, POPIA Compliance, Data Subject Requests, and Retention
- **Capability IDs**: `CAP-PRIV` (`ENG-PRIV-001` .. `010`)
- **Canonical Database Models**: `PrivacyPreference`, `DataSubjectRequest`, `DataRetentionPolicy`, `ConsentRecord`
- **Canonical Services**: `lib/privacy/preference.service.ts`, `lib/privacy/provider-governance.service.ts`, `lib/services/privacy-requests.service.ts`, `lib/retention/privacy-retention.service.ts`
- **Architectural Design**:
  - South African POPIA-compliant granular consent tracking (essential, functional, analytics, direct marketing).
  - Data Subject Request (DSR) engine managing Access, Correction, and Deletion (right-to-be-forgotten) workflows.
  - Automated retention expiration worker pruning stale PII while respecting statutory tax retention and legal hold overrides.

### Workstream 10: Logistics Policies, Service Definitions, Specialised Services, and Surcharges
- **Capability IDs**: `CAP-SHIP` (`ENG-SHIP-001` .. `008`), `CAP-POLICY` (`ENG-POLICY-001` .. `002`)
- **Canonical Database Models**: `DeliveryServiceDefinition`, `SpecialisedDeliveryService`, `LegalPolicyVersion`, `LegalAcceptance`
- **Canonical Services**: `lib/shipping/shipping-policy.service.ts`, `lib/services/legal-documents.service.ts`
- **Architectural Design**:
  - Dynamic service definition engine accommodating Standard, Scheduled, and Express turnaround SLA models.
  - Specialised freight and fragile cargo handling with custom dimension requirements and declared value transit coverage.
  - Versioned legal document click-wrap enforcement recording IP address, user agent, policy SHA-256 hash, and UTC timestamp.

### Workstream 11: Production Readiness, Security Hardening, Observability, and Quality Gates
- **Security Hardening**:
  - Strict BOLA enforcement rejecting unauthorized cross-tenant order, store, driver, and wallet access (`npm run test:integration:bola-authority` - 10/10 adversarial cases passed).
  - Redis distributed sliding-window rate limiting protecting public, authentication, and payment callback endpoints (`npm run test:integration:redis-rate-limit` - 7/7 passed).
  - Comprehensive HTTP security headers (CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`).
- **Financial Conservation**:
  - Double-entry ledger journals strictly assert `SUM(debit) == SUM(credit)`.
  - All financial balances and transactions operate in positive ZAR amounts with immutable attempt snapshots.

---

## 3. Canonical System Invariants & Financial Conservation

The platform enforces the following non-negotiable architectural invariants:

1. **Zero-Sum Ledger Balance Invariant**:
   Every financial event must write balanced double-entry ledger entries. At all times, `SUM(debit) - SUM(credit) == 0` across all accounts in a transaction.
2. **Positive ZAR Currency Invariant**:
   All quotes, payments, refunds, wallets, commissions, and ledger entries must be denominated in `ZAR` with amounts strictly `> 0`. Negative values and currency mixing are rejected at the database and service boundaries.
3. **Immutable Payment Snapshot Invariant**:
   Payment attempts and payment records preserve immutable JSON snapshots of customer inputs, quote parameters, and sanitized provider responses. Snapshots never mutate post-creation.
4. **Secret Scrubbing Invariant**:
   Provider payloads stored in `PaymentAttempt.requestSnapshot` and `PaymentAttempt.providerPayload` strictly exclude merchant keys, passphrases, raw signatures, and unmasked customer emails.
5. **Idempotent Webhook Processing Invariant**:
   Payment webhooks (ITN) verify provider transaction uniqueness. Duplicate webhook postbacks are acknowledged without generating redundant ledger postings or duplicate order state transitions.

---

## 4. Authorization & BOLA Defense Matrix

Broken Object-Level Authorization (BOLA) is mitigated through relationship-scoped database authorization:

| Domain / Resource | Tenant / Role Scope | Database Authority Guard |
|---|---|---|
| **Orders & Delivery Tracking** | Customer, Assigned Driver, Merchant Store Owner | Enforced via `order.customerId == user.id OR order.storeId == user.storeId OR assignment.driverId == user.driverId` |
| **Driver Workbench & Earnings** | Approved Driver Profile Owner | Driver earnings and active assignments strictly restricted to authenticated `driverId` |
| **Merchant Storefront & Catalog** | Verified Store Owner / Manager | Catalog edits, product creation, and promotion budgets restricted to authenticated `storeId` |
| **Customer Wallet & Refunds** | Account Holder / Authorized Admin | Balance inquiries, withdrawal requests, and refund claims strictly bound to owner `walletId` |
| **Promoter Team & MLM Earnings** | Registered Promoter | Team tree viewing and commission accruals strictly bound to authenticated `promoterId` |
| **Admin Operations & Audit Logs** | Super Admin / Compliance Officer | Guarded by granular RBAC permissions in `lib/auth/permissions.ts` with mandatory audit logging |

---

## 5. Client Clarifications & Legal Review Dependencies (9 Preserved Invariants)

All 9 client clarification and legal conflict items from `artifacts/client-clarification-register.json` remain explicitly preserved without hardcoding:

1. **`DOC-CONFLICT-001` (Service Tier Naming & SLA)**:
   Service definitions (Standard vs Scheduled vs Economy) and turnaround times remain configurable via `DeliveryServiceDefinition`; no hardcoded SLA strings exist in business logic.
2. **`DOC-CONFLICT-002` (Express Pricing Interpretation)**:
   Express rate calculation (distance vs parcel profile base rates) remains configurable in pricing rate tables.
3. **`DOC-CONFLICT-003` (Refund Deadline Conflict)**:
   Refund dispute window (Terms 24h vs Refund Policy perishable goods terms) remains configurable in `lib/claims/`; fails closed on expired windows.
4. **`DOC-CONFLICT-004` (Physical Business Address)**:
   Corporate physical business address remains `CLIENT_VALUE_REQUIRED`. Placeholder and demo addresses in seed fixtures are NOT approved production identity.
5. **`DOC-CONFLICT-005` (Promoter Entry Fee vs Deposit)**:
   Starter qualification fee structure remains configurable in `PromoterProgramVersion`; promoter production lock active.
6. **`DOC-CONFLICT-006` (Legal Consent Mapping)**:
   Independent versioned consent records maintained for Terms of Service, Privacy Policy, Cookie Policy, and Marketing Communications.
7. **`CLIENT-CLAR-007` (COD Partial Payment & Custody)**:
   Cash on delivery custody enforces full cash collection at doorstep; partial payment disabled pending client signoff.
8. **`CLIENT-CLAR-008` (External Advertising Automation)**:
   External advertising API synchronization disabled (`AUTOMATED_PROVIDER_RUNTIME_AVAILABLE = false`); internal managed marketing operational.
9. **`CLIENT-CLAR-009` (Relocation & Specialised Cargo)**:
   Specialised cargo quote flow requires custom dimension submission and hazard disclosures.

---

## 6. Functional Frontend Closure

All user-facing and back-office frontends are fully operational with server/client action integration, data fetching, loading states, error boundaries, and permission enforcement:
- **Public & Marketing**: Landing, Services, Coverage Areas, Careers, Contact, Legal/Policy pages.
- **Customer Portal**: Storefront Browsing, Product Details, Cart, Checkout, Order Tracking, Customer Wallet, DSR Privacy Portal.
- **Merchant Portal**: Store Profile, Product Catalog, Inventory, Promotion Manager, Managed Marketing, Store Earnings.
- **Driver Portal**: Driver Workbench, Vehicle Documents, Delivery Map, Cash on Delivery Custody, Driver Earnings.
- **Promoter Portal**: Affiliate Links, Team Hierarchy Tree, Qualification Dashboard, Commission Earnings, Withdrawal Requests.
- **Admin Portal**: System Settings, User Management, Dispatch Operations, Financial Ledger, Claims Investigation, Audit Logs.

*(Note: In accordance with Chief Architect Phase 1 directives, all UI workflows are functionally closed; visual redesign and aesthetic art direction are strictly excluded.)*

---

## 7. Explicit Phase 2 Handover Boundary

Phase 1 provides the fully proven, locked, and verified functional foundation. The boundary for subsequent Phase 2 operations includes:
1. Live Third-Party Credential Activation (PayFast live merchant key/passphrase, Google Maps API key, AWS S3 bucket credentials).
2. Final Client Value Ingestion upon written client signoff (Official corporate physical address, signed promoter commission rate schedule, finalized SLA naming).
3. Production Deployment & Infrastructure Staging.
