# Payfast signature protocol

Phase 11 uses the Payfast-required MD5 protocol only inside `payfast-signature.ts`. MD5 is not used for application security elsewhere.

The supported unsigned order is `merchant_id`, `merchant_key`, `return_url`, `cancel_url`, `notify_url`, `name_first`, `name_last`, `email_address`, `m_payment_id`, `amount`, `item_name`, `item_description`. `signature` is excluded. Missing/empty optional values are omitted; keys are never alphabetically sorted or discovered from database/form order.

Business values normalize once to trimmed NFC strings. UTF-8 bytes use PHP `urlencode` behavior: ASCII letters/digits and `-_.` remain; spaces become `+`; every other byte becomes uppercase `%HH`. Encoded pairs join with `&`, then encoded `passphrase` is appended. MD5 returns lowercase hexadecimal.

`buildSignedPayfastForm` normalizes once, signs that exact normalized object, adds `signature`, and freezes the result. It never returns/logs the signature base. The form enumerates the returned object directly without sorting or modifying values.

The focused suite has a hardcoded vector independently established with .NET UTF-8 encoding and MD5. Expected digest `8b36dff459ec9656d0d625fc4610caee` covers Unicode, apostrophe, spaces, plus/ampersand passphrase characters, callbacks, amount, and merchant reference.
