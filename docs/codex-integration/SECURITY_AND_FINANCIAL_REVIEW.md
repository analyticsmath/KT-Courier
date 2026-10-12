> **Historical snapshot:** This document was prepared against the 6eed666 integration evidence baseline. The final exact-source results, corrected browser status and current handoff are in [PHASE_2_FINAL_CLOSURE.md](PHASE_2_FINAL_CLOSURE.md).
# Security and financial review

## Authorization and tenant boundaries

The source tree routes decisions through server-side permission and ownership checks. Client-side navigation is not treated as authority. Key paths reviewed include `lib/client-platform/store-permissions.ts`, `store-access.ts`, `lib/store-orders/store-order-auth.ts`, `lib/client-platform/support-access.service.ts`, private-media services and the role-protected route handlers.

| Actor | Intended authority | Negative boundary reviewed in source/tests | Exact integration evidence |
|---|---|---|---|
| Anonymous/guest | Public quote and public catalogue only; guest quote capability is bound to a hashed, HttpOnly cookie. | Cannot read another guest's private quote or mutate an authenticated booking/order by changing a reference. | T1 quote policy; directed browser quote ownership and sign-in/booking resume cases pass within 42/42. |
| Customer | Own profile, addresses, orders, wallet/refund projection, support and notification records. | Foreign IDs, stale ownership and private media references must be refused; wallet projection cannot post ledger entries. | T1 account/service/BOLA, canonical refund PostgreSQL, disposable closure, and directed identity/wallet/refund browser coverage pass. |
| Store owner | Own store settings, catalogue, inventory, orders, reports and employee grants. | Foreign store object access and stale mutations denied; owner approval is not implied by public listing. | T1 and PostgreSQL closure/canonical selections pass; inventory and store-order browser cases pass within directed 42/42. |
| Scoped employee | Only the explicitly granted store sections/actions. | Finance-only cannot mutate stock; marketing-only does not gain finance; revoked/disabled membership cannot reuse authority; explicit `DENY` wins. | Unit authority tests, strict PostgreSQL BOLA 10/10, and responsive employee browser stages pass; all revocation combinations are not represented as complete. |
| Driver | Own compliance documents and only assigned eligible jobs, messages and cash custody. | Foreign job, stale assignment, revoked consent/location, OTP replay and foreign POD/chat/cash references refused. | T1 driver policies, canonical PostgreSQL 41/41, strict BOLA 10/10 and selected assigned-job/POD/location/COD browser journeys pass; actual device acceptance remains open. |
| Admin | Only configured permissions; sensitive changes use independent review, versions and audit history. | Explicit user-level DENY overrides role-level grants; stale policy versions and maker self-review are rejected. | T1 policy, strict PostgreSQL BOLA 10/10 and disposable migration/closure results pass; hosted admin acceptance remains open. |
| Super-admin support | Purpose-bound, 15-minute audited read-only business view with current `stores.read` rechecked. | Grant/read fails when the explicit permission is denied; no silent impersonation or financial mutation. | T1 support-access and strict PostgreSQL BOLA matrix pass; full current-session audit lifecycle browser acceptance remains open. |

## Payment, ledger, refund and COD controls

- Payment success is intended to be established by verified signed Paystack ingress and server-side Verify, bound to transaction identity, reference, amount, currency, status and canonical owner. Redirect query parameters or client callbacks are not payment authority.
- Claim/receipt fencing, immutable operation identity, canonical source hashes and idempotent downstream consumers protect against duplicate or interrupted effects. ZAR amounts use source-authoritative decimal/cent representation and append-only balanced journals.
- Unknown provider outcomes remain held/reconcilable liabilities; they do not trigger optimistic second refunds or payouts. Original-method guest refund liability is distinct from a customer wallet credit.
- Driver cash screens are projections of cash custody and canonical earnings. A driver submission cannot be treated as bank verification; COD eligibility must be approved by store, service, region, order and amount limit.
- Commercial split examples in client documents remain configurable and inactive until approved. No live payment, refund, payout, deposit verification, bank reconciliation, Paystack request or provider secret access occurred during this integration work.

Phase 1's hosted evidence on `46aeb318d097852db5634a512c5773818a884ece` remains valid for its own source SHA. On integration source `6eed666775a30db5e7e4a70208c418072b76053b`, canonical PostgreSQL is 41/41 across 19 files, closure PostgreSQL 178/178, strict BOLA 10/10, Redis 7/7, Paystack PostgreSQL 2/2 and browser 9/9, and the dedicated Phase 2/3 browser selection is 42/42. Full Chromium discovery contains 139 cases; one process timed out after emitting 84 passes and the remaining 55 passed in four bounded runs. See `INTEGRATED_TEST_EVIDENCE.md` for this limitation and receipts. The DB-free suite passes 3,734/3,734.

## Media, privacy and deployment threat boundaries

- Private ID/licence/POD/profile objects must use private storage and ownership checks; stored media IDs are not public authorization. Replacement/removal must revoke or quarantine prior references, and access should be audited with bounded/no-store responses.
- Client privacy text describes collection of identity, address, location, device, order, driver and vendor information; it calls for purpose limitation, access safeguards, retention/deletion, consent handling and controlled cross-border processing. Code tests are not POPIA counsel approval.
- Pharmacy/prescription, alcohol and other regulated goods require independent regulatory controls; unsupported items must remain restricted. No blanket commercial or legal claim is inferred from the supplied policy text.
- `vercel.json` currently rewrites every request path to the production Railway host. That is a direct preview data-plane risk; do not push or create a preview until platform routing, credentials, environment bindings and stateful request behavior are proven isolated.
- No production database/Redis, Railway staged patch, Vercel deployment, Cloudinary mutation, customer data, or protected production row was accessed. Unit-time PostgreSQL endpoints were invalid loopback port-1 placeholders and Redis was unset. Disposable integration used unique Compose projects, loopback-only DB/browser ingress, an internal app network, a failed literal-IP outbound probe, `KT_NETWORK_DISABLED=true`, `EMAIL_PROVIDER=console` and a dummy Paystack test key. No `.env` file was present in the integration worktree.
- `npm audit --omit=dev --audit-level=high` reports zero vulnerabilities. The full audit reports five high dev-tree advisories along the `braces@3.0.3 → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next@16.3.8` chain. npm recommends a forced downgrade of `eslint-config-next` to 14.2.35; no breaking forced update was applied.

## Result

No financial or permission assertion was removed or weakened. The Phase 2 timeout increases were reverted after full-suite testing at the original limits. The application feature source is inherited from Phase 1/shared history; the merge itself adds no app-code change. Exact-SHA disposable persistence and selected browser evidence materially strengthens the source-level review, while incomplete full-browser process evidence, absent hosted CI, preview routing risk and outstanding external approval still prevent security/financial release certification.
