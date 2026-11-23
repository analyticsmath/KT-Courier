# Section 7 — Admin Production-Readiness Blockers

**Snapshot date:** 2026-11-23

**Repository:** `analyticsmath/KT-Courier`

**Purpose:** Persistent handoff for any later engineering or operations chat working on the 16 launch blockers shown by `/admin/production-readiness`.

## Current status

The 16 rows are real, counted launch gates. They are not the three optional programs excluded by launch policy (subscriptions, promoter recruitment, and paid advertising), and they are not 16 code defects. A gate remains blocked until its own source evidence is current, scoped to the deployed release, and—where required—independently approved. Never lower a predicate, set an approval flag, fabricate evidence, or reuse evidence from another release to make the count fall.

At the admin board snapshot on 2026-11-23, the release was `BLOCKED` with **16 launch blockers, 17 verified ready, and 3 excluded by policy**. The 16 consisted of 2 engineering, 3 delivery operations, 8 finance/settlement, and 3 notification-governance gates. The two failed low-balance Paystack attempts the owner identified remain untouched; they are not among these gates.

Railway production was freshly inspected read-only on 2026-11-23: `web`, `operations`, `query-storefront-categories`, Postgres, and Redis were online; each had one running replica; there were no recent failures and no staged changes. The extra `admin-replacement-inspection` service was offline with no deployment and is not one of the 16 readiness gates. The remediation release `d5875635c3a69b7eb15e671076a843d92c9327a8` was deployed to the Railway `web`, `operations`, and `query-storefront-categories` services and Vercel production; Railway and Vercel reported success. The exact-SHA CI run `45218301152` passed lint, build, typecheck, and its applicable integration jobs, but failed the unit/API test step on two route-authorization inventory assertions: the new commission-draft route was missing from `artifacts/route-action-authorization-inventory.json`. The exact-SHA certification run `45218301241` had the same inventory-related quality failure; its browser acceptance job was still running at the time of inspection. A follow-up in this revision adds the missing route to the inventory. Rerun both workflows on the resulting `main` SHA before creating or approving current-SHA CI acceptance evidence.

The Section 7 remediation changes are on production at `d5875635…`; any release-bound evidence tied to earlier SHAs is stale. The readiness board still reports 16 because the code fixes do not grant real commercial, financial, operator, or independent-review approvals. Current CI also found the inventory drift described above; the follow-up revision corrects it, but its exact-SHA workflows must finish successfully before certification can be recorded.

## Gate-by-gate closure map

| # | Admin capability | Why it is still blocked | Valid closure evidence and route |
|---:|---|---|---|
| 1 | `current_ci_certification` | A successful run existed for the currently deployed SHA, but its acceptance record was a draft awaiting review. | Record the successful full CI/certification result for the deployed SHA, with zero skipped critical checks; a different authorized reviewer approves it. `/admin/production-readiness#acceptance-evidence` |
| 2 | `production_deployment_sha_parity` | Matching Railway/Vercel deployments existed, but the row also requires a fresh protected-data audit reference and explicit independent acceptance. | Verify Vercel, Railway web, and Railway operations all run the exact release SHA and are healthy; run the approved read-only protected-row audit and retain only its non-secret reference/aggregate proof; then obtain independent approval. Same acceptance-evidence route. |
| 3 | `driver_onboarding_acceptance` | No current-release genuine driver onboarding acceptance had been approved. | Complete and review a real driver application, identity, PrDP/vehicle checks, and role workflow; record genuine acceptance for this SHA. Same acceptance-evidence route. |
| 4 | `driver_gps_acceptance` | No current-release physical-device GPS acceptance had been approved. | Verify actual permission prompts, foreground/background behavior, interruption/recovery, and denied-access ownership on an approved driver device; record genuine evidence for this SHA. Synthetic coordinates do not qualify. Same acceptance-evidence route. |
| 5 | `pod_otp_acceptance` | No current-release pickup/delivery OTP and proof-of-delivery exercise had been approved. | Complete the real customer/driver pickup OTP, delivery OTP/POD flow on approved devices and record genuine evidence for this SHA. Same acceptance-evidence route. |
| 6 | `approved_commission_plan` | The earlier readiness predicate accepted any active approved plan, even if active stores lacked independently approved store-specific settlement plans. The gate therefore did not prove the actual active launch scopes were covered. | The code fix now requires exactly one current, independently approved global ZAR courier plan and exactly one independently approved `ORDER_SUBTOTAL` ZAR marketplace plan for every active store. Drafts, self-approved plans, expired plans, missing scopes, and ambiguous duplicates fail closed. Finance route: `/admin/commission-plans`. The new “Prepare owner-approved default drafts” control creates editable 30% courier / 8% store drafts only where no plan exists, preserves existing operator-authored scopes, moves no money, and does not approve or activate anything. In production, the control prepared **8 drafts and preserved 32 existing scopes**; these drafts remain unapproved. Finance must review the actual agreements and an independent approver must activate valid plans before this gate can pass. |
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
- `artifacts/route-action-authorization-inventory.json` now indexes the new `POST /api/admin/commission-plans/owner-selected-defaults` route with its `commission_plans.manage` permission and rate-limit evidence. The exact-SHA CI failure exposed this inventory omission; the targeted inventory suite passed **10/10 tests** after the update.

