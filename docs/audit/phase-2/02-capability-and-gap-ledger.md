# 02 — Capability and Gap Ledger

## Overview

This ledger tracks every Phase 2 capability, its operational status, evidence level, and remaining dependencies.

## Capability Ledger

| Capability ID | Feature Description | Code Authority | Current Status | Evidence Level | Outstanding Dependency / Action |
| --- | --- | --- | --- | --- | --- |
| CAP-01 | Catalogue authoring, taxonomy, variants, price & inventory | `lib/catalog/*` | COMPLETE | `STATIC_EVIDENCE`, `BEHAVIORAL_TEST` | Local PostgreSQL execution |
| CAP-02 | Catalogue media intake, hashing and delivery proxy | `lib/catalog/media/*` | SOURCE_LOCKED | `DECLARED_POLICY` | External media storage/scanning provider activation |
| CAP-03 | Storefront projections, search, category & collection display | `lib/storefront/*` | COMPLETE | `STATIC_EVIDENCE`, `BEHAVIORAL_TEST` | Local PostgreSQL execution & human browser validation |
| CAP-04 | Public exposure gate & metadata short-circuiting | `lib/storefront/storefront-page-access.ts`, `app/(public)/shop/layout.tsx` | COMPLETE | `BEHAVIORAL_TEST`, `DB_FREE_VALIDATION` | Interactive browser acceptance |
| CAP-05 | Anonymous guest cart & secret hash management | `lib/marketplace-checkout/tokens.ts` | COMPLETE | `BEHAVIORAL_TEST`, `DB_FREE_VALIDATION` | Interactive browser acceptance |
| CAP-06 | Cart line resolution & public exposure check | `lib/marketplace-checkout/cart.service.ts` | COMPLETE | `BEHAVIORAL_TEST` | Local PostgreSQL execution |
| CAP-07 | Cart mutations (add, update, replace modifiers, remove, clear) | `lib/marketplace-checkout/cart-mutation.service.ts` | COMPLETE | `BEHAVIORAL_TEST`, `DB_FREE_VALIDATION` | Local PostgreSQL execution |
| CAP-08 | Guest cart claim & customer cart merge | `lib/marketplace-checkout/cart-mutation.service.ts` | COMPLETE | `BEHAVIORAL_TEST`, `DB_FREE_VALIDATION` | Local PostgreSQL execution |
| CAP-09 | Transaction-wrapped merge & canonical receipt recording | `lib/marketplace-checkout/cart-mutation.service.ts` | COMPLETE | `BEHAVIORAL_TEST` | Local PostgreSQL execution |
| CAP-10 | Checkout contact, address, quote & review composition | `lib/marketplace-checkout/*` | SOURCE_LOCKED | `STATIC_EVIDENCE` | Local PostgreSQL execution & provider activation |
| CAP-11 | Payment preparation & PayFast provider integration | `lib/payments/providers/payfast/*` | SOURCE_LOCKED | `DECLARED_POLICY` | External PayFast live credentials |
| CAP-12 | Marketplace store order creation & Phase 21 handoff | `lib/store-orders/*` | SOURCE_LOCKED | `STATIC_EVIDENCE` | Phase 3 fulfillment activation |

## Agent vs Human Responsibility Matrix

| Responsibility Area | Phase 2 Ownership | Agent Status | Human Dependency |
| --- | --- | --- | --- |
| DB-free code logic & invariants | Agent (Codex) | Complete | None |
| Full repository test suite (`npm test`) | Agent (Codex) | Complete (Exit 0) | None |
| Static analysis (TypeScript, ESLint, Prisma, Security) | Agent (Codex) | Complete (Exit 0) | None |
| Safe integration test runners & safety guards | Agent (Codex) | Complete | None |
| Local PostgreSQL instance & test DB preparation | Human Operator | Pending | Disposable PostgreSQL container/service |
| Interactive browser acceptance testing | Human Operator | Pending | Browser validation checklist execution |
| External PayFast payment gateway activation | External Provider | Pending | Production PayFast merchant credentials |
| External media storage & virus scanning activation | External Provider | Pending | Production media storage provider setup |
| Dispatch & fulfillment operations | Out of scope | N/A | Deferred to Phase 3 |
