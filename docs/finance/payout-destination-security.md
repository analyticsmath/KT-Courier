# Payout Destination Security

Phase 13 stores only an opaque `manual-finance:` external reference, a masked label, optional institution name, optional last four characters, country, currency, owner/wallet, lifecycle status, and verification/disable actors. It accepts no account number, IBAN, routing secret, card data, credential, token, password, PIN, raw evidence, email, or phone number.

Only finance administrators may register or activate a destination. Owners see only active masked destinations. A destination used by a withdrawal cannot be deleted; its identity metadata is immutable and any change requires a new destination record.

The legacy `WithdrawalRequest` placeholder fields (`reviewedByUserId`, `bankName`, `accountHolder`, `accountLast4`, `rejectionReason`, `metadata`, `reviewedAt`, and `paidAt`) are a separate compatibility concern. They remain physical nullable columns, but are mapped with Prisma `@ignore`, required to be null for Phase 13 rows, and cannot provide a payout fallback. In particular, `PayoutDestination.accountLast4` is permitted masked metadata; it is not the ignored legacy `WithdrawalRequest.accountLast4` field. Cleanup of the retained columns requires the consolidated cleanup gate.