Targeted regression coverage for the commission-scope evaluator, route links, and draft-preparation endpoint passed locally before the `d5875635…` deployment (**5 files / 26 tests**); `npm run typecheck`, edited-file ESLint, and `git diff --check` passed. After the exact-SHA CI failure, `npx vitest run tests/security/route-authorization-inventory.test.ts` passed **1 file / 10 tests** with the artifact correction. No full local suite has been rerun for this follow-up. The CI and certification workflows for the corrected `main` SHA must complete before using it as accepted release evidence.

The production draft-preparation action created only the eight draft records noted above; no plans were approved or activated. No production environment variables, payment attempts, acceptance records, bank instructions, or real-money operations were changed in this work.

## Required evidence boundaries

- Evidence must describe an actual completed check, identify the current 40-character release SHA, be unexpired, and be reviewed by a different authorized actor when the schema requires maker/checker.
- Current exact-SHA CI is engineering evidence. It cannot substitute for commercial acceptance, operator checks, protected-data audit, notification delivery, or mobile device testing.
- The readiness register does not authorize a real charge, refund, settlement, payout, bank transfer, or production data mutation. Follow `REAL_MONEY_ACCEPTANCE_RUNBOOK.md` for a separately authorized money exercise.
- Do not turn `NOTIFICATION_PRODUCTION_VALIDATION_APPROVED`, `KT_COMMERCE_ENABLED`, payout/refund flags, or other environment values on merely to change the board. Each must reflect verified configuration and explicit governed acceptance.
- Preserve the two owner-identified low-balance payment attempts. They are not valid success evidence and are not among the 16 readiness keys.

## Cross-chat handoff

For any later chat or coding agent: read this file first, then read `docs/production-closure/OPERATOR_ACTIONS_REQUIRED.md`, `docs/production-closure/REAL_MONEY_ACCEPTANCE_RUNBOOK.md`, and the current `/admin/production-readiness` board. Re-query current GitHub `main`, Railway production, and Vercel production before using any SHA or status recorded above. Continue the 16-key register; do not repeat the earlier mistake of simply explaining why rows are blocked without closing code defects and preparing the valid workflows.

## 2026-11-23 live notification-gate correction (supersedes affected snapshot rows)

The exact-SHA release `1271aa29d586b9e7c45be3a39dcea033b01657ac` passed CI run `45222006743`; Railway web, operations, and query-storefront-categories and Vercel all reported successful deployment at that SHA. Its production-certification run was still in progress when the following independent readiness defect was found, so do not use that run as certification for a later SHA.

Live review of `/admin/notifications/customer-orders` found five required courier domains whose recipient-policy versions were already `APPROVED`, while their message templates were approved but unpublished and their routes remained unprepared. The readiness service incorrectly fed one combined “incomplete domain” list to all three notification capabilities. This produced a false `notification_recipient_policy` blocker. The five reviewed domains were `COURIER_ORDER:COURIER_BOOKING_PENDING_PAYMENT`, `COURIER_ORDER:COURIER_PAYMENT_CONFIRMED`, `COURIER_ORDER:COURIER_ACCEPTED`, `COURIER_ORDER:COURIER_PAYMENT_FAILED`, and `COURIER_ORDER:COURIER_UNPAID_CANCELLED`.

The five templates were reviewed and approved through the admin portal on 2026-11-23. This action did not send messages. Their recipient policies were already approved; their routes still show `NOT_PREPARED`. Publishing templates and activating routes is protected by distinct-actor review, which must be completed by a second authorized administrator. Do not bypass that maker/checker rule or create a fake second administrator. The verified Resend domain is `ktcouriers.com`, and the admin board showed the notification engineering gate and email-provider gate ready.

The current local follow-up adds `lib/production-readiness/notification-governance.ts` and updates `lib/production-readiness/service.ts` so template publication, recipient-policy approval, and route activation each have their own predicate and missing-domain list. Route activation must reference the latest published template and latest approved recipient policy. The combined notification-engineering check still requires all three. Regression tests cover approved policies with unpublished templates/unprepared routes, stale policy versions, and stale route references. The focused suite passed **8/8 tests**, edited-file ESLint passed, `npm run typecheck` exited 0, and `git diff --check` passed. At this handoff, this fix is **not yet committed or deployed**.

The board’s historical 16-blocker snapshot must not be represented as the current count after this fix. Once the new SHA is deployed and the live board is re-read, the recipient-policy row should clear if no underlying data changed; the five template-publication and five route-activation requirements remain separate. The expected count is 15 blockers and 18 ready only if all other production evidence and approvals are unchanged; verify the actual current board rather than assuming this projection. Re-run exact-SHA CI, Railway/Vercel deployment verification, and the complete production-certification workflow on the new SHA before recording release-bound acceptance evidence.
