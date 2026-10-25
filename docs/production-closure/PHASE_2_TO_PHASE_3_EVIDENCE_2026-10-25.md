# Phase 2 → Phase 3: engineering evidence and launch-veto reconciliation

## Verified exact-source evidence

Application commit `42d99bbdf4ac67390e156fcb627466540a77f1a1` has:

- Main CI `40208981717` **SUCCESS**.
- Production Certification `40208981691`: all **24** independent component jobs **SUCCESS**; terminal `certified` intentionally **FAIL**, owing to **nine** unresolved launch-register entries, not to failed application components.
- Full isolated Chromium **151/151**, directed cross-role **44/44**, canonical PostgreSQL **41/41**, synthetic Paystack **9/9**, and measured bounded capacity **320/320 read-only requests**. Browser selections overlap and must not be summed as unique cases.
- Vercel production READY for commit `42d99bbd`; Railway web and operations deployments recorded at the same source SHA. Worker is deployment-healthy; blocked store-order initialization is independently gated by the unapproved active operating policy.

These are T1–T4 automated engineering sources, not T5 live commercial acceptance. No authorized approver has signed off on customer launch merely from these artifacts.

## Why the same red job recurs

`check-closure-engineering-gates.mjs` checks `docs/production-closure/engineering-gates.json`, which intentionally includes both implemented technical features **and** live operating approvals. Nine launch-register entries remain `OPEN` or `VALIDATION_BLOCKED`. Every otherwise-green exact-SHA certification concludes `NOT_READY` until those entries are independently reconciled. Re-running unit tests cannot fill in a missing physical driver, bank/cash receipt, storefront packing measurement, or legal approval. Changing `OPEN` to `IMPLEMENTED` without genuine evidence would bypass a required safety control.

The new `phase2-automated` certification job requires all five source-bound groups (quality, 20-way PostgreSQL matrix, Redis, disaster recovery and browser) to be successful on the same SHA and produces `phase2-automated-engineering.json`. Missing groups, skipped runs and wrong SHA fail. It **does not** sign off manual accessibility, owner acceptance, providers, or launch authorization; those fields remain `NOT_EVALUATED`. The final `certified` job still vetoes the launch when the manifest is incomplete. It is renamed to identify the live-approval boundary distinctly from software tests.

## Remaining acceptance boundaries

| Phase/area | Current evidence level | Required next authority |
| --- | --- | --- |
| P2-01 to P2-06 | Automated T1–T3 tests passed at prior SHA | Independent real provider and delivery acceptance belongs to Phase 3 |
| P2-07 | Automated mobile/desktop and keyboard cases, rendered public review | Complete genuine assistive-technology and interactive cross-role visual evaluation; no invented assessor signoff |
| P2-08 | Isolated health/quote/store GET capacity smoke, PostgreSQL, Redis and disposable restore | Agree real production capacity assumptions and measure representative writes/infrastructure under authorized bounded conditions |
| P3 provider/notifications | Offline mocked acceptance | Approved Resend routes and genuine receiver mailbox; Paystack provider signed event, real refund/cash checks and provider account state |
| P3 financial authority | Strict code locks | Distinct business/finance signoff for 100% parcel COD eligibility, bank/remittance instructions, tax, commission, payment and settlement |
| P3 dispatch/packing | Isolated role end-to-end | Genuine compliant vehicles/licences/service regions; actual stock, sealed package measurement and approved store-order policy |
| P3 governance/release | Historical audited facts and exact-SHA source proof | New least-privilege read-only protected-row audit, correct operational addresses/disclosures, independent release decision and current deployment parity |

**Non-negotiable:** Do not turn on locked payments, settlement, policies or COD purely to make a badge turn green. Do not make a synthetic test imply a real customer delivery or a physical bank receipt. Maintain launch `NO_GO` until appropriate approvers supply and sign current factual evidence. The automated engineering checkpoint is now separately observable, so work can proceed on Phase 3 activation without repeating already-green software suites to explain the same unresolved gate.
