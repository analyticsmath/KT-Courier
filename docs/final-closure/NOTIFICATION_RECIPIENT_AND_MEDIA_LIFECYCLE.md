# Notification recipients and media lifecycle

| Event | Current recipient authority | Payload/replay/privacy |
|---|---|---|
| Verification/recovery | Eligible canonical user and encrypted expiring OTP/token | Atomic token/outbox; no plaintext token log; queued request is not delivered mail |
| Checkout/payment/refund | Canonical payer/current verified guest contact and matching source history/journals | Dedupe source operation; recheck contact immediately before send |
| Store-order received/status | Current active store owner/customer relation | Current store/role guards; immutable order binding |
| Driver assignment/status | Current active assigned driver and matching dispatch/order | Reassignment revokes old recipient |
| Withdrawal/earning/COD | Wallet/custody owner plus canonical history and reserve/release/reversal journals | Notification never posts money or confirms a deposit |
| Chat | Current active members other than sender | Transactional message/outbox; notification carries IDs, not message text; revoked membership suppressed |

Missing provider/template approval remains locked. Resend retains durable queued acceptance when inline provider delivery fails; persistence failure still returns unavailable and rolls back OTP replacement. Unknown and eligible production requests share the pending reply. No console message is claimed as a real email receipt.

Product images are public only through approved inspected publication; compliance documents and POD remain private and current-scope authorized. Test selections cover MIME/magic bytes, normalization, metadata, foreign asset IDs, lifecycle replacement/deletion and recovery. Private evidence never becomes public catalog media. Actual provider quotas, signed URL expiry/cache deletion and physical captures require media-owner acceptance.
