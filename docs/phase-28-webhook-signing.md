# Phase 28 webhook signing

Deliveries use raw JSON bytes with `Content-Digest`, `Signature-Input`, and HMAC-SHA256 `Signature`. Covered components include method, target URI, digest, content type, webhook ID and timestamp. Recipients must validate raw bytes and enforce replay protection.
