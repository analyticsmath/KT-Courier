# Customer Wallet Security

Each active customer wallet may have one `CUSTOMER_WALLET_AVAILABLE` and one `CUSTOMER_REFUND_HELD` ZAR account. Both are active non-negative `LIABILITY` accounts. Provisioning is idempotent, starts at exactly zero, accepts no caller balance/category/account ID, and rereads the unique winner after a race.

Balances are ledger projections and are formatted as exact two-decimal strings. Customer reads are owner-scoped and expose descriptions, direction, amount, currency, journal reference, and time—not internal wallet/account IDs, commission allocations, request hashes, provider credentials, or raw responses. Responses use no-store cache policy.

Wallet credits are possible only through the balanced `REFUND_WALLET_CREDIT` journal. There are no Phase 15 endpoints or controls for top-up, checkout spending, transfer, withdrawal, cash-out, promotion, or manual adjustment. `allowNegative` is false and database/account locks protect completion.

Refund notes are bounded and reject obvious card/banking data patterns. Original-method flows never collect bank account numbers, holders, branch codes, credentials, CVV/CVC, IBAN, or SWIFT details.
