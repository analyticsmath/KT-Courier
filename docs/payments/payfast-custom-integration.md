# South African Payfast custom integration

`PAYFAST` in KT Couriers means South African Payfast by Network. Phase 11 uses the aggregation custom-integration form protocol; it does not use hosted JavaScript, onsite card fields, direct card APIs, tokenization, subscriptions, recurring billing, split payments, or the Pakistani provider with a similar name.

## Browser action

The adapter returns `REQUIRES_ACTION` with `customerAction.type=FORM_POST`, the pinned sandbox URL, no provider reference, `definitive=false`, and `CHECKOUT_FORM_READY`. The sandbox host is `sandbox.payfast.co.za`; the inactive production host is `www.payfast.co.za`. No deployment variable can replace those hosts. The action field object is frozen and is the same object passed to the form component after server reconstruction.

## Supported v1 fields

Phase 11 supports only `merchant_id`, `merchant_key`, `return_url`, `cancel_url`, `notify_url`, optional `name_first`/`name_last`, `email_address`, `m_payment_id`, `amount`, `item_name`, optional `item_description`, and `signature`. The passphrase is used only during signing and is never a form field.

The server derives all fields. Amount is exact two-decimal ZAR. Payer identity comes from the database. Callbacks use `PAYMENT_APP_ORIGIN`. The merchant reference comes from the locked Phase 10 attempt counter. Unsupported or arbitrary fields fail closed rather than being silently signed or posted.

## Extension boundary

Phase 12 may implement verified ITN ingestion and later reconciliation. It may change the authoritative-webhook capability and production lock only after signature/source/amount/replay/confirmation rules exist. Phase 11 has no status lookup and makes no claims about provider idempotency.
