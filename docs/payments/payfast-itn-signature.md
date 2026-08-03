# Payfast ITN Signature

The ITN signature is independent of the checkout-form signature field order. `PAYFAST_V1_FIELD_ORDER` is not used.

The strict parser preserves every received form field's decoded key, decoded value, and position. Signature input:

1. walks the received fields in received order;
2. excludes only the `signature` field;
3. omits empty values;
4. includes unknown non-empty fields;
5. formats each pair as `key=<Payfast URL-encoded value>`;
6. appends `passphrase=<Payfast URL-encoded active passphrase>`;
7. joins pairs with `&` and computes MD5 as required by the Payfast protocol.

The code does not sort fields, reuse checkout order, reformat amounts, add local values, or remove unknown signed values. The supplied signature must be exactly 32 hexadecimal characters. Both supplied and calculated digests become fixed 16-byte buffers and are compared with `crypto.timingSafeEqual`; invalid lengths/hex fail before comparison without external exceptions.

The attempt credential version must equal the active server credential version before the passphrase is used. Neither passphrase, signature, signature base, Merchant Key, nor Merchant ID appears in logs or persistence.

The fixed unit vector uses this independently calculated digest:

```text
3af95032720fc38f5d83197919f2329f
```

Official Payfast sandbox ITN compatibility remains a deferred validation item.
