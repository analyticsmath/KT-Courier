# Store earning evidence

Status: canonical disposable PostgreSQL checks pass; browser execution and full
financial acceptance remain open. Production earning/release locks remain active.

Round 28c `npm run test:integration:closure` passed 122 assertions across sixteen
files, zero skipped. Six new store-earning assertions use actual PostgreSQL and
canonical receipt, accrual and release journals. They exercise concurrent natural
replay, conflicting operation evidence, duplicate settlement refusal, exact owner
projection/foreign denial, maturity gating, concurrent single release, production
lock and suspended-store refusal, and rollback of journal/balances when the earning
write fails. The generated failure trigger targets one disposable earning and is
removed in `finally`. Amounts are exact: 100.25 accrued and released once.

The synthetic source fixture runs only after the existing strong isolated
financial-database guard, additionally restricted to the named closure/browser
databases. It creates canonical checkout/payment/order relations and balanced
receipt journals. It preserves immutable succeeded-payment evidence. Synthetic
webhook verification flags, zero commissions and direct maturity timestamps are
test prerequisites, not proof of provider verification, order finalization,
commercial-policy approval or production hold-policy acceptance.

Three actual browser assertions replace the former store-owner placeholders.
Two dedicated owners at 1440px and 390px inspect 100.25 accrued and 25.40 released,
safe exact summaries, keyboard detail navigation, history, absence of mutation
controls, and foreign/missing parity. Another assertion denies customer, driver,
admin-without-business-context and anonymous API access. Each store has separate
canonical earning/ledger fixtures; no production records are written.

Discovery now selects 71 Chromium assertions in nineteen files. The three new
store-owner assertions require exact-commit execution and actual screenshot review
before they count as acceptance. Refund reserves, commissions, store staff finance
permissions, finance administration, withdrawal and complete merchant/customer
order journeys remain open. Fourteen critical placeholders remain in the audit.
