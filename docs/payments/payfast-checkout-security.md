# Payfast checkout security

- Credentials and mode are server-only and never use a `NEXT_PUBLIC_*` name.
- Processing endpoints are pinned constants. Unknown hosts, HTTP, credentials in URLs, fragments, path-bearing app origins, and arbitrary endpoint variables fail closed.
- KT policy requires a passphrase. It never crosses the signer boundary as output.
- Production is code-locked until authoritative Phase 12 confirmation exists.
- Provider readiness is checked after authenticated ownership at the API boundary and before attempt reservation.
- Mutations require authenticated active CUSTOMER/STORE authority, strict JSON, same-origin enforcement, UUID operation IDs, small declared bodies, and bounded rate limits.
- Signed fields are returned only by the local adapter to the server-rendered checkout page. Merchant ID/Key/signature exist as hidden fields only because the provider protocol requires them.
- Payment pages and APIs are no-store/noindex. Fields are not cached, queried, logged, analyzed, or placed in browser storage.
- Safe snapshots include only provider/environment/reference/amount/currency/item/route IDs/version/action/status. Email, callback values, credentials, signatures, and complete fields are excluded.
- Checkout reconstruction validates payer ownership, provider, current attempt number, local states, sandbox environment, stored protocol/configuration version, current registry config, and normalized `FORM_POST` output.
- Return and cancel GETs are non-authoritative reads. The reserved ITN POST returns non-success without reading or writing.
- Direct dependency injection supplies deterministic adapters/configuration to tests; no public bypass skips signature/URL/production policies.
