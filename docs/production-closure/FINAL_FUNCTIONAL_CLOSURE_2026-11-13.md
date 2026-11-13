# Functional closeout: working-tree progress

The system is **not yet functionally closed or authorized for production release**. This document records the present working-tree changes, not an exact-commit certification. The baseline is `85861f8e550ae58d74e0a9c1f7aad35bd433fa88`; the owner must review these changes and push a candidate on `main` before exact-SHA CI evidence can exist for them.

## Implemented source

- Engineering certification is separated from the manual release authorization entrypoint. An engineering pass does not authorize a release.
- An isolated Ed25519 attestation verifier checks bound source, deployments, evidence and distinct reviewer signatures. The protected entrypoint still refuses authorization: independent trust, authoritative evidence retrieval, revocation and atomic replay protection are not connected.
- Report creation, processing and download reject transient local storage in production. Conditional state transitions prevent retry or reconciliation cancellation from overwriting a concurrent cancellation or completion.
- The promotion reconciliation read path queries a bounded database result rather than returning a fabricated empty queue. Promotion activation and financial controls remain locked.

## Remaining engineering work

The queued-report runner and expired-promotion runner remain placeholders; additional promotion services and registered processors remain disabled or incomplete. The independent release authority, hosting promotion controls and full workflow verification are not complete. The original document traceability register and existing open engineering gates must be reconciled against actual implementation before functional closeout can be claimed. No source-only evidence establishes provider, finance, operator, or physical delivery acceptance.

## Working-tree verification

The local full unit suite passed 5,558 tests across 1,095 files. Lint, type checking, 25 focused release tests and the isolated 221-test PostgreSQL closure selection also passed. An earlier full-suite attempt timed out in the static-image inventory test while other heavy checks ran concurrently; that test passed independently and the full suite subsequently passed without competing checks. These are working-tree results, not exact-SHA CI or live-provider evidence.

The canonical isolated Chromium attempt did not reach browser execution: its Docker application build was killed with `cannot allocate memory` during the Next.js production build. The supported host-build fallback requires a clean committed tree, which this in-progress working tree does not satisfy. Chromium acceptance for these changes remains unverified.

## Operator acceptance

- `AWAITING_OWNER_TEST_ACCOUNT`: owner creates and verifies authorized customer, store and driver accounts and supplies genuine operating details.
- `AWAITING_FINANCE_REVIEWER`: owner nominates an independently authorized finance reviewer and provides tax and finance evidence.
- `AWAITING_PROVIDER_TEST_AUTHORIZATION`: owner specifies an isolated test environment, provider test-mode authorization and permitted operations.
- Configure and independently verify protected reviewers, external signing/trust and replay controls, and hosting promotion restrictions using the separate release runbook. Complete the real-account acceptance matrix and real-money runbook only with their required explicit authorization.
