# Functional coverage and limits

| Scenario family | Actual executable evidence | Remaining acceptance |
|---|---|---|
| C01–C09 customer/public/account/quote | Full Chromium; customer identity, anonymous quote, addresses, private verification; directed refund and customer order suites | Named customer journey review; actual coverage/tariff activation |
| V01–V09 vendor/catalog/employees/fulfillment | New signup, stock-location creation/replay, five-product test; vendor publication PostgreSQL; employee and store-order browser suites | Independent vendor demonstration; live provider/media review; commercial locks remain |
| D01–D05 driver/dispatch/POD/COD/chat | Driver registration concurrency; canonical driver browser; COD and handoff suites; private raster/GPS fixtures and persisted chat | Physical Android/iOS camera, GPS, bad signal, screen reader; signed COD and payout policy |
| A01–A02 administration | Dual publication permissions and maker/checker; immutable version checks, rollback; admin browser/API and strict BOLA | Independent operations acceptance and actual production queue review |
| N01 notification domains | Current-source recipient rebuild and transactional outbox/recovery suites; resend acceptance/outage privacy | Sender authentication, approved templates/channels and actual provider receipts |
| M01 media | Ten genuine product rasters through normalization and READY assets; private POD, avatar/store lifecycle selections | Approved Cloudinary/live lifecycle, retention/privacy review and physical captures |
| X01 responsive/accessibility | 320/390/768/1440 store captures; native labelled forms; ordered accessibility/keyboard suites | Named WCAG 2.2 AA, 200% zoom, assistive-technology and visual review |
| R01 recovery/replay | Fresh guarded PostgreSQL/Redis; two-worker/lease/payment/refund replay; synthetic dump/restore and historical upgrade | Approved encrypted production backup, observed restore duration and production RTO/RPO |

Discovery of 747 API source routes is an inventory, not 747 successful functional acceptances. Static route metadata must not replace executable authorization evidence. No invented percentage or unexecuted PASS is assigned. Full current-checkout hosted results must be read alongside the compact local receipts.

The directed workbook below identifies the actual acceptance selectors. Every final-checkout row is **CERTIFICATION_REQUIRED at this committed snapshot**. A selector's later PASS proves its named assertions, not every possible behavior of a route. Actor entitlement, before-state, API requests, canonical database snapshots, negative controls and replay commands are executable in each named suite and its guarded fixtures. See the linked case's attached acceptance JSON for actual synthetic references; no production identities are recorded here.

