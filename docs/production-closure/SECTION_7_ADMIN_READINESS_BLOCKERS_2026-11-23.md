# Section 7 — Admin Production-Readiness Blockers

**Snapshot date:** 2026-11-23

**Repository:** `analyticsmath/KT-Courier`

**Purpose:** Persistent handoff for any later engineering or operations chat working on the 16 launch blockers shown by `/admin/production-readiness`.

## Current status

The 16 rows are real, counted launch gates. They are not the three optional programs excluded by launch policy (subscriptions, promoter recruitment, and paid advertising), and they are not 16 code defects. A gate remains blocked until its own source evidence is current, scoped to the deployed release, and—where required—independently approved. Never lower a predicate, set an approval flag, fabricate evidence, or reuse evidence from another release to make the count fall.

At the admin board snapshot on 2026-11-23, the release was `BLOCKED` with **16 launch blockers, 17 verified ready, and 3 excluded by policy**. The 16 consisted of 2 engineering, 3 delivery operations, 8 finance/settlement, and 3 notification-governance gates.

Railway production was freshly inspected read-only on 2026-11-23: `web`, `operations`, `query-storefront-categories`, Postgres, and Redis were online; each had one running replica; there were no recent failures and no staged changes. The extra `admin-replacement-inspection` service was offline with no deployment and is not one of the 16 readiness gates. Railway `web`, `operations`, and query deployments and Vercel production were on `e1878ce9a4e7ce4b4a1c9c88de5306b022d6b20b`; Vercel reported `READY`. Main CI run `45142819290` and exact-SHA production certification run `45142819253` succeeded on that release. A current-SHA CI acceptance draft was present and still required review; production deployment parity still needed a protected-data audit reference and independent review.

This snapshot describes the release before the Section 7 remediation changes in this worktree. Once the changes below are committed and deployed, refresh every release-bound evidence record against the new exact SHA. The earlier `e1878ce...` evidence will then be stale by design.

## Gate-by-gate closure map

| # | Admin capability | Why it is still blocked | Valid closure evidence and route |
|---:|---|---|---|
| 1 | `current_ci_certification` | A successful run existed for the currently deployed SHA, but its acceptance record was a draft awaiting review. | Record the successful full CI/certification result for the deployed SHA, with zero skipped critical checks; a different authorized reviewer approves it. `/admin/production-readiness#acceptance-evidence` |
| 2 | `production_deployment_sha_parity` | Matching Railway/Vercel deployments existed, but the row also requires a fresh protected-data audit reference and explicit independent acceptance. | Verify Vercel, Railway web, and Railway operations all run the exact release SHA and are healthy; run the approved read-only protected-row audit and retain only its non-secret reference/aggregate proof; then obtain independent approval. Same acceptance-evidence route. |
| 3 | `driver_onboarding_acceptance` | No current-release genuine driver onboarding acceptance had been approved. | Complete and review a real driver application, identity, PrDP/vehicle checks, and role workflow; record genuine acceptance for this SHA. Same acceptance-evidence route. |
| 4 | `driver_gps_acceptance` | No current-release physical-device GPS acceptance had been approved. | Verify actual permission prompts, foreground/background behavior, interruption/recovery, and denied-access ownership on an approved driver device; record genuine evidence for this SHA. Synthetic coordinates do not qualify. Same acceptance-evidence route. |
| 5 | `pod_otp_acceptance` | No current-release pickup/delivery OTP and proof-of-delivery exercise had been approved. | Complete the real customer/driver pickup OTP, delivery OTP/POD flow on approved devices and record genuine evidence for this SHA. Same acceptance-evidence route. |
| 6 | `approved_commission_plan` | The earlier readiness predicate accepted any active approved plan, even if active stores lacked independently approved store-specific settlement plans. The gate therefore did not prove the actual active launch scopes were covered. | The code fix now requires exactly one current, independently approved global ZAR courier plan and exactly one independently approved `ORDER_SUBTOTAL` ZAR marketplace plan for every active store. Drafts, self-approved plans, expired plans, missing scopes, and ambiguous duplicates fail closed. Finance route: `/admin/commission-plans`. The new “Prepare owner-approved default drafts” control creates editable 30% courier / 8% store drafts only where no plan exists, preserves existing operator-authored scopes, moves no money, and does not approve or activate anything. Finance must review real agreements and activate valid plans. |
| 7 | `cod_policy` | The owner-selected 50% digital deposit / 50% driver cash policy is not an approval of a live service, geography, positive cash limit, or actual remittance controls. | Create/confirm a personal-parcel `DEPOSIT_PLUS_COD` policy scoped to active service and coverage, with positive max cash, exact 50% deposit, and unchanged approved remittance instructions; distinct authorized maker/checker approval is required. Full COD and store policies do not satisfy this gate. `/admin/payment-policies` |
| 8 | `cod_remittance` | Secure bank/remittance instructions and their approval/timing were not evidenced as current against the COD policy. | Enter the real business instructions privately, review settlement timing, and approve them through finance controls; the policy evidence must refer to the current unchanged instruction version. No bank details belong in this file. `/admin/cash-deposits` |
| 9 | `payment_integration_acceptance` | The current release had no independently approved valid payment acceptance record. The two low-balance Paystack card attempts discussed by the owner were test attempts, not successful acceptance evidence. | Use a verified Paystack **sandbox** payment with successful attempt and canonical ledger evidence; the API verifies exact amount/currency/reference. A real-money test is not required for this gate. Record for the current SHA and obtain independent approval. Do not alter the owner-identified failed test attempts to manufacture acceptance. Same acceptance-evidence route. |
| 10 | `payout_acceptance` | No current-release genuine payout acceptance and separate financial authorization had been approved. | Complete the authorized bounded payout exercise with verified beneficiary/outcome, authorization reference, release SHA, and independent review. Same acceptance-evidence route. |
| 11 | `refund_acceptance` | No current-release genuine refund acceptance and separate financial authorization had been approved. | Complete the authorized refund exercise and record the provider-confirmed outcome, authorization reference, release SHA, and independent review. Same acceptance-evidence route. |
| 12 | `settlement_acceptance` | No current-release genuine settlement acceptance and separate financial authorization had been approved. | Complete the bounded settlement exercise described in `REAL_MONEY_ACCEPTANCE_RUNBOOK.md`, capture the genuine outcome, record the separate authorization reference, bind to this SHA, and obtain independent approval. Same acceptance-evidence route. |
| 13 | `vendor_onboarding_acceptance` | No current-release genuine vendor journey acceptance had been approved. | Complete a real vendor onboarding/readiness journey with authorized reviewer and record its source evidence for this SHA. Identity, licensing, bank details, and owner agreement must be genuine. Same acceptance-evidence route. |
| 14 | `notification_templates` | Required transactional domains lacked a complete current set of published, reviewed templates. | Prepare genuine customer/vendor/driver/admin message text for every required domain; a distinct authorized actor reviews and approves, then an authorized publisher publishes. `/admin/notifications` |
| 15 | `notification_recipient_policy` | Real notification recipient ownership, suppression, and consent rules were not fully approved. | Obtain the real owner-controlled recipient/suppression rules and have an independent authorized reviewer approve them. `/admin/notifications` |
| 16 | `notification_routes` | Active route versions were not fully approved and activated against the required templates and recipient policy. | A separate authorized actor activates routes against published templates and the approved recipient policy; verify Resend's production domain and actual delivery/suppression behavior. `/admin/notifications` |

