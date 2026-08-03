# Phase 22 — Subscriptions

Phase 22 adds versioned customer and store membership programs. A plan version
is an offer; an immutable contract freezes the accepted commercial, legal and
benefit terms; a billing cycle and immutable invoice provide period evidence;
the existing Phase 10–12 `Payment` aggregate is the only payment authority.

The phase excludes recurring merchandise orders, customer wallets as benefits,
coupons, promotions, driver plans, cash equivalents, proration and Phase 23
behaviour. Only rolling monthly terms are eligible for activation. Fixed-term
terms are represented for legal review but source-locked.

All provider mutation, activation, plan activation and entitlement consumption
paths remain fail-closed with `CONSOLIDATED_VALIDATION_NOT_APPROVED` until
Phase 26.5.