| ID | Actor and workflow | Executable selector / canonical authority | Main negative or external boundary |
|---|---|---|---|
| C01 | Anonymous public/navigation/legal | `production-closure.spec.ts`, `production-visual-review.spec.ts`; public route/identity checks | Missing legal/company inputs remain explicit |
| C02 | Anonymous quote and parcel/coverage | `anonymous-courier-quote.spec.ts`, `trusted-parcel-classification.spec.ts`; reviewed tariff/package snapshot | Unsupported/ambiguous/stale source refuses |
| C03 | Customer register/verify/recover/session | `customer-identity-lifecycle.spec.ts`, auth/outbox PostgreSQL; User/OTP/session | Unknown/disabled/replayed code does not authenticate |
| C04 | Customer checkout resume | `checkout-owner-resume.integration.test.ts`; canonical checkout ownership | Foreign owner, expired/stale source |
| C05 | Buyer product/category/store/search | `storefront-browsing.spec.ts`, `storefront-search.spec.ts`, `storefront-product-detail.spec.ts`; publication documents | Nonpublic/stale offer and media exposure |
| C06 | Buyer multiple cart lines | `vendor-five-product-media.spec.ts`, canonical marketplace suites; cart/version/reservation | Changed quantity/price, stock race, another account |
| C07 | Buyer offline checkout/payment | `marketplace-checkout-payment.spec.ts`; verified payment/source order | Replay/unknown outcome, tampered amounts; no real charge |
| C08 | Buyer order/refund/tracking | `store-order-customer.spec.ts`, `customer-wallet-refunds.spec.ts`, `driver-canonical-delivery.spec.ts`; immutable order/refund/POD | Foreign reference, double refund, delivered location scope |
| C09 | Customer profile/media/preferences | `profile-avatar-lifecycle.spec.ts`, `transactional-notifications.spec.ts`, addresses/privacy PostgreSQL | Foreign image/current-contact revocation and consent |
| V01 | New vendor onboarding | `vendor-five-product-media.spec.ts`, vendor signup concurrency PostgreSQL; pending Store/User | Account privacy and simultaneous normalized store names |
| V02 | Owner stock location setup | Inventory-location PostgreSQL/API plus new linked case; scoped location/receipt | Missing grant, foreign store, changed replay, lost response |
| V03 | Owner five listings/variants/modifier | New linked case and `store-product-catalog.spec.ts`; draft product/offer/price/stock | Foreign media/SKU conflict; confirmed draft retired |
| V04 | Owner submit / independent admin publish | New linked case and vendor-publication PostgreSQL; versioned snapshot/projections | Unreviewed, stale, self-review; atomic failure rollback |
| V05 | Owner gallery lifecycle | `catalog-inventory-upload.spec.ts`, new linked case; inspected READY media | MIME/privacy/foreign asset IDs; real provider review OPEN |
| V06 | Owner inventory/price changes | Catalog/marketplace/store-order PostgreSQL; reservation and purchased snapshots | Oversell/stale version/changed settled source |
| V07 | Owner limited/revoked employee | `business-employee-access.spec.ts`, permission bootstrap/BOLA PG | Explicit DENY, removal, other store, finance escalation |
| V08 | Merchant picking/substitution/handoff | `store-order-merchant.spec.ts`, positive/negative substitution and handoff suites | OOS, unconsented price change, race/duplicate handoff |
| V09 | Owner earning/withdrawal visibility | `store-earnings.spec.ts`, `withdrawal-owner.spec.ts`, canonical PG | Foreign funds, unreviewed policy, unknown payout |
| D01 | Driver register/profile/private docs | `driver-profile-onboarding.spec.ts`, `driver-documents.spec.ts`, driver registration PG | Foreign media and separate compliance approval |
| D02 | Eligible driver dispatch/handoff | `dispatch/dispatch.spec.ts`, `store-order-handoff.spec.ts`; assignment/lease | Stale/reassigned/foreign or unavailable driver |
| D03 | Driver OTP/POD/location completion | `driver-canonical-delivery.spec.ts`, new linked case; assignment/OTP/private POD/GPS | Wrong code, denied GPS, foreign proof; physical QA OPEN |
| D04 | Driver COD custody | `cod-custody-remittance.spec.ts`, canonical PG; cash custody/history | Amount/replay/deposit authority; signed COD policy OPEN |
| D05 | Buyer/driver scoped persisted chat | Canonical driver suite and linked case; message/thread/outbox | Changed replay, foreign/revoked membership and reassignment |
| A01 | Independent moderation/policy admin | `catalog-administration.spec.ts`, publication API/PG; review/audit/current grants | Self-review, explicit deny, stale policy/version |
| A02 | Operations/finance administration | `control-desk.spec.ts`, refund/withdrawal finance suites; queue/source/journals | Impersonation, fake success, double financial processing |
| N01 | Current authorized recipients | Required-domain, security-outbox and email-recovery PG; source intent/delivery | Wrong/revoked contact, preference suppression/provider outage |
| M01 | Public/private media authority | Gallery/avatar/branding/private vehicle/POD suites; asset lifecycle | Foreign URL/metadata/private evidence; provider/device OPEN |
| X01 | Responsive/keyboard/accessibility | Four-width linked captures, keyboard/order-accessibility/full browser | Human WCAG/200% zoom/screen-reader review OPEN |
| R01 | Recovery/replay/worker isolation | Redis, lease/payment/refund PG and synthetic recovery job | Duplicate journals/lost lease; production restore/RTO/RPO OPEN |

Paths above are under `tests/e2e` unless marked PostgreSQL/API; the PG sources are under `tests/integration`, `tests/phase-b` and the existing canonical acceptance configuration. Historical [Phase 3 journey matrix](../phase3/CUSTOMER_JOURNEYS_MATRIX.md) and [recipient matrix](../phase3/NOTIFICATION_AND_MESSAGE_RECIPIENT_MATRIX.md) retain context; final execution is required again on the final checkout.
