# KT Couriers Phase R12 — Protected Route Inventory & Capability Matrix

> **Audit Context**: Complete Inventory of All Protected Application Routes  
> **Total Inventoried Protected Routes**: 118 Routes  
> **Classification Key**: `CONCRETE` (Functional & Connected), `PARTIAL` (Gaps Present), `SCAFFOLD` (Types/Route Only), `LOCKED` (Behind Production Lock), `ABSENT` (Missing), `DEPRECATED` (Superseded), `BROKEN` (Source Defect), `UNKNOWN`.

---

## 1. Summary Route Statistics by Domain

| Domain / Route Group | Total Routes | Concrete | Partial | Scaffold | Locked | Absent | Broken |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Customer Account** (`app/(account)/account/*`) | 24 | 14 | 8 | 2 | 0 | 0 | 0 |
| **Store Operations** (`app/(store)/store/*`) | 23 | 11 | 7 | 1 | 4 | 0 | 0 |
| **Driver Application** (`app/(driver)/driver/*`) | 9 | 5 | 3 | 1 | 0 | 0 | 0 |
| **Promoter Portal** (`app/(account)/promoter/*`) | 14 | 8 | 5 | 1 | 0 | 0 | 0 |
| **Developer Portal** (`app/(account)/developers/*`) | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| **Applicant Experience** (`app/(public)/applicant/*` & `(account)`) | 14 | 9 | 4 | 1 | 0 | 0 | 0 |
| **Administrator Command Centre** (`app/(admin)/admin/*`) | 29 | 18 | 9 | 2 | 0 | 0 | 0 |
| **Payments & Checkout** (`app/(payments)/*`) | 4 | 2 | 1 | 0 | 1 | 0 | 0 |
| **Total Protected Application** | **118** | **67** | **38** | **8** | **5** | **0** | **0** |

---

## 2. Customer Account Routes (`app/(account)/account/*`)