## Canonical 16-key register

The board's 16 counted keys are:

1. `current_ci_certification`
2. `production_deployment_sha_parity`
3. `driver_onboarding_acceptance`
4. `driver_gps_acceptance`
5. `pod_otp_acceptance`
6. `approved_commission_plan`
7. `cod_policy`
8. `cod_remittance`
9. `payment_integration_acceptance`
10. `payout_acceptance`
11. `refund_acceptance`
12. `settlement_acceptance`
13. `vendor_onboarding_acceptance`
14. `notification_recipient_policy`
15. `notification_routes`
16. `notification_templates`

The finance category has eight rows: commission plan, COD policy, COD remittance, payment integration, payout, refund, settlement, and vendor onboarding acceptance. Delivery operations has driver onboarding, GPS, and POD/OTP acceptance. Notification governance has templates, recipient policy, and routes. Engineering has current-SHA CI and deployment parity.

## Engineering changes in this worktree

- `lib/production-readiness/commission-plan-coverage.ts` adds a pure fail-closed evaluator for the exact settlement scopes above.
- `lib/production-readiness/service.ts` queries active stores and relevant current ZAR plans, then evaluates every required scope instead of treating any one active plan as sufficient.
- `lib/commercial/owner-selected-commission-defaults.ts` prepares idempotent missing-scope drafts and preserves any existing plan record; it never activates or approves a plan.
- `app/api/admin/commission-plans/owner-selected-defaults/route.ts` provides a same-origin, permission-gated, rate-limited, explicit-confirmation API for that draft preparation.
- `components/admin/OwnerCommissionDefaultPreparation.tsx` exposes the preparation action only to commission managers and explains that review/activation remain separate.
- `lib/production-readiness/contracts.ts` links each blocker to its real admin page and the evidence form; provider diagnostics link to `/admin/payment-providers`.
- `components/admin/ProductionAcceptanceEvidence.tsx` exposes the stable `#acceptance-evidence` anchor.

Targeted regression coverage is in `tests/production-readiness/commission-plan-coverage.test.ts`, `tests/admin/production-readiness-links.test.ts`, and `tests/api/admin-owner-commission-defaults.test.ts`. Local pre-commit verification on 2026-11-23 passed **5 test files / 26 tests**, `npm run typecheck`, and ESLint for the edited files. `git diff --check` also passed. Confirm the final commit's CI/certification and production deploy before treating these changes as live.

At the time this register was drafted, these changes were still in the worktree. They do not directly change production data or acceptance records. Use GitHub `main` and the live deployments to establish the current state before taking follow-up action.

## Required evidence boundaries

- Evidence must describe an actual completed check, identify the current 40-character release SHA, be unexpired, and be reviewed by a different authorized actor when the schema requires maker/checker.
- Current exact-SHA CI is engineering evidence. It cannot substitute for commercial acceptance, operator checks, protected-data audit, notification delivery, or mobile device testing.
- The readiness register does not authorize a real charge, refund, settlement, payout, bank transfer, or production data mutation. Follow `REAL_MONEY_ACCEPTANCE_RUNBOOK.md` for a separately authorized money exercise.
- Do not turn `NOTIFICATION_PRODUCTION_VALIDATION_APPROVED`, `KT_COMMERCE_ENABLED`, payout/refund flags, or other environment values on merely to change the board. Each must reflect verified configuration and explicit governed acceptance.
- Preserve the two owner-identified low-balance payment attempts. They are not valid success evidence and are not among the 16 readiness keys.

## Cross-chat handoff

For any later chat or coding agent: read this file first, then read `docs/production-closure/OPERATOR_ACTIONS_REQUIRED.md`, `docs/production-closure/REAL_MONEY_ACCEPTANCE_RUNBOOK.md`, and the current `/admin/production-readiness` board. Re-query current GitHub `main`, Railway production, and Vercel production before using any SHA or status recorded above. Continue the 16-key register; do not repeat the earlier mistake of simply explaining why rows are blocked without closing code defects and preparing the valid workflows.
