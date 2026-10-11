# Operator actions and separation of duties

Engineering certification is NOT_READY. These instructions are prepared for later execution and do not transfer unresolved engineering work to an operator.

1. Engineering must deliver green runnable local/disposable and GitHub component checks for the exact candidate SHA. The final `certified` manifest remains blocked while live, human or deployment evidence is legitimately missing. Operators verify the separate engineering dossiers and resolve each external gate before release; unfinished implementation remains engineering's responsibility.
2. Run `scripts/audit-reviewed-production.ts` through an approved read-only execution path before any production mutation. Retain its redacted protected-table counts and full-row hashes. The OAuth connector exposes variable names only; a fresh audit has not been obtained.
3. Discard Railway staged patch `9a3370a3-8d07-4ef9-9e8d-a57ff488fccb` through the supported dashboard workflow. It must never be accepted. Confirm it cannot delete the live repository-backed operations service.
4. Supply and approve coverage in `/admin/regions`. Check affected services, pricing enablement, boundary diagnostics, and conflict protection. No province is activated by this closure work.
5. Review the existing SMALL/MEDIUM/LARGE drafts in `/admin/parcel-profiles`; explicitly approve acceptance dimensions and weight limits by saving an active effective version. Existing examples are not approvals.
6. Author the real marketplace tariffs in `/admin/marketplace-delivery-policy`. A different authorized administrator approves the draft; activation requires approved status. Review distance boundaries, store precedence, risk adjustments, limits and VAT. Never use a guessed fee to unblock checkout.
7. Author the COD scope in `/admin/payment-policies`. An author saves a draft; a separate administrator with `cod_operations.manage` verifies the current secure bank instructions and supplies approved settlement timing before activation. The reviewer must also differ from the bank-instructions author. The initial production split remains 50/50.
8. Review the actual marketplace/store/driver commission and earning scopes with finance. Existing financial source locks remain intact until separately authorized commercial/provider acceptance. Subscription, promoter and advertising activation is outside this Phase 2/3 mandate; their historical configuration templates confer no authorization. Do not enable billing, payout, retention or other processors just because a plan exists.
9. For notifications, Actor A uses exact template/route approval permissions to approve recipient policy and submitted template text. Actor B, with publish/activate permissions, publishes that approved template. Prepare the route against the published template and approved recipient policy; Actor A approves it and Actor B activates it. `/admin/notifications/customer-orders` exposes the courier workflow; use the required-domain dossier for offline event/browser evidence. Genuine templates, delivery routes and external acceptance remain operator work. The system rejects the same approver/publisher or approver/activator.
10. Separately authorize the controlled real-money charge, refund, and any settlement/payout exercise using `REAL_MONEY_ACCEPTANCE_RUNBOOK.md`. Authorization must identify the amount, scope, responsible human, and limits. No such authorization has been given in this chat.
11. Perform genuine mobile GPS, pickup OTP and POD acceptance with the approved driver and customer. Record device permission behavior, background/interrupted location behavior, denied ownership access and evidence provenance. Synthetic coordinates are automated proof only.
12. Obtain vendor confirmation of current stock and authenticity for migrated products.
13. Configure the server-only Vercel `RAILWAY_PRODUCTION_ORIGIN` with the verified HTTPS web-service domain before promoting this source change. A missing/invalid origin fails closed. Preserve preview homepage behavior.
14. After a gated deployment, compare Vercel, Railway web and operations SHAs; confirm health and inspect safe error diagnostics. Rerun the identical protected-row audit before operator acceptance creates any records. Unexpected data differences block release.
15. Record non-secret acceptance artifacts in `/admin/production-readiness` using `system_readiness.manage`. A different authorized administrator reviews each draft. Evidence is bound to the exact release and expires; it cannot replace the underlying acceptance exercise.

Do not create a fake second production administrator to satisfy separation of duties. Use existing authorized human actors. Grant permissions through the normal audited authorization workflow.

## Safe staged-patch discard — prepared, not executed

The infrastructure operator needs a separate authorized session to inspect and discard patch `9a3370a3-8d07-4ef9-9e8d-a57ff488fccb`. The [official Railway staged-changes workflow](https://docs.railway.com/deployments/staged-changes), checked 2026-10-08, provides individual discard controls.

1. Select project `e9554aaa-1b53-4595-8731-e8c2885ac594` and production environment `2226be2a-86f7-4590-a7b4-72aa54dccf52`. On the project canvas open **Details** in the staged-changes banner. Match the exact patch and every diff against the historical restricted receipt.
2. Identify the proposed deletion of operations service `fdd13e91-dffa-400e-9a44-ae2d1f891ff0` (`query-storefront-categories`) and obsolete `paystack-credential-test` creation. Use the **x** beside each change belonging to this unsafe patch. Preserve unrelated staged work for its owner.
3. Never select **Deploy**, including Alt+Deploy: both commit changes. If identity or discard controls differ, stop and obtain Railway support rather than substituting an API accept operation.
4. Reopen Details and retain a redacted receipt showing this patch's deletion/creation changes absent. Separately confirm the existing operations service/repository/branch/start command, replica, last deployment and health remain intact. No new processor is activated by discarding staging.

Historical health/configuration is in `RAILWAY_CONFIGURATION_EVIDENCE.md`; no live refresh or discard was performed under this engineering mandate. See `ENVIRONMENT_AND_ACTIVATION_DEPENDENCIES.md` for non-secret configuration names, owners and diagnostics.

## Bounded external action ledger

This table assigns future decisions; it does not approve or execute them. Engineering defects remain with engineering until the exact-source dossiers are complete.

| Priority | Responsible human | Required decision / evidence | Explicit authorization boundary |
|---|---|---|---|
| P0 | Infrastructure owner | Inspect and discard only the identified dangerous Railway patch; retain the live operations service/configuration | Separate production dashboard session with exact patch scope; never accept/deploy it |
| P0 | Data owner + infrastructure | Obtain approved read-only role/path, protected counts/full-row hashes, baseline and later same-scope comparison | Written production read-only audit approval; no write/admin connection substituted |
| P1 | Finance/commercial + logistics | Real tariffs, VAT/commission basis, COD limits/split/bank-instructions version, coverage, packing/parcel facts and effective windows | Author/review/activate through existing governed surfaces with genuine distinct actors |
| P1 | Finance + payments operator | Genuine Paystack charge, definitive refund outcome and separately scoped settlement/payout if required | Exact amount/currency/ceiling/accounts/environment/time window and abort conditions; source financial locks reviewed separately |
| P1 | Messaging owner + independent reviewer | Actual approved required-domain templates/recipient routes and external delivery, suppression/revocation evidence | Maker/checker publication/activation plus genuine recipient/destination ownership |
| P1 | Media/security + logistics + affected users | Live authenticated Cloudinary/private storage, actual camera/POD/GPS/pickup and privacy/retention approvals | Defined private data scope, storage/cleanup handling and physical/device exercise; no synthetic provenance accepted as physical evidence |
| P1 | Client/product owner + genuine customer/vendor/driver/admin representatives | Directed role acceptance and independent phone/desktop visual, keyboard/accessibility review | Named reviewers/devices/tasks, dated issues/outcomes and SHA-bound sign-off |
| P1 | Infrastructure + release owner | Production backup freshness/permissions/RPO/RTO, verified Vercel origin, approved release, matching Vercel/Railway web/operations SHAs and live health | All release gates satisfied first; separate merge/deploy/migration approval, protected-row comparison before acceptance mutations |

Optional recruitment, subscription, advertising and promoter activation is not an external prerequisite created by this Phase 2/3 mandate. Preserve those inactive surfaces and their source locks.