| Path | Layout | Required Role / Permission | Data Authority / DTO | State | Key UI Elements | Mobile Priority | Planned Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/account` | `AccountLayout` | `CUSTOMER` | `CustomerAccountOverviewDTO` | `CONCRETE` | KPI Tiles, Recent Orders, Quick Request | High | R14 |
| `/account/orders` | `AccountLayout` | `CUSTOMER` | `CustomerOrderListDTO` | `CONCRETE` | Data Table, Filter Drawer, Pagination | Medium | R14 |
| `/account/orders/[id]` | `AccountLayout` | `CUSTOMER` | `CustomerOrderDetailDTO` | `CONCRETE` | Status Timeline, Map Frame, Summary | High | R14 |
| `/account/orders/[id]/exception` | `AccountLayout` | `CUSTOMER` | `OrderExceptionDTO` | `PARTIAL` | Form, Action Panel, Support Handoff | High | R14 |
| `/account/request-delivery` | `AccountLayout` | `CUSTOMER` | `QuoteCalculationDTO` | `CONCRETE` | Multi-step Form, Map Address Picker | High | R14 |
| `/account/request-delivery/freight` | `AccountLayout` | `CUSTOMER` | `FreightQuoteDTO` | `PARTIAL` | Heavy Cargo Form, Specifications | Low | R14 |
| `/account/request-delivery/moving` | `AccountLayout` | `CUSTOMER` | `MovingQuoteDTO` | `PARTIAL` | Inventory Checklist Form | Low | R14 |
| `/account/request-delivery/shuttle` | `AccountLayout` | `CUSTOMER` | `ShuttleQuoteDTO` | `PARTIAL` | Passenger & Parcel Scheduling Form | Low | R14 |
| `/account/wallet` | `AccountLayout` | `CUSTOMER` | `CustomerWalletDTO` | `CONCRETE` | Balance Summary, Transaction Table | High | R14 |
| `/account/wallet/transactions` | `AccountLayout` | `CUSTOMER` | `WalletTransactionListDTO` | `CONCRETE` | Paginated Ledger Table | Medium | R14 |
| `/account/wallet/payment-methods` | `AccountLayout` | `CUSTOMER` | `PaymentMethodDTO` | `PARTIAL` | Card List, Tokenization Form | High | R14 |
| `/account/refunds` | `AccountLayout` | `CUSTOMER` | `CustomerRefundListDTO` | `CONCRETE` | Status List, Refund Request Form | Medium | R14 |
| `/account/refunds/[publicReference]`| `AccountLayout` | `CUSTOMER` | `CustomerRefundDetailDTO` | `CONCRETE` | Audit Timeline, Reconciliation State | Medium | R14 |
| `/account/withdrawals` | `AccountLayout` | `CUSTOMER` | `CustomerWithdrawalListDTO` | `CONCRETE` | Request Form, Payout Status Table | Medium | R14 |
| `/account/withdrawals/[publicReference]`| `AccountLayout` | `CUSTOMER` | `CustomerWithdrawalDetailDTO`| `CONCRETE` | Bank Evidence Summary, State Badge | Medium | R14 |
| `/account/addresses` | `AccountLayout` | `CUSTOMER` | `SavedAddressListDTO` | `CONCRETE` | Address Cards, Geocoding Form | High | R14 |
| `/account/recipients` | `AccountLayout` | `CUSTOMER` | `RecipientBookDTO` | `PARTIAL` | Contact Cards, Quick Select | Medium | R14 |
| `/account/membership` | `AccountLayout` | `CUSTOMER` | `CustomerSubscriptionDTO` | `PARTIAL` | Plan Tier Card, Entitlements | High | R14 |
| `/account/membership/benefits` | `AccountLayout` | `CUSTOMER` | `SubscriptionBenefitDTO` | `PARTIAL` | Benefit Usage Cards | Low | R14 |
| `/account/membership/invoices` | `AccountLayout` | `CUSTOMER` | `SubscriptionInvoiceDTO` | `PARTIAL` | Billing Table, Download Action | Low | R14 |
| `/account/promotions` | `AccountLayout` | `CUSTOMER` | `CustomerPromotionDTO` | `PARTIAL` | Active Promos, Redeem Input | Medium | R14 |
| `/account/notifications` | `AccountLayout` | `CUSTOMER` | `NotificationCenterDTO` | `CONCRETE` | Notification Feed, Preference Form | High | R14 |
| `/account/profile` | `AccountLayout` | `CUSTOMER` | `UserProfileDTO` | `CONCRETE` | Personal Info Form, Avatar Picker | High | R14 |
| `/account/security` | `AccountLayout` | `CUSTOMER` | `SecuritySettingsDTO` | `CONCRETE` | Password Change, Active Sessions | High | R14 |
| `/account/support` | `AccountLayout` | `CUSTOMER` | `SupportTicketDTO` | `CONCRETE` | Ticket Form, FAQ Quick Links | Medium | R14 |

---

## 3. Store Operations Routes (`app/(store)/store/*`)

| Path | Layout | Required Role / Permission | Data Authority / DTO | State | Key UI Elements | Mobile Priority | Planned Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/store` | `StoreLayout` | `STORE` | `StoreDashboardOverviewDTO` | `CONCRETE` | Orders Queue, Earning Cards, State | High | R15 |
| `/store/orders` | `StoreLayout` | `STORE` | `StoreOrderListDTO` | `CONCRETE` | Fulfillment Table, Status Tabs | High | R15 |
| `/store/orders/[id]` | `StoreLayout` | `STORE` | `StoreOrderDetailDTO` | `CONCRETE` | Item Checklist, Prep Timeline | High | R15 |
| `/store/marketplace-orders/[reference]`| `StoreLayout` | `STORE` | `MarketplaceOrderDTO` | `PARTIAL` | Handoff Scanner, Substitution Form| High | R15 |
| `/store/new-delivery` | `StoreLayout` | `STORE` | `StoreDeliveryRequestDTO` | `CONCRETE` | Courier Dispatch Form, Map Picker | High | R15 |
| `/store/catalog` | `StoreLayout` | `STORE` | `StoreCatalogOverviewDTO` | `CONCRETE` | Product Grid, Category Tree | Medium | R15 |
| `/store/catalog/products` | `StoreLayout` | `STORE` | `CatalogProductListDTO` | `CONCRETE` | Data Table, Bulk Price Edit | Medium | R15 |
| `/store/catalog/products/new` | `StoreLayout` | `STORE` | `CatalogProductFormDTO` | `CONCRETE` | Multi-step Product Creator | Medium | R15 |
| `/store/catalog/products/[publicReference]`| `StoreLayout` | `STORE` | `CatalogProductDetailDTO` | `CONCRETE` | Variant Form, Image Uploader | Medium | R15 |
| `/store/catalog/inventory` | `StoreLayout` | `STORE` | `InventoryLevelListDTO` | `CONCRETE` | Stock Level Table, Low Stock Alert | High | R15 |
| `/store/catalog/media` | `StoreLayout` | `STORE` | `CatalogMediaListDTO` | `LOCKED` | Media Gallery, Production Lock | Low | R15 |
| `/store/catalog/modifiers` | `StoreLayout` | `STORE` | `CatalogModifierListDTO` | `PARTIAL` | Option Group Manager | Low | R15 |
| `/store/catalog/imports` | `StoreLayout` | `STORE` | `CatalogImportListDTO` | `PARTIAL` | CSV Upload Form, Mapping Matrix | Low | R15 |
| `/store/catalog/offers` | `StoreLayout` | `STORE` | `CatalogOfferListDTO` | `PARTIAL` | Special Pricing Table | Medium | R15 |
| `/store/catalog/offers/[publicReference]`| `StoreLayout` | `STORE` | `CatalogOfferDetailDTO` | `PARTIAL` | Discount Scheduler | Medium | R15 |
| `/store/earnings` | `StoreLayout` | `STORE` | `StoreEarningSummaryDTO` | `CONCRETE` | Payout Ledger Table, Revenue Chart | High | R15 |
| `/store/earnings/[publicReference]`| `StoreLayout` | `STORE` | `StoreEarningDetailDTO` | `CONCRETE` | Fee Breakdown, Transfer Status | Medium | R15 |
| `/store/subscription` | `StoreLayout` | `STORE` | `StoreSubscriptionDTO` | `LOCKED` | Tier Comparison, Production Lock | Medium | R15 |
| `/store/subscription/plans` | `StoreLayout` | `STORE` | `SubscriptionPlanListDTO` | `LOCKED` | Plan Cards, Upgrade Action | Medium | R15 |
| `/store/subscription/billing` | `StoreLayout` | `STORE` | `SubscriptionBillingDTO` | `LOCKED` | Payment Authority, Invoices | Medium | R15 |
| `/store/subscription/benefits` | `StoreLayout` | `STORE` | `SubscriptionBenefitDTO` | `PARTIAL` | Feature Entitlements List | Low | R15 |
| `/store/promotions` | `StoreLayout` | `STORE` | `StorePromotionListDTO` | `PARTIAL` | Campaign Table, Budget Status | Medium | R15 |
| `/store/promotions/new` | `StoreLayout` | `STORE` | `PromotionFormDTO` | `PARTIAL` | Campaign Wizard Form | Medium | R15 |
| `/store/promotions/[reference]`| `StoreLayout` | `STORE` | `PromotionDetailDTO` | `PARTIAL` | Performance Metrics, Pause Trigger| Medium | R15 |
| `/store/promotions/[reference]/budget`| `StoreLayout` | `STORE` | `PromotionBudgetDTO` | `PARTIAL` | Spend Chart, Cap Adjustment Form | Low | R15 |
| `/store/promotions/[reference]/redemptions`| `StoreLayout` | `STORE` | `PromotionRedemptionDTO` | `PARTIAL` | Usage Table, Customer Codes | Low | R15 |
| `/store/advertising` | `StoreLayout` | `STORE` | `StoreAdvertisingDTO` | `PARTIAL` | Placement Bids, Impression Chart | Medium | R15 |
| `/store/profile` | `StoreLayout` | `STORE` | `StoreProfileDTO` | `CONCRETE` | Operating Hours Form, Pickup Address| High | R15 |
| `/store/notifications` | `StoreLayout` | `STORE` | `NotificationCenterDTO` | `CONCRETE` | Alert Feed, Sound Preferences | High | R15 |
| `/store/support` | `StoreLayout` | `STORE` | `SupportTicketDTO` | `CONCRETE` | Merchant Desk, Ticket Form | Medium | R15 |

---

## 4. Driver Operations Routes (`app/(driver)/driver/*`)

| Path | Layout | Required Role / Permission | Data Authority / DTO | State | Key UI Elements | Mobile Priority | Planned Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/driver` | `DriverLayout` | `DRIVER` | `DriverDashboardDTO` | `CONCRETE` | Active Delivery Card, Status Switch | Mobile-First | R16 |
| `/driver/workbench` | `DriverLayout` | `DRIVER` | `DriverWorkbenchDTO` | `PARTIAL` | Quick Action Console, Map View | Mobile-First | R16 |
| `/driver/assignments` | `DriverLayout` | `DRIVER` | `DriverAssignmentListDTO` | `CONCRETE` | Offer Accept/Reject Cards | Mobile-First | R16 |
| `/driver/assignments/[id]` | `DriverLayout` | `DRIVER` | `DriverAssignmentDetailDTO` | `CONCRETE` | Turn-by-turn Map, Customer Call | Mobile-First | R16 |
| `/driver/delivery` | `DriverLayout` | `DRIVER` | `ActiveDeliveryExecutionDTO`| `CONCRETE` | OTP Verification, Pod Camera Upload | Mobile-First | R16 |
| `/driver/availability` | `DriverLayout` | `DRIVER` | `DriverAvailabilityDTO` | `CONCRETE` | Shift Schedule, Region Toggles | Mobile-First | R16 |
| `/driver/earnings` | `DriverLayout` | `DRIVER` | `DriverEarningsDTO` | `CONCRETE` | Daily Payout Strip, Trip List | Mobile-First | R16 |
| `/driver/earnings/[publicReference]`| `DriverLayout` | `DRIVER` | `DriverEarningDetailDTO` | `CONCRETE` | Tip & Distance Fee Breakdown | Mobile-First | R16 |
| `/driver/notifications` | `DriverLayout` | `DRIVER` | `DriverNotificationDTO` | `CONCRETE` | Dispatch Alert Feed | Mobile-First | R16 |
| `/driver/profile` | `DriverLayout` | `DRIVER` | `DriverProfileDTO` | `CONCRETE` | Vehicle Docs, License Expiry | Mobile-First | R16 |

---

## 5. Promoter Portal Routes (`app/(account)/promoter/*`)

| Path | Layout | Required Role / Permission | Data Authority / DTO | State | Key UI Elements | Mobile Priority | Planned Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/promoter` | `AccountLayout` | `PROMOTER` | `PromoterDashboardDTO` | `CONCRETE` | Referral Stats, Code Generator | High | R17 |
| `/promoter/links` | `AccountLayout` | `PROMOTER` | `PromoterLinkListDTO` | `CONCRETE` | Dynamic Tracking Link Builder | High | R17 |
| `/promoter/referrals` | `AccountLayout` | `PROMOTER` | `PromoterReferralListDTO` | `CONCRETE` | Conversion Table, Status Badges | Medium | R17 |
| `/promoter/referrals/[reference]`| `AccountLayout` | `PROMOTER` | `PromoterReferralDetailDTO` | `CONCRETE` | Attribution Timeline, Holding Period| Medium | R17 |
| `/promoter/earnings` | `AccountLayout` | `PROMOTER` | `PromoterEarningListDTO` | `CONCRETE` | Commission Payout Table | High | R17 |
| `/promoter/earnings/[reference]`| `AccountLayout` | `PROMOTER` | `PromoterEarningDetailDTO` | `CONCRETE` | Attributed Revenue Breakdown | Medium | R17 |
| `/promoter/wallet` | `AccountLayout` | `PROMOTER` | `PromoterWalletDTO` | `CONCRETE` | Available vs Held Balance Card | High | R17 |
| `/promoter/withdrawals` | `AccountLayout` | `PROMOTER` | `PromoterWithdrawalListDTO` | `CONCRETE` | Payout Request Form, History | High | R17 |
| `/promoter/performance` | `AccountLayout` | `PROMOTER` | `PromoterAnalyticsDTO` | `PARTIAL` | Conversion Funnel Chart | Medium | R17 |
| `/promoter/assets` | `AccountLayout` | `PROMOTER` | `PromoterAssetListDTO` | `PARTIAL` | Banner Download Cards | Low | R17 |
| `/promoter/programs` | `AccountLayout` | `PROMOTER` | `PromoterProgramListDTO` | `PARTIAL` | Tier Eligibility Cards | Low | R17 |
| `/promoter/programs/[reference]`| `AccountLayout` | `PROMOTER` | `PromoterProgramDetailDTO` | `PARTIAL` | Tier Terms & Rates | Low | R17 |
| `/promoter/disputes` | `AccountLayout` | `PROMOTER` | `PromoterDisputeListDTO` | `PARTIAL` | Attribution Dispute Form | Medium | R17 |
| `/promoter/disputes/[reference]`| `AccountLayout` | `PROMOTER` | `PromoterDisputeDetailDTO` | `PARTIAL` | Case Resolution Chat | Medium | R17 |
| `/promoter/compliance` | `AccountLayout` | `PROMOTER` | `PromoterComplianceDTO` | `PARTIAL` | Agreement Acceptance Form | High | R17 |
| `/promoter/profile` | `AccountLayout` | `PROMOTER` | `PromoterProfileDTO` | `CONCRETE` | Tax & Payout Destination Form | High | R17 |
| `/promoter/support` | `AccountLayout` | `PROMOTER` | `SupportTicketDTO` | `CONCRETE` | Promoter Helpdesk Form | Low | R17 |
| `/promoter/notifications` | `AccountLayout` | `PROMOTER` | `NotificationCenterDTO` | `CONCRETE` | Commission Alert Feed | High | R17 |

---

## 6. Developer Portal Routes (`app/(account)/developers/*`)

| Path | Layout | Required Role / Permission | Data Authority / DTO | State | Key UI Elements | Mobile Priority | Planned Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/developers/[[...segments]]`| `AccountLayout` | `CUSTOMER` / `STORE` | `DeveloperPortalDTO` | `PARTIAL` | Catch-all Developer Console (API Keys, Webhooks, Documentation) | Low (Desktop First) | R18 |

---

## 7. Recruitment Applicant Routes (`app/(public)/applicant/*` & `app/(account)/applicant/*`)

| Path | Layout | Required Role / Permission | Data Authority / DTO | State | Key UI Elements | Mobile Priority | Planned Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/applicant` | `ApplicantLayout`| Public Candidate | `ApplicantDashboardDTO` | `CONCRETE` | Application Status Tracker | Mobile-First | R19 |
| `/applicant/applications` | `ApplicantLayout`| Public Candidate | `ApplicantApplicationListDTO`| `CONCRETE` | Submitted Applications List | Mobile-First | R19 |
| `/applicant/applications/new/[openingReference]`| `ApplicantLayout`| Public Candidate | `JobOpeningFormDTO` | `CONCRETE` | Multi-step Application Wizard | Mobile-First | R19 |
| `/applicant/applications/[reference]`| `ApplicantLayout`| Public Candidate | `ApplicationDetailDTO` | `CONCRETE` | Timeline & Document Checklist | Mobile-First | R19 |
| `/applicant/applications/[reference]/personal-details`| `ApplicantLayout`| Public Candidate | `PersonalDetailsFormDTO` | `CONCRETE` | Identification Form | Mobile-First | R19 |
| `/applicant/applications/[reference]/questions`| `ApplicantLayout`| Public Candidate | `RoleQuestionsFormDTO` | `CONCRETE` | Screening Questions Form | Mobile-First | R19 |
| `/applicant/applications/[reference]/documents`| `ApplicantLayout`| Public Candidate | `ApplicantDocumentDTO` | `CONCRETE` | Document Uploader | Mobile-First | R19 |
| `/applicant/applications/[reference]/checks`| `ApplicantLayout`| Public Candidate | `BackgroundCheckConsentDTO` | `CONCRETE` | Consent Sign-off Form | Mobile-First | R19 |
| `/applicant/applications/[reference]/interviews`| `ApplicantLayout`| Public Candidate | `InterviewScheduleDTO` | `CONCRETE` | Slot Selector & Meeting Link | Mobile-First | R19 |
| `/applicant/applications/[reference]/review`| `ApplicantLayout`| Public Candidate | `ApplicationReviewDTO` | `CONCRETE` | Final Application Summary | Mobile-First | R19 |
| `/applicant/applications/[reference]/confirmation`| `ApplicantLayout`| Public Candidate | `SubmissionConfirmationDTO`| `CONCRETE` | Reference Number & Next Steps | Mobile-First | R19 |
| `/applicant/applications/[reference]/offer`| `ApplicantLayout`| Public Candidate | `EmploymentOfferDTO` | `CONCRETE` | Digital Offer Acceptance Form | Mobile-First | R19 |
| `/applicant/profile` | `ApplicantLayout`| Public Candidate | `ApplicantProfileDTO` | `CONCRETE` | Resume & Contact Info | Mobile-First | R19 |
| `/applicant/privacy` | `ApplicantLayout`| Public Candidate | `PrivacyRequestDTO` | `PARTIAL` | POPIA Data Request Form | Mobile-First | R19 |
| `/applicant/data-requests` | `ApplicantLayout`| Public Candidate | `DataRequestListDTO` | `PARTIAL` | Data Subject Request Tracker | Mobile-First | R19 |
| `/account/applicant/notifications`| `AccountLayout` | Candidate Session | `NotificationCenterDTO` | `CONCRETE` | Candidate Notification Feed | Mobile-First | R19 |

---

## 8. Administrator Command Centre Routes (`app/(admin)/admin/*`)

| Path | Layout | Required Role / Permission | Data Authority / DTO | State | Key UI Elements | Mobile Priority | Planned Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/admin` | `AdminLayout` | `ADMIN_DASHBOARD_READ` | `AdminDashboardOverviewDTO` | `CONCRETE` | Operational Triage Queue, Alert Tiles | Medium | R20 |
| `/admin/orders` | `AdminLayout` | `ORDERS_READ` | `AdminOrderListDTO` | `CONCRETE` | Master Orders Data Table, Filters | Medium | R20 |
| `/admin/orders/[id]` | `AdminLayout` | `ORDERS_READ` | `AdminOrderDetailDTO` | `CONCRETE` | Full Order Timeline, Reassign Control | Medium | R20 |
| `/admin/dispatch` | `AdminLayout` | `DISPATCH_READ` | `AdminDispatchBoardDTO` | `CONCRETE` | Live Dispatch Matrix, Driver Map | High | R20 |
| `/admin/pickup-exceptions` | `AdminLayout` | `DISPATCH_READ` | `PickupExceptionListDTO` | `CONCRETE` | Failed Pickup Resolution Queue | High | R20 |
| `/admin/customers` | `AdminLayout` | `CUSTOMERS_READ` | `AdminCustomerListDTO` | `CONCRETE` | Customer Account Table, Suspend | Medium | R20 |
| `/admin/stores` | `AdminLayout` | `STORES_READ` | `AdminStoreListDTO` | `CONCRETE` | Merchant Directory, Approval Action| Medium | R20 |
| `/admin/drivers` | `AdminLayout` | `DRIVERS_READ` | `AdminDriverListDTO` | `CONCRETE` | Driver Verification Table, Region Map| Medium | R20 |
| `/admin/drivers/[id]` | `AdminLayout` | `DRIVERS_READ` | `AdminDriverDetailDTO` | `CONCRETE` | License Verification, Trip Log | Medium | R20 |
| `/admin/driver-earnings` | `AdminLayout` | `DRIVER_EARNINGS_READ` | `AdminDriverEarningListDTO` | `CONCRETE` | Payout Audit Table, Manual Hold | Low | R20 |
| `/admin/regions` | `AdminLayout` | `REGIONS_READ` | `DeliveryRegionListDTO` | `CONCRETE` | GeoJSON Polygon Map Editor | Low | R20 |
| `/admin/pricing` | `AdminLayout` | `PRICING_READ` | `PricingRuleListDTO` | `CONCRETE` | Tariff Table, Base Fee Config | Low | R20 |
| `/admin/employees` | `AdminLayout` | `EMPLOYEES_READ` | `AdminEmployeeListDTO` | `CONCRETE` | Staff List, Role Assignment | Low | R21 |
| `/admin/permissions` | `AdminLayout` | `EMPLOYEES_PERMISSIONS_MANAGE` | `PermissionMatrixDTO` | `CONCRETE` | Granular Permission Grid | Low | R21 |
| `/admin/finance` | `AdminLayout` | `FINANCE_DASHBOARD_READ` | `FinanceDashboardOverviewDTO`| `CONCRETE` | Financial Liability KPI Board | Low | R21 |
| `/admin/ledger` | `AdminLayout` | `LEDGER_READ` | `LedgerJournalListDTO` | `CONCRETE` | Double-entry Journal Table | Low | R21 |
| `/admin/ledger/accounts/[id]` | `AdminLayout` | `LEDGER_READ` | `LedgerAccountDetailDTO` | `CONCRETE` | Ledger Account Statement | Low | R21 |
| `/admin/ledger/journals/[id]` | `AdminLayout` | `LEDGER_READ` | `LedgerJournalDetailDTO` | `CONCRETE` | Balanced Entry Breakdown | Low | R21 |
| `/admin/payments` | `AdminLayout` | `PAYMENTS_READ` | `AdminPaymentListDTO` | `CONCRETE` | Gateway Transaction Table | Low | R21 |
| `/admin/payments/[id]` | `AdminLayout` | `PAYMENTS_READ` | `AdminPaymentDetailDTO` | `CONCRETE` | ITN Audit Log, Raw Response | Low | R21 |
| `/admin/payment-providers` | `AdminLayout` | `PAYMENT_PROVIDERS_READ` | `PaymentProviderStatusDTO` | `CONCRETE` | Provider Readiness Health Matrix | Low | R21 |
| `/admin/payment-webhooks` | `AdminLayout` | `PAYMENT_WEBHOOKS_READ` | `PaymentWebhookLogListDTO` | `CONCRETE` | Webhook Signature Verification Log| Low | R21 |
| `/admin/payment-webhooks/[id]` | `AdminLayout` | `PAYMENT_WEBHOOKS_READ` | `PaymentWebhookLogDetailDTO`| `CONCRETE` | Payload Inspector & Retry Action | Low | R21 |
| `/admin/payment-reconciliation` | `AdminLayout` | `PAYMENT_RECONCILIATION_READ`| `PaymentReconciliationListDTO`| `CONCRETE` | Discrepancy Queue, Resolution Tool| Low | R21 |
| `/admin/payment-reconciliation/[id]`| `AdminLayout` | `PAYMENT_RECONCILIATION_READ`| `PaymentReconciliationDetailDTO`| `CONCRETE` | Mismatch Audit & Balance Fix | Low | R21 |
| `/admin/withdrawals` | `AdminLayout` | `WITHDRAWALS_READ` | `AdminWithdrawalListDTO` | `CONCRETE` | Payout Review Queue (Maker-Checker)| Low | R21 |
| `/admin/withdrawals/[id]` | `AdminLayout` | `WITHDRAWALS_READ` | `AdminWithdrawalDetailDTO` | `CONCRETE` | Bank Audit Evidence, Approve Action| Low | R21 |
| `/admin/withdrawal-reconciliation` | `AdminLayout` | `WITHDRAWALS_RECONCILE` | `WithdrawalReconciliationDTO` | `CONCRETE` | Bank Settlement Discrepancy Queue| Low | R21 |
| `/admin/payout-destinations` | `AdminLayout` | `PAYOUT_DESTINATIONS_READ` | `PayoutDestinationListDTO` | `CONCRETE` | Masked Account Verification Table| Low | R21 |
| `/admin/refunds` | `AdminLayout` | `REFUNDS_READ` | `AdminRefundListDTO` | `CONCRETE` | Refund Review Queue, Issue Action | Low | R21 |
| `/admin/refunds/[id]` | `AdminLayout` | `REFUNDS_READ` | `AdminRefundDetailDTO` | `CONCRETE` | Refund Reservation & Ledger Evidence| Low | R21 |
| `/admin/refund-reconciliation` | `AdminLayout` | `REFUNDS_RECONCILE` | `RefundReconciliationListDTO`| `CONCRETE` | Unsettled Gateway Refund Queue | Low | R21 |
| `/admin/store-earnings` | `AdminLayout` | `STORE_EARNINGS_READ` | `AdminStoreEarningListDTO` | `CONCRETE` | Merchant Settlement Ledger | Low | R21 |
| `/admin/store-earning-reconciliation`| `AdminLayout` | `STORE_EARNINGS_RECONCILE` | `StoreEarningReconciliationDTO`| `CONCRETE` | Commission Deduction Mismatch Log| Low | R21 |
| `/admin/catalog` | `AdminLayout` | `CATALOG_MODERATION_READ` | `AdminCatalogModerationDTO` | `CONCRETE` | Product Approval Queue | Low | R21 |
| `/admin/storefront/collections` | `AdminLayout` | `STOREFRONT_COLLECTIONS_READ`| `StorefrontCollectionListDTO`| `CONCRETE` | Homepage Collection Curator | Low | R21 |
| `/admin/storefront/projections` | `AdminLayout` | `STOREFRONT_PROJECTIONS_READ`| `StorefrontProjectionListDTO`| `CONCRETE` | Denormalized View Rebuilder | Low | R21 |
| `/admin/storefront/search-synonyms`| `AdminLayout` | `STOREFRONT_SEARCH_SYNONYMS_READ`| `SearchSynonymListDTO` | `CONCRETE` | Catalog Search Synonym Table | Low | R21 |
| `/admin/marketplace-checkout` | `AdminLayout` | `MARKETPLACE_CHECKOUT_READ`| `MarketplaceCheckoutStateDTO`| `CONCRETE` | Cart Quote Invariants Monitor | Low | R21 |
| `/admin/store-order-reconciliation`| `AdminLayout` | `STORE_ORDERS_RECONCILE` | `StoreOrderReconciliationDTO`| `CONCRETE` | Merchant Fulfillment Timeout Log | Low | R21 |
| `/admin/subscriptions/plans` | `AdminLayout` | `SUBSCRIPTION_PLANS_READ` | `SubscriptionPlanAdminListDTO`| `CONCRETE` | Plan Versioning Table | Low | R21 |
| `/admin/subscriptions/programs` | `AdminLayout` | `SUBSCRIPTION_PROGRAMS_READ`| `SubscriptionProgramAdminDTO`| `CONCRETE` | Commercial Entitlement Config | Low | R21 |
| `/admin/subscriptions/contracts` | `AdminLayout` | `SUBSCRIPTION_CONTRACTS_READ`| `SubscriptionContractListDTO` | `CONCRETE` | Active Merchant Contracts | Low | R21 |
| `/admin/subscriptions/reconciliation`| `AdminLayout` | `SUBSCRIPTION_CONTRACTS_RECONCILE`| `SubscriptionReconciliationDTO`| `CONCRETE` | Billing Cycle Discrepancy Queue | Low | R21 |
| `/admin/promotions` | `AdminLayout` | `PROMOTIONS_READ` | `AdminPromotionListDTO` | `PARTIAL` | Campaign Audit & Approval Queue | Low | R21 |
| `/admin/promotions/reconciliation` | `AdminLayout` | `PROMOTIONS_RECONCILIATION_READ`| `PromotionReconciliationDTO` | `PARTIAL` | Promo Code Over-redemption Queue | Low | R21 |
| `/admin/promoter-programs` | `AdminLayout` | `PROMOTER_PROGRAMS_READ` | `AdminPromoterProgramListDTO`| `CONCRETE` | Tier Rules & Commission Config | Low | R21 |
| `/admin/promoters` | `AdminLayout` | `PROMOTERS_READ` | `AdminPromoterListDTO` | `CONCRETE` | Affiliate Directory & Status Switch | Low | R21 |
| `/admin/promoter-attributions` | `AdminLayout` | `PROMOTER_ATTRIBUTIONS_READ`| `PromoterAttributionListDTO` | `CONCRETE` | Referral Conversion Audit Log | Low | R21 |
| `/admin/promoter-qualifications` | `AdminLayout` | `PROMOTER_QUALIFICATIONS_READ`| `PromoterQualificationDTO` | `CONCRETE` | Holding Period Release Queue | Low | R21 |
| `/admin/promoter-earnings` | `AdminLayout` | `PROMOTER_EARNINGS_READ` | `AdminPromoterEarningListDTO`| `CONCRETE` | Commission Ledger Table | Low | R21 |
| `/admin/promoter-fraud` | `AdminLayout` | `PROMOTER_FRAUD_READ` | `PromoterFraudCaseListDTO` | `CONCRETE` | IP / Cookie Collision Detection | Low | R21 |
| `/admin/promoter-reconciliation` | `AdminLayout` | `PROMOTER_RECONCILIATION_READ`| `PromoterReconciliationDTO` | `CONCRETE` | Unmatched Conversion Audit | Low | R21 |
| `/admin/promoter-disputes` | `AdminLayout` | `PROMOTER_DISPUTES_READ` | `PromoterDisputeCaseListDTO` | `CONCRETE` | Referral Dispute Resolution Desk | Low | R21 |
| `/admin/promoter-assets` | `AdminLayout` | `PROMOTER_ASSETS_MANAGE` | `PromoterAssetAdminListDTO` | `PARTIAL` | Marketing Asset Manager | Low | R21 |
| `/admin/promoter-agreements` | `AdminLayout` | `PROMOTER_AGREEMENTS_MANAGE`| `PromoterAgreementAdminDTO` | `PARTIAL` | Legal Terms Versioning | Low | R21 |
| `/admin/recruitment` | `AdminLayout` | `RECRUITMENT_READ` | `AdminRecruitmentOverviewDTO`| `CONCRETE` | Hiring Pipeline Dashboard | Low | R21 |
| `/admin/recruitment/requisitions` | `AdminLayout` | `RECRUITMENT_REQUISITIONS_MANAGE`| `RequisitionListDTO` | `CONCRETE` | Headcount Approval Table | Low | R21 |
| `/admin/recruitment/openings` | `AdminLayout` | `RECRUITMENT_OPENINGS_MANAGE`| `AdminOpeningListDTO` | `CONCRETE` | Published Job Openings Manager | Low | R21 |
| `/admin/recruitment/applications` | `AdminLayout` | `RECRUITMENT_APPLICATIONS_READ`| `AdminApplicationListDTO` | `CONCRETE` | Master Candidate Table | Low | R21 |
| `/admin/recruitment/interviews` | `AdminLayout` | `RECRUITMENT_INTERVIEWS_MANAGE`| `AdminInterviewScheduleDTO` | `CONCRETE` | Hiring Manager Calendar | Low | R21 |
| `/admin/recruitment/checks` | `AdminLayout` | `RECRUITMENT_CHECKS_READ` | `AdminBackgroundCheckListDTO`| `CONCRETE` | Criminal/Credit Verification Desk| Low | R21 |
| `/admin/recruitment/offers` | `AdminLayout` | `RECRUITMENT_OFFERS_MANAGE` | `AdminOfferListDTO` | `CONCRETE` | Offer Letter Approval Table | Low | R21 |
| `/admin/recruitment/handoffs` | `AdminLayout` | `RECRUITMENT_HANDOFFS_READ` | `RecruitmentHandoffListDTO` | `CONCRETE` | Employee/Driver Conversion Queue | Low | R21 |
| `/admin/recruitment/fraud` | `AdminLayout` | `RECRUITMENT_FRAUD_READ` | `RecruitmentFraudCaseListDTO`| `CONCRETE` | Identity Collision Queue | Low | R21 |
| `/admin/recruitment/reconciliation`| `AdminLayout` | `RECRUITMENT_RECONCILIATION_READ`| `RecruitmentReconciliationDTO`| `CONCRETE` | Candidate Invariant Audit | Low | R21 |
| `/admin/recruitment/privacy` | `AdminLayout` | `RECRUITMENT_PRIVACY_MANAGE`| `RecruitmentPrivacyAuditDTO` | `CONCRETE` | Data Subject Erasure Desk | Low | R21 |
| `/admin/recruitment/retention` | `AdminLayout` | `RECRUITMENT_RETENTION_MANAGE`| `RetentionPolicyDTO` | `CONCRETE` | Automated Document Purge Rule | Low | R21 |
| `/admin/recruitment/employment-equity`| `AdminLayout` | `RECRUITMENT_EMPLOYMENT_EQUITY_READ`| `EmploymentEquityReportDTO`| `CONCRETE` | Statutory EE Reporting | Low | R21 |
| `/admin/notifications` | `AdminLayout` | `NOTIFICATION_DELIVERY_READ`| `AdminNotificationOverviewDTO`| `CONCRETE` | System Notification Monitor | Low | R21 |
| `/admin/notifications/categories` | `AdminLayout` | `NOTIFICATION_CATEGORY_READ`| `NotificationCategoryListDTO`| `CONCRETE` | Message Template Taxonomy | Low | R21 |
| `/admin/notifications/templates` | `AdminLayout` | `NOTIFICATION_TEMPLATE_READ`| `NotificationTemplateListDTO`| `CONCRETE` | Resend HTML Template Editor | Low | R21 |
| `/admin/notifications/routes` | `AdminLayout` | `NOTIFICATION_ROUTE_READ` | `NotificationRouteListDTO` | `CONCRETE` | SMS/Email Channel Router | Low | R21 |
| `/admin/notifications/deliveries` | `AdminLayout` | `NOTIFICATION_DELIVERY_READ`| `NotificationDeliveryListDTO`| `CONCRETE` | Outbound Message Delivery Log | Low | R21 |
| `/admin/notifications/suppressions`| `AdminLayout` | `NOTIFICATION_SUPPRESSION_READ`| `NotificationSuppressionDTO` | `CONCRETE` | Bounce / Opt-out Blacklist | Low | R21 |
| `/admin/notifications/providers` | `AdminLayout` | `NOTIFICATION_PROVIDER_STATUS_READ`| `NotificationProviderDTO` | `CONCRETE` | Resend / Twilio Gateway Status | Low | R21 |
| `/admin/notifications/reconciliation`| `AdminLayout` | `NOTIFICATION_RECONCILIATION_READ`| `NotificationReconciliationDTO`| `CONCRETE` | Failed Delivery Retry Queue | Low | R21 |
| `/admin/emails` | `AdminLayout` | `EMAILS_READ` | `EmailLogListDTO` | `CONCRETE` | Transactional Mail Audit Log | Low | R21 |
| `/admin/settings` | `AdminLayout` | `SETTINGS_READ` | `PlatformSettingsDTO` | `CONCRETE` | Global System Parameters | Low | R21 |
| `/admin/activity` | `AdminLayout` | `ACTIVITY_READ` | `ActivityLogListDTO` | `CONCRETE` | Immutable Operator Audit Trail | Low | R21 |

---

## 9. Payments & Checkout Routes (`app/(payments)/*`)

| Path | Layout | Required Role / Permission | Data Authority / DTO | State | Key UI Elements | Mobile Priority | Planned Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/orders/[orderReference]/payment` | `PaymentLayout` | Customer Session | `OrderPaymentCheckoutDTO` | `CONCRETE` | Payfast Form / Wallet Selector | High | R14 |
| `/payments/payfast/checkout/[attemptReference]`| `PaymentLayout` | Customer Session | `PayfastCheckoutAttemptDTO`| `LOCKED` | Secure Redirect Form (Lock) | High | R14 |
| `/payments/payfast/return` | `PaymentLayout` | Customer Session | `PayfastReturnReturnDTO` | `CONCRETE` | Payment Success / Pending Card | High | R14 |
| `/payments/payfast/cancel` | `PaymentLayout` | Customer Session | `PayfastCancelReturnDTO` | `CONCRETE` | Payment Cancelled Card & Retry | High | R14 |
