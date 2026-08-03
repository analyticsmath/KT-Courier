# Phase 24: Advertising Research and Implementation Map

## Audit of Existing Systems

For each audited system surface, the table below maps the integration boundaries, security decisions, and compliance with the Phase 24 architecture.

| # | System Surface / Area | Exact Model or Service | Source Authority | Transaction Boundary | Idempotency | Locking | Privacy Classification | Phase 24 Integration Decision | Production-Lock Behavior |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Phase 9 Wallet & Ledger | `Wallet`, `LedgerAccount`, `LedgerJournal` | `lib/services/ledger-posting.service.ts` | `prisma.$transaction` (Serializable) | Unique constraints on `idempotencyKey` and `requestHash` | Sorted Account IDs locked via `SELECT FOR UPDATE` | Confidential Financial | Reused to debit store wallet earnings and creditプラットフォーム advertising funds held. | Strictly read-only validation when lock is active. Mutations fail closed. |
| 2 | Store Available-Balance | `LedgerAccount` (`purpose: STORE_EARNINGS_PAYABLE`) | `lib/services/store-earning-account.service.ts` | Contained in funding transaction | Checked via journal entry sequencing | Optimistic locking on account version | Confidential Financial | Queried during campaign funding. Balance must be >= allocation amount. | Fails closed on balance check or mutation attempt under lock. |
| 3 | Account Locking & Journals | `LedgerAccount`, `LedgerJournal`, `LedgerEntry` | `lib/services/ledger-posting.service.ts` | `postLedgerJournalWithinTransaction` | Check on `idempotencyKey` | `SELECT FOR UPDATE` in sorted ID order | Internal Financial | Reused for funding and click charges. | Mutations blocked; reads allowed. |
| 4 | Phase 10 Payment Subject | `Payment`, `PaymentSubject` | `lib/services/payment-subject.service.ts` | Read-only subject query | Session key checks | None | Internal Billing | Unused. Advertising relies on store-wallet ledger funds-held. | N/A |
| 5 | Phase 14 Commission | `CommissionPlan`, `CommissionAccrual` | `lib/services/commission-accrual.service.ts` | Order checkout / release transaction | Unique reference mapping | Table locks | Commercial | Unchanged. Advertising revenue is separate and does not pay commission. | N/A |
| 6 | Phase 16 Store Earnings | `StoreEarning` | `lib/services/store-earning-accrual.service.ts` | Checkout/order release transaction | Unique order line map | Account version lock | Confidential Financial | Queried to determine available balance for campaign funding. | Read-only access only. |
| 7 | Phase 18 Catalog / Media | `CatalogProduct`, `CatalogVariant`, `CatalogMediaAsset` | `lib/services/catalog-product.service.ts` | Read-only campaign validation | N/A | None | Public Product Data | Used to verify that advertised products are published and owned by the store. | Fails campaign version creation if catalog validation fails. |
| 8 | Phase 19 Projections | `StorefrontProductDocument`, `StorefrontStoreDocument` | `lib/services/storefront-projection.service.ts` | Triggered view compilation | Idempotent document sync | Document updates | Public Storefront | Creative snapshots pull directly from storefront projections. | Unchanged. |
| 9 | Phase 19 Search Ranking | Search Indexing Queries | `lib/storefront/search/storefront-search-adapter.ts` | Read-only query | N/A | None | Public Search | Contextual keyword targeting matches normalized query strings. | Unchanged. |
| 10 | Phase 19 Category & Collection | `StorefrontCategoryDocument`, `StorefrontCollection` | `lib/services/storefront-catalog.service.ts` | Read-only retrieval | N/A | None | Public Taxonomy | Placements are validated against target categories/collections. | Unchanged. |
| 11 | Phase 19 Store Discovery | `StorefrontStoreDocument` | `lib/services/storefront-catalog.service.ts` | Read-only discovery query | N/A | None | Public Directory | Active campaigns are displayed in `STORE_DISCOVERY_STORE` rail. | Unchanged. |
| 12 | Phase 20 Checkout Finalization | `Order` creation / completion | `lib/services/orders.service.ts` | Checkout serializable transaction | Idempotent request hash | Wallet/inventory locks | Customer Order Details | Checkout completion triggers conversion attribution matching. | Unchanged. |
| 13 | Phase 21 Order Line Evidence | `OrderItem` | `lib/services/orders.service.ts` | Read-only order query | N/A | None | Customer Order Lines | Specific item conversions are verified against campaign product IDs. | Unchanged. |
| 14 | Phase 22 Subscriptions | `SubscriptionContract` | `lib/services/subscriptions.ts` | Contract billing transaction | Contract billing run | Wallet locks | Store Contract | Check store subscription status if required. | Unchanged. |
| 15 | Phase 23 Promotions | `PromotionCampaign`, `PromotionCode` | `lib/services/promotions.service.ts` | Apply coupon at checkout | Redemption locking | Budget locks | Commercial | Separate system. Advertising does not interact with promotional coupons. | Unchanged. |
| 16 | Store Ownership & Permissions | `Store` mapping to `ownerUserId` | `ownerUserId` and User roles checking | Read-only access check | N/A | None | Identity Mapping | Used to prevent IDOR on advertising operations and campaign building. | Enforced. |
| 17 | Admin Approval Patterns | `User` admin profiles | Auth guards, admin roles check | Admin approval transition | State locks | Transition lock | Admin Audit Trail | Used for moderation approvals of placements, rate cards, campaigns. | Draft moderation is allowed; activation remains blocked under lock. |
| 18 | Event-Intents & Outbox | Durable outbox, event log | `lib/services/notification-events.service.ts` | Posted in same transaction as state mutation | Outbox processor | Event log locks | Operational events | Campaign transitions write intents like `AD_CAMPAIGN_ACTIVATED` to outbox. | No events written for blocked mutations. |
| 19 | Reconciliation Patterns | Reconciliation case generation | `lib/services/payment-reconciliation.service.ts` | Serializable case creation | Unique case key | Case status locking | Financial Discrepancies | New `AdvertisingReconciliationCase` tracks discrepancies like click-journal mismatch. | Reconciler scanner can run; manual resolution mutations are blocked. |
| 20 | Operation Receipts | Operation log | `lib/services/catalog-service-support` (pattern) | Logged inside transaction | Operation ID | None | System Audit | Used in campaign creation, editing, and funding to write idempotent receipts. | Enforced. |
| 21 | Rate-limiting Utilities | Cache/rate-limit check | `lib/security/rate-limit.ts` | Pre-route verification | N/A | None | System Metrics | Reused on all store/admin API endpoints and click redirect routes. | Always active. |
| 22 | Trusted-Media Delivery | Catalog media reference | `lib/services/catalog-media-delivery.service.ts` | Read-only query | N/A | None | Public Assets | Creative snapshots copy references only from verified Phase 18 media. | Enforced. |
| 23 | Public-Reference Conventions | Prefix + random alphanumeric | Standard code references | N/A | N/A | None | Public Identifier | Used for all new models (e.g., `AD-ACC-`, `AD-CMP-`, etc.) | Enforced. |
| 24 | Exact Decimal Utilities | `Prisma.Decimal` and money wrappers | `lib/ledger/money.ts` | Serializable math | N/A | None | Financial Logic | Used for CPC calculations, budget verification, and spent tracking. | Enforced. |
| 25 | Privacy & Consent Models | User preferences | Privacy policy guards | Read-only queries | N/A | None | Personal data | Contextual targeting only; no user profiling or behavioural tracking. | Enforced. |
| 26 | Reporting Aggregations | Aggregation tables | Aggregator worker | Read-write aggregations | Idempotent daily updates | Date locks | Aggregated Metrics | Raw ad events are aggregated into `AdvertisingDailyAggregate` daily. | Dry runs allowed. |
| 27 | Store & Admin UI Routes | Next.js routes | Next.js routes and layouts | N/A | N/A | None | UI Structure | Scaffold pages added under `/store/advertising/*` and `/admin/advertising/*`. | UI renders scaffold with production-lock notification. |
| 28 | Production Readiness Locks | Boolean configuration | Global config files | Guard check before mutation | N/A | None | System Config | We introduce `ADVERTISING_PRODUCTION_VALIDATION_APPROVED = false`. | Blocks all production campaign activation, serving, billing, reversals. |

## Proposed Schema Design

We will introduce the following models in `prisma/schema.prisma` mapping to the fundamental domain models:
- `AdvertisingAccount`
- `AdvertisingPlacementDefinition`
- `AdvertisingRateCardVersion`
- `AdvertisingCampaign`
- `AdvertisingCampaignVersion`
- `AdvertisingCreativeSnapshot`
- `AdvertisingFundingAllocation`
- `AdvertisingFundingMovement`
- `AdvertisingServeDecision`
- `AdvertisingMeasurementEvent`
- `AdvertisingClickCharge`
- `AdvertisingAttribution`
- `AdvertisingDailyAggregate`
- `AdvertisingReconciliationCase`

The details of their relationships, keys, and indexes are planned to fit seamlessly into the existing PostgreSQL schema without modifying any pre-existing models other than adding backward relations where necessary.
