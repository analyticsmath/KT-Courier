# Payment provider adapter contract

`PaymentProviderAdapter` is the only provider-specific execution seam.

## Contract

Every adapter declares an allowlisted `code`, explicit capability booleans, and exact redirect hostnames. It implements `createCheckoutSession(input, context)` and may implement `getPaymentStatus` only when the corresponding capability is true. Refund, payout, webhook and capture methods are intentionally absent.

Input contains only the stable merchant reference, public payment reference, canonical decimal amount string, ZAR, safe hashed customer reference, server-generated return/cancel URL, optional later notification URL, safe description and stable provider operation key. An adapter never receives Prisma records, raw user objects, client amount/currency/provider data or a credential DTO.

Context contains an abort signal, safe correlation ID and bounded timeout. The orchestrator calls the adapter after reservation commits and before finalization starts; no database transaction is open.

Output is normalized to a known state plus optional bounded provider reference, a validated discriminated customer action (`REDIRECT_GET` or `FORM_POST`), safe status code/metadata, provider timestamp and a definitive-outcome flag. A form action contains a frozen exact string field map and action-level ISO expiry. Raw response objects, headers, errors, stack traces, signature bases and passphrases cannot cross the adapter boundary. Protocol-required Merchant ID/Key/signature fields may exist only inside a validated form action and are discarded before persistence.

## Capabilities and unsupported operations

Capabilities are `supportsRedirectCheckout`, `supportsFormPostCheckout`, `supportsStatusLookup`, `supportsIdempotentSessionCreation`, `supportsCancellation`, `supportsAuthorizationCapture`, and `supportsAuthoritativeWebhookConfirmation`. Callers check declarations rather than names. External retry remains off unless idempotent creation is explicitly true, the merchant reference is reused, and normalized error policy permits it.

Phase 11 constructs the South African Payfast adapter only for complete sandbox configuration. It declares form POST only, no lookup/idempotent creation/cancellation/capture/authoritative webhook, and returns non-definitive `REQUIRES_ACTION`. Production remains code-locked until Phase 12.

The production registry knows only `PAYFAST` in Phase 10, constructs no adapter, and reports it inactive/unconfigured. The deterministic fake implements the same code only through direct test injection. It cannot be enabled with an environment or client flag and is absent from the production registry factory.

## Security and normalization

Redirect hosts belong to the adapter and are exact-matched after URL parsing. HTTPS is mandatory outside an explicitly injected test adapter. Snapshot policy recursively redacts secret-like keys and imposes structural/byte bounds. Provider errors map to the central taxonomy with safe operator/customer messages. Potential transmission plus missing proof is always UNKNOWN, never a definite failure.
