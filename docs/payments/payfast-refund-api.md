# Payfast Refund API Architecture

## Endpoint and activation

The only configured origin is `https://api.payfast.co.za`; arbitrary endpoint environment variables are not accepted. The architected create route is `POST /refunds/<pf_payment_id>`. Repository-visible material listed multiple possible query shapes but did not establish authoritative semantics, so `supportsStatusQuery` remains false and query results fail closed as `UNKNOWN`.

Payfast refund sandbox execution is not supported by the inspected foundation. Runtime state is therefore always `networkActive: false` with `PAYFAST_REFUNDS_REQUIRE_PRODUCTION_VALIDATION`, even when merchant ID, passphrase, and credential version are configured. Unit tests use an injected deterministic transport; production code has no direct `fetch` path.

## API authentication

Refund API authentication is separate from checkout and ITN signing. It constructs `merchant-id`, `version: v1`, and one caller-generated ISO timestamp; the same timestamp is signed and emitted. Header, query, and body values are normalized, combined without duplicate keys, joined with the configured passphrase, sorted alphabetically, PHP/RFC-1738 encoded, and MD5-hashed to lowercase hexadecimal. The passphrase, signature base, request headers, and credentials are never persisted or logged.

## Amount protocol

The code accepts exact positive Decimal input but declares `PAYFAST_REFUND_AMOUNT_UNIT = "UNRESOLVED"`. Current repository-visible official material did not prove whether the API expects rands, cents, or integer minor units. The production serializer throws instead of multiplying or formatting by guess. A reviewed serializer can only be injected into deterministic tests. This ambiguity is a production activation blocker.

## Request and response safety

Normalized create bodies contain only `amount`, a bounded reason, and `notify_buyer`. No bank account, account holder, branch code, banking credential, card data, email, signature, or Merchant Key is accepted or persisted. Redirects are rejected, timeout is enforced by the orchestration context, and there is no blind retry.

Raw responses are discarded. Until official status semantics are proven, safe identifiers/status strings are retained but normalized to non-definitive `UNKNOWN`. A `SUCCEEDED` application result must be definitive and include a provider refund ID before completion accounting can run.
