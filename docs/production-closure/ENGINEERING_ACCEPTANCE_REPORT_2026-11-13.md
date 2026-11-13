# Engineering and operator acceptance report — 13 November 2026

This report separates reproducible code-level evidence from real-account and production approval. It is not a live-launch authorization. The developer/product owner will create the real-email test accounts and perform real-world acceptance; no acceptance contacts or independent finance reviewer have been provided to engineering.

## Confirmed code changes

- The seller identity form's browser pattern was corrected to support the existing valid identity-version format, including the unregistered-seller workflow.
- Paystack webhook authentication uses the original bounded request bytes, and provider responses are bounded before parsing. An invalid signature, malformed body or unknown provider result cannot be treated as a successful payment.
- Delivery quoting distinguishes provider unavailability from an unresolved address, requires affirmative marketplace coverage, rejects imprecise locations, and checks legacy pickup coordinates against provider geometry. The actual cause of the recorded live incident still requires an authorized provider trace and real route.
- The ordinary referral worker fairly rotates unqualified pending signups, reports failed items, leaves issuing disabled unless configured by an authorized operator, and attributes automatic ledger entries to the system rather than an arbitrary administrator.
- Privacy-request submission replays now require the same owner and original request details. Status and cancellation retries are bound to the original request, actor, transition and reason; foreign operation identifiers cannot return another customer's request.

## Automated evidence and limitations

- The exact source `89aa6701d7cd61950806acf7478d9eb37abe7529` passed main CI run `43340762042`. In production certification run `43340762005`, the quality artifact records 5,545 coverage tests, 487 payment tests, 115 refund tests, 67 processor tests and 23 object-authorization tests, each with zero failures, skips or flakes. These overlapping counts are separate suites, not additive totals. The browser and final certification were still running when this report was prepared.
- The privacy changes following that commit passed local privacy/governance tests, focused lint and type checking, and the disposable PostgreSQL closure run: 38 files and 216 tests, zero skipped. That PostgreSQL run includes real database assertions for foreign request replays and consent-withdrawal retry. The resulting new commit requires its own exact-source CI and browser certification; older results are not a substitute.
- Isolated tests cover substantial customer, store, driver, admin and payment paths, including denial, concurrency and recovery. They do not independently prove every combination, real provider behavior, real account usage or physical delivery.
- The processor registry explicitly disables subscription renewals, promoter qualification, promotion expiry, advertising click billing, developer webhook delivery and credential expiry, report generation and artifact expiry, and the generic privacy-request processor. These are not represented as passing or active; the privacy request service and retention processor have separate implemented workflows. Product scope and any work needed to enable those processors remain open.
- Source locks and open commercial gates remain in place. The production audit cited by `engineering-gates.json` is historical; a current least-privilege read-only protected-row comparison and current worker readiness evidence remain outstanding.

## Environment status

On 13 November, Railway's `KT Legacy Migration Staging` project listed one environment and no services or buckets. It has not been shown to have an isolated database or authorization for test transactions. `scripts/e2e-test.mjs`, `compose.e2e.yml`, and `lib/testing/disposable-paystack-policy.ts` describe the separate disposable, network-restricted automated environment; its fixture credentials are not real-world test authorization.

## Operator acceptance checklist

Follow `PARCEL_REAL_ACCOUNT_ACCEPTANCE_MATRIX_2026-11-12.md` and `REAL_MONEY_ACCEPTANCE_RUNBOOK.md`; retain evidence in an approved restricted location without passwords, OTPs, keys, bank credentials or identity-document contents.

| Status | Owner action |
| --- | --- |
| AWAITING_PROVIDER_TEST_AUTHORIZATION | Supply an intended isolated environment URL, verify database isolation and grant explicit Paystack Test Mode authorization. Document which checkout, refund, COD, deposit reconciliation and payout operations are permitted. A real-money operation additionally needs its own written scope and ceiling. |
| AWAITING_OWNER_TEST_ACCOUNT | Create and verify customer, vendor/store and driver accounts with the owner's real test email addresses. Supply references privately; provide a genuine reviewed store collection location, approved coverage and driver/vehicle readiness. |
| AWAITING_FINANCE_REVIEWER | Nominate an independently authorized finance reviewer and identify the separate admin reviewer through an approved private channel. |
| AWAITING_OPERATOR_ACCEPTANCE | Capture the exact application and worker SHA, provider mode, feature flags and read-only baseline; run customer, vendor, driver, admin, payment, refund and applicable cash workflows from the matrix with genuine evidence and negative-role checks. |
| AWAITING_COMMERCIAL_APPROVAL | Independently review and authorize notifications and recipients, product/package measurements, taxes, commission, COD, settlement, payouts and other applicable terms before enabling them. |

Production funds, account records, approvals, policies and protected data must not be fabricated or changed merely to turn an acceptance result green.
