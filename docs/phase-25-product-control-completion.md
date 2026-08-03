# Phase 25 product and control completion

Phase 25 supports only customer and store acquisition. `BUSINESS_CUSTOMER` remains a migration-compatible enum value but fails closed with `BUSINESS_CUSTOMER_ACQUISITION_NOT_AVAILABLE`; no BusinessAccount, business registration authority, business wallet, or business qualification adapter exists.

Promoter operations use deterministic evidence and safe projections. Fraud screens never mutate financial balances. Confirmed fraud must use the canonical attribution invalidation, qualification invalidation, Phase 14 commission reversal, and Phase 9 adjustment path. Reconciliation only requests canonical retries and reaches resolved state only after evidence converges. Disputes expose no customer PII, order contents, payment references, fraud evidence, or other promoter data.

Marketing assets are trusted internal references associated to a program version, with required disclosure (`Ad`, `Sponsored`, `Paid promotion`, or `Promoter link`). Assets allow no arbitrary HTML, JavaScript, external pixels, advertiser-controlled destinations, or platform-sent promotional messages. Phase 27 owns delivery of durable event intents; Phase 25 has no email, SMS, WhatsApp, push, contact-list, or automated outreach sender.

Legal, employment, worker-classification, and tax review remain pending. Promoter approval is not employment, a visit is not attribution, registration is not qualification, qualification is not immediate payment, and held earnings are not withdrawable.
