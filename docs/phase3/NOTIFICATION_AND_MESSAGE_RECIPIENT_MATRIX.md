# Notification and message recipient matrix

Every new transactional template and route is created in draft state by `prepareRequiredDomainNotifications`; this does not approve a template, activate a route or send mail. The durable intake binds events to existing payment, refund, store order, dispatch, withdrawal and earning histories. The support-message intent is written in the same database transaction as the message and stores only message ID plus recipient ID. Message text is never copied into the notification payload or email.

| Source | Recipient reconstructed from current data | Required proof |
|---|---|---|
| Marketplace confirmation; store-order status | Checkout customer or verified current guest contact | Current checkout/order relation and verified contact |
| Store order received | Current active store owner | Active store and user role |
| Payment/refund status | Canonical payer | Matching source history and financial evidence for success |
| Dispatch assignment | Current active assigned driver | Event, assignment, order and profile all match |
| Store/driver withdrawal | Current active wallet owner | Wallet, request, status history and reserve/payout journals |
| Store/driver earning | Current active wallet owner | Earning, history, wallet and accrual/release/reversal journals |
| Conversation message | Active current conversation member other than sender | Canonical message and current role/scope membership at delivery |

`currentRequiredSourceRecipient` repeats ownership and membership checks immediately before email. A replaced guest contact, reassigned driver, changed store owner or revoked chat member is blocked. Authentication security emails continue through their specialized encrypted delivery authority. A missing independent communications/template/sender approval prevents production channel activation. Code and disposable tests do not constitute communications acceptance.
