# Manual External Payout Operations

`MANUAL_EXTERNAL` means finance records authoritative evidence from an approved external financial system. The application never calls a bank API or stores bank credentials.

Finance starts a durable payout attempt before external work. A definite no-payout result records `FAILED` and returns the withdrawal to `APPROVED` with funds held. A verified payout uses a namespaced `manual-bank:` opaque reference and atomically posts the payout journal, marks the attempt successful, marks the withdrawal paid, and resolves related reconciliation cases.

The requester cannot approve or process their own withdrawal. The completion actor must differ from the approval actor; no super-admin bypass is implemented.
