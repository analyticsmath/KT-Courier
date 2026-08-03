# Payfast ITN Security

## Public endpoint contract

The ITN route is public to Payfast and accepts POST only with `application/x-www-form-urlencoded` and an optional UTF-8 charset. JSON, multipart, text, unsupported charset, invalid/zero/mismatched content length, an empty stream, malformed UTF-8, a body larger than 32 KiB, or a body read exceeding five seconds fails closed. The stream is bounded before bytes are assembled or decoded.

The route never redirects or consults a user session/origin. It has a global finite rate bound, a concurrent-request bound, and a per-source bound after source verification. Responses expose only `OK`, `INVALID`, or `RETRY`; errors and stacks are not returned.

## Proxy trust

`PAYMENT_PROXY_MODE` has no permissive default:

- `direct` requires an actual peer address injected by a runtime integration. Next.js Route Handlers do not currently supply one here, so direct-mode readiness remains blocked.
- `single_trusted_proxy` accepts only `x-kt-source-ip`. The deployment proxy must delete all inbound instances of that header and ordinary forwarding headers, write the connection source into a single canonical header, prevent direct application access, and be the only trusted hop.

`X-Forwarded-For` and `X-Real-IP` are never authority. Addresses are normalized as IPv4, IPv6, or IPv4-mapped IPv6; lists, ports, invalid syntax, loopback, unspecified, private, link-local, multicast, and other special ranges are rejected. Private addresses are possible only through direct unit-test dependency injection, not production configuration.

## Dynamic source set

Only internally pinned Payfast hostnames are resolved. The resolver requests A and AAAA records, normalizes/deduplicates results, caps the set at 128 addresses, clamps TTL lifetime to 30 seconds–5 minutes, refreshes at 80% of the bounded lifetime, and permits only a one-minute stale grace after expiry. DNS failure with no safely stale set returns a retryable failure; it never accepts an unknown source. There is no reverse-DNS trust, caller-supplied hostname, or copied individual IP list.

## Secret and evidence handling

The passphrase and Merchant Key remain server-only. Merchant ID is compared but not persisted in the event. The signature and its base are never logged or persisted. The safe snapshot contains only merchant reference, provider payment ID/status, exact gross and validated optional fee/net text, a bounded non-contact item reference, field counts, and protocol version. Unknown values, email, and payer names are excluded.

Structured observations use a closed metric vocabulary for received, transport/source/signature rejection, amount mismatch, provider unavailability, verification, duplicate, application, stale handling, and reconciliation. Only safe references, environment/status, duration, and safe error codes may be emitted.

## Credential rotation

Each Payfast attempt captures the non-secret `PAYFAST_CREDENTIAL_VERSION`. Automatic verification requires an exact match with the active version. Mismatch causes no credential guessing, no arbitrary historical passphrase attempt, no failure transition, no journal, and a reconciliation case. Operations must drain nonterminal attempts before rotating credentials.

## HTTPS and production

`PAYMENT_APP_ORIGIN` must be a clean HTTPS origin. Public callback reachability, TLS, proxy header stripping, and source correctness require deployment validation. Production remains code-locked until those proofs and consolidated review are complete.
